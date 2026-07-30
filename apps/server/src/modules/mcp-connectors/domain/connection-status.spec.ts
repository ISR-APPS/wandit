import { describe, expect, it } from "vitest";

import { deriveStatus } from "./connection-status";

describe("deriveStatus", () => {
	it("is not connected when no connection row exists", () => {
		expect(deriveStatus(undefined)).toBe("not_connected");
	});

	it("is not connected when the row has no access token", () => {
		expect(
			deriveStatus({
				accessToken: null,
				accessTokenExpiresAt: null,
			}),
		).toBe("not_connected");
	});

	it("is connected when the token has no expiry", () => {
		expect(
			deriveStatus({
				accessToken: "access-token",
				accessTokenExpiresAt: null,
			}),
		).toBe("connected");
	});

	it("is connected while the token expiry is in the future", () => {
		expect(
			deriveStatus({
				accessToken: "access-token",
				accessTokenExpiresAt: new Date(Date.now() + 60_000),
			}),
		).toBe("connected");
	});

	it("is expired when the token expiry is in the past without a refresh token", () => {
		expect(
			deriveStatus({
				accessToken: "access-token",
				accessTokenExpiresAt: new Date(Date.now() - 60_000),
				refreshToken: null,
			}),
		).toBe("expired");
	});

	it("stays connected when an expired access token has a refresh token", () => {
		expect(
			deriveStatus({
				accessToken: "access-token",
				accessTokenExpiresAt: new Date(Date.now() - 60_000),
				refreshToken: "refresh-token",
			}),
		).toBe("connected");
	});
});
