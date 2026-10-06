/**
 * The turn event stream of a host-run turn, on a Redis Stream (D20 option
 * B, for the `host` runner only). The harness host writes it through
 * `RedisTurnEventWriter`; the API relay reads it through
 * `RedisTurnEventReader` when the turn row names `runner = host`. A
 * Trigger-run turn keeps the Trigger.dev stream `ui`.
 */
import { Injectable, Logger, Optional } from "@nestjs/common";
import { type TurnStreamEvent, turnStreamEventSchema } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../../../../infrastructure/redis/redis-connection";
import type {
	TurnEventReader,
	TurnEventWriter,
	TurnStreamEventInput,
} from "../../domain/ports/turn-events";

// 1 h after the last append, so the Redis memory and RDB dump stay small.
// A live turn appends a status heartbeat at least every 30 s. So only the
// stream of a finished turn expires. After the end, only a reopen soon
// after a cut replays it. A reload shows the turn from the message rows.
// LIMIT: a reopen more than 1 h after the end finds no stream. The relay
// then ends it from the row after a 60 s idle read. Upgrade: when the key
// does not exist, the relay reads the row at once.
const STREAM_TTL_SECONDS = 60 * 60;
// The field of each stream entry; the value is one event as JSON.
const EVENT_FIELD = "event";
// 5 s per blocking read: the reader checks its abort signal between reads.
const READ_BLOCK_MS = 5_000;
// 500 entries per XREAD. A long turn replays in pages, so one reopen never
// holds the whole stream in memory.
const READ_BATCH_SIZE = 500;
// 60 s without an event ends one read, the same as the Trigger reader; the
// relay then checks the row and opens a new read.
const READ_IDLE_LIMIT_MS = 60_000;
// The ioredis error message when `commandTimeout` passes without a reply.
const COMMAND_TIMEOUT = "Command timed out";

/** Redis key of one turn's event stream. */
export function turnEventsKey(turnId: string): string {
	return `builder:turn:${turnId}:events`;
}

/** The pipeline calls of one append; the spec passes a fake. */
export type TurnEventsWriteChain = {
	xadd(
		key: string,
		id: "*",
		field: string,
		value: string,
	): TurnEventsWriteChain;
	expire(key: string, seconds: number): TurnEventsWriteChain;
	exec(): Promise<unknown>;
};

/** The client calls the writer makes; an ioredis client fits it. */
export type TurnEventsWriteClient = { multi(): TurnEventsWriteChain };

/**
 * `TurnEventWriter` of the harness host. `write` stamps `id` (1-based write
 * order) and `at`, then queues the append: the stream loop does not wait for
 * Redis, and the appends keep their order. `close` waits for the queue.
 */
export class RedisTurnEventWriter implements TurnEventWriter {
	private readonly logger = new Logger(RedisTurnEventWriter.name);
	private sequence: number;
	private tail: Promise<void> = Promise.resolve();
	private isClosed = false;

	constructor(
		private readonly redis: TurnEventsWriteClient,
		private readonly now: () => number = Date.now,
		/**
		 * Entries already in the stream. The host recovery appends after a
		 * dead writer; the relay skips a replay up to its last id, so ids
		 * must keep growing.
		 */
		sequenceStart = 0,
	) {
		this.sequence = sequenceStart;
	}

	async write(turnId: string, event: TurnStreamEventInput): Promise<void> {
		if (this.isClosed) {
			this.logger.warn(`Dropping ${event.type} for turn ${turnId}: closed`);
			return;
		}
		this.sequence += 1;
		const stamped: TurnStreamEvent = {
			...event,
			at: this.now(),
			id: String(this.sequence),
		};
		const key = turnEventsKey(turnId);
		this.tail = this.tail.then(async () => {
			try {
				await this.redis
					.multi()
					.xadd(key, "*", EVENT_FIELD, JSON.stringify(stamped))
					.expire(key, STREAM_TTL_SECONDS)
					.exec();
			} catch (error) {
				// A lost event is a gap in the browser stream, not a lost turn:
				// the row and the message row keep the truth.
				this.logger.warn(
					`Turn event append failed for turn ${turnId}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		});
	}

	/** Waits until every queued append reached Redis. */
	async close(): Promise<void> {
		this.isClosed = true;
		await this.tail;
	}
}

/** The calls one read makes; an ioredis client fits it, the spec fakes it. */
export type TurnEventsReadClient = {
	xread(
		count: "COUNT",
		entries: number,
		block: "BLOCK",
		milliseconds: number,
		streams: "STREAMS",
		key: string,
		id: string,
	): Promise<[key: string, items: [id: string, fields: string[]][]][] | null>;
	disconnect(): void;
};

/** A Redis client for one blocking read: it holds its connection. */
function createReadClient(): TurnEventsReadClient {
	return new Redis(
		createRedisConnectionOptions(env.REDIS_URL, {
			commandTimeout: READ_BLOCK_MS + 5_000,
			maxRetriesPerRequest: 2,
		}),
	);
}

/**
 * `TurnEventReader` for host-run turns; the id is the turn id. It replays
 * the stream from the start, then follows it live. It ends after 60 s
 * without an event, after a `done` event, or when the signal aborts.
 */
@Injectable()
export class RedisTurnEventReader implements TurnEventReader {
	private readonly logger = new Logger(RedisTurnEventReader.name);

	constructor(
		@Optional()
		private readonly createClient: () => TurnEventsReadClient = createReadClient,
	) {}

	async *read(
		turnId: string,
		signal: AbortSignal,
	): AsyncIterable<TurnStreamEvent> {
		let client = this.createClient();
		let cursor = "0";
		let idleSince = Date.now();
		try {
			while (!signal.aborted && Date.now() - idleSince < READ_IDLE_LIMIT_MS) {
				let reply: Awaited<ReturnType<TurnEventsReadClient["xread"]>>;
				try {
					reply = await client.xread(
						"COUNT",
						READ_BATCH_SIZE,
						"BLOCK",
						READ_BLOCK_MS,
						"STREAMS",
						turnEventsKey(turnId),
						cursor,
					);
				} catch (error) {
					// Local Redis 8.8 ended a 5 s BLOCK after 30 s and more, so the
					// client timeout fired. The read goes on from the same cursor.
					if (!(error instanceof Error && error.message === COMMAND_TIMEOUT)) {
						throw error;
					}
					client.disconnect();
					client = this.createClient();
					continue;
				}
				const rows = reply?.[0]?.[1] ?? [];
				for (const [id, fields] of rows) {
					cursor = id;
					idleSince = Date.now();
					const event = this.parse(turnId, fields);
					if (event === null) {
						continue;
					}
					yield event;
					if (event.type === "done") {
						return;
					}
				}
			}
		} finally {
			client.disconnect();
		}
	}

	// One bad entry is skipped with a warn; it must not end the relay.
	private parse(turnId: string, fields: string[]): TurnStreamEvent | null {
		const index = fields.indexOf(EVENT_FIELD);
		const payload = index >= 0 ? fields[index + 1] : undefined;
		let json: unknown;
		try {
			json = payload === undefined ? undefined : JSON.parse(payload);
		} catch {
			// Not JSON: the schema parse below refuses it and logs the drop.
			json = undefined;
		}
		const parsed = turnStreamEventSchema.safeParse(json);
		if (!parsed.success) {
			this.logger.warn(`Dropping a malformed turn event of turn ${turnId}`);
			return null;
		}
		return parsed.data;
	}
}
