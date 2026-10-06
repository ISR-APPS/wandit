/**
 * Application service behind the versions routes.
 * `list` pages `app_commits`, and `diff` answers the stored patch and numstat.
 * `restore` saves uncommitted work as a wip version, writes a copy-forward
 * commit through `commitTurn`, and runs `pnpm install` in the sandbox. It
 * also writes a `version.restore` audit row through `AuditEventsService`.
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
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	GIT_STORE,
	type GitStore,
	REPO_RESTORER,
	type RepoRestorer,
} from "../../domain/ports/git-store";
import {
	SANDBOX_PROVIDER,
	type SandboxProvider,
} from "../../domain/ports/sandbox-provider";
import { TURN_LOCK, type TurnLock } from "../../domain/ports/turn-lock";
import { RESTORE_LOCK_HOLDER_PREFIX } from "../../domain/turn-queue";
import {
	type CommitTurnResult,
	commitTurn,
	commitTurnUnlessClean,
	versionNumstatKey,
} from "../../infrastructure/git/commit-turn";
import { mustRunGit } from "../../infrastructure/git/sandbox-git";
import { AppBackendsRepository } from "../../infrastructure/persistence/app-backends.repository";
import {
	type AppCommitRow,
	AppCommitsRepository,
	type ScopedAppProject,
	VersionConflictError,
} from "../../infrastructure/persistence/app-commits.repository";
import { BuilderTurnsRepository } from "../../infrastructure/persistence/builder-turns.repository";
import { TurnProjectRepository } from "../../infrastructure/persistence/turn-project.repository";
import { startSandboxWithoutTurn } from "../../infrastructure/sandbox/sandbox-start";
import { AuditEventsService } from "./audit-events.service";

/**
 * 2 min. The restore refreshes the lock every `RESTORE_LOCK_REFRESH_MS`, so
 * a slow boot keeps it. A dead API process frees it after this time.
 */
const RESTORE_LOCK_TTL_MS = 2 * 60_000;
/** 60 s, half the TTL: one missed refresh does not lose the lock. */
const RESTORE_LOCK_REFRESH_MS = 60_000;
/**
 * 120 s. A warm pnpm store installs in a few seconds. A cold store downloads
 * every package, and the HTTP answer waits for the install.
 */
const RESTORE_INSTALL_TIMEOUT_MS = 120_000;

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

/** Versions reads and the copy-forward restore. */
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
		const lockId = `${RESTORE_LOCK_HOLDER_PREFIX}${restoreId}`;
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

		try {
			// Product rule: a turn paused on a question or an approval resumes on
			// the code it saw. That resume cannot tell the agent about a restore.
			if ((await this.turns.findWaitingForUser(projectId)) !== null) {
				throw new ConflictException({
					code: "BUILDER_TURN_WAITING",
					message: "Answer the open question in the chat first",
				});
			}

			const branch = await this.appCommits.findBranch(projectId, "main");
			if ((branch?.headSha ?? null) !== body.expectedHeadSha) {
				throw new ConflictException({
					code: "VERSION_CONFLICT",
					message: "The project head changed; list the versions again",
				});
			}

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
					userId: scope.userId,
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
					userId: scope.userId,
				});
			} catch (error) {
				if (error instanceof VersionConflictError) {
					throw new ConflictException({
						code: "VERSION_CONFLICT",
						message: "The project head changed; list the versions again",
					});
				}
				throw error;
			}

			// The restored package.json can list a package that a later turn removed
			// from node_modules. git ignores node_modules, so only an install adds it.
			// It runs after the commit, so the version holds only the restored tree.
			// A failed install keeps the restore: the next turn can install.
			try {
				const install = await sandbox.exec(
					"pnpm",
					["install", "--frozen-lockfile", "--prefer-offline"],
					{ cwd: sandbox.workspaceDir, timeoutMs: RESTORE_INSTALL_TIMEOUT_MS },
				);
				if (install.exitCode !== 0) {
					// pnpm prints its error to stdout, at the end. The last 500
					// characters keep the cause and keep the log line short.
					this.logger.warn(
						`Restore install failed for ${projectId} (exit ${install.exitCode}): ${`${install.stdout}${install.stderr}`.slice(-500)}`,
					);
				}
			} catch (error) {
				this.logger.warn(
					`Restore install failed for ${projectId}: ${getErrorMessage(error)}`,
				);
			}

			await this.audit.record({
				action: "version.restore",
				actorUserId: scope.userId,
				ip,
				metadata: { restoredFromSha: sha },
				organizationId: project.organizationId,
				projectId,
				targetId: result.commit.sha,
				targetType: "app_commit",
			});
			return { commit: toApiCommit(result.commit) };
		} finally {
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
