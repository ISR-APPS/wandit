import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api-client";

import { isPhoneTakenError } from "./phone-availability";

function apiError(statusCode: number, code: string): ApiClientError {
	return new ApiClientError({
		code,
		message: "refused",
		path: "/api/v1/onboarding/complete",
		requestId: "req_1",
		statusCode,
		timestamp: "2026-09-14T10:00:00.000Z",
	});
}

describe("isPhoneTakenError", () => {
	it("is true for the PHONE_ALREADY_TAKEN reply", () => {
		expect(isPhoneTakenError(apiError(409, "PHONE_ALREADY_TAKEN"))).toBe(true);
	});

	it.each([
		["another conflict code", apiError(409, "MANUAL_REQUEST_PENDING")],
		["a validation rejection", apiError(400, "VALIDATION_ERROR")],
	])("is false for %s", (_description, error) => {
		expect(isPhoneTakenError(error)).toBe(false);
	});

	it("is false for a non-API failure", () => {
		expect(isPhoneTakenError(new Error("offline"))).toBe(false);
	});
});
