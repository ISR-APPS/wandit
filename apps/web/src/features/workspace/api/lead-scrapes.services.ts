// Raw async functions for lead scraping — NO React in here. Thin fetch
// wrappers over the shared api-client; responses parsed with the
// @wandit/contracts Zod schemas so a drifted server shape fails loudly here
// instead of as undefined deeper in the UI.

import {
	type LeadScrapeAttempt,
	leadScrapeAttemptSchema,
	leadScrapesRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import { getServerUrl } from "@/lib/server-url";

/**
 * One attempt's live status — everything the chat card needs. Polled while
 * the attempt is queued/running (see useLeadScrapeAttemptQuery).
 */
export async function getLeadScrapeAttempt(
	attemptId: string,
): Promise<LeadScrapeAttempt> {
	const data = await apiClient.get<unknown>(
		leadScrapesRoutes.attempt(attemptId),
	);
	return leadScrapeAttemptSchema.parse(data);
}

/**
 * Direct href for the workbook download — a plain navigation, not an XHR:
 * the endpoint answers with Content-Disposition so the browser saves the
 * file, and the auth cookie rides the same-site request.
 */
export function leadScrapeDownloadUrl(attemptId: string): string {
	return `${getServerUrl().replace(/\/$/, "")}${leadScrapesRoutes.download(attemptId)}`;
}
