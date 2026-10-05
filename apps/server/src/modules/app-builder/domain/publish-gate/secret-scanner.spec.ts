import { describe, expect, it } from "vitest";

import type { PublishGateFile } from "../ports/publish-gate";
import { SecretScanGate } from "./secret-scanner";

// The spec builds each fake key at run time, because GitHub push protection
// blocks a full key literal.
const awsKey = `AKIA${"Q7".repeat(8)}`;
const stripeSecretKey = `sk_live_${"Ab3".repeat(8)}`;
const googleKey = `AIza${"Lm8".repeat(11)}Np`;
const pemBody = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC".repeat(2);
// The random base64 of an image can hold the shape of an AWS key.
const pngDataUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ/${awsKey}/AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

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

const encoder = new TextEncoder();

function textFile(path: string, text: string): PublishGateFile {
	return { content: encoder.encode(text), path };
}

function scan(files: PublishGateFile[]) {
	return new SecretScanGate().run({
		buildId: "build-1",
		files,
		projectId: "project-1",
	});
}

describe("SecretScanGate", () => {
	it("blocks a live Stripe key, a service-role JWT, and a private key in client assets", async () => {
		const findings = await scan([
			textFile(
				"client/assets/index-BX7a9kQz.js",
				`const logo="${pngDataUrl}";const s="${stripeSecretKey}";fetch(u,{headers:{apikey:"${jwt("service_role")}"}});const t="${stripeSecretKey}";`,
			),
			textFile(
				"client/assets/admin-Ck2pQ9xA.js",
				`const account={"private_key":"${pem("PRIVATE KEY", pemBody, "\\n")}\\n"};`,
			),
		]);

		expect(findings).toEqual([
			{
				kind: "secret",
				path: "client/assets/index-BX7a9kQz.js",
				rule: "stripe_live_secret_key",
				sample: "sk_live_…3Ab3",
				severity: "block",
			},
			{
				kind: "secret",
				path: "client/assets/index-BX7a9kQz.js",
				rule: "supabase_service_role_jwt",
				sample: "eyJ…Sig9",
				severity: "block",
			},
			{
				kind: "secret",
				path: "client/assets/admin-Ck2pQ9xA.js",
				rule: "private_key",
				sample: `${pemHeader("PRIVATE KEY")}…`,
				severity: "block",
			},
		]);
	});

	it("finds nothing in a clean Vite build", async () => {
		const findings = await scan([
			textFile(
				"client/index.html",
				'<script type="module" crossorigin src="/assets/index-BX7a9kQz.js"></script><link rel="stylesheet" href="/assets/index-C3vT8mWq.css">',
			),
			textFile(
				"client/assets/index-BX7a9kQz.js",
				`import{c as r}from"./vendor-Dk3Lx8Pq.js";const s=r("https://abcdefghijklmnop.supabase.co","sb_publishable_${"Xy9".repeat(8)}");const a="${jwt("anon")}";const logo="${pngDataUrl}";`,
			),
			textFile(
				"client/assets/index-C3vT8mWq.css",
				`.logo{background:url(${pngDataUrl})}`,
			),
		]);

		expect(findings).toEqual([]);
	});

	// Vite inlines a small file that the code imports with `?url` as a data URL.
	it("blocks a private key in a JSON data URL", async () => {
		const accountJson = JSON.stringify({
			private_key: pem("PRIVATE KEY", pemBody, "\n"),
		});
		const dataUrl = `data:application/json;base64,${Buffer.from(accountJson).toString("base64")}`;
		const findings = await scan([
			textFile(
				"client/assets/index-BX7a9kQz.js",
				`const account="${dataUrl}";`,
			),
		]);

		expect(findings).toEqual([
			{
				kind: "secret",
				path: "client/assets/index-BX7a9kQz.js",
				rule: "private_key",
				sample: `${pemHeader("PRIVATE KEY")}…`,
				severity: "block",
			},
		]);
	});

	it.each([
		{ rule: "aws_access_key", key: awsKey, severity: "block" },
		{ rule: "stripe_live_secret_key", key: stripeSecretKey, severity: "block" },
		{
			rule: "stripe_live_restricted_key",
			key: `rk_live_${"Cd4".repeat(8)}`,
			severity: "block",
		},
		{
			rule: "stripe_webhook_secret",
			key: `whsec_${"Ef5".repeat(8)}`,
			severity: "block",
		},
		{
			rule: "supabase_secret_key",
			key: `sb_secret_${"Gh6".repeat(8)}`,
			severity: "block",
		},
		{
			rule: "supabase_service_role_jwt",
			key: jwt("service_role"),
			severity: "block",
		},
		{
			rule: "anthropic_api_key",
			key: `sk-ant-api03-${"Jk7".repeat(8)}`,
			severity: "block",
		},
		{ rule: "google_api_key", key: googleKey, severity: "warn" },
		{
			rule: "private_key",
			key: pem("PRIVATE KEY", pemBody, "\n"),
			severity: "block",
		},
	])("reports $rule in a client asset as $severity", async ({
		rule,
		key,
		severity,
	}) => {
		const findings = await scan([
			textFile("client/assets/index-BX7a9kQz.js", `const k="${key}";`),
		]);

		expect(findings).toMatchObject([{ rule, severity }]);
	});

	it("warns on a key in a server module", async () => {
		const findings = await scan([
			textFile("server/index.js", `const k="${stripeSecretKey}";`),
		]);

		expect(findings).toEqual([
			{
				kind: "secret",
				path: "server/index.js",
				rule: "stripe_live_secret_key",
				sample: "sk_live_…3Ab3",
				severity: "warn",
			},
		]);
	});

	it("skips a binary file", async () => {
		// A PNG file has a 0 byte after its 8-byte signature, in the length of
		// the first chunk. The key text after it is image data.
		const png = new Uint8Array([
			0x89,
			0x50,
			0x4e,
			0x47,
			0x0d,
			0x0a,
			0x1a,
			0x0a,
			0x00,
			...encoder.encode(stripeSecretKey),
		]);

		expect(
			await scan([{ content: png, path: "client/assets/logo-Bq3xT7Lp.png" }]),
		).toEqual([]);
	});

	it("keeps the block finding first when the cap of 50 cuts the list", async () => {
		const serverChunks = Array.from({ length: 60 }, (_, index) =>
			textFile(`server/chunk-${index}.js`, `const k="${stripeSecretKey}";`),
		);
		const findings = await scan([
			...serverChunks,
			textFile(
				"client/assets/index-BX7a9kQz.js",
				`const k="${stripeSecretKey}";`,
			),
		]);

		expect(findings).toHaveLength(50);
		expect(findings[0]).toMatchObject({
			path: "client/assets/index-BX7a9kQz.js",
			severity: "block",
		});
	});
});
