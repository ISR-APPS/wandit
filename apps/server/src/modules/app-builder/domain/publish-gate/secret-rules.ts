/**
 * The key patterns of the secret scanner (WANDIT-181). The publish gate in
 * `secret-scanner.ts` finds them in the build output, and
 * `AuditEventsService` masks them in audit metadata. Pure code, no IO.
 */
import type { secretScanRules } from "@wandit/contracts";
import { z } from "zod";

/** One value of `secretScanRules`. */
export type SecretScanRule = (typeof secretScanRules)[number];

/** One key that `findSecrets` found in a text. */
export type SecretMatch = {
	rule: SecretScanRule;
	/** The key with its middle cut out. Safe to store and to show. */
	sample: string;
	/** Offset of the key in the text, in UTF-16 code units. */
	index: number;
	/** Length of the key in the text, in UTF-16 code units. */
	length: number;
};

type SecretRule = {
	rule: SecretScanRule;
	/** Matches one key. The `g` flag is required: `findSecrets` loops on it. */
	pattern: RegExp;
	/** Characters of the key that the sample keeps at the start. */
	keepPrefix: number;
	/** Extra check on a match. Only the service-role JWT rule has one. */
	confirm?: (match: string) => boolean;
};

// The payload field that tells a service-role JWT from the public anon JWT.
const jwtRolePayloadSchema = z.object({ role: z.string() });

// A Supabase legacy key is a JWT whose payload says `"role": "service_role"`.
// The anon key has the same shape with `"role": "anon"` and is public.
function isServiceRoleJwt(token: string): boolean {
	const payload = token.split(".")[1];
	if (payload === undefined) {
		return false;
	}
	let decoded: unknown;
	try {
		decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	} catch {
		// Not a JWT payload: a random `eyJ` string in a bundle is no key.
		return false;
	}
	const parsed = jwtRolePayloadSchema.safeParse(decoded);
	return parsed.success && parsed.data.role === "service_role";
}

// The prefixes come from the vendor key formats. A key must start at a
// non-word character, so a longer identifier that ends in "sk_live_" does
// not match. The length floors skip short placeholders such as "sk_live_xxx".
const SECRET_RULES: readonly SecretRule[] = [
	{ keepPrefix: 4, pattern: /\bAKIA[0-9A-Z]{16}\b/g, rule: "aws_access_key" },
	{
		keepPrefix: 8,
		pattern: /\bsk_live_[0-9A-Za-z]{16,}/g,
		rule: "stripe_live_secret_key",
	},
	{
		keepPrefix: 8,
		pattern: /\brk_live_[0-9A-Za-z]{16,}/g,
		rule: "stripe_live_restricted_key",
	},
	{
		keepPrefix: 6,
		pattern: /\bwhsec_[0-9A-Za-z+/=]{16,}/g,
		rule: "stripe_webhook_secret",
	},
	{
		keepPrefix: 10,
		pattern: /\bsb_secret_[0-9A-Za-z_-]{16,}/g,
		rule: "supabase_secret_key",
	},
	// A JWT starts only where a base64url run starts. With "\b", each "-eyJ"
	// in a long run starts a new scan to the end of the run: quadratic time.
	{
		confirm: isServiceRoleJwt,
		keepPrefix: 3,
		pattern:
			/(?<![0-9A-Za-z_-])eyJ[0-9A-Za-z_-]{8,}\.eyJ[0-9A-Za-z_-]{8,}\.[0-9A-Za-z_-]{16,}/g,
		rule: "supabase_service_role_jwt",
	},
	{
		keepPrefix: 7,
		pattern: /\bsk-ant-[0-9A-Za-z_-]{20,}/g,
		rule: "anthropic_api_key",
	},
	// A Google key is exactly 39 characters, so a 40th key character means
	// another token.
	{
		keepPrefix: 4,
		pattern: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g,
		rule: "google_api_key",
	},
	// The whole block, so a redaction removes the key body too. An open
	// block without its END line runs to the end of the text.
	{
		keepPrefix: 0,
		pattern:
			/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )*PRIVATE KEY-----|$)/g,
		rule: "private_key",
	},
];

// The sample keeps the vendor prefix and the last 4 characters, so the user
// can tell which key it is. A private key keeps only its BEGIN line.
function sampleOf(rule: SecretRule, key: string): string {
	if (rule.rule === "private_key") {
		// Cut at the end of the BEGIN line, not at a line break. A JS bundle or
		// a JSON file holds the block on one line with "\n" escapes.
		const headerEnd = key.indexOf("KEY-----") + "KEY-----".length;
		return `${key.slice(0, headerEnd)}…`;
	}
	return `${key.slice(0, rule.keepPrefix)}…${key.slice(-4)}`;
}

/** Lists every key of the rules in `text`, in rule order, then text order. */
export function findSecrets(text: string): SecretMatch[] {
	const matches: SecretMatch[] = [];
	for (const rule of SECRET_RULES) {
		for (const match of text.matchAll(rule.pattern)) {
			const key = match[0];
			if (rule.confirm === undefined || rule.confirm(key)) {
				matches.push({
					index: match.index,
					length: key.length,
					rule: rule.rule,
					sample: sampleOf(rule, key),
				});
			}
		}
	}
	return matches;
}

/** Replaces every key of the rules in `text` with its masked sample. */
export function redactSecrets(text: string): string {
	// An overlap (a key inside a private key block) keeps the outer match:
	// left to right, the longest match at an offset wins.
	const ordered = findSecrets(text).sort(
		(left, right) => left.index - right.index || right.length - left.length,
	);
	const kept: SecretMatch[] = [];
	let end = 0;
	for (const match of ordered) {
		if (match.index >= end) {
			kept.push(match);
			end = match.index + match.length;
		}
	}
	// Right to left, so each replacement keeps the earlier offsets valid.
	let redacted = text;
	for (const match of kept.reverse()) {
		redacted =
			redacted.slice(0, match.index) +
			match.sample +
			redacted.slice(match.index + match.length);
	}
	return redacted;
}
