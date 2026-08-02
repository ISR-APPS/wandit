import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type BillingCheckoutResponse,
	type BillingPlansResponse,
	type BillingPortalResponse,
	type BillingSubscriptionChangeOutcomeResponse,
	type BillingSubscriptionChangePreviewResponse,
	type BillingSubscriptionViewResponse,
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
import { CurrentUser, EarlyAccessGuard, Public } from "../../../../auth";
import {
	SubscriptionsEnabledGuard,
	TopupsEnabledGuard,
} from "../../../../settings";
import { BillingService } from "../../../application/services/billing.service";

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
	): Promise<BillingSubscriptionViewResponse> {
		return this.billingService.getSubscriptionView(user.id);
	}

	@UseGuards(SubscriptionsEnabledGuard, EarlyAccessGuard)
	@Post("checkout")
	checkout(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createBillingCheckoutBodySchema))
		body: CreateBillingCheckoutBody,
	): Promise<BillingCheckoutResponse> {
		return this.billingService.checkout(user, body);
	}

	@UseGuards(TopupsEnabledGuard, EarlyAccessGuard)
	@Post("topup")
	topup(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createBillingTopupBodySchema))
		body: CreateBillingTopupBody,
	): Promise<BillingCheckoutResponse> {
		return this.billingService.topup(user, body);
	}

	@Post("portal")
	portal(@CurrentUser() user: AuthUser): Promise<BillingPortalResponse> {
		return this.billingService.portal(user);
	}

	@UseGuards(SubscriptionsEnabledGuard, EarlyAccessGuard)
	@Post("change/preview")
	previewChange(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(previewBillingSubscriptionChangeBodySchema))
		body: PreviewBillingSubscriptionChangeBody,
	): Promise<BillingSubscriptionChangePreviewResponse> {
		return this.billingService.previewChange(user, body);
	}

	@UseGuards(SubscriptionsEnabledGuard, EarlyAccessGuard)
	@Post("change")
	change(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(changeBillingSubscriptionBodySchema))
		body: ChangeBillingSubscriptionBody,
	): Promise<BillingSubscriptionChangeOutcomeResponse> {
		return this.billingService.change(user, body);
	}

	@Post("cancel")
	cancel(
		@CurrentUser() user: AuthUser,
	): Promise<BillingSubscriptionViewResponse> {
		return this.billingService.cancel(user);
	}

	@UseGuards(SubscriptionsEnabledGuard, EarlyAccessGuard)
	@Post("resume")
	resume(
		@CurrentUser() user: AuthUser,
	): Promise<BillingSubscriptionViewResponse> {
		return this.billingService.resume(user);
	}

	@Post("sync")
	sync(
		@CurrentUser() user: AuthUser,
	): Promise<BillingSubscriptionViewResponse> {
		return this.billingService.sync(user);
	}
}
