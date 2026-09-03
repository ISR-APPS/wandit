import {
	adminListPublicationsQuerySchema,
	adminListPublicationsResponseSchema,
	adminRoutes,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type {
	AdminListPublicationsResponse,
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
