import {
	Global,
	Inject,
	Logger,
	Module,
	type OnModuleInit,
	type Provider,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { type Auth, createAuth } from "@wandit/auth";
import { isAdminRole } from "@wandit/contracts";
import { eq, inArray, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { env } from "@wandit/env/server";
import { AnalyticsService } from "../../infrastructure/analytics/analytics.service";
import {
	DATABASE,
	type Database,
} from "../../infrastructure/database/database.constants";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AffiliatesModule } from "../affiliates/affiliates.module";
import { AffiliateAttributionService } from "../affiliates/application/services/affiliate-attribution.service";
import { CreditsModule } from "../credits/credits.module";
import { SettingsModule } from "../settings/settings.module";
import { SignupGrantOutboxService } from "./application/services/signup-grant-outbox.service";
import { SignupGrantsService } from "./application/services/signup-grants.service";
import { AUTH_INSTANCE } from "./auth.constants";
import { SignupGrantOutboxRepository } from "./infrastructure/persistence/signup-grant-outbox.repository";
import { TriggerSignupGrantDispatcherService } from "./infrastructure/trigger/trigger-signup-grant-dispatcher.service";
import { AuthController } from "./presentation/http/controllers/auth.controller";
import { AuthMeController } from "./presentation/http/controllers/me.controller";
import { AuthGuard } from "./presentation/http/guards/auth.guard";
import { EarlyAccessGuard } from "./presentation/http/guards/early-access.guard";

const logger = new Logger("AuthModule");

// ADMIN_EMAILS is a comma-separated allowlist; matching signups are promoted
// to the admin role right after creation.
function parseAdminEmails(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter((email) => email.length > 0);
}

const authProvider: Provider<Auth> = {
	provide: AUTH_INSTANCE,
	inject: [
		AffiliateAttributionService,
		SignupGrantsService,
		DATABASE,
		AnalyticsService,
	],
	useFactory: (
		affiliateAttributionService: AffiliateAttributionService,
		signupGrantsService: SignupGrantsService,
		db: Database,
		analytics: AnalyticsService,
	) =>
		createAuth({
			onUserCreated: async (newUser, ctx) => {
				try {
					await affiliateAttributionService.lockForCreatedUser(newUser, ctx);
				} catch (error) {
					logger.error("Affiliate attribution lock failed", error);
				}

				analytics.capture(newUser.id, "user_signed_up");

				try {
					await signupGrantsService.handleUserCreated(newUser.id);
				} catch (error) {
					logger.error("Signup credit grant failed", error);
				}

				try {
					const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);

					if (adminEmails.includes(newUser.email.toLowerCase())) {
						await db
							.update(user)
							.set({ role: "admin" })
							.where(eq(user.id, newUser.id));
						logger.log(
							`Bootstrapped admin role for user ${newUser.id} (${newUser.email})`,
						);
					}
				} catch (error) {
					logger.error("Admin role bootstrap failed", error);
				}
			},
		}),
};

@Global()
@Module({
	controllers: [AuthController, AuthMeController],
	exports: [AUTH_INSTANCE, AuthGuard, EarlyAccessGuard],
	imports: [AffiliatesModule, CreditsModule, DatabaseModule, SettingsModule],
	providers: [
		authProvider,
		AuthGuard,
		EarlyAccessGuard,
		SignupGrantOutboxRepository,
		SignupGrantOutboxService,
		SignupGrantsService,
		TriggerSignupGrantDispatcherService,
		{
			provide: APP_GUARD,
			useExisting: AuthGuard,
		},
	],
})
export class AuthModule implements OnModuleInit {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Reconcile ADMIN_EMAILS against users that already existed before the
	 * allowlist named them (the signup hook above only covers new accounts).
	 *
	 * Promote-only on purpose: admins granted through the admin UI must never be
	 * revoked by env drift. Failures are logged, never fatal — the API must boot
	 * even when this cannot run.
	 */
	async onModuleInit(): Promise<void> {
		const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);

		if (adminEmails.length === 0) {
			return;
		}

		try {
			const candidates = await this.db
				.select({ id: user.id, email: user.email, role: user.role })
				.from(user)
				.where(inArray(sql`lower(${user.email})`, adminEmails));

			for (const candidate of candidates) {
				if (isAdminRole(candidate.role)) {
					continue;
				}

				await this.db
					.update(user)
					.set({ role: "admin" })
					.where(eq(user.id, candidate.id));
				logger.log(
					`Bootstrapped admin role for user ${candidate.id} (${candidate.email})`,
				);
			}
		} catch (error) {
			logger.error("Admin role reconcile failed", error);
		}
	}
}
