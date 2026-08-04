import { DOMAIN_TLD_CATALOG, type Registrant } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
	DomainAvailability,
	DomainRegistrationOptions,
	DomainRegistrationResult,
} from "../../domain/ports/domain-provider.port";
import type {
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import {
	domainFailureSummary,
	isImmediateTerminalDomainError,
	OrderFulfillmentStoppedError,
	TerminalDomainFulfillmentError,
} from "./domain-fulfillment.errors";
import { DomainRegistrationStep } from "./domain-registration.step";

const domainId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";

const registrant = {
	address: {
		city: "Algiers",
		countryCode: "DZ",
		street: "12 Rue Didouche Mourad",
		wilaya: "Alger",
		zip: "16000",
	},
	email: "zack@example.com",
	firstName: "Zack",
	lastName: "Belaid",
	phone: "+213555123456",
} satisfies Registrant;

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
		registrant,
		source: "purchased",
		status: "registering",
		transferLockExpiresAt: null,
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		whoisPrivacy: false,
		...overrides,
	};
}

function setup() {
	const events: string[] = [];
	const getDomainInfo = vi.fn(
		async (_name: string): Promise<unknown | null> => {
			events.push("registrar-info");

			return null;
		},
	);
	const checkAvailability = vi.fn(
		async (names: string[]): Promise<DomainAvailability[]> => {
			events.push("registrar-availability");

			return names.map((name) => ({
				available: true,
				name,
				wholesalePriceUsd: 8,
			}));
		},
	);
	const defaultResult: DomainRegistrationResult = {
		expiresAt: new Date("2027-01-01T00:00:00.000Z"),
		providerDomainId: "nc_example.com",
	};
	const register = vi.fn(
		async (
			_name: string,
			_registrant: Registrant,
			_options: DomainRegistrationOptions,
		): Promise<DomainRegistrationResult> => {
			events.push("registrar-register");

			return defaultResult;
		},
	);
	const assertRegistrationOrderStillFulfilling = vi.fn(
		async (_id: string): Promise<void> => {
			events.push("order-fence");
		},
	);
	const updatePostRegistrationState = vi.fn(
		async (
			row: DomainFulfillmentRow,
			patch: DomainFulfillmentPatch,
		): Promise<DomainFulfillmentRow> => {
			events.push("receipt-cas");

			return { ...row, ...patch };
		},
	);
	const step = new DomainRegistrationStep(
		{ checkAvailability, getDomainInfo, register },
		{
			assertRegistrationOrderStillFulfilling,
			updatePostRegistrationState,
		},
	);

	return {
		assertRegistrationOrderStillFulfilling,
		checkAvailability,
		events,
		getDomainInfo,
		register,
		step,
		updatePostRegistrationState,
	};
}

describe("DomainRegistrationStep", () => {
	it("skips every registrar operation when the receipt is already persisted", async () => {
		const row = makeRow({ providerDomainId: "nc_example.com" });
		const {
			assertRegistrationOrderStillFulfilling,
			checkAvailability,
			getDomainInfo,
			register,
			step,
			updatePostRegistrationState,
		} = setup();

		await expect(step.execute(row, orderId)).resolves.toBe(row);
		expect(getDomainInfo).not.toHaveBeenCalled();
		expect(checkAvailability).not.toHaveBeenCalled();
		expect(assertRegistrationOrderStillFulfilling).not.toHaveBeenCalled();
		expect(register).not.toHaveBeenCalled();
		expect(updatePostRegistrationState).not.toHaveBeenCalled();
	});

	it("fails closed when the domain is unavailable or the quote is absent", async () => {
		for (const availability of [
			[] as DomainAvailability[],
			[{ available: false, name: "example.com" }],
		]) {
			const { checkAvailability, register, step } = setup();
			checkAvailability.mockResolvedValueOnce(availability);

			await expect(step.execute(makeRow(), orderId)).rejects.toEqual(
				new TerminalDomainFulfillmentError("Domain is not available"),
			);
			expect(register).not.toHaveBeenCalled();
		}
	});

	it.each([
		{
			label: "over-ceiling",
			quote: {
				available: true,
				name: "example.com",
				wholesalePriceUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd + 0.01,
			},
		},
		{
			label: "missing-price",
			quote: { available: true, name: "example.com" },
		},
		{
			label: "premium",
			quote: {
				available: true,
				name: "example.com",
				premium: true,
				wholesalePriceUsd: 8,
			},
		},
		{
			label: "non-finite",
			quote: {
				available: true,
				name: "example.com",
				wholesalePriceUsd: Number.NaN,
			},
		},
	] satisfies Array<{
		label: string;
		quote: DomainAvailability;
	}>)("rejects a $label registrar quote before spending", async ({ quote }) => {
		const { checkAvailability, register, step } = setup();
		checkAvailability.mockResolvedValueOnce([quote]);

		await expect(step.execute(makeRow(), orderId)).rejects.toEqual(
			new TerminalDomainFulfillmentError(
				"Domain price is premium, missing, or above the catalog safety ceiling",
			),
		);
		expect(register).not.toHaveBeenCalled();
	});

	it("rejects a domain outside the supported catalog", async () => {
		const { checkAvailability, register, step } = setup();
		checkAvailability.mockResolvedValueOnce([
			{
				available: true,
				name: "example.xyz",
				wholesalePriceUsd: 8,
			},
		]);

		await expect(
			step.execute(makeRow({ name: "example.xyz" }), orderId),
		).rejects.toEqual(
			new TerminalDomainFulfillmentError(
				"Domain is not in the supported catalog",
			),
		);
		expect(register).not.toHaveBeenCalled();
	});

	it("rejects an invalid registrant snapshot before taking the spend fence", async () => {
		const { assertRegistrationOrderStillFulfilling, register, step } = setup();

		await expect(
			step.execute(makeRow({ registrant: null }), orderId),
		).rejects.toEqual(
			new TerminalDomainFulfillmentError("Registrant snapshot is invalid"),
		);
		expect(assertRegistrationOrderStillFulfilling).not.toHaveBeenCalled();
		expect(register).not.toHaveBeenCalled();
	});

	it("takes the money fence immediately before register and persists the receipt after", async () => {
		const { events, step } = setup();

		await step.execute(makeRow(), orderId);

		expect(events).toEqual([
			"registrar-info",
			"registrar-availability",
			"order-fence",
			"registrar-register",
			"receipt-cas",
		]);
	});

	it("does not call the registrar when the immediate money fence stops fulfillment", async () => {
		const {
			assertRegistrationOrderStillFulfilling,
			register,
			step,
			updatePostRegistrationState,
		} = setup();
		assertRegistrationOrderStillFulfilling.mockRejectedValueOnce(
			new OrderFulfillmentStoppedError("order_not_fulfillable"),
		);

		await expect(step.execute(makeRow(), orderId)).rejects.toMatchObject({
			reason: "order_not_fulfillable",
		});
		expect(register).not.toHaveBeenCalled();
		expect(updatePostRegistrationState).not.toHaveBeenCalled();
	});

	it("uses the stable row key and persists the complete registrar receipt", async () => {
		const {
			assertRegistrationOrderStillFulfilling,
			register,
			step,
			updatePostRegistrationState,
		} = setup();
		const row = makeRow({ whoisPrivacy: true });
		const registered = {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "receipt.com",
			providerOrderId: "registrar-order-42",
			totalPaidUsd: 12.99,
			transferLockExpiresAt: new Date("2026-09-22T00:00:00.000Z"),
		} satisfies DomainRegistrationResult;
		register.mockResolvedValueOnce(registered);

		await expect(step.execute(row, orderId)).resolves.toMatchObject({
			expiresAt: registered.expiresAt,
			providerDomainId: "receipt.com",
			providerOrderId: "registrar-order-42",
			providerTotalPaidUsd: "12.99",
			transferLockExpiresAt: registered.transferLockExpiresAt,
		});
		expect(assertRegistrationOrderStillFulfilling).toHaveBeenCalledWith(
			orderId,
		);
		expect(register).toHaveBeenCalledWith(row.name, registrant, {
			idempotencyKey: `domain-purchase:${domainId}`,
			privacy: true,
			years: 1,
		});
		expect(updatePostRegistrationState).toHaveBeenCalledWith(row, {
			expiresAt: registered.expiresAt,
			providerDomainId: "receipt.com",
			providerOrderId: "registrar-order-42",
			providerTotalPaidUsd: "12.99",
			transferLockExpiresAt: registered.transferLockExpiresAt,
		});
	});

	it("stores nullable optional receipt fields without inventing values", async () => {
		const { register, step, updatePostRegistrationState } = setup();
		register.mockResolvedValueOnce({
			expiresAt: null,
			providerDomainId: "receipt.com",
		});

		await step.execute(makeRow(), orderId);

		expect(updatePostRegistrationState).toHaveBeenCalledWith(
			expect.anything(),
			{
				expiresAt: null,
				providerDomainId: "receipt.com",
				providerOrderId: null,
				providerTotalPaidUsd: null,
				transferLockExpiresAt: null,
			},
		);
	});

	it("replays an ambiguous registrar success with the stable key, then skips once its receipt is stored", async () => {
		const {
			checkAvailability,
			getDomainInfo,
			register,
			step,
			updatePostRegistrationState,
		} = setup();
		const row = makeRow();
		getDomainInfo.mockResolvedValueOnce({
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			id: "example.com",
		});
		register.mockResolvedValueOnce({
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "example.com",
		});

		const recovered = await step.execute(row, orderId);
		await expect(step.execute(recovered, orderId)).resolves.toBe(recovered);

		expect(checkAvailability).not.toHaveBeenCalled();
		expect(register).toHaveBeenCalledTimes(1);
		expect(register).toHaveBeenCalledWith(
			"example.com",
			registrant,
			expect.objectContaining({
				idempotencyKey: `domain-purchase:${domainId}`,
			}),
		);
		expect(updatePostRegistrationState).toHaveBeenCalledTimes(1);
	});

	it("propagates a financial-race CAS loss after registrar spend", async () => {
		const { register, step, updatePostRegistrationState } = setup();
		updatePostRegistrationState.mockRejectedValueOnce(
			new OrderFulfillmentStoppedError("financial_race"),
		);

		await expect(step.execute(makeRow(), orderId)).rejects.toMatchObject({
			reason: "financial_race",
		});
		expect(register).toHaveBeenCalledTimes(1);
	});

	it("preserves retryable versus immediate-terminal registrar classification", async () => {
		class FakeRegistrarError extends Error {
			constructor(
				message: string,
				readonly retryable: boolean,
			) {
				super(message);
			}

			getResponse() {
				return { code: "DOMAIN_PROVIDER_ERROR", message: this.message };
			}
		}

		const terminalFailure = new FakeRegistrarError(
			"Registrar rejected request",
			false,
		);
		const retryableFailure = new FakeRegistrarError("Registrar 502", true);

		for (const [error, immediate] of [
			[terminalFailure, true],
			[retryableFailure, false],
		] as const) {
			const { register, step, updatePostRegistrationState } = setup();
			register.mockRejectedValueOnce(error);

			await expect(step.execute(makeRow(), orderId)).rejects.toBe(error);
			expect(isImmediateTerminalDomainError(error)).toBe(immediate);
			expect(updatePostRegistrationState).not.toHaveBeenCalled();
		}
		expect(domainFailureSummary(terminalFailure)).toBe(
			"Registrar rejected request",
		);
		expect(domainFailureSummary(new Error("network timeout"))).toBe(
			"Domain registration failed",
		);
	});

	it("supports a non-order legacy call without taking a money fence", async () => {
		const { assertRegistrationOrderStillFulfilling, register, step } = setup();

		await step.execute(makeRow({ paymentOrderId: null }), null);

		expect(assertRegistrationOrderStillFulfilling).not.toHaveBeenCalled();
		expect(register).toHaveBeenCalledTimes(1);
	});
});
