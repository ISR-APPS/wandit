/**
 * Sliding windows for valid submissions to the public capture endpoint.
 *
 * The form + IP budget isolates carrier-NAT traffic between merchants, while
 * the higher per-IP ceiling still bounds abuse spread across many forms.
 * Single-instance MVP limiter (same trade-off as the domains rate-limit
 * guard): swap to Redis before running more than one API instance.
 */
import { Injectable } from "@nestjs/common";

const WINDOW_MS = 60_000;
const MAX_PER_FORM_AND_IP = 60;
const MAX_GLOBAL_PER_IP = 300;
// Sweep lazily so the map cannot grow without bound under scanning traffic.
const SWEEP_EVERY = 500;

export type LeadsCaptureThrottleDecision =
	| { allowed: true }
	| { allowed: false; retryAfterSeconds: number };

@Injectable()
export class LeadsCaptureThrottle {
	private readonly formAndIpHits = new Map<string, number[]>();
	private readonly globalIpHits = new Map<string, number[]>();
	private callsSinceSweep = 0;

	/** Consume one valid-submission slot from both applicable budgets. */
	consume(
		publicFormId: string,
		ip: string,
		now = Date.now(),
	): LeadsCaptureThrottleDecision {
		this.callsSinceSweep += 1;
		if (this.callsSinceSweep >= SWEEP_EVERY) {
			this.callsSinceSweep = 0;
			this.sweep(now);
		}

		const cutoff = now - WINDOW_MS;
		const formAndIpKey = `${publicFormId}\u0000${ip}`;
		const formAndIpRecent = this.recent(
			this.formAndIpHits.get(formAndIpKey),
			cutoff,
		);
		const globalIpRecent = this.recent(this.globalIpHits.get(ip), cutoff);
		const blockedUntil = Math.max(
			this.blockedUntil(formAndIpRecent, MAX_PER_FORM_AND_IP),
			this.blockedUntil(globalIpRecent, MAX_GLOBAL_PER_IP),
		);

		if (blockedUntil > now) {
			this.storeRecent(this.formAndIpHits, formAndIpKey, formAndIpRecent);
			this.storeRecent(this.globalIpHits, ip, globalIpRecent);
			return {
				allowed: false,
				retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1_000)),
			};
		}

		formAndIpRecent.push(now);
		globalIpRecent.push(now);
		this.formAndIpHits.set(formAndIpKey, formAndIpRecent);
		this.globalIpHits.set(ip, globalIpRecent);
		return { allowed: true };
	}

	private sweep(now: number): void {
		const cutoff = now - WINDOW_MS;
		this.sweepHits(this.formAndIpHits, cutoff);
		this.sweepHits(this.globalIpHits, cutoff);
	}

	private recent(stamps: number[] | undefined, cutoff: number): number[] {
		return (stamps ?? []).filter((at) => at > cutoff);
	}

	private blockedUntil(stamps: number[], limit: number): number {
		return stamps.length >= limit ? (stamps[0] ?? 0) + WINDOW_MS : 0;
	}

	private storeRecent(
		hits: Map<string, number[]>,
		key: string,
		recent: number[],
	): void {
		if (recent.length === 0) {
			hits.delete(key);
		} else {
			hits.set(key, recent);
		}
	}

	private sweepHits(hits: Map<string, number[]>, cutoff: number): void {
		for (const [key, stamps] of hits) {
			this.storeRecent(hits, key, this.recent(stamps, cutoff));
		}
	}
}
