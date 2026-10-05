import { describe, expect, it } from "vitest";

import { findSecrets, redactSecrets } from "./secret-rules";

// The spec builds each fake key at run time, because GitHub push protection
// blocks a full key literal.
const awsKey = `AKIA${"Q7".repeat(8)}`;
const stripeSecretKey = `sk_live_${"Ab3".repeat(8)}`;
const stripeRestrictedKey = `rk_live_${"Cd4".repeat(8)}`;
const stripeWebhookSecret = `whsec_${"Ef5".repeat(8)}`;
const supabaseSecretKey = `sb_secret_${"Gh6".repeat(8)}`;
const anthropicKey = `sk-ant-api03-${"Jk7".repeat(8)}`;
const googleKey = `AIza${"Lm8".repeat(11)}Np`;
const pemBody = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC".repeat(2);

function jwt(role: string): string {
	const part = (claims: Record<string, string>) =>
		Buffer.from(JSON.stringify(claims)).toString("base64url");
	return [
		part({ alg: "HS256", typ: "JWT" }),
		part({ iss: "supabase", role }),
		"Sig9".repeat(8),
	].join(".");
}

const pemHeader = (label: string) => `-----BEGIN ${label}-----`;

function pem(label: string, body: string, lineBreak: string): string {
	return [pemHeader(label), body, `-----END ${label}-----`].join(lineBreak);
}

describe("redactSecrets", () => {
	it.each([
		{ name: "aws_access_key", text: awsKey, expected: "AKIA…Q7Q7" },
		{
			name: "stripe_live_secret_key",
			text: stripeSecretKey,
			expected: "sk_live_…3Ab3",
		},
		{
			name: "stripe_live_restricted_key",
			text: stripeRestrictedKey,
			expected: "rk_live_…4Cd4",
		},
		{
			name: "stripe_webhook_secret",
			text: stripeWebhookSecret,
			expected: "whsec_…5Ef5",
		},
		{
			name: "supabase_secret_key",
			text: supabaseSecretKey,
			expected: "sb_secret_…6Gh6",
		},
		{
			name: "supabase_service_role_jwt",
			text: jwt("service_role"),
			expected: "eyJ…Sig9",
		},
		{ name: "anthropic_api_key", text: anthropicKey, expected: "sk-ant-…7Jk7" },
		{ name: "google_api_key", text: googleKey, expected: "AIza…m8Np" },
		{
			name: "private_key with line breaks",
			text: pem("PRIVATE KEY", pemBody, "\n"),
			expected: `${pemHeader("PRIVATE KEY")}…`,
		},
		// A JS bundle or a service account JSON holds the block on one line.
		{
			name: 'private_key on one line with "\\n" escapes',
			text: pem("RSA PRIVATE KEY", pemBody, "\\n"),
			expected: `${pemHeader("RSA PRIVATE KEY")}…`,
		},
		{
			name: "a key inside a private key block",
			text: pem("EC PRIVATE KEY", `MIIB/${awsKey}/${pemBody}`, "\n"),
			expected: `${pemHeader("EC PRIVATE KEY")}…`,
		},
		{
			name: "two keys in one text",
			text: `${stripeSecretKey} and ${awsKey}`,
			expected: "sk_live_…3Ab3 and AKIA…Q7Q7",
		},
		{
			name: "nothing in a placeholder, a 40-character AIza token, and a token that is not a JWT",
			text: `sk_live_xxx AIza${"x".repeat(36)} eyJ${"x".repeat(8)}.eyJ${"x".repeat(8)}.${"s".repeat(16)}`,
			expected: `sk_live_xxx AIza${"x".repeat(36)} eyJ${"x".repeat(8)}.eyJ${"x".repeat(8)}.${"s".repeat(16)}`,
		},
	])("masks $name", ({ text, expected }) => {
		expect(redactSecrets(`const config = { key: "${text}" };`)).toBe(
			`const config = { key: "${expected}" };`,
		);
	});

	// An audit note can be cut before the END line of the block.
	it("masks an open private key block to the end of the text", () => {
		expect(
			redactSecrets(`error: ${pemHeader("PRIVATE KEY")}\n${pemBody}`),
		).toBe(`error: ${pemHeader("PRIVATE KEY")}…`);
	});
});

describe("findSecrets", () => {
	// The app owner controls the build output. A pattern with quadratic time
	// on 100 KB stalls the publish task for seconds.
	it("scans a long run of eyJ tokens in linear time", () => {
		const startedAt = performance.now();
		expect(findSecrets("-eyJ".repeat(25_000))).toEqual([]);
		expect(performance.now() - startedAt).toBeLessThan(1000);
	});
});
