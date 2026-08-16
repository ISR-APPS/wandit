import {
	ADMIN_ACCESS_REQUIRED_ERROR_CODE,
	adminAuth,
	auth,
	createAuth,
} from "@wandit/auth";
import { corsWebOrigins } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
import type { SecondaryStorage } from "better-auth";
import { describe, expect, it, vi } from "vitest";

vi.mock("@wandit/env/server", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@wandit/env/server")>();
	return {
		...actual,
		env: {
			...actual.env,
			ADMIN_ORIGIN: "https://admin.wandit.test",
			NODE_ENV: "development",
		},
	};
});

describe("@wandit/auth isolated admin instance", () => {
	it("keeps web and admin paths, plugins, and providers separate", () => {
		expect(auth.options.basePath).toBe("/api/auth");
		expect(auth.options.advanced).not.toHaveProperty("cookiePrefix");
		expect(auth.options.plugins?.map((plugin) => plugin.id)).toEqual(
			expect.arrayContaining([
				"expo",
				"admin",
				"organization",
				"magic-link",
				"email-otp",
			]),
		);
		expect(auth.options.rateLimit?.storage).toBe("database");
		expect(auth.options).not.toHaveProperty("secondaryStorage");
		expect(auth.options.session).toBeUndefined();
		expect(auth.options.verification).toBeUndefined();
		expect(auth.options.trustedOrigins).toEqual([
			...corsWebOrigins(env.CORS_ORIGIN, env.CORS_EXTRA_ORIGINS),
			"wandit://",
			"exp://",
			"http://localhost:8081",
		]);

		expect(adminAuth.options.basePath).toBe("/api/admin-auth");
		expect(adminAuth.options.advanced?.cookiePrefix).toBe("wandit-admin");
		expect(adminAuth.options.advanced).not.toHaveProperty("cookies");
		expect(adminAuth.options.plugins?.map((plugin) => plugin.id)).toEqual([
			"admin",
		]);
		expect(adminAuth.options.database).toBe(auth.options.database);
		expect(adminAuth.options.socialProviders?.google).toEqual(
			expect.objectContaining({
				disableImplicitSignUp: true,
				disableSignUp: true,
			}),
		);
		expect(adminAuth.options.disabledPaths).toContain("/admin/set-role");
		expect(adminAuth.options.disabledPaths).toContain("/admin/has-permission");
		expect(adminAuth.options.rateLimit?.storage).toBe("memory");
		expect(adminAuth.options.trustedOrigins).toEqual(
			env.ADMIN_ORIGIN ? [env.ADMIN_ORIGIN] : [],
		);
	});

	it("uses injected secondary storage only for main-auth rate limiting", () => {
		const increment = vi.fn(async () => 1);
		const secondaryStorage = {
			delete: vi.fn(async () => undefined),
			get: vi.fn(async () => null),
			increment,
			set: vi.fn(async () => undefined),
		} satisfies SecondaryStorage;

		const redisAuth = createAuth({ secondaryStorage });

		// Root secondary storage would also take over session-list and
		// bulk-revocation operations in Better Auth 1.6.22.
		expect(redisAuth.options).not.toHaveProperty("secondaryStorage");
		expect(redisAuth.options.rateLimit?.storage).toBe("secondary-storage");
		expect(redisAuth.options.rateLimit).toHaveProperty("customStorage");
		expect(redisAuth.options.session).toEqual({
			cookieCache: {
				enabled: true,
				maxAge: 300,
				strategy: "compact",
			},
			storeSessionInDatabase: true,
		});
		expect(redisAuth.options.verification).toEqual({
			storeInDatabase: true,
		});
	});

	it("adapts injected atomic increments to rate-limit decisions", async () => {
		const increment = vi
			.fn<(key: string, ttl: number) => Promise<number>>()
			.mockResolvedValueOnce(3)
			.mockResolvedValueOnce(4);
		const redisAuth = createAuth({
			secondaryStorage: {
				delete: vi.fn(async () => undefined),
				get: vi.fn(async () => null),
				increment,
				set: vi.fn(async () => undefined),
			},
		});
		const rateLimit = redisAuth.options.rateLimit;
		const consume =
			rateLimit && "customStorage" in rateLimit
				? rateLimit.customStorage.consume
				: undefined;

		if (!consume) {
			throw new Error("Atomic rate-limit storage is missing");
		}

		await expect(
			consume("203.0.113.10|/sign-in/email", { max: 3, window: 60 }),
		).resolves.toEqual({ allowed: true, retryAfter: null });
		await expect(
			consume("203.0.113.10|/sign-in/email", { max: 3, window: 60 }),
		).resolves.toEqual({ allowed: false, retryAfter: 60 });
		expect(increment).toHaveBeenCalledTimes(2);
		expect(increment).toHaveBeenCalledWith("203.0.113.10|/sign-in/email", 60);
	});

	it("preserves the database-backed factory defaults without storage", () => {
		const databaseAuth = createAuth();

		expect(databaseAuth.options.rateLimit?.storage).toBe("database");
		expect(databaseAuth.options).not.toHaveProperty("secondaryStorage");
		expect(databaseAuth.options.session).toBeUndefined();
		expect(databaseAuth.options.verification).toBeUndefined();
	});

	it("computes non-colliding session cookie names for both instances", async () => {
		const [webContext, adminContext] = await Promise.all([
			auth.$context,
			adminAuth.$context,
		]);
		const securePrefix = env.BETTER_AUTH_URL.startsWith("https://")
			? "__Secure-"
			: "";
		const authOrigin = new URL(env.BETTER_AUTH_URL).origin;

		expect(webContext.baseURL).toBe(`${authOrigin}/api/auth`);
		expect(adminContext.baseURL).toBe(`${authOrigin}/api/admin-auth`);
		expect(webContext.authCookies.sessionToken.name).toBe(
			`${securePrefix}better-auth.session_token`,
		);
		expect(webContext.authCookies.sessionData.name).toBe(
			`${securePrefix}better-auth.session_data`,
		);
		expect(adminContext.authCookies.sessionToken.name).toBe(
			`${securePrefix}wandit-admin.session_token`,
		);
		expect(adminContext.authCookies.sessionData.name).toBe(
			`${securePrefix}wandit-admin.session_data`,
		);
		expect(adminContext.authCookies.sessionToken.attributes.sameSite).toBe(
			webContext.authCookies.sessionToken.attributes.sameSite,
		);
		expect(adminContext.authCookies.sessionToken.attributes.secure).toBe(
			webContext.authCookies.sessionToken.attributes.secure,
		);
		const googleProvider = adminContext.socialProviders.find(
			(provider) => provider.id === "google",
		);
		expect(googleProvider?.disableImplicitSignUp).toBe(true);
		expect(googleProvider?.options?.disableSignUp).toBe(true);
	});

	it("refuses to create an admin session for a non-admin user", async () => {
		const sessionAdmission =
			adminAuth.options.databaseHooks?.session?.create?.before;
		if (!sessionAdmission) {
			throw new Error("Admin session admission hook is missing");
		}
		const findUserById = vi.fn().mockResolvedValue({ role: "user" });

		await expect(
			sessionAdmission(
				{ userId: "user_1" } as never,
				{
					context: { internalAdapter: { findUserById } },
				} as never,
			),
		).rejects.toMatchObject({
			statusCode: 403,
			body: { code: ADMIN_ACCESS_REQUIRED_ERROR_CODE },
		});
		expect(findUserById).toHaveBeenCalledWith("user_1");
	});

	it("allows a stored admin role to create an admin session", async () => {
		const sessionAdmission =
			adminAuth.options.databaseHooks?.session?.create?.before;
		if (!sessionAdmission) {
			throw new Error("Admin session admission hook is missing");
		}

		await expect(
			sessionAdmission(
				{ userId: "admin_1" } as never,
				{
					context: {
						internalAdapter: {
							findUserById: vi.fn().mockResolvedValue({ role: "user,admin" }),
						},
					},
				} as never,
			),
		).resolves.toBeUndefined();
	});
});
