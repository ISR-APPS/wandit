import { describe, expect, it } from "vitest";

import { FakeTurnEventStream } from "./fake-turn-events";

describe("FakeTurnEventStream", () => {
	it("replays written events in order with increasing stamps", async () => {
		const stream = new FakeTurnEventStream();
		const turnId = "turn-1";

		await stream.write(turnId, {
			data: { phase: "sandbox_waking" },
			type: "status",
		});
		await stream.write(turnId, {
			data: { arbitrary: true },
			type: "part",
		});
		await stream.write(turnId, {
			data: { status: "succeeded" },
			type: "done",
		});
		stream.close(turnId);

		const events = [];
		for await (const event of stream.read(
			turnId,
			new AbortController().signal,
		)) {
			events.push(event);
		}

		expect(events.map((event) => event.type)).toEqual([
			"status",
			"part",
			"done",
		]);
		expect(events.map((event) => event.id)).toEqual(["0", "1", "2"]);
		const stamps = events.map((event) => event.at);
		expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
	});

	it("delivers events written after read starts, until close", async () => {
		const stream = new FakeTurnEventStream();
		const turnId = "turn-2";

		const events: string[] = [];
		const reading = (async () => {
			for await (const event of stream.read(
				turnId,
				new AbortController().signal,
			)) {
				events.push(event.type);
			}
		})();

		await stream.write(turnId, {
			data: { phase: "running" },
			type: "status",
		});
		// Let the reader drain, then close.
		await new Promise((resolve) => setTimeout(resolve, 0));
		stream.close(turnId);
		await reading;

		expect(events).toEqual(["status"]);
	});

	it("ends read when the signal aborts", async () => {
		const stream = new FakeTurnEventStream();
		const turnId = "turn-3";
		const controller = new AbortController();

		const reading = (async () => {
			const seen: string[] = [];
			for await (const event of stream.read(turnId, controller.signal)) {
				seen.push(event.type);
			}
			return seen;
		})();

		controller.abort();
		await expect(reading).resolves.toEqual([]);
	});
});
