import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import {
	dispatchBillingError,
	subscribeToBillingErrors,
	toUpgradeModalIntent,
} from "./billing-error-dispatch";

const details = { requiredCredits: 25, availableCredits: 7 };

describe("billing error dispatch", () => {
	it("maps a typed ApiClientError to an upgrade-modal intent", () => {
		const error = new ApiClientError({
			code: "GENERATION_PAYMENT_REQUIRED",
			details,
			message: "Payment required",
			path: "/api/v1/generations",
			requestId: "request-1",
			statusCode: 402,
			timestamp: "2026-08-02T10:00:00.000Z",
		});

		expect(toUpgradeModalIntent(error)).toEqual({
			code: "GENERATION_PAYMENT_REQUIRED",
			...details,
		});
	});

	it("maps and dispatches a data-billing-error stream part", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeToBillingErrors(listener);
		const part = {
			type: "data-billing-error",
			data: {
				code: "INSUFFICIENT_CREDITS",
				statusCode: 402,
				details,
			},
		};

		expect(dispatchBillingError(part)).toEqual({
			code: "INSUFFICIENT_CREDITS",
			...details,
		});
		expect(listener).toHaveBeenCalledWith({
			code: "INSUFFICIENT_CREDITS",
			...details,
		});

		unsubscribe();
	});

	it("accepts decimal 402 details (pricing v4 fractional charges)", () => {
		const decimalDetails = { requiredCredits: 0.1, availableCredits: 0.05 };

		expect(
			toUpgradeModalIntent({
				code: "INSUFFICIENT_CREDITS",
				statusCode: 402,
				details: decimalDetails,
			}),
		).toEqual({ code: "INSUFFICIENT_CREDITS", ...decimalDetails });
	});

	it("accepts a negative decimal available balance (settle overage)", () => {
		const overageDetails = { requiredCredits: 3, availableCredits: -0.42 };

		expect(
			toUpgradeModalIntent({
				code: "GENERATION_PAYMENT_REQUIRED",
				statusCode: 402,
				details: overageDetails,
			}),
		).toEqual({ code: "GENERATION_PAYMENT_REQUIRED", ...overageDetails });
	});

	it("forwards heldCredits so the paywall can explain reserve holds", () => {
		const heldDetails = {
			requiredCredits: 3,
			availableCredits: 6.7,
			heldCredits: 10,
		};

		expect(
			toUpgradeModalIntent({
				code: "INSUFFICIENT_CREDITS",
				statusCode: 402,
				details: heldDetails,
			}),
		).toEqual({ code: "INSUFFICIENT_CREDITS", ...heldDetails });
	});

	it("omits heldCredits when the 402 details lack it (older servers)", () => {
		const intent = toUpgradeModalIntent({
			code: "INSUFFICIENT_CREDITS",
			statusCode: 402,
			details,
		});

		expect(intent).not.toBeNull();
		expect(intent).not.toHaveProperty("heldCredits");
	});

	it("drops a malformed heldCredits but keeps the intent", () => {
		for (const heldCredits of ["10", -1, Number.NaN]) {
			expect(
				toUpgradeModalIntent({
					code: "INSUFFICIENT_CREDITS",
					statusCode: 402,
					details: { ...details, heldCredits },
				}),
			).toEqual({ code: "INSUFFICIENT_CREDITS", ...details });
		}
	});

	it("maps decimal member-limit details to the member-limit intent", () => {
		const limitDetails = {
			limitCredits: 100,
			spentCredits: 99.95,
			requiredCredits: 0.1,
		};

		expect(
			toUpgradeModalIntent({
				code: "MEMBER_CREDIT_LIMIT_REACHED",
				statusCode: 403,
				details: limitDetails,
			}),
		).toEqual({ code: "MEMBER_CREDIT_LIMIT_REACHED", ...limitDetails });
	});

	it("ignores unrelated and malformed errors", () => {
		expect(
			toUpgradeModalIntent({
				code: "INSUFFICIENT_CREDITS",
				statusCode: 400,
				details,
			}),
		).toBeNull();
		expect(
			toUpgradeModalIntent({
				code: "INSUFFICIENT_CREDITS",
				statusCode: 402,
				details: { requiredCredits: "25", availableCredits: 7 },
			}),
		).toBeNull();
		expect(
			toUpgradeModalIntent({
				code: "INSUFFICIENT_CREDITS",
				statusCode: 402,
				details: { requiredCredits: 0, availableCredits: 7 },
			}),
		).toBeNull();
	});
});
