import { createAuth } from "@wandit/auth";
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { createUserCreatedHook } from "@wandit/auth/user-created-hook";
import type { GenericEndpointContext, User } from "better-auth";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("@wandit/auth dev password login", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("turns on password sign-in without sign-up for a local development API", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:3000");

		expect(createAuth().options.emailAndPassword).toEqual({
			disableSignUp: true,
			enabled: true,
		});
	});

	it("refuses the dev password when the request host is not localhost", async () => {
		vi.stubEnv("NODE_ENV", "development");

		const response = await createAuth().handler(
			new Request(
				"https://public-words.trycloudflare.com/api/auth/sign-in/email",
				{
					body: JSON.stringify({
						email: DEV_USER.email,
						password: DEV_USER.password,
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				},
			),
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			code: "DEV_PASSWORD_LOGIN_LOCALHOST_ONLY",
		});
	});

	it.each([
		["test", "http://localhost:3000"],
		["production", "http://localhost:3000"],
		["development", "https://api.wandit.dev"],
	])("keeps password sign-in off when NODE_ENV=%s and BETTER_AUTH_URL=%s", (nodeEnv, authUrl) => {
		vi.stubEnv("NODE_ENV", nodeEnv);
		vi.stubEnv("BETTER_AUTH_URL", authUrl);

		expect(createAuth().options.emailAndPassword).toBeUndefined();
	});
});

describe("@wandit/auth user-created hook", () => {
	it("forwards the Better Auth context and signup body", async () => {
		const onUserCreated = vi.fn(
			(_user: User, _ctx: GenericEndpointContext | null) => undefined,
		);
		const user = { id: "user_1" } as User;
		const ctx = {
			body: { affiliateToken: "signed-affiliate-token" },
		} as GenericEndpointContext;
		const hook = createUserCreatedHook(onUserCreated);

		await hook(user, ctx);

		expect(onUserCreated).toHaveBeenCalledOnce();
		expect(onUserCreated).toHaveBeenCalledWith(user, ctx);
		expect(onUserCreated.mock.calls[0]?.[1]?.body).toEqual({
			affiliateToken: "signed-affiliate-token",
		});
	});
});
