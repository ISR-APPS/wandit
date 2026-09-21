/**
 * In-memory `SupabaseRateLimiter` for specs.
 * Records each `take` call and answers a scripted queue of wait values;
 * an empty queue answers 0.
 */
import type { SupabaseRateLimiter } from "./supabase-rate-limiter";

/** Spec-friendly limiter; the constructor takes the scripted waits. */
export class FakeSupabaseRateLimiter implements SupabaseRateLimiter {
	// The `take` calls in order; specs assert the bucket and the limit.
	readonly calls: { bucket: string; limitPerMinute: number }[] = [];
	private readonly waits: number[];

	constructor(waits: number[] = []) {
		this.waits = [...waits];
	}

	take(bucket: string, limitPerMinute: number): Promise<number> {
		this.calls.push({ bucket, limitPerMinute });
		return Promise.resolve(this.waits.shift() ?? 0);
	}
}
