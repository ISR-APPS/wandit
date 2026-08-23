import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import {
	isInsufficientCreditsApiError,
	precheckCreateBalance,
} from "./create-precheck";

function apiError(statusCode: number, code: string): ApiClientError {
	return new ApiClientError({
		code,
		details: undefined,
		message: "refused",
		path: "/api/v1/projects",
		requestId: "req_1",
		statusCode,
		timestamp: "2026-08-22T00:00:00.000Z",
	});
}

describe("precheckCreateBalance", () => {
	it("blocks a zero or negative balance (opens the insufficient dialog)", () => {
		expect(precheckCreateBalance(0)).toBe("insufficient");
		expect(precheckCreateBalance(-3.5)).toBe("insufficient");
	});

	it("allows any positive balance, however small", () => {
		expect(precheckCreateBalance(0.01)).toBe("ok");
		expect(precheckCreateBalance(1)).toBe("ok");
		expect(precheckCreateBalance(250)).toBe("ok");
	});

	it("reports an unloaded balance instead of guessing", () => {
		expect(precheckCreateBalance(undefined)).toBe("balance-unavailable");
	});
});

describe("isInsufficientCreditsApiError", () => {
	it("matches the server 402 credit refusals", () => {
		expect(
			isInsufficientCreditsApiError(apiError(402, "INSUFFICIENT_CREDITS")),
		).toBe(true);
		expect(
			isInsufficientCreditsApiError(
				apiError(402, "GENERATION_PAYMENT_REQUIRED"),
			),
		).toBe(true);
	});

	it("ignores other failures", () => {
		expect(
			isInsufficientCreditsApiError(apiError(402, "PAYMENT_PAST_DUE")),
		).toBe(false);
		expect(
			isInsufficientCreditsApiError(apiError(500, "INSUFFICIENT_CREDITS")),
		).toBe(false);
		expect(isInsufficientCreditsApiError(new Error("network down"))).toBe(
			false,
		);
	});
});
