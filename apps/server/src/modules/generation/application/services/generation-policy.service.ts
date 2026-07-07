/**
 * Checks if a user is allowed to start a generation.
 *
 * This is only a gate before starting. It does not spend credits. The worker
 * spends credits after it saves the final generated answer.
 */
import { Inject, Injectable } from "@nestjs/common";
// Shared prices used by frontend, API, and worker.
import { CREDIT_COSTS } from "@wandit/contracts";
// Typed environment values.
import { env } from "@wandit/env/server";

import { BillingService } from "../../../billing/application/services/billing.service";
import { CreditsService } from "../../../credits/application/services/credits.service";
import { GenerationPaymentRequiredError } from "../../domain/errors/generation-payment-required.error";

// Actions that have a generation price.
export type GenerationAction = "landingPageGeneration" | "chatMessage";

// This service answers: "Can this user start generation?"
@Injectable()
export class GenerationPolicyService {
	constructor(
		// A user can pass this gate by subscription OR by credits.
		@Inject(BillingService)
		private readonly billingService: BillingService,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
	) {}

	// Return normally if allowed. Throw if blocked.
	async assertCanGenerate(
		userId: string,
		action: GenerationAction,
	): Promise<void> {
		// Local/dev mode can disable billing checks.
		if (env.GENERATION_BILLING_MODE === "off") {
			return;
		}

		const cost = CREDIT_COSTS[action];
		// These two checks do not depend on each other, so run them together.
		const [hasActiveSubscription, balance] = await Promise.all([
			this.billingService.hasActiveSubscription(userId),
			this.creditsService.getBalance(userId),
		]);

		// Either subscription or enough credits is accepted.
		if (hasActiveSubscription || balance.balance >= cost) {
			return;
		}

		// 402 tells the frontend this is a credits/subscription problem.
		throw new GenerationPaymentRequiredError(cost, balance.balance);
	}
}
