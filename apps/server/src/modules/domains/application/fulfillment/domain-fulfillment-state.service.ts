import type { DomainStatus } from "@wandit/contracts";

import type {
	DomainFulfillmentLogger,
	DomainFulfillmentOrder,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
	DomainPurchasePayload,
} from "./domain-fulfillment.contracts";
import { buildDomainPurchaseNonce } from "./domain-fulfillment.contracts";
import {
	MissingDomainPaymentOrderError,
	OrderFulfillmentStoppedError,
	TerminalDomainFulfillmentError,
} from "./domain-fulfillment.errors";
import { domainTerminalFailureContext } from "./domain-purchase-failure-finalizer";

export type DomainPurchaseStateResult =
	| {
			kind: "configure";
			nonce: string;
			row: DomainFulfillmentRow;
	  }
	| {
			error: unknown;
			kind: "terminal";
			orderId: string | null;
			row: DomainFulfillmentRow;
	  }
	| {
			kind: "ready";
			orderId: string;
			row: DomainFulfillmentRow;
	  }
	| {
			kind: "stopped";
			reason: "already_active" | "not_registering" | "order_not_fulfillable";
	  };

type DomainFulfillmentStateDependencies = {
	findDomain(domainId: string): Promise<DomainFulfillmentRow | null>;
	findOrder(orderId: string): Promise<DomainFulfillmentOrder | null>;
	logger: DomainFulfillmentLogger;
	markOrderFulfilling(orderId: string): Promise<DomainFulfillmentOrder | null>;
	markOrderFulfilled(orderId: string): Promise<DomainFulfillmentOrder | null>;
	recordFinancialRaceNote(
		orderId: string,
		note: string,
	): Promise<DomainFulfillmentOrder | null>;
	updateDomainIfStatus(
		domainId: string,
		statuses: DomainStatus[],
		patch: DomainFulfillmentPatch,
		transaction?: unknown,
	): Promise<DomainFulfillmentRow | null>;
	withOrderFulfillmentFence<T>(
		orderId: string,
		operation: (
			order: DomainFulfillmentOrder,
			transaction: unknown,
		) => Promise<T>,
	): Promise<T>;
};

export class DomainFulfillmentStateService {
	constructor(
		private readonly dependencies: DomainFulfillmentStateDependencies,
	) {}

	async preparePurchase(
		payload: DomainPurchasePayload,
	): Promise<DomainPurchaseStateResult> {
		const row = await this.dependencies.findDomain(payload.domainId);

		if (!row) {
			return { kind: "stopped", reason: "not_registering" };
		}

		if (row.paymentOrderId !== payload.orderId) {
			return {
				error: new Error(
					`Domain ${row.id} does not belong to payment order ${payload.orderId}`,
				),
				kind: "terminal",
				orderId: row.paymentOrderId,
				row,
			};
		}

		if (row.status === "active") {
			await this.healOrderCompletion(row);

			return { kind: "stopped", reason: "already_active" };
		}

		if (row.status === "failed") {
			const terminal = domainTerminalFailureContext(
				row,
				new Error("Domain registration failed"),
			);

			return {
				error: terminal.error,
				kind: "terminal",
				orderId: terminal.orderId,
				row,
			};
		}

		if (row.status === "configuring") {
			return {
				kind: "configure",
				nonce: buildDomainPurchaseNonce(payload.orderId),
				row,
			};
		}

		if (row.status !== "registering") {
			return { kind: "stopped", reason: "not_registering" };
		}

		if (row.provider !== "namecom") {
			return {
				error: new TerminalDomainFulfillmentError(
					"Unsupported registrar for this worker",
				),
				kind: "terminal",
				orderId: row.paymentOrderId,
				row,
			};
		}

		const order = await this.dependencies.findOrder(payload.orderId);

		if (!order) {
			this.dependencies.logger.error(
				`MANUAL REVIEW REQUIRED: payment order ${payload.orderId} not found for domain ${row.id}`,
			);

			return {
				error: new MissingDomainPaymentOrderError(),
				kind: "terminal",
				orderId: null,
				row,
			};
		}

		if (order.status === "failed" || order.status === "refunded") {
			return {
				error: new Error("Domain registration failed"),
				kind: "terminal",
				orderId: order.id,
				row,
			};
		}

		if (order.status === "fulfilling") {
			return { kind: "ready", orderId: order.id, row };
		}

		if (order.status !== "paid") {
			return { kind: "stopped", reason: "order_not_fulfillable" };
		}

		const transitioned = await this.dependencies.markOrderFulfilling(order.id);

		if (transitioned) {
			return { kind: "ready", orderId: order.id, row };
		}

		const current = await this.dependencies.findOrder(order.id);

		return current?.status === "fulfilling"
			? { kind: "ready", orderId: order.id, row }
			: { kind: "stopped", reason: "order_not_fulfillable" };
	}

	async assertRegistrationOrderStillFulfilling(orderId: string): Promise<void> {
		await this.dependencies.withOrderFulfillmentFence(
			orderId,
			async (order) => {
				if (order.status === "fulfilling") {
					return;
				}

				this.dependencies.logger.warn(
					`Skipping registrar purchase for payment order ${order.id} in ${order.status} state`,
				);
				throw new OrderFulfillmentStoppedError("order_not_fulfillable");
			},
		);
	}

	async updatePostRegistrationState(
		row: DomainFulfillmentRow,
		patch: DomainFulfillmentPatch,
	): Promise<DomainFulfillmentRow> {
		const updated = await this.dependencies.updateDomainIfStatus(
			row.id,
			["registering"],
			patch,
		);

		if (updated) {
			return updated;
		}

		const current = await this.dependencies.findDomain(row.id);
		const orderId = row.paymentOrderId;

		if (orderId) {
			const order = await this.dependencies.findOrder(orderId);

			if (order?.status === "failed" || order?.status === "refunded") {
				const providerDomainId =
					typeof patch.providerDomainId === "string"
						? patch.providerDomainId
						: (row.providerDomainId ?? current?.providerDomainId);
				const note = `Manual review required: domain ${row.name} was purchased at the registrar${providerDomainId ? ` as ${providerDomainId}` : ""}, but payment order ${order.id} became ${order.status} before post-registration state could be committed.`;
				const recorded = await this.dependencies.recordFinancialRaceNote(
					order.id,
					note,
				);

				this.dependencies.logger.error(
					`MANUAL REVIEW REQUIRED: registrar purchase outlived financial reversal for payment order ${order.id}`,
					JSON.stringify({
						domainId: row.id,
						domainName: row.name,
						orderId: order.id,
						orderStatus: order.status,
						providerDomainId: providerDomainId ?? null,
						recorded: recorded !== null,
					}),
				);

				throw new OrderFulfillmentStoppedError("financial_race");
			}
		}

		throw new Error(
			`Domain ${row.id} changed from registering during post-registration persistence`,
		);
	}

	transitionToConfiguring(
		row: DomainFulfillmentRow,
	): Promise<DomainFulfillmentRow> {
		return this.updatePostRegistrationState(row, {
			error: null,
			status: "configuring",
		});
	}

	async healOrderCompletion(row: DomainFulfillmentRow): Promise<void> {
		if (!row.paymentOrderId) {
			return;
		}

		await this.dependencies.markOrderFulfilled(row.paymentOrderId);
	}
}
