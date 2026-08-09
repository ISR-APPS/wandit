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
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { CreditsService } from "../../../application/services/credits.service";
import { orgOwner, userOwner } from "../../../domain/credit-owner";
import { mapCreditLedgerPage } from "../../../infrastructure/mappers/credit-ledger.mapper";

// Balance/ledger are workspace-scoped: the active workspace's pool, resolved
// from the x-wandit-workspace header (membership already proven by the
// WorkspaceContextGuard). Personal scope is byte-identical to pre-teams.
@Controller("v1/credits")
export class CreditsController {
	constructor(
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
	) {}

	@Get("balance")
	getBalance(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CreditBalanceResponse> {
		return this.creditsService.getBalance(
			workspace.kind === "org"
				? orgOwner(workspace.organizationId)
				: userOwner(user.id),
		);
	}

	@Get("ledger")
	async listLedger(
		@Query(new ZodValidationPipe(creditLedgerQuerySchema))
		query: CreditLedgerQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CreditLedgerResponse> {
		const page = await this.creditsService.listLedger(
			workspace.kind === "org"
				? orgOwner(workspace.organizationId)
				: userOwner(user.id),
			query,
		);

		return mapCreditLedgerPage(page);
	}
}
