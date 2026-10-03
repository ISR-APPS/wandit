import { describe, expect, it } from "vitest";

import {
	RedisTurnEventReader,
	RedisTurnEventWriter,
	type TurnEventsReadClient,
	type TurnEventsWriteChain,
	type TurnEventsWriteClient,
	turnEventsKey,
} from "./redis-turn-events";

/** A `multi()` fake that records each XADD and EXPIRE in call order. */
function fakeMulti() {
	const appended: { key: string; event: string }[] = [];
	const expired: string[] = [];
	const redis: TurnEventsWriteClient = {
		multi: () => {
			const pending: (() => void)[] = [];
			const chain: TurnEventsWriteChain = {
				exec: async () => {
					for (const step of pending) step();
					return [];
				},
				expire: (key) => {
					pending.push(() => expired.push(key));
					return chain;
				},
				xadd: (key, _id, _field, event) => {
					pending.push(() => appended.push({ event, key }));
					return chain;
				},
			};
			return chain;
		},
	};
	return { appended, expired, redis };
}

describe("RedisTurnEventWriter", () => {
	it("stamps ids in write order and appends them in that order", async () => {
		const { appended, expired, redis } = fakeMulti();
		const writer = new RedisTurnEventWriter(redis, () => 1_000);

		await writer.write("turn-1", {
			data: { phase: "running" },
			type: "status",
		});
		await writer.write("turn-1", {
			data: { status: "succeeded" },
			type: "done",
		});
		await writer.close();

		expect(appended.map((entry) => JSON.parse(entry.event))).toEqual([
			{ at: 1_000, data: { phase: "running" }, id: "1", type: "status" },
			{ at: 1_000, data: { status: "succeeded" }, id: "2", type: "done" },
		]);
		expect(appended[0]?.key).toBe(turnEventsKey("turn-1"));
		expect(expired).toEqual([turnEventsKey("turn-1"), turnEventsKey("turn-1")]);
	});

	it("continues the ids after the entries a dead writer left", async () => {
		const { appended, redis } = fakeMulti();
		const writer = new RedisTurnEventWriter(redis, () => 1_000, 7);

		await writer.write("turn-1", { data: { status: "failed" }, type: "done" });
		await writer.close();

		expect(JSON.parse(appended[0]?.event ?? "{}").id).toBe("8");
	});

	it("drops a write after close", async () => {
		const { appended, redis } = fakeMulti();
		const writer = new RedisTurnEventWriter(redis);
		await writer.close();

		await writer.write("turn-1", { data: { status: "failed" }, type: "done" });

		expect(appended).toHaveLength(0);
	});
});

/** A read client that answers each XREAD with the next scripted batch. */
function fakeReadClient(batches: [string, string[]][][]): TurnEventsReadClient {
	return {
		disconnect: () => undefined,
		xread: async () => {
			const rows = batches.shift();
			return rows === undefined ? null : [["key", rows]];
		},
	};
}

const statusEvent = JSON.stringify({
	at: 1,
	data: { phase: "running" },
	id: "1",
	type: "status",
});
const doneEvent = JSON.stringify({
	at: 2,
	data: { status: "succeeded" },
	id: "2",
	type: "done",
});

describe("RedisTurnEventReader", () => {
	it("replays the events, skips a bad entry, and ends at done", async () => {
		const reader = new RedisTurnEventReader(() =>
			fakeReadClient([
				[
					["1-0", ["event", statusEvent]],
					["2-0", ["event", "not json"]],
				],
				[["3-0", ["event", doneEvent]]],
			]),
		);

		const types: string[] = [];
		for await (const event of reader.read(
			"turn-1",
			new AbortController().signal,
		)) {
			types.push(event.type);
		}

		expect(types).toEqual(["status", "done"]);
	});

	it("goes on from the same cursor on a new client after a command timeout", async () => {
		const cursors: string[] = [];
		const timingOut: TurnEventsReadClient = {
			disconnect: () => undefined,
			xread: async (_block, _ms, _streams, _key, id) => {
				cursors.push(id);
				if (id === "0") {
					return [["key", [["1-0", ["event", statusEvent]]]]];
				}
				throw new Error("Command timed out");
			},
		};
		const clients = [
			timingOut,
			{
				disconnect: () => undefined,
				xread: async (
					_block: "BLOCK",
					_ms: number,
					_streams: "STREAMS",
					_key: string,
					id: string,
				): ReturnType<TurnEventsReadClient["xread"]> => {
					cursors.push(id);
					return [["key", [["2-0", ["event", doneEvent]]]]];
				},
			},
		];
		const reader = new RedisTurnEventReader(() => {
			const next = clients.shift();
			if (next === undefined) {
				throw new Error("no more clients");
			}
			return next;
		});

		const types: string[] = [];
		for await (const event of reader.read(
			"turn-1",
			new AbortController().signal,
		)) {
			types.push(event.type);
		}

		expect(types).toEqual(["status", "done"]);
		expect(cursors).toEqual(["0", "1-0", "1-0"]);
	});

	it("ends at once when the signal is aborted", async () => {
		const reader = new RedisTurnEventReader(() =>
			fakeReadClient([[["1-0", ["event", statusEvent]]]]),
		);
		const controller = new AbortController();
		controller.abort();

		const types: string[] = [];
		for await (const event of reader.read("turn-1", controller.signal)) {
			types.push(event.type);
		}

		expect(types).toEqual([]);
	});
});
