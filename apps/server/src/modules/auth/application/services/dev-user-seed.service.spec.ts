import { Logger } from "@nestjs/common";
import { DEV_USER } from "@wandit/auth/dev-password-login";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
	InsertManualSubscriptionInput,
	SubscriptionRow,
} from "../../../billing/infrastructure/persistence/subscriptions.repository";
import {
	type DevPlanCredits,
	type DevPlanSubscriptions,
	DevUserSeedService,
} from "./dev-user-seed.service";

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

/** A full `subscriptions` row from the insert input, with the defaults of the table. */
function subscriptionRow(
	input: InsertManualSubscriptionInput,
): SubscriptionRow {
	return {
		...input,
		createdAt: new Date(),
		id: crypto.randomUUID(),
		pendingAppliedBy: null,
		pendingInterval: null,
		pendingPlan: null,
		pendingTierCredits: null,
		provider: "manual",
		updatedAt: new Date(),
	};
}

/**
 * An in-memory `subscriptions` table with the two calls of the seed.
 * `inserted` records every insert of the seed.
 */
function memorySubscriptions(rows: SubscriptionRow[] = []) {
	const inserted: InsertManualSubscriptionInput[] = [];
	const subscriptions: DevPlanSubscriptions = {
		findActiveByOwner: async (owner) =>
			rows.find(
				(row) =>
					owner.type === "user" &&
					row.userId === owner.userId &&
					row.organizationId === null &&
					row.status === "active",
			) ?? null,
		insertManual: async (input) => {
			inserted.push(input);
			const row = subscriptionRow(input);
			rows.push(row);
			return row;
		},
	};
	return { inserted, subscriptions };
}

/** One grant the seed asked for: the amount in centi-credits and the options. */
type Grant = {
	amount: number;
	options: Parameters<DevPlanCredits["grant"]>[2];
};

/**
 * An in-memory ledger with the grant call of the seed. Like CreditsService,
 * a second grant with a known idempotency key writes nothing.
 */
function memoryCredits() {
	const granted: Grant[] = [];
	const credits: DevPlanCredits = {
		grant: async (owner, amount, options) => {
			if (
				!granted.some(
					(grant) => grant.options.idempotencyKey === options.idempotencyKey,
				)
			) {
				granted.push({ amount, options });
			}
			return {
				bucket: options.bucket,
				createdAt: new Date(),
				delta: amount,
				id: crypto.randomUUID(),
				idempotencyKey: options.idempotencyKey ?? null,
				kind: "grant",
				meta: options.meta ?? null,
				organizationId: null,
				userId: owner.type === "user" ? owner.userId : null,
			};
		},
	};
	return { credits, granted };
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
			memorySubscriptions().subscriptions,
			memoryCredits().credits,
		).onModuleInit();

		const signIn = await signInAsDevUser(auth);
		expect(signIn.user).toMatchObject({
			email: DEV_USER.email,
			emailVerified: true,
			name: DEV_USER.name,
		});
		expect(signIn.user.onboardingCompletedAt).toBeInstanceOf(Date);
	});

	it("gives the dev user an active yearly Business plan and its 250 credits", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const { inserted, subscriptions } = memorySubscriptions();
		const { credits, granted } = memoryCredits();

		await new DevUserSeedService(auth, subscriptions, credits).onModuleInit();

		const devUser = await findDevUser(auth);
		expect(inserted).toEqual([
			expect.objectContaining({
				interval: "year",
				organizationId: null,
				plan: "business",
				priceLookupKey: "business_250_year",
				status: "active",
				userId: devUser?.user.id,
			}),
		]);
		// 250 whole credits are 25 000 centi-credits in the ledger.
		expect(granted).toEqual([
			{
				amount: 25_000,
				options: expect.objectContaining({
					bucket: "plan",
					idempotencyKey: expect.stringMatching(/^dev-seed:.+:plan$/),
				}),
			},
		]);
	});

	it("writes nothing on a second boot", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const { inserted, subscriptions } = memorySubscriptions();
		const { credits, granted } = memoryCredits();
		const service = new DevUserSeedService(auth, subscriptions, credits);

		await service.onModuleInit();
		await service.onModuleInit();

		const { internalAdapter } = await auth.$context;
		expect(await internalAdapter.listUsers()).toHaveLength(1);
		expect((await findDevUser(auth))?.accounts).toHaveLength(1);
		expect(inserted).toHaveLength(1);
		expect(granted).toHaveLength(1);
	});

	it("grants the credits of a seed plan row that an older boot wrote without them", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const { internalAdapter } = await auth.$context;
		const devUser = await internalAdapter.createUser({
			email: DEV_USER.email,
			name: DEV_USER.name,
		});
		const seedPlan = subscriptionRow({
			cancelAtPeriodEnd: false,
			currentPeriodEnd: new Date("2027-10-03T00:00:00.000Z"),
			currentPeriodStart: new Date("2026-10-03T00:00:00.000Z"),
			interval: "year",
			organizationId: null,
			plan: "business",
			priceLookupKey: "business_250_year",
			providerSubscriptionId: "manual_dev-seed_older-boot",
			status: "active",
			tierCredits: 250,
			userId: devUser.id,
		});
		const { inserted, subscriptions } = memorySubscriptions([seedPlan]);
		const { credits, granted } = memoryCredits();

		await new DevUserSeedService(auth, subscriptions, credits).onModuleInit();

		expect(inserted).toEqual([]);
		expect(granted).toEqual([
			expect.objectContaining({
				amount: 25_000,
				options: expect.objectContaining({
					idempotencyKey: `dev-seed:${seedPlan.id}:plan`,
				}),
			}),
		]);
	});

	it("keeps an active plan that a developer gave the dev user", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const auth = createMemoryAuth();
		const { internalAdapter } = await auth.$context;
		const devUser = await internalAdapter.createUser({
			email: DEV_USER.email,
			name: DEV_USER.name,
		});
		const proPlan = subscriptionRow({
			cancelAtPeriodEnd: false,
			currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
			currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
			interval: "month",
			organizationId: null,
			plan: "pro",
			priceLookupKey: "pro_250_month",
			providerSubscriptionId: "sub_test_1",
			status: "active",
			tierCredits: 250,
			userId: devUser.id,
		});
		const { inserted, subscriptions } = memorySubscriptions([proPlan]);
		const { credits, granted } = memoryCredits();

		await new DevUserSeedService(auth, subscriptions, credits).onModuleInit();

		expect(inserted).toEqual([]);
		expect(granted).toEqual([]);
	});

	it("links a password account to a dev user row that has none", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = createMemoryAuth();
		const { internalAdapter } = await auth.$context;
		await internalAdapter.createUser({
			email: DEV_USER.email,
			name: DEV_USER.name,
		});

		await new DevUserSeedService(
			auth,
			memorySubscriptions().subscriptions,
			memoryCredits().credits,
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
		const { inserted, subscriptions } = memorySubscriptions();
		const { credits, granted } = memoryCredits();

		await new DevUserSeedService(auth, subscriptions, credits).onModuleInit();

		expect(await findDevUser(auth)).toBeNull();
		expect(inserted).toEqual([]);
		expect(granted).toEqual([]);
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
				memorySubscriptions().subscriptions,
				memoryCredits().credits,
			).onModuleInit(),
		).resolves.toBeUndefined();

		expect(logError).toHaveBeenCalledWith(
			`Dev user seed failed for ${DEV_USER.email}`,
			failure,
		);
	});
});
