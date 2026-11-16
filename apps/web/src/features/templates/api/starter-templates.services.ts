/**
 * Data layer of the starter templates feature. It has one call: the create
 * of a V2 project from a starter template. The catalog needs no call; it is
 * a static import from packages/contracts.
 * Called by starter-templates.mutations.ts. Calls `@/lib/api-client`.
 */

import {
	appBuilderRoutes,
	createAppProjectResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";
import type {
	CreateAppProjectFromStarterTemplateRequest,
	CreateAppProjectResponse,
} from "./dto";

/**
 * `POST /api/v2/projects/from-starter-template`. The API creates the project
 * and starts the apply step. No turn runs, so `turnId` is null in the answer.
 * Errors propagate: the hook maps a 402 to the credits dialog.
 */
export async function createProjectFromStarterTemplate(
	body: CreateAppProjectFromStarterTemplateRequest,
): Promise<CreateAppProjectResponse> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.createProjectFromStarterTemplate,
		body,
	);
	return createAppProjectResponseSchema.parse(data);
}
