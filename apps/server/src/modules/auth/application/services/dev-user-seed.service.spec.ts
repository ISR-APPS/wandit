import { Logger } from "@nestjs/common";
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevUserSeedService } from "./dev-user-seed.service";

// A real Better Auth instance on an in-memory store, with the same
// emailAndPassword options that createAuth uses in local development.
function createMemoryAuth() {
	return betterAuth({
		baseURL: "http://localhost:3000",
		database: memoryAdapter({
			account: [],
			session: [],
			user: [],
			verification: [],
		}),
		emailAndPassword: { disableSignUp: true, enabled: true },
		secret: "test-secret-test-secret-test-secret-1234",
		user: {
			additionalFields: {
				onboardingCompletedAt: { input: false, required: false, type: "date" },
			},
		},
	});
}

async function findDevUser(auth: ReturnType<typeof createMemoryAuth>) {
	const { internalAdapter } = await auth.$context;
	return internalAdapter.findUserByEmail(DEV_USER.email, {
		includeAccounts: true,
	});
}

function signInAsDevUser(auth: ReturnType<typeof createMemoryAuth>) {
	return auth.api.signInEmail({
		body: { email: DEV_USER.email, password: DEV_USER.password },
	});
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("DevUserSeedService", () => {
	it("seeds a verified, onboarded user that signs in with the dev password", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();

		await new DevUserSeedService(auth).onModuleInit();

		const signIn = await signInAsDevUser(auth);
		expect(signIn.user).toMatchObject({
			email: DEV_USER.email,
			emailVerified: true,
			name: DEV_USER.name,
		});
		expect(signIn.user.onboardingCompletedAt).toBeInstanceOf(Date);
	});

	it("writes nothing on a second boot", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const service = new DevUserSeedService(auth);

		await service.onModuleInit();
		await service.onModuleInit();

		const { internalAdapter } = await auth.$context;
		expect(await internalAdapter.listUsers()).toHaveLength(1);
		expect((await findDevUser(auth))?.accounts).toHaveLength(1);
	});

	it("links a password account to a dev user row that has none", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const { internalAdapter } = await auth.$context;
		await internalAdapter.createUser({
			email: DEV_USER.email,
			name: DEV_USER.name,
		});

		await new DevUserSeedService(auth).onModuleInit();

		expect(await internalAdapter.listUsers()).toHaveLength(1);
		await expect(signInAsDevUser(auth)).resolves.toMatchObject({
			user: { email: DEV_USER.email },
		});
	});

	it.each([
		["test", "http://localhost:3000"],
		["production", "http://localhost:3000"],
		["development", "https://api.wandit.dev"],
	])("writes nothing when NODE_ENV=%s and BETTER_AUTH_URL=%s", async (nodeEnv, authUrl) => {
		vi.stubEnv("NODE_ENV", nodeEnv);
		vi.stubEnv("BETTER_AUTH_URL", authUrl);
		const auth = createMemoryAuth();

		await new DevUserSeedService(auth).onModuleInit();

		expect(await findDevUser(auth)).toBeNull();
	});

	it("logs the failure and lets the API boot", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const logError = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const failure = new Error("database unavailable");

		await expect(
			new DevUserSeedService({
				$context: Promise.reject(failure),
			}).onModuleInit(),
		).resolves.toBeUndefined();

		expect(logError).toHaveBeenCalledWith(
			`Dev user seed failed for ${DEV_USER.email}`,
			failure,
		);
	});
});
