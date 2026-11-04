/**
 * Application service behind the versions routes.
 * `list` pages `app_commits`, and `diff` answers the stored patch and numstat.
 * `restore` saves uncommitted work as a wip version, writes a copy-forward
 * commit through `commitTurn`, and runs `pnpm install` in the sandbox. It
 * also writes a `version.restore` audit row through `AuditEventsService`.
 * `pullFromGithub` (the GitHub Update) merges the code.storage branch
 * `github/main` the same way and writes a `github.pull` audit row. It first
 * checks the project access of the linker through `ProjectAccessService`.
 * Every method first proves the project is a scoped `v2_app` row.
 */
import { randomUUID } from "node:crypto";

import {
	ConflictException,
	Inject,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	type AppCommit,
	type AppCommitNumstatEntry,
	appCommitNumstatListSchema,
	type GithubPullBody,
	type GithubPullResponse,
	type ListVersionsQuery,
	type ListVersionsResponse,
	type RestoreVersionBody,
	type RestoreVersionResponse,
	type VersionDiffResponse,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/nestjs";

import {
	contentTypeFor,
	getObjectBytes,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { ProjectAccessService } from "../../../projects";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { isGithubUpdateAvailable } from "../../domain/github-sync";
import {
	GIT_STORE,
	type GitStore,
	REPO_RESTORER,
	type RepoRestorer,
} from "../../domain/ports/git-store";
import {
	GITHUB_SYNC_SCHEDULER,
	type GithubSyncScheduler,
} from "../../domain/ports/github-sync-scheduler";
import {
	SANDBOX_PROVIDER,
	type SandboxHandle,
	type SandboxProvider,
} from "../../domain/ports/sandbox-provider";
import { TURN_LOCK, type TurnLock } from "../../domain/ports/turn-lock";
import { RESTORE_LOCK_HOLDER_PREFIX } from "../../domain/turn-queue";
import {
	type CommitTurnDeps,
	type CommitTurnInput,
	type CommitTurnResult,
	commitTurn,
	commitTurnUnlessClean,
	versionNumstatKey,
} from "../../infrastructure/git/commit-turn";
import { authenticatedRemoteUrl } from "../../infrastructure/git/git-remote-url";
import { mustRunGit, runGit } from "../../infrastructure/git/sandbox-git";
import { AppBackendsRepository } from "../../infrastructure/persistence/app-backends.repository";
import {
	type AppCommitRow,
	AppCommitsRepository,
	type ScopedAppProject,
	VersionConflictError,
} from "../../infrastructure/persistence/app-commits.repository";
import { BuilderTurnsRepository } from "../../infrastructure/persistence/builder-turns.repository";
import { ProjectGithubLinksRepository } from "../../infrastructure/persistence/project-github-links.repository";
import { TurnProjectRepository } from "../../infrastructure/persistence/turn-project.repository";
import { startSandboxWithoutTurn } from "../../infrastructure/sandbox/sandbox-start";
import { AuditEventsService } from "./audit-events.service";

/**
 * 2 min. The restore and the pull refresh the lock every
 * `RESTORE_LOCK_REFRESH_MS`, so a slow boot keeps it. A dead API process
 * frees it after this time.
 */
const RESTORE_LOCK_TTL_MS = 2 * 60_000;
/** 60 s, half the TTL: one missed refresh does not lose the lock. */
const RESTORE_LOCK_REFRESH_MS = 60_000;
/**
 * 120 s. A warm pnpm store installs in a few seconds. A cold store downloads
 * every package, and the HTTP answer waits for the install.
 */
const INSTALL_TIMEOUT_MS = 120_000;
/**
 * 120 s, like the restorer: only the one fetch of `github/main` uses the read
 * JWT. A short life limits a JWT that sandbox code reads from the git argv.
 */
const GITHUB_MIRROR_CREDENTIAL_TTL_SECONDS = 120;

/** Nest token for the R2 object store the service reads and writes. */
export const VERSION_OBJECTS = Symbol.for("app-builder.version-objects");

/**
 * The R2 calls the service needs, as an injectable seam: specs pass a map
 * fake instead of mocking the storage module. `putPatch` feeds
 * `commitTurn`; `getBytes` feeds `diff`.
 */
export type VersionsObjectStore = {
	putPatch(key: string, body: string | Uint8Array): Promise<void>;
	getBytes(key: string): Promise<Uint8Array | null>;
};

/** The production `VersionsObjectStore` on the shared R2 helpers. */
export const r2VersionObjects: VersionsObjectStore = {
	getBytes: getObjectBytes,
	putPatch: (key, text) => putSiteFile(key, text, contentTypeFor(key)),
};

/** Versions reads, the copy-forward restore, and the GitHub Update merge. */
@Injectable()
export class VersionsService {
	private readonly logger = new Logger(VersionsService.name);

	constructor(
		@Inject(AppCommitsRepository)
		private readonly appCommits: AppCommitsRepository,
		@Inject(SANDBOX_PROVIDER)
		private readonly sandboxes: SandboxProvider,
		@Inject(TURN_LOCK)
		private readonly turnLock: TurnLock,
		@Inject(GIT_STORE)
		private readonly gitStore: GitStore,
		@Inject(REPO_RESTORER)
		private readonly repoRestorer: RepoRestorer,
		@Inject(VERSION_OBJECTS)
		private readonly objects: VersionsObjectStore,
		// The Pick types keep the sandbox start reads narrow; a spec passes
		// plain fakes.
		@Inject(TurnProjectRepository)
		private readonly projects: Pick<TurnProjectRepository, "findForTurn">,
		@Inject(AppBackendsRepository)
		private readonly backends: Pick<AppBackendsRepository, "findByProjectId">,
		@Inject(BuilderTurnsRepository)
		private readonly turns: Pick<BuilderTurnsRepository, "findWaitingForUser">,
		@Inject(AuditEventsService)
		private readonly audit: Pick<AuditEventsService, "record">,
		// `commitTurn` schedules the GitHub push of a linked project after each commit.
		@Inject(GITHUB_SYNC_SCHEDULER)
		private readonly githubSync: GithubSyncScheduler,
		// The pull reads the merge target, marks the GitHub head as pulled, and records a linker stop.
		@Inject(ProjectGithubLinksRepository)
		private readonly githubLinks: Pick<
			ProjectGithubLinksRepository,
			"findByProject" | "markPulled" | "recordError"
		>,
		// The pull checks that the linker can still open the project.
		@Inject(ProjectAccessService)
		private readonly projectAccess: Pick<ProjectAccessService, "resolve">,
	) {}

	/** One page of versions, newest first, for the versions panel. */
	async list(
		scope: ProjectScope,
		projectId: string,
		query: ListVersionsQuery,
	): Promise<ListVersionsResponse> {
		await this.requireV2Project(scope, projectId);
		// The controller pipe parses the cursor first and answers 400 for a bad one.
		const page = await this.appCommits.listByProject(projectId, {
			cursor: query.cursor,
			limit: query.limit,
		});
		return {
			items: page.items.map(toApiCommit),
			nextCursor: page.nextCursor,
		};
	}

	/** The stored patch and numstat of one version, for the diff view. */
	async diff(
		scope: ProjectScope,
		projectId: string,
		sha: string,
	): Promise<VersionDiffResponse> {
		await this.requireV2Project(scope, projectId);
		const commit = await this.appCommits.findBySha(projectId, sha);
		if (!commit || commit.patchKey === null) {
			throw new NotFoundException();
		}
		const patchBytes = await this.objects.getBytes(commit.patchKey);
		if (patchBytes === null) {
			throw new NotFoundException();
		}
		const numstatBytes = await this.objects.getBytes(
			versionNumstatKey(projectId, sha),
		);
		return {
			numstat: numstatBytes
				? parseNumstatText(new TextDecoder().decode(numstatBytes))
				: (parseNumstatColumn(commit.numstat) ?? []),
			patch: new TextDecoder().decode(patchBytes),
			sha: commit.sha,
		};
	}

	/**
	 * Copy-forward restore: the worktree goes back to `sha`'s content and a
	 * NEW commit lands on top, so history never rewinds (WANDIT-171). The
	 * restore takes the project turn lock — a turn starting mid-restore
	 * would interleave git commands on the same sandbox. A held lock, a turn
	 * that waits for the user, or a stale `expectedHeadSha` answers 409.
	 * Uncommitted files first become a "Before restore" wip version. After
	 * the restore commit, `pnpm install` syncs node_modules with the lockfile.
	 * `ip` is the client IP for the `version.restore` audit row.
	 */
	async restore(
		scope: ProjectScope,
		projectId: string,
		sha: string,
		body: RestoreVersionBody,
		ip: string,
	): Promise<RestoreVersionResponse> {
		const project = await this.requireV2Project(scope, projectId);
		const commit = await this.appCommits.findBySha(projectId, sha);
		if (!commit) {
			throw new NotFoundException();
		}

		// Product rule: a restore while a turn runs would commit on top of a
		// half-written worktree. The lock id is a restore marker, not a turn
		// id, so a `holder` read can identify a restore.
		const restoreId = randomUUID();
		const releaseLock = await this.acquireRestoreLock(
			projectId,
			`${RESTORE_LOCK_HOLDER_PREFIX}${restoreId}`,
		);

		try {
			await this.assertCommitAllowed(projectId, body.expectedHeadSha);

			// A v2_app row without a template is broken data; guessing a
			// framework would restore into a sandbox built for another stack.
			if (project.framework === null || project.templateVersion === null) {
				this.logger.error(
					`v2_app project ${projectId} has no framework/templateVersion`,
				);
				throw new InternalServerErrorException({
					code: "INTERNAL_ERROR",
					message: "The project row has no template; restore cannot proceed",
				});
			}

			// A restore boots a stopped or lost sandbox, and that boot starts
			// the dev server. A strict start needs the egress inputs of a turn.
			const sandbox = await startSandboxWithoutTurn(
				{
					backends: this.backends,
					logger: Sentry.logger,
					projects: this.projects,
					sandboxes: this.sandboxes,
				},
				projectId,
			);
			const commitDeps = {
				appCommits: this.appCommits,
				githubSync: this.githubSync,
				gitStore: this.gitStore,
				putPatch: this.objects.putPatch,
			};
			let result: CommitTurnResult;
			try {
				// A failed turn leaves its files uncommitted, and the reset below
				// deletes them. A wip version keeps them in the history.
				// If this save throws, the restore stops before the reset, because a
				// reset deletes the work permanently.
				// After a short git or network failure, the user can retry the restore.
				// Trade-off: when code.storage main has a commit that HEAD does not
				// have, each retry rejects the push.
				// An operator must reset that sandbox before a restore can complete.
				await commitTurnUnlessClean(sandbox, commitDeps, {
					chatId: null,
					messageId: `pre-restore-${restoreId}`,
					organizationId: project.organizationId,
					projectId,
					source: "wip",
					summary: "Before restore",
					turnId: null,
					userId: scope.actorUserId,
				});

				// After the save, HEAD is the stored head. Only a code.storage main
				// that is ahead of the stored head still needs this fetch.
				await this.repoRestorer.restore(projectId, sandbox);

				// Copy-forward: the worktree and index take the old tree; the commit
				// lands on top of HEAD, so every version stays reachable.
				await mustRunGit(sandbox, ["read-tree", "-u", "--reset", sha], Error);
				// `read-tree` leaves untracked files behind; `add -A` in commitTurn
				// would sweep them into the restore commit.
				await mustRunGit(sandbox, ["clean", "-fd"], Error);

				result = await commitTurn(sandbox, commitDeps, {
					chatId: null,
					messageId: `restore-${restoreId}`,
					organizationId: project.organizationId,
					projectId,
					restoredFromSha: sha,
					source: "restore",
					summary: `Restore to ${sha.slice(0, 7)}`,
					turnId: null,
					userId: scope.actorUserId,
				});
			} catch (error) {
				if (error instanceof VersionConflictError) {
					throw versionConflict();
				}
				throw error;
			}

			// The restored package.json can list a package that a later turn removed
			// from node_modules. It runs after the commit, so the version holds only
			// the restored tree.
			await this.installDependencies(sandbox, "Restore");

			await this.audit.record({
				action: "version.restore",
				actorUserId: scope.actorUserId,
				ip,
				metadata: { restoredFromSha: sha },
				organizationId: project.organizationId,
				projectId,
				targetId: result.commit.sha,
				targetType: "app_commit",
			});
			return { commit: toApiCommit(result.commit) };
		} finally {
			await releaseLock();
		}
	}

	/**
	 * GitHub Update: merges the code.storage branch `github/main`
	 * into the project as one "github" merge commit; GitHub wins on conflicting lines and
	 * paths. It holds the lock and runs the 409 checks of `restore`, and saves uncommitted
	 * files as a "Before GitHub update" wip version first. 404 GITHUB_NOT_LINKED, 409
	 * GITHUB_LINK_OWNER_LEFT, GITHUB_NOTHING_TO_UPDATE, or GITHUB_UPDATE_CHANGED, 500 GITHUB_MERGE_FAILED.
	 * `commit` is null when the project already holds the GitHub head. `ip` goes to the audit row.
	 */
	async pullFromGithub(
		scope: ProjectScope,
		projectId: string,
		body: GithubPullBody,
		ip: string,
	): Promise<GithubPullResponse> {
		const project = await this.requireV2Project(scope, projectId);
		const link = await this.githubLinks.findByProject(projectId);
		if (link === null) {
			throw new NotFoundException({
				code: "GITHUB_NOT_LINKED",
				message: "This project has no GitHub repository",
			});
		}
		// Security: the link must not outlive the read access of the linker. Else
		// the merge takes code from the repo of a person outside the project.
		// The recorded code shows the stop in the GitHub panel.
		if ((await this.projectAccess.resolve(link.userId, projectId)) === null) {
			this.logger.warn(
				`GitHub pull refused for project ${projectId}: linker ${link.userId} has no project access`,
			);
			await this.githubLinks.recordError(link.id, "GITHUB_LINK_OWNER_LEFT");
			throw new ConflictException({
				code: "GITHUB_LINK_OWNER_LEFT",
				message:
					"The person who linked this repository cannot open this project. Unlink it and link it again.",
			});
		}
		// The merge target is the GitHub head that the worker copied to `github/main`.
		const targetSha = link.mirroredSha;
		if (targetSha === null || !isGithubUpdateAvailable(link)) {
			throw new ConflictException({
				code: "GITHUB_NOTHING_TO_UPDATE",
				message: "GitHub has no new changes for this project",
			});
		}

		// The restore prefix: a turn submit answers 409 while the pull runs.
		const pullId = randomUUID();
		const releaseLock = await this.acquireRestoreLock(
			projectId,
			`${RESTORE_LOCK_HOLDER_PREFIX}github-${pullId}`,
		);
		try {
			await this.assertCommitAllowed(projectId, body.expectedHeadSha);
			// The boot throws for a v2_app row without a template.
			const sandbox = await startSandboxWithoutTurn(
				{
					backends: this.backends,
					logger: Sentry.logger,
					projects: this.projects,
					sandboxes: this.sandboxes,
				},
				projectId,
			);
			const commitDeps = {
				appCommits: this.appCommits,
				githubSync: this.githubSync,
				gitStore: this.gitStore,
				putPatch: this.objects.putPatch,
			};
			const commitFields = {
				chatId: null,
				organizationId: project.organizationId,
				projectId,
				turnId: null,
				userId: scope.actorUserId,
			};
			let result: CommitTurnResult | null;
			try {
				// A crashed earlier pull can leave MERGE_HEAD. A theme save (`commit -- <paths>`)
				// then fails. A wip save or a turn commit becomes a merge that can hold conflict markers.
				// LIMIT: an API restart mid-pull leaves the sandbox mid-merge until the
				// next pull. Upgrade: run the pull in a Trigger task.
				const openMerge = await runGit(sandbox, [
					"rev-parse",
					"-q",
					"--verify",
					"MERGE_HEAD",
				]);
				if (openMerge.exitCode === 0) {
					await mustRunGit(sandbox, ["merge", "--abort"], Error);
				}
				// The restorer reset below deletes uncommitted files; a wip version keeps them.
				await commitTurnUnlessClean(sandbox, commitDeps, {
					...commitFields,
					messageId: `pre-github-${pullId}`,
					source: "wip",
					summary: "Before GitHub update",
				});
				await this.repoRestorer.restore(projectId, sandbox);
				result = await this.mergeGithubHead(sandbox, commitDeps, targetSha, {
					...commitFields,
					messageId: `github-${pullId}`,
					source: "github",
					summary: `Update from GitHub (${targetSha.slice(0, 7)})`,
				});
			} catch (error) {
				if (error instanceof VersionConflictError) {
					throw versionConflict();
				}
				throw error;
			}

			if (result === null) {
				// The project already holds the GitHub head, so no merge commit. The
				// sync run pushes our head when GitHub is behind it.
				await this.githubLinks.markPulled(link.id, targetSha);
				await this.githubSync.scheduleIfLinked(projectId, `pull:${targetSha}`);
				return { commit: null };
			}
			// GitHub commits can add or change packages in package.json.
			await this.installDependencies(sandbox, "GitHub update");
			// No write when the worker saw a newer GitHub head during the install:
			// the banner then offers that head.
			await this.githubLinks.markPulled(link.id, targetSha);
			await this.audit.record({
				action: "github.pull",
				actorUserId: scope.actorUserId,
				ip,
				metadata: { githubSha: targetSha },
				organizationId: project.organizationId,
				projectId,
				targetId: result.commit.sha,
				targetType: "app_commit",
			});
			return { commit: toApiCommit(result.commit) };
		} finally {
			await releaseLock();
		}
	}

	// Fetches `github/main` into the sandbox and commits the merge of
	// `targetSha` through `commitTurn`. Null when HEAD already holds it.
	// A failed merge resets the sandbox to the head before the merge.
	// A failed commit resets it to code.storage main.
	private async mergeGithubHead(
		sandbox: SandboxHandle,
		commitDeps: CommitTurnDeps,
		targetSha: string,
		input: CommitTurnInput,
	): Promise<CommitTurnResult | null> {
		const preMergeHead = (
			await mustRunGit(sandbox, ["rev-parse", "HEAD"], Error)
		).stdout.trim();
		// Security: a read JWT only. Sandbox code can read the git argv, and the
		// sandbox never gets a GitHub token.
		const credential = await this.gitStore.issueCredential(
			input.projectId,
			GITHUB_MIRROR_CREDENTIAL_TTL_SECONDS,
			"read",
		);
		await mustRunGit(
			sandbox,
			[
				"fetch",
				authenticatedRemoteUrl(credential.remoteUrl, credential),
				"refs/heads/github/main",
			],
			Error,
			{ label: "git fetch github/main", secret: credential.password },
		);
		const fetchedSha = (
			await mustRunGit(sandbox, ["rev-parse", "FETCH_HEAD"], Error)
		).stdout.trim();
		// The worker mirrored a newer GitHub head after the link read above.
		if (fetchedSha !== targetSha) {
			throw new ConflictException({
				code: "GITHUB_UPDATE_CHANGED",
				message: "GitHub changed again; try the update once more",
			});
		}
		const ancestor = await runGit(sandbox, [
			"merge-base",
			"--is-ancestor",
			targetSha,
			"HEAD",
		]);
		if (ancestor.exitCode === 0) {
			return null;
		}
		if (ancestor.exitCode !== 1) {
			throw new Error(
				`git merge-base --is-ancestor failed (${ancestor.exitCode}): ${ancestor.stderr}`,
			);
		}

		try {
			await mergeTheirs(sandbox, targetSha);
		} catch (error) {
			// The reset ends the open merge. The caller gets the merge error, so a failed reset only logs.
			await mustRunGit(sandbox, ["reset", "--hard", preMergeHead], Error).catch(
				(resetError: unknown) => {
					this.logger.warn(
						`GitHub update reset failed for ${input.projectId}: ${getErrorMessage(resetError)}`,
					);
				},
			);
			throw error;
		}
		try {
			// MERGE_HEAD is set, so the commit is a merge: parents HEAD and targetSha.
			return await commitTurn(sandbox, commitDeps, input);
		} catch (error) {
			// A merge commit left in the sandbox goes out inside the next turn's version.
			// code.storage main is the merge commit after a good push, else `preMergeHead`.
			// A reset to it keeps every later push fast-forward.
			await this.repoRestorer
				.restore(input.projectId, sandbox)
				.catch((restoreError: unknown) => {
					this.logger.warn(
						`GitHub update restore failed for ${input.projectId}: ${getErrorMessage(restoreError)}`,
					);
				});
			throw error;
		}
	}

	// Takes the project turn lock for a restore or a GitHub pull, and refreshes
	// it until the returned release runs. 409 BUILDER_TURN_ACTIVE when a turn,
	// a restore, or a theme save holds it.
	private async acquireRestoreLock(
		projectId: string,
		lockId: string,
	): Promise<() => Promise<void>> {
		const acquired = await this.turnLock.acquire(
			projectId,
			lockId,
			RESTORE_LOCK_TTL_MS,
		);
		if (!acquired) {
			throw new ConflictException({
				code: "BUILDER_TURN_ACTIVE",
				message: "A builder turn is running for this project",
			});
		}
		// The short TTL frees the project soon after a lost API process. While
		// the restore runs, this timer keeps the lock alive.
		// LIMIT: an API restart during a restore blocks the project for up to
		// 2 min. Upgrade: run the restore in a Trigger task.
		const lockRefresh = setInterval(() => {
			void this.turnLock
				.refresh(projectId, lockId, RESTORE_LOCK_TTL_MS)
				.then((refreshed) => {
					if (!refreshed) {
						this.logger.warn(`Restore lock lost for ${projectId}`);
					}
				})
				.catch((error: unknown) => {
					this.logger.warn(
						`Restore lock refresh failed for ${projectId}: ${getErrorMessage(error)}`,
					);
				});
		}, RESTORE_LOCK_REFRESH_MS);
		return async () => {
			// A refresh after the release would find no lock and log a false loss.
			clearInterval(lockRefresh);
			// A failed release self-heals at the lock TTL; it must not mask
			// the restore result.
			await this.turnLock.release(projectId, lockId).catch((error: unknown) => {
				this.logger.warn(
					`Restore lock release failed for ${projectId}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			});
		};
	}

	// The 409 checks of a restore and a pull, after the lock is held.
	private async assertCommitAllowed(
		projectId: string,
		expectedHeadSha: string | null,
	): Promise<void> {
		// Product rule: a turn paused on a question or an approval resumes on
		// the code it saw. That resume cannot tell the agent about a restore.
		if ((await this.turns.findWaitingForUser(projectId)) !== null) {
			throw new ConflictException({
				code: "BUILDER_TURN_WAITING",
				message: "Answer the open question in the chat first",
			});
		}
		const branch = await this.appCommits.findBranch(projectId, "main");
		if ((branch?.headSha ?? null) !== expectedHeadSha) {
			throw versionConflict();
		}
	}

	// git ignores node_modules, so only an install adds a package that the new
	// package.json lists. A failed install keeps the commit: the next turn can
	// install. `step` names the flow in the log line.
	private async installDependencies(
		sandbox: SandboxHandle,
		step: "Restore" | "GitHub update",
	): Promise<void> {
		try {
			const install = await sandbox.exec(
				"pnpm",
				["install", "--frozen-lockfile", "--prefer-offline"],
				{ cwd: sandbox.workspaceDir, timeoutMs: INSTALL_TIMEOUT_MS },
			);
			if (install.exitCode !== 0) {
				// pnpm prints its error to stdout, at the end. The last 500
				// characters keep the cause and keep the log line short.
				this.logger.warn(
					`${step} install failed for ${sandbox.projectId} (exit ${install.exitCode}): ${`${install.stdout}${install.stderr}`.slice(-500)}`,
				);
			}
		} catch (error) {
			this.logger.warn(
				`${step} install failed for ${sandbox.projectId}: ${getErrorMessage(error)}`,
			);
		}
	}

	// The project must exist inside the caller's scope and be a V2 app; a
	// V1 project or another workspace's project answers 404, not 403.
	private async requireV2Project(
		scope: ProjectScope,
		projectId: string,
	): Promise<ScopedAppProject> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project?.engine !== "v2_app") {
			throw new NotFoundException();
		}
		return project;
	}
}

function versionConflict(): ConflictException {
	return new ConflictException({
		code: "VERSION_CONFLICT",
		message: "The project head changed; list the versions again",
	});
}

// Merges `targetSha` without a commit. GitHub wins on conflicting lines
// (`-X theirs`) and on each conflict that `-X theirs` leaves: modify/delete,
// binary files, and file/directory pairs. 500 GITHUB_MERGE_FAILED unless
// MERGE_HEAD is `targetSha` and no path is unmerged.
async function mergeTheirs(
	sandbox: SandboxHandle,
	targetSha: string,
): Promise<void> {
	// `--allow-unrelated-histories`: a GitHub history that a force push
	// replaced still merges, and GitHub wins its paths.
	const merge = await runGit(sandbox, [
		"merge",
		"--no-ff",
		"--no-commit",
		"--allow-unrelated-histories",
		"-X",
		"theirs",
		targetSha,
	]);
	if (merge.exitCode !== 0) {
		for (const path of await unmergedPaths(sandbox)) {
			await takeGithubSide(sandbox, targetSha, path);
		}
	}
	// A merge that stops before it starts (for example untracked files in the
	// way) sets no MERGE_HEAD. The commit would then be an empty non-merge
	// version, and the sync would never push our commits again.
	const mergeHead = await runGit(sandbox, [
		"rev-parse",
		"-q",
		"--verify",
		"MERGE_HEAD",
	]);
	if (
		mergeHead.exitCode !== 0 ||
		mergeHead.stdout.trim() !== targetSha ||
		(await unmergedPaths(sandbox)).length > 0
	) {
		throw new InternalServerErrorException(
			{
				code: "GITHUB_MERGE_FAILED",
				message: "The GitHub changes could not be merged",
			},
			// Sentry reads the cause, so the git reason reaches it. The merge argv holds no secret.
			{
				cause: new Error(
					`git merge exited ${merge.exitCode}, MERGE_HEAD "${mergeHead.stdout.trim()}": ${merge.stderr}`,
				),
			},
		);
	}
}

// Paths with an unmerged index entry. `-z` keeps unusual file names unquoted.
async function unmergedPaths(sandbox: SandboxHandle): Promise<string[]> {
	const diff = await mustRunGit(
		sandbox,
		["diff", "--name-only", "--diff-filter=U", "-z"],
		Error,
	);
	return diff.stdout.split("\0").filter((path) => path !== "");
}

// Resolves one unmerged path to its GitHub version, or removes it when
// GitHub deleted it. The path goes into argv after `--`, never into a shell.
async function takeGithubSide(
	sandbox: SandboxHandle,
	targetSha: string,
	path: string,
): Promise<void> {
	const inGithub = await runGit(sandbox, [
		"cat-file",
		"-e",
		`${targetSha}:${path}`,
	]);
	// Security: `--literal-pathspecs` reads `app/[id].tsx` or `*` as one file
	// name, not as a glob that matches other files.
	if (inGithub.exitCode === 0) {
		await mustRunGit(
			sandbox,
			["--literal-pathspecs", "checkout", targetSha, "--", path],
			Error,
		);
		return;
	}
	// `-f` removes every index stage and the worktree file of an unmerged path.
	await mustRunGit(
		sandbox,
		["--literal-pathspecs", "rm", "-q", "-f", "--ignore-unmatch", "--", path],
		Error,
	);
}

// The `app_commits` row as the contract sees it. `numstat` is a jsonb
// column, so the stored value is validated before it goes out.
function toApiCommit(row: AppCommitRow): AppCommit {
	return {
		createdAt: row.createdAt.toISOString(),
		message: row.message,
		messageId: row.messageId,
		numstat: parseNumstatColumn(row.numstat),
		parentSha: row.parentSha,
		restoredFromSha: row.restoredFromSha,
		sha: row.sha,
		source: row.source,
		turnId: row.turnId,
	};
}

// The jsonb column is `unknown` to the type system; a stored value that
// does not parse reads as null, like a row written before numstat existed.
function parseNumstatColumn(value: unknown): AppCommit["numstat"] {
	const parsed = appCommitNumstatListSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

// The `.numstat` object stores the numstat JSON array; a broken object
// reads as an empty list, matching a row with no numstat.
function parseNumstatText(text: string): AppCommitNumstatEntry[] {
	try {
		const parsed = appCommitNumstatListSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}
