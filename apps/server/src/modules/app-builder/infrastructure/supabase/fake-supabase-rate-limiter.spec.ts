import { describe, expect, it } from "vitest";

import { FakeSupabaseRateLimiter } from "./fake-supabase-rate-limiter";

describe("FakeSupabaseRateLimiter", () => {
	it("answers the scripted waits in order and records each call", async () => {
		const limiter = new FakeSupabaseRateLimiter([1_500, 250]);

		expect(await limiter.take("supabase:rl:org", 120)).toBe(1_500);
		expect(await limiter.take("supabase:rl:org", 120)).toBe(250);
		// The queue is empty; the default answer is 0.
		expect(await limiter.take("supabase:rl:project:abc", 30)).toBe(0);
		expect(limiter.calls).toEqual([
			{ bucket: "supabase:rl:org", limitPerMinute: 120 },
			{ bucket: "supabase:rl:org", limitPerMinute: 120 },
			{ bucket: "supabase:rl:project:abc", limitPerMinute: 30 },
		]);
	});
});
