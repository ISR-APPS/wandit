/**
 * `TurnEventReader` on the Trigger.dev stream `ui` (D20).
 * Called by `turn-stream-relay.service.ts` in the API process; the writer
 * side lives in the task (WANDIT-166). This is the only API file allowed
 * to import the Trigger streams API — `trigger-isolation.spec.ts` enforces
 * that so a future Redis Streams fallback (D20 thresholds) swaps one file.
 */
import {
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { streams } from "@trigger.dev/sdk";
import { type TurnStreamEvent, turnStreamEventSchema } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import type {
	TurnEventReader,
	TurnEventWriter,
	TurnStreamEventInput,
} from "../../domain/ports/turn-events";

/**
 * The vendor closes the read after 60 s without data. A long tool call is
 * quiet longer, so the relay reopens the read while the turn row is not
 * terminal.
 */
const STREAM_READ_TIMEOUT_SECONDS = 60;

/**
 * `TurnEventWriter` on the Trigger.dev stream `ui` (D20). The
 * `builder-turn` task constructs it inside the run, so `target` defaults
 * to `self`. `streams.writer` encodes every `write(part)` as
 * `JSON.stringify({ data: part, id })` and the SDK read yields `data`
 * back as the object; the raw `streams.append` sends BodyInit and is not
 * safe for this envelope.
 */
export class TriggerTurnEventWriter implements TurnEventWriter {
	private readonly logger = new Logger(TriggerTurnEventWriter.name);
	private sequence = 0;
	private isClosed = false;

	/** Resolves with the SDK `write` once `execute` runs (it may run late). */
	private readonly ready: Promise<(part: TurnStreamEvent) => void>;
	private resolveWrite: (write: (part: TurnStreamEvent) => void) => void =
		() => {};

	/** Resolves in `close()`; `execute` returns it to end the stream. */
	private readonly closed: Promise<void>;
	private resolveClosed: () => void = () => {};

	/** Pipe result of `streams.writer`; `close()` awaits its flush. */
	private readonly pipeResult: ReturnType<(typeof streams)["writer"]>;

	// A Promise executor runs synchronously, so both fields are set before any call.
	constructor() {
		this.ready = new Promise((resolve) => {
			this.resolveWrite = resolve;
		});
		this.closed = new Promise((resolve) => {
			this.resolveClosed = resolve;
		});
		this.pipeResult = streams.writer<TurnStreamEvent>("ui", {
			execute: ({ write }) => {
				this.resolveWrite(write);
				return this.closed;
			},
		});
	}

	/**
	 * Stamps `id` (1-based write order) and `at`, then appends. After
	 * `close()` a write is dropped with a warn — the onCancel backstop can
	 * write after the run already closed the stream.
	 */
	async write(turnId: string, event: TurnStreamEventInput): Promise<void> {
		if (this.isClosed) {
			this.logger.warn(
				`Dropping ${event.type} for turn ${turnId}: stream closed`,
			);
			return;
		}
		const write = await this.ready;
		this.sequence += 1;
		write({ ...event, at: Date.now(), id: String(this.sequence) });
	}

	/**
	 * Ends the stream and waits for the flush. A flush rejection is
	 * logged, not thrown: the events reached the stream or the run is dead.
	 */
	async close(): Promise<void> {
		this.isClosed = true;
		this.resolveClosed();
		try {
			await this.pipeResult.waitUntilComplete();
		} catch (error) {
			this.logger.warn(
				`ui stream flush failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}

@Injectable()
export class TriggerTurnEventReader implements TurnEventReader {
	private readonly logger = new Logger(TriggerTurnEventReader.name);

	/**
	 * Replays the `ui` stream from the start, then follows it live. Items
	 * that fail the shared schema are dropped with a warn — one bad item
	 * must never kill the relay. Read errors are logged and rethrown so the
	 * relay can end the SSE response with an `error` event.
	 */
	async *read(
		triggerRunId: string,
		signal: AbortSignal,
	): AsyncIterable<TurnStreamEvent> {
		if (!env.TRIGGER_SECRET_KEY) {
			// The V1 Trigger paths need the same key; a missing key is a config
			// bug, so the 503 code stays V2_ENV_MISSING on purpose.
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "TRIGGER_SECRET_KEY is not set",
			});
		}

		let stream: AsyncIterable<unknown>;
		try {
			stream = await streams.read<unknown>(triggerRunId, "ui", {
				signal,
				timeoutInSeconds: STREAM_READ_TIMEOUT_SECONDS,
			});
		} catch (error) {
			if (signal.aborted) {
				return;
			}
			this.logger.warn(
				`Turn event stream open failed for run ${triggerRunId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}

		try {
			for await (const item of stream) {
				if (signal.aborted) {
					return;
				}

				const parsed = turnStreamEventSchema.safeParse(item);
				if (!parsed.success) {
					this.logger.warn(
						`Dropping malformed turn stream item for run ${triggerRunId}: ${
							parsed.error.issues[0]?.message ?? "schema mismatch"
						}`,
					);
					continue;
				}

				yield parsed.data;
			}
		} catch (error) {
			if (signal.aborted) {
				return;
			}
			this.logger.warn(
				`Turn event stream read failed for run ${triggerRunId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			throw error;
		}
	}
}
