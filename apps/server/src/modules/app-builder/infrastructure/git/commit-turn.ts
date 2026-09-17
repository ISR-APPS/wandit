/**
 * `commitTurn`: the one-commit-per-turn write (WANDIT-171).
 * The builder-turn task and the restore flow call it after a turn's file
 * changes. It runs git inside the sandbox through `SandboxHandle.exec`,
 * stores the patch and numstat in R2, pushes to code.storage, writes the
 * `app_commits` row, and moves the `main` head compare-and-swap.
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
import { mustRunGit } from "./sandbox-git";

// LIMIT: 1 MiB of patch bytes per commit. Upgrade: diff on demand through
// `git diff` in the sandbox for larger commits.
const PATCH_MAX_BYTES = 1_048_576;
// Git credentials for a push live only for the command; 600 s covers a
// slow push of a big pack.
const PUSH_CREDENTIAL_TTL_SECONDS = 600;

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
		await exec([
			"-c",
			"user.name=wandit",
			"-c",
			"user.email=builder@wandit.dev",
			"commit",
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

	const credential = await deps.gitStore.issueCredential(
		input.projectId,
		PUSH_CREDENTIAL_TTL_SECONDS,
	);
	const pushUrl = authenticatedRemoteUrl(credential.remoteUrl, credential);
	const pushed = await pushOnce(sandbox, pushUrl);
	if (pushed.exitCode !== 0) {
		// A missing remote fails the first push of a project; creating it and
		// retrying once is cheaper than a `remoteReady` bookkeeping column.
		await deps.gitStore.ensureRepository(input.projectId);
		const retried = await pushOnce(sandbox, pushUrl);
		if (retried.exitCode !== 0) {
			// Git echoes the remote URL in stderr; the JWT it carries is masked.
			const stderr = retried.stderr.replaceAll(credential.password, "***");
			throw new CommitTurnError(
				`git push ${redactRemoteUrl(pushUrl)} failed (${retried.exitCode}): ${stderr}`,
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

// The push carries the JWT inside the URL. It must not throw on the
// first failure; a missing repository earns one retry after `ensure`.
async function pushOnce(
	sandbox: SandboxHandle,
	pushUrl: string,
): Promise<SandboxExecResult> {
	return sandbox.exec("git", ["push", pushUrl, "HEAD:main"], {
		cwd: sandbox.workspaceDir,
	});
}
