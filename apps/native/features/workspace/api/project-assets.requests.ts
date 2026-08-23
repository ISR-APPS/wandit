// Project assets API calls — the mobile Assets view. Responses are parsed
// with the @wandit/contracts Zod schemas at this boundary, like the web
// services layer.

import {
	type ProjectAsset,
	projectAssetsResponseSchema,
	projectAssetsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";
import { getServerUrl } from "@/shared/lib/server-url";

/** Every AI-generated media asset of one owned project, newest first. */
export async function listProjectAssets(
	projectId: string,
): Promise<ProjectAsset[]> {
	const data = await apiClient.get<unknown>(
		projectAssetsRoutes.list(projectId),
	);
	return projectAssetsResponseSchema.parse(data).assets;
}

/**
 * Absolute href of the ownership-checked forced download. The phone has no
 * cookie jar, so downloadAndShareMedia sends the session cookie by hand —
 * same flow as the lead-scrape workbook and chat media downloads.
 */
export function projectAssetDownloadUrl(
	projectId: string,
	key: string,
): string {
	return `${getServerUrl().replace(/\/$/, "")}${projectAssetsRoutes.download(
		projectId,
		key,
	)}`;
}
