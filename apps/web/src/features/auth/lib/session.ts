import { resetAnalytics } from "@wandit/analytics/browser";
import { Sentry } from "@wandit/observability/browser";

import { authClient } from "./auth-client";

export type SessionUser = (typeof authClient)["$Infer"]["Session"]["user"];

type SessionResult = {
	data: { user: SessionUser } | null;
	isPending: boolean;
};

type SessionSnapshot = SessionResult["data"];

const SESSION_CACHE_TTL_MS = 30_000;

let cachedSession: { value: SessionSnapshot; expiresAt: number } | null = null;
let inFlightSession: Promise<SessionSnapshot> | null = null;

// Keep Sentry's user in lockstep with the session so every browser event
// shows who it happened to. Identity-change guard: useSession calls this on
// every render, and Sentry should only be touched on actual transitions.
let sentryUserId: string | null = null;

function syncSentryUser(user: SessionUser | null): void {
	const id = user?.id ?? null;
	if (id === sentryUserId) {
		return;
	}
	sentryUserId = id;
	Sentry.setUser(user ? { id: user.id, email: user.email } : null);
}

function toSessionSnapshot(
	session: (typeof authClient)["$Infer"]["Session"] | null | undefined,
): SessionSnapshot {
	const snapshot = session?.user ? { user: session.user } : null;
	syncSentryUser(snapshot?.user ?? null);
	return snapshot;
}

export function useSession(): SessionResult {
	const { data, isPending } = authClient.useSession();
	return { data: toSessionSnapshot(data), isPending };
}

export async function getSession(): Promise<SessionSnapshot> {
	const now = Date.now();

	if (cachedSession && cachedSession.expiresAt > now) {
		return cachedSession.value;
	}

	if (inFlightSession) {
		return inFlightSession;
	}

	inFlightSession = authClient
		.getSession()
		.then((result) => {
			const value = toSessionSnapshot(result.data);
			cachedSession = {
				value,
				expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
			};
			return value;
		})
		.finally(() => {
			inFlightSession = null;
		});

	return inFlightSession;
}

export function invalidateSessionCache(): void {
	cachedSession = null;
	inFlightSession = null;
}

/**
 * Call after a non-auth endpoint mutates the user row (e.g. onboarding
 * rewrites the name and stamps onboardingCompletedAt). Three caches go stale
 * otherwise: the route-guard cache here, Better Auth's signed session-cache
 * cookie (Redis-backed deploys keep it for minutes, and only Better Auth's own
 * `/update-user`-style routes rewrite it), and the reactive `useSession()`
 * atom. `disableCookieCache` makes the server re-read the user row and
 * re-issue the cache cookie, so the atom refetch that follows sees fresh data.
 */
export async function refreshSession(): Promise<void> {
	invalidateSessionCache();
	const result = await authClient.getSession({
		query: { disableCookieCache: true },
	});
	cachedSession = {
		value: toSessionSnapshot(result.data),
		expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
	};
	authClient.$store.notify("$sessionSignal");
}

export async function signOut(): Promise<void> {
	try {
		await authClient.signOut();
	} finally {
		resetAnalytics();
		invalidateSessionCache();
		syncSentryUser(null);
	}
}
