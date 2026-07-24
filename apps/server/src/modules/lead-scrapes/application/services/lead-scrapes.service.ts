// Read side of lead scraping: the attempt status the chat card polls, and
// the finished workbook download. The controller receives HTTP, this service
// decides the steps, and the repository talks to the database. R2 access
// goes through the plain storage module (no Nest wrapper) because the
// Trigger.dev task shares it.
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	type LeadScrapeAttempt,
	leadScrapePreviewRowSchema,
} from "@wandit/contracts";
import { z } from "zod";

import { getObjectBytes } from "../../../../infrastructure/storage/r2";
import { leadScrapeSpecSchema } from "../../domain/lead-scrape-spec";
import {
	type LeadScrapeAttemptRow,
	LeadScrapesRepository,
} from "../../infrastructure/persistence/lead-scrapes.repository";

const previewRowsSchema = z.array(leadScrapePreviewRowSchema);

export type LeadScrapeDownload = {
	bytes: Uint8Array;
	fileName: string;
};

@Injectable()
export class LeadScrapesService {
	constructor(
		@Inject(LeadScrapesRepository)
		private readonly leadScrapesRepository: LeadScrapesRepository,
	) {}

	// One request answers "what should the chat card show right now?".
	async attempt(userId: string, attemptId: string): Promise<LeadScrapeAttempt> {
		const row = await this.leadScrapesRepository.findOwnedAttempt(
			userId,
			attemptId,
		);

		// Missing and not-owned both become 404 — never reveal which.
		if (!row) {
			throw new NotFoundException();
		}

		return mapAttemptRow(row);
	}

	// The finished workbook, ownership-checked. Only a succeeded attempt has
	// an object to serve; anything else is a 404, not an error payload.
	async download(
		userId: string,
		attemptId: string,
	): Promise<LeadScrapeDownload> {
		const row = await this.leadScrapesRepository.findOwnedAttempt(
			userId,
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
