/**
 * The ban rule of the Better Auth admin plugin, shared by two guards.
 * `AuthGuard` applies it to the cookie session user. `McpTokenGuard` applies it to the access token user.
 * It reads no database and imports no Nest code, so the auth barrel stays light for the Trigger worker.
 */
import type { AuthUser } from "@wandit/auth";

/** True while a ban holds. A ban ends at `banExpires`. Without `banExpires`, the ban never ends. */
export function isBanActive(
	user: Pick<AuthUser, "banned" | "banExpires">,
): boolean {
	if (!user.banned) {
		return false;
	}

	return !user.banExpires || new Date(user.banExpires).getTime() > Date.now();
}
