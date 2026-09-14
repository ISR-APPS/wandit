/**
 * Relays a builder turn's `ui` stream to the browser as SSE.
 * The task writes D20 envelope events on the Trigger stream; this service
 * unwraps them into the plain AI SDK chunks `useChat` +
 * `DefaultChatTransport` parse — one `data:` frame each, `[DONE]` to end.
 * Same socket handling as `chat-stream-relay.service.ts` (hijack,
 * heartbeat every 15 s, `drain` backpressure). The reader replays from
 * the start, so the relay dedupes on the last written event id.
 */
import { once } from "node:events";
import type { ServerResponse } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
	CreateTurnResponse,
	TurnDataPart,
	TurnDoneData,
	TurnStreamPartEvent,
} from "@wandit/contracts";
import { allowedCorsWebOrigin } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
	TURN_EVENT_READER,
	type TurnEventReader,
} from "../../domain/ports/turn-events";
import { isTerminalStatus } from "../../domain/turn-queue";
import {
	type BuilderTurnRow,
	BuilderTurnsRepository,
} from "../../infrastructure/persistence/builder-turns.repository";
import {
	RATE_LIMIT_STORE,
	type RateLimitStore,
	rateLimitKey,
	TURN_STREAM_BUCKET,
} from "../../presentation/http/guards/redis-rate-limit.guard";

// Same cadence as the V1 chat relay: one ignored comment keeps proxies and
// browsers from treating a quiet stream as a dead connection.
const HEARTBEAT_INTERVAL_MS = 15_000;

// Lag is logged per batch of 50 events plus once on `done`, so a healthy
// stream costs about one line per burst instead of one per event.
const LAG_LOG_BATCH_SIZE = 50;

/**
 * The response head `DefaultChatTransport` requires — the values of the
 * AI SDK's `UI_MESSAGE_STREAM_HEADERS`. Written as literals on purpose:
 * the API must not import `ai`.
 */
const UI_MESSAGE_STREAM_HEADERS = {
	"Cache-Control": "no-cache",
	Connection: "keep-alive",
	"Content-Type": "text/event-stream",
	"X-Accel-Buffering": "no",
	"X-Vercel-AI-UI-Message-Stream": "v1",
} as const;

// Row-poll cadence while a `waiting` turn still has no run id.
const WAITING_POLL_MS = 2_000;

/**
 * One raw AI SDK `UIMessageChunk` a `part` envelope carries. The relay
 * writes it verbatim and never reads it, so the contract keeps it loose.
 */
type UiChunkPassThrough = TurnStreamPartEvent["data"];

/** Runs after the terminal `done` frame is written; the caller promotes. */
type OnTurnDone = (done: TurnDoneData) => void | Promise<void>;

@Injectable()
export class TurnStreamRelayService {
	private readonly logger = new Logger(TurnStreamRelayService.name);

	constructor(
		@Inject(TURN_EVENT_READER)
		private readonly turnEvents: TurnEventReader,
		@Inject(RATE_LIMIT_STORE)
		private readonly rateLimit: RateLimitStore,
		@Inject(BuilderTurnsRepository)
		private readonly turns: Pick<BuilderTurnsRepository, "findById">,
	) {}

	/**
	 * Open one SSE response for one turn and relay every event as plain
	 * AI SDK chunk frames. `onDone` runs after the terminal `done` frame
	 * is written — the caller uses it to free the project lock and
	 * promote the next waiting turn.
	 */
	async relay(options: {
		/** First frame on the create route: the `CreateTurnResponse`. */
		first?: CreateTurnResponse;
		/** Called once with the done payload after the terminal frame. */
		onDone?: OnTurnDone;
		/** The create route passes false: its guard took no open-stream slot. */
		releaseSlot?: boolean;
		reply: FastifyReply;
		/** Carries `user` (slot key) and `headers.origin` (CORS echo). */
		request: FastifyRequest & { user?: { id: string } };
		/** The Trigger.dev run to read; null while the turn is `waiting`. */
		triggerRunId: string | null;
		/** The `builder_turns` row; polled for a run id and for terminal truth. */
		turnId: string;
	}): Promise<void> {
		const {
			first,
			onDone,
			releaseSlot = true,
			reply,
			request,
			turnId,
		} = options;
		const raw = reply.raw;
		const allowedCorsOrigin = this.allowedCorsOrigin(request);
		let closed = false;
		const abort = new AbortController();

		// `hijack()` means "Nest, do not make JSON; I will write the response myself."
		reply.hijack();
		raw.writeHead(200, {
			...UI_MESSAGE_STREAM_HEADERS,
			...(allowedCorsOrigin
				? {
						"Access-Control-Allow-Credentials": "true",
						"Access-Control-Allow-Origin": allowedCorsOrigin,
						Vary: "Origin",
					}
				: {}),
		});
		raw.flushHeaders?.();
		await this.writeComment(raw, "connected");

		// A closed browser tab aborts the Trigger stream read.
		const close = () => {
			closed = true;
			abort.abort();
		};
		request.raw.on("close", close);
		const heartbeat = setInterval(() => {
			if (!closed) {
				void this.writeComment(raw, "heartbeat").catch((error) => {
					this.logger.warn(
						`Stopping turn stream heartbeat for turn ${turnId}: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
					closed = true;
					abort.abort();
				});
			}
		}, HEARTBEAT_INTERVAL_MS);

		const lagMs: number[] = [];
		let runId = options.triggerRunId;
		let lastSeenId: string | null = null;
		let done = false;
		try {
			if (first) {
				await this.writeChunk(raw, {
					data: first,
					id: "turn-created",
					type: "data-turn-created",
				});
			}

			while (!closed && !done) {
				if (runId === null) {
					const row = await this.turns.findById(turnId);
					if (row?.triggerRunId) {
						runId = row.triggerRunId;
					} else if (row && isTerminalStatus(row.status)) {
						// The turn settled before a run ever started (cancel).
						await this.finishFromRow(raw, row, onDone, turnId);
						done = true;
					} else if (row === null) {
						await this.endMissingRow(raw, turnId);
						done = true;
					} else {
						// A `waiting` turn gets its run id when the earlier turn
						// ends and promotion runs.
						await delay(WAITING_POLL_MS, undefined, {
							signal: abort.signal,
						});
					}
					continue;
				}

				const activeRunId = runId;
				// The reader replays from the start on every open; the browser
				// must not get a chunk twice, so events up to the last written
				// id are skipped.
				let skipping = lastSeenId !== null;
				for await (const event of this.turnEvents.read(
					activeRunId,
					abort.signal,
				)) {
					if (closed) {
						break;
					}
					if (skipping) {
						if (event.id === lastSeenId) {
							skipping = false;
						}
						continue;
					}
					lastSeenId = event.id;
					lagMs.push(Math.max(0, Date.now() - event.at));

					if (event.type === "part") {
						await this.writeChunk(raw, event.data);
					} else if (event.type === "status") {
						await this.writeChunk(raw, {
							data: event.data,
							id: "turn-status",
							type: "data-turn-status",
						});
					} else if (event.type === "usage") {
						await this.writeChunk(raw, {
							data: event.data,
							id: "turn-usage",
							type: "data-turn-usage",
						});
					} else if (event.type === "error") {
						await this.writeChunk(raw, {
							data: event.data,
							id: "turn-error",
							type: "data-turn-error",
						});
						// `useChat` surfaces only an `error` chunk; the data part
						// keeps code and retryable for the UI.
						await this.writeChunk(raw, {
							errorText: event.data.message,
							type: "error",
						});
					} else {
						await this.writeChunk(raw, {
							data: event.data,
							id: "turn-done",
							type: "data-turn-done",
						});
						await this.writeDone(raw);
						done = true;
						this.logLag(activeRunId, lagMs);
						await this.runOnDone(onDone, turnId, event.data);
						break;
					}

					if (lagMs.length >= LAG_LOG_BATCH_SIZE) {
						this.logLag(activeRunId, lagMs);
						lagMs.length = 0;
					}
				}

				if (!closed && !done) {
					// The reader closes after 60 s of silence; a long tool call
					// is silent longer. The row says whether the turn is over.
					const row = await this.turns.findById(turnId);
					if (row === null) {
						await this.endMissingRow(raw, turnId);
						done = true;
					} else if (isTerminalStatus(row.status)) {
						this.logLag(activeRunId, lagMs);
						await this.finishFromRow(raw, row, onDone, turnId);
						done = true;
					} else {
						// The reopen is paced: a run that died without a terminal
						// row must not spin one DB read and one stream open per tick.
						await delay(WAITING_POLL_MS, undefined, {
							signal: abort.signal,
						});
					}
				}
			}
		} catch (error) {
			if (!closed && !abort.signal.aborted) {
				this.logger.warn(
					`Turn stream read failed for turn ${turnId}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
				// The client sees a reason for the close, not a silent hang.
				const data = {
					code: "STREAM_READ_FAILED",
					message: "The turn event stream was interrupted",
					retryable: true,
				};
				try {
					await this.writeChunk(raw, {
						data,
						id: "turn-error",
						type: "data-turn-error",
					});
					await this.writeChunk(raw, {
						errorText: data.message,
						type: "error",
					});
					await this.writeDone(raw);
				} catch (writeError) {
					this.logger.warn(
						`Error frames for turn ${turnId} could not be written: ${
							writeError instanceof Error
								? writeError.message
								: String(writeError)
						}`,
					);
				}
			}
		} finally {
			clearInterval(heartbeat);
			request.raw.off("close", close);
			abort.abort();
			if (!raw.destroyed) {
				raw.end();
			}
			if (releaseSlot) {
				await this.releaseStreamSlot(request);
			}
		}
	}

	/**
	 * Gives back the open-stream slot the `turn-stream` rate limit took.
	 * The relay calls it in `finally`; the controller calls it for the
	 * 204 no-active-turn path where no relay starts.
	 */
	async releaseStreamSlot(
		request: FastifyRequest & { user?: { id: string } },
	): Promise<void> {
		const userId = request.user?.id;
		if (!userId) {
			return;
		}

		try {
			await this.rateLimit.release(rateLimitKey(TURN_STREAM_BUCKET, userId));
		} catch (error) {
			// A missed release is a leaked slot, not a stuck stream: the key
			// TTL clears it.
			this.logger.warn(
				`Open-stream slot release failed for ${userId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	// One SSE frame `useChat` parses: a single `data:` line of JSON, no
	// `id:`/`event:` lines. The chunk is stringified once, never parsed.
	private async writeChunk(
		raw: ServerResponse,
		chunk: TurnDataPart | UiChunkPassThrough,
	): Promise<void> {
		await this.write(raw, `data: ${JSON.stringify(chunk)}\n\n`);
	}

	// The terminator `DefaultChatTransport` waits for to end the read.
	private writeDone(raw: ServerResponse): Promise<void> {
		return this.write(raw, "data: [DONE]\n\n");
	}

	/**
	 * Writes `data-turn-done` plus `[DONE]` and runs `onDone` when the row
	 * — not the stream — reports the end. Covers a parked turn canceled
	 * before it ran and a run that ended without a `done` event.
	 */
	// A row deleted while a stream is open would otherwise poll or reopen
	// until the browser leaves; the frames give the UI a reason to stop.
	private async endMissingRow(
		raw: ServerResponse,
		turnId: string,
	): Promise<void> {
		this.logger.warn(`Turn row ${turnId} vanished while its stream was open`);
		await this.writeChunk(raw, {
			data: {
				code: "TURN_NOT_FOUND",
				message: "The turn no longer exists",
				retryable: false,
			},
			id: "turn-error",
			type: "data-turn-error",
		});
		await this.writeChunk(raw, {
			errorText: "The turn no longer exists",
			type: "error",
		});
		await this.writeDone(raw);
	}

	private async finishFromRow(
		raw: ServerResponse,
		row: BuilderTurnRow,
		onDone: OnTurnDone | undefined,
		turnId: string,
	): Promise<void> {
		const data: TurnDoneData = {
			status: row.status,
			// The column is nullable; the part omits the key when empty.
			...(row.outputCommitSha ? { outputCommitSha: row.outputCommitSha } : {}),
		};
		await this.writeChunk(raw, {
			data,
			id: "turn-done",
			type: "data-turn-done",
		});
		await this.writeDone(raw);
		await this.runOnDone(onDone, turnId, data);
	}

	// Promotion is retried by the task end; a failure here only delays the
	// next turn until the lock TTL lapses, so a throw becomes a warn.
	private async runOnDone(
		onDone: OnTurnDone | undefined,
		turnId: string,
		done: TurnDoneData,
	): Promise<void> {
		try {
			await onDone?.(done);
		} catch (error) {
			this.logger.warn(
				`onDone for turn ${turnId} failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	// SSE comments start with ":" and are ignored by browser code.
	private writeComment(raw: ServerResponse, comment: string): Promise<void> {
		return this.write(raw, `: ${comment}\n\n`);
	}

	// If the browser is slow, wait instead of buffering unlimited data.
	private async write(raw: ServerResponse, chunk: string): Promise<void> {
		if (raw.destroyed || raw.write(chunk)) {
			return;
		}

		await Promise.race([once(raw, "drain"), once(raw, "close")]);
	}

	/**
	 * Structured lag line: p50 and max of `Date.now() - event.at` for the
	 * batch. The D20 trigger says Trigger streams stay until p50 lag tops
	 * 300 ms — this is the number that decision watches.
	 */
	private logLag(triggerRunId: string, lagMs: number[]): void {
		if (lagMs.length === 0) {
			return;
		}

		const sorted = [...lagMs].sort((a, b) => a - b);
		// SAFETY: `lagMs.length > 0` is checked above, so the middle index hits.
		// biome-ignore lint/style/noNonNullAssertion: index hits a real element
		const p50 = sorted[Math.floor(sorted.length / 2)]!;
		// SAFETY: the same non-empty check covers the last index.
		// biome-ignore lint/style/noNonNullAssertion: index hits a real element
		const max = sorted[sorted.length - 1]!;
		this.logger.log(
			JSON.stringify({
				count: lagMs.length,
				event: "turn_stream_lag",
				lagMaxMs: max,
				lagP50Ms: p50,
				runId: triggerRunId,
			}),
		);
	}

	// If EventSource sends cookies, CORS must echo the exact allowed origin.
	private allowedCorsOrigin(request: FastifyRequest): string | undefined {
		return allowedCorsWebOrigin(
			request.headers.origin,
			env.CORS_ORIGIN,
			env.CORS_EXTRA_ORIGINS,
		);
	}
}
