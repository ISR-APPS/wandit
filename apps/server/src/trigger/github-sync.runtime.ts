/**
 * GitHub sync runtime: one reconcile run between code.storage `main` and the
 * GitHub `main` of one linked V2 project. `github-sync.task.ts` calls
 * `runGithubSync`; the spec runs it on fakes. It reads the link and the head,
 * checks the project access of the linker and the GitHub access, and runs git
 * in a temp bare repo on the worker.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commitShaSchema, type GithubSyncErrorCode } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import { decideGithubSync } from "../modules/app-builder/domain/github-sync";
import type { GitStore } from "../modules/app-builder/domain/ports/git-store";
import type {
	SandboxExecResult,
	SandboxHandle,
	SandboxLogger,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import { authenticatedRemoteUrl } from "../modules/app-builder/infrastructure/git/git-remote-url";
import {
	mustRunGit,
	runGit,
} from "../modules/app-builder/infrastructure/git/sandbox-git";
import {
	GITHUB_SYNC_PERMISSIONS,
	GithubApiError,
	type GithubAppClient,
} from "../modules/app-builder/infrastructure/github/github-app.client";
import type { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import type {
	ProjectGithubLinkRow,
	ProjectGithubLinksRepository,
} from "../modules/app-builder/infrastructure/persistence/project-github-links.repository";
import type { ProjectAccessService } from "../modules/projects";

// 120 s per git command. Two fetches, one push, and two GitHub
// REST calls of 30 s stay below the 600 s `maxDuration` of the task.
const GIT_TIMEOUT_MS = 120_000;

// A push fails when its JWT expires during the upload (see commit-turn.ts).
// So each code.storage JWT lives as long as one git command can run.
const CODE_STORAGE_CREDENTIAL_TTL_SECONDS = GIT_TIMEOUT_MS / 1000;

// GitHub runs the files in this folder in GitHub Actions.
const WORKFLOWS_PATH = ".github/workflows";

// The installation-token statuses that mean the App lost the installation
// or the repo. A retry cannot fix them. A rate-limit 403 is
// the exception, see `isGithubRateLimit`.
const ACCESS_LOST_STATUSES = new Set([401, 403, 404, 422]);

// GitHub accepts the installation token as the password of this user name.
const GITHUB_GIT_USERNAME = "x-access-token";

/** Payload of one `github-sync` run, plus the retry state of Trigger. */
export type GithubSyncInput = {
	/** The project whose GitHub link the run reconciles. */
	projectId: string;
	/** True on the last Trigger attempt. A throw then records `GITHUB_SYNC_FAILED` on the link. */
	isFinalAttempt: boolean;
};

/** Everything `runGithubSync` calls. The task wires the real ones; the spec passes fakes. */
export type GithubSyncDeps = {
	/** Reads the link and writes its sync state. Each write filters by the link id. */
	links: Pick<
		ProjectGithubLinksRepository,
		"findByProject" | "markRemoteAhead" | "markSynced" | "recordError"
	>;
	/** Reads `app_branches(main).head_sha`: the head that GitHub must get. */
	appCommits: Pick<AppCommitsRepository, "findBranch">;
	/** Resolves the project role of the linker (`project_github_links.user_id`). Null means no access. */
	projectAccess: Pick<ProjectAccessService, "resolve">;
	/** Mints the code.storage JWTs: "read" for the fetch, "push-github-mirror" for the mirror push. */
	gitStore: Pick<GitStore, "issueCredential">;
	/** Mints the repo-scoped installation token, reads the current login of the linker, and reads its role. */
	github: Pick<
		GithubAppClient,
		"collaboratorPermission" | "installationToken" | "userLogin"
	>;
	/** `hostExec` in production: git runs on the worker, never in a sandbox. */
	exec: SandboxHandle["exec"];
	/** The Trigger process logger. `Sentry.logger` drops lines in the worker. */
	logger: Pick<SandboxLogger, "warn">;
};

/** What one run did. The task returns it as the run output. */
export type GithubSyncResult =
	| { status: "unlinked" | "noop" }
	| {
			status: "in-sync" | "pushed" | "mirrored";
			/** The head that GitHub `main` or code.storage `github/main` now holds. */
			sha: string;
	  }
	| { status: "stopped"; code: GithubSyncErrorCode };

// One git step of the sync failed. The message never holds a token.
class GithubSyncGitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GithubSyncGitError";
	}
}

/** The git commands of one run, all in one temp bare repo. */
type SyncGit = {
	/** Must exit 0, else throws `GithubSyncGitError` with `secret` masked. */
	must: (
		label: string,
		args: string[],
		secret?: string,
	) => Promise<SandboxExecResult>;
	/** Returns the result with `secret` masked in stderr. The exit code is an answer, not an error. */
	run: (args: string[], secret?: string) => Promise<SandboxExecResult>;
};

/**
 * True when GitHub refused a push for a reason that a retry cannot fix: a
 * hook, a branch rule, push protection, or a large file. False
 * for a race with a GitHub push and for a network or 5xx failure.
 */
export function isFinalGithubPushRefusal(stderr: string): boolean {
	// GitHub `main` moved after the fetch. The retry fetches again and mirrors.
	if (/non-fast-forward|fetch first|stale info/.test(stderr)) {
		return false;
	}
	return /\[remote rejected\]|\[rejected\]|pre-receive hook declined/.test(
		stderr,
	);
}

/**
 * Pushes code.storage `main` to GitHub as a fast-forward, or copies a newer
 * GitHub `main` to code.storage `github/main` for an Update. Never force
 * pushes GitHub. Each run reads the live state, so a repeated run is safe.
 * A stop for access or policy records an error code and does not throw.
 */
export async function runGithubSync(
	deps: GithubSyncDeps,
	input: GithubSyncInput,
): Promise<GithubSyncResult> {
	const link = await deps.links.findByProject(input.projectId);
	if (link === null) {
		return { status: "unlinked" };
	}
	try {
		return await syncLink(deps, link);
	} catch (error) {
		// Earlier attempts record nothing: the retry can still clear the error.
		if (input.isFinalAttempt) {
			try {
				await deps.links.recordError(link.id, "GITHUB_SYNC_FAILED");
			} catch (recordError) {
				// The run error still goes to Trigger and Sentry below.
				deps.logger.warn("github-sync.record-error-failed", {
					error: getErrorMessage(recordError),
					linkId: link.id,
					projectId: link.projectId,
				});
			}
		}
		throw error;
	}
}

// The access checks, then the git work in a temp folder that is always removed.
async function syncLink(
	deps: GithubSyncDeps,
	link: ProjectGithubLinkRow,
): Promise<GithubSyncResult> {
	// Security: the link must not outlive the read access of the linker. A
	// workspace removal, a revoked grant, a move, or Restricted can end it.
	// Then a push sends project code to the repo of a person outside the project.
	const linkerAccess = await deps.projectAccess.resolve(
		link.userId,
		link.projectId,
	);
	if (linkerAccess === null) {
		deps.logger.warn("github-sync.linker-no-project-access", {
			linkId: link.id,
			linkerUserId: link.userId,
			projectId: link.projectId,
		});
		return stop(deps, link, "GITHUB_LINK_OWNER_LEFT");
	}
	const branch = await deps.appCommits.findBranch(link.projectId);
	// No push to code.storage yet, so no repo to fetch or mirror into.
	// The `push:<sha>` run of the first commit handles a GitHub repo that is ahead.
	if (branch === null || branch.headSha === null) {
		return { status: "noop" };
	}
	// Security: the sha goes into git argv. `commitTurn` stored what git
	// printed in the sandbox. A 40-hex value never reads as an option.
	const csHead = commitShaSchema.parse(branch.headSha);

	let token: string;
	try {
		token = await deps.github.installationToken(
			link.installationId,
			link.repoId,
			GITHUB_SYNC_PERMISSIONS,
		);
	} catch (error) {
		// A rate limit is not a lost access. So the run throws and records no
		// code. A Trigger retry, a later commit, or a status poll runs the sync again.
		if (
			error instanceof GithubApiError &&
			error.status !== null &&
			ACCESS_LOST_STATUSES.has(error.status) &&
			!isGithubRateLimit(error)
		) {
			return stop(deps, link, "GITHUB_ACCESS_LOST");
		}
		throw error;
	}
	if (!(await linkerCanWrite(deps, link, token))) {
		return stop(deps, link, "GITHUB_LINKER_NO_ACCESS");
	}

	const dir = await mkdtemp(join(tmpdir(), "github-sync-"));
	try {
		return await reconcile(deps, link, csHead, token, dir);
	} finally {
		await rm(dir, { force: true, recursive: true });
	}
}

// Security: a linker who lost write access on GitHub must not
// push to the repo or read its new commits through Wandit.
async function linkerCanWrite(
	deps: GithubSyncDeps,
	link: ProjectGithubLinkRow,
	token: string,
): Promise<boolean> {
	// A GitHub rename changes the login but not the id. So the link keeps
	// the id, and each run reads the current login.
	const login = await deps.github.userLogin(token, link.githubUserId);
	// A deleted GitHub account has no access.
	if (login === null) {
		return false;
	}
	try {
		const permission = await deps.github.collaboratorPermission(
			token,
			link.repoOwner,
			link.repoName,
			login,
		);
		return permission === "admin" || permission === "write";
	} catch (error) {
		// GitHub answers 403 when the App lacks a permission for this route.
		// We do not know which permission. An unverified check must not block every sync.
		// A rate-limit 403 throws, so Trigger retries and the check does not let the push through.
		if (
			error instanceof GithubApiError &&
			error.status === 403 &&
			!isGithubRateLimit(error)
		) {
			deps.logger.warn("github-sync.permission-check-skipped", {
				error: error.message,
				githubLogin: login,
				linkId: link.id,
				projectId: link.projectId,
			});
			return true;
		}
		throw error;
	}
}

// GitHub answers a spent primary or secondary rate limit with 403, not only
// with 429. Only the message tells it apart from a 403 for a missing permission.
function isGithubRateLimit(error: GithubApiError): boolean {
	return error.status === 403 && /rate limit/i.test(error.message);
}

// Fetches both heads into the bare repo `dir`, decides, and then pushes to
// GitHub or mirrors to code.storage.
// LIMIT: each run fetches the full history of both sides into a new temp repo. Upgrade: a cached bare repo per worker, or a shallow negotiation.
async function reconcile(
	deps: GithubSyncDeps,
	link: ProjectGithubLinkRow,
	csHead: string,
	token: string,
	dir: string,
): Promise<GithubSyncResult> {
	// A hung git command must not hold the run until `maxDuration`, which
	// kills it with no retry and no catch.
	const handle: Pick<SandboxHandle, "exec" | "workspaceDir"> = {
		exec: (command, args, options) =>
			deps.exec(command, args, { ...options, timeoutMs: GIT_TIMEOUT_MS }),
		workspaceDir: dir,
	};
	// The args can carry a token. `secret` masks it, also when git echoes the URL.
	const git: SyncGit = {
		must: (label, args, secret) =>
			mustRunGit(handle, args, GithubSyncGitError, { label, secret }),
		run: (args, secret) => runGit(handle, args, secret),
	};

	await git.must("git init", ["init", "--bare", "--quiet"]);
	const read = await deps.gitStore.issueCredential(
		link.projectId,
		CODE_STORAGE_CREDENTIAL_TTL_SECONDS,
		"read",
	);
	await git.must(
		"git fetch code.storage main",
		[
			"fetch",
			"--quiet",
			authenticatedRemoteUrl(read.remoteUrl, read),
			"+refs/heads/main:refs/remotes/cs/main",
		],
		read.password,
	);

	const githubUrl = authenticatedRemoteUrl(
		`https://github.com/${encodeURIComponent(link.repoOwner)}/${encodeURIComponent(link.repoName)}.git`,
		{ password: token, username: GITHUB_GIT_USERNAME },
	);
	const fetched = await git.run(
		["fetch", "--quiet", githubUrl, "+refs/heads/main:refs/remotes/gh/main"],
		token,
	);
	let githubHead: string | null = null;
	if (fetched.exitCode === 0) {
		const parsed = await git.must("git rev-parse GitHub main", [
			"rev-parse",
			"refs/remotes/gh/main",
		]);
		githubHead = commitShaSchema.parse(parsed.stdout.trim());
	} else if (!fetched.stderr.includes("couldn't find remote ref")) {
		// An empty GitHub repo has no `main`. Every other failure is real.
		throw new GithubSyncGitError(
			`git fetch GitHub main failed (${fetched.exitCode}): ${fetched.stderr}`,
		);
	}

	const githubIsAncestorOfCs =
		githubHead !== null &&
		githubHead !== csHead &&
		(await isAncestor(git, githubHead, csHead));
	const action = decideGithubSync({
		csHead,
		githubHead,
		githubIsAncestorOfCs,
	});
	switch (action) {
		case "noop":
			return { status: "noop" };
		case "in-sync":
			await deps.links.markSynced(link.id, csHead);
			return { sha: csHead, status: "in-sync" };
		case "push":
			return pushToGithub(deps, link, git, {
				csHead,
				githubHead,
				githubUrl,
				token,
			});
		case "mirror": {
			// `decideGithubSync` never mirrors an empty GitHub repo. A change of
			// that rule must fail here, not mirror nothing.
			if (githubHead === null) {
				throw new GithubSyncGitError("mirror chosen without a GitHub head");
			}
			const mirror = await deps.gitStore.issueCredential(
				link.projectId,
				CODE_STORAGE_CREDENTIAL_TTL_SECONDS,
				"push-github-mirror",
			);
			// Force: `github/main` follows GitHub `main`, also after a force push
			// there. The JWT refs claim allows no other ref.
			await git.must(
				"git push code.storage github/main",
				[
					"push",
					"--quiet",
					authenticatedRemoteUrl(mirror.remoteUrl, mirror),
					"+refs/remotes/gh/main:refs/heads/github/main",
				],
				mirror.password,
			);
			await deps.links.markRemoteAhead(link.id, githubHead);
			return { sha: githubHead, status: "mirrored" };
		}
	}
}

// The fast-forward push of `csHead` to GitHub `main`, after the workflow guard.
async function pushToGithub(
	deps: GithubSyncDeps,
	link: ProjectGithubLinkRow,
	git: SyncGit,
	push: {
		csHead: string;
		/** Null for an empty GitHub repo. Else an ancestor of `csHead`. */
		githubHead: string | null;
		/** The GitHub git URL with the installation token in it. */
		githubUrl: string;
		token: string;
	},
): Promise<GithubSyncResult> {
	// Security: the App has Workflows write, so workflow edits made
	// on GitHub come back in a merge. A workflow that the builder agent wrote
	// would run in the GitHub Actions of the user, with their secrets.
	if (await builderChangedWorkflows(git, push.csHead, push.githubHead)) {
		return stop(deps, link, "GITHUB_WORKFLOW_CHANGED", push.githubHead);
	}
	// No force: a GitHub `main` that moved after the fetch refuses the push.
	const pushed = await git.run(
		["push", push.githubUrl, `${push.csHead}:refs/heads/main`],
		push.token,
	);
	if (pushed.exitCode === 0) {
		await deps.links.markSynced(link.id, push.csHead);
		return { sha: push.csHead, status: "pushed" };
	}
	if (isFinalGithubPushRefusal(pushed.stderr)) {
		// The panel shows only the code, so the GitHub reason goes to the log.
		deps.logger.warn("github-sync.push-refused", {
			linkId: link.id,
			projectId: link.projectId,
			stderr: pushed.stderr.slice(-1000),
		});
		return stop(deps, link, "GITHUB_PUSH_REJECTED", push.githubHead);
	}
	// A race with a GitHub push, or a network or 5xx failure. Trigger retries,
	// and the retry fetches again.
	throw new GithubSyncGitError(
		`git push GitHub main failed (${pushed.exitCode}): ${pushed.stderr}`,
	);
}

// True when the Wandit side added, changed, or removed a file under
// `.github/workflows` since the GitHub head.
async function builderChangedWorkflows(
	git: SyncGit,
	csHead: string,
	githubHead: string | null,
): Promise<boolean> {
	if (githubHead === null) {
		const tree = await git.must("git ls-tree workflows", [
			"ls-tree",
			"-r",
			"--name-only",
			csHead,
			"--",
			WORKFLOWS_PATH,
		]);
		return tree.stdout.trim() !== "";
	}
	const diff = await git.run([
		"diff",
		"--quiet",
		githubHead,
		csHead,
		"--",
		WORKFLOWS_PATH,
	]);
	// `diff --quiet` exits 1 on a difference. A higher code is a git failure.
	if (diff.exitCode > 1) {
		throw new GithubSyncGitError(
			`git diff workflows failed (${diff.exitCode}): ${diff.stderr}`,
		);
	}
	return diff.exitCode === 1;
}

// `merge-base --is-ancestor` exits 0 for yes and 1 for no. A higher code is
// a git failure, for example a missing object.
async function isAncestor(
	git: SyncGit,
	ancestor: string,
	descendant: string,
): Promise<boolean> {
	const result = await git.run([
		"merge-base",
		"--is-ancestor",
		ancestor,
		descendant,
	]);
	if (result.exitCode > 1) {
		throw new GithubSyncGitError(
			`git merge-base failed (${result.exitCode}): ${result.stderr}`,
		);
	}
	return result.exitCode === 0;
}

// Records why the sync stopped. The run ends without a throw: a retry
// cannot fix an access or policy stop. `githubHead` is the GitHub head that
// the run fetched; the row keeps it, so a head that GitHub dropped stops the banner.
async function stop(
	deps: GithubSyncDeps,
	link: ProjectGithubLinkRow,
	code: GithubSyncErrorCode,
	githubHead: string | null = null,
): Promise<GithubSyncResult> {
	await deps.links.recordError(link.id, code, githubHead);
	return { code, status: "stopped" };
}
