/**
 * Application service behind the versions routes.
 * `list` pages `app_commits`, `diff` answers the stored patch and numstat,
 * and `restore` writes a copy-forward commit through `commitTurn`.
 * Every method first proves the project is a scoped `v2_app` row.
 */
import { randomUUID } from "node:crypto";

import {
	BadRequestException,
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
	commitTurn,
	versionNumstatKey,
} from "../../infrastructure/git/commit-turn";
import { mustRunGit } from "../../infrastructure/git/sandbox-git";
import {
	type AppCommitRow,
	AppCommitsRepository,
	MalformedVersionCursorError,
	type ScopedAppProject,
	VersionConflictError,
} from "../../infrastructure/persistence/app-commits.repository";
import { TURN_LOCK_TTL_MS } from "../../infrastructure/redis/redis-turn-lock";

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
	) {}

	/** One page of versions, newest first, for the versions panel. */
	async list(
		scope: ProjectScope,
		projectId: string,
		query: ListVersionsQuery,
	): Promise<ListVersionsResponse> {
		await this.requireV2Project(scope, projectId);
		try {
			const page = await this.appCommits.listByProject(projectId, {
				cursor: query.cursor,
				limit: query.limit,
			});
			return {
				items: page.items.map(toApiCommit),
				nextCursor: page.nextCursor,
			};
		} catch (error) {
			// The cursor is client input; a malformed one is a 400, not a 500.
			if (error instanceof MalformedVersionCursorError) {
				throw new BadRequestException({
					code: "VALIDATION_ERROR",
					message: "Malformed versions cursor",
				});
			}
			throw error;
		}
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
	 * would interleave git commands on the same sandbox. A held lock or a
	 * stale `expectedHeadSha` answers 409.
	 */
	async restore(
		scope: ProjectScope,
		projectId: string,
		sha: string,
		body: RestoreVersionBody,
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
			TURN_LOCK_TTL_MS,
		);
		if (!acquired) {
			throw new ConflictException({
				code: "BUILDER_TURN_ACTIVE",
				message: "A builder turn is running for this project",
			});
		}

		try {
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

			const sandbox = await this.sandboxes.getOrCreate(projectId, {
				// A restore never starts the dev server; the command and port only
				// satisfy the sandbox options contract.
				devCommand: "pnpm dev",
				devPort: 5173,
				env: {},
				framework: project.framework,
				templateVersion: project.templateVersion,
				ownerUserId: project.userId,
				organizationId: project.organizationId,
			});
			// A fresh or stale sandbox first pulls or clones the repository; a
			// restore on top of a missing worktree cannot read-tree anything.
			await this.repoRestorer.restore(projectId, sandbox);

			// Copy-forward: the worktree and index take the old tree; the commit
			// lands on top of HEAD, so every version stays reachable.
			await mustRunGit(sandbox, ["read-tree", "-u", "--reset", sha], Error);
			// `read-tree` leaves untracked files behind; `add -A` in commitTurn
			// would sweep them into the restore commit.
			await mustRunGit(sandbox, ["clean", "-fd"], Error);

			let result: Awaited<ReturnType<typeof commitTurn>>;
			try {
				result = await commitTurn(
					sandbox,
					{
						appCommits: this.appCommits,
						gitStore: this.gitStore,
						putPatch: this.objects.putPatch,
					},
					{
						chatId: null,
						messageId: `restore-${restoreId}`,
						organizationId: project.organizationId,
						projectId,
						restoredFromSha: sha,
						source: "restore",
						summary: `Restore to ${sha.slice(0, 7)}`,
						turnId: null,
						userId: scope.userId,
					},
				);
			} catch (error) {
				if (error instanceof VersionConflictError) {
					throw new ConflictException({
						code: "VERSION_CONFLICT",
						message: "The project head changed; list the versions again",
					});
				}
				throw error;
			}

			return { commit: toApiCommit(result.commit) };
		} finally {
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
