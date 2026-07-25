import { Inject, Injectable } from "@nestjs/common";
import type Stripe from "stripe";

import { BillingWebhookEventsRepository } from "../../infrastructure/persistence/billing-webhook-events.repository";
import { StripeEventRouter } from "./stripe-event-router.service";

@Injectable()
export class StripeWebhookProcessor {
	constructor(
		@Inject(BillingWebhookEventsRepository)
		private readonly billingWebhookEventsRepository: BillingWebhookEventsRepository,
		@Inject(StripeEventRouter)
		private readonly stripeEventRouter: StripeEventRouter,
	) {}

	async process(event: Stripe.Event): Promise<{ received: true }> {
		const inserted =
			await this.billingWebhookEventsRepository.tryInsertReceived(event);

		if (!inserted) {
			const existing = await this.billingWebhookEventsRepository.findById(
				event.id,
			);

			if (existing?.status === "processed" || existing?.status === "skipped") {
				return { received: true };
			}
		}

		const claimedAt = await this.billingWebhookEventsRepository.tryClaim(
			event.id,
		);

		if (!claimedAt) {
			const existing = await this.billingWebhookEventsRepository.findById(
				event.id,
			);

			if (existing?.status === "processed" || existing?.status === "skipped") {
				return { received: true };
			}

			throw new Error(
				`Stripe webhook event ${event.id} could not be claimed while status is ${existing?.status ?? "missing"}`,
			);
		}

		try {
			const result = await this.stripeEventRouter.route(event);

			if (result.status === "processed") {
				await this.requireTerminalClaimWrite(
					event.id,
					await this.billingWebhookEventsRepository.markProcessed(
						event.id,
						claimedAt,
					),
				);
			} else {
				await this.requireTerminalClaimWrite(
					event.id,
					await this.billingWebhookEventsRepository.markSkipped(
						event.id,
						claimedAt,
						result.reason,
					),
				);
			}
		} catch (error) {
			const markedFailed = await this.billingWebhookEventsRepository.markFailed(
				event.id,
				claimedAt,
				this.errorMessage(error),
			);

			if (!markedFailed) {
				const existing = await this.billingWebhookEventsRepository.findById(
					event.id,
				);

				if (
					existing?.status === "processed" ||
					existing?.status === "skipped"
				) {
					return { received: true };
				}
			}

			throw error;
		}

		return { received: true };
	}

	private async requireTerminalClaimWrite(
		eventId: string,
		terminalized: boolean,
	): Promise<void> {
		if (terminalized) {
			return;
		}

		const existing =
			await this.billingWebhookEventsRepository.findById(eventId);

		if (existing?.status === "processed" || existing?.status === "skipped") {
			return;
		}

		throw new Error(
			`Stripe webhook event ${eventId} lost claim ownership while durable status is ${existing?.status ?? "missing"}`,
		);
	}

	private errorMessage(error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}
}
