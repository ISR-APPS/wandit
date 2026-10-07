/**
 * Data layer of the Android APK builds (WANDIT-194). Each function calls one
 * route under `/api/v2/projects/:id/mobile-builds` through `@/lib/api-client`
 * and parses the answer with its schema from `packages/contracts/src/v2/mobile-builds.ts`.
 * Called by mobile-builds.queries.ts and mobile-builds.mutations.ts. The last
 * parameter of each function is the client method, so a spec injects a fake.
 */

import {
	type CreateMobileBuildBody,
	type ListMobileBuildsResponse,
	listMobileBuildsResponseSchema,
	type MobileBuild,
	mobileBuildRoutes,
	mobileBuildSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * `GET mobile-builds` answers the newest `limit` builds of the project,
 * newest first. The API caps `limit` at 50.
 */
export async function listMobileBuilds(
	projectId: string,
	limit: number,
	get: typeof apiClient.get = apiClient.get,
): Promise<ListMobileBuildsResponse> {
	const data = await get<unknown>(mobileBuildRoutes.list(projectId), {
		query: { limit },
	});
	return listMobileBuildsResponseSchema.parse(data);
}

/**
 * `POST mobile-builds` holds `MOBILE_BUILD_ANDROID_CREDITS` and queues a
 * build. A retry with the same `requestKey` answers the same build. A live
 * build answers 409 `MOBILE_BUILD_ACTIVE`, and a low balance answers 402.
 */
export async function createMobileBuild(
	projectId: string,
	body: CreateMobileBuildBody,
	post: typeof apiClient.post = apiClient.post,
): Promise<MobileBuild> {
	const data = await post<unknown>(mobileBuildRoutes.list(projectId), body);
	return mobileBuildSchema.parse(data);
}

/**
 * `POST mobile-builds/:buildId/cancel` stops a live build and refunds its
 * credits. A build that already ended answers as it is.
 */
export async function cancelMobileBuild(
	projectId: string,
	buildId: string,
	post: typeof apiClient.post = apiClient.post,
): Promise<MobileBuild> {
	const data = await post<unknown>(
		mobileBuildRoutes.cancel(projectId, buildId),
	);
	return mobileBuildSchema.parse(data);
}
