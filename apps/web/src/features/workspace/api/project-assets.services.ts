// Raw async functions for the Assets tab — NO React in here. Responses are
// parsed with the @wandit/contracts Zod schemas at this boundary.

import {
	type ProjectAsset,
	projectAssetsResponseSchema,
	projectAssetsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import { getServerUrl } from "@/lib/server-url";

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
 * Direct href for the forced download — a plain navigation with the auth
 * cookie on the same-site request; the server re-validates the key against
 * the project's own asset prefixes.
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
