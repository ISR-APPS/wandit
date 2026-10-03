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

/**
 * Nest token for the reader of host-run turns (`runner = host`): a Redis
 * Stream keyed by the turn id instead of a Trigger.dev run id.
 */
export const HOST_TURN_EVENT_READER = Symbol.for(
	"app-builder.host-turn-event-reader",
);

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
	/**
	 * `streamId` names the stream: the Trigger.dev run id of the turn's task,
	 * or the turn id for the host reader.
	 */
	read(streamId: string, signal: AbortSignal): AsyncIterable<TurnStreamEvent>;
}
