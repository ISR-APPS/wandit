// Raw async functions for standalone image generation — NO React in here.
// Parsed at this boundary with the contracts schemas, same rule as every
// other api file in this folder.

import {
	type ImageGenerationAttempt,
	imageGenerationAttemptSchema,
	imageGenerationsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import { getServerUrl } from "@/lib/server-url";

/** One image-generation attempt's live status and final public image URLs. */
export async function getImageGenerationAttempt(
	attemptId: string,
): Promise<ImageGenerationAttempt> {
	const data = await apiClient.get<unknown>(
		imageGenerationsRoutes.attempt(attemptId),
	);
	return imageGenerationAttemptSchema.parse(data);
}

/** Credentialed forced-download endpoint for one image (1-based index). */
export function imageGenerationDownloadUrl(
	attemptId: string,
	index: number,
): string {
	return `${getServerUrl().replace(/\/$/, "")}${imageGenerationsRoutes.download(
		attemptId,
		index,
	)}`;
}
