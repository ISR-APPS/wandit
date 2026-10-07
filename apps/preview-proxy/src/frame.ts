/**
 * The `PreviewFrame` Durable Object: one instance per frame host, so per run
 * and per user. It holds the claims of the newest token that opened the host.
 * src/index.ts calls `open` on a `?wt=` request and `claims` on every other
 * request of the frame host. It reads @wandit/contracts for the claims schema.
 */
import { DurableObject } from "cloudflare:workers";
import {
	type PreviewTokenClaims,
	previewTokenClaimsSchema,
} from "@wandit/contracts";

/** Storage key of the one claims value of an instance. */
const CLAIMS_KEY = "claims";

/**
 * Claims store of one frame host. A Durable Object reads its own write at
 * once. KV can miss a new row for 60 s in another location, and the builder
 * then shows its blocked state.
 */
export class PreviewFrame extends DurableObject<Env> {
	/**
	 * Stores the claims of a verified token, unless the stored claims expire
	 * later. The alarm then deletes the claims at their `exp`.
	 */
	async open(claims: PreviewTokenClaims): Promise<void> {
		const stored = await this.claims();
		// A new tab can send an older token again. It must not end the frame
		// before the newer token of the builder expires.
		if (stored !== null && stored.exp >= claims.exp) {
			return;
		}
		await this.ctx.storage.put(CLAIMS_KEY, claims);
		// `exp` is unix seconds; the alarm takes ms. A new alarm replaces the old one.
		await this.ctx.storage.setAlarm(claims.exp * 1000);
	}

	/** The stored claims, or null. The caller checks `exp`, because an alarm can run late. */
	async claims(): Promise<PreviewTokenClaims | null> {
		const stored = await this.ctx.storage.get(CLAIMS_KEY);
		if (stored === undefined) {
			return null;
		}
		const parsed = previewTokenClaimsSchema.safeParse(stored);
		if (!parsed.success) {
			// An older Worker can have stored another shape. On null, the Worker
			// answers 401. The next `?wt=` request calls `open`, which replaces the value.
			console.error("preview-proxy frame claims do not parse:", parsed.error);
			return null;
		}
		return parsed.data;
	}

	/** Deletes the claims at their `exp`, so a closed run keeps no data. */
	async alarm(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}
