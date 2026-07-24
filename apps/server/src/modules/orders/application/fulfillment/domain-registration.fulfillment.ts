import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { DOMAINS_QUEUE, type DomainPurchaseJobData } from "@wandit/jobs";
import type { Queue } from "bullmq";

import { DomainsUnavailableError } from "../../../domains/domain/errors/domain.errors";
import { DomainsRepository } from "../../../domains/infrastructure/persistence/domains.repository";
import { OrderInvariantViolationError } from "../../domain/errors/payment-order.errors";
import {
	domainRegistrationOrderMetadataSchema,
	type PaymentOrderRow,
} from "../../domain/payment-order.types";
import type { OrderFulfillmentHandler } from "../../domain/ports/order-fulfillment.port";

@Injectable()
export class DomainRegistrationFulfillment implements OrderFulfillmentHandler {
	readonly kind = "domain_registration" as const;

	constructor(
		@Inject(DomainsRepository)
		private readonly domainsRepository: DomainsRepository,
		@Optional()
		@InjectQueue(DOMAINS_QUEUE)
		private readonly domainsQueue?: Queue<
			DomainPurchaseJobData,
			unknown,
			"domain-purchase"
		>,
	) {}

	async fulfill(order: PaymentOrderRow): Promise<void> {
		const metadata = domainRegistrationOrderMetadataSchema.safeParse(
			order.metadata,
		);

		if (!metadata.success) {
			throw new OrderInvariantViolationError(
				`Payment order ${order.id} has invalid domain-registration metadata`,
			);
		}

		const domain = await this.domainsRepository.findOrCreatePurchasedForOrder({
			name: metadata.data.domain,
			paymentOrderId: order.id,
			priceSnapshot: metadata.data.priceSnapshot,
			projectId: metadata.data.projectId ?? null,
			registrant: metadata.data.registrant,
			tld: metadata.data.tld,
			userId: order.userId,
			whoisPrivacy: metadata.data.whoisPrivacy,
		});

		if (
			domain.paymentOrderId !== order.id ||
			domain.name !== metadata.data.domain ||
			domain.userId !== order.userId
		) {
			throw new OrderInvariantViolationError(
				`Domain fulfillment row does not match payment order ${order.id}`,
			);
		}

		if (!isDomainQueueEnabled() || !this.domainsQueue) {
			throw new DomainsUnavailableError(
				"Domain fulfillment queue is temporarily unavailable",
			);
		}

		await this.domainsQueue.add(
			"domain-purchase",
			{
				domainId: domain.id,
				orderId: order.id,
				paymentSource: "order",
			},
			{
				attempts: 5,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
				jobId: `order-fulfill-${order.id}`,
			},
		);
	}
}

function isDomainQueueEnabled(): boolean {
	return process.env.QUEUE_ENABLED === undefined
		? env.QUEUE_ENABLED
		: process.env.QUEUE_ENABLED === "true";
}
