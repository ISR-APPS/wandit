/**
 * Per-IP sliding window for the public capture endpoint.
 *
 * The caller is anonymous, so IP is the only usable key. Single-instance MVP
 * limiter (same trade-off as the domains rate-limit guard): swap to Redis
 * before running more than one API instance — docs/features/leads-crm.md.
 */
import { Injectable } from "@nestjs/common";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
// Sweep lazily so the map cannot grow without bound under scanning traffic.
const SWEEP_EVERY = 500;

@Injectable()
export class LeadsCaptureThrottle {
	private readonly hits = new Map<string, number[]>();
	private callsSinceSweep = 0;

	/** True when this submission is allowed; false when the IP is over budget. */
	allow(ip: string, now = Date.now()): boolean {
		this.callsSinceSweep += 1;
		if (this.callsSinceSweep >= SWEEP_EVERY) {
			this.callsSinceSweep = 0;
			this.sweep(now);
		}

		const cutoff = now - WINDOW_MS;
		const recent = (this.hits.get(ip) ?? []).filter((at) => at > cutoff);
		if (recent.length >= MAX_PER_WINDOW) {
			this.hits.set(ip, recent);
			return false;
		}

		recent.push(now);
		this.hits.set(ip, recent);
		return true;
	}

	private sweep(now: number): void {
		const cutoff = now - WINDOW_MS;
		for (const [ip, stamps] of this.hits) {
			const recent = stamps.filter((at) => at > cutoff);
			if (recent.length === 0) {
				this.hits.delete(ip);
			} else {
				this.hits.set(ip, recent);
			}
		}
	}
}
