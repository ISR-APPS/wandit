import {
	BadRequestException,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
	type RawBodyRequest,
	Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { Public } from "../../../../auth";
import { StripeWebhookProcessor } from "../../../application/services/stripe-webhook-processor.service";
import { BillingNotConfiguredError } from "../../../domain/errors/billing-not-configured.error";
import { StripeProvider } from "../../../infrastructure/stripe/stripe.provider";

@Public()
@Controller("webhooks/stripe")
export class StripeWebhookController {
	constructor(
		@Inject(StripeWebhookProcessor)
		private readonly stripeWebhookProcessor: StripeWebhookProcessor,
		@Inject(StripeProvider)
		private readonly stripeProvider: StripeProvider,
	) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	handle(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Headers("stripe-signature") signature?: string,
	): Promise<{ received: true }> {
		if (!request.rawBody || !signature) {
			throw new BadRequestException({
				code: "BAD_REQUEST",
				message: "Missing Stripe webhook signature or raw body",
			});
		}

		let event: ReturnType<StripeProvider["constructWebhookEvent"]>;

		try {
			event = this.stripeProvider.constructWebhookEvent(
				request.rawBody,
				signature,
			);
		} catch (error) {
			if (error instanceof BillingNotConfiguredError) {
				throw error;
			}

			throw new BadRequestException({
				code: "BAD_REQUEST",
				message: "Invalid Stripe webhook signature",
			});
		}

		// Processing failures must surface as 5xx so Stripe retries the event.
		return this.stripeWebhookProcessor.process(event);
	}
}
