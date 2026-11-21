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

function balanceOf(settledBalance: number, starterPassRequired?: boolean) {
	return {
		plan: 0,
		promo: settledBalance,
		topup: 0,
		balance: settledBalance,
		settledBalance,
		settledPlan: 0,
		settledPromo: settledBalance,
		settledTopup: 0,
		starterPassRequired,
	};
}

describe("precheckCreateBalance", () => {
	// "insufficient" opens the dialog. A pool with no Starter pass is blocked whatever its balance.
	it.each([
		{ settled: 0, starterPassRequired: undefined, result: "insufficient" },
		{ settled: -3.5, starterPassRequired: undefined, result: "insufficient" },
		{ settled: 50, starterPassRequired: true, result: "insufficient" },
		{ settled: 0.01, starterPassRequired: false, result: "ok" },
	])("answers $result for $settled credits, starterPassRequired $starterPassRequired", ({
		settled,
		starterPassRequired,
		result,
	}) => {
		expect(precheckCreateBalance(balanceOf(settled, starterPassRequired))).toBe(
			result,
		);
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
