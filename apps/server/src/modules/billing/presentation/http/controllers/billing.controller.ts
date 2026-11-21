/**
 * HTTP routes of the wallet under /v1/billing: wallet view, top-up checkout, top-up status,
 * payment history, Stripe portal, and the plan reads that cached web bundles still call.
 * It calls BillingService. The x-wandit-workspace header selects the pool, except for the top-up status.
 */
import {
	Body,
	Controller,
	Get,
	Inject,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type BillingCheckoutResponse,
	type BillingPaymentsResponse,
	type BillingPlansResponse,
	type BillingPortalResponse,
	type BillingSubscriptionViewResponse,
	type BillingTopupStatusQuery,
	type BillingTopupStatusResponse,
	type BillingWalletResponse,
	billingTopupStatusQuerySchema,
	type CreateBillingTopupBody,
	createBillingTopupBodySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, Public } from "../../../../auth";
import { TopupsEnabledGuard } from "../../../../settings";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { BillingService } from "../../../application/services/billing.service";
import { WebOriginWriteGuard } from "../guards/web-origin-write.guard";

// Workspace-scoped billing: the x-wandit-workspace header selects whose money
// this is (design §2/§5.4). Personal scope is byte-identical to pre-teams.
// Money routes carry billing:manage — a no-op for personal scope, OWNER-only
// for org scope (Zack's decision: admins never touch money).
@Controller("v1/billing")
export class BillingController {
	constructor(
		@Inject(BillingService)
		private readonly billingService: BillingService,
	) {}

	// Cached pricing v7 web bundles call it for one release. The new web does not.
	@Public()
	@Get("plans")
	plans(): BillingPlansResponse {
		return this.billingService.plans();
	}

	// Cached pricing v7 web bundles call it for one release. The new web does not.
	@Get("subscription")
	subscription(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		// Readable by any workspace member: the pooled balance is shared context.
		return this.billingService.getSubscriptionView(user.id, workspace);
	}

	@Get("wallet")
	wallet(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingWalletResponse> {
		// Readable by any workspace member: the pooled balance is shared context.
		return this.billingService.getWallet(user.id, workspace);
	}

	// WebOriginWriteGuard: a cross-site form must not start a payment with the session cookie.
	@UseGuards(TopupsEnabledGuard, WebOriginWriteGuard)
	@RequireWorkspacePermission("billing", "manage")
	@Post("topup")
	topup(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Body(new ZodValidationPipe(createBillingTopupBodySchema))
		body: CreateBillingTopupBody,
	): Promise<BillingCheckoutResponse> {
		return this.billingService.topup(user, body, workspace);
	}

	// No workspace: the receipt is found by session id and payer, so a stale header cannot hide it.
	@Get("topup/status")
	topupStatus(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(billingTopupStatusQuerySchema))
		query: BillingTopupStatusQuery,
	): Promise<BillingTopupStatusResponse> {
		return this.billingService.getTopupStatus(user.id, query.sessionId);
	}

	// Payment history is money data: owner only for a team.
	@RequireWorkspacePermission("billing", "manage")
	@Get("payments")
	payments(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingPaymentsResponse> {
		return this.billingService.listPayments(user, workspace);
	}

	@RequireWorkspacePermission("billing", "manage")
	@Post("portal")
	portal(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingPortalResponse> {
		return this.billingService.portal(user, workspace);
	}
}
