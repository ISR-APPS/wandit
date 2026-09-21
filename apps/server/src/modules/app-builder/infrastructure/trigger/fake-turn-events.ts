/**
 * In-memory `TurnEventWriter`/`TurnEventReader` for specs.
 * No Trigger.dev stream: events sit in an array per key. `write` stamps
 * `at` and `id`. `read` replays the stored events, then waits for more
 * until `close` or the abort signal.
 */
import type { TurnStreamEvent } from "@wandit/contracts";

import type {
	TurnEventReader,
	TurnEventWriter,
	TurnStreamEventInput,
} from "../../domain/ports/turn-events";

type TurnEventBucket = {
	closed: boolean;
	events: TurnStreamEvent[];
	waiters: Set<() => void>;
};

/**
 * Both stream ends in one object. The fake keys events by the id string
 * the caller passes. A spec writes and reads with the same turn id.
 * The real reader uses the Trigger.dev run id of the turn.
 */
export class FakeTurnEventStream implements TurnEventWriter, TurnEventReader {
	private readonly buckets = new Map<string, TurnEventBucket>();

	async write(turnId: string, event: TurnStreamEventInput): Promise<void> {
		const bucket = this.bucketFor(turnId);
		bucket.events.push({
			...event,
			at: Date.now(),
			id: String(bucket.events.length),
		});
		this.notify(bucket);
	}

	/** The stamped events written under one key, in write order. */
	eventsOf(turnId: string): readonly TurnStreamEvent[] {
		return this.bucketFor(turnId).events;
	}

	/** Ends every `read` loop waiting on this key. */
	close(turnId: string): void {
		const bucket = this.bucketFor(turnId);
		bucket.closed = true;
		this.notify(bucket);
	}

	async *read(
		triggerRunId: string,
		signal: AbortSignal,
	): AsyncIterable<TurnStreamEvent> {
		const bucket = this.bucketFor(triggerRunId);
		let index = 0;
		while (true) {
			while (index < bucket.events.length) {
				const event = bucket.events[index];
				if (event === undefined) {
					break;
				}
				index += 1;
				yield event;
			}
			if (bucket.closed || signal.aborted) {
				return;
			}
			await this.waitForChange(bucket, signal);
		}
	}

	private bucketFor(key: string): TurnEventBucket {
		let bucket = this.buckets.get(key);
		if (!bucket) {
			bucket = { closed: false, events: [], waiters: new Set() };
			this.buckets.set(key, bucket);
		}
		return bucket;
	}

	private notify(bucket: TurnEventBucket): void {
		for (const waiter of bucket.waiters) {
			waiter();
		}
	}

	private waitForChange(
		bucket: TurnEventBucket,
		signal: AbortSignal,
	): Promise<void> {
		return new Promise((resolve) => {
			const done = () => {
				bucket.waiters.delete(done);
				signal.removeEventListener("abort", done);
				resolve();
			};
			bucket.waiters.add(done);
			signal.addEventListener("abort", done, { once: true });
		});
	}
}
