import { Logger } from "@nestjs/common";
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	type DevSeedCredits,
	type DevSeedStarterPasses,
	DevUserSeedService,
} from "./dev-user-seed.service";

// The pass write is a no-op here: these cases check the user and the top-up.
const noStarterPasses: DevSeedStarterPasses = {
	grantIfAbsent: async () => null,
};

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

/** One top-up the seed asked for: the owner, the amount in centi-credits, and the options. */
type Topup = {
	userId: string | null;
	amount: number;
	options: Parameters<DevSeedCredits["topup"]>[2];
};

/**
 * An in-memory ledger with the top-up call of the seed. Like CreditsService,
 * a second top-up with a known idempotency key writes nothing.
 */
function memoryCredits() {
	const toppedUp: Topup[] = [];
	const credits: DevSeedCredits = {
		topup: async (owner, amount, options) => {
			const userId = owner.type === "user" ? owner.userId : null;
			if (
				!toppedUp.some(
					(topup) => topup.options?.idempotencyKey === options?.idempotencyKey,
				)
			) {
				toppedUp.push({ amount, options, userId });
			}
			return {
				bucket: "topup",
				createdAt: new Date(),
				delta: amount,
				id: crypto.randomUUID(),
				idempotencyKey: options?.idempotencyKey ?? null,
				kind: "topup",
				meta: options?.meta ?? null,
				organizationId: null,
				userId,
			};
		},
	};
	return { credits, toppedUp };
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

		await new DevUserSeedService(
			auth,
			memoryCredits().credits,
			noStarterPasses,
		).onModuleInit();

		const signIn = await signInAsDevUser(auth);
		expect(signIn.user).toMatchObject({
			email: DEV_USER.email,
			emailVerified: true,
			name: DEV_USER.name,
		});
		expect(signIn.user.onboardingCompletedAt).toBeInstanceOf(Date);
	});

	it("tops up 250 credits one time, with the same key on each boot", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const { credits, toppedUp } = memoryCredits();
		const service = new DevUserSeedService(auth, credits, noStarterPasses);

		await service.onModuleInit();
		await service.onModuleInit();

		const { internalAdapter } = await auth.$context;
		expect(await internalAdapter.listUsers()).toHaveLength(1);
		const devUser = await findDevUser(auth);
		expect(devUser?.accounts).toHaveLength(1);
		// 250 whole credits are 25 000 centi-credits in the ledger.
		expect(toppedUp).toEqual([
			{
				amount: 25_000,
				options: {
					idempotencyKey: `dev-seed:topup:${devUser?.user.id}`,
					meta: { reason: "dev_user_seed" },
				},
				userId: devUser?.user.id,
			},
		]);
	});

	it("links a password account to a dev user row that has none", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const { internalAdapter } = await auth.$context;
		await internalAdapter.createUser(
			{
				email: DEV_USER.email,
				name: DEV_USER.name,
			},
			{ method: "email-password" },
		);

		await new DevUserSeedService(
			auth,
			memoryCredits().credits,
			noStarterPasses,
		).onModuleInit();

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
		const { credits, toppedUp } = memoryCredits();

		await new DevUserSeedService(auth, credits, noStarterPasses).onModuleInit();

		expect(await findDevUser(auth)).toBeNull();
		expect(toppedUp).toEqual([]);
	});

	it("logs the failure and lets the API boot", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const logError = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const failure = new Error("database unavailable");

		await expect(
			new DevUserSeedService(
				{ $context: Promise.reject(failure) },
				memoryCredits().credits,
				noStarterPasses,
			).onModuleInit(),
		).resolves.toBeUndefined();

		expect(logError).toHaveBeenCalledWith(
			`Dev user seed failed for ${DEV_USER.email}`,
			failure,
		);
	});
});
