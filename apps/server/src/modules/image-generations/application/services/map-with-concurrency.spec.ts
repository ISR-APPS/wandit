import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "./map-with-concurrency";

type Deferred = {
	promise: Promise<void>;
	reject: (reason?: unknown) => void;
	resolve: () => void;
};

function deferred(): Deferred {
	let reject!: Deferred["reject"];
	let resolve!: Deferred["resolve"];
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		reject = rejectPromise;
		resolve = resolvePromise;
	});

	return { promise, reject, resolve };
}

describe("mapWithConcurrency", () => {
	it("caps active work and returns results in input order", async () => {
		let active = 0;
		let maxActive = 0;
		const gates = Array.from({ length: 4 }, deferred);
		const started: number[] = [];
		const run = mapWithConcurrency([1, 2, 3, 4], 2, async (value, index) => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			started.push(value);
			await gates[index]?.promise;
			active -= 1;
			return value * 10;
		});

		await Promise.resolve();
		expect(started).toEqual([1, 2]);

		gates[1]?.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(started).toEqual([1, 2, 3]);

		gates[0]?.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(started).toEqual([1, 2, 3, 4]);

		gates[2]?.resolve();
		gates[3]?.resolve();

		await expect(run).resolves.toEqual([
			{ index: 0, status: "fulfilled", value: 10 },
			{ index: 1, status: "fulfilled", value: 20 },
			{ index: 2, status: "fulfilled", value: 30 },
			{ index: 3, status: "fulfilled", value: 40 },
		]);
		expect(maxActive).toBe(2);
	});

	it("stops launching after a rejection and drains already-started work", async () => {
		const first = deferred();
		const second = deferred();
		const started: number[] = [];
		const run = mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
			started.push(value);
			await (value === 1 ? first.promise : second.promise);
			return value;
		});

		await Promise.resolve();
		first.reject(new Error("failed"));
		await Promise.resolve();
		second.resolve();

		const results = await run;

		expect(started).toEqual([1, 2]);
		expect(results).toHaveLength(2);
		expect(results[0]).toMatchObject({ index: 0, status: "rejected" });
		expect(results[1]).toEqual({ index: 1, status: "fulfilled", value: 2 });
	});

	it("rejects invalid concurrency before starting work", async () => {
		await expect(
			mapWithConcurrency([1], 0, async (value) => value),
		).rejects.toThrow("positive integer");
	});
});
