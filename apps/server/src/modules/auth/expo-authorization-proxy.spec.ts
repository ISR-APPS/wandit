import {
	assertTrustedAuthorizationUrl,
	isTrustedAuthorizationUrl,
	UNTRUSTED_AUTHORIZATION_URL_CODE,
} from "@wandit/auth/expo-authorization-proxy";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

const TARGET = {
	googleCallbackUrl: "https://api.wandit.test/api/auth/callback/google",
	googleClientId: "123-abc.apps.googleusercontent.com",
};

function googleUrl(overrides: Record<string, string> = {}): string {
	const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	const params = {
		client_id: TARGET.googleClientId,
		redirect_uri: TARGET.googleCallbackUrl,
		response_type: "code",
		scope: "openid email profile",
		state: "abc123",
		...overrides,
	};
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
}

describe("isTrustedAuthorizationUrl", () => {
	it("accepts the Google URL this API issues for the native app", () => {
		expect(isTrustedAuthorizationUrl(googleUrl(), TARGET)).toBe(true);
	});

	it.each([
		["another host", "https://evil.example/o/oauth2/v2/auth?client_id=x"],
		[
			"a look-alike host",
			googleUrl().replace(
				"accounts.google.com",
				"accounts.google.com.evil.example",
			),
		],
		["plain http", googleUrl().replace("https://", "http://")],
		[
			"another client id (attacker-owned OAuth app)",
			googleUrl({ client_id: "999-evil.apps.googleusercontent.com" }),
		],
		[
			"another redirect_uri",
			googleUrl({ redirect_uri: "https://evil.example/cb" }),
		],
		["no redirect_uri", googleUrl().replace(/&?redirect_uri=[^&]*/, "")],
		["a non-URL", "not a url"],
	])("rejects %s", (_label, url) => {
		expect(isTrustedAuthorizationUrl(url, TARGET)).toBe(false);
	});

	it.each([undefined, null, 42, "", {}])("rejects non-string %j", (value) => {
		expect(isTrustedAuthorizationUrl(value, TARGET)).toBe(false);
	});
});

describe("assertTrustedAuthorizationUrl", () => {
	it("throws a typed BAD_REQUEST for an untrusted target", () => {
		let caught: unknown;
		try {
			assertTrustedAuthorizationUrl("https://evil.example/", TARGET);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(APIError);
		expect((caught as APIError).status).toBe("BAD_REQUEST");
		expect((caught as APIError).body).toMatchObject({
			code: UNTRUSTED_AUTHORIZATION_URL_CODE,
		});
	});

	it("returns for the issued Google URL", () => {
		expect(() =>
			assertTrustedAuthorizationUrl(googleUrl(), TARGET),
		).not.toThrow();
	});
});
