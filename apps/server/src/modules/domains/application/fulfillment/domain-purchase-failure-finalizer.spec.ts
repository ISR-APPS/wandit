import { describe, expect, it, vi } from "vitest";

import type { DomainFulfillmentRow } from "./domain-fulfillment.contracts";
import { TerminalDomainFulfillmentError } from "./domain-fulfillment.errors";
import {
	DomainPurchaseFailureFinalizer,
	domainTerminalFailureContext,
} from "./domain-purchase-failure-finalizer";

const domainId = "11111111-1111-4111-8111-111111111111";
const payloadOrderId = "22222222-2222-4222-8222-222222222222";
const rowOrderId = "33333333-3333-4333-8333-333333333333";

function domain(
	overrides: Partial<DomainFulfillmentRow> = {},
): DomainFulfillmentRow {
	return {
		cfCustomHostnameId: "cf_1",
		dns: null,
		error: null,
		expiresAt: null,
		id: domainId,
		isPrimary: false,
		name: "example.com",
		paymentOrderId: rowOrderId,
		projectId: "44444444-4444-4444-8444-444444444444",
		provider: "namecom",
		providerDomainId: "example.com",
		providerOrderId: null,
		providerTotalPaidUsd: "8.00",
		registrant: null,
		source: "purchased",
		status: "registering",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-08-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

describe("domain purchase failure finalization policy", () => {
	it("rebuilds a failed row's persisted terminal error and real order target", () => {
		const incoming = new Error("stale task error");
		const context = domainTerminalFailureContext(
			domain({ error: "Registrar rejected request", status: "failed" }),
			incoming,
		);

		expect(context.orderId).toBe(rowOrderId);
		expect(context.error).toBeInstanceOf(TerminalDomainFulfillmentError);
		expect(context.error).toMatchObject({
			message: "Registrar rejected request",
		});
		expect(context.error).not.toBe(incoming);
	});

	it("preserves a fresh failure while still routing through the row's order", () => {
		const incoming = new Error("provider unavailable");

		expect(domainTerminalFailureContext(domain(), incoming)).toEqual({
			error: incoming,
			orderId: rowOrderId,
		});
	});

	it("finalizes through the row-derived context rather than the payload order", async () => {
		const row = domain({ error: "Persisted failure", status: "failed" });
		const execute = vi.fn(async () => ({ status: "failed" as const }));
		const finalizer = new DomainPurchaseFailureFinalizer({
			findDomain: vi.fn(async () => row),
			terminalFailure: { execute },
		});

		await expect(
			finalizer.execute(
				{ domainId, orderId: payloadOrderId },
				new Error("attempts exhausted"),
			),
		).resolves.toEqual({ status: "failed" });
		expect(execute).toHaveBeenCalledWith(
			row,
			expect.objectContaining({
				message: "Persisted failure",
				name: "TerminalDomainFulfillmentError",
			}),
			{ orderId: rowOrderId },
		);
	});

	it("forwards the original attempt-exhaustion error for a fresh row", async () => {
		const row = domain();
		const originalError = new Error("provider unavailable on attempt five");
		const execute = vi.fn(async () => ({ status: "failed" as const }));
		const finalizer = new DomainPurchaseFailureFinalizer({
			findDomain: vi.fn(async () => row),
			terminalFailure: { execute },
		});

		await finalizer.execute(
			{ domainId, orderId: payloadOrderId },
			originalError,
		);

		expect(execute).toHaveBeenCalledExactlyOnceWith(row, originalError, {
			orderId: rowOrderId,
		});
	});

	it("does nothing when the domain row no longer exists", async () => {
		const execute = vi.fn();
		const finalizer = new DomainPurchaseFailureFinalizer({
			findDomain: vi.fn(async () => null),
			terminalFailure: { execute },
		});

		await expect(
			finalizer.execute(
				{ domainId, orderId: payloadOrderId },
				new Error("attempts exhausted"),
			),
		).resolves.toEqual({ status: "unchanged" });
		expect(execute).not.toHaveBeenCalled();
	});
});
