import { describe, expect, it } from "vitest";

import { StoryLinkClickThrottle } from "./story-link-click-throttle";

describe("StoryLinkClickThrottle", () => {
	it("rejects an IP's thirty-first request without consuming another IP's budget", () => {
		const throttle = new StoryLinkClickThrottle();
		const now = 1_000_000;

		for (let request = 0; request < 30; request += 1) {
			expect(throttle.allow("198.51.100.10", now + request)).toBe(true);
		}

		expect(throttle.allow("198.51.100.10", now + 30)).toBe(false);
		expect(throttle.allow("203.0.113.20", now + 30)).toBe(true);
	});
});
