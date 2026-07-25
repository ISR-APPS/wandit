// Raw publishing API functions. Thin wrappers over ApiService, with every
// response parsed by @wandit/contracts before reaching React.

import {
	type DeploymentCurrent,
	deploymentCurrentResponseSchema,
	deploymentsRoutes,
	listDeploymentsResponseSchema,
	publishDeploymentResponseSchema,
	slugAvailabilityResponseSchema,
} from "@wandit/contracts";

import { ApiService, isApiClientError } from "@/lib/api-client";
import type {
	Deployment,
	PublishDeploymentBody,
	PublishDeploymentResponse,
	RollbackDeploymentBody,
	SlugAvailabilityResponse,
} from "./deployments.dto";

// A project that has never been published — also the safe fallback while the
// read endpoints are still rolling out (404/501 must not crash the workspace).
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
		const payload = await ApiService.get<unknown>(
			deploymentsRoutes.current(projectId),
			{ skipAuthRedirect: true },
		);

		return deploymentCurrentResponseSchema.parse(payload).current;
	} catch (error) {
		if (isReadEndpointPendingError(error)) {
			return NEVER_PUBLISHED;
		}

		throw error;
	}
}

export async function listDeployments(
	projectId: string,
): Promise<Deployment[]> {
	try {
		const payload = await ApiService.get<unknown>(
			deploymentsRoutes.listByProject(projectId),
			{ skipAuthRedirect: true },
		);

		return listDeploymentsResponseSchema.parse(payload).deployments;
	} catch (error) {
		if (isReadEndpointPendingError(error)) {
			return [];
		}

		throw error;
	}
}

export async function getSlugAvailability(
	projectId: string,
	slug: string,
): Promise<SlugAvailabilityResponse> {
	const payload = await ApiService.get<unknown>(
		deploymentsRoutes.slugAvailability(projectId),
		{ query: { slug }, skipAuthRedirect: true },
	);

	return slugAvailabilityResponseSchema.parse(payload);
}

export async function publishDeployment(
	projectId: string,
	body: PublishDeploymentBody,
): Promise<PublishDeploymentResponse> {
	const payload = await ApiService.post<unknown, PublishDeploymentBody>(
		deploymentsRoutes.publish(projectId),
		body,
	);

	return publishDeploymentResponseSchema.parse(payload);
}

export async function unpublishDeployment(
	projectId: string,
): Promise<DeploymentCurrent> {
	const payload = await ApiService.delete<unknown>(
		deploymentsRoutes.unpublish(projectId),
	);

	return deploymentCurrentResponseSchema.parse(payload).current;
}

export async function rollbackDeployment(
	projectId: string,
	body: RollbackDeploymentBody,
): Promise<PublishDeploymentResponse> {
	const payload = await ApiService.post<unknown, RollbackDeploymentBody>(
		deploymentsRoutes.rollback(projectId),
		body,
	);

	return publishDeploymentResponseSchema.parse(payload);
}

// 404/501 mean "endpoint or data not there yet" for read surfaces; render
// the never-published state instead of crashing. 401 must always propagate.
function isReadEndpointPendingError(error: unknown): boolean {
	return (
		isApiClientError(error) &&
		(error.statusCode === 404 || error.statusCode === 501)
	);
}
