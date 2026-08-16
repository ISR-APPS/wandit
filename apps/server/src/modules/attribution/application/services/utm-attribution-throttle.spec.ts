import { describe, expect, it } from "vitest";

import { UtmAttributionThrottle } from "./utm-attribution-throttle";

describe("UtmAttributionThrottle", () => {
	it("allows thirty requests per IP and rejects the thirty-first", () => {
		const throttle = new UtmAttributionThrottle();
		const now = 1_000_000;

		for (let request = 0; request < 30; request += 1) {
			expect(throttle.allow("198.51.100.10", now + request)).toBe(true);
		}

		expect(throttle.allow("198.51.100.10", now + 30)).toBe(false);
		expect(throttle.allow("203.0.113.20", now + 30)).toBe(true);
	});

	it("restores the request budget after the one-minute window", () => {
		const throttle = new UtmAttributionThrottle();
		const now = 1_000_000;

		for (let request = 0; request < 30; request += 1) {
			throttle.allow("198.51.100.10", now);
		}

		expect(throttle.allow("198.51.100.10", now + 59_999)).toBe(false);
		expect(throttle.allow("198.51.100.10", now + 60_000)).toBe(true);
	});
});
