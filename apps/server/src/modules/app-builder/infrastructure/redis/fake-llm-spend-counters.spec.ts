import { describe, expect, it } from "vitest";

import { FakeLlmSpendCounters } from "./fake-llm-spend-counters";

describe("FakeLlmSpendCounters", () => {
	it("sums run spend in micros and reads it back", async () => {
		const counters = new FakeLlmSpendCounters();

		expect(await counters.addRunSpend("run_1", 500, 3600)).toBe(500);
		expect(await counters.addRunSpend("run_1", 250, 3600)).toBe(750);
		expect(await counters.readRunSpend("run_1")).toBe(750);
		// Other runs stay at zero.
		expect(await counters.readRunSpend("run_2")).toBe(0);
	});

	it("expires run spend after its TTL", async () => {
		let now = 1_000;
		const counters = new FakeLlmSpendCounters(() => now);
		await counters.addRunSpend("run_1", 500, 10);

		now += 11_000;
		expect(await counters.readRunSpend("run_1")).toBe(0);
	});

	it("keeps a one-minute fixed window for the run rate limit", async () => {
		let now = 1_000;
		const counters = new FakeLlmSpendCounters(() => now);

		expect(await counters.hitRunRateLimit("run_1")).toBe(1);
		expect(await counters.hitRunRateLimit("run_1")).toBe(2);

		// The window started at the first hit, not at the latest hit.
		now += 59_000;
		expect(await counters.hitRunRateLimit("run_1")).toBe(3);
		now += 2_000;
		expect(await counters.hitRunRateLimit("run_1")).toBe(1);
	});

	it("sums user spend per day key", async () => {
		const counters = new FakeLlmSpendCounters();
		await counters.addUserSpend("user_1", "20260914", 100);
		await counters.addUserSpend("user_1", "20260914", 50);
		await counters.addUserSpend("user_1", "20260915", 9);

		expect(await counters.readUserSpend("user_1", "20260914")).toBe(150);
		expect(await counters.readUserSpend("user_1", "20260915")).toBe(9);
	});

	it("remembers revoked runs", async () => {
		const counters = new FakeLlmSpendCounters();

		expect(await counters.isRunRevoked("run_1")).toBe(false);
		await counters.revokeRun("run_1", 3600);
		expect(await counters.isRunRevoked("run_1")).toBe(true);
		// Other runs stay untouched.
		expect(await counters.isRunRevoked("run_2")).toBe(false);
	});
});
