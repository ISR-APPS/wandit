import { createAuth } from "@wandit/auth";
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("@wandit/auth dev password login", () => {
	afterEach(() => vi.unstubAllEnvs());

	it.each([
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://[::1]:3000",
	])("enables password sign-in without sign-up for development at %s", (authUrl) => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("BETTER_AUTH_URL", authUrl);
		expect(createAuth().options.emailAndPassword).toEqual({
			disableSignUp: true,
			enabled: true,
		});
	});

	it.each([
		["test", "http://localhost:3000"],
		["production", "http://localhost:3000"],
		["development", "https://api.wandit.dev"],
		["development", "https://localhost.example.com"],
		["development", "http://0.0.0.0:3000"],
	])("disables password sign-in for %s at %s", (nodeEnv, authUrl) => {
		vi.stubEnv("NODE_ENV", nodeEnv);
		vi.stubEnv("BETTER_AUTH_URL", authUrl);
		expect(createAuth().options.emailAndPassword).toBeUndefined();
	});

	it.each([
		undefined,
		"http://localhost:3301",
	])("refuses public tunnel requests with Origin=%s", async (origin) => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("CORS_ORIGIN", "http://localhost:3301");
		const response = await createAuth().handler(
			new Request(
				"https://public-words.trycloudflare.com/api/auth/sign-in/email",
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						"x-forwarded-host": "localhost:3000",
						...(origin ? { origin } : {}),
					},
					body: JSON.stringify({
						email: DEV_USER.email,
						password: DEV_USER.password,
					}),
				},
			),
		);
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			code: "DEV_PASSWORD_LOGIN_LOCALHOST_ONLY",
		});
	});

	describe.each(["host", "x-forwarded-host"])("request header %s", (header) => {
		it.each([
			"public-words.trycloudflare.com",
			"localhost:3000, public-words.trycloudflare.com",
			"invalid host",
			"public.example@localhost",
			"user:password@localhost",
			"@localhost",
			"localhost/path",
			"localhost/",
			"localhost/../",
			"localhost\\path",
			"localhost?public.example",
			"localhost#public.example",
		])("refuses a local request URL with header value %s", async (host) => {
			vi.stubEnv("NODE_ENV", "development");
			const response = await createAuth().handler(
				new Request("http://localhost:3000/api/auth/sign-in/email", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						host: "localhost:3000",
						[header]: host,
					},
					body: JSON.stringify({
						email: DEV_USER.email,
						password: DEV_USER.password,
					}),
				}),
			);
			expect(response.status).toBe(403);
			await expect(response.json()).resolves.toMatchObject({
				code: "DEV_PASSWORD_LOGIN_LOCALHOST_ONLY",
			});
		});
	});

	it.each([
		"/api/auth/sign-in/email/",
		"/api/auth//sign-in/email",
		"/api/auth/sign-in/%65mail",
		"/api/auth/sign-in/other/../email",
	])("rejects alternate tunnel path %s", async (path) => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("CORS_ORIGIN", "http://localhost:3301");
		const response = await createAuth().handler(
			new Request(`https://public-words.trycloudflare.com${path}`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:3301",
				},
				body: JSON.stringify({
					email: DEV_USER.email,
					password: DEV_USER.password,
				}),
			}),
		);
		expect([403, 404]).toContain(response.status);
	});

	it("keeps Better Auth origin checks on for local password requests", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createAuth();
		// Better Auth disables Origin checks under Vitest. Restore its normal runtime behavior for this request.
		expect(auth.options.advanced).not.toMatchObject({
			disableOriginCheck: true,
		});
		expect(auth.options.advanced).not.toMatchObject({ disableCSRFCheck: true });
		const context = await auth.$context;
		context.skipOriginCheck = false;
		const response = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-in/email", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://untrusted.example",
					cookie: "better-auth.session_token=test-session",
				},
				body: JSON.stringify({
					email: DEV_USER.email,
					password: DEV_USER.password,
				}),
			}),
		);
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			code: "INVALID_ORIGIN",
		});
	});

	it("refuses password account creation on the local API", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const response = await createAuth().handler(
			new Request("http://localhost:3000/api/auth/sign-up/email", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(DEV_USER),
			}),
		);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
		});
	});
});
