/**
 * Data layer of the AI panel of the More view: the app AI gateway of one
 * project. Each function calls one route under `/api/v2/projects/:id/ai`
 * through `@/lib/api-client` and parses the answer with its contracts schema.
 * Called by app-ai.queries.ts and app-ai.mutations.ts.
 */

import {
	type AppAiStatus,
	appAiStatusSchema,
	appBuilderRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/** `GET ai` answers the gateway state, the month usage, and the models. Never the key. */
export async function getAppAiStatus(projectId: string): Promise<AppAiStatus> {
	const data = await apiClient.get<unknown>(appBuilderRoutes.appAi(projectId));
	return appAiStatusSchema.parse(data);
}

/**
 * `PUT ai/key` turns the gateway on. It keeps a live key, pushes it to the
 * backend, and answers the status. No active backend answers 409
 * `BACKEND_NOT_READY` or `BACKEND_PAUSED`.
 */
export async function enableAppAi(projectId: string): Promise<AppAiStatus> {
	const data = await apiClient.put<unknown>(
		appBuilderRoutes.appAiKey(projectId),
	);
	return appAiStatusSchema.parse(data);
}

/**
 * `POST ai/key/rotate` replaces the key, pushes it to the backend, and
 * answers the status. The old key stops at once. Same 409 codes as enable.
 */
export async function rotateAppAiKey(projectId: string): Promise<AppAiStatus> {
	const data = await apiClient.post<unknown>(
		appBuilderRoutes.appAiKeyRotate(projectId),
	);
	return appAiStatusSchema.parse(data);
}

/** `DELETE ai/key` deletes the key and answers 204, also when no key exists. */
export async function disableAppAi(projectId: string): Promise<void> {
	await apiClient.delete(appBuilderRoutes.appAiKey(projectId));
}
