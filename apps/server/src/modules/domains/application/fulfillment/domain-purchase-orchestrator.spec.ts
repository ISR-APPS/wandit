import { describe, expect, it, vi } from "vitest";

import type { DomainFulfillmentRow } from "./domain-fulfillment.contracts";
import { buildDomainPurchaseNonce } from "./domain-fulfillment.contracts";
import {
	OrderFulfillmentStoppedError,
	TerminalDomainFulfillmentError,
} from "./domain-fulfillment.errors";
import type { DomainPurchaseStateResult } from "./domain-fulfillment-state.service";
import { DomainPurchaseOrchestrator } from "./domain-purchase-orchestrator";

const domainId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";

function domain(
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
		projectId: null,
		provider: "namecom",
		providerDomainId: null,
		providerOrderId: null,
		providerTotalPaidUsd: null,
		registrant: null,
		source: "purchased",
		status: "registering",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-08-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function setup(initialState?: DomainPurchaseStateResult) {
	const events: string[] = [];
	let state: DomainPurchaseStateResult = initialState ?? {
		kind: "ready",
		orderId,
		row: domain(),
	};
	const preparePurchase = vi.fn(async () => state);
	const registration = vi.fn(async (row: DomainFulfillmentRow) => {
		events.push("registration");
		return { ...row, providerDomainId: row.name };
	});
	const purchasedDns = vi.fn(async (row: DomainFulfillmentRow) => {
		events.push("purchased-dns");
		return { ...row, dns: { purchaseDnsConfigured: true } };
	});
	const customHostname = vi.fn(async (row: DomainFulfillmentRow) => {
		events.push("custom-hostname");
		return { ...row, cfCustomHostnameId: "cf_1" };
	});
	const apexZone = vi.fn(
		async (row: DomainFulfillmentRow): Promise<DomainFulfillmentRow> => {
			events.push("apex-zone");
			return {
				...row,
				dns: { ...(row.dns as Record<string, unknown>), apexConfigured: true },
			};
		},
	);
	const transitionToConfiguring = vi.fn(async (row: DomainFulfillmentRow) => {
		events.push("transition");
		return { ...row, status: "configuring" as const };
	});
	const configuration = vi.fn(async () => {
		events.push("configuration");
		return {
			processed: true as const,
			status: "active" as const,
			terminalized: false as const,
		};
	});
	const terminalFailure = vi.fn(async () => {
		events.push("terminal-failure");
	});
	const orchestrator = new DomainPurchaseOrchestrator({
		apexZone: { execute: apexZone },
		configuration: { execute: configuration },
		customHostname: { execute: customHostname },
		purchasedDns: { execute: purchasedDns },
		registration: { execute: registration },
		state: { preparePurchase, transitionToConfiguring },
		terminalFailure: { execute: terminalFailure },
	});

	return {
		apexZone,
		configuration,
		customHostname,
		events,
		orchestrator,
		preparePurchase,
		purchasedDns,
		registration,
		set state(value: DomainPurchaseStateResult) {
			state = value;
		},
		terminalFailure,
		transitionToConfiguring,
	};
}

describe("DomainPurchaseOrchestrator", () => {
	it("composes the purchase steps in one linear order before durable configuration", async () => {
		const fixture = setup();

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: true,
			status: "active",
			terminalized: false,
		});

		expect(fixture.events).toEqual([
			"registration",
			"purchased-dns",
			"custom-hostname",
			"apex-zone",
			"transition",
			"configuration",
		]);
		expect(fixture.registration).toHaveBeenCalledWith(
			expect.objectContaining({ id: domainId }),
			orderId,
		);
		expect(fixture.apexZone).toHaveBeenCalledWith(
			expect.objectContaining({ cfCustomHostnameId: "cf_1" }),
		);
		expect(fixture.transitionToConfiguring).toHaveBeenCalledWith(
			expect.objectContaining({
				dns: expect.objectContaining({ apexConfigured: true }),
			}),
		);
		expect(fixture.configuration).toHaveBeenCalledWith({
			domainId,
			nonce: buildDomainPurchaseNonce(orderId),
		});
	});

	it("keeps dispatching configuration when the best-effort apex zone step reports a deferred apex", async () => {
		const fixture = setup();
		fixture.apexZone.mockImplementationOnce(
			async (row: DomainFulfillmentRow) => {
				fixture.events.push("apex-zone");
				return {
					...row,
					dns: {
						...(row.dns as Record<string, unknown>),
						apexError: "Cloudflare zone request failed",
					},
				};
			},
		);

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: true,
			status: "active",
			terminalized: false,
		});

		expect(fixture.events).toEqual([
			"registration",
			"purchased-dns",
			"custom-hostname",
			"apex-zone",
			"transition",
			"configuration",
		]);
		expect(fixture.transitionToConfiguring).toHaveBeenCalledWith(
			expect.objectContaining({
				dns: expect.objectContaining({
					apexError: "Cloudflare zone request failed",
				}),
			}),
		);
		expect(fixture.terminalFailure).not.toHaveBeenCalled();
	});

	it("replaces the old configure enqueue with a direct runner resume", async () => {
		const row = domain({ status: "configuring" });
		const fixture = setup({
			kind: "configure",
			nonce: "legacy-seeded-nonce",
			row,
		});

		await fixture.orchestrator.execute({ domainId, orderId });

		expect(fixture.configuration).toHaveBeenCalledWith({
			domainId,
			nonce: "legacy-seeded-nonce",
		});
		expect(fixture.registration).not.toHaveBeenCalled();
		expect(fixture.transitionToConfiguring).not.toHaveBeenCalled();
	});

	it.each([
		"already_active",
		"not_registering",
		"order_not_fulfillable",
	] as const)("short-circuits a %s state before work", async (reason) => {
		const fixture = setup({ kind: "stopped", reason });

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: false,
			reason,
			terminalized: false,
		});

		expect(fixture.registration).not.toHaveBeenCalled();
		expect(fixture.configuration).not.toHaveBeenCalled();
		expect(fixture.terminalFailure).not.toHaveBeenCalled();
	});

	it("routes a state-level terminal decision through its real order target", async () => {
		const rowOrderId = "33333333-3333-4333-8333-333333333333";
		const row = domain({ paymentOrderId: rowOrderId });
		const error = new Error("payload mismatch");
		const fixture = setup({
			error,
			kind: "terminal",
			orderId: rowOrderId,
			row,
		});

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
			terminalized: true,
		});

		expect(fixture.terminalFailure).toHaveBeenCalledWith(row, error, {
			orderId: rowOrderId,
		});
		expect(fixture.registration).not.toHaveBeenCalled();
	});

	it("finalizes an immediate terminal step error without running later steps", async () => {
		const fixture = setup();
		const error = new TerminalDomainFulfillmentError("Domain is unavailable");
		fixture.registration.mockRejectedValueOnce(error);

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
			terminalized: true,
		});

		expect(fixture.terminalFailure).toHaveBeenCalledWith(
			expect.objectContaining({ id: domainId }),
			error,
		);
		expect(fixture.purchasedDns).not.toHaveBeenCalled();
		expect(fixture.configuration).not.toHaveBeenCalled();
	});

	it("also finalizes a structurally non-retryable provider error", async () => {
		const fixture = setup();
		const error = Object.assign(new Error("Registrar rejected request"), {
			retryable: false as const,
		});
		fixture.registration.mockRejectedValueOnce(error);

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
			terminalized: true,
		});
		expect(fixture.terminalFailure).toHaveBeenCalledWith(
			expect.anything(),
			error,
		);
	});

	it.each([
		new Error("network timeout"),
		Object.assign(new Error("Registrar 502"), { retryable: true }),
	])("propagates a retryable step failure", async (error) => {
		const fixture = setup();
		fixture.registration.mockRejectedValueOnce(error);

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).rejects.toBe(error);
		expect(fixture.terminalFailure).not.toHaveBeenCalled();
	});

	it("returns a pre-spend stop without terminalizing", async () => {
		const fixture = setup();
		fixture.registration.mockRejectedValueOnce(
			new OrderFulfillmentStoppedError("order_not_fulfillable"),
		);

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: false,
			reason: "order_not_fulfillable",
			terminalized: false,
		});
		expect(fixture.terminalFailure).not.toHaveBeenCalled();
	});

	it("runs idempotent terminal cleanup after a financial-race CAS loss", async () => {
		const fixture = setup();
		const error = new OrderFulfillmentStoppedError("financial_race");
		fixture.purchasedDns.mockRejectedValueOnce(error);

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).resolves.toEqual({
			processed: false,
			reason: "financial_race",
			terminalized: true,
		});
		expect(fixture.terminalFailure).toHaveBeenCalledWith(
			expect.objectContaining({ providerDomainId: "example.com" }),
			error,
		);
	});

	it("propagates runner infrastructure failures for task-level retry", async () => {
		const fixture = setup({
			kind: "configure",
			nonce: "purchase:resume",
			row: domain({ status: "configuring" }),
		});
		const error = new Error("cursor store unavailable");
		fixture.configuration.mockRejectedValueOnce(error);

		await expect(
			fixture.orchestrator.execute({ domainId, orderId }),
		).rejects.toBe(error);
		expect(fixture.terminalFailure).not.toHaveBeenCalled();
	});
});
