import { resetAnalytics } from "@wandit/analytics/browser";

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

function toSessionSnapshot(
	session: (typeof authClient)["$Infer"]["Session"] | null | undefined,
): SessionSnapshot {
	return session?.user ? { user: session.user } : null;
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
	}
}
