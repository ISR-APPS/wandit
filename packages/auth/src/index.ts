import { expo } from "@better-auth/expo";
import { createDb } from "@wandit/db";
import * as schema from "@wandit/db/schema/auth";
import { env } from "@wandit/env/server";
import { betterAuth, type User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export type CreateAuthOptions = {
	onUserCreated?: (user: User) => void | Promise<void>;
};

export function createAuth(options: CreateAuthOptions = {}) {
	const db = createDb();

	// Staging serves the web (vercel.app) and the API (railway.app) from two
	// DIFFERENT sites, so every auth cookie (OAuth state, session) must be
	// SameSite=None;Secure or browsers drop it on the cross-site hop — the
	// symptom is "State mismatch: State not persisted correctly" on the
	// Google callback. Local dev is same-site localhost over plain http,
	// where None+Secure would itself be rejected — keep defaults there.
	// Real production should put both on one apex (app./api.wandit…) and
	// switch to crossSubDomainCookies instead.
	const crossSiteCookies = env.BETTER_AUTH_URL.startsWith("https://");

	return betterAuth({
		...(crossSiteCookies
			? {
					advanced: {
						defaultCookieAttributes: {
							sameSite: "none" as const,
							secure: true,
						},
					},
				}
			: {}),
		database: drizzleAdapter(db, {
			provider: "pg",

			schema: schema,
		}),
		trustedOrigins: [
			env.CORS_ORIGIN,
			"wandit://",
			"exp://",
			"http://localhost:8081",
		],
		socialProviders: {
			google: {
				// offline → Google issues a refresh token whenever its consent
				// screen is shown (first sign-up, or the linkSocial re-consent
				// that requests the Sheets scope). Server-side Sheets sync then
				// mints fresh access tokens via auth.api.getAccessToken without
				// the user present. No global `prompt` on purpose: forcing the
				// consent screen on every sign-in would hurt the funnel.
				accessType: "offline",
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
			},
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		// Production cross-subdomain cookie policy is configured at deploy time.
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						await options.onUserCreated?.(user);
					},
				},
			},
		},
		plugins: [expo()],
	});
}

export const auth = createAuth();

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"]["session"];
export type AuthUser = Auth["$Infer"]["Session"]["user"];
