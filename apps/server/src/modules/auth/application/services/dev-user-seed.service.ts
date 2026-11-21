/**
 * Creates the local development password account (DEV_USER) when the API boots,
 * and tops up its wallet one time, so it is a paid owner with credits for V2 turns.
 * Nest calls onModuleInit. It does nothing unless isDevPasswordLoginEnabled is true.
 * Writes `user` and `account` through the Better Auth internal adapter, so the signup hooks run.
 * Writes the top-up ledger row through CreditsService, and the Starter pass through StarterPassesRepository.
 */
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
	DEV_USER,
	isDevPasswordLoginEnabled,
} from "@wandit/auth/dev-password-login";
import { creditsToCentiCredits } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { AuthContext } from "better-auth";

import { StarterPassesRepository } from "../../../billing/infrastructure/persistence/starter-passes.repository";
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

/** The credit call of the seed. The spec passes an in-memory fake. */
export type DevSeedCredits = Pick<CreditsService, "topup">;

/** The Starter pass call of the seed. The spec passes an in-memory fake. */
export type DevSeedStarterPasses = Pick<
	StarterPassesRepository,
	"grantIfAbsent"
>;

// 250 credits (spec section 6): enough for some builder turns. The ledger unit is centi-credits.
const DEV_TOPUP_CENTI_CREDITS = creditsToCentiCredits(250);

@Injectable()
export class DevUserSeedService implements OnModuleInit {
	private readonly logger = new Logger(DevUserSeedService.name);

	constructor(
		@Inject(AUTH_INSTANCE) private readonly auth: DevUserSeedAuth,
		@Inject(CreditsService)
		private readonly credits: DevSeedCredits,
		@Inject(StarterPassesRepository)
		private readonly starterPasses: DevSeedStarterPasses,
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
			await this.seedTopup(userId);
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
			(await internalAdapter.createUser(
				{
					email: DEV_USER.email,
					emailVerified: true,
					name: DEV_USER.name,
					// Skip onboarding, so a browser agent lands on the dashboard.
					onboardingCompletedAt: new Date(),
				},
				// The account is a password account. Better Auth gives this source to `user.validateUserInfo`.
				{ method: "email-password" },
			));

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
	 * Tops up the personal wallet of the dev user one time. The top-up makes
	 * it a paid owner (spec section 6), so it gets one V2 backend. More backends
	 * need `BACKEND_LIMIT_OFF=true` in `apps/server/.env`. It also grants an
	 * admin-source Starter pass, so the dev user can spend when the pass is required.
	 */
	private async seedTopup(userId: string): Promise<void> {
		// The key makes the top-up of a later boot a no-op. `topup` throws on a
		// replay with another amount, so a new amount needs a new key.
		await this.credits.topup(userOwner(userId), DEV_TOPUP_CENTI_CREDITS, {
			idempotencyKey: `dev-seed:topup:${userId}`,
			meta: { reason: "dev_user_seed" },
		});
		// The dev account must spend when the Starter pass switch is on. The top-up above has no receipt,
		// so the pass is an admin grant. A live pass makes the grant of a later boot a no-op.
		await this.starterPasses.grantIfAbsent(userOwner(userId), {
			note: "dev seed",
			source: "admin",
		});
	}
}
