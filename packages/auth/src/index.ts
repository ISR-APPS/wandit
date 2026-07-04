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

	return betterAuth({
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
