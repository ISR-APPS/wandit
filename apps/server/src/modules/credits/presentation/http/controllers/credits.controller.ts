import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreditActivityQuery,
	type CreditActivityResponse,
	type CreditBalanceResponse,
	type CreditLedgerQuery,
	type CreditLedgerResponse,
	creditActivityQuerySchema,
	creditLedgerQuerySchema,
	PERSONAL_WORKSPACE,
	type WorkspaceCreditBalancesResponse,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { WorkspaceMembersRepository } from "../../../../workspaces/infrastructure/persistence/members.repository";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { CreditsService } from "../../../application/services/credits.service";
import {
	type CreditOwner,
	orgOwner,
	userOwner,
} from "../../../domain/credit-owner";
import { mapCreditActivityPage } from "../../../infrastructure/mappers/credit-activity.mapper";
import { mapCreditLedgerPage } from "../../../infrastructure/mappers/credit-ledger.mapper";

// Balance/ledger are workspace-scoped: the active workspace's pool, resolved
// from the x-wandit-workspace header (membership already proven by the
// WorkspaceContextGuard). Personal scope is byte-identical to pre-teams.
@Controller("v1/credits")
export class CreditsController {
	constructor(
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(WorkspaceMembersRepository)
		private readonly workspaceMembersRepository: WorkspaceMembersRepository,
	) {}

	@Get("balance")
	async getBalance(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CreditBalanceResponse> {
		const balance = await this.creditsService.getSettledBalance(
			workspace.kind === "org"
				? orgOwner(workspace.organizationId)
				: userOwner(user.id),
		);

		// Presentation boundary: internal balances are integer centi-credits;
		// the API contract carries decimal display credits.
		return {
			balance: balance.balance / 100,
			plan: balance.plan / 100,
			promo: balance.promo / 100,
			settledBalance: balance.settledBalance / 100,
			settledPlan: balance.settledPlan / 100,
			settledPromo: balance.settledPromo / 100,
			settledTopup: balance.settledTopup / 100,
			topup: balance.topup / 100,
		};
	}

	// User-scoped like WorkspacesController.list — no workspace header: the
	// membership query IS the authorization. Personal first, then each org in
	// membership order.
	@Get("balances")
	async listBalances(
		@CurrentUser() user: AuthUser,
	): Promise<WorkspaceCreditBalancesResponse> {
		const memberships =
			await this.workspaceMembersRepository.listUserMemberships(user.id);
		const pools: Array<{
			name: string | null;
			owner: CreditOwner;
			workspaceId: string;
		}> = [
			{
				name: null,
				owner: userOwner(user.id),
				workspaceId: PERSONAL_WORKSPACE,
			},
			...memberships.map(({ organization }) => ({
				name: organization.name,
				owner: orgOwner(organization.id),
				workspaceId: organization.id,
			})),
		];

		const items = await Promise.all(
			pools.map(async ({ name, owner, workspaceId }) => {
				const balance = await this.creditsService.getSettledBalance(owner);

				return {
					balance: balance.balance / 100,
					name,
					settledBalance: balance.settledBalance / 100,
					workspaceId,
				};
			}),
		);

		return { items };
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

	// One row per operation (net charge) plus grants/topups; never the raw
	// reserve/refund pairs. Same owner resolution as the ledger.
	@Get("activity")
	async listActivity(
		@Query(new ZodValidationPipe(creditActivityQuerySchema))
		query: CreditActivityQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CreditActivityResponse> {
		const page = await this.creditsService.listActivity(
			workspace.kind === "org"
				? orgOwner(workspace.organizationId)
				: userOwner(user.id),
			query,
		);

		return mapCreditActivityPage(page);
	}
}
