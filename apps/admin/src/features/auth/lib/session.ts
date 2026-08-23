// Session access for the admin SPA, mirroring apps/web's 30s-cache pattern.
// The server's Better Auth session user includes the raw stored `role` value.
// It may contain comma-joined roles (for example, "user,support"), which the
// stock client types do not know about, so widen it at the single fetch point.
import { authClient } from "./auth-client";

type InferredSessionUser = (typeof authClient)["$Infer"]["Session"]["user"];

export type SessionUser = InferredSessionUser & { role: string };

type SessionSnapshot = { user: SessionUser } | null;

type SessionResult = {
	data: SessionSnapshot;
	isPending: boolean;
};

const SESSION_CACHE_TTL_MS = 30_000;

let cachedSession: { value: SessionSnapshot; expiresAt: number } | null = null;
let inFlightSession: Promise<SessionSnapshot> | null = null;

function toSessionSnapshot(
	session: (typeof authClient)["$Infer"]["Session"] | null | undefined,
): SessionSnapshot {
	return session?.user ? { user: session.user as SessionUser } : null;
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
	await authClient.signOut();
	invalidateSessionCache();
}
