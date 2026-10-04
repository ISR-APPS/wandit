/**
 * HTTP calls of the admin Publications page: the publish log, and the
 * suspend switch of a V2 app. The queries and mutations call them.
 * Each answer goes through its contract schema before the UI reads it.
 */
import {
	adminListPublicationsQuerySchema,
	adminListPublicationsResponseSchema,
	adminPublicationSuspensionResponseSchema,
	adminRoutes,
	adminSuspendPublicationInputSchema,
} from "@wandit/contracts";

import { apiGet, apiPost } from "@/lib/api-client";

import type {
	AdminListPublicationsResponse,
	AdminPublicationSuspensionResponse,
	AdminSuspendPublicationInput,
	ListPublicationsParams,
} from "./publications.dto";

export async function listPublications(
	params: ListPublicationsParams,
): Promise<AdminListPublicationsResponse> {
	const query = adminListPublicationsQuerySchema.parse({
		page: params.page,
		pageSize: params.pageSize,
	});
	const payload = await apiGet<unknown>(adminRoutes.publications, {
		page: query.page,
		pageSize: query.pageSize,
	});

	return adminListPublicationsResponseSchema.parse(payload);
}

/** Takes the V2 app of the project down on every host. Needs publications:suspend. */
export async function suspendPublication(
	projectId: string,
	input: AdminSuspendPublicationInput,
): Promise<AdminPublicationSuspensionResponse> {
	const body = adminSuspendPublicationInputSchema.parse(input);
	const payload = await apiPost<unknown>(
		adminRoutes.suspendPublication(projectId),
		body,
	);

	return adminPublicationSuspensionResponseSchema.parse(payload);
}

/** Serves the V2 app of the project again. Needs publications:suspend. */
export async function unsuspendPublication(
	projectId: string,
): Promise<AdminPublicationSuspensionResponse> {
	const payload = await apiPost<unknown>(
		adminRoutes.unsuspendPublication(projectId),
	);

	return adminPublicationSuspensionResponseSchema.parse(payload);
}
