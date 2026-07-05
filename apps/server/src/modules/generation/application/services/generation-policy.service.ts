import { Inject, Injectable } from "@nestjs/common";
import { CREDIT_COSTS } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { BillingService } from "../../../billing/application/services/billing.service";
import { CreditsService } from "../../../credits/application/services/credits.service";
import { GenerationPaymentRequiredError } from "../../domain/errors/generation-payment-required.error";

export type GenerationAction = "landingPageGeneration" | "chatMessage";

@Injectable()
export class GenerationPolicyService {
	constructor(
		@Inject(BillingService)
		private readonly billingService: BillingService,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
	) {}

	async assertCanGenerate(
		userId: string,
		action: GenerationAction,
	): Promise<void> {
		if (env.GENERATION_BILLING_MODE === "off") {
			return;
		}

		const cost = CREDIT_COSTS[action];
		const [hasActiveSubscription, balance] = await Promise.all([
			this.billingService.hasActiveSubscription(userId),
			this.creditsService.getBalance(userId),
		]);

		if (hasActiveSubscription || balance.balance >= cost) {
			return;
		}

		throw new GenerationPaymentRequiredError(cost, balance.balance);
	}
}
