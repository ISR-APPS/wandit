/**
 * Data layer of the Security panel of the More view. Calls
 * `GET /api/v2/projects/:id/security-scans/latest` through `@/lib/api-client`
 * and parses the answer with its contracts schema.
 * Called by security-scan.queries.ts.
 */

import {
	type LatestSecurityScanResponse,
	latestSecurityScanResponseSchema,
	securityScanRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * The newest finished scan of the project, or `scan: null` before the first
 * one. Editors only: a viewer gets 403. `get` is a parameter so a spec can
 * inject a fake client.
 */
export async function getLatestSecurityScan(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<LatestSecurityScanResponse> {
	const data = await get<unknown>(securityScanRoutes.latest(projectId));
	return latestSecurityScanResponseSchema.parse(data);
}
