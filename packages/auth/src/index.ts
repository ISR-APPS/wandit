import { expo } from "@better-auth/expo";
import { isStaffRole } from "@wandit/contracts";
import { and, createDb, eq, sql } from "@wandit/db";
import * as authSchema from "@wandit/db/schema/auth";
import * as orgSchema from "@wandit/db/schema/organizations";
import { corsWebOrigins } from "@wandit/env/cors-origins";
import { env } from "@wandit/env/server";
import {
	type BetterAuthRateLimitStorage,
	betterAuth,
	type GoogleOptions,
	type RateLimit,
	type SecondaryStorage,
} from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	APIError,
	createAuthMiddleware,
	getIp,
	getOAuthState,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import {
	admin,
	captcha,
	emailOTP,
	magicLink,
	organization,
} from "better-auth/plugins";
import { adminAccessControl, adminRoles } from "./admin-permissions";
import { canonicalizeEmail } from "./email-canonical";
import { emailMagicLinkUrl } from "./email-magic-link-url";
import { workspaceAccessControl, workspaceRoles } from "./permissions";
import { createUserCreatedHook, type OnUserCreated } from "./user-created-hook";

// The drizzle adapter resolves models by key on the object below — the
// organization plugin needs `organization`, `member`, and `invitation` present
// or every /api/auth/organization/* route fails with "model not found".
const schema = { ...authSchema, ...orgSchema };
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
	 * Server-owned secondary storage for distributed rate-limit counters.
	 * If it is absent, the factory keeps its existing database rate limiter.
	 */
	secondaryStorage?: SecondaryStorage;
	onUserCreated?: OnUserCreated;
	/**
	 * Admission gate for workspace creation — wired to the
	 * `organizationsEnabled` product setting by the server. Defaults to
	 * closed: without the server wiring, nobody can create organizations.
	 */
	canCreateOrganization?: (user: { id: string }) => Promise<boolean> | boolean;
	/**
	 * Invitation delivery hook. No email infra exists yet: the web surfaces a
	 * copyable invite link and in-app pending invitations; this callback only
	 * records analytics today.
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
	 * plugin's afterAddMember hook (crud-invites.mjs:280), so this is wired to
	 * BOTH afterAddMember and afterAcceptInvitation.
	 */
	onMemberJoined?: (data: {
		organizationId: string;
		userId: string;
	}) => Promise<void> | void;
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

	// Staging serves the web (vercel.app) and API (api-staging.wandit.dev) from
	// different sites, so every auth cookie (OAuth state, session) must be
	// SameSite=None;Secure or browsers drop it on the cross-site hop — the
	// symptom is "State mismatch: State not persisted correctly" on the
	// Google callback. Local dev is same-site localhost over plain http,
	// where None+Secure would itself be rejected — keep defaults there.
	// Production uses wandit.dev and api.wandit.dev, which are the same site.
	const crossSiteCookies = env.BETTER_AUTH_URL.startsWith("https://");

	return {
		advanced: {
			...(crossSiteCookies
				? {
						defaultCookieAttributes: {
							sameSite: "none" as const,
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
			storage: "database" as const,
		},
	};
}

const baseAuthOptions = createBaseAuthOptions();

function parseRateLimit(value: unknown): RateLimit | null {
	let parsed = value;

	if (typeof value === "string") {
		try {
			parsed = JSON.parse(value);
		} catch {
			return null;
		}
	}

	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("key" in parsed) ||
		typeof parsed.key !== "string" ||
		!("count" in parsed) ||
		typeof parsed.count !== "number" ||
		!("lastRequest" in parsed) ||
		typeof parsed.lastRequest !== "number"
	) {
		return null;
	}

	return parsed as RateLimit;
}

/**
 * Use the injected SecondaryStorage-shaped port only for rate limiting.
 * Better Auth 1.6.22 routes session-list and bulk-revocation operations to
 * root secondaryStorage without a database fallback, even when
 * storeSessionInDatabase is true.
 */
function createRateLimitStorage(
	secondaryStorage: SecondaryStorage,
): BetterAuthRateLimitStorage {
	return {
		async consume(key, rule) {
			if (secondaryStorage.increment) {
				const count = await secondaryStorage.increment(key, rule.window);

				return count <= rule.max
					? { allowed: true, retryAfter: null }
					: { allowed: false, retryAfter: rule.window };
			}

			// Compatibility path for a minimal get/set/delete port. The server's
			// Redis implementation uses atomic increment instead.
			const now = Date.now();
			const current = parseRateLimit(await secondaryStorage.get(key));
			const windowInMs = rule.window * 1_000;

			if (!current || now - current.lastRequest > windowInMs) {
				await secondaryStorage.set(
					key,
					JSON.stringify({ count: 1, key, lastRequest: now }),
					rule.window,
				);
				return { allowed: true, retryAfter: null };
			}

			if (current.count >= rule.max) {
				return {
					allowed: false,
					retryAfter: Math.max(
						1,
						Math.ceil((current.lastRequest + windowInMs - now) / 1_000),
					),
				};
			}

			await secondaryStorage.set(
				key,
				JSON.stringify({
					...current,
					count: current.count + 1,
					lastRequest: now,
				}),
				rule.window,
			);
			return { allowed: true, retryAfter: null };
		},
		async get(key) {
			return parseRateLimit(await secondaryStorage.get(key));
		},
		async set(key, value) {
			await secondaryStorage.set(key, JSON.stringify(value));
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

export function createAuth(options: CreateAuthOptions = {}) {
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
					rateLimit: {
						customStorage: createRateLimitStorage(options.secondaryStorage),
						storage: "secondary-storage" as const,
					},
					// Keep durable auth records in Postgres. Do not set Better Auth's
					// root secondaryStorage here; in 1.6.22 it also takes over session
					// list and bulk-revocation reads without a database fallback.
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
		],
		trustedOrigins: [
			...corsWebOrigins(env.CORS_ORIGIN, env.CORS_EXTRA_ORIGINS),
			"wandit://",
			"exp://",
			"http://localhost:8081",
		],
		socialProviders: {
			google: createGoogleProviderOptions(),
		},
		hooks: {
			// The before hook has two jobs that MUST run in the hook pipeline (hook
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
			before: createAuthMiddleware(async (ctx) => {
				const path = ctx.path;
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
							? getIp(ctx.request, ctx.context.options)
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
				// hard-cap paid orgs at invitation-accept (crud-invites.mjs:275).
				// 10k is an abuse bound, not a product limit.
				membershipLimit: 10_000,
				// Physical deletion is disabled: it is non-transactional upstream and
				// our RESTRICT FKs (projects/ledger/subscriptions) would abort it
				// mid-flight anyway. Workspace offboarding is a later batch.
				disableOrganizationDeletion: true,
				invitationExpiresIn: 60 * 60 * 24 * 7,
				cancelPendingInvitationsOnReInvite: true,
				organizationHooks: {
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
