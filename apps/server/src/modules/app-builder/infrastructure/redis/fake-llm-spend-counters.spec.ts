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
		const hits = async () =>
			(
				await counters.admitRequest(
					{ chatId: null, runId: "run_1", userId: "user_1" },
					"20260914",
				)
			).rateHits;

		expect(await hits()).toBe(1);
		expect(await hits()).toBe(2);

		// The window started at the first hit, not at the latest hit.
		now += 59_000;
		expect(await hits()).toBe(3);
		now += 2_000;
		expect(await hits()).toBe(1);
	});

	it("reads the user spend of the admitted day key", async () => {
		const counters = new FakeLlmSpendCounters();
		await counters.addUserSpend("user_1", "20260914", 100);
		await counters.addUserSpend("user_1", "20260914", 50);
		await counters.addUserSpend("user_1", "20260915", 9);

		const admission = await counters.admitRequest(
			{ chatId: null, runId: "run_1", userId: "user_1" },
			"20260914",
		);

		expect(admission.userSpendMicros).toBe(150);
	});

	it("remembers revoked runs", async () => {
		const counters = new FakeLlmSpendCounters();
		const revoked = async (runId: string) =>
			(
				await counters.admitRequest(
					{ chatId: null, runId, userId: "user_1" },
					"20260914",
				)
			).revoked;

		expect(await revoked("run_1")).toBe(false);
		await counters.revokeRun("run_1", 3600);
		expect(await revoked("run_1")).toBe(true);
		// Other runs stay untouched.
		expect(await revoked("run_2")).toBe(false);
	});

	it("counts a request in flight from the admit to the finish", async () => {
		const counters = new FakeLlmSpendCounters();

		const token = { chatId: null, runId: "run_1", userId: "user_1" };
		await counters.admitRequest(token, "20260914");
		await counters.admitRequest(token, "20260914");
		expect(await counters.readInFlight("run_1")).toBe(2);

		await counters.finishRequest("run_1");
		await counters.finishRequest("run_1");
		expect(await counters.readInFlight("run_1")).toBe(0);
	});

	it("follows a chat binding to its run, and unbinds only for its turn", async () => {
		const counters = new FakeLlmSpendCounters();
		const binding = {
			capUsd: 1,
			plan: "pro" as const,
			projectId: "p-1",
			runId: "run_now",
			turnId: "turn-now",
			userId: "user_1",
			workspaceId: null,
		};
		await counters.bindChat("chat-1", binding, 3600);

		const admission = await counters.admitRequest(
			{ chatId: "chat-1", runId: "run_old", userId: "user_1" },
			"20260914",
		);
		expect(admission.binding).toEqual(binding);
		expect(await counters.readInFlight("run_now")).toBe(1);

		// A late cleanup of another turn leaves the binding in place.
		await counters.unbindChat("chat-1", "turn-old");
		expect(counters.chats.has("chat-1")).toBe(true);
		await counters.unbindChat("chat-1", "turn-now");
		expect(counters.chats.has("chat-1")).toBe(false);
	});
});
