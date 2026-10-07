/**
 * Creates the local development password account (DEV_USER) when the API boots,
 * and gives it a Business plan with its credits, so it can build V2 projects with a backend.
 * Nest calls onModuleInit. It does nothing unless isDevPasswordLoginEnabled is true.
 * Writes `user` and `account` through the Better Auth internal adapter, so the signup hooks run.
 * Writes the plan row through SubscriptionsRepository and its credits through CreditsService.
 */
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
	DEV_USER,
	isDevPasswordLoginEnabled,
} from "@wandit/auth/dev-password-login";
import {
	addBillingInterval,
	creditsToCentiCredits,
	priceLookupKey,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { AuthContext } from "better-auth";

import {
	type SubscriptionRow,
	SubscriptionsRepository,
} from "../../../billing/infrastructure/persistence/subscriptions.repository";
import { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import { AUTH_INSTANCE } from "../../auth.constants";

/**
 * The part of the Better Auth instance that the seed calls. It is narrow,
 * so the spec can pass a memory-adapter instance with other options.
 */
type DevUserSeedAuth = {
	$context: Promise<{
		internalAdapter: Pick<
			AuthContext["internalAdapter"],
			"createUser" | "findUserByEmail" | "linkAccount"
		>;
		password: Pick<AuthContext["password"], "hash">;
	}>;
};

/** The two subscription calls of the seed. The spec passes an in-memory fake. */
export type DevPlanSubscriptions = Pick<
	SubscriptionsRepository,
	"findActiveByOwner" | "insertManual"
>;

/** The credit call of the seed. The spec passes an in-memory fake. */
export type DevPlanCredits = Pick<CreditsService, "grant">;

// The smallest Business tier, in whole credits: enough for some builder turns.
const DEV_PLAN_TIER_CREDITS = 250;

// Every plan row the seed writes has this id prefix. A row without it
// belongs to a developer, and the seed does not touch it.
const DEV_PLAN_ID_PREFIX = "manual_dev-seed_";

@Injectable()
export class DevUserSeedService implements OnModuleInit {
	private readonly logger = new Logger(DevUserSeedService.name);

	constructor(
		@Inject(AUTH_INSTANCE) private readonly auth: DevUserSeedAuth,
		@Inject(SubscriptionsRepository)
		private readonly subscriptions: DevPlanSubscriptions,
		@Inject(CreditsService)
		private readonly credits: DevPlanCredits,
	) {}

	async onModuleInit(): Promise<void> {
		if (
			!isDevPasswordLoginEnabled({
				authUrl: env.BETTER_AUTH_URL,
				nodeEnv: env.NODE_ENV,
			})
		) {
			return;
		}

		// A failed seed must not stop the API boot. Google sign-in still works.
		try {
			const userId = await this.seedUser();
			await this.seedPlan(userId);
		} catch (error) {
			this.logger.error(`Dev user seed failed for ${DEV_USER.email}`, error);
		}
	}

	/** Creates the dev user and its password account when they are missing. Answers the user id. */
	private async seedUser(): Promise<string> {
		const { internalAdapter, password } = await this.auth.$context;
		const existing = await internalAdapter.findUserByEmail(DEV_USER.email, {
			includeAccounts: true,
		});

		if (
			existing?.accounts.some((account) => account.providerId === "credential")
		) {
			return existing.user.id;
		}

		// Worktrees share one database. The unique `user.email` index makes a
		// second concurrent boot fail here, so the signup credit grant runs once.
		const user =
			existing?.user ??
			(await internalAdapter.createUser({
				email: DEV_USER.email,
				emailVerified: true,
				name: DEV_USER.name,
				// Skip onboarding, so a browser agent lands on the dashboard.
				onboardingCompletedAt: new Date(),
			}));

		// The same row that Better Auth sign-up writes: account id = user id.
		await internalAdapter.linkAccount({
			accountId: user.id,
			password: await password.hash(DEV_USER.password),
			providerId: "credential",
			userId: user.id,
		});
		this.logger.log(`Seeded dev user ${DEV_USER.email}`);
		return user.id;
	}

	/**
	 * Inserts an active yearly Business plan row for the personal pool of the
	 * dev user, then grants its tier credits once. The plan sets the backend
	 * limit (`backendsPerPlan` in backend-lifecycle.ts). Business has the
	 * largest limit, so a new project gets a backend. The admin grant path
	 * allows Business only for an organization; `resolveBillingPlan` reads
	 * the plan only.
	 */
	private async seedPlan(userId: string): Promise<void> {
		const owner = userOwner(userId);
		const active = await this.subscriptions.findActiveByOwner(owner);
		// A developer can give the dev user a plan on purpose (Stripe test
		// mode, an admin grant). The seed keeps that row and adds no credits.
		if (
			active &&
			!active.providerSubscriptionId.startsWith(DEV_PLAN_ID_PREFIX)
		) {
			if (active.plan !== "business") {
				this.logger.warn(
					`Dev user ${DEV_USER.email} keeps its active ${active.plan} plan. The seed adds no Business plan.`,
				);
			}
			return;
		}

		const plan = active ?? (await this.insertPlan(userId));
		// The admin grant path gives the tier credits with the row. The key
		// makes the grant of a later boot a no-op, so each row grants once.
		// LIMIT: one grant per yearly row, no monthly refill slots. Upgrade:
		// SubscriptionRefillService.createYearlySlots, like the admin yearly grant.
		await this.credits.grant(owner, creditsToCentiCredits(plan.tierCredits), {
			bucket: "plan",
			idempotencyKey: `dev-seed:${plan.id}:plan`,
			meta: { reason: "dev_user_seed_plan", subscriptionId: plan.id },
		});
	}

	/** Inserts the Business plan row of the dev user and answers it. */
	private async insertPlan(userId: string): Promise<SubscriptionRow> {
		const periodStart = new Date();
		// Worktrees share one database. The unique index on live personal rows
		// makes a second concurrent boot fail here, so only one row exists.
		const row = await this.subscriptions.insertManual({
			cancelAtPeriodEnd: false,
			currentPeriodEnd: addBillingInterval(periodStart, "year"),
			currentPeriodStart: periodStart,
			interval: "year",
			organizationId: null,
			plan: "business",
			priceLookupKey: priceLookupKey("business", DEV_PLAN_TIER_CREDITS, "year"),
			// A new id per row: the manual expiry sweep ends the row after its
			// period, and the next boot inserts a new one.
			providerSubscriptionId: `${DEV_PLAN_ID_PREFIX}${randomUUID()}`,
			status: "active",
			tierCredits: DEV_PLAN_TIER_CREDITS,
			userId,
		});
		this.logger.log(`Seeded a Business plan for dev user ${DEV_USER.email}`);
		return row;
	}
}
