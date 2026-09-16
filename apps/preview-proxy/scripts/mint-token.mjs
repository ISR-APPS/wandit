#!/usr/bin/env node
/**
 * Mints a preview token for a local smoke test of `wrangler dev`.
 *
 * Mirrors packages/contracts/src/v2/preview-token.ts: Node cannot import the
 * TS contracts source without a build, so the same base64url + HMAC-SHA256
 * signing lives here again. Keep the payload field order identical:
 * pid, rid, uid, up, exp, jti.
 *
 * Usage (from apps/preview-proxy):
 *   node scripts/mint-token.mjs --key <key> --project <uuid> --run <uuid> --up <origin> [--user <id>]
 */
const args = process.argv.slice(2);

function arg(name) {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
}

const key = arg("key");
const projectId = arg("project");
const runId = arg("run");
const upstream = arg("up");
const user = arg("user") ?? "local-dev";

if (!key || !projectId || !runId || !upstream) {
	console.error(
		"Usage: node scripts/mint-token.mjs --key <key> --project <uuid> --run <uuid> --up <origin> [--user <id>]",
	);
	process.exit(1);
}

/** Encodes bytes as base64url: the URL-safe alphabet, no padding. */
function base64UrlEncode(bytes) {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

const claims = {
	pid: projectId,
	rid: runId,
	uid: user,
	up: upstream,
	// 900 s: the PREVIEW_TOKEN_TTL_SECONDS of packages/contracts (15 minutes).
	exp: Math.floor(Date.now() / 1000) + 900,
	jti: crypto.randomUUID(),
};
const payload = base64UrlEncode(
	new TextEncoder().encode(JSON.stringify(claims)),
);
const cryptoKey = await crypto.subtle.importKey(
	"raw",
	new TextEncoder().encode(key),
	{ name: "HMAC", hash: "SHA-256" },
	false,
	["sign"],
);
const signature = await crypto.subtle.sign(
	"HMAC",
	cryptoKey,
	new TextEncoder().encode(payload),
);
const token = `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;

// The first 12 hex characters of the run id without dashes (rid12Of).
const rid12 = runId.replaceAll("-", "").slice(0, 12);
const host = `r-${rid12}--p-${projectId}.wanditpreview.app`;

console.log(`token: ${token}`);
console.log(`host:  ${host}`);
console.log();
console.log(`curl -i -H "Host: ${host}" "http://127.0.0.1:8787/?wt=${token}"`);
