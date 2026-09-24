/**
 * Application service behind the Code view routes (WANDIT-271).
 * `CodeController` calls `snapshot` for the file tree with the small files,
 * and `file` for one file. Both read the running project sandbox through
 * `SandboxProvider.findRunning` and run git, bash, and coreutils in its
 * worktree.
 */
import { posix } from "node:path";

import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	PayloadTooLargeException,
} from "@nestjs/common";
import {
	CODE_FILE_MAX_BYTES,
	type CodeFileResponse,
	type CodeSnapshotResponse,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	buildCodeTree,
	isReadableCodePath,
	pickDefaultFilePath,
	pickPrefetchPaths,
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

/**
 * The exit code of `GUARDED_READ_SCRIPT` when `$2` is not a regular file,
 * or when the sandbox user cannot open it.
 */
const NOT_A_FILE_EXIT_CODE = 44;

/**
 * Prints the real worktree `$1`, NUL, the real path of the open file `$2`,
 * NUL, then at most `$3` bytes of the file as base64. It opens the file
 * first and asks the kernel for the path of the open file, so a symlink
 * swap between the check and the read cannot escape. Security: a file
 * outside the worktree, or a `.git` or `.env*` file, prints both paths and
 * no bytes, so its bytes never leave the sandbox. `isReadableRealPath`
 * repeats the rule. `head -c` caps the read, so a file that grows after a
 * check never fills the API.
 */
const GUARDED_READ_SCRIPT = [
	"set -o pipefail",
	'root=$(realpath -e -- "$1") || exit 1',
	`[ -f "$2" ] || exit ${NOT_A_FILE_EXIT_CODE}`,
	`exec 3<"$2" || exit ${NOT_A_FILE_EXIT_CODE}`,
	"real=$(readlink /proc/self/fd/3) || exit 1",
	'printf \'%s\\0%s\\0\' "$root" "$real"',
	'case $real in "$root"/*) ;; *) exit 0 ;; esac',
	"case $real/ in */.git/*) exit 0 ;; esac",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: bash expansion, not a JS template; it spares one process per file
	"case ${real##*/} in .env*) exit 0 ;; esac",
	'head -c "$3" <&3 | base64 -w 0',
].join("\n");

/**
 * 64 KB, the largest file that the tree answer carries. The template source
 * files are at most 10 KB; a larger file loads on a click.
 */
const PREFETCH_FILE_MAX_BYTES = 64 * 1024;

/**
 * 512 KB, the most file bytes in one tree answer. The API has no response
 * compression, and the web-app template source is about 92 KB.
 */
const PREFETCH_BUDGET_BYTES = 512 * 1024;

/**
 * Prints the real worktree and NUL, then one record per path in `$3...`:
 * "<real path>\0<size>\0<base64>\0", or "\0\0\0" for a path that it does
 * not read (missing, not a regular file, outside the worktree, a `.git` or
 * `.env*` file, larger than `$1` bytes, or over the budget of `$2` bytes).
 * Each file is read through its open descriptor, like `GUARDED_READ_SCRIPT`.
 * `head -c` reads at most the size that `stat` saw, so the budget holds
 * when a file grows. A file that shrinks after `stat` gives fewer bytes.
 */
const PREFETCH_SCRIPT = [
	"set -o pipefail",
	"file_cap=$1; budget=$2; shift 2",
	"root=$(realpath -e -- .) || exit 1",
	"printf '%s\\0' \"$root\"",
	"used=0",
	"read_open_file() {",
	"  local real size",
	"  real=$(readlink /proc/self/fd/3) || return 1",
	'  case $real in "$root"/*) ;; *) return 1 ;; esac',
	"  case $real/ in */.git/*) return 1 ;; esac",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: bash expansion, not a JS template; it spares one process per file
	"  case ${real##*/} in .env*) return 1 ;; esac",
	"  size=$(stat -L -c %s /proc/self/fd/3) || return 1",
	"  (( size <= file_cap && used + size <= budget )) || return 1",
	"  used=$(( used + size ))",
	'  printf \'%s\\0%s\\0\' "$real" "$size"',
	'  head -c "$size" <&3 | base64 -w 0',
	"  printf '\\0'",
	"}",
	'for path in "$@"; do',
	'  if [ -f "$path" ] && read_open_file 3<"$path"; then continue; fi',
	"  printf '\\0\\0\\0'",
	"done",
].join("\n");

/**
 * 10 s. A FIFO blocks the command: a FIFO `.gitignore` blocks git, and a
 * FIFO that replaces a file after the `-f` test blocks the open in bash.
 * The vendor kills the command at this timeout. A file read then fails;
 * the tree answer then waits 10 s and holds no prefetched files.
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
	private readonly logger = new Logger(CodeService.name);

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
	 * `files` holds the small files of `pickPrefetchPaths`, so the web
	 * shows them with no request.
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
			files: await this.prefetchOrNone(sandbox, pickPrefetchPaths(tree)),
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

		// One byte over the cap tells a file at the cap from a larger one.
		const read = await sandbox.exec(
			"bash",
			[
				"-c",
				GUARDED_READ_SCRIPT,
				"bash",
				sandbox.workspaceDir,
				posix.join(sandbox.workspaceDir, path),
				String(CODE_FILE_MAX_BYTES + 1),
			],
			{ cwd: sandbox.workspaceDir, timeoutMs: COMMAND_TIMEOUT_MS },
		);
		// A missing path, a folder, a FIFO, a dangling symlink, or a file
		// that the sandbox user cannot open.
		if (read.exitCode === NOT_A_FILE_EXIT_CODE) {
			throw fileNotFound();
		}
		if (read.exitCode !== 0) {
			throw new Error(
				`Code file read failed (${read.exitCode}): ${read.stderr}`,
			);
		}
		const [realWorktree = "", realPath = "", base64 = ""] =
			read.stdout.split("\0");
		if (!isReadableRealPath(realWorktree, realPath)) {
			throw invalidPath();
		}
		const bytes = Buffer.from(base64, "base64");
		if (bytes.byteLength > CODE_FILE_MAX_BYTES) {
			throw fileTooLarge();
		}
		return fileAnswer(path, bytes);
	}

	// The files are a speed-up only: a failed read must not fail the tree,
	// so the web then loads each file on a click.
	private async prefetchOrNone(
		sandbox: SandboxReader,
		paths: string[],
	): Promise<CodeFileResponse[]> {
		try {
			return await prefetchFiles(sandbox, paths);
		} catch (error: unknown) {
			this.logger.warn(
				`code.prefetch.failed project=${sandbox.projectId}: ${getErrorMessage(error)}`,
			);
			return [];
		}
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
 * Reads `paths` (relative to the worktree) through `PREFETCH_SCRIPT` in one
 * command. A path that the script does not read, or that fails a check
 * below, is not in the answer. Throws when the command fails.
 */
async function prefetchFiles(
	sandbox: SandboxReader,
	paths: string[],
): Promise<CodeFileResponse[]> {
	if (paths.length === 0) {
		return [];
	}
	const result = await sandbox.exec(
		"bash",
		[
			"-c",
			PREFETCH_SCRIPT,
			"bash",
			String(PREFETCH_FILE_MAX_BYTES),
			String(PREFETCH_BUDGET_BYTES),
			...paths,
		],
		{ cwd: sandbox.workspaceDir, timeoutMs: COMMAND_TIMEOUT_MS },
	);
	if (result.exitCode !== 0) {
		throw new Error(
			`Code prefetch command failed (${result.exitCode}): ${result.stderr}`,
		);
	}
	// The root, three parts per path, and the empty part after the last NUL.
	const parts = result.stdout.split("\0");
	if (parts.length !== 2 + 3 * paths.length) {
		throw new Error(
			`Code prefetch printed ${parts.length} parts for ${paths.length} paths`,
		);
	}
	const [realWorktree = ""] = parts;
	const files: CodeFileResponse[] = [];
	for (const [index, path] of paths.entries()) {
		const [realPath = "", size = "", base64 = ""] = parts.slice(
			1 + 3 * index,
			4 + 3 * index,
		);
		// An empty real path marks a file that the script did not read.
		if (realPath === "" || !isReadableRealPath(realWorktree, realPath)) {
			continue;
		}
		const bytes = Buffer.from(base64, "base64");
		// The file shrank after `stat`, so the bytes are cut.
		if (String(bytes.byteLength) !== size) {
			continue;
		}
		files.push(fileAnswer(path, bytes));
	}
	return files;
}

/**
 * True when `realPath` is inside `realWorktree` and is a path that the Code
 * view may read. Security: a symlink must not reach a file outside the
 * worktree, for example `/proc/<pid>/environ` with the run token, or a
 * `.env*` or `.git` file inside it. An empty root never matches.
 */
function isReadableRealPath(realWorktree: string, realPath: string): boolean {
	const worktreePrefix = `${realWorktree}/`;
	return (
		realWorktree !== "" &&
		realPath.startsWith(worktreePrefix) &&
		isReadableCodePath(realPath.slice(worktreePrefix.length))
	);
}

/** The file answer for `bytes`: UTF-8 text, or an empty content when binary. */
function fileAnswer(path: string, bytes: Buffer): CodeFileResponse {
	const binary = bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
	return {
		binary,
		content: binary ? "" : new TextDecoder("utf-8").decode(bytes),
		path,
		size: bytes.byteLength,
	};
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
