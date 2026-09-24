/**
 * Application service behind the Code view routes (WANDIT-271).
 * `CodeController` calls `snapshot` for the file tree and `file` for one
 * file. Both read the running project sandbox through
 * `SandboxProvider.findRunning` and run git, bash, and coreutils in its
 * worktree.
 */
import { posix } from "node:path";

import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
	PayloadTooLargeException,
} from "@nestjs/common";
import {
	CODE_FILE_MAX_BYTES,
	type CodeFileResponse,
	type CodeSnapshotResponse,
} from "@wandit/contracts";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	buildCodeTree,
	isReadableCodePath,
	pickDefaultFilePath,
} from "../../domain/code-tree";
import {
	SANDBOX_PROVIDER,
	type SandboxProvider,
	type SandboxReader,
} from "../../domain/ports/sandbox-provider";
import { mustRunGit } from "../../infrastructure/git/sandbox-git";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";

/**
 * Most paths that one git listing returns. The SDK holds the whole stdout
 * and stderr of a command in the API process, so a listing must stay small.
 */
// LIMIT: a worktree with more files shows the first 5000 paths git lists.
// Upgrade: load the tree one folder at a time.
const MAX_LISTED_PATHS = 5_000;

/**
 * 2 MB, the most stdout bytes of one git listing. 5000 paths of 400 bytes
 * fit; git accepts a path of megabytes through `update-index`.
 */
const MAX_LISTED_BYTES = 2 * 1024 * 1024;

/**
 * Runs `git <args>` and keeps the first `$1` NUL-ended paths and at most
 * `$2` bytes of them. Git errors go to a file, and only the first 4 KB come
 * back: a git hook can write megabytes to stderr. `head` closes the pipe at
 * a cap, and git then exits 141 (SIGPIPE): not a failure.
 */
const CAPPED_GIT_LIST_SCRIPT = [
	"cap=$1; max_bytes=$2; shift 2",
	"errors=$(mktemp)",
	'git "$@" 2>"$errors" | head -z -n "$cap" | head -c "$max_bytes"',
	"status=$PIPESTATUS",
	'head -c 4096 "$errors" >&2; rm -f "$errors"',
	'[ "$status" -eq 0 ] || [ "$status" -eq 141 ] || exit "$status"',
].join("\n");

/** The exit code of `CAPPED_READ_SCRIPT` when `$1` is not a regular file. */
const NOT_A_FILE_EXIT_CODE = 44;

/**
 * Reads at most `$2` bytes of the regular file `$1` as base64. `head -c`
 * caps the read, so a file that grows after a check never fills the API.
 */
const CAPPED_READ_SCRIPT = `set -o pipefail; [ -f "$1" ] || exit ${NOT_A_FILE_EXIT_CODE}; head -c "$2" -- "$1" | base64 -w 0`;

/**
 * 10 s. A FIFO blocks the command: a FIFO `.gitignore` blocks git, and a
 * FIFO that replaces a file after the `-f` test blocks `head`. The vendor
 * kills the command at this timeout, and the read fails.
 */
const COMMAND_TIMEOUT_MS = 10_000;

/** 8 KB. A NUL byte in this first part marks a binary file. */
const BINARY_SNIFF_BYTES = 8 * 1024;

/**
 * The file tree and file reads of the Code view. Reads never take the turn
 * lock: a read during a running turn can see a half-written file, and that
 * is fine for a viewer.
 */
@Injectable()
export class CodeService {
	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes a plain fake. Nest still injects by the token.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject"
		>,
		@Inject(SANDBOX_PROVIDER)
		private readonly sandboxes: Pick<SandboxProvider, "findRunning">,
	) {}

	/**
	 * The worktree tree: tracked and new files, without ignored files,
	 * `.git`, and `.env*`. Ignored files include `node_modules`, `dist`,
	 * and `.wrangler`, because the template `.gitignore` lists them.
	 */
	async snapshot(
		scope: ProjectScope,
		projectId: string,
	): Promise<CodeSnapshotResponse> {
		const sandbox = await this.requireRunningSandbox(scope, projectId);
		const [listed, deleted, head] = await Promise.all([
			listGitPaths(sandbox, [
				"ls-files",
				"-z",
				"--cached",
				"--others",
				"--exclude-standard",
			]),
			// A turn can delete a tracked file before its commit. `--cached`
			// still lists it, but a read of it answers 404.
			listGitPaths(sandbox, ["ls-files", "-z", "--deleted"]),
			mustRunGit(sandbox, ["rev-parse", "--abbrev-ref", "HEAD"], Error),
		]);
		const deletedPaths = new Set(deleted);
		const tree = buildCodeTree(
			listed.filter((path) => !deletedPaths.has(path)),
		);
		return {
			branch: head.stdout.trim(),
			defaultFilePath: pickDefaultFilePath(tree),
			tree,
		};
	}

	/**
	 * One worktree file. `path` is relative to the worktree root. Text comes
	 * back as UTF-8; a binary file comes back with an empty `content`.
	 */
	async file(
		scope: ProjectScope,
		projectId: string,
		path: string,
	): Promise<CodeFileResponse> {
		const sandbox = await this.requireRunningSandbox(scope, projectId);
		if (!isReadableCodePath(path)) {
			throw invalidPath();
		}
		const realPath = await resolveInsideWorktree(sandbox, path);

		// One byte over the cap tells a file at the cap from a larger one.
		const read = await sandbox.exec(
			"bash",
			[
				"-c",
				CAPPED_READ_SCRIPT,
				"bash",
				realPath,
				String(CODE_FILE_MAX_BYTES + 1),
			],
			{ cwd: sandbox.workspaceDir, timeoutMs: COMMAND_TIMEOUT_MS },
		);
		// A folder, a FIFO, or a file that a turn deleted after `realpath`.
		if (read.exitCode === NOT_A_FILE_EXIT_CODE) {
			throw fileNotFound();
		}
		if (read.exitCode !== 0) {
			throw new Error(
				`Code file read failed (${read.exitCode}): ${read.stderr}`,
			);
		}
		const bytes = Buffer.from(read.stdout, "base64");
		if (bytes.byteLength > CODE_FILE_MAX_BYTES) {
			throw fileTooLarge();
		}
		const binary = bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
		return {
			binary,
			content: binary ? "" : new TextDecoder("utf-8").decode(bytes),
			path,
			size: bytes.byteLength,
		};
	}

	// The project must be a scoped V2 app; a V1 project or another
	// workspace's project answers 404, like `GET /api/v2/projects/:id`.
	private async requireRunningSandbox(
		scope: ProjectScope,
		projectId: string,
	): Promise<SandboxReader> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project?.engine !== "v2_app") {
			throw new NotFoundException();
		}
		const sandbox = await this.sandboxes.findRunning(projectId);
		// LIMIT: a stopped sandbox has no Code view; the route answers 409
		// until a turn wakes it. Upgrade: read HEAD from the code.storage
		// repository.
		if (sandbox === null) {
			throw new ConflictException({
				code: "SANDBOX_NOT_RUNNING",
				message: "The sandbox is not running",
			});
		}
		return sandbox;
	}
}

// `git <args>` with `-z` output, through `CAPPED_GIT_LIST_SCRIPT`. A git
// failure or a timeout throws, like `mustRunGit`.
async function listGitPaths(
	sandbox: SandboxReader,
	args: string[],
): Promise<string[]> {
	const result = await sandbox.exec(
		"bash",
		[
			"-c",
			CAPPED_GIT_LIST_SCRIPT,
			"bash",
			String(MAX_LISTED_PATHS),
			String(MAX_LISTED_BYTES),
			...args,
		],
		{ cwd: sandbox.workspaceDir, timeoutMs: COMMAND_TIMEOUT_MS },
	);
	if (result.exitCode !== 0) {
		throw new Error(
			`git ${args.join(" ")} failed (${result.exitCode}): ${result.stderr}`,
		);
	}
	// Each complete path ends with NUL. The part after the last NUL is empty,
	// or a path that the byte cap cut; both go.
	return result.stdout.split("\0").slice(0, -1);
}

/**
 * The real path of `path` inside the worktree. Security: a symlink must not
 * reach a file outside the worktree, for example `/proc/<pid>/environ` with
 * the run token, or a `.env*` or `.git` file inside it.
 */
async function resolveInsideWorktree(
	sandbox: SandboxReader,
	path: string,
): Promise<string> {
	// One call resolves both paths; `-z` ends each one with NUL. `-e`
	// fails when a path does not exist.
	const resolved = await sandbox.exec("realpath", [
		"-e",
		"-z",
		"--",
		sandbox.workspaceDir,
		posix.join(sandbox.workspaceDir, path),
	]);
	const [realWorktree, realPath] = splitNul(resolved.stdout);
	if (
		resolved.exitCode !== 0 ||
		realWorktree === undefined ||
		realPath === undefined
	) {
		throw fileNotFound();
	}
	const worktreePrefix = `${realWorktree}/`;
	if (
		!realPath.startsWith(worktreePrefix) ||
		!isReadableCodePath(realPath.slice(worktreePrefix.length))
	) {
		throw invalidPath();
	}
	return realPath;
}

function splitNul(stdout: string): string[] {
	return stdout.split("\0").filter((part) => part !== "");
}

function invalidPath(): BadRequestException {
	return new BadRequestException({
		code: "CODE_PATH_INVALID",
		message: "This path cannot be read",
	});
}

function fileNotFound(): NotFoundException {
	return new NotFoundException({
		code: "CODE_FILE_NOT_FOUND",
		message: "No file at this path",
	});
}

function fileTooLarge(): PayloadTooLargeException {
	return new PayloadTooLargeException({
		code: "CODE_FILE_TOO_LARGE",
		message: `The file is larger than ${CODE_FILE_MAX_BYTES} bytes`,
	});
}
