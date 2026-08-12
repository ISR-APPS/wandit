import {
	Global,
	Inject,
	Logger,
	Module,
	type OnModuleInit,
	type Provider,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { type AdminAuth, type Auth, adminAuth, createAuth } from "@wandit/auth";
import { canonicalizeEmail } from "@wandit/auth/email-canonical";
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
import { EmailService } from "../email/application/services/email.service";
import { EmailSendPolicyService } from "../email/application/services/email-send-policy.service";
import { EmailModule } from "../email/email.module";
import { ProductSettingsService } from "../settings/application/services/product-settings.service";
import { SettingsModule } from "../settings/settings.module";
import { SignupGrantOutboxService } from "./application/services/signup-grant-outbox.service";
import { SignupGrantsService } from "./application/services/signup-grants.service";
import { ADMIN_AUTH_INSTANCE, AUTH_INSTANCE } from "./auth.constants";
import { SignupGrantOutboxRepository } from "./infrastructure/persistence/signup-grant-outbox.repository";
import { TriggerSignupGrantDispatcherService } from "./infrastructure/trigger/trigger-signup-grant-dispatcher.service";
import { AdminAuthController } from "./presentation/http/controllers/admin-auth.controller";
import { AuthController } from "./presentation/http/controllers/auth.controller";
import { AuthMeController } from "./presentation/http/controllers/me.controller";
import { AuthGuard } from "./presentation/http/guards/auth.guard";

const logger = new Logger("AuthModule");

// ADMIN_EMAILS is a comma-separated allowlist; matching signups are promoted
// to the admin role right after creation. Canonicalized so a dotted-gmail
// env entry still matches the canonical form users are stored under.
function parseAdminEmails(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((email) => canonicalizeEmail(email))
		.filter((email) => email.length > 0 && email.includes("@"));
}

const authProvider: Provider<Auth> = {
	provide: AUTH_INSTANCE,
	inject: [
		AffiliateAttributionService,
		SignupGrantsService,
		DATABASE,
		AnalyticsService,
		ProductSettingsService,
		EmailService,
		EmailSendPolicyService,
	],
	useFactory: (
		affiliateAttributionService: AffiliateAttributionService,
		signupGrantsService: SignupGrantsService,
		db: Database,
		analytics: AnalyticsService,
		productSettings: ProductSettingsService,
		emailService: EmailService,
		emailSendPolicy: EmailSendPolicyService,
	) =>
		createAuth({
			// Workspace creation is a beta-gated admission — the organizations
			// toggle is the same class of kill switch as paid subscriptions.
			canCreateOrganization: async () => {
				const settings = await productSettings.get();
				return settings.organizationsEnabled;
			},
			// Magic-link/OTP sign-in: toggle gate + abuse gates + delivery.
			// Emails arriving here are canonical (packages/auth before-hook).
			emailAuth: {
				isEnabled: async () => {
					const settings = await productSettings.get();
					return settings.emailAuthEnabled;
				},
				isDeliverable: () => emailService.isDeliverable(),
				guardSend: (data) => emailSendPolicy.assertSignInSendAllowed(data),
				sendMagicLink: ({ email, url }) =>
					emailService.sendMagicLinkEmail(email, url),
				sendOtp: ({ email, otp }) => emailService.sendOtpEmail(email, otp),
			},
			// Invites to disposable domains fail at CREATION with a clear error
			// (the recipient could never complete a verified sign-in anyway).
			guardInviteEmail: async ({ email }) => {
				emailSendPolicy.assertDomainAllowed(email);
			},
			onInvitationCreated: async (invitation) => {
				analytics.capture(
					invitation.inviterUserId,
					"workspace_member_invited",
					{
						organizationId: invitation.organizationId,
						role: invitation.role,
					},
				);

				// Delivery is best-effort by contract: the copyable invite link
				// and the in-app pending-invitations banner remain the fallback,
				// so email failures are logged and never abort the invite.
				try {
					if (
						!(await emailSendPolicy.allowInvitationSend({
							email: invitation.email,
							inviterUserId: invitation.inviterUserId,
						}))
					) {
						return;
					}
					const [inviter] = await db
						.select({ email: user.email, name: user.name })
						.from(user)
						.where(eq(user.id, invitation.inviterUserId))
						.limit(1);
					await emailService.sendInvitationEmail({
						inviteUrl: `${env.CORS_ORIGIN}/invite/${invitation.invitationId}`,
						inviterName: inviter?.name || inviter?.email || "A teammate",
						organizationName: invitation.organizationName,
						to: invitation.email,
					});
				} catch (error) {
					logger.error(
						`Invitation email failed for invitation ${invitation.invitationId}`,
						error,
					);
				}
			},
			onMemberJoined: (data) => {
				analytics.capture(data.userId, "workspace_member_joined", {
					organizationId: data.organizationId,
				});
			},
			onOrganizationCreated: (data) => {
				analytics.capture(data.creatorUserId, "workspace_created", {
					organizationId: data.organizationId,
				});
			},
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

const adminAuthProvider: Provider<AdminAuth> = {
	provide: ADMIN_AUTH_INSTANCE,
	useValue: adminAuth,
};

@Global()
@Module({
	controllers: [AdminAuthController, AuthController, AuthMeController],
	exports: [ADMIN_AUTH_INSTANCE, AUTH_INSTANCE, AuthGuard],
	imports: [
		AffiliatesModule,
		CreditsModule,
		DatabaseModule,
		EmailModule,
		SettingsModule,
	],
	providers: [
		adminAuthProvider,
		authProvider,
		AuthGuard,
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
