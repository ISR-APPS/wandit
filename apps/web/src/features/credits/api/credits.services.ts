import {
	creditActivityResponseSchema,
	creditBalanceResponseSchema,
	creditsRoutes,
	workspaceCreditBalancesResponseSchema,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type {
	CreditActivityQuery,
	CreditActivityResponse,
	CreditBalanceResponse,
	WorkspaceCreditBalancesResponse,
} from "./credits.dto";

export async function getCreditBalance(): Promise<CreditBalanceResponse> {
	const payload = await ApiService.get<unknown>(creditsRoutes.balance);

	return creditBalanceResponseSchema.parse(payload);
}

export async function getWorkspaceCreditBalances(): Promise<WorkspaceCreditBalancesResponse> {
	const payload = await ApiService.get<unknown>(creditsRoutes.balances);

	return workspaceCreditBalancesResponseSchema.parse(payload);
}

/** One net row per operation; reserve/settle/reconcile ledger rows stay hidden. */
export async function getCreditActivity(
	query: CreditActivityQuery,
): Promise<CreditActivityResponse> {
	const payload = await ApiService.get<unknown>(creditsRoutes.activity, {
		query,
	});

	return creditActivityResponseSchema.parse(payload);
}
