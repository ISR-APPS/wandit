/**
 * Data layer of the desktop builds (docs/v2/desktop-apps.md, section 8).
 * Each function calls one route of `desktopRoutes` through `@/lib/api-client`
 * and parses the answer with its schema from `packages/contracts/src/v2/desktop.ts`.
 * Called by desktop.queries.ts and desktop.mutations.ts.
 */

import {
	type CreateDesktopBuildBody,
	type DesktopBuild,
	type DesktopOverviewResponse,
	desktopBuildSchema,
	desktopOverviewResponseSchema,
	desktopRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/**
 * `GET desktop` answers the desktop identity of the project (null before the
 * first build request) and its newest builds, newest first. The API sends
 * 10 builds by default.
 */
export async function getDesktopOverview(
	projectId: string,
): Promise<DesktopOverviewResponse> {
	const data = await apiClient.get<unknown>(desktopRoutes.overview(projectId));
	return desktopOverviewResponseSchema.parse(data);
}

/**
 * `POST desktop/builds` holds `DESKTOP_BUILD_CREDITS` and queues a build. A
 * retry with the same `requestKey` answers the same build. A live build
 * answers 409 `DESKTOP_BUILD_ACTIVE`, two live builds of the paying account
 * 409 `DESKTOP_BUILD_LIMIT_REACHED`, a project without a saved version 409
 * `DESKTOP_BUILD_NO_VERSION`, a macOS build while macOS builds are off 403
 * `DESKTOP_PLATFORM_UNAVAILABLE`, and a low balance 402.
 */
export async function createDesktopBuild(
	projectId: string,
	body: CreateDesktopBuildBody,
): Promise<DesktopBuild> {
	const data = await apiClient.post<unknown>(
		desktopRoutes.builds(projectId),
		body,
	);
	return desktopBuildSchema.parse(data);
}

/**
 * `POST desktop/builds/:buildId/cancel` stops a live build and releases its
 * held credits. A build that already ended, or that signs, answers as it is.
 */
export async function cancelDesktopBuild(
	projectId: string,
	buildId: string,
): Promise<DesktopBuild> {
	const data = await apiClient.post<unknown>(
		desktopRoutes.cancel(projectId, buildId),
	);
	return desktopBuildSchema.parse(data);
}

/**
 * `POST desktop/builds/:buildId/release` makes one `ready` build the version
 * that installed apps of its platform update to. A build older than the
 * current build of its platform answers 409
 * `DESKTOP_BUILD_OLDER_THAN_CURRENT`, another status 409
 * `DESKTOP_BUILD_NOT_READY`. A release costs no credits.
 */
export async function releaseDesktopBuild(
	projectId: string,
	buildId: string,
): Promise<DesktopBuild> {
	const data = await apiClient.post<unknown>(
		desktopRoutes.release(projectId, buildId),
	);
	return desktopBuildSchema.parse(data);
}
