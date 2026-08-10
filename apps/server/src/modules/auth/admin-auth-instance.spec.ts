import {
	ADMIN_ACCESS_REQUIRED_ERROR_CODE,
	adminAuth,
	auth,
} from "@wandit/auth";
import { corsWebOrigins } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
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
		expect(adminAuth.options.user?.additionalFields).toEqual(
			auth.options.user?.additionalFields,
		);
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
