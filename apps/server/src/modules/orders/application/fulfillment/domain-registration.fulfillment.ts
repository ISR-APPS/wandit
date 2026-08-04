import { Inject, Injectable } from "@nestjs/common";

import {
	DOMAIN_TASK_DISPATCHER,
	type DomainTaskDispatcher,
} from "../../../domains/domain/ports/domain-task-dispatcher.port";
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
		@Inject(DOMAIN_TASK_DISPATCHER)
		private readonly domainTaskDispatcher: DomainTaskDispatcher,
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

		await this.domainTaskDispatcher.triggerPurchase({
			domainId: domain.id,
			orderId: order.id,
		});
	}
}
