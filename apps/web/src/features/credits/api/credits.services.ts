import {
	creditBalanceResponseSchema,
	creditLedgerResponseSchema,
	creditsRoutes,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type {
	CreditBalanceResponse,
	CreditLedgerQuery,
	CreditLedgerResponse,
} from "./credits.dto";

export async function getCreditBalance(): Promise<CreditBalanceResponse> {
	const payload = await ApiService.get<unknown>(creditsRoutes.balance);

	return creditBalanceResponseSchema.parse(payload);
}

export async function getCreditLedger(
	query: CreditLedgerQuery,
): Promise<CreditLedgerResponse> {
	const payload = await ApiService.get<unknown>(creditsRoutes.ledger, {
		query,
	});

	return creditLedgerResponseSchema.parse(payload);
}
