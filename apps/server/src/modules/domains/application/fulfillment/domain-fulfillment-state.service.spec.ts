import { describe, expect, it, vi } from "vitest";

import type {
	DomainFulfillmentOrder,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import {
	buildDomainPurchaseNonce,
	parseDomainConfigurationCursor,
	parseDomainConfigurationPayload,
	parseDomainPurchasePayload,
	persistDomainConfigurationCursor,
} from "./domain-fulfillment.contracts";
import {
	OrderFulfillmentStoppedError,
	TerminalDomainFulfillmentError,
} from "./domain-fulfillment.errors";
import { DomainFulfillmentStateService } from "./domain-fulfillment-state.service";

const domainId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const otherOrderId = "33333333-3333-4333-8333-333333333333";

function makeRow(
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: null,
		dns: null,
		error: null,
		expiresAt: null,
		id: domainId,
		isPrimary: false,
		name: "example.com",
		paymentOrderId: orderId,
		projectId: "44444444-4444-4444-8444-444444444444",
		provider: "namecom",
		providerDomainId: null,
		providerOrderId: null,
		providerTotalPaidUsd: null,
		registrant: null,
		source: "purchased",
		status: "registering",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function makeOrder(
	overrides: Partial<DomainFulfillmentOrder> = {},
): DomainFulfillmentOrder {
	return {
		fulfillmentError: null,
		id: orderId,
		refundStatus: null,
		status: "fulfilling",
		...overrides,
	};
}

function setup(
	input: {
		orders?: DomainFulfillmentOrder[];
		rows?: DomainFulfillmentRow[];
	} = {},
) {
	const domains = new Map((input.rows ?? []).map((row) => [row.id, row]));
	const orders = new Map(
		(input.orders ?? []).map((order) => [order.id, order]),
	);
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
	};
	const findDomain = vi.fn(
		async (id: string): Promise<DomainFulfillmentRow | null> =>
			domains.get(id) ?? null,
	);
	const findOrder = vi.fn(
		async (id: string): Promise<DomainFulfillmentOrder | null> =>
			orders.get(id) ?? null,
	);
	const markOrderFulfilling = vi.fn(
		async (id: string): Promise<DomainFulfillmentOrder | null> => {
			const order = orders.get(id);

			if (order?.status !== "paid") {
				return null;
			}

			const transitioned = { ...order, status: "fulfilling" as const };
			orders.set(id, transitioned);

			return transitioned;
		},
	);
	const markOrderFulfilled = vi.fn(
		async (id: string): Promise<DomainFulfillmentOrder | null> => {
			const order = orders.get(id);

			if (order?.status !== "fulfilling") {
				return null;
			}

			const transitioned = { ...order, status: "fulfilled" as const };
			orders.set(id, transitioned);

			return transitioned;
		},
	);
	const recordFinancialRaceNote = vi.fn(
		async (
			id: string,
			note: string,
		): Promise<DomainFulfillmentOrder | null> => {
			const order = orders.get(id);

			if (order?.status !== "failed" && order?.status !== "refunded") {
				return null;
			}

			const updated = { ...order, fulfillmentError: note };
			orders.set(id, updated);

			return updated;
		},
	);
	const updateDomainIfStatus = vi.fn(
		async (
			id: string,
			statuses: DomainFulfillmentRow["status"][],
			patch: DomainFulfillmentPatch,
		): Promise<DomainFulfillmentRow | null> => {
			const row = domains.get(id);

			if (!row || !statuses.includes(row.status)) {
				return null;
			}

			const updated = { ...row, ...patch };
			domains.set(id, updated);

			return updated;
		},
	);
	const fenceCalls: string[] = [];
	const withOrderFulfillmentFence = async <T>(
		id: string,
		operation: (
			order: DomainFulfillmentOrder,
			transaction: unknown,
		) => Promise<T>,
	): Promise<T> => {
		fenceCalls.push(id);
		const order = orders.get(id);

		if (!order) {
			throw new Error(`Missing order ${id}`);
		}

		return operation(order, { transaction: true });
	};
	const service = new DomainFulfillmentStateService({
		findDomain,
		findOrder,
		logger,
		markOrderFulfilling,
		markOrderFulfilled,
		recordFinancialRaceNote,
		updateDomainIfStatus,
		withOrderFulfillmentFence,
	});

	return {
		domains,
		fenceCalls,
		findDomain,
		findOrder,
		logger,
		markOrderFulfilling,
		markOrderFulfilled,
		orders,
		recordFinancialRaceNote,
		service,
		updateDomainIfStatus,
	};
}

describe("domain fulfillment contracts", () => {
	it("builds the shared purchased-configuration nonce", () => {
		expect(buildDomainPurchaseNonce(orderId)).toBe(
			"purchase:22222222-2222-4222-8222-222222222222",
		);
	});

	it("parses only the strict domain purchase payload", () => {
		expect(parseDomainPurchasePayload({ domainId, orderId })).toEqual({
			domainId,
			orderId,
		});

		for (const payload of [
			null,
			[],
			{},
			{ domainId },
			{ domainId, orderId, paymentSource: "order" },
			{ domainId: "not-a-uuid", orderId },
			{ domainId, orderId: "not-a-uuid" },
		]) {
			expect(() => parseDomainPurchasePayload(payload)).toThrow(TypeError);
		}
	});

	it("parses a strict configuration payload with a bounded nonce", () => {
		expect(
			parseDomainConfigurationPayload({ domainId, nonce: "purchase:order" }),
		).toEqual({ domainId, nonce: "purchase:order" });
		expect(
			parseDomainConfigurationPayload({ domainId, nonce: "x".repeat(255) }),
		).toEqual({ domainId, nonce: "x".repeat(255) });

		for (const payload of [
			{ domainId },
			{ domainId, nonce: "purchase:order", unexpected: true },
			{ domainId, nonce: "" },
			{ domainId, nonce: " padded" },
			{ domainId, nonce: "padded " },
			{ domainId, nonce: "x".repeat(256) },
			{ domainId, nonce: 1 },
		]) {
			expect(() => parseDomainConfigurationPayload(payload)).toThrow(TypeError);
		}
	});

	it("parses and persists the strict configuration cursor", () => {
		const persisted = {
			nextAttempt: 100,
			nextProbeAt: "2026-08-01T12:00:00.000Z",
			nonce: "purchase:order",
		};
		const parsed = parseDomainConfigurationCursor(persisted);

		expect(parsed).toEqual({
			nextAttempt: 100,
			nextProbeAt: new Date("2026-08-01T12:00:00.000Z"),
			nonce: "purchase:order",
		});
		expect(persistDomainConfigurationCursor(parsed)).toEqual(persisted);
		expect(
			persistDomainConfigurationCursor({
				nextAttempt: 0,
				nextProbeAt: null,
				nonce: "manual",
			}),
		).toEqual({ nextAttempt: 0, nextProbeAt: null, nonce: "manual" });
	});

	it("rejects malformed or non-canonical persisted cursors", () => {
		for (const cursor of [
			null,
			{},
			{ nextAttempt: -1, nextProbeAt: null, nonce: "n" },
			{ nextAttempt: 101, nextProbeAt: null, nonce: "n" },
			{ nextAttempt: 0.5, nextProbeAt: null, nonce: "n" },
			{ nextAttempt: 0, nextProbeAt: null, nonce: "" },
			{ nextAttempt: 0, nextProbeAt: null, nonce: "x".repeat(256) },
			{
				nextAttempt: 0,
				nextProbeAt: "2026-08-01T12:00:00Z",
				nonce: "n",
			},
			{ nextAttempt: 0, nextProbeAt: "not-a-date", nonce: "n" },
			{
				nextAttempt: 0,
				nextProbeAt: null,
				nonce: "n",
				unexpected: true,
			},
		]) {
			expect(() => parseDomainConfigurationCursor(cursor)).toThrow(TypeError);
		}
	});
});

describe("DomainFulfillmentStateService", () => {
	it("stops when the domain row is missing", async () => {
		const { service } = setup();

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({ kind: "stopped", reason: "not_registering" });
	});

	it("uses the row's real order as the terminal refund target on mismatch", async () => {
		const row = makeRow({ paymentOrderId: otherOrderId });
		const { findOrder, service } = setup({ rows: [row] });

		const result = await service.preparePurchase({ domainId, orderId });

		expect(result).toMatchObject({
			kind: "terminal",
			orderId: otherOrderId,
			row,
		});
		expect(result).toHaveProperty(
			"error.message",
			`Domain ${domainId} does not belong to payment order ${orderId}`,
		);
		expect(findOrder).not.toHaveBeenCalled();
	});

	it("terminalizes a registering row and raises manual review when its order is missing", async () => {
		const row = makeRow();
		const { logger, service } = setup({ rows: [row] });

		const result = await service.preparePurchase({ domainId, orderId });

		expect(result).toMatchObject({
			kind: "terminal",
			orderId: null,
			row,
		});
		expect(result).toHaveProperty(
			"error.message",
			"Payment order is missing for this domain purchase",
		);
		expect(logger.error).toHaveBeenCalledWith(
			`MANUAL REVIEW REQUIRED: payment order ${orderId} not found for domain ${domainId}`,
		);
	});

	it("accepts an already-fulfilling order", async () => {
		const row = makeRow();
		const order = makeOrder();
		const { markOrderFulfilling, service } = setup({
			orders: [order],
			rows: [row],
		});

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({ kind: "ready", orderId, row });
		expect(markOrderFulfilling).not.toHaveBeenCalled();
	});

	it("moves a paid order to fulfilling before registrar work", async () => {
		const row = makeRow();
		const order = makeOrder({ status: "paid" });
		const { markOrderFulfilling, orders, service } = setup({
			orders: [order],
			rows: [row],
		});

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({ kind: "ready", orderId, row });
		expect(markOrderFulfilling).toHaveBeenCalledWith(orderId);
		expect(orders.get(orderId)?.status).toBe("fulfilling");
	});

	it("accepts a paid CAS miss only when a concurrent writer reached fulfilling", async () => {
		const row = makeRow();
		const paid = makeOrder({ status: "paid" });
		const fulfilling = makeOrder({ status: "fulfilling" });
		const { findOrder, markOrderFulfilling, service } = setup({
			orders: [paid],
			rows: [row],
		});
		findOrder.mockResolvedValueOnce(paid).mockResolvedValueOnce(fulfilling);
		markOrderFulfilling.mockResolvedValueOnce(null);

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({ kind: "ready", orderId, row });
		expect(findOrder).toHaveBeenCalledTimes(2);
	});

	it("stops a paid CAS miss when the order did not reach fulfilling", async () => {
		const row = makeRow();
		const paid = makeOrder({ status: "paid" });
		const canceled = makeOrder({ status: "canceled" });
		const { findOrder, markOrderFulfilling, service } = setup({
			orders: [paid],
			rows: [row],
		});
		findOrder.mockResolvedValueOnce(paid).mockResolvedValueOnce(canceled);
		markOrderFulfilling.mockResolvedValueOnce(null);

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({ kind: "stopped", reason: "order_not_fulfillable" });
	});

	it.each([
		"pending",
		"fulfilled",
		"canceled",
	] as const)("stops before registrar spend for a %s order", async (status) => {
		const row = makeRow();
		const { service } = setup({
			orders: [makeOrder({ status })],
			rows: [row],
		});

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({
			kind: "stopped",
			reason: "order_not_fulfillable",
		});
	});

	it.each([
		"failed",
		"refunded",
	] as const)("returns the repair terminal path for a %s order", async (status) => {
		const row = makeRow();
		const { service } = setup({
			orders: [makeOrder({ status })],
			rows: [row],
		});

		const result = await service.preparePurchase({ domainId, orderId });

		expect(result).toMatchObject({ kind: "terminal", orderId, row });
		expect(result).toHaveProperty(
			"error.message",
			"Domain registration failed",
		);
	});

	it("heals order completion when an active domain is replayed", async () => {
		const row = makeRow({ status: "active" });
		const order = makeOrder();
		const { markOrderFulfilled, orders, service } = setup({
			orders: [order],
			rows: [row],
		});

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({ kind: "stopped", reason: "already_active" });
		expect(markOrderFulfilled).toHaveBeenCalledWith(orderId);
		expect(orders.get(orderId)?.status).toBe("fulfilled");
	});

	it("returns a terminal failure for an already-failed domain row", async () => {
		const row = makeRow({
			error: "Registrar rejected request",
			status: "failed",
		});
		const { service } = setup({ rows: [row] });

		const result = await service.preparePurchase({ domainId, orderId });

		expect(result).toMatchObject({ kind: "terminal", orderId, row });
		expect(result).toHaveProperty(
			"error.message",
			"Registrar rejected request",
		);
	});

	it("resumes a configuring purchase with the stable order nonce", async () => {
		const row = makeRow({ status: "configuring" });
		const { service } = setup({ rows: [row] });

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({
			kind: "configure",
			nonce: buildDomainPurchaseNonce(orderId),
			row,
		});
	});

	it("routes unsupported registrar rows through the terminal path", async () => {
		const row = makeRow({ provider: "openprovider" });
		const { findOrder, service } = setup({ rows: [row] });

		const result = await service.preparePurchase({ domainId, orderId });

		expect(result).toMatchObject({ kind: "terminal", orderId, row });
		expect(result).toHaveProperty(
			"error.message",
			"Unsupported registrar for this worker",
		);
		expect(findOrder).not.toHaveBeenCalled();
	});

	it.each([
		"expired",
		"transferred_out",
	] as const)("stops a %s domain before loading its order", async (status) => {
		const row = makeRow({ status });
		const { findOrder, service } = setup({ rows: [row] });

		await expect(
			service.preparePurchase({ domainId, orderId }),
		).resolves.toEqual({ kind: "stopped", reason: "not_registering" });
		expect(findOrder).not.toHaveBeenCalled();
	});

	it("takes the order fence immediately before registrar spend eligibility", async () => {
		const row = makeRow();
		const order = makeOrder();
		const { fenceCalls, service } = setup({ orders: [order], rows: [row] });

		await expect(
			service.assertRegistrationOrderStillFulfilling(orderId),
		).resolves.toBeUndefined();
		expect(fenceCalls).toEqual([orderId]);
	});

	it("stops registrar spend when the fenced order is no longer fulfilling", async () => {
		const row = makeRow();
		const order = makeOrder({ status: "refunded" });
		const { logger, service } = setup({ orders: [order], rows: [row] });

		await expect(
			service.assertRegistrationOrderStillFulfilling(orderId),
		).rejects.toMatchObject({
			name: "OrderFulfillmentStoppedError",
			reason: "order_not_fulfillable",
		});
		expect(logger.warn).toHaveBeenCalledWith(
			`Skipping registrar purchase for payment order ${orderId} in refunded state`,
		);
	});

	it("uses a registering CAS for a post-registration mutation", async () => {
		const row = makeRow();
		const { service, updateDomainIfStatus } = setup({ rows: [row] });
		const patch = { providerDomainId: "nc_example.com" };

		await expect(
			service.updatePostRegistrationState(row, patch),
		).resolves.toMatchObject(patch);
		expect(updateDomainIfStatus).toHaveBeenCalledWith(
			domainId,
			["registering"],
			patch,
		);
	});

	it("records manual review when a financial reversal wins the registering CAS", async () => {
		const row = makeRow();
		const reversedOrder = makeOrder({ status: "refunded" });
		const {
			domains,
			logger,
			recordFinancialRaceNote,
			service,
			updateDomainIfStatus,
		} = setup({ orders: [reversedOrder], rows: [row] });
		updateDomainIfStatus.mockResolvedValueOnce(null);
		domains.set(
			domainId,
			makeRow({ providerDomainId: "nc_example.com", status: "failed" }),
		);

		await expect(
			service.updatePostRegistrationState(row, {
				providerDomainId: "nc_example.com",
			}),
		).rejects.toEqual(new OrderFulfillmentStoppedError("financial_race"));
		expect(recordFinancialRaceNote).toHaveBeenCalledWith(
			orderId,
			expect.stringContaining(
				"was purchased at the registrar as nc_example.com",
			),
		);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("MANUAL REVIEW REQUIRED"),
			expect.stringContaining(`"orderId":"${orderId}"`),
		);
	});

	it("does not misclassify an unrelated registering CAS loss as a financial race", async () => {
		const row = makeRow();
		const { service, updateDomainIfStatus } = setup({
			orders: [makeOrder()],
			rows: [row],
		});
		updateDomainIfStatus.mockResolvedValueOnce(null);

		await expect(
			service.updatePostRegistrationState(row, { providerOrderId: "42" }),
		).rejects.toThrow(
			`Domain ${domainId} changed from registering during post-registration persistence`,
		);
	});

	it("transitions to configuring through the same registering CAS", async () => {
		const row = makeRow();
		const { service, updateDomainIfStatus } = setup({ rows: [row] });

		await expect(service.transitionToConfiguring(row)).resolves.toMatchObject({
			error: null,
			status: "configuring",
		});
		expect(updateDomainIfStatus).toHaveBeenCalledWith(
			domainId,
			["registering"],
			{ error: null, status: "configuring" },
		);
	});

	it("does not try to heal an order for a domain without one", async () => {
		const row = makeRow({ paymentOrderId: null, status: "active" });
		const { markOrderFulfilled, service } = setup({ rows: [row] });

		await expect(service.healOrderCompletion(row)).resolves.toBeUndefined();
		expect(markOrderFulfilled).not.toHaveBeenCalled();
	});

	it("uses the dedicated terminal error type for safe row failures", async () => {
		const row = makeRow({ status: "failed" });
		const { service } = setup({ rows: [row] });

		const result = await service.preparePurchase({ domainId, orderId });

		expect(result).toHaveProperty(
			"error",
			expect.any(TerminalDomainFulfillmentError),
		);
	});
});
