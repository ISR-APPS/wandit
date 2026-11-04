import { describe, expect, it } from "vitest";

import {
	isOAuthFormBodyPath,
	oauthMetadataCorsOptions,
} from "./oauth-http-boundary";

describe("isOAuthFormBodyPath", () => {
	it.each([
		["/api/auth/oauth2/token", true],
		["/api/auth/oauth2/revoke", true],
		["/api/auth/oauth2/introspect", true],
		["/api/auth/oauth2/token?client_id=abc", true],
		// A cross-site form must keep its 415 on every other write route.
		["/api/auth/oauth2/authorize", false],
		["/api/auth/oauth2/consent", false],
		["/api/auth/sign-in/email", false],
		["/api/auth/oauth2/token/", false],
		["/api/auth/oauth2/tokenx", false],
		["/api/auth/oauth2/token/../consent", false],
		["/api/v2/projects", false],
	])("%s -> %s", (url, expected) => {
		expect(isOAuthFormBodyPath(url)).toBe(expected);
	});
});

describe("oauthMetadataCorsOptions", () => {
	it.each([
		["/.well-known/oauth-protected-resource", true],
		["/.well-known/oauth-protected-resource/api/mcp", true],
		["/.well-known/oauth-authorization-server/api/auth", true],
		["/.well-known/oauth-protected-resource/api/mcp?x=1", true],
		// The wildcard origin must never reach a cookie route.
		["/api/mcp", false],
		["/api/auth/oauth2/token", false],
		["/.well-known/oauth-protected-resource/api/mcp/extra", false],
		["/.well-known/oauth-authorization-server", false],
		["/api/.well-known/oauth-protected-resource", false],
	])("%s -> %s", (url, isPublic) => {
		expect(oauthMetadataCorsOptions(url)?.origin === "*").toBe(isPublic);
	});
});
