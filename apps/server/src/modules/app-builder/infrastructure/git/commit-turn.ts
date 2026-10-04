/**
 * `commitTurn`: the one-commit-per-turn write (WANDIT-171).
 * The builder-turn task and the restore flow call it after a turn's file
 * changes. It runs git inside the sandbox through `SandboxHandle.exec`,
 * stores the patch and numstat in R2, pushes to code.storage, writes the
 * `app_commits` row, and moves the `main` head compare-and-swap. The task
 * calls it through `commitTurnUnlessClean`, which skips a turn with no change.
 */
import { type GitNumstatEntry, parseNumstat } from "../../domain/git-numstat";
import type { GitStore } from "../../domain/ports/git-store";
import type {
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import type {
	AppCommitRow,
	AppCommitsRepository,
} from "../persistence/app-commits.repository";
import { VersionConflictError } from "../persistence/app-commits.repository";
import { authenticatedRemoteUrl, redactRemoteUrl } from "./git-remote-url";
import { mustRunGit, SAFE_GIT_CONFIG_ARGS } from "./sandbox-git";

// LIMIT: 1 MiB of patch bytes per commit. Upgrade: diff on demand through
// `git diff` in the sandbox for larger commits.
const PATCH_MAX_BYTES = 1_048_576;
// A short life limits the use of a stolen push JWT (WANDIT-282). A push
// fails when its JWT expires during the upload: a live probe saw a 7 s JWT
// fail a 10 s push. So the TTL covers one whole push, and each push mints a
// new JWT.
// LIMIT: one push uploads in 120 s, about 240 MB at the 2 MB/s of the probe
// link. Upgrade: scale the TTL with the pack size.
const PUSH_CREDENTIAL_TTL_SECONDS = 120;

/** What `commitTurn` persists; `VersionsService` answers it on restore. */
export type CommitTurnResult = {
	sha: string;
	parentSha: string | null;
	numstat: GitNumstatEntry[];
	/** R2 key of the stored patch, `git/<projectId>/patches/<sha>.diff`. */
	patchKey: string;
	/** The `app_commits` row written (or found again on a retry). */
	commit: AppCommitRow;
};

/**
 * One `app_commits` row, the CAS head write, and the head read the
 * crash-recovery branch needs, for the turn write order.
 */
export type CommitTurnStore = Pick<
	AppCommitsRepository,
	"findBranch" | "insert" | "upsertBranchHead"
>;

/** Writes one object to durable storage (R2 `putSiteFile` wrapper). */
export type PutPatch = (
	key: string,
	body: string | Uint8Array,
) => Promise<void>;

/** Dependencies `commitTurn` needs; the task and the service pass them. */
export type CommitTurnDeps = {
	gitStore: GitStore;
	appCommits: CommitTurnStore;
	putPatch: PutPatch;
};

/** One commit input; the task fills the turn fields, a restore nulls them. */
export type CommitTurnInput = {
	projectId: string;
	/** The user whose action made the commit (turn author or restorer). */
	userId: string;
	/** Org workspace of the project, or null on a personal project. */
	organizationId: string | null;
	/** The chat whose turn produced the commit; null on a restore. */
	chatId: string | null;
	/** The `builder_turns` row; null on a restore, which is not a turn. */
	turnId: string | null;
	/** Assistant message id; `restore-<uuid>` on a restore. */
	messageId: string;
	source: "agent" | "wip" | "restore";
	summary: string;
	restoredFromSha?: string;
};

/**
 * One sandbox `exec` failure. The message carries the command line and the
 * stderr text with any credential redacted.
 */
export class CommitTurnError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CommitTurnError";
	}
}

/** R2 key of the stored patch text of one commit. */
export function versionPatchKey(projectId: string, sha: string): string {
	return `git/${projectId}/patches/${sha}.diff`;
}

/** R2 key of the stored numstat JSON of one commit. */
export function versionNumstatKey(projectId: string, sha: string): string {
	return `git/${projectId}/patches/${sha}.numstat`;
}

/**
 * Commits the sandbox worktree as one version and pushes it to
 * code.storage. Write order per WANDIT-171: patch files to R2, push to the
 * remote, the `app_commits` row, then the `main` head CAS. The
 * `msg/<messageId>` tag is the idempotency key: a retried call does not
 * add a second commit for the same message.
 */
export async function commitTurn(
	sandbox: SandboxHandle,
	deps: CommitTurnDeps,
	input: CommitTurnInput,
): Promise<CommitTurnResult> {
	const exec = (args: string[]) => mustRunGit(sandbox, args, CommitTurnError);

	await exec(["add", "-A"]);

	// A retried turn must not add a second commit for the same message. The
	// Wandit-Message trailer on HEAD means the commit already exists.
	// `git log` exits non-zero on an empty repository; no HEAD means the
	// message commit cannot exist.
	const headMessage = await sandbox.exec("git", ["log", "-1", "--format=%B"], {
		cwd: sandbox.workspaceDir,
	});
	const alreadyCommitted =
		headMessage.exitCode === 0 &&
		headMessage.stdout
			.split("\n")
			.some((line) => line.trim() === `Wandit-Message: ${input.messageId}`);
	if (!alreadyCommitted) {
		const trailers = [
			"-m",
			input.summary,
			"-m",
			`Wandit-Message: ${input.messageId}`,
		];
		if (input.chatId !== null) {
			trailers.push("-m", `Wandit-Chat: ${input.chatId}`);
		}
		if (input.restoredFromSha !== undefined) {
			trailers.push("-m", `Wandit-Restore-From: ${input.restoredFromSha}`);
		}
		// `--no-verify` skips the pre-commit and commit-msg hooks a second way,
		// next to the `core.hooksPath` flag of `mustRunGit` (WANDIT-282).
		await exec([
			"-c",
			"user.name=wandit",
			"-c",
			"user.email=builder@wandit.dev",
			"commit",
			"--no-verify",
			"--allow-empty",
			...trailers,
		]);
	}

	// `tag -f` is idempotent: a retry points the tag at the same commit.
	await exec(["tag", "-f", `msg/${input.messageId}`]);

	const head = await exec(["rev-parse", "HEAD"]);
	const sha = head.stdout.trim();
	// HEAD~1 fails on the root commit; a missing parent is null, not an error.
	const parent = await sandbox.exec("git", ["rev-parse", "HEAD~1"], {
		cwd: sandbox.workspaceDir,
	});
	const parentSha = parent.exitCode === 0 ? parent.stdout.trim() : null;

	const numstatOutput = await exec(["show", "--numstat", "--format=", "HEAD"]);
	const numstat = parseNumstat(numstatOutput.stdout);

	const patchOutput = await exec(["show", "--format=", "HEAD"]);
	// The cap counts bytes, not UTF-16 units, so a patch full of multibyte
	// characters still stays under 1 MiB. A cut tail character is lost.
	const patch = Buffer.from(patchOutput.stdout, "utf8").subarray(
		0,
		PATCH_MAX_BYTES,
	);
	const patchKey = versionPatchKey(input.projectId, sha);
	// R2 before the database: a stored patch outlives a failed row write.
	await deps.putPatch(patchKey, patch);
	await deps.putPatch(
		versionNumstatKey(input.projectId, sha),
		JSON.stringify(numstat),
	);

	const pushed = await pushOnce(sandbox, deps.gitStore, input.projectId);
	if (pushed.result.exitCode !== 0) {
		// A missing remote fails the first push of a project; creating it and
		// retrying once is cheaper than a `remoteReady` bookkeeping column.
		await deps.gitStore.ensureRepository(input.projectId);
		const retried = await pushOnce(sandbox, deps.gitStore, input.projectId);
		if (retried.result.exitCode !== 0) {
			// Git echoes the remote URL in stderr; the JWT it carries is masked.
			const stderr = retried.result.stderr.replaceAll(retried.password, "***");
			throw new CommitTurnError(
				`git push ${redactRemoteUrl(retried.pushUrl)} failed (${retried.result.exitCode}): ${stderr}`,
			);
		}
	}

	const commit = await deps.appCommits.insert({
		projectId: input.projectId,
		userId: input.userId,
		organizationId: input.organizationId,
		chatId: input.chatId,
		turnId: input.turnId,
		messageId: input.messageId,
		sha,
		parentSha,
		message: input.summary,
		source: input.source,
		restoredFromSha: input.restoredFromSha ?? null,
		numstat,
		patchKey,
	});

	const swapped = await deps.appCommits.upsertBranchHead(
		input.projectId,
		"main",
		{
			headSha: sha,
			expectedHeadSha: parentSha,
			userId: input.userId,
			organizationId: input.organizationId,
		},
	);
	if (!swapped) {
		await recoverPushedHead(sandbox, deps, input, sha);
	}

	return { sha, parentSha, numstat, patchKey, commit };
}

/**
 * The builder-turn commit: `commitTurn`, or null when the turn changed no
 * file. A text-only turn then costs one sandbox command and one row read
 * instead of about 7 s of git, R2, and push work. A failed status read
 * commits as before: an unknown tree must not lose work.
 */
export async function commitTurnUnlessClean(
	sandbox: SandboxHandle,
	deps: CommitTurnDeps,
	input: CommitTurnInput,
): Promise<CommitTurnResult | null> {
	// One command: `git status` lists every changed or new file, and the
	// marker line carries HEAD. An empty list plus the stored head means
	// the code.storage history already holds this tree.
	const state = await sandbox.exec(
		"sh",
		["-c", 'git status --porcelain && echo "HEAD=$(git rev-parse HEAD)"'],
		{ cwd: sandbox.workspaceDir },
	);
	const lines = state.stdout.split("\n").filter((line) => line.trim() !== "");
	const headLine = lines.at(-1);
	const isClean =
		state.exitCode === 0 &&
		lines.length === 1 &&
		headLine?.startsWith("HEAD=") === true;
	if (isClean && headLine !== undefined) {
		const branch = await deps.appCommits.findBranch(input.projectId, "main");
		if (branch?.headSha === headLine.slice("HEAD=".length).trim()) {
			return null;
		}
	}
	return commitTurn(sandbox, deps, input);
}

// A crash between the push and the CAS leaves `app_branches.headSha`
// behind the pushed history, and every later `commitTurn` then fails the
// CAS forever. When the stored head is an ancestor of the pushed commit,
// the remote history already contains it and the head may advance past
// it. A diverged head is a real conflict. A missing row is not a lost
// CAS: `upsertBranchHead` creates it for any parent sha.
async function recoverPushedHead(
	sandbox: SandboxHandle,
	deps: CommitTurnDeps,
	input: CommitTurnInput,
	sha: string,
): Promise<void> {
	const stored = await deps.appCommits.findBranch(input.projectId, "main");
	const storedHead = stored?.headSha ?? null;
	// A lost CAS leaves a committed row with another head, so this read
	// finds one. A null head means another writer removed the row after the
	// CAS, for example a project delete. Nothing here can repair that.
	if (storedHead === null) {
		throw new VersionConflictError();
	}
	const ancestor = await sandbox.exec(
		"git",
		["merge-base", "--is-ancestor", storedHead, sha],
		{ cwd: sandbox.workspaceDir },
	);
	const advanced =
		ancestor.exitCode === 0 &&
		(await deps.appCommits.upsertBranchHead(input.projectId, "main", {
			headSha: sha,
			expectedHeadSha: storedHead,
			userId: input.userId,
			organizationId: input.organizationId,
		}));
	if (!advanced) {
		throw new VersionConflictError();
	}
}

// One push gets a new "push-main" credential. The retry runs after
// `ensureRepository`, which can take minutes, so it never reuses the first
// JWT. It must not throw on the first failure; a missing repository earns
// one retry after `ensure`. The push carries the JWT inside the URL.
// LIMIT: sandbox code can still get the JWT while the push runs. A same-user
// process reads it from /proc/<pid>/cmdline (the Vercel sandbox has no
// hidepid). These git config keys in `.git/config` or `~/.gitconfig` still
// apply: `url.<base>.insteadOf`, `include.path`, and `http.*`. A live probe
// sent the JWT to the host that `insteadOf` set. An `http.proxy` with
// `http.sslVerify=false` also exposes the JWT. The refs claim and the TTL
// stop a force push, a push to another ref, and a late use. They do not stop
// a delete of `main` (see the LIMIT at `PUSH_MAIN_REFS`).
// Upgrade: push from the Trigger worker with a git bundle made in the
// sandbox, or through the code.storage commit API.
async function pushOnce(
	sandbox: SandboxHandle,
	gitStore: GitStore,
	projectId: string,
): Promise<{
	result: SandboxExecResult;
	/** The JWT of this push, to mask in an error message. */
	password: string;
	/** The authenticated URL; print it only through `redactRemoteUrl`. */
	pushUrl: string;
}> {
	const credential = await gitStore.issueCredential(
		projectId,
		PUSH_CREDENTIAL_TTL_SECONDS,
		"push-main",
	);
	const pushUrl = authenticatedRemoteUrl(credential.remoteUrl, credential);
	// `--no-verify` skips the pre-push hook a second way, next to the flags.
	const result = await sandbox.exec(
		"git",
		[...SAFE_GIT_CONFIG_ARGS, "push", "--no-verify", pushUrl, "HEAD:main"],
		{ cwd: sandbox.workspaceDir },
	);
	return { result, password: credential.password, pushUrl };
}
