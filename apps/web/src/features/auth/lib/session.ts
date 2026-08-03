import { resetAnalytics } from "@wandit/analytics/browser";
import { useMemo } from "react";

import { authClient } from "./auth-client";

export type SessionUser = (typeof authClient)["$Infer"]["Session"]["user"];

type SessionResult = {
	data: { user: SessionUser } | null;
	isPending: boolean;
};

type SessionSnapshot = SessionResult["data"];

const SESSION_CACHE_TTL_MS = 30_000;

/**
 * Generation token for in-flight getSession() calls. invalidateSessionCache()
 * bumps this so a response started before invalidation cannot repopulate a
 * cleared cache or keep winning the in-flight slot.
 */
let sessionGeneration = 0;
let cachedSession: {
	generation: number;
	value: SessionSnapshot;
	expiresAt: number;
} | null = null;
let inFlightSession: {
	generation: number;
	promise: Promise<SessionSnapshot>;
} | null = null;

function toSessionSnapshot(
	session: (typeof authClient)["$Infer"]["Session"] | null | undefined,
): SessionSnapshot {
	return session?.user ? { user: session.user } : null;
}

export function useSession(): SessionResult {
	const { data, isPending } = authClient.useSession();
	// Prefer the Better Auth user object identity (nanostore) so consumers
	// don't see a fresh `{ user }` wrapper on every parent render.
	const user = data?.user ?? null;

	return useMemo(
		() => ({
			data: user ? { user } : null,
			isPending,
		}),
		[user, isPending],
	);
}

/**
 * Route-guard session read. Short TTL avoids a network hop on every tab
 * navigation; invalidateSessionCache() drops the cache after login/logout/401.
 */
export async function getSession(): Promise<SessionSnapshot> {
	const now = Date.now();
	if (
		cachedSession &&
		cachedSession.generation === sessionGeneration &&
		cachedSession.expiresAt > now
	) {
		return cachedSession.value;
	}

	if (inFlightSession && inFlightSession.generation === sessionGeneration) {
		return inFlightSession.promise;
	}

	const generation = sessionGeneration;
	const promise = authClient
		.getSession()
		.then((result) => {
			const value = toSessionSnapshot(result.data);
			if (generation === sessionGeneration) {
				cachedSession = {
					generation,
					value,
					expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
				};
			}
			return value;
		})
		.finally(() => {
			if (
				inFlightSession?.promise === promise &&
				inFlightSession.generation === generation
			) {
				inFlightSession = null;
			}
		});

	inFlightSession = { generation, promise };
	return promise;
}

export function invalidateSessionCache(): void {
	sessionGeneration += 1;
	cachedSession = null;
	inFlightSession = null;
}

/** Force a fresh server session read after 401 / pre-login. */
export async function refreshSession(): Promise<SessionSnapshot> {
	invalidateSessionCache();
	return getSession();
}

export async function signOut(): Promise<void> {
	try {
		await authClient.signOut();
	} finally {
		resetAnalytics();
		invalidateSessionCache();
	}
}
