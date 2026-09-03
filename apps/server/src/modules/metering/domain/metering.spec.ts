import { describe, expect, it } from "vitest";

import { GatewayUsagePendingError, isGatewayUsagePending } from "./metering";

describe("isGatewayUsagePending", () => {
	it("treats the typed pending error as pending", () => {
		expect(
			isGatewayUsagePending(new GatewayUsagePendingError("event-1", ["gen_1"])),
		).toBe(true);
	});

	it.each([
		404, 408, 425, 429, 500, 502, 503,
	])("retries transient HTTP status %d", (statusCode) => {
		expect(
			isGatewayUsagePending(
				Object.assign(new Error("lookup failed"), { statusCode }),
			),
		).toBe(true);
	});

	it("reads a plain `status` field when `statusCode` is absent", () => {
		expect(
			isGatewayUsagePending(
				Object.assign(new Error("lookup failed"), { status: 503 }),
			),
		).toBe(true);
	});

	it.each([
		400, 401, 403, 422,
	])("terminalizes contract-level HTTP status %d", (statusCode) => {
		expect(
			isGatewayUsagePending(
				Object.assign(new Error("lookup failed"), { statusCode }),
			),
		).toBe(false);
	});

	it.each([
		"ECONNRESET",
		"ECONNREFUSED",
		"ETIMEDOUT",
		"EAI_AGAIN",
		"EPIPE",
	])("retries network failure code %s", (code) => {
		expect(
			isGatewayUsagePending(
				Object.assign(new Error("socket trouble"), { code }),
			),
		).toBe(true);
	});

	it("retries undici error codes, also when nested under cause", () => {
		expect(
			isGatewayUsagePending(
				Object.assign(new Error("closed"), { code: "UND_ERR_SOCKET" }),
			),
		).toBe(true);
		expect(
			isGatewayUsagePending(
				Object.assign(new Error("request failed"), {
					cause: Object.assign(new Error("closed"), {
						code: "UND_ERR_CONNECT_TIMEOUT",
					}),
				}),
			),
		).toBe(true);
	});

	it("retries `fetch failed` TypeErrors and abort/timeout names", () => {
		expect(isGatewayUsagePending(new TypeError("fetch failed"))).toBe(true);

		const abortError = new Error("This operation was aborted");
		abortError.name = "AbortError";
		expect(isGatewayUsagePending(abortError)).toBe(true);

		const timeoutError = new Error("The operation timed out");
		timeoutError.name = "TimeoutError";
		expect(isGatewayUsagePending(timeoutError)).toBe(true);
	});

	it("honors an explicit retryable marker and the usage-not-found messages", () => {
		expect(
			isGatewayUsagePending(
				Object.assign(new Error("key missing"), { retryable: true }),
			),
		).toBe(true);
		expect(isGatewayUsagePending(new Error("Usage event not found"))).toBe(
			true,
		);
	});

	it("keeps plain errors terminal", () => {
		expect(isGatewayUsagePending(new Error("bad request shape"))).toBe(false);
		expect(isGatewayUsagePending(null)).toBe(false);
		expect(isGatewayUsagePending("boom")).toBe(false);
	});
});
