/**
 * Database helper for the page domain: landing artifacts, their immutable
 * versions, and page_generation_attempts (the mutable build-status rows).
 *
 * Repository means: keep SQL/database details here, not inside services.
 * Two very different callers share it — the pages HTTP endpoints (reads)
 * and the generate_page chat tool (queue-time writes).
 */

import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, lt, sql } from "@wandit/db";
import { artifacts, versions } from "@wandit/db/schema/artifacts";
import { deployments } from "@wandit/db/schema/deployments";
import { pageGenerationAttempts } from "@wandit/db/schema/page-attempts";
import { projects } from "@wandit/db/schema/projects";
import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	type AnalyticsCapture,
	captureGenerationFailed,
} from "../../../../infrastructure/analytics/generation-events";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";

// A page task can wait up to 35 minutes in Trigger and then run for 30
// minutes. Polling must not fail a healthy late-starting task, so generating
// rows get the full wait + runtime + five-minute commit grace window.
export const PAGE_ATTEMPT_TRIGGER_TTL_MS = 35 * 60 * 1000;
export const PAGE_ATTEMPT_MAX_RUNTIME_MS = 30 * 60 * 1000;
export const PAGE_ATTEMPT_STALE_GRACE_MS = 5 * 60 * 1000;
export const PAGE_ATTEMPT_STALE_QUEUED_MS =
	PAGE_ATTEMPT_TRIGGER_TTL_MS + PAGE_ATTEMPT_STALE_GRACE_MS;
export const PAGE_ATTEMPT_STALE_GENERATING_MS =
	PAGE_ATTEMPT_TRIGGER_TTL_MS +
	PAGE_ATTEMPT_MAX_RUNTIME_MS +
	PAGE_ATTEMPT_STALE_GRACE_MS;

// Small explicit shapes; services map these to contract types.
export type LandingArtifactRow = {
	activeVersionId: string | null;
	id: string;
};

export type OwnedVersionRow = {
	artifactId: string;
	id: string;
	projectId: string;
	r2Key: string;
};

export type VersionListRow = {
	createdAt: Date;
	id: string;
	isLive: boolean;
	meta: unknown;
	number: number;
};

export type BuilderVersionRow = {
	id: string;
	r2Key: string;
};

export type PageAttemptStatusRow =
	| "queued"
	| "generating"
	| "succeeded"
	| "failed"
	| "canceled";

export type PageOverviewRows = {
	artifactId: string | null;
	activeVersion: {
		createdAt: Date;
		id: string;
		number: number;
	} | null;
	latestAttempt: {
		createdAt: Date;
		error: string | null;
		failureCode: string | null;
		id: string;
		status: PageAttemptStatusRow;
		versionId: string | null;
	} | null;
};

/** Durable per-attempt state for the chat card (+ triggerRunId for cancels). */
export type PageAttemptDetailRow = {
	completedAt: Date | null;
	createdAt: Date;
	dismissedAt: Date | null;
	error: string | null;
	failureCode: string | null;
	id: string;
	lastProgressPercent: number | null;
	status: PageAttemptStatusRow;
	triggerRunId: string | null;
	versionId: string | null;
};

// What generate_page snapshots into the attempt's jsonb spec.
export type PageAttemptSpec = {
	brief: string;
	designerSystemPrompt: string;
	pageKind?: "cod" | "website";
	title: string;
};

// Landing artifact + its active version, the working set of every mutation
// (ops batch, chat edit tool). version is null until a first build succeeds.
export type ActivePageRow = {
	artifactId: string;
	version: { id: string; number: number; r2Key: string } | null;
};

/**
 * Thrown by insertVersionAndActivate when the artifact's active version moved
 * between the caller's read and its write (optimistic concurrency). Carries
 * the CURRENT pointer so HTTP callers can answer 409 with it.
 */
export class VersionConflictError extends Error {
	constructor(readonly activeVersionId: string | null) {
		super("The page's active version changed mid-edit");
		this.name = "VersionConflictError";
	}
}

@Injectable()
export class PagesRepository {
	// DATABASE is the Nest token for the Drizzle database connection.
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsCapture,
	) {}

	// The MVP invariant is ONE landing-page artifact per project. First
	// generation creates it; every later one reuses it.
	async findOrCreateLandingArtifact(
		projectId: string,
	): Promise<LandingArtifactRow> {
		const existing = await this.findLandingArtifact(projectId);

		if (existing) {
			return existing;
		}

		// Two chats racing both reach here; the partial unique index
		// artifacts_project_landing_uq turns the losing insert into a no-op.
		const [inserted] = await this.db
			.insert(artifacts)
			.values({ kind: "landing_page", projectId })
			.onConflictDoNothing()
			.returning({
				activeVersionId: artifacts.activeVersionId,
				id: artifacts.id,
			});

		if (inserted) {
			return inserted;
		}

		// Lost the race — the winner's row must exist now.
		const raced = await this.findLandingArtifact(projectId);

		if (!raced) {
			throw new Error("Landing artifact missing after conflicting insert");
		}

		return raced;
	}

	// One attempt row per generate_page call, born "queued".
	async insertAttempt(input: {
		artifactId: string;
		chatId: string;
		model: string;
		projectId: string;
		spec: PageAttemptSpec;
	}): Promise<{ id: string }> {
		const [row] = await this.db
			.insert(pageGenerationAttempts)
			.values(input)
			.returning({ id: pageGenerationAttempts.id });

		// Defensive guard: insert should always return one row.
		if (!row) {
			throw new Error("Attempt insert did not return a row");
		}

		return row;
	}

	// Link the attempt to its Trigger.dev run once the queue accepted it.
	async markAttemptTriggered(
		attemptId: string,
		runId: string,
	): Promise<boolean> {
		const [linked] = await this.db
			.update(pageGenerationAttempts)
			.set({ triggerRunId: runId })
			.where(
				and(
					eq(pageGenerationAttempts.id, attemptId),
					eq(pageGenerationAttempts.status, "queued"),
				),
			)
			.returning({ id: pageGenerationAttempts.id });

		return linked !== undefined;
	}

	// Used when queueing itself failed — the background task never ran, so
	// somebody has to move the row to a terminal state.
	async markAttemptFailed(
		attemptId: string,
		error: string,
		userId: string,
	): Promise<boolean> {
		const [failed] = await this.db
			.update(pageGenerationAttempts)
			.set({ completedAt: new Date(), error, status: "failed" })
			.where(
				and(
					eq(pageGenerationAttempts.id, attemptId),
					eq(pageGenerationAttempts.status, "queued"),
				),
			)
			.returning({ projectId: pageGenerationAttempts.projectId });

		if (!failed) {
			return false;
		}

		captureGenerationFailed(
			this.analyticsService,
			userId,
			"page",
			failed.projectId,
			attemptId,
			"trigger_rejected",
		);

		return true;
	}

	// One attempt's durable state, ownership proven by the project join.
	// Null covers missing, deleted, and not-owned alike — the service 404s.
	async findAttemptDetail(
		scope: ProjectScope,
		projectId: string,
		attemptId: string,
	): Promise<PageAttemptDetailRow | null> {
		const [row] = await this.db
			.select({
				completedAt: pageGenerationAttempts.completedAt,
				createdAt: pageGenerationAttempts.createdAt,
				dismissedAt: pageGenerationAttempts.dismissedAt,
				error: pageGenerationAttempts.error,
				failureCode: pageGenerationAttempts.failureCode,
				id: pageGenerationAttempts.id,
				lastProgressPercent: pageGenerationAttempts.lastProgressPercent,
				status: pageGenerationAttempts.status,
				triggerRunId: pageGenerationAttempts.triggerRunId,
				versionId: pageGenerationAttempts.versionId,
			})
			.from(pageGenerationAttempts)
			.innerJoin(projects, eq(projects.id, pageGenerationAttempts.projectId))
			.where(
				and(
					eq(pageGenerationAttempts.id, attemptId),
					eq(pageGenerationAttempts.projectId, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * User Stop: CAS queued/generating → canceled. Returns the run id to
	 * cancel, or null when the attempt was already terminal (the caller then
	 * re-reads and answers with current truth — stopping twice is not an
	 * error). observedPercent is the percent the card last SAW; it freezes
	 * the stopped card even when the worker dies before writing its own.
	 */
	async cancelAttempt(
		attemptId: string,
		observedPercent: number | undefined,
	): Promise<{ triggerRunId: string | null } | null> {
		const [row] = await this.db
			.update(pageGenerationAttempts)
			.set({
				completedAt: new Date(),
				status: "canceled",
				...(observedPercent !== undefined
					? { lastProgressPercent: observedPercent }
					: {}),
			})
			.where(
				and(
					eq(pageGenerationAttempts.id, attemptId),
					inArray(pageGenerationAttempts.status, ["queued", "generating"]),
				),
			)
			.returning({ triggerRunId: pageGenerationAttempts.triggerRunId });

		return row ?? null;
	}

	/**
	 * Retry/Resume: CAS failed/canceled → queued on the SAME row, clearing
	 * the previous outcome. The same-row reuse keeps every persisted chat
	 * card pointing at a live attempt id across reloads. Returns false when
	 * the attempt was not retryable (already queued/generating/succeeded).
	 */
	async resetAttemptForRetry(attemptId: string): Promise<boolean> {
		const [row] = await this.db
			.update(pageGenerationAttempts)
			.set({
				completedAt: null,
				// The row now represents its LATEST queue, so its clock restarts:
				// the stale self-heal above times out queued/generating rows by
				// createdAt (a 2h-old retried row would be re-failed on the very
				// next overview poll otherwise), and the task's newer-succeeded
				// check keys off it too (an explicit retry IS the newest work).
				createdAt: new Date(),
				dismissedAt: null,
				error: null,
				failureCode: null,
				lastProgressPercent: null,
				status: "queued",
				triggerRunId: null,
				versionId: null,
			})
			.where(
				and(
					eq(pageGenerationAttempts.id, attemptId),
					inArray(pageGenerationAttempts.status, ["failed", "canceled"]),
				),
			)
			.returning({ id: pageGenerationAttempts.id });

		return row !== undefined;
	}

	/** Discard/Dismiss the terminal chat card — pure UI bookkeeping. */
	async dismissAttempt(attemptId: string): Promise<boolean> {
		const [row] = await this.db
			.update(pageGenerationAttempts)
			.set({ dismissedAt: new Date() })
			.where(
				and(
					eq(pageGenerationAttempts.id, attemptId),
					inArray(pageGenerationAttempts.status, ["failed", "canceled"]),
				),
			)
			.returning({ id: pageGenerationAttempts.id });

		return row !== undefined;
	}

	// Everything the Page tab polls for, or null when the project is not
	// owned by this user (the service turns that into a 404).
	async findOverviewByProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<PageOverviewRows | null> {
		// Access first: the project must be reachable in this workspace scope
		// and not deleted.
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!project) {
			return null;
		}

		const artifact = await this.findLandingArtifact(projectId);

		// Active version summary — only when the artifact points at one.
		let activeVersion: PageOverviewRows["activeVersion"] = null;

		if (artifact?.activeVersionId) {
			const [row] = await this.db
				.select({
					createdAt: versions.createdAt,
					id: versions.id,
					number: versions.number,
				})
				.from(versions)
				.where(eq(versions.id, artifact.activeVersionId))
				.limit(1);

			activeVersion = row ?? null;
		}

		// Self-heal on read: a "queued" run nobody picked up expires after
		// Trigger.dev's task TTL and will never execute; a "generating"
		// row can strand the same way if the worker is killed mid-run. Left
		// alone, either would keep the Page tab polling forever — flip stale
		// rows to failed so the UI stops waiting and says what happened. The
		// generating cutoff includes the maximum queue wait because this schema
		// has only createdAt (not claimedAt), plus task runtime and commit grace.
		const staleQueued = await this.db
			.update(pageGenerationAttempts)
			.set({
				completedAt: new Date(),
				error:
					"The build never finished — most likely no Trigger.dev dev worker was running (`npx trigger.dev@latest dev`). Start it and ask for the page again.",
				status: "failed",
			})
			.where(
				and(
					eq(pageGenerationAttempts.projectId, projectId),
					eq(pageGenerationAttempts.status, "queued"),
					lt(
						pageGenerationAttempts.createdAt,
						new Date(Date.now() - PAGE_ATTEMPT_STALE_QUEUED_MS),
					),
				),
			)
			.returning({
				id: pageGenerationAttempts.id,
				projectId: pageGenerationAttempts.projectId,
			});

		for (const failed of staleQueued) {
			captureGenerationFailed(
				this.analyticsService,
				scope.userId,
				"page",
				failed.projectId,
				failed.id,
				"stale_queued",
			);
		}

		const staleGenerating = await this.db
			.update(pageGenerationAttempts)
			.set({
				completedAt: new Date(),
				error:
					"The build never finished — most likely no Trigger.dev dev worker was running (`npx trigger.dev@latest dev`). Start it and ask for the page again.",
				status: "failed",
			})
			.where(
				and(
					eq(pageGenerationAttempts.projectId, projectId),
					eq(pageGenerationAttempts.status, "generating"),
					lt(
						pageGenerationAttempts.createdAt,
						new Date(Date.now() - PAGE_ATTEMPT_STALE_GENERATING_MS),
					),
				),
			)
			.returning({
				id: pageGenerationAttempts.id,
				projectId: pageGenerationAttempts.projectId,
			});

		for (const failed of staleGenerating) {
			captureGenerationFailed(
				this.analyticsService,
				scope.userId,
				"page",
				failed.projectId,
				failed.id,
				"stale_generation",
			);
		}

		const [latestAttempt] = await this.db
			.select({
				createdAt: pageGenerationAttempts.createdAt,
				error: pageGenerationAttempts.error,
				failureCode: pageGenerationAttempts.failureCode,
				id: pageGenerationAttempts.id,
				status: pageGenerationAttempts.status,
				versionId: pageGenerationAttempts.versionId,
			})
			.from(pageGenerationAttempts)
			.where(eq(pageGenerationAttempts.projectId, projectId))
			.orderBy(desc(pageGenerationAttempts.createdAt))
			.limit(1);

		return {
			activeVersion,
			artifactId: artifact?.id ?? null,
			latestAttempt: latestAttempt ?? null,
		};
	}

	// Find a version only if its project belongs to this user — the join
	// proves ownership, same pattern as ChatsRepository.findOwnedChatById.
	async findAccessibleVersionById(
		scope: ProjectScope,
		versionId: string,
	): Promise<OwnedVersionRow | null> {
		const [row] = await this.db
			.select({
				artifactId: versions.artifactId,
				id: versions.id,
				projectId: versions.projectId,
				r2Key: versions.r2Key,
			})
			.from(versions)
			.innerJoin(projects, eq(projects.id, versions.projectId))
			.where(
				and(
					eq(versions.id, versionId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	// Full version history for the project's landing artifact, newest first,
	// with the live (published) version marked. Returns null when the project
	// is missing or not owned — the caller answers 404.
	async listVersionsForProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<VersionListRow[] | null> {
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!project) {
			return null;
		}

		const [live] = await this.db
			.select({ versionId: deployments.versionId })
			.from(deployments)
			.where(
				and(
					eq(deployments.projectId, projectId),
					eq(deployments.status, "active"),
				),
			)
			.limit(1);

		const rows = await this.db
			.select({
				createdAt: versions.createdAt,
				id: versions.id,
				meta: versions.meta,
				number: versions.number,
			})
			.from(versions)
			.innerJoin(artifacts, eq(artifacts.id, versions.artifactId))
			.where(
				and(
					eq(versions.projectId, projectId),
					eq(artifacts.kind, "landing_page"),
				),
			)
			.orderBy(desc(versions.number));

		return rows.map((row) => ({
			...row,
			isLive: row.id === (live?.versionId ?? null),
		}));
	}

	// What number the NEXT version will get. Advisory only (used for the
	// "Queued: version N" message) — the task recomputes inside its own
	// transaction, which is the authoritative assignment.
	async nextVersionNumber(artifactId: string): Promise<number> {
		const [latest] = await this.db
			.select({ number: versions.number })
			.from(versions)
			.where(eq(versions.artifactId, artifactId))
			.orderBy(desc(versions.number))
			.limit(1);

		return (latest?.number ?? 0) + 1;
	}

	/** Newest builder-origin version. A missing/null source is the legacy
	 *  builder marker; manual, AI-edit, and restore rows are skipped. */
	async findLatestBuilderVersion(
		artifactId: string,
	): Promise<BuilderVersionRow | null> {
		const rows = await this.db
			.select({ id: versions.id, meta: versions.meta, r2Key: versions.r2Key })
			.from(versions)
			.where(eq(versions.artifactId, artifactId))
			.orderBy(desc(versions.number));

		for (const row of rows) {
			const meta =
				typeof row.meta === "object" && row.meta !== null
					? (row.meta as Record<string, unknown>)
					: null;
			const source = meta?.source;

			if (source === "builder" || source === undefined || source === null) {
				return { id: row.id, r2Key: row.r2Key };
			}
		}

		return null;
	}

	/** A placement receipt lives on the immutable ai-edit version it created.
	 * Search history, not only the active pointer: a later user edit must not
	 * make a retried generation overwrite that newer work. */
	async findAiEditVersionByReceipt(
		projectId: string,
		attemptId: string,
	): Promise<{ number: number } | null> {
		const [row] = await this.db
			.select({ number: versions.number })
			.from(versions)
			.innerJoin(artifacts, eq(artifacts.id, versions.artifactId))
			.where(
				and(
					eq(versions.projectId, projectId),
					eq(artifacts.kind, "landing_page"),
					sql`${versions.meta}->>'source' = 'ai-edit'`,
					sql`${versions.meta}->'receipt'->>'kind' = 'image-generation-placement'`,
					sql`${versions.meta}->'receipt'->>'attemptId' = ${attemptId}`,
				),
			)
			.orderBy(desc(versions.number))
			.limit(1);

		return row ?? null;
	}

	// Landing artifact + its active version for an OWNED project, or null when
	// the project is missing/not owned (the service turns that into a 404).
	async findActivePageByProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<ActivePageRow | null> {
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!project) {
			return null;
		}

		return this.findActivePageByProjectUnchecked(projectId);
	}

	// Same shape, ownership already proven — the chat edit tools pass the
	// projectId of a chat the controller's ownership query validated.
	async findActivePageByProjectUnchecked(
		projectId: string,
	): Promise<ActivePageRow | null> {
		const artifact = await this.findLandingArtifact(projectId);

		if (!artifact) {
			return null;
		}

		let version: ActivePageRow["version"] = null;

		if (artifact.activeVersionId) {
			const [row] = await this.db
				.select({
					id: versions.id,
					number: versions.number,
					r2Key: versions.r2Key,
				})
				.from(versions)
				.where(eq(versions.id, artifact.activeVersionId))
				.limit(1);

			version = row ?? null;
		}

		return { artifactId: artifact.id, version };
	}

	/**
	 * Append an immutable version + flip the active pointer atomically.
	 * The caller pre-allocates the version id (the R2 upload happens FIRST —
	 * a version row must never point at an object that does not exist).
	 * expectedActiveVersionId is re-checked INSIDE the transaction under a
	 * row lock; a mismatch throws VersionConflictError instead of silently
	 * winning a last-write race. The version number is recomputed inside the
	 * same transaction (same invariant as the Trigger task) so a concurrent
	 * build completion cannot violate the unique (artifactId, number) index.
	 */
	async insertVersionAndActivate(input: {
		artifactId: string;
		expectedActiveVersionId: string | null;
		meta: Record<string, unknown>;
		projectId: string;
		receipt?: {
			attemptId: string;
			kind: "image-generation-placement";
		};
		r2Key: string;
		versionId: string;
	}): Promise<{
		createdAt: Date;
		existingVersionId?: string;
		number: number;
	}> {
		return this.db.transaction(async (tx) => {
			const [artifact] = await tx
				.select({ activeVersionId: artifacts.activeVersionId })
				.from(artifacts)
				.where(eq(artifacts.id, input.artifactId))
				.limit(1)
				.for("update");

			if (!artifact) {
				throw new Error(`Artifact ${input.artifactId} not found`);
			}

			// The artifact lock serializes receipt lookup with version insertion.
			// A Trigger retry and the polling fallback can therefore converge on
			// the first immutable placement version instead of creating a second.
			if (input.receipt) {
				const [existing] = await tx
					.select({
						createdAt: versions.createdAt,
						id: versions.id,
						number: versions.number,
					})
					.from(versions)
					.where(
						and(
							eq(versions.artifactId, input.artifactId),
							sql`${versions.meta}->>'source' = 'ai-edit'`,
							sql`${versions.meta}->'receipt'->>'kind' = ${input.receipt.kind}`,
							sql`${versions.meta}->'receipt'->>'attemptId' = ${input.receipt.attemptId}`,
						),
					)
					.orderBy(desc(versions.number))
					.limit(1);

				if (existing) {
					return {
						createdAt: existing.createdAt,
						existingVersionId: existing.id,
						number: existing.number,
					};
				}
			}

			if (artifact.activeVersionId !== input.expectedActiveVersionId) {
				throw new VersionConflictError(artifact.activeVersionId);
			}

			const [latest] = await tx
				.select({ number: versions.number })
				.from(versions)
				.where(eq(versions.artifactId, input.artifactId))
				.orderBy(desc(versions.number))
				.limit(1);
			const nextNumber = (latest?.number ?? 0) + 1;

			const [inserted] = await tx
				.insert(versions)
				.values({
					artifactId: input.artifactId,
					id: input.versionId,
					meta: input.meta,
					number: nextNumber,
					projectId: input.projectId,
					r2Key: input.r2Key,
				})
				.returning({ createdAt: versions.createdAt });

			if (!inserted) {
				throw new Error("Version insert did not return a row");
			}

			await tx
				.update(artifacts)
				.set({ activeVersionId: input.versionId })
				.where(eq(artifacts.id, input.artifactId));

			return { createdAt: inserted.createdAt, number: nextNumber };
		});
	}

	/**
	 * Wids the user manually edited since the last AI-produced version
	 * (contract §9): walk versions by number DESC from the active one,
	 * collecting meta.editedWids while source is "inline"/"theme"; stop at
	 * the first "builder"/"ai-edit"/absent source. May include "__tokens__".
	 */
	async collectManualEditTrail(projectId: string): Promise<string[]> {
		const page = await this.findActivePageByProjectUnchecked(projectId);

		if (!page?.version) {
			return [];
		}

		const rows = await this.db
			.select({ id: versions.id, meta: versions.meta })
			.from(versions)
			.where(eq(versions.artifactId, page.artifactId))
			.orderBy(desc(versions.number));

		const wids = new Set<string>();
		let reachedActive = false;

		for (const row of rows) {
			if (!reachedActive) {
				if (row.id !== page.version.id) {
					continue;
				}

				reachedActive = true;
			}

			const meta = (row.meta ?? {}) as {
				editedWids?: unknown;
				source?: unknown;
			};

			if (meta.source !== "inline" && meta.source !== "theme") {
				break;
			}

			if (Array.isArray(meta.editedWids)) {
				for (const wid of meta.editedWids) {
					if (typeof wid === "string") {
						wids.add(wid);
					}
				}
			}
		}

		return [...wids];
	}

	private async findLandingArtifact(
		projectId: string,
	): Promise<LandingArtifactRow | null> {
		const [row] = await this.db
			.select({
				activeVersionId: artifacts.activeVersionId,
				id: artifacts.id,
			})
			.from(artifacts)
			.where(
				and(
					eq(artifacts.projectId, projectId),
					eq(artifacts.kind, "landing_page"),
				),
			)
			.limit(1);

		return row ?? null;
	}
}
