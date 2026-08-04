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
	});
});
