/**
 * Data layer of the builder Thème sheet: the theme GET, PUT, and design POST of a project.
 * Each function calls the route through `@/lib/api-client` and parses the answer with contracts.
 * The contracts theme module holds the large look catalog, so only lazy code imports this file:
 * the queryFn of `appThemeQuery` and theme.mutations.ts, which only the lazy Thème sheet calls.
 */

import { appBuilderRoutes } from "@wandit/contracts";
import {
	type DesignAppThemeBody,
	type DesignAppThemeResponse,
	designAppThemeResponseSchema,
	type GetAppThemeResponse,
	getAppThemeResponseSchema,
	type PutAppThemeBody,
	type PutAppThemeResponse,
	putAppThemeResponseSchema,
} from "@wandit/contracts/v2/app-theme";

import { apiClient } from "@/lib/api-client";

/**
 * `GET /api/v2/projects/:id/theme`: the saved theme.json, the card of its world, the head it comes
 * from, and `editable`. A 409 PREVIEW_NOT_RUNNING means the project has no version yet.
 */
export async function getAppTheme(
	projectId: string,
): Promise<GetAppThemeResponse> {
	const data = await apiClient.get<unknown>(appBuilderRoutes.theme(projectId));
	return getAppThemeResponseSchema.parse(data);
}

/**
 * `PUT /api/v2/projects/:id/theme`: the server resolves the selection, writes theme.json, and makes
 * a "theme" commit. A 409 carries BUILDER_TURN_RUNNING, BUILDER_TURN_WAITING, PREVIEW_NOT_RUNNING,
 * or THEME_HEAD_MOVED; the error propagates to the sheet.
 */
export async function saveAppTheme(
	projectId: string,
	body: PutAppThemeBody,
): Promise<PutAppThemeResponse> {
	const data = await apiClient.put<unknown>(
		appBuilderRoutes.theme(projectId),
		body,
	);
	return putAppThemeResponseSchema.parse(data);
}

/**
 * `POST /api/v2/projects/:id/theme/design`: the designer model makes a whole theme.json from the words of
 * the user. It saves nothing and costs credits. Errors: 402 INSUFFICIENT_CREDITS, 429 RATE_LIMITED,
 * 502 THEME_DESIGN_FAILED, 503 THEME_DESIGN_UNAVAILABLE. The error propagates to the sheet.
 */
export async function designAppTheme(
	projectId: string,
	body: DesignAppThemeBody,
): Promise<DesignAppThemeResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.themeDesign(projectId),
		body,
	);
	return designAppThemeResponseSchema.parse(data);
}
