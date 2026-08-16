import { resetAnalytics } from "@wandit/analytics/browser";
import { Sentry } from "@wandit/observability/browser";

import { authClient } from "./auth-client";
import { promptStash } from "./prompt-stash";

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

export async function signOut(): Promise<void> {
	try {
		await authClient.signOut();
	} finally {
		resetAnalytics();
		invalidateSessionCache();
		syncSentryUser(null);
		// A draft stashed under this account must never auto-create a project
		// (and charge credits) for whoever signs in next on this tab.
		promptStash.clear();
	}
}
