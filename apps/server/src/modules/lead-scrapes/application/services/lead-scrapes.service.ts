// Read side of lead scraping: the attempt status the chat card polls, and
// the finished workbook download. The controller receives HTTP, this service
// decides the steps, and the repository talks to the database. R2 access
// goes through the plain storage module (no Nest wrapper) because the
// Trigger.dev task shares it.
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { runs } from "@trigger.dev/sdk";
import {
	LEAD_SCRAPE_FAILED_REFUNDED_TEXT,
	type LeadScrapeAttempt,
	leadScrapePreviewRowSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { z } from "zod";

import { getObjectBytes } from "../../../../infrastructure/storage/r2";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import { leadScrapeSpecSchema } from "../../domain/lead-scrape-spec";
import {
	type LeadScrapeAttemptRow,
	LeadScrapesRepository,
} from "../../infrastructure/persistence/lead-scrapes.repository";
import {
	leadScrapeMeteringKey,
	recordedSerperPages,
	refundLeadScrapeUsageIfReserved,
} from "./lead-scrape-billing";

const previewRowsSchema = z.array(leadScrapePreviewRowSchema);
const PROJECT_LIST_LIMIT = 20;

export type LeadScrapeDownload = {
	bytes: Uint8Array;
	fileName: string;
};

@Injectable()
export class LeadScrapesService {
	private readonly logger = new Logger(LeadScrapesService.name);

	constructor(
		@Inject(LeadScrapesRepository)
		private readonly leadScrapesRepository: LeadScrapesRepository,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
	) {}

	// One request answers "what should the chat card show right now?".
	async attempt(
		scope: ProjectScope,
		attemptId: string,
	): Promise<LeadScrapeAttempt> {
		const row = await this.leadScrapesRepository.findAccessibleAttempt(
			scope,
			attemptId,
		);

		// Missing and not-owned both become 404 — never reveal which.
		if (!row) {
			throw new NotFoundException();
		}

		return mapAttemptRow(await this.settleDeadRun(scope, row));
	}

	async listByProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<LeadScrapeAttempt[]> {
		const rows = await this.leadScrapesRepository.listForProject(
			scope,
			projectId,
			PROJECT_LIST_LIMIT,
		);

		// LIMIT: up to 20 run lookups per list read. Upgrade: settle in a scheduled task.
		const settled = await Promise.all(
			rows.map((row) => this.settleDeadRun(scope, row)),
		);

		return settled.map(mapAttemptRow);
	}

	countByProject(scope: ProjectScope, projectId: string): Promise<number> {
		return this.leadScrapesRepository.countForProject(scope, projectId);
	}

	/**
	 * A platform-killed run (OOM, worker crash) dies before the task's catch
	 * can write terminal state, so the row stays queued/running while its run
	 * is long dead. Confirm the linked run is settled, fail the row, and
	 * refund its credit hold — the 38-min stale sweep only catches rows that
	 * never got a run id. A no-op whenever the run may still be alive.
	 */
	private async settleDeadRun(
		scope: ProjectScope,
		row: LeadScrapeAttemptRow,
	): Promise<LeadScrapeAttemptRow> {
		if (
			(row.status !== "queued" && row.status !== "running") ||
			!row.triggerRunId ||
			!env.TRIGGER_SECRET_KEY
		) {
			return row;
		}

		try {
			const run = await runs.retrieve(row.triggerRunId);

			if (
				!(
					run.isFailed ||
					run.isCancelled ||
					(run.isCompleted && !run.isSuccess)
				)
			) {
				return row;
			}
		} catch (error) {
			// Unknown run state — never settle a row that may still be running.
			this.logger.warn(
				`Run lookup for lead scrape ${row.id} failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return row;
		}

		// The CAS on status + run id makes a second reader's settle a no-op.
		const settled = await this.leadScrapesRepository.settleDeadRun(
			row.id,
			row.triggerRunId,
			LEAD_SCRAPE_FAILED_REFUNDED_TEXT,
		);

		if (settled) {
			try {
				const subject = meteringSubjectFrom(scope);
				const event = await this.meteringService.findByIdempotencyKey(
					leadScrapeMeteringKey(row.id),
					subject,
				);

				if (event) {
					// refundLeadScrapeUsageIfReserved skips an event that already
					// left "reserved", so a settled/refunded hold cannot double-refund.
					const serperPages = await recordedSerperPages(this.meteringService, {
						attemptId: row.id,
						eventId: event.id,
					});
					await refundLeadScrapeUsageIfReserved(this.meteringService, {
						attemptId: row.id,
						eventId: event.id,
						serperPages,
						subject,
					});
				}
			} catch (refundError) {
				// The row is already failed; a stranded hold is released by the
				// metering sweep — do not mask the user's result with this error.
				this.logger.error(
					`Refund for dead-run lead scrape ${row.id} failed: ${
						refundError instanceof Error
							? refundError.message
							: String(refundError)
					}`,
				);
			}
		}

		// Re-read so the response shows the row's own truth, not a guess.
		return (
			(await this.leadScrapesRepository.findAccessibleAttempt(scope, row.id)) ??
			row
		);
	}

	// The finished workbook, ownership-checked. Only a succeeded attempt has
	// an object to serve; anything else is a 404, not an error payload.
	async download(
		scope: ProjectScope,
		attemptId: string,
	): Promise<LeadScrapeDownload> {
		const row = await this.leadScrapesRepository.findAccessibleAttempt(
			scope,
			attemptId,
		);

		if (row?.status !== "succeeded" || !row.r2Key || !row.fileName) {
			throw new NotFoundException();
		}

		const bytes = await getObjectBytes(row.r2Key);

		// Row exists but the object is gone (or R2 unconfigured mid-flight).
		if (!bytes) {
			throw new NotFoundException();
		}

		return { bytes, fileName: row.fileName };
	}
}

// Map the DB row (Date, unvalidated jsonb) to the contract shape (ISO
// strings, parsed spec/preview). Defensive parses: a malformed old spec must
// degrade the label, never 500 the poll.
function mapAttemptRow(row: LeadScrapeAttemptRow): LeadScrapeAttempt {
	const spec = leadScrapeSpecSchema.safeParse(row.spec);
	const previewRows = previewRowsSchema.safeParse(row.previewRows);

	return {
		columnCount: row.columnCount,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		fileName: row.fileName,
		fileSize: row.fileSize,
		foundCount: row.foundCount,
		id: row.id,
		location: spec.success ? spec.data.location : null,
		previewRows: previewRows.success ? previewRows.data : [],
		progress: clampProgress(row.progress),
		query: spec.success ? spec.data.query : "",
		rowCount: row.rowCount,
		sources: spec.success ? spec.data.sources : [],
		stage: row.stage,
		status: row.status,
	};
}

function clampProgress(progress: number): number {
	return Math.min(100, Math.max(0, Math.round(progress)));
}
