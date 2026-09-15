/**
 * `RepoRestorer` on code.storage (D21): brings a project's repository into
 * a sandbox that lost its disk. `resume` calls it before a turn runs. It
 * pulls when `.git` exists, clones when `sandbox.workspaceDir` is empty, and
 * rebuilds the worktree when only the template files are there.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { GitStore, RepoRestorer } from "../../domain/ports/git-store";
import { GIT_STORE } from "../../domain/ports/git-store";
import type { SandboxHandle } from "../../domain/ports/sandbox-provider";
import { AppCommitsRepository } from "../persistence/app-commits.repository";
import { authenticatedRemoteUrl } from "./git-remote-url";
import { mustRunGit } from "./sandbox-git";

// A pull or a clone is one command; 600 s covers a large pack on a slow
// link.
const RESTORE_CREDENTIAL_TTL_SECONDS = 600;

/** One restorer step failed inside the sandbox. Never carries the JWT. */
export class RepoRestoreError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RepoRestoreError";
	}
}

/**
 * Restores one project's code.storage repository into a sandbox. The
 * credential it mints lives only inside the commands it runs; it never
 * lands in `.git/config` because no remote is configured.
 */
@Injectable()
export class CodeStorageRepoRestorer implements RepoRestorer {
	constructor(
		// The store is the code.storage `GitStore`; the module binds it.
		@Inject(GIT_STORE)
		private readonly gitStore: GitStore,
		// Only `findBranch` is read: the head says whether a push ever happened.
		@Inject(AppCommitsRepository)
		private readonly commits: Pick<AppCommitsRepository, "findBranch">,
	) {}

	async restore(projectId: string, sandbox: SandboxHandle): Promise<void> {
		// A project with no branch head never pushed: the code.storage
		// repository does not exist yet and the template is the whole worktree.
		// The first `commitTurn` creates the repository and the head.
		const head = await this.commits.findBranch(projectId);
		if (head === null) {
			return;
		}
		const credential = await this.gitStore.issueCredential(
			projectId,
			RESTORE_CREDENTIAL_TTL_SECONDS,
		);
		const remoteUrl = authenticatedRemoteUrl(credential.remoteUrl, credential);
		// The args carry the authenticated URL; `secret` masks the JWT that
		// git echoes into stderr on a failure.
		const run = (label: string, args: string[]) =>
			mustRunGit(sandbox, args, RepoRestoreError, {
				label,
				secret: credential.password,
			});

		const hasGit = await sandbox.exec("test", ["-d", ".git"], {
			cwd: sandbox.workspaceDir,
		});
		if (hasGit.exitCode === 0) {
			await run("git pull", ["pull", remoteUrl, "main"]);
			return;
		}

		const files = await sandbox.listFiles(sandbox.workspaceDir);
		if (files.length === 0) {
			await run("git clone", ["clone", remoteUrl, sandbox.workspaceDir]);
			return;
		}

		// WANDIT-164 unpacks the template into `sandbox.workspaceDir` before the first
		// turn, so a new sandbox is not empty but has no `.git` yet. `git
		// clone` refuses a non-empty target, so rebuild in place: `init`,
		// `fetch` (the URL carries the credential; no remote is configured,
		// so nothing persists in `.git/config`), `reset` to the fetched head,
		// then `clean -fd` to drop template files the repo never tracked.
		await run("git init", ["init"]);
		await run("git fetch main", ["fetch", remoteUrl, "main"]);
		await run("git reset --hard", ["reset", "--hard", "FETCH_HEAD"]);
		await run("git clean -fd", ["clean", "-fd"]);
	}
}
