import {
	creditBalanceResponseSchema,
	creditLedgerResponseSchema,
	creditsRoutes,
	workspaceCreditBalancesResponseSchema,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type {
	CreditBalanceResponse,
	CreditLedgerQuery,
	CreditLedgerResponse,
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

export async function getCreditLedger(
	query: CreditLedgerQuery,
): Promise<CreditLedgerResponse> {
	const payload = await ApiService.get<unknown>(creditsRoutes.ledger, {
		query,
	});

	return creditLedgerResponseSchema.parse(payload);
}
