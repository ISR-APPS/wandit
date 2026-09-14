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

import type { TurnEventReader } from "../../domain/ports/turn-events";

/**
 * The vendor closes the read after 60 s without data. A long tool call is
 * quiet longer, so the relay reopens the read while the turn row is not
 * terminal.
 */
const STREAM_READ_TIMEOUT_SECONDS = 60;

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
