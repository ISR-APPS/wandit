import { describe, expect, it } from "vitest";

import { AffiliateClickThrottle } from "./affiliate-click-throttle";

describe("AffiliateClickThrottle", () => {
	it("rejects an IP's eleventh request without consuming another IP's budget", () => {
		const throttle = new AffiliateClickThrottle();
		const now = 1_000_000;

		for (let request = 0; request < 10; request += 1) {
			expect(throttle.allow("198.51.100.10", now + request)).toBe(true);
		}

		expect(throttle.allow("198.51.100.10", now + 10)).toBe(false);
		expect(throttle.allow("203.0.113.20", now + 10)).toBe(true);
	});
});
