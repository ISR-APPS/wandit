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

// What the generate_page tool snapshots into the attempt's jsonb spec.
export type PageAttemptSpec = {
	brief: string;
	designerSystemPrompt: string;
	title: string;
};

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
