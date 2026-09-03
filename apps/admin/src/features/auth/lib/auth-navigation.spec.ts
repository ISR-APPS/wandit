import { describe, expect, it } from "vitest";

import { buildAdminAuthCallbackUrls, parseLoginError } from "./auth-navigation";

describe("buildAdminAuthCallbackUrls", () => {
	it("returns the admin dashboard and an unambiguous OAuth error URL", () => {
		expect(buildAdminAuthCallbackUrls("https://admin.wandit.dev")).toEqual({
			callbackURL: "https://admin.wandit.dev/dashboard",
			errorCallbackURL: "https://admin.wandit.dev/login",
		});
	});
});

describe("parseLoginError", () => {
	it.each([
		"forbidden",
		"ADMIN_ACCESS_REQUIRED",
		"signup_disabled",
	])("maps %s to the no-admin-access message", (error) => {
		expect(parseLoginError(error)).toBe("forbidden");
	});

	it("maps other OAuth errors to the generic sign-in message", () => {
		expect(parseLoginError("access_denied")).toBe("oauth");
	});

	it("ignores missing or malformed errors", () => {
		expect(parseLoginError(undefined)).toBeUndefined();
		expect(parseLoginError(["ADMIN_ACCESS_REQUIRED"])).toBeUndefined();
	});
});
