import { extractMediaUrls } from "../modules/connector-generations/domain/extract-media-urls";

type AttemptStatus = "failed" | "queued" | "running" | "succeeded";

/**
 * A provider charge is settled before its attempt becomes user-visible. If
 * that final CAS loses a race, only a durable succeeded row is safe to replay
 * as success. Every other state is surfaced for operator recovery; callers
 * must not compensate already-settled provider work.
 */
export function recoverSettledConnectorCompletion(
	attemptId: string,
	row: { media: unknown; status: AttemptStatus } | null,
): { mediaCount: number; skipped: true } {
	assertSucceededAfterSettlement("Connector generation", attemptId, row);

	return {
		mediaCount: extractMediaUrls(row.media).length,
		skipped: true,
	};
}

/** See {@link recoverSettledConnectorCompletion}. */
export function recoverSettledLeadScrapeCompletion(
	attemptId: string,
	row: { rowCount: number | null; status: AttemptStatus } | null,
): { rowCount: number | null; skipped: true } {
	assertSucceededAfterSettlement("Lead scrape", attemptId, row);

	return { rowCount: row.rowCount, skipped: true };
}

function assertSucceededAfterSettlement<T extends { status: AttemptStatus }>(
	operation: string,
	attemptId: string,
	row: T | null,
): asserts row is T & { status: "succeeded" } {
	if (row?.status === "succeeded") {
		return;
	}

	throw new Error(
		`${operation} ${attemptId} lost its success transition after billing settlement; current status is ${row?.status ?? "missing"}`,
	);
}
