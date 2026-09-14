/**
 * Port: the turn event stream (D20 — one box for the whole stream).
 * The builder-turn task writes through `TurnEventWriter`; the API SSE
 * route reads through `TurnEventReader`. WANDIT-166 and WANDIT-167
 * implement the two sides on the Trigger.dev stream `ui`.
 */
import type { TurnStreamEvent } from "@wandit/contracts";

/** Nest token for the `TurnEventWriter` implementation. */
export const TURN_EVENT_WRITER = Symbol.for("app-builder.turn-event-writer");

/** Nest token for the `TurnEventReader` implementation. */
export const TURN_EVENT_READER = Symbol.for("app-builder.turn-event-reader");

// `Omit` on a union keeps only the shared keys; this distributes per
// variant so `data` survives.
type DistributiveOmit<T, K extends string> = T extends T ? Omit<T, K> : never;

/**
 * A stream event without the writer-stamped fields. `write()` adds `id`
 * (stream position) and `at` (`Date.now()` in ms).
 */
export type TurnStreamEventInput = DistributiveOmit<
	TurnStreamEvent,
	"id" | "at"
>;

/** Append side of the stream, used by the task. */
export interface TurnEventWriter {
	write(turnId: string, event: TurnStreamEventInput): Promise<void>;
}

/**
 * Read side of the stream, used by the API. Reads from the start, then
 * live; ends when the turn stream closes or the signal aborts.
 */
export interface TurnEventReader {
	/** `triggerRunId` is the Trigger.dev run id of the turn's task. */
	read(
		triggerRunId: string,
		signal: AbortSignal,
	): AsyncIterable<TurnStreamEvent>;
}
