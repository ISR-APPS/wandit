import { describe, expect, it, vi } from "vitest";

import {
	clientAddresses,
	parseOAuthRedirect,
	parseRequestedScopes,
	readSignedOAuthQuery,
} from "./helpers";

describe("clientAddresses", () => {
	const CIMD_ID = "https://claude.ai/oauth/claude-code-client-metadata";
	const claudeAi = {
		kind: "client_id",
		address: "https://claude.ai",
		opensLocalApp: false,
	};

	it.each([
		// A CIMD id names the app. The path and the user info never show.
		[CIMD_ID, "http://127.0.0.1:33418/callback", [claudeAi]],
		[
			"https://user@claude.ai.evil.example/client",
			null,
			[
				{
					kind: "client_id",
					address: "https://claude.ai.evil.example",
					opensLocalApp: false,
				},
			],
		],
		// A CIMD document can send the code to another host. The page must show that host too.
		[
			CIMD_ID,
			"https://evil.example/cb",
			[
				claudeAi,
				{
					kind: "redirect",
					address: "https://evil.example",
					opensLocalApp: false,
				},
			],
		],
		// Only http on a loopback host stays on this computer.
		[
			CIMD_ID,
			"http://evil.example/cb",
			[
				claudeAi,
				{
					kind: "redirect",
					address: "http://evil.example",
					opensLocalApp: false,
				},
			],
		],
		[
			CIMD_ID,
			"cursor://anysphere.cursor-retrieval/oauth/callback",
			[
				claudeAi,
				{
					kind: "redirect",
					address: "cursor://anysphere.cursor-retrieval",
					opensLocalApp: true,
				},
			],
		],
		// An http id is not a fetched identity: the return address shows instead.
		[
			"http://claude.ai/client",
			"https://evil.example/cb",
			[
				{
					kind: "redirect",
					address: "https://evil.example",
					opensLocalApp: false,
				},
			],
		],
		// A registered client has a random id.
		[
			"Xy12random",
			"http://127.0.0.1:54321/callback",
			[
				{
					kind: "redirect",
					address: "http://127.0.0.1:54321",
					opensLocalApp: false,
				},
			],
		],
		[
			"Xy12random",
			"com.example.app:/callback",
			[{ kind: "redirect", address: "com.example.app:", opensLocalApp: true }],
		],
		["Xy12random", "not a url", []],
		["Xy12random", null, []],
	])("%s with %s -> %o", (clientId, redirectUri, expected) => {
		expect(clientAddresses(clientId, redirectUri)).toEqual(expected);
	});
});

describe("parseRequestedScopes", () => {
	it("keeps the order, shows a repeated scope once, and marks an unknown scope", () => {
		expect(
			parseRequestedScopes(
				" projects:read  builder:run projects:read admin:all offline_access",
			),
		).toEqual([
			{ kind: "known", scope: "projects:read" },
			{ kind: "known", scope: "builder:run" },
			{ kind: "unknown", name: "admin:all" },
			{ kind: "known", scope: "offline_access" },
		]);
	});
});

describe("parseOAuthRedirect", () => {
	const apiOrigin = "https://api.wandit.dev";

	it.each([
		[
			"https://wandit.dev/oauth/consent?sig=a",
			"https://wandit.dev/oauth/consent?sig=a",
		],
		[
			"http://127.0.0.1:33418/callback?code=c",
			"http://127.0.0.1:33418/callback?code=c",
		],
		[
			"cursor://anysphere.cursor-retrieval/cb?code=c",
			"cursor://anysphere.cursor-retrieval/cb?code=c",
		],
		// The API wrote a relative URL, so it resolves on the API origin, never on the web origin.
		[
			"/api/auth/error?error=invalid_client",
			"https://api.wandit.dev/api/auth/error?error=invalid_client",
		],
		["javascript:alert(1)", null],
		["JavaScript:alert(1)", null],
		["data:text/html,<script>alert(1)</script>", null],
		["vbscript:msgbox(1)", null],
		["http://[invalid", null],
	])("%s -> %s", (url, expected) => {
		expect(parseOAuthRedirect(url, apiOrigin)?.toString() ?? null).toBe(
			expected,
		);
	});
});

// Safari 16 has no URL.canParse. One call to it crashes the consent page before Allow.
it("parses client and redirect URLs without URL.canParse", () => {
	const canParse = vi.spyOn(URL, "canParse").mockImplementation(() => {
		throw new TypeError("URL.canParse is not a function");
	});
	try {
		expect(
			clientAddresses(
				"https://claude.ai/oauth/claude-code-client-metadata",
				"https://evil.example/cb",
			).map((entry) => entry.address),
		).toEqual(["https://claude.ai", "https://evil.example"]);
		expect(
			parseOAuthRedirect("/api/auth/error", "https://api.wandit.dev")?.href,
		).toBe("https://api.wandit.dev/api/auth/error");
	} finally {
		canParse.mockRestore();
	}
});

describe("readSignedOAuthQuery", () => {
	// The names that the API signed, as `ba_param` lists them. The plugin sorts them.
	const SIGNED_QUERY =
		"client_id=c&scope=projects%3Aread+offline_access&exp=1&ba_param=ba_param&ba_param=client_id&ba_param=exp&ba_param=scope&sig=s";

	it.each([
		// A link tracker or a browser extension can add a param. The API did not sign it, so it must not go back.
		[`?${SIGNED_QUERY}&utm_source=mail`, SIGNED_QUERY],
		// Without `ba_param`, nothing names the signed params: the API did not send the browser here.
		["?client_id=c&exp=1&sig=s", null],
		["?client_id=c&ba_param=client_id", null],
	])("%s -> %s", (search, expected) => {
		expect(readSignedOAuthQuery(search)).toBe(expected);
	});
});
