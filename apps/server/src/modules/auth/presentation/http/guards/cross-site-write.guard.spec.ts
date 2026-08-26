import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	ADMIN_ORIGIN: "https://admin.wandit.test",
	BETTER_AUTH_URL: "https://api.wandit.test",
	CORS_EXTRA_ORIGINS: ["https://www.wandit.test"],
	CORS_ORIGIN: "https://wandit.test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { AllowCrossSiteWrite } from "../decorators/allow-cross-site-write.decorator";
import {
	allowedWriteOrigins,
	CROSS_SITE_WRITE_ERROR_CODE,
	CrossSiteWriteGuard,
	crossSiteWriteVerdict,
} from "./cross-site-write.guard";

const ALLOWED = [
	"https://wandit.test",
	"https://www.wandit.test",
	"https://admin.wandit.test",
];

describe("crossSiteWriteVerdict", () => {
	it.each([
		"GET",
		"HEAD",
		"OPTIONS",
		"get",
	])("lets safe method %s through whatever the origin", (method) => {
		expect(
			crossSiteWriteVerdict({
				method,
				origin: "https://evil.example",
				allowedOrigins: ALLOWED,
			}),
		).toEqual({ allowed: true });
	});

	it.each([
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
	])("accepts %s from a configured web or admin origin", (method) => {
		for (const origin of ALLOWED) {
			expect(
				crossSiteWriteVerdict({ method, origin, allowedOrigins: ALLOWED }),
			).toEqual({ allowed: true });
		}
	});

	it.each([
		"https://evil.example",
		"https://wandit.test.evil.example",
		"https://api.wandit.test",
		"http://wandit.test",
		"null",
		"",
	])("rejects a write whose Origin is %j", (origin) => {
		expect(
			crossSiteWriteVerdict({
				method: "POST",
				origin,
				allowedOrigins: ALLOWED,
			}),
		).toEqual({ allowed: false, reason: "origin" });
	});

	it("accepts the native app schemes a browser can never present", () => {
		for (const origin of ["wandit://", "exp://192.168.1.10:8081"]) {
			expect(
				crossSiteWriteVerdict({
					method: "POST",
					origin,
					allowedOrigins: ALLOWED,
				}),
			).toEqual({ allowed: true });
		}
	});

	it("accepts a write with no Origin (native app, webhook, curl)", () => {
		expect(
			crossSiteWriteVerdict({ method: "POST", allowedOrigins: ALLOWED }),
		).toEqual({ allowed: true });
		expect(
			crossSiteWriteVerdict({
				method: "DELETE",
				secFetchSite: "same-site",
				allowedOrigins: ALLOWED,
			}),
		).toEqual({ allowed: true });
	});

	it("rejects a write with no Origin whose Referer is another site", () => {
		for (const referer of [
			"https://evil.example/form.html",
			"https://wandit.test.evil.example/",
			"not a url",
		]) {
			expect(
				crossSiteWriteVerdict({
					method: "POST",
					referer,
					allowedOrigins: ALLOWED,
				}),
			).toEqual({ allowed: false, reason: "referer" });
		}
	});

	it("accepts a write with no Origin whose Referer is ours", () => {
		expect(
			crossSiteWriteVerdict({
				method: "POST",
				referer: "https://wandit.test/app/settings?tab=billing",
				allowedOrigins: ALLOWED,
			}),
		).toEqual({ allowed: true });
	});

	it("rejects a browser that omits Origin but reports a cross-site fetch", () => {
		expect(
			crossSiteWriteVerdict({
				method: "POST",
				secFetchSite: "cross-site",
				allowedOrigins: ALLOWED,
			}),
		).toEqual({ allowed: false, reason: "sec-fetch-site" });
	});

	it("uses only the first value of a repeated header", () => {
		expect(
			crossSiteWriteVerdict({
				method: "POST",
				origin: ["https://evil.example", "https://wandit.test"],
				allowedOrigins: ALLOWED,
			}),
		).toEqual({ allowed: false, reason: "origin" });
	});
});

describe("allowedWriteOrigins", () => {
	it("lists the web origins and the admin origin for a hosted API", () => {
		expect(allowedWriteOrigins()).toEqual(ALLOWED);
	});

	it("adds the Expo dev origin only while the API runs on localhost", () => {
		mockEnv.BETTER_AUTH_URL = "http://localhost:3000";
		try {
			expect(allowedWriteOrigins()).toEqual([
				...ALLOWED,
				"http://localhost:8081",
			]);
		} finally {
			mockEnv.BETTER_AUTH_URL = "https://api.wandit.test";
		}
	});
});

function contextFor(options: {
	allowClass?: boolean;
	allowHandler?: boolean;
	method?: string;
	origin?: string;
	referer?: string;
	secFetchSite?: string;
}): ExecutionContext {
	const controller = class TestController {};
	const handler = () => undefined;

	if (options.allowClass) {
		AllowCrossSiteWrite()(controller);
	}
	if (options.allowHandler) {
		AllowCrossSiteWrite()(controller.prototype, "handle", {
			value: handler,
		});
	}

	const request = {
		headers: {
			...(options.origin !== undefined ? { origin: options.origin } : {}),
			...(options.referer ? { referer: options.referer } : {}),
			...(options.secFetchSite
				? { "sec-fetch-site": options.secFetchSite }
				: {}),
		},
		method: options.method ?? "POST",
	};

	return {
		getClass: () => controller,
		getHandler: () => handler,
		switchToHttp: () => ({ getRequest: () => request }),
	} as unknown as ExecutionContext;
}

function guard(): CrossSiteWriteGuard {
	const reflector = {
		getAllAndOverride: (key: symbol, targets: readonly object[]) => {
			for (const target of targets) {
				const value = Reflect.getMetadata(key, target);
				if (value !== undefined) return value;
			}
			return undefined;
		},
	};

	return new CrossSiteWriteGuard(reflector as unknown as Reflector);
}

describe("CrossSiteWriteGuard", () => {
	it("lets the web app write", () => {
		expect(
			guard().canActivate(contextFor({ origin: "https://wandit.test" })),
		).toBe(true);
	});

	it("lets reads through from anywhere", () => {
		expect(
			guard().canActivate(
				contextFor({ method: "GET", origin: "https://evil.example" }),
			),
		).toBe(true);
	});

	it("refuses a cross-site form post with a typed error code", () => {
		let caught: unknown;
		try {
			guard().canActivate(contextFor({ origin: "https://evil.example" }));
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(ForbiddenException);
		expect((caught as ForbiddenException).getResponse()).toMatchObject({
			code: CROSS_SITE_WRITE_ERROR_CODE,
		});
	});

	it("refuses a browser write that hides Origin but is flagged cross-site", () => {
		expect(() =>
			guard().canActivate(contextFor({ secFetchSite: "cross-site" })),
		).toThrow(ForbiddenException);
	});

	it("refuses a browser write that hides Origin but carries a foreign Referer", () => {
		expect(() =>
			guard().canActivate(
				contextFor({ referer: "https://evil.example/attack.html" }),
			),
		).toThrow(ForbiddenException);
	});

	it("lets a request with no browser signals through (native app)", () => {
		expect(guard().canActivate(contextFor({}))).toBe(true);
	});

	it("honours @AllowCrossSiteWrite on the class and on the handler", () => {
		expect(
			guard().canActivate(
				contextFor({ allowClass: true, origin: "https://merchant.example" }),
			),
		).toBe(true);
		expect(
			guard().canActivate(contextFor({ allowHandler: true, origin: "null" })),
		).toBe(true);
	});
});
