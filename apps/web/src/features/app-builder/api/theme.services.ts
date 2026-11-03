/**
 * Data layer of the builder Thème sheet: the theme GET and the theme PUT of a project.
 * Each function calls the route through `@/lib/api-client` and parses the answer with contracts.
 * The contracts theme module holds the 74 KB look catalog, so only lazy code imports this file:
 * the queryFn of `appThemeQuery` and theme.mutations.ts, which only the lazy Thème sheet calls.
 */

import { appBuilderRoutes } from "@wandit/contracts";
import {
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
