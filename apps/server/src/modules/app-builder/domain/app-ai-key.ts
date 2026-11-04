/**
 * The per-project key of the app AI gateway: mint, parse, and compare.
 * `AppAiKeysService` mints a key; `AppAiGatewayService` parses and checks
 * the bearer key of each call. Pure functions on `node:crypto`; no I/O.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { APP_AI_KEY_PATTERN, APP_AI_KEY_PREFIX } from "@wandit/contracts";

// 32 bytes: 256 random bits, so a guess of a key never succeeds.
const KEY_RANDOM_BYTES = 32;

// A UUID without its dashes is 32 hex digits; these are the dash positions.
const UUID_GROUP_ENDS = [8, 12, 16, 20] as const;

/**
 * A new key for one project. The project id is part of the key, so the
 * gateway reads one row of that project instead of a search.
 */
export function mintAppAiKey(projectId: string): string {
	const projectHex = projectId.replaceAll("-", "").toLowerCase();
	const random = randomBytes(KEY_RANDOM_BYTES).toString("base64url");
	return `${APP_AI_KEY_PREFIX}${projectHex}_${random}`;
}

/**
 * The project id of a well-formed key, or null. A null answer means the
 * caller sends 401 before any database read.
 */
export function projectIdOfAppAiKey(key: string): string | null {
	const match = APP_AI_KEY_PATTERN.exec(key);
	const projectHex = match?.[1];
	if (projectHex === undefined) {
		return null;
	}
	const [a, b, c, d] = UUID_GROUP_ENDS;
	return [
		projectHex.slice(0, a),
		projectHex.slice(a, b),
		projectHex.slice(b, c),
		projectHex.slice(c, d),
		projectHex.slice(d),
	].join("-");
}

/**
 * True when both keys are equal. The SHA-256 digests have one length, so
 * `timingSafeEqual` takes the same time for every wrong key.
 */
export function appAiKeysEqual(presented: string, stored: string): boolean {
	return timingSafeEqual(sha256(presented), sha256(stored));
}

function sha256(value: string): Buffer {
	return createHash("sha256").update(value, "utf8").digest();
}
