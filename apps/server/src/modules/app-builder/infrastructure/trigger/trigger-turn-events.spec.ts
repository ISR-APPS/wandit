import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { streams } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TriggerTurnEventReader } from "./trigger-turn-events";

vi.mock("@trigger.dev/sdk", () => ({
	streams: { read: vi.fn() },
}));

const readMock = vi.mocked(streams.read);
const INITIAL_TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY;

function asyncStream(items: unknown[]): AsyncIterable<unknown> {
	return (async function* () {
		for (const item of items) {
			yield item;
		}
	})();
}

beforeEach(() => {
	readMock.mockReset();
	// The reader throws V2_ENV_MISSING without the key; most cases need one.
	// SAFETY: the env object may be process.env (skipValidation), where only
	// deleteProperty models a missing key — assignment coerces to a string.
	(env as { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
		"trigger-secret";
});

afterEach(() => {
	if (INITIAL_TRIGGER_SECRET_KEY === undefined) {
		Reflect.deleteProperty(env, "TRIGGER_SECRET_KEY");
	} else {
		// SAFETY: restores the value the process had before the suite ran.
		(env as { TRIGGER_SECRET_KEY?: string }).TRIGGER_SECRET_KEY =
			INITIAL_TRIGGER_SECRET_KEY;
	}
});

describe("TriggerTurnEventReader.read", () => {
	it("yields parsed events and drops malformed items", async () => {
		readMock.mockResolvedValue(
			// SAFETY: the reader only `for await`s the result; a plain
			// generator is structurally an AsyncIterable.
			asyncStream([
				{
					at: 1,
					data: { phase: "running" },
					id: "0",
					type: "status",
				},
				{ not: "an event" },
				{
					at: 2,
					data: { status: "succeeded" },
					id: "1",
					type: "done",
				},
			]) as never,
		);

		const reader = new TriggerTurnEventReader();
		const seen: string[] = [];
		for await (const event of reader.read(
			"run-1",
			new AbortController().signal,
		)) {
			seen.push(event.type);
		}

		expect(seen).toEqual(["status", "done"]);
		expect(readMock).toHaveBeenCalledWith(
			"run-1",
			"ui",
			expect.objectContaining({ timeoutInSeconds: 60 }),
		);
	});

	it("throws V2_ENV_MISSING when the Trigger key is unset", async () => {
		// deleteProperty, not `= undefined`: on process.env the assignment
		// would coerce to the truthy string "undefined".
		Reflect.deleteProperty(env, "TRIGGER_SECRET_KEY");
		const reader = new TriggerTurnEventReader();

		const iterate = async () => {
			for await (const _event of reader.read(
				"run-1",
				new AbortController().signal,
			)) {
				// no-op
			}
		};

		await expect(iterate()).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(readMock).not.toHaveBeenCalled();
	});

	it("returns quietly when the signal aborts during open", async () => {
		readMock.mockRejectedValue(new Error("aborted"));
		const controller = new AbortController();
		controller.abort();
		const reader = new TriggerTurnEventReader();

		const seen: string[] = [];
		for await (const event of reader.read("run-1", controller.signal)) {
			seen.push(event.type);
		}

		expect(seen).toEqual([]);
	});

	it("rethrows a real open failure so the relay can answer error", async () => {
		readMock.mockRejectedValue(new Error("trigger api down"));
		const reader = new TriggerTurnEventReader();

		const iterate = async () => {
			for await (const _event of reader.read(
				"run-1",
				new AbortController().signal,
			)) {
				// no-op
			}
		};

		await expect(iterate()).rejects.toThrow("trigger api down");
	});

	it("logs and rethrows when the stream fails after a good event", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => {});
		readMock.mockResolvedValue(
			// SAFETY: the reader only `for await`s the result; a plain
			// generator is structurally an AsyncIterable.
			(async function* () {
				yield {
					at: 1,
					data: { phase: "running" },
					id: "0",
					type: "status",
				};
				throw new Error("stream broke");
			})() as never,
		);
		const reader = new TriggerTurnEventReader();
		const seen: string[] = [];

		const iterate = async () => {
			for await (const event of reader.read(
				"run-1",
				new AbortController().signal,
			)) {
				seen.push(event.type);
			}
		};

		await expect(iterate()).rejects.toThrow("stream broke");
		expect(seen).toEqual(["status"]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("run-1"));
		warn.mockRestore();
	});
});
