import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";
import {
	type CreateTurnResponse,
	type TurnDataPart,
	type TurnStreamEvent,
	turnDataPartSchema,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type {
	TurnEventReader,
	TurnStreamEventInput,
} from "../../domain/ports/turn-events";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../../infrastructure/persistence/builder-turns.repository";
import { FakeTurnEventStream } from "../../infrastructure/trigger/fake-turn-events";
import type { RateLimitStore } from "../../presentation/http/guards/redis-rate-limit.guard";
import { TurnStreamRelayService } from "./turn-stream-relay.service";

function fakeReply(options: { stallFirstWrite?: boolean } = {}) {
	const chunks: string[] = [];
	const emitter = new EventEmitter();
	let stalled = false;
	// SAFETY: the relay only touches write/writeHead/flushHeaders/end and
	// `destroyed`; the fake covers exactly those plus EventEmitter events.
	const raw = Object.assign(emitter, {
		destroyed: false,
		end: vi.fn(() => {
			raw.destroyed = true;
		}),
		flushHeaders: vi.fn(),
		write: vi.fn((chunk: string) => {
			chunks.push(chunk);
			// One false answer models a full socket buffer; the drain event
			// the relay waits for fires on the next tick.
			if (options.stallFirstWrite && !stalled) {
				stalled = true;
				setImmediate(() => raw.emit("drain"));
				return false;
			}
			return true;
		}),
		writeHead: vi.fn(),
	}) as unknown as ServerResponse;

	return {
		chunks,
		raw,
		// SAFETY: the relay calls only `hijack` and `raw` on the reply.
		reply: { hijack: vi.fn(), raw } as unknown as FastifyReply,
	};
}

function fakeRequest(userId = "user-1") {
	const raw = new EventEmitter();
	// SAFETY: the relay reads `headers`, `raw`, and `user` only.
	return {
		headers: {},
		raw,
		user: { id: userId },
	} as unknown as FastifyRequest & { user?: { id: string } };
}

function turnRow(overrides: Partial<BuilderTurnRow> = {}): BuilderTurnRow {
	// SAFETY: the relay reads only `id`, `status`, `outputCommitSha`, and
	// `triggerRunId` off the row; the other columns are never touched.
	return {
		id: "turn-1",
		outputCommitSha: null,
		projectId: "project-1",
		status: "queued",
		triggerRunId: "run-1",
		...overrides,
	} as BuilderTurnRow;
}

// A row lookup that answers a fixed snapshot; tests swap `current` to
// model the row changing between polls.
function fakeTurns(current: () => BuilderTurnRow | null) {
	return { findById: vi.fn(async () => current()) };
}

// One stream event with the writer-stamped fields filled in.
function ev(id: string, input: TurnStreamEventInput): TurnStreamEvent {
	return { ...input, at: Date.now(), id };
}

// The `data:` payloads the relay wrote, in order; `[DONE]` stays a string.
function dataFrames(chunks: string[]): string[] {
	return chunks
		.join("")
		.split("\n\n")
		.filter((frame) => frame.startsWith("data:"))
		.map((frame) => frame.slice("data: ".length));
}

// Every frame shape the relay under test writes, plus the terminator.
type BrowserFrame =
	| TurnDataPart
	| { type: "error"; errorText: string }
	| { type: "text-delta"; id: string; delta: string }
	| "[DONE]";

// `dataFrames` parsed back to objects so key order cannot flake a compare.
function parsedFrames(chunks: string[]): BrowserFrame[] {
	return dataFrames(chunks).map(
		(frame): BrowserFrame =>
			// SAFETY: the relay under test writes only the BrowserFrame shapes.
			frame === "[DONE]" ? frame : (JSON.parse(frame) as BrowserFrame),
	);
}

function setup(
	reader?: TurnEventReader,
	turns?: Pick<BuilderTurnsRepository, "findById">,
) {
	const rateLimit: RateLimitStore = {
		hit: vi.fn(async () => ({ count: 1, ttlMs: 60_000 })),
		release: vi.fn(async () => undefined),
	};
	const relay = new TurnStreamRelayService(
		reader ?? new FakeTurnEventStream(),
		rateLimit,
		// A read that ends quietly on a `succeeded` row ends the stream;
		// the tests that care about the row pass their own fake.
		turns ?? fakeTurns(() => turnRow({ status: "succeeded" })),
	);
	return { rateLimit, relay };
}

describe("TurnStreamRelayService.relay", () => {
	it("maps each envelope event to its browser frames, in order, ending with [DONE]", async () => {
		const stream = new FakeTurnEventStream();
		await stream.write("run-1", {
			data: { delta: "hi", id: "t1", type: "text-delta" },
			type: "part",
		});
		await stream.write("run-1", {
			data: { phase: "running" },
			type: "status",
		});
		await stream.write("run-1", {
			data: {
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				credits: 3,
				inputTokens: 1,
				outputTokens: 2,
			},
			type: "usage",
		});
		await stream.write("run-1", {
			data: { code: "TOOL", message: "boom", retryable: true },
			type: "error",
		});
		await stream.write("run-1", {
			data: { outputCommitSha: "sha-1", status: "succeeded" },
			type: "done",
		});
		const { rateLimit, relay } = setup(stream);
		const { chunks, raw, reply } = fakeReply();
		const onDone = vi.fn();

		await relay.relay({
			onDone,
			reply,
			request: fakeRequest(),
			triggerRunId: "run-1",
			turnId: "turn-1",
		});

		expect(reply.hijack).toHaveBeenCalled();
		expect(raw.writeHead).toHaveBeenCalledWith(
			200,
			expect.objectContaining({
				"Content-Type": "text/event-stream",
				"X-Vercel-AI-UI-Message-Stream": "v1",
			}),
		);
		expect(chunks.join("")).toContain(": connected");
		expect(parsedFrames(chunks)).toEqual([
			{ delta: "hi", id: "t1", type: "text-delta" },
			{
				data: { phase: "running" },
				id: "turn-status",
				type: "data-turn-status",
			},
			{
				data: {
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					credits: 3,
					inputTokens: 1,
					outputTokens: 2,
				},
				id: "turn-usage",
				type: "data-turn-usage",
			},
			{
				data: { code: "TOOL", message: "boom", retryable: true },
				id: "turn-error",
				type: "data-turn-error",
			},
			{ errorText: "boom", type: "error" },
			{
				data: { outputCommitSha: "sha-1", status: "succeeded" },
				id: "turn-done",
				type: "data-turn-done",
			},
			"[DONE]",
		]);
		expect(onDone).toHaveBeenCalledWith({
			outputCommitSha: "sha-1",
			status: "succeeded",
		});
		expect(raw.end).toHaveBeenCalled();
		// The open-stream slot the guard took goes back.
		expect(rateLimit.release).toHaveBeenCalledWith(
			"builder:rate:turn-stream:user-1",
		);
	});

	it("parses each of the five browser data parts with the shared schema", () => {
		const parts = [
			{
				data: {
					chatId: "00000000-0000-4000-8000-000000000002",
					runId: "run-1",
					status: "queued",
					streamUrl: "/api/v2/projects/p/turns/active/stream",
					turnId: "00000000-0000-4000-8000-000000000001",
				},
				id: "turn-created",
				type: "data-turn-created",
			},
			{
				data: { phase: "running" },
				id: "turn-status",
				type: "data-turn-status",
			},
			{
				data: {
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					credits: 3,
					inputTokens: 1,
					outputTokens: 2,
				},
				id: "turn-usage",
				type: "data-turn-usage",
			},
			{
				data: { code: "TOOL", message: "boom", retryable: true },
				id: "turn-error",
				type: "data-turn-error",
			},
			{
				data: { status: "succeeded" },
				id: "turn-done",
				type: "data-turn-done",
			},
		];

		for (const part of parts) {
			expect(turnDataPartSchema.safeParse(part).success).toBe(true);
		}
	});

	it("writes `data-turn-created` before anything else when `first` is set", async () => {
		const stream = new FakeTurnEventStream();
		await stream.write("run-1", {
			data: { status: "succeeded" },
			type: "done",
		});
		const { relay } = setup(stream);
		const { chunks, reply } = fakeReply();
		const first: CreateTurnResponse = {
			chatId: "00000000-0000-4000-8000-000000000002",
			runId: "run-1",
			status: "queued",
			streamUrl: "/api/v2/projects/p/turns/active/stream",
			turnId: "00000000-0000-4000-8000-000000000001",
		};

		await relay.relay({
			first,
			reply,
			request: fakeRequest(),
			triggerRunId: "run-1",
			turnId: "turn-1",
		});

		expect(parsedFrames(chunks)[0]).toEqual({
			data: first,
			id: "turn-created",
			type: "data-turn-created",
		});
	});

	it("reopens a quietly-ended read and does not write replayed chunks twice", async () => {
		// The first leg ends without `done` — the 60 s quiet gap. The
		// second leg replays the stream from the start, then lands `done`.
		const firstLeg: TurnStreamEvent[] = [
			ev("0", { data: { phase: "running" }, type: "status" }),
			ev("1", {
				data: { delta: "a", id: "t1", type: "text-delta" },
				type: "part",
			}),
		];
		const secondLeg: TurnStreamEvent[] = [
			...firstLeg,
			ev("2", { data: { status: "succeeded" }, type: "done" }),
		];
		let opens = 0;
		const reader: TurnEventReader = {
			read: () => {
				opens += 1;
				const leg = opens === 1 ? firstLeg : secondLeg;
				return (async function* () {
					for (const event of leg) {
						yield event;
					}
				})();
			},
		};
		const turns = fakeTurns(() => turnRow({ status: "running" }));
		const { relay } = setup(reader, turns);
		const { chunks, reply } = fakeReply();

		await relay.relay({
			reply,
			request: fakeRequest(),
			triggerRunId: "run-1",
			turnId: "turn-1",
		});

		const frames = dataFrames(chunks);
		expect(opens).toBe(2);
		expect(frames.filter((f) => f.includes("data-turn-status"))).toHaveLength(
			1,
		);
		expect(frames.filter((f) => f.includes("text-delta"))).toHaveLength(1);
		expect(frames[frames.length - 1]).toBe("[DONE]");
	});

	it("writes `data-turn-done` from the row when the read ends on a terminal turn", async () => {
		const reader: TurnEventReader = {
			read: () =>
				(async function* () {
					yield ev("0", {
						data: { phase: "committing" },
						type: "status",
					});
				})(),
		};
		const turns = fakeTurns(() =>
			turnRow({ outputCommitSha: "sha-9", status: "succeeded" }),
		);
		const { relay } = setup(reader, turns);
		const { chunks, reply } = fakeReply();
		const onDone = vi.fn();

		await relay.relay({
			onDone,
			reply,
			request: fakeRequest(),
			triggerRunId: "run-1",
			turnId: "turn-1",
		});

		expect(parsedFrames(chunks)).toEqual([
			{
				data: { phase: "committing" },
				id: "turn-status",
				type: "data-turn-status",
			},
			{
				data: { outputCommitSha: "sha-9", status: "succeeded" },
				id: "turn-done",
				type: "data-turn-done",
			},
			"[DONE]",
		]);
		expect(onDone).toHaveBeenCalledWith({
			outputCommitSha: "sha-9",
			status: "succeeded",
		});
	});

	it("ends with error frames and [DONE] when the row vanishes after a quiet read", async () => {
		const reader: TurnEventReader = {
			read: () =>
				(async function* () {
					yield ev("0", {
						data: { phase: "running" },
						type: "status",
					});
				})(),
		};
		const turns = fakeTurns(() => null);
		const { relay } = setup(reader, turns);
		const { chunks, reply } = fakeReply();
		const onDone = vi.fn();

		await relay.relay({
			onDone,
			reply,
			request: fakeRequest(),
			triggerRunId: "run-1",
			turnId: "turn-1",
		});

		expect(parsedFrames(chunks)).toEqual([
			{
				data: { phase: "running" },
				id: "turn-status",
				type: "data-turn-status",
			},
			{
				data: {
					code: "TURN_NOT_FOUND",
					message: "The turn no longer exists",
					retryable: false,
				},
				id: "turn-error",
				type: "data-turn-error",
			},
			{ errorText: "The turn no longer exists", type: "error" },
			"[DONE]",
		]);
		expect(onDone).not.toHaveBeenCalled();
		expect(turns.findById).toHaveBeenCalledTimes(1);
	});

	it("polls the row for a run id when `triggerRunId` is null, then streams", async () => {
		vi.useFakeTimers();
		try {
			const stream = new FakeTurnEventStream();
			await stream.write("run-7", {
				data: { status: "succeeded" },
				type: "done",
			});
			// The row parks `waiting` with no run, then promotion lands one.
			let row: BuilderTurnRow | null = turnRow({
				status: "waiting",
				triggerRunId: null,
			});
			const turns = fakeTurns(() => row);
			const { relay } = setup(stream, turns);
			const { chunks, reply } = fakeReply();

			const done = relay.relay({
				reply,
				request: fakeRequest(),
				triggerRunId: null,
				turnId: "turn-1",
			});
			// Let the first poll see the parked row and enter the wait.
			await vi.advanceTimersByTimeAsync(0);
			row = turnRow({ status: "queued", triggerRunId: "run-7" });
			await vi.advanceTimersByTimeAsync(2_000);
			await done;

			const frames = parsedFrames(chunks);
			expect(turns.findById).toHaveBeenCalledWith("turn-1");
			expect(frames).toContainEqual({
				data: { status: "succeeded" },
				id: "turn-done",
				type: "data-turn-done",
			});
			expect(frames[frames.length - 1]).toBe("[DONE]");
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not release the stream slot when `releaseSlot` is false", async () => {
		const stream = new FakeTurnEventStream();
		await stream.write("run-1", {
			data: { status: "succeeded" },
			type: "done",
		});
		const { rateLimit, relay } = setup(stream);
		const { reply } = fakeReply();

		await relay.relay({
			releaseSlot: false,
			reply,
			request: fakeRequest(),
			triggerRunId: "run-1",
			turnId: "turn-1",
		});

		expect(rateLimit.release).not.toHaveBeenCalled();
	});

	it("ends with error frames and [DONE] when the reader fails", async () => {
		const failingReader: TurnEventReader = {
			read: () => ({
				[Symbol.asyncIterator]() {
					return {
						next: () => Promise.reject(new Error("stream gone")),
					};
				},
			}),
		};
		const { relay } = setup(failingReader);
		const { chunks, raw, reply } = fakeReply();

		await relay.relay({
			reply,
			request: fakeRequest(),
			triggerRunId: "run-9",
			turnId: "turn-9",
		});

		expect(parsedFrames(chunks)).toEqual([
			{
				data: {
					code: "STREAM_READ_FAILED",
					message: "The turn event stream was interrupted",
					retryable: true,
				},
				id: "turn-error",
				type: "data-turn-error",
			},
			{
				errorText: "The turn event stream was interrupted",
				type: "error",
			},
			"[DONE]",
		]);
		expect(raw.end).toHaveBeenCalled();
	});

	it("waits for drain when a write reports backpressure", async () => {
		const stream = new FakeTurnEventStream();
		await stream.write("run-1", {
			data: { phase: "running" },
			type: "status",
		});
		await stream.write("run-1", {
			data: { status: "succeeded" },
			type: "done",
		});
		const { relay } = setup(stream);
		const { chunks, raw, reply } = fakeReply({ stallFirstWrite: true });

		await relay.relay({
			reply,
			request: fakeRequest(),
			triggerRunId: "run-1",
			turnId: "turn-1",
		});

		// The stalled write resolved on drain and the stream still finished.
		expect(chunks.join("")).toContain("data: [DONE]");
		expect(raw.end).toHaveBeenCalled();
	});

	it("writes a heartbeat comment every 15 s while the stream is open", async () => {
		vi.useFakeTimers();
		try {
			const stream = new FakeTurnEventStream();
			const { relay } = setup(stream);
			const { chunks, reply } = fakeReply();

			const done = relay.relay({
				reply,
				request: fakeRequest(),
				triggerRunId: "run-1",
				turnId: "turn-1",
			});
			// The interval registers while the relay settles into its read
			// loop; advancing past 15 s fires it once.
			await vi.advanceTimersByTimeAsync(15_000);

			expect(chunks.join("")).toContain(": heartbeat");

			// Closing the stream ends the read; the default row is terminal,
			// so the relay writes `data-turn-done` and finishes.
			stream.close("run-1");
			await done;
		} finally {
			vi.useRealTimers();
		}
	});

	it("stops reading when the browser disconnects", async () => {
		const stream = new FakeTurnEventStream();
		const { relay } = setup(stream);
		const { raw, reply } = fakeReply();
		const request = fakeRequest();

		const done = relay.relay({
			reply,
			request,
			triggerRunId: "run-1",
			turnId: "turn-1",
		});
		// Emit close on the next tick so the relay is inside `read` already.
		setImmediate(() => request.raw.emit("close"));

		await done;
		expect(raw.end).toHaveBeenCalled();
	});
});
