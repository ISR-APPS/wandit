import { resetAnalytics } from "@wandit/analytics/browser";
import { useMemo } from "react";

import { authClient } from "./auth-client";

export type SessionUser = (typeof authClient)["$Infer"]["Session"]["user"];

type SessionResult = {
	data: { user: SessionUser } | null;
	isPending: boolean;
};

type SessionSnapshot = SessionResult["data"];

/**
 * Generation token for in-flight getSession() calls. invalidateSessionCache()
 * bumps this so a response started before invalidation cannot keep winning
 * the in-flight slot over a newer request.
 */
let sessionGeneration = 0;
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
 * Route-guard session read. Dedupes concurrent callers, but does not keep a
 * TTL cache — Better Auth's atom + an explicit invalidate are the source of
 * truth after login/logout/401.
 */
export async function getSession(): Promise<SessionSnapshot> {
	if (inFlightSession && inFlightSession.generation === sessionGeneration) {
		return inFlightSession.promise;
	}

	const generation = sessionGeneration;
	const promise = authClient
		.getSession()
		.then((result) => toSessionSnapshot(result.data))
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
	inFlightSession = null;
}

/** Force a fresh server session read after 401 / pre-login. */
export async function refreshSession(): Promise<SessionSnapshot> {
	invalidateSessionCache();
	const result = await authClient.getSession();
	return toSessionSnapshot(result.data);
}

export async function signOut(): Promise<void> {
	try {
		await authClient.signOut();
	} finally {
		resetAnalytics();
		invalidateSessionCache();
	}
}
