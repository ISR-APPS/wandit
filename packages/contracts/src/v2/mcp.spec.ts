import { describe, expect, it } from "vitest";

import { mcpApplyChangesInputSchema, mcpClientRegistrationSchema } from "./mcp";

describe("mcpClientRegistrationSchema", () => {
	it.each([
		[["http://127.0.0.1/callback"], true],
		[["http://localhost:33418/"], true],
		[["http://[::1]:8080/cb"], true],
		[["https://vscode.dev/redirect"], true],
		// Cursor gets its code on its own scheme.
		[["cursor://anysphere.cursor-mcp/oauth/callback"], true],
		// Any other custom scheme can open another app on the device.
		[["vscode://vscode.github-authentication/did-authenticate"], false],
		[["data:text/html,<script>alert(1)</script>"], false],
		[["file:///etc/passwd"], false],
		// Plain http on a public host leaks the code on the network.
		[["http://evil.test/cb"], false],
		[["http://127.0.0.1.evil.test/cb"], false],
		[["javascript:alert(1)"], false],
		// The plugin keeps this query on its redirects, so it would fake or hide an OAuth answer.
		[["http://127.0.0.1/cb?code=x"], false],
		[["http://127.0.0.1/cb?error=x"], false],
		[["not a url"], false],
		[["https://ok.test/cb", "http://evil.test/cb"], false],
		[[], false],
	])("redirect_uris %j -> %s", (redirectUris, expected) => {
		const result = mcpClientRegistrationSchema.safeParse({
			redirect_uris: redirectUris,
			token_endpoint_auth_method: "none",
		});
		expect(result.success).toBe(expected);
	});

	it.each([
		["client_secret_basic"],
		[undefined],
	])("refuses token_endpoint_auth_method %s", (method) => {
		const result = mcpClientRegistrationSchema.safeParse({
			redirect_uris: ["http://127.0.0.1/callback"],
			token_endpoint_auth_method: method,
		});
		expect(result.success).toBe(false);
	});

	// The server would call or redirect to these URLs later, for any anonymous client.
	it.each([
		["backchannel_logout_uri", "https://probe.evil.test/logout"],
		["post_logout_redirect_uris", ["https://evil.test/after-logout"]],
	])("refuses %s", (field, value) => {
		const result = mcpClientRegistrationSchema.safeParse({
			[field]: value,
			redirect_uris: ["http://127.0.0.1/callback"],
			token_endpoint_auth_method: "none",
		});
		expect(result.success).toBe(false);
	});
});

describe("mcpApplyChangesInputSchema", () => {
	const BASE = {
		expectedHeadSha: "a".repeat(40),
		message: "Edit the hero",
		projectId: "0b9e4c4e-6f43-4d2f-9b7a-3f1f2e9c8d10",
	};
	// 3 bytes in UTF-8 and 1 UTF-16 unit: 180,000 of them are 540,000 bytes, over 512 KiB.
	const EURO_SIGN = "\u20ac";

	it.each([
		[
			"one write and one delete",
			[
				{ content: "a", path: "src/a.ts" },
				{ delete: true, path: "src/b.ts" },
			],
			true,
		],
		[
			"a file of exactly 512 KiB",
			[{ content: "a".repeat(512 * 1024), path: "src/a.ts" }],
			true,
		],
		[
			"a file over 512 KiB in UTF-8 bytes",
			[{ content: EURO_SIGN.repeat(180_000), path: "src/a.ts" }],
			false,
		],
		["a NUL byte", [{ content: "a\0b", path: "src/a.ts" }], false],
		// `$(dirname ...)` in the write script drops a trailing newline, so ".claude\n" wrote to ".claude".
		[
			"a newline in a path segment",
			[{ content: "a", path: ".claude\n/hooks/pre-tool-use.mjs" }],
			false,
		],
		["a tab in a path", [{ delete: true, path: "CLAUDE.md\t" }], false],
		["a DEL in a path", [{ content: "a", path: "src/a\u007f.ts" }], false],
		["a lone surrogate", [{ content: "\ud800", path: "src/a.ts" }], false],
		[
			"the same path twice",
			[
				{ content: "a", path: "src/a.ts" },
				{ delete: true, path: "src/a.ts" },
			],
			false,
		],
		[
			"a delete that also holds content",
			[{ content: "a", delete: true, path: "src/a.ts" }],
			false,
		],
	])("%s -> %s", (_label, changes, expected) => {
		const result = mcpApplyChangesInputSchema.safeParse({ ...BASE, changes });
		expect(result.success).toBe(expected);
	});

	it("refuses more than 2 MiB in one call", () => {
		const changes = Array.from({ length: 5 }, (_, index) => ({
			content: "a".repeat(500 * 1024),
			path: `src/file-${index}.ts`,
		}));
		expect(
			mcpApplyChangesInputSchema.safeParse({ ...BASE, changes }).success,
		).toBe(false);
	});
});
