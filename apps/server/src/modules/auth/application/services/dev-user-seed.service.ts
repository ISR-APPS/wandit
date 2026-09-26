/**
 * Creates the local development password account (DEV_USER) when the API boots.
 * Nest calls onModuleInit. It does nothing unless isDevPasswordLoginEnabled is true.
 * Writes `user` and `account` through the Better Auth internal adapter, so the signup hooks run.
 */
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
	DEV_USER,
	isDevPasswordLoginEnabled,
} from "@wandit/auth/dev-password-login";
import { env } from "@wandit/env/server";
import type { AuthContext } from "better-auth";

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

@Injectable()
export class DevUserSeedService implements OnModuleInit {
	private readonly logger = new Logger(DevUserSeedService.name);

	constructor(@Inject(AUTH_INSTANCE) private readonly auth: DevUserSeedAuth) {}

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
			const { internalAdapter, password } = await this.auth.$context;
			const existing = await internalAdapter.findUserByEmail(DEV_USER.email, {
				includeAccounts: true,
			});

			if (
				existing?.accounts.some(
					(account) => account.providerId === "credential",
				)
			) {
				return;
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
		} catch (error) {
			this.logger.error(`Dev user seed failed for ${DEV_USER.email}`, error);
		}
	}
}
