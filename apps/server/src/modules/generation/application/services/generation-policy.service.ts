/**
 * Checks if a user is allowed to start a generation.
 *
 * `assertCanGenerate` is a non-mutating early gate. Expensive background
 * generations can additionally reserve credits atomically before queueing and
 * refund that reservation if no result is delivered.
 */
import { Inject, Injectable } from "@nestjs/common";
// Shared prices used by frontend, API, and worker.
import { CREDIT_COSTS, mediaGenerationReservationKey } from "@wandit/contracts";
// Typed environment values.
import { env } from "@wandit/env/server";

import { BillingService } from "../../../billing/application/services/billing.service";
import { CreditsService } from "../../../credits/application/services/credits.service";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import { GenerationPaymentRequiredError } from "../../domain/errors/generation-payment-required.error";

// Actions that have a generation price. Deriving this from the shared
// catalog prevents a newly exposed generator from silently bypassing billing.
export type GenerationAction = keyof typeof CREDIT_COSTS;

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

	/**
	 * Atomically reserve credits before an expensive background generation.
	 * Active subscriptions retain the existing subscription-or-credits policy;
	 * credit-funded users are serialized by CreditsService's per-user lock.
	 */
	async reserveGeneration(
		userId: string,
		action: GenerationAction,
		reservationId: string,
	): Promise<void> {
		if (env.GENERATION_BILLING_MODE === "off") {
			return;
		}

		if (await this.billingService.hasActiveSubscription(userId)) {
			return;
		}

		const cost = CREDIT_COSTS[action];

		try {
			await this.creditsService.consume(userId, cost, {
				idempotencyKey: mediaGenerationReservationKey(reservationId),
				meta: {
					action,
					reservationId,
					reason: "generation_reservation",
				},
			});
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				const response = error.getResponse();
				const available =
					typeof response === "object" &&
					response !== null &&
					"available" in response &&
					typeof response.available === "number"
						? response.available
						: 0;

				throw new GenerationPaymentRequiredError(cost, available);
			}

			throw error;
		}
	}

	refundGenerationReservation(
		userId: string,
		reservationId: string,
	): Promise<unknown[]> {
		// Refund according to the ledger, not today's configuration. An attempt
		// may have reserved credits while enforcement was on and failed after an
		// operator switched billing off.
		return this.creditsService.refundConsume(
			userId,
			mediaGenerationReservationKey(reservationId),
			{ reservationId, reason: "generation_failed" },
		);
	}
}
