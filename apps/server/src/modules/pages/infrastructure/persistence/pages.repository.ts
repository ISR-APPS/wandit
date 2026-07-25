/**
 * Database helper for the page domain: landing artifacts, their immutable
 * versions, and page_generation_attempts (the mutable build-status rows).
 *
 * Repository means: keep SQL/database details here, not inside services.
 * Two very different callers share it — the pages HTTP endpoints (reads)
 * and the generate_page chat tool (queue-time writes).
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, lt } from "@wandit/db";
import { artifacts, versions } from "@wandit/db/schema/artifacts";
import { deployments } from "@wandit/db/schema/deployments";
import { pageGenerationAttempts } from "@wandit/db/schema/page-attempts";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

// Small explicit shapes; services map these to contract types.
export type LandingArtifactRow = {
	activeVersionId: string | null;
	id: string;
};

export type OwnedVersionRow = {
	id: string;
	r2Key: string;
};

export type VersionListRow = {
	createdAt: Date;
	id: string;
	isLive: boolean;
	meta: unknown;
	number: number;
};

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
		id: string;
		status: "queued" | "generating" | "succeeded" | "failed";
		versionId: string | null;
	} | null;
};

// What generate_page snapshots into the attempt's jsonb spec.
export type PageAttemptSpec = {
	brief: string;
	designerSystemPrompt: string;
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
	constructor(@Inject(DATABASE) private readonly db: Database) {}

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
	async markAttemptTriggered(attemptId: string, runId: string): Promise<void> {
		await this.db
			.update(pageGenerationAttempts)
			.set({ triggerRunId: runId })
			.where(eq(pageGenerationAttempts.id, attemptId));
	}

	// Used when queueing itself failed — the background task never ran, so
	// somebody has to move the row to a terminal state.
	async markAttemptFailed(attemptId: string, error: string): Promise<void> {
		await this.db
			.update(pageGenerationAttempts)
			.set({ completedAt: new Date(), error, status: "failed" })
			.where(eq(pageGenerationAttempts.id, attemptId));
	}

	// Everything the Page tab polls for, or null when the project is not
	// owned by this user (the service turns that into a 404).
	async findOverviewByProject(
		userId: string,
		projectId: string,
	): Promise<PageOverviewRows | null> {
		// Ownership first: project must belong to the user and not be deleted.
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					eq(projects.userId, userId),
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
		// Trigger.dev's dev TTL (10 min) and will never execute; a "generating"
		// row can strand the same way if the worker is killed mid-run. Left
		// alone, either would keep the Page tab polling forever — flip stale
		// rows to failed so the UI stops waiting and says what happened. The
		// cutoff must exceed the task's maxDuration (30 min), or a slow but
		// healthy build would be flagged failed while still running.
		await this.db
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
					inArray(pageGenerationAttempts.status, ["queued", "generating"]),
					lt(
						pageGenerationAttempts.createdAt,
						new Date(Date.now() - 35 * 60 * 1000),
					),
				),
			);

		const [latestAttempt] = await this.db
			.select({
				createdAt: pageGenerationAttempts.createdAt,
				error: pageGenerationAttempts.error,
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
	async findOwnedVersionById(
		userId: string,
		versionId: string,
	): Promise<OwnedVersionRow | null> {
		const [row] = await this.db
			.select({ id: versions.id, r2Key: versions.r2Key })
			.from(versions)
			.innerJoin(projects, eq(projects.id, versions.projectId))
			.where(
				and(
					eq(versions.id, versionId),
					eq(projects.userId, userId),
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
		userId: string,
		projectId: string,
	): Promise<VersionListRow[] | null> {
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					eq(projects.userId, userId),
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

	// Landing artifact + its active version for an OWNED project, or null when
	// the project is missing/not owned (the service turns that into a 404).
	async findActivePageByProject(
		userId: string,
		projectId: string,
	): Promise<ActivePageRow | null> {
		const [project] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					eq(projects.userId, userId),
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
		r2Key: string;
		versionId: string;
	}): Promise<{ createdAt: Date; number: number }> {
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
