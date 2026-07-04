import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreditBalanceResponse,
	type CreditLedgerQuery,
	type CreditLedgerResponse,
	creditLedgerQuerySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { CreditsService } from "../../../application/services/credits.service";
import { mapCreditLedgerPage } from "../../../infrastructure/mappers/credit-ledger.mapper";

@Controller("v1/credits")
export class CreditsController {
	constructor(
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
	) {}

	@Get("balance")
	getBalance(@CurrentUser() user: AuthUser): Promise<CreditBalanceResponse> {
		return this.creditsService.getBalance(user.id);
	}

	@Get("ledger")
	async listLedger(
		@Query(new ZodValidationPipe(creditLedgerQuerySchema))
		query: CreditLedgerQuery,
		@CurrentUser() user: AuthUser,
	): Promise<CreditLedgerResponse> {
		const page = await this.creditsService.listLedger(user.id, query);

		return mapCreditLedgerPage(page);
	}
}
