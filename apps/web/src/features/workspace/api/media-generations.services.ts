// Raw async functions for standalone media generation — NO React in here.
// The response is parsed at this boundary so a drifted server payload cannot
// leak into the chat renderer as a half-populated video card.

import {
	type MediaGenerationAttempt,
	mediaGenerationAttemptSchema,
	mediaGenerationsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import { getServerUrl } from "@/lib/server-url";

/** One image-animation attempt's live status and final public media URLs. */
export async function getMediaGenerationAttempt(
	attemptId: string,
): Promise<MediaGenerationAttempt> {
	const data = await apiClient.get<unknown>(
		mediaGenerationsRoutes.attempt(attemptId),
	);
	return mediaGenerationAttemptSchema.parse(data);
}

/** Absolute, credentialed download endpoint for split web/API deployments. */
export function mediaGenerationDownloadUrl(attemptId: string): string {
	return `${getServerUrl().replace(/\/$/, "")}${mediaGenerationsRoutes.download(
		attemptId,
	)}`;
}
