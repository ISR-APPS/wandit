/**
 * Fetches one page of the credit grant log from the admin API.
 * useCreditGrantsQuery calls it. It calls apiGet and parses the response
 * with the shared contract schema.
 */
import {
	adminListCreditGrantsResponseSchema,
	adminRoutes,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type {
	AdminListCreditGrantsQuery,
	AdminListCreditGrantsResponse,
} from "./credit-grants.dto";

/** Rejects with an ApiClientError on a non-2xx answer or a ZodError on a bad body. */
export async function listCreditGrants(
	query: AdminListCreditGrantsQuery,
): Promise<AdminListCreditGrantsResponse> {
	const payload = await apiGet<unknown>(adminRoutes.creditGrants, query);

	return adminListCreditGrantsResponseSchema.parse(payload);
}
