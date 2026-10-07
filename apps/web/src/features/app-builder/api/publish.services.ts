/**
 * Data layer of the web app publish (WANDIT-178). Each function calls one
 * route under `/api/v2/projects/:id/publish` through `@/lib/api-client` and
 * parses the answer with its schema from `packages/contracts/src/v2/app-publish.ts`.
 * Called by publish.queries.ts and publish.mutations.ts. The last parameter
 * of each function is the client method, so a spec injects a fake.
 */

import {
	type AppBuild,
	type AppPublishStatus,
	appBuildSchema,
	appPublishRoutes,
	appPublishStatusSchema,
	type OverridePublishGateBody,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

/** `GET publish` answers the live app, the newest attempt, and the history. */
export async function getAppPublishStatus(
	projectId: string,
	get: typeof apiClient.get = apiClient.get,
): Promise<AppPublishStatus> {
	const data = await get<unknown>(appPublishRoutes.publish(projectId));
	return appPublishStatusSchema.parse(data);
}

/**
 * `POST publish` queues a build of the saved head. A retry with the same
 * `requestKey` answers the same build. A running publish answers 409
 * `PUBLISH_ACTIVE`.
 */
export async function publishApp(
	projectId: string,
	requestKey: string,
	post: typeof apiClient.post = apiClient.post,
): Promise<AppBuild> {
	const data = await post<unknown>(appPublishRoutes.publish(projectId), {
		requestKey,
	});
	return appBuildSchema.parse(data);
}

/** `POST publish/rollback` queues an upload of the stored output of an earlier deployment. */
export async function rollbackApp(
	projectId: string,
	input: { deploymentId: string; requestKey: string },
	post: typeof apiClient.post = apiClient.post,
): Promise<AppBuild> {
	const data = await post<unknown>(appPublishRoutes.rollback(projectId), input);
	return appBuildSchema.parse(data);
}

/** `DELETE publish` takes the app down and answers the new status. */
export async function unpublishApp(
	projectId: string,
	remove: typeof apiClient.delete = apiClient.delete,
): Promise<AppPublishStatus> {
	const data = await remove<unknown>(appPublishRoutes.publish(projectId));
	return appPublishStatusSchema.parse(data);
}

/**
 * `POST publish/override` ("Publish anyway") builds the commit of a blocked
 * attempt again past its overridable findings. The API answers 403 to a
 * viewer who did not create the project.
 */
export async function overridePublishGate(
	projectId: string,
	input: OverridePublishGateBody,
	post: typeof apiClient.post = apiClient.post,
): Promise<AppBuild> {
	const data = await post<unknown>(appPublishRoutes.override(projectId), input);
	return appBuildSchema.parse(data);
}
