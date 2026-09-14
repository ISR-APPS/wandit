import { describe, expect, it } from "vitest";

import { FakeTurnLock } from "./fake-turn-lock";

const TTL_MS = 30_000;

describe("FakeTurnLock", () => {
	it("fails a second acquire while the lock is held", async () => {
		const lock = new FakeTurnLock();

		expect(await lock.acquire("p1", "turn-1", TTL_MS)).toBe(true);
		expect(await lock.acquire("p1", "turn-2", TTL_MS)).toBe(false);
		expect(await lock.holder("p1")).toBe("turn-1");
	});

	it("returns false when the releasing turn id does not match", async () => {
		const lock = new FakeTurnLock();
		await lock.acquire("p1", "turn-1", TTL_MS);

		expect(await lock.release("p1", "turn-2")).toBe(false);
		expect(await lock.holder("p1")).toBe("turn-1");
		expect(await lock.release("p1", "turn-1")).toBe(true);
		expect(await lock.holder("p1")).toBeNull();
	});

	it("lets a new turn acquire an expired entry", async () => {
		let now = 1_000;
		const lock = new FakeTurnLock(() => now);

		expect(await lock.acquire("p1", "turn-1", TTL_MS)).toBe(true);
		now += TTL_MS + 1;

		expect(await lock.acquire("p1", "turn-2", TTL_MS)).toBe(true);
		expect(await lock.holder("p1")).toBe("turn-2");
	});

	it("refreshes only for the holding turn", async () => {
		let now = 1_000;
		const lock = new FakeTurnLock(() => now);
		await lock.acquire("p1", "turn-1", TTL_MS);

		expect(await lock.refresh("p1", "turn-2", TTL_MS)).toBe(false);
		expect(await lock.refresh("p1", "turn-1", TTL_MS)).toBe(true);

		now += TTL_MS - 1;
		expect(await lock.holder("p1")).toBe("turn-1");
		now += 2;
		expect(await lock.holder("p1")).toBeNull();
	});
});
