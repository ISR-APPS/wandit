// Publishing API calls. Every response is parsed by @wandit/contracts before
// reaching React. Read endpoints degrade to the never-published shape on
// 404/501 (endpoint or data not there yet) instead of crashing the screen —
// the same tolerance the web services apply. 401 always propagates.

import {
	type Deployment,
	type DeploymentCurrent,
	deploymentCurrentResponseSchema,
	deploymentsRoutes,
	listDeploymentsResponseSchema,
	type PublishDeploymentBody,
	type PublishDeploymentResponse,
	publishDeploymentResponseSchema,
	type RollbackDeploymentBody,
	type SlugAvailabilityResponse,
	slugAvailabilityResponseSchema,
} from "@wandit/contracts";

import { apiClient, isApiClientError } from "@/shared/lib/api-client";

const NEVER_PUBLISHED: DeploymentCurrent = {
	activeDeploymentId: null,
	error: null,
	liveUrl: null,
	pendingVersionId: null,
	publishedAt: null,
	publishedVersionId: null,
	slug: null,
	uiState: "draft",
};

export async function getDeploymentCurrent(
	projectId: string,
): Promise<DeploymentCurrent> {
	try {
		const data = await apiClient.get<unknown>(
			deploymentsRoutes.current(projectId),
		);
		return deploymentCurrentResponseSchema.parse(data).current;
	} catch (error) {
		if (isReadEndpointPendingError(error)) return NEVER_PUBLISHED;
		throw error;
	}
}

export async function listDeployments(
	projectId: string,
): Promise<Deployment[]> {
	try {
		const data = await apiClient.get<unknown>(
			deploymentsRoutes.listByProject(projectId),
		);
		return listDeploymentsResponseSchema.parse(data).deployments;
	} catch (error) {
		if (isReadEndpointPendingError(error)) return [];
		throw error;
	}
}

export async function getSlugAvailability(
	projectId: string,
	slug: string,
): Promise<SlugAvailabilityResponse> {
	const data = await apiClient.get<unknown>(
		deploymentsRoutes.slugAvailability(projectId),
		{ query: { slug } },
	);
	return slugAvailabilityResponseSchema.parse(data);
}

/**
 * Publish runs the whole pipeline inside the POST and answers with the
 * SETTLED state. The body may pin the immutable version to ship and carry a
 * slug choice; both omitted → the server publishes the current draft head
 * under the live (or generated) slug.
 */
export async function publishDeployment(
	projectId: string,
	body: PublishDeploymentBody = {},
): Promise<PublishDeploymentResponse> {
	const data = await apiClient.post<unknown>(
		deploymentsRoutes.publish(projectId),
		body,
	);
	return publishDeploymentResponseSchema.parse(data);
}

export async function unpublishDeployment(
	projectId: string,
): Promise<DeploymentCurrent> {
	const data = await apiClient.delete<unknown>(
		deploymentsRoutes.unpublish(projectId),
	);
	return deploymentCurrentResponseSchema.parse(data).current;
}

/** A rollback is a normal publish of a historical deployment's bytes; the
 * server keeps the current live slug. */
export async function rollbackDeployment(
	projectId: string,
	body: RollbackDeploymentBody,
): Promise<PublishDeploymentResponse> {
	const data = await apiClient.post<unknown>(
		deploymentsRoutes.rollback(projectId),
		body,
	);
	return publishDeploymentResponseSchema.parse(data);
}

function isReadEndpointPendingError(error: unknown): boolean {
	return (
		isApiClientError(error) &&
		(error.statusCode === 404 || error.statusCode === 501)
	);
}
