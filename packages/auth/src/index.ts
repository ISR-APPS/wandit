/**
 * Builds the Better Auth instances: createAuth for the web and native apps, createAdminAuth for the admin app.
 * The server AuthModule calls createAuth with its delivery and signup hooks.
 * With V2_BUILDER_ENABLED, createAuth is also the OAuth provider of the MCP server (mcp-oauth-provider.ts).
 * Both instances write users, sessions, and accounts to Postgres through the Drizzle adapter.
 */
import { expo } from "@better-auth/expo";
import { isStaffRole } from "@wandit/contracts";
import { and, createDb, eq, gt, sql } from "@wandit/db";
import * as authSchema from "@wandit/db/schema/auth";
import * as oauthProviderSchema from "@wandit/db/schema/oauth-provider";
import * as orgSchema from "@wandit/db/schema/organizations";
import { resolveAuthCookieSameSite } from "@wandit/env/cookie-same-site";
import {
	corsWebOrigins,
	expoDevOrigins,
	isLocalhostUrl,
} from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
import {
	type BetterAuthRateLimitStorage,
	betterAuth,
	type GoogleOptions,
	type SecondaryStorage,
} from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	APIError,
	createAuthMiddleware,
	getIP,
	getOAuthState,
	getSessionFromCtx,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import {
	admin,
	captcha,
	emailOTP,
	magicLink,
	organization,
} from "better-auth/plugins";
import { z } from "zod";
import { adminAccessControl, adminRoles } from "./admin-permissions";
import { isDevPasswordLoginEnabled } from "./dev-password-login";
import { canonicalizeEmail } from "./email-canonical";
import { emailMagicLinkUrl } from "./email-magic-link-url";
import {
	assertTrustedAuthorizationUrl,
	EXPO_AUTHORIZATION_PROXY_PATH,
} from "./expo-authorization-proxy";
import {
	createMcpOAuthPlugins,
	MCP_OAUTH_DISABLED_PATHS,
	type OnMcpConsentChange,
} from "./mcp-oauth-provider";
import { workspaceAccessControl, workspaceRoles } from "./permissions";
import { createUserCreatedHook, type OnUserCreated } from "./user-created-hook";
import {
	isPersonalWorkspaceSlug,
	isViewerOnly,
	memberRoleUpdateRefusal,
	splitWorkspaceRoles,
	WORKSPACE_INVITATION_EXPIRES_IN_DAYS,
	type WorkspaceKindFacts,
	type WorkspaceRuleRefusal,
	workspaceInviteRefusal,
} from "./workspace-membership-rules";

// The drizzle adapter resolves models by key on the object below — the
// organization plugin needs `organization`, `member`, and `invitation` present
// or every /api/auth/organization/* route fails with "model not found".
// The OAuth provider plugins need `jwks` and the `oauth*` models the same way.
const schema = { ...authSchema, ...orgSchema, ...oauthProviderSchema };
const db = createDb();

// The admin plugin is kept for its schema fields (role/banned/banExpires), but
// every HTTP route it mounts is served by NestJS admin controllers instead.
// Better Auth answers 404 in onRequest before routing; server-side
// `auth.api.*` calls are unaffected. Enumerated from
// better-auth/dist/plugins/admin/routes.mjs — keep in sync on upgrades.
const ADMIN_PLUGIN_DISABLED_PATHS = [
	"/admin/set-role",
	"/admin/get-user",
	"/admin/create-user",
	"/admin/update-user",
	"/admin/list-users",
	"/admin/list-user-sessions",
	"/admin/unban-user",
	"/admin/ban-user",
	"/admin/impersonate-user",
	"/admin/stop-impersonating",
	"/admin/revoke-user-session",
	"/admin/revoke-user-sessions",
	"/admin/remove-user",
	"/admin/set-user-password",
	"/admin/has-permission",
];

// The email-otp plugin mounts a whole password-reset and email-change surface
// the web app does not use. Enumerated from
// better-auth/dist/plugins/email-otp/routes.mjs — keep in sync on upgrades.
const EMAIL_OTP_DISABLED_PATHS = [
	"/email-otp/request-password-reset",
	"/email-otp/reset-password",
	"/forget-password/email-otp",
	"/email-otp/verify-email",
	"/email-otp/request-email-change",
	"/email-otp/change-email",
	"/email-otp/check-verification-otp",
];

// Better Auth allows 3 requests per 10 s per IP on every `/sign-in/*` path.
// An event room shares one NAT IP, so Google sign-in gets 100 per 10 s.
// This route returns the Google redirect URL, or checks an ID token that Google signed.
// Only Google issues a valid token, so a higher cap does not help a password guess.
// `/sign-in/email` keeps the default rule.
// A key is the path without the `/api/auth` base path. Better Auth matches it exactly.
const AUTH_RATE_LIMIT_CUSTOM_RULES = {
	"/sign-in/social": { window: 10, max: 100 },
};

// Surfaced by the OAuth callback as `?error=...` — keep the string stable.
export const ADMIN_ACCESS_REQUIRED_ERROR_CODE = "ADMIN_ACCESS_REQUIRED";

export type OrganizationInvitationCreated = {
	invitationId: string;
	email: string;
	role: string;
	organizationId: string;
	organizationName: string;
	inviterUserId: string;
};

/**
 * A member lost access in a workspace: removed, left, or changed to viewer only.
 * The server runs the cleanup of workspaces-sharing.md 2.1 with it.
 */
export type MembershipReduction = {
	organizationId: string;
	userId: string;
	/** `removed`: remove-member. `left`: the user left. `viewer`: a role update left only `viewer`. */
	change: "removed" | "left" | "viewer";
	/** Client IP for the turn-cancel audit rows. Null in the plugin hooks, because they get no request. */
	ipAddress: string | null;
};

// Surfaced to the web client as result.error.code — keep the string stable.
export const EMAIL_AUTH_DISABLED_ERROR_CODE = "EMAIL_AUTH_DISABLED";

export type EmailAuthSendKind = "magic-link" | "otp";

/**
 * Email (magic link + OTP) delivery + abuse gates, wired by the server.
 * The verify endpoints need no gate of their own: a token/OTP only exists if
 * a send already passed isEnabled + guardSend, magic-link tokens are
 * single-use, and OTPs are attempt-capped by the plugin.
 */
export type EmailAuthDelivery = {
	/** The emailAuthEnabled product-setting gate, checked before every send. */
	isEnabled: () => Promise<boolean> | boolean;
	/**
	 * False when no delivery channel is configured. Checked in the admission
	 * hook so a misconfigured deploy fails the request loudly instead of
	 * issuing a code nobody can receive (the OTP plugin swallows send errors).
	 */
	isDeliverable: () => boolean;
	/**
	 * Abuse gate between the toggle and the send. Throws an APIError
	 * (disposable-domain blocklist, per-email / per-IP caps) to veto.
	 * Receives the CANONICAL email — the before-hook rewrites the body first.
	 */
	guardSend: (data: {
		email: string;
		kind: EmailAuthSendKind;
		ipAddress: string | null;
	}) => Promise<void>;
	sendMagicLink: (data: { email: string; url: string }) => Promise<void>;
	sendOtp: (data: { email: string; otp: string }) => Promise<void>;
};

export type CreateAuthOptions = {
	/**
	 * Server-owned atomic counter (Redis INCR) for distributed rate limits.
	 * The factory reads only `increment`. It never sets it as root secondaryStorage.
	 * If it is absent, the factory keeps its existing database rate limiter.
	 */
	secondaryStorage?: Pick<SecondaryStorage, "increment">;
	onUserCreated?: OnUserCreated;
	/**
	 * Admission gate for workspace creation — wired to the
	 * `organizationsEnabled` product setting by the server. Defaults to
	 * closed: without the server wiring, nobody can create organizations.
	 */
	canCreateOrganization?: (user: { id: string }) => Promise<boolean> | boolean;
	/**
	 * The `organizationsEnabled` product setting. Absent means closed: invites
	 * and accepts into a personal workspace fail (workspaces-sharing.md 3.4).
	 */
	isOrganizationsEnabled?: () => Promise<boolean> | boolean;
	/**
	 * Invitation delivery hook. The server records analytics and sends the
	 * invitation email. The copyable invite link and the in-app banner stay the fallback.
	 */
	onInvitationCreated?: (
		invitation: OrganizationInvitationCreated,
	) => Promise<void> | void;
	/** Analytics: organization created (also fires on the checkout birth flow). */
	onOrganizationCreated?: (data: {
		organizationId: string;
		creatorUserId: string;
	}) => Promise<void> | void;
	/**
	 * Email sign-in delivery + gates. Absent = email auth hard-off: the
	 * magic-link/OTP endpoints stay mounted but every send throws
	 * EMAIL_AUTH_DISABLED, and no token can exist without a send.
	 */
	emailAuth?: EmailAuthDelivery;
	/**
	 * Veto an invitation recipient (disposable-domain blocklist). Called with
	 * the canonicalized email before the org plugin processes invite-member.
	 * A disposable invitee could never complete email sign-in anyway — fail
	 * at creation time with a clear error instead of a dead-end invite.
	 */
	guardInviteEmail?: (data: { email: string }) => Promise<void>;
	/**
	 * Analytics: a user became a member. Invitation accepts do NOT fire the
	 * plugin's afterAddMember hook (crud-invites.mjs:345), so this is wired to
	 * BOTH afterAddMember and afterAcceptInvitation.
	 */
	onMemberJoined?: (data: {
		organizationId: string;
		userId: string;
	}) => Promise<void> | void;
	/**
	 * Cleanup after a removal, a leave, or a change to viewer. It runs after the member
	 * row changed. On an error the hook undoes the change and rethrows, so a retry runs it again.
	 */
	onMembershipReduced?: (data: MembershipReduction) => Promise<void>;
	/**
	 * Audit of coding-agent grants: a consent accepted or revoked. Runs only
	 * when the MCP OAuth provider is on (V2_BUILDER_ENABLED).
	 */
	onMcpConsentChange?: OnMcpConsentChange;
};

function createBaseAuthOptions() {
	// See TRUSTED_PROXY_CIDRS in @wandit/env: without these, a request whose
	// X-Forwarded-For has more than one hop resolves to NO client IP, and
	// Better Auth then rate-limits every such caller through a single shared
	// bucket per path. Empty list = single-hop/direct deployments only.
	const trustedProxies = (env.TRUSTED_PROXY_CIDRS ?? "")
		.split(",")
		.map((cidr) => cidr.trim())
		.filter((cidr) => cidr.length > 0);

	// https deployments set the cookie attributes explicitly. SameSite decides
	// whether a cross-site HTML form can carry the session cookie (CSRF):
	// - production: wandit.dev, admin.wandit.dev and api.wandit.dev are one
	//   site, so "lax" works for sign-in AND blocks forged cross-site writes;
	// - staging: the web on vercel.app and the API on api-staging.wandit.dev
	//   are different sites, so every auth cookie (OAuth state, session) must
	//   be SameSite=None;Secure or browsers drop it on the cross-site hop —
	//   the symptom is "State mismatch: State not persisted correctly" on the
	//   Google callback. The API's CrossSiteWriteGuard covers CSRF there.
	// Local dev is same-site localhost over plain http, where None+Secure
	// would itself be rejected — keep Better Auth's defaults there.
	const httpsCookies = new URL(env.BETTER_AUTH_URL).protocol === "https:";
	const cookieSameSite = resolveAuthCookieSameSite({
		apiUrl: env.BETTER_AUTH_URL,
		browserOrigins: [
			...corsWebOrigins(env.CORS_ORIGIN, env.CORS_EXTRA_ORIGINS),
			...(env.ADMIN_ORIGIN ? [env.ADMIN_ORIGIN] : []),
		],
		override: env.AUTH_COOKIE_SAME_SITE,
	});

	return {
		advanced: {
			...(httpsCookies
				? {
						defaultCookieAttributes: {
							sameSite: cookieSameSite,
							secure: true,
						},
					}
				: {}),
			...(trustedProxies.length > 0 ? { ipAddress: { trustedProxies } } : {}),
		},
		account: { encryptOAuthTokens: true },
		database: drizzleAdapter(db, {
			provider: "pg" as const,
			schema: schema,
		}),
		disabledPaths: [...ADMIN_PLUGIN_DISABLED_PATHS],
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		// The database store survives restarts and is shared by every API
		// process. Enablement keeps Better Auth's default (production only).
		rateLimit: {
			customRules: AUTH_RATE_LIMIT_CUSTOM_RULES,
			storage: "database" as const,
		},
	};
}

const baseAuthOptions = createBaseAuthOptions();

/**
 * Adapts the injected counter to Better Auth rate-limit storage.
 * One atomic increment per request, so concurrent requests cannot pass a stale read.
 */
function createRateLimitStorage(
	secondaryStorage: Pick<SecondaryStorage, "increment">,
): BetterAuthRateLimitStorage {
	return {
		async consume(key, rule) {
			const count = await secondaryStorage.increment(key, rule.window);

			return count <= rule.max
				? { allowed: true, retryAfter: null }
				: { allowed: false, retryAfter: rule.window };
		},
	};
}

const GOOGLE_DISPLAY_EMAIL_OAUTH_STATE_KEY = "wanditGoogleDisplayEmail";

async function getGoogleDisplayEmailFromOAuthState(data: { email?: unknown }) {
	try {
		if (typeof data.email !== "string") {
			return;
		}
		const oauthState = await getOAuthState();
		const displayEmail = oauthState?.[GOOGLE_DISPLAY_EMAIL_OAUTH_STATE_KEY];
		if (
			typeof displayEmail !== "string" ||
			canonicalizeEmail(displayEmail) !== data.email
		) {
			return;
		}
		return { data: { displayEmail } };
	} catch {
		// A cosmetic field must never abort Google sign-in.
	}
}

async function refreshExistingGoogleDisplayEmail(
	canonicalEmail: string,
	displayEmail: string,
) {
	try {
		await db
			.update(authSchema.user)
			.set({ displayEmail })
			.where(
				and(
					eq(authSchema.user.email, canonicalEmail),
					sql`${authSchema.user.displayEmail} is distinct from ${displayEmail}`,
				),
			);
	} catch {
		// A cosmetic refresh must never abort Google sign-in.
	}
}

function createGoogleProviderOptions(): GoogleOptions {
	return {
		// offline → Google issues a refresh token whenever its consent screen is
		// shown. No global `prompt`: forcing consent on every sign-in would hurt
		// the funnel.
		accessType: "offline",
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET,
		mapProfileToUser: async (profile) => {
			const displayEmail = profile.email.trim();
			const canonicalEmail = canonicalizeEmail(profile.email);
			try {
				// better-auth/dist/oauth2/state.mjs makes callback state request-scoped,
				// so DB hooks can recover the spelling after provider input is filtered.
				const oauthState = await getOAuthState();
				if (oauthState) {
					oauthState[GOOGLE_DISPLAY_EMAIL_OAUTH_STATE_KEY] = displayEmail;
				}
			} catch {
				// A cosmetic field must never abort Google sign-in.
			}
			// better-auth/dist/oauth2/link-account.mjs leaves linked users unchanged
			// without full profile override, which would clobber onboarding-owned name.
			// Refresh only the cosmetic field before Better Auth reads the user row.
			await refreshExistingGoogleDisplayEmail(canonicalEmail, displayEmail);
			return {
				// Keep Google and email sign-in on the same canonical inbox/user row.
				displayEmail,
				email: canonicalEmail,
			};
		},
	};
}

/**
 * The body fields of `/organization/invite-member` that the role rule reads.
 * `organizationId` is required: the session's active organization can be stale.
 */
const inviteMemberBodySchema = z.object({
	organizationId: z.string().min(1),
	role: z.union([z.string(), z.array(z.string())]),
	resend: z.boolean().optional(),
});

/** The member row that `/organization/leave` answers on success. An APIError fails this parse. */
const leftMemberSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	userId: z.string(),
	role: z.string(),
	// The plugin answers the adapter row, so this is a Date; coerce also takes an ISO string.
	createdAt: z.coerce.date(),
});

/** A `member` row that remove-member or leave deleted. The undo inserts it again. */
type DeletedMemberRow = typeof orgSchema.member.$inferSelect;

/**
 * Runs the membership cleanup of workspaces-sharing.md 2.1. On a failure it undoes the
 * member change and rethrows. The member keeps the old access, and a retry runs the cleanup again.
 */
async function reduceMembershipOrUndo(input: {
	reduction: MembershipReduction;
	cleanup: CreateAuthOptions["onMembershipReduced"];
	/** Writes the member row back as it was before the request. */
	undo: () => Promise<void>;
}): Promise<void> {
	if (!input.cleanup) {
		return;
	}
	try {
		await input.cleanup(input.reduction);
	} catch (error) {
		// The plugin already wrote the change. Without the undo, a retry finds no member
		// row or no role change, so nothing runs the cleanup again.
		try {
			await input.undo();
		} catch (undoError) {
			throw new AggregateError(
				[error, undoError],
				`Membership cleanup and its undo failed for user ${input.reduction.userId} in ${input.reduction.organizationId}`,
			);
		}
		throw error;
	}
}

/** Inserts a deleted member row again with its id and `created_at`, so the earliest-owner order stays. */
async function restoreMemberRow(row: DeletedMemberRow): Promise<void> {
	// A parallel join can add the user first. The unique (organization, user) index keeps that row.
	await db.insert(orgSchema.member).values(row).onConflictDoNothing();
}

/** Sets the previous role back while the row still holds the new role, so a later change wins. */
async function restoreMemberRole(input: {
	memberId: string;
	/** The raw `member.role` value that the plugin wrote (comma-separated). */
	newRole: string;
	/** The raw `member.role` value before the request. */
	previousRole: string;
}): Promise<void> {
	await db
		.update(orgSchema.member)
		.set({ role: input.previousRole })
		.where(
			and(
				eq(orgSchema.member.id, input.memberId),
				eq(orgSchema.member.role, input.newRole),
			),
		);
}

function workspaceRuleError(refusal: WorkspaceRuleRefusal): APIError {
	return APIError.from("FORBIDDEN", refusal);
}

function reservedSlugError(): APIError {
	return APIError.from("BAD_REQUEST", {
		code: "ORGANIZATION_SLUG_RESERVED",
		message: "Slugs that start with personal- are reserved.",
	});
}

/** `organization.personal_owner_user_id` gives the kind: set is personal, null is team. */
function workspaceKindOf(
	personalOwnerUserId: string | null,
): WorkspaceKindFacts {
	return personalOwnerUserId === null
		? { kind: "team" }
		: { kind: "personal", ownerUserId: personalOwnerUserId };
}

/** The kind of one organization. Null when the row does not exist. */
async function findWorkspaceKind(
	organizationId: string,
): Promise<WorkspaceKindFacts | null> {
	const [row] = await db
		.select({
			personalOwnerUserId: orgSchema.organization.personalOwnerUserId,
		})
		.from(orgSchema.organization)
		.where(eq(orgSchema.organization.id, organizationId))
		.limit(1);
	return row ? workspaceKindOf(row.personalOwnerUserId) : null;
}

/**
 * Applies the invite role rule of workspaces-sharing.md 2.1 before the plugin runs.
 * It throws an APIError to refuse. It returns when the plugin must answer (no session, no member row).
 */
async function assertWorkspaceInviteAllowed(input: {
	/** The raw request body, before the zod parse. */
	body: unknown;
	/** The canonical invitee email. */
	email: string;
	/** The session user id; null when the request has no session. */
	callerUserId: string | null;
	isOrganizationsEnabled: () => Promise<boolean>;
}): Promise<void> {
	// No session: the plugin session middleware answers 401.
	if (input.callerUserId === null) {
		return;
	}
	const parsed = inviteMemberBodySchema.safeParse(input.body);
	if (!parsed.success) {
		throw APIError.from("BAD_REQUEST", {
			code: "VALIDATION_ERROR",
			message: "An invitation needs organizationId and role.",
		});
	}
	const { organizationId, resend, role } = parsed.data;
	const [caller] = await db
		.select({
			personalOwnerUserId: orgSchema.organization.personalOwnerUserId,
			role: orgSchema.member.role,
		})
		.from(orgSchema.member)
		.innerJoin(
			orgSchema.organization,
			eq(orgSchema.organization.id, orgSchema.member.organizationId),
		)
		.where(
			and(
				eq(orgSchema.member.organizationId, organizationId),
				eq(orgSchema.member.userId, input.callerUserId),
			),
		)
		.limit(1);
	// Not a member: the plugin answers MEMBER_NOT_FOUND.
	if (!caller) {
		return;
	}
	// Same "pending" rule as the plugin: status pending and not expired.
	const [pending] = await db
		.select({ id: orgSchema.invitation.id })
		.from(orgSchema.invitation)
		.where(
			and(
				eq(orgSchema.invitation.organizationId, organizationId),
				eq(orgSchema.invitation.email, input.email),
				eq(orgSchema.invitation.status, "pending"),
				gt(orgSchema.invitation.expiresAt, new Date()),
			),
		)
		.limit(1);
	const refusal = workspaceInviteRefusal({
		callerRoles: splitWorkspaceRoles(caller.role),
		callerUserId: input.callerUserId,
		hasPendingInvitation: pending !== undefined,
		organizationsEnabled: await input.isOrganizationsEnabled(),
		requestedRoles: splitWorkspaceRoles(role),
		resend: resend ?? false,
		workspace: workspaceKindOf(caller.personalOwnerUserId),
	});
	if (refusal) {
		throw workspaceRuleError(refusal);
	}
}

/**
 * Builds the Better Auth instance for the web and native apps. On a local
 * development API it also accepts the DEV_USER password, from localhost only.
 */
export function createAuth(options: CreateAuthOptions = {}) {
	// Closed by default, like `canCreateOrganization`.
	const isOrganizationsEnabled = async (): Promise<boolean> =>
		options.isOrganizationsEnabled
			? await options.isOrganizationsEnabled()
			: false;

	const isDevPasswordLogin = isDevPasswordLoginEnabled({
		authUrl: env.BETTER_AUTH_URL,
		nodeEnv: env.NODE_ENV,
	});
	const emailAuthDisabledError = () =>
		APIError.from("FORBIDDEN", {
			code: EMAIL_AUTH_DISABLED_ERROR_CODE,
			message: "Email sign-in is currently unavailable.",
		});

	// Delivery-only accessor for the plugin send callbacks. All ADMISSION
	// gating (toggle, blocklist, caps) lives in the before-hook below — the
	// email-otp plugin runs its send callback in the background
	// (runInBackgroundOrAwait), so an error thrown from inside the callback
	// would be logged yet still answer the client `success: true`. Hook
	// errors, by contrast, always propagate. The residual check here keeps
	// the option-less singleton hard-off.
	const requireEmailAuth = async (): Promise<EmailAuthDelivery> => {
		const emailAuth = options.emailAuth;
		if (!emailAuth || !(await emailAuth.isEnabled())) {
			throw emailAuthDisabledError();
		}
		return emailAuth;
	};

	return betterAuth({
		...baseAuthOptions,
		basePath: "/api/auth",
		...(options.secondaryStorage
			? {
					// This object replaces the base `rateLimit`, so it repeats the custom rules.
					rateLimit: {
						customRules: AUTH_RATE_LIMIT_CUSTOM_RULES,
						customStorage: createRateLimitStorage(options.secondaryStorage),
						storage: "secondary-storage" as const,
					},
					// Keep durable auth records in Postgres. The injected port is only a
					// rate-limit counter, so Better Auth gets no root secondaryStorage.
					session: {
						storeSessionInDatabase: true,
						// `organization.create` updates the DB session but leaves
						// activeOrganizationId stale in this cookie. Clients must call
						// `organization.setActive(newOrg.id)` afterward or pass an explicit
						// `organizationId` to organization endpoints.
						cookieCache: {
							enabled: true,
							maxAge: 300,
							strategy: "compact" as const,
						},
					},
					verification: { storeInDatabase: true },
				}
			: {}),
		user: {
			additionalFields: {
				// Server-owned: exposed on session users, never accepted from client input.
				displayEmail: {
					type: "string",
					required: false,
					input: false,
				},
				onboardingCompletedAt: {
					type: "date",
					required: false,
					input: false,
				},
			},
		},
		// The email-otp plugin mounts password-reset and email-change routes this
		// passwordless product does not use. Left mounted they would be publicly
		// reachable through the auth catch-all and write verification rows.
		disabledPaths: [
			...baseAuthOptions.disabledPaths,
			...EMAIL_OTP_DISABLED_PATHS,
			...MCP_OAUTH_DISABLED_PATHS,
		],
		trustedOrigins: [
			...corsWebOrigins(env.CORS_ORIGIN, env.CORS_EXTRA_ORIGINS),
			"wandit://",
			"exp://",
			// Expo web / Metro dev origin, only while the API itself runs on
			// localhost. A hosted deployment never has a reason to trust it.
			...expoDevOrigins(env.BETTER_AUTH_URL),
		],
		socialProviders: {
			google: createGoogleProviderOptions(),
		},
		// Local development only: browser agents cannot pass Google sign-in.
		// Sign-up stays off, so the seeded DEV_USER is the only password account.
		...(isDevPasswordLogin
			? { emailAndPassword: { disableSignUp: true, enabled: true } }
			: {}),
		hooks: {
			// The before hook has five jobs that MUST run in the hook pipeline (hook
			// errors always propagate to the client; the email-otp plugin
			// backgrounds its send callback, so in-callback errors would be
			// swallowed into a fake `success: true`):
			// 1. Canonicalize every email that enters an auth flow (see
			//    email-canonical.ts — the one-inbox-one-account invariant), so
			//    send callbacks, verification identifiers, user creation, and
			//    invitation rows all see the canonical form.
			// 2. Admission-gate the two SEND endpoints: kill-switch toggle,
			//    disposable blocklist, per-email/per-IP caps. A vetoed request
			//    never reaches the plugin, so no verification row is created
			//    and the client gets the real error code.
			// 3. Pin the expo authorization proxy target (second branch below).
			// 4. Refuse the dev password from a host that is not localhost
			//    (first branch below).
			// 5. Apply the workspace invite role rule. The plugin cancels or
			//    resends a pending invitation before its own hooks run.
			before: createAuthMiddleware(async (ctx) => {
				const path = ctx.path;
				// 4. The DEV_USER password is public, and a local API can sit behind
				//    a public tunnel (docs/v2/security.md). The request host comes
				//    from the Host header, and a tunnel sends its public host.
				if (
					isDevPasswordLogin &&
					path === "/sign-in/email" &&
					ctx.request &&
					!isLocalhostUrl(ctx.request.url)
				) {
					throw APIError.from("FORBIDDEN", {
						code: "DEV_PASSWORD_LOGIN_LOCALHOST_ONLY",
						message: "Dev password sign-in works only on localhost.",
					});
				}
				// 3. Pin the expo authorization proxy to the Google URL this API
				//    issues (see expo-authorization-proxy.ts): no open redirect.
				//    It does not check `state`. Runs before the plugin's own handler.
				if (path === EXPO_AUTHORIZATION_PROXY_PATH) {
					const query = ctx.query as { authorizationURL?: unknown } | undefined;
					assertTrustedAuthorizationUrl(query?.authorizationURL, {
						googleClientId: env.GOOGLE_CLIENT_ID,
						googleCallbackUrl: `${new URL(env.BETTER_AUTH_URL).origin}/api/auth/callback/google`,
					});
					return;
				}
				const sendKind: EmailAuthSendKind | null =
					path === "/sign-in/magic-link"
						? "magic-link"
						: path === "/email-otp/send-verification-otp"
							? "otp"
							: null;
				const isEmailAuthPath =
					sendKind !== null || path === "/sign-in/email-otp";
				const isInvitePath = path === "/organization/invite-member";
				if (!isEmailAuthPath && !isInvitePath) {
					return;
				}
				const body = ctx.body as
					| { email?: unknown; type?: unknown }
					| undefined;
				if (!body || typeof body.email !== "string") {
					return;
				}
				const rawSignInEmail =
					path === "/sign-in/email-otp" ? body.email.trim() : undefined;
				// Magic-link verification carries only the token. Capturing spelling on
				// its unauthenticated send would let an alias mutate another user's display.
				const email = canonicalizeEmail(body.email);
				if (isInvitePath) {
					await options.guardInviteEmail?.({ email });
					// 5. The invite role rule (workspaces-sharing.md 2.1).
					const session = await getSessionFromCtx(ctx);
					await assertWorkspaceInviteAllowed({
						body,
						callerUserId: session?.user.id ?? null,
						email,
						isOrganizationsEnabled,
					});
				}
				if (sendKind !== null) {
					// Sign-in is the only OTP flow this product has — no
					// passwords to reset, no unverified emails to verify.
					if (sendKind === "otp" && body.type !== "sign-in") {
						throw APIError.from("BAD_REQUEST", {
							code: "EMAIL_OTP_TYPE_NOT_SUPPORTED",
							message: "Only sign-in codes are supported.",
						});
					}
					const emailAuth = options.emailAuth;
					if (!emailAuth || !(await emailAuth.isEnabled())) {
						throw emailAuthDisabledError();
					}
					if (!emailAuth.isDeliverable()) {
						throw APIError.from("SERVICE_UNAVAILABLE", {
							code: "EMAIL_DELIVERY_UNAVAILABLE",
							message: "Email delivery is not available right now.",
						});
					}
					await emailAuth.guardSend({
						email,
						ipAddress: ctx.request
							? getIP(ctx.request, ctx.context.options)
							: null,
						kind: sendKind,
					});
				}
				return {
					context: {
						body: { ...body, email },
						...(rawSignInEmail === undefined ? {} : { rawSignInEmail }),
					},
				};
			}),
			after: createAuthMiddleware(async (ctx) => {
				// Leave has no plugin hook, so this matcher runs the cleanup of workspaces-sharing.md 2.1.
				if (ctx.path === "/organization/leave") {
					const left = leftMemberSchema.safeParse(ctx.context.returned);
					if (left.success) {
						await reduceMembershipOrUndo({
							cleanup: options.onMembershipReduced,
							reduction: {
								change: "left",
								ipAddress: ctx.request
									? getIP(ctx.request, ctx.context.options)
									: null,
								organizationId: left.data.organizationId,
								userId: left.data.userId,
							},
							undo: () => restoreMemberRow(left.data),
						});
					}
					return;
				}
				if (ctx.path !== "/sign-in/email-otp") {
					return;
				}
				const rawSignInEmail = (
					ctx as typeof ctx & { rawSignInEmail?: unknown }
				).rawSignInEmail;
				const newSession = ctx.context.newSession;
				if (typeof rawSignInEmail !== "string" || !newSession) {
					return;
				}
				const user = newSession.user;
				if (
					canonicalizeEmail(rawSignInEmail) !== user.email ||
					user.displayEmail === rawSignInEmail
				) {
					return;
				}
				try {
					const updatedUser = await ctx.context.internalAdapter.updateUser(
						user.id,
						{
							displayEmail: rawSignInEmail,
						},
					);
					const returned = ctx.context.returned;
					if (
						typeof returned === "object" &&
						returned !== null &&
						"user" in returned &&
						typeof returned.user === "object" &&
						returned.user !== null
					) {
						(returned.user as { displayEmail?: string | null }).displayEmail =
							rawSignInEmail;
					}
					// The OTP route serialized the original user before after-hooks run.
					// Reissue this same session so its cookie cache is immediately fresh.
					await setSessionCookie(ctx, {
						session: newSession.session,
						user: updatedUser,
					});
				} catch {
					// A cosmetic write must never turn a successful OTP into a failure.
				}
			}),
		},
		// Production cross-subdomain cookie policy is configured at deploy time.
		databaseHooks: {
			user: {
				create: {
					// better-auth/dist/db/schema.mjs filters input:false provider fields.
					// Re-inject this server-owned value after provider input parsing.
					before: getGoogleDisplayEmailFromOAuthState,
					after: createUserCreatedHook(options.onUserCreated),
				},
			},
		},
		plugins: [
			expo(),
			admin({ defaultRole: "user", adminRoles: ["admin"] }),
			organization({
				ac: workspaceAccessControl,
				roles: workspaceRoles,
				// Closed by default; the server injects the organizationsEnabled
				// product-setting check here.
				allowUserToCreateOrganization: async (user) =>
					options.canCreateOrganization
						? await options.canCreateOrganization(user)
						: false,
				creatorRole: "owner",
				// Invitation accept/reject must require a verified session email.
				// Google sign-ins arrive verified, so this is invisible today — it
				// exists so a future unverified-email auth method can never join an
				// org by registering the invited address. Without it better-auth
				// defaults to NO check for built-in opaque invitation ids.
				requireEmailVerificationOnInvitation: true,
				// "Unlimited seats" is the Business promise; the default (100) would
				// hard-cap paid orgs at invitation-accept (crud-invites.mjs:279).
				// 10k is an abuse bound, not a product limit.
				membershipLimit: 10_000,
				// Physical deletion is disabled: it is non-transactional upstream and
				// our RESTRICT FKs (projects/ledger/subscriptions) would abort it
				// mid-flight anyway. Workspace offboarding is a later batch.
				disableOrganizationDeletion: true,
				// Better Auth reads seconds; the email copy reads days.
				invitationExpiresIn:
					WORKSPACE_INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60,
				cancelPendingInvitationsOnReInvite: true,
				organizationHooks: {
					// `personal-` slugs belong to personal workspaces (workspaces-sharing.md 1).
					beforeCreateOrganization: async ({ organization: org }) => {
						if (org.slug !== undefined && isPersonalWorkspaceSlug(org.slug)) {
							throw reservedSlugError();
						}
					},
					beforeUpdateOrganization: async ({ organization: data }) => {
						if (data.slug !== undefined && isPersonalWorkspaceSlug(data.slug)) {
							throw reservedSlugError();
						}
					},
					// A personal workspace keeps exactly one owner: its personal owner.
					beforeUpdateMemberRole: async ({ member, newRole, organization }) => {
						const workspace = await findWorkspaceKind(organization.id);
						const refusal = workspace
							? memberRoleUpdateRefusal({
									memberUserId: member.userId,
									newRoles: splitWorkspaceRoles(newRole),
									workspace,
								})
							: null;
						if (refusal) {
							throw workspaceRuleError(refusal);
						}
					},
					afterUpdateMemberRole: async ({ member, previousRole }) => {
						// Only a change to viewer takes away the right to run turns.
						if (
							!isViewerOnly(splitWorkspaceRoles(member.role)) ||
							isViewerOnly(splitWorkspaceRoles(previousRole))
						) {
							return;
						}
						await reduceMembershipOrUndo({
							cleanup: options.onMembershipReduced,
							reduction: {
								change: "viewer",
								ipAddress: null,
								organizationId: member.organizationId,
								userId: member.userId,
							},
							undo: () =>
								restoreMemberRole({
									memberId: member.id,
									newRole: member.role,
									previousRole,
								}),
						});
					},
					afterRemoveMember: async ({ member }) => {
						await reduceMembershipOrUndo({
							cleanup: options.onMembershipReduced,
							reduction: {
								change: "removed",
								ipAddress: null,
								organizationId: member.organizationId,
								userId: member.userId,
							},
							undo: () =>
								restoreMemberRow({
									createdAt: member.createdAt,
									id: member.id,
									organizationId: member.organizationId,
									role: member.role,
									userId: member.userId,
								}),
						});
					},
					// The toggle stops new members in personal workspaces (workspaces-sharing.md 3.4).
					beforeAcceptInvitation: async ({ organization }) => {
						const workspace = await findWorkspaceKind(organization.id);
						if (
							workspace?.kind === "personal" &&
							!(await isOrganizationsEnabled())
						) {
							throw workspaceRuleError({
								code: "ORGANIZATIONS_DISABLED",
								message: "Workspaces are disabled",
							});
						}
					},
					afterCreateOrganization: async ({ organization: org, member }) => {
						try {
							await options.onOrganizationCreated?.({
								creatorUserId: member.userId,
								organizationId: org.id,
							});
						} catch {
							// Analytics must never abort organization creation.
						}
					},
					afterAddMember: async ({ member }) => {
						try {
							await options.onMemberJoined?.({
								organizationId: member.organizationId,
								userId: member.userId,
							});
						} catch {
							// Analytics must never abort member addition.
						}
					},
					afterAcceptInvitation: async ({ member }) => {
						try {
							await options.onMemberJoined?.({
								organizationId: member.organizationId,
								userId: member.userId,
							});
						} catch {
							// Analytics must never abort invitation acceptance.
						}
					},
				},
				sendInvitationEmail: async (data) => {
					try {
						await options.onInvitationCreated?.({
							email: data.email,
							invitationId: data.id,
							inviterUserId: data.inviter.userId,
							organizationId: data.organization.id,
							organizationName: data.organization.name,
							role: data.role,
						});
					} catch {
						// Delivery is best-effort (link + in-app are the real paths).
					}
				},
			}),
			// Email sign-in, passwordless by design: clicking the link (or
			// typing the code) IS the ownership proof, so users arrive
			// emailVerified and requireEmailVerificationOnInvitation composes
			// with zero extra code.
			magicLink({
				// A leaked DB row must not be a usable login token.
				storeToken: "hashed",
				expiresIn: 60 * 10,
				// Delivery only — admission gating happens in hooks.before.
				sendMagicLink: async ({ email, url, token }) => {
					const emailAuth = await requireEmailAuth();
					// The emailed link shows the web origin, not the raw API verify
					// URL (see email-magic-link-url.ts).
					await emailAuth.sendMagicLink({
						email,
						url: emailMagicLinkUrl({
							verifyUrl: url,
							token,
							trustedWebOrigins: corsWebOrigins(
								env.CORS_ORIGIN,
								env.CORS_EXTRA_ORIGINS,
							),
						}),
					});
				},
			}),
			emailOTP({
				storeOTP: "hashed",
				otpLength: 6,
				expiresIn: 60 * 10,
				allowedAttempts: 3,
				// Delivery only — admission gating (including the sign-in-only
				// type restriction) happens in hooks.before, because this
				// callback runs in the background and its errors cannot reach
				// the client.
				sendVerificationOTP: async ({ email, otp, type }) => {
					if (type !== "sign-in") {
						throw emailAuthDisabledError();
					}
					const emailAuth = await requireEmailAuth();
					await emailAuth.sendOtp({ email, otp });
				},
			}),
			// Turnstile guards the two SEND endpoints (the spam/abuse surface).
			// The verify endpoints stay uncaptcha'd on purpose: humanity was
			// proven at send time, links are single-use, OTPs attempt-capped.
			// Hostname pinning lives in the Turnstile dashboard widget config.
			...(env.TURNSTILE_SECRET_KEY
				? [
						captcha({
							provider: "cloudflare-turnstile",
							secretKey: env.TURNSTILE_SECRET_KEY,
							endpoints: [
								"/sign-in/magic-link",
								"/email-otp/send-verification-otp",
							],
						}),
					]
				: []),
			// Railway production forces V2_BUILDER_ENABLED to false, so production
			// has no OAuth endpoints until V2 ships (D29 rollout gate).
			...(env.V2_BUILDER_ENABLED
				? createMcpOAuthPlugins(options.onMcpConsentChange)
				: []),
		],
	});
}

export function createAdminAuth() {
	const googleProvider = createGoogleProviderOptions();

	return betterAuth({
		...baseAuthOptions,
		basePath: "/api/admin-auth",
		advanced: {
			...baseAuthOptions.advanced,
			// Do not set explicit names in advanced.cookies: doing so bypasses
			// cookiePrefix and would let this instance collide with web auth.
			cookiePrefix: "wandit-admin",
		},
		// Shared database table keys strip basePath and collide across instances.
		// Admin traffic is tiny, so memory-store restart amnesia is acceptable.
		rateLimit: { storage: "memory" },
		trustedOrigins: [...(env.ADMIN_ORIGIN ? [env.ADMIN_ORIGIN] : [])],
		socialProviders: {
			google: {
				...googleProvider,
				// disableImplicitSignUp alone can be overridden by a caller sending
				// requestSignUp=true; disableSignUp is the non-bypassable gate.
				disableImplicitSignUp: true,
				disableSignUp: true,
			},
		},
		databaseHooks: {
			session: {
				create: {
					before: async (session, context) => {
						const user = context
							? await context.context.internalAdapter.findUserById(
									session.userId,
								)
							: null;
						const role =
							user && "role" in user && typeof user.role === "string"
								? user.role
								: null;
						if (!isStaffRole(role)) {
							throw APIError.from("FORBIDDEN", {
								code: ADMIN_ACCESS_REQUIRED_ERROR_CODE,
								message: "This account does not have admin dashboard access.",
							});
						}
					},
				},
			},
		},
		plugins: [
			admin({
				defaultRole: "user",
				adminRoles: ["admin"],
				ac: adminAccessControl,
				roles: adminRoles,
			}),
		],
	});
}

export const auth = createAuth();
export const adminAuth = createAdminAuth();

export type Auth = ReturnType<typeof createAuth>;
export type AdminAuth = ReturnType<typeof createAdminAuth>;
export type AuthSession = Auth["$Infer"]["Session"]["session"];
export type AuthUser = Auth["$Infer"]["Session"]["user"];
