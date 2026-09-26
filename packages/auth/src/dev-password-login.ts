/**
 * Email and password sign-in for local development only.
 * `createAuth` in index.ts uses the gate. The server seeds DEV_USER at boot.
 * The web auth modal fills its dev form with DEV_USER.
 * The web bundle imports this file, so it must not import server env or Better Auth.
 */
import { isLocalhostUrl } from "@wandit/env/cors-origins";

/**
 * The one password account. The `.test` TLD is reserved, so no real inbox
 * or Google account can own this email.
 */
export const DEV_USER = {
	email: "dev@wandit.test",
	name: "Dev User",
	password: "wandit-dev-password",
} as const;

/**
 * True only for NODE_ENV=development with the API on localhost. Both checks
 * must pass, so a deploy that forgets NODE_ENV stays off.
 */
export function isDevPasswordLoginEnabled(input: {
	/** NODE_ENV of the API process. */
	nodeEnv: string;
	/** BETTER_AUTH_URL of the API process. */
	authUrl: string;
}): boolean {
	return input.nodeEnv === "development" && isLocalhostUrl(input.authUrl);
}
