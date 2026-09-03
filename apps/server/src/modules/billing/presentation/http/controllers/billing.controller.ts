import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type BillingCancelRequest,
	type BillingCheckoutResponse,
	type BillingPlansResponse,
	type BillingPortalResponse,
	type BillingSubscriptionChangeOutcomeResponse,
	type BillingSubscriptionChangePreviewResponse,
	type BillingSubscriptionViewResponse,
	billingCancelRequestSchema,
	type ChangeBillingSubscriptionBody,
	type CreateBillingCheckoutBody,
	type CreateBillingTopupBody,
	changeBillingSubscriptionBodySchema,
	createBillingCheckoutBodySchema,
	createBillingTopupBodySchema,
	type PreviewBillingSubscriptionChangeBody,
	previewBillingSubscriptionChangeBodySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, Public } from "../../../../auth";
import {
	SubscriptionsEnabledGuard,
	TopupsEnabledGuard,
} from "../../../../settings";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { BillingService } from "../../../application/services/billing.service";

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

	@Public()
	@Get("plans")
	plans(): BillingPlansResponse {
		return this.billingService.plans();
	}

	@Get("subscription")
	subscription(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		// Readable by any workspace member: the pooled balance is shared context.
		return this.billingService.getSubscriptionView(user.id, workspace);
	}

	@UseGuards(SubscriptionsEnabledGuard)
	@RequireWorkspacePermission("billing", "manage")
	@Post("checkout")
	checkout(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Body(new ZodValidationPipe(createBillingCheckoutBodySchema))
		body: CreateBillingCheckoutBody,
	): Promise<BillingCheckoutResponse> {
		return this.billingService.checkout(user, body, workspace);
	}

	@UseGuards(TopupsEnabledGuard)
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

	@RequireWorkspacePermission("billing", "manage")
	@Post("portal")
	portal(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingPortalResponse> {
		return this.billingService.portal(user, workspace);
	}

	@UseGuards(SubscriptionsEnabledGuard)
	@RequireWorkspacePermission("billing", "manage")
	@Post("change/preview")
	previewChange(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Body(new ZodValidationPipe(previewBillingSubscriptionChangeBodySchema))
		body: PreviewBillingSubscriptionChangeBody,
	): Promise<BillingSubscriptionChangePreviewResponse> {
		return this.billingService.previewChange(user, body, workspace);
	}

	@UseGuards(SubscriptionsEnabledGuard)
	@RequireWorkspacePermission("billing", "manage")
	@Post("change")
	change(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Body(new ZodValidationPipe(changeBillingSubscriptionBodySchema))
		body: ChangeBillingSubscriptionBody,
	): Promise<BillingSubscriptionChangeOutcomeResponse> {
		return this.billingService.change(user, body, workspace);
	}

	@RequireWorkspacePermission("billing", "manage")
	@Post("cancel")
	cancel(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Body(new ZodValidationPipe(billingCancelRequestSchema))
		body: BillingCancelRequest,
	): Promise<BillingSubscriptionViewResponse> {
		return this.billingService.cancel(user, body, workspace);
	}

	// No SubscriptionsEnabledGuard here: a MANUAL subscriber must be able to
	// undo a scheduled cancellation even in an offline-only rollout (Stripe
	// subscriptions paused). BillingService.resume enforces the switch for
	// Stripe subscriptions itself.
	@RequireWorkspacePermission("billing", "manage")
	@Post("resume")
	resume(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		return this.billingService.resume(user, workspace);
	}

	// Owner-only like the rest of the money surface (teams-workspaces.md §5.4):
	// its single caller is the checkout return page, which only the purchasing
	// owner ever lands on, and it drives Stripe API calls + a subscription
	// mirror write that non-owners have no reason to trigger.
	@RequireWorkspacePermission("billing", "manage")
	@Post("sync")
	sync(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<BillingSubscriptionViewResponse> {
		return this.billingService.sync(user, workspace);
	}
}
