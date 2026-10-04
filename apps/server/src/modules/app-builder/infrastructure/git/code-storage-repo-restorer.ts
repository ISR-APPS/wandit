/**
 * `RepoRestorer` on code.storage (D21): brings a project's repository into
 * a sandbox that lost its disk. `VercelSandboxProvider.start` calls it for a
 * new sandbox, and `VersionsService` before a version restore. It resets to
 * the fetched `main` when `.git` exists, and else rebuilds the worktree in
 * place. It runs git in the sandbox through `mustRunGit`.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { GitStore, RepoRestorer } from "../../domain/ports/git-store";
import { GIT_STORE } from "../../domain/ports/git-store";
import type { SandboxHandle } from "../../domain/ports/sandbox-provider";
import { AppCommitsRepository } from "../persistence/app-commits.repository";
import { authenticatedRemoteUrl } from "./git-remote-url";
import { mustRunGit } from "./sandbox-git";

// A short life limits the use of a stolen read JWT (WANDIT-282). Only one
// fetch uses it, right after the mint. A live probe saw a 40 MB clone
// outlive its 2 s JWT, so the TTL must cover only the time to the start.
const RESTORE_CREDENTIAL_TTL_SECONDS = 120;

/** One restorer step failed inside the sandbox. Never carries the JWT. */
export class RepoRestoreError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RepoRestoreError";
	}
}

/**
 * Restores one project's code.storage repository into a sandbox. The
 * credential it mints lives only in the `fetch` argv. No remote is
 * configured, so it never goes into `.git/config`.
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

	async restore(
		projectId: string,
		sandbox: Pick<SandboxHandle, "exec" | "workspaceDir">,
	): Promise<void> {
		// A project with no branch head never pushed: the code.storage
		// repository does not exist yet and the template is the whole worktree.
		// The first `commitTurn` creates the repository and the head.
		const head = await this.commits.findBranch(projectId);
		if (head === null) {
			return;
		}
		// Security (WANDIT-282): a restore only reads. Sandbox code can read the
		// JWT from the git argv, so it must not be able to push.
		const credential = await this.gitStore.issueCredential(
			projectId,
			RESTORE_CREDENTIAL_TTL_SECONDS,
			"read",
		);
		const remoteUrl = authenticatedRemoteUrl(credential.remoteUrl, credential);
		// The args carry the authenticated URL; `secret` masks the JWT that
		// git echoes into stderr on a failure. `mustRunGit` adds the flags that
		// turn off hooks and credential helpers.
		const run = (label: string, args: string[]) =>
			mustRunGit(sandbox, args, RepoRestoreError, {
				label,
				secret: credential.password,
			});

		const hasGit = await sandbox.exec("test", ["-d", ".git"], {
			cwd: sandbox.workspaceDir,
		});
		if (hasGit.exitCode === 0) {
			// In a new sandbox, `.git` holds only the commit of the current template.
			// After a template change, its root differs from the project root, and
			// `git pull` refuses to merge. `reset` needs no shared history. Like a
			// fast-forward, it deletes tracked files that the project does not track.
			await run("git fetch main", ["fetch", remoteUrl, "main"]);
			await run("git reset --hard", ["reset", "--hard", "FETCH_HEAD"]);
			return;
		}

		// No `.git`: the folder is empty or holds template files. Rebuild in
		// place: `init`, `fetch`, `reset` to the fetched head, then `clean -fd`
		// to drop template files the repo never tracked. Not `git clone`: it
		// stores the URL with the JWT as `remote.origin.url` in `.git/config`.
		await run("git init", ["init"]);
		await run("git fetch main", ["fetch", remoteUrl, "main"]);
		await run("git reset --hard", ["reset", "--hard", "FETCH_HEAD"]);
		await run("git clean -fd", ["clean", "-fd"]);
	}
}
