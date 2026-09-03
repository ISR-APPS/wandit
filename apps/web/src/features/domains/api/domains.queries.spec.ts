import { describe, expect, it } from "vitest";

import { dnsStatusRefetchInterval } from "./domains.queries";

describe("dnsStatusRefetchInterval", () => {
	it("polls gently while enabled and the last request succeeded", () => {
		expect(dnsStatusRefetchInterval(true, false)).toBe(20_000);
	});

	it("stops after a request error or when polling is disabled", () => {
		expect(dnsStatusRefetchInterval(true, true)).toBe(false);
		expect(dnsStatusRefetchInterval(false, false)).toBe(false);
	});
});
