import {
	type CreditBalanceResponse,
	creditBalanceResponseSchema,
	creditsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";

/** Load the server-owned balance; native never keeps a parallel credit ledger. */
export async function getCreditBalance(): Promise<CreditBalanceResponse> {
	const data = await apiClient.get<unknown>(creditsRoutes.balance);
	return creditBalanceResponseSchema.parse(data);
}
