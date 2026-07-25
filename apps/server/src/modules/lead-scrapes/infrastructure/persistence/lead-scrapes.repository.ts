/**
 * Database helper for lead-scrape attempts (the mutable status rows behind
 * the chat's "Scraping leads" card).
 *
 * Two very different callers share it — the scrape_leads chat tool (queue-
 * time writes) and the lead-scrapes HTTP endpoints (polled reads + the
 * download). The Trigger.dev task does NOT use this class: it runs outside
 * Nest and talks to the same table through createDb(), like the page task.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, lt } from "@wandit/db";
import { leadScrapeAttempts } from "@wandit/db/schema/lead-scrape-attempts";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { LeadScrapeSpec } from "../../domain/lead-scrape-spec";

// Small explicit shape; the service maps it to the contract type.
export type LeadScrapeAttemptRow = {
	id: string;
	projectId: string;
	status: "queued" | "running" | "succeeded" | "failed";
	stage: "queued" | "searching" | "extracting" | "verifying" | "exporting";
	progress: number;
	spec: unknown;
	foundCount: number;
	rowCount: number | null;
	columnCount: number | null;
	fileName: string | null;
	fileSize: number | null;
	r2Key: string | null;
	previewRows: unknown;
	error: string | null;
	createdAt: Date;
	completedAt: Date | null;
};

// Column map shared by both readers so the row shape stays consistent.
const ATTEMPT_COLUMNS = {
	columnCount: leadScrapeAttempts.columnCount,
	completedAt: leadScrapeAttempts.completedAt,
	createdAt: leadScrapeAttempts.createdAt,
	error: leadScrapeAttempts.error,
	fileName: leadScrapeAttempts.fileName,
	fileSize: leadScrapeAttempts.fileSize,
	foundCount: leadScrapeAttempts.foundCount,
	id: leadScrapeAttempts.id,
	previewRows: leadScrapeAttempts.previewRows,
	progress: leadScrapeAttempts.progress,
	projectId: leadScrapeAttempts.projectId,
	r2Key: leadScrapeAttempts.r2Key,
	rowCount: leadScrapeAttempts.rowCount,
	spec: leadScrapeAttempts.spec,
	stage: leadScrapeAttempts.stage,
	status: leadScrapeAttempts.status,
} as const;

@Injectable()
export class LeadScrapesRepository {
	// DATABASE is the Nest token for the Drizzle database connection.
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	// One attempt row per scrape_leads call, born "queued".
	async insertAttempt(input: {
		chatId: string;
		projectId: string;
		spec: LeadScrapeSpec;
	}): Promise<{ id: string }> {
		const [row] = await this.db
			.insert(leadScrapeAttempts)
			.values(input)
			.returning({ id: leadScrapeAttempts.id });

		// Defensive guard: insert should always return one row.
		if (!row) {
			throw new Error("Lead scrape attempt insert did not return a row");
		}

		return row;
	}

	// Link the attempt to its Trigger.dev run once the queue accepted it.
	async markAttemptTriggered(attemptId: string, runId: string): Promise<void> {
		await this.db
			.update(leadScrapeAttempts)
			.set({ triggerRunId: runId })
			.where(eq(leadScrapeAttempts.id, attemptId));
	}

	// Used when queueing itself failed — the background task never ran, so
	// somebody has to move the row to a terminal state.
	async markAttemptFailed(attemptId: string, error: string): Promise<void> {
		await this.db
			.update(leadScrapeAttempts)
			.set({ completedAt: new Date(), error, status: "failed" })
			.where(eq(leadScrapeAttempts.id, attemptId));
	}

	// The chat card's polled read, or null when the attempt's project is not
	// owned by this user (the service turns that into a 404). The join proves
	// ownership, same pattern as PagesRepository.findOwnedVersionById.
	async findOwnedAttempt(
		userId: string,
		attemptId: string,
	): Promise<LeadScrapeAttemptRow | null> {
		// Self-heal on read: a "queued" run nobody picked up expires after
		// Trigger.dev's dev TTL, and a "running" row can strand if the worker
		// dies mid-run. Flip stale rows to failed so the card stops polling —
		// the cutoff must exceed the task's maxDuration (30 min).
		await this.db
			.update(leadScrapeAttempts)
			.set({
				completedAt: new Date(),
				error:
					"The scrape never finished — most likely no Trigger.dev dev worker " +
					"was running (`npx trigger.dev@latest dev`). Start it and ask for " +
					"the leads again.",
				status: "failed",
			})
			.where(
				and(
					eq(leadScrapeAttempts.id, attemptId),
					inArray(leadScrapeAttempts.status, ["queued", "running"]),
					lt(
						leadScrapeAttempts.createdAt,
						new Date(Date.now() - 35 * 60 * 1000),
					),
				),
			);

		const [row] = await this.db
			.select(ATTEMPT_COLUMNS)
			.from(leadScrapeAttempts)
			.innerJoin(projects, eq(projects.id, leadScrapeAttempts.projectId))
			.where(
				and(
					eq(leadScrapeAttempts.id, attemptId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}
}
