// Session access for the admin SPA, mirroring apps/web's 30s-cache pattern.
// The server's better-auth session user includes a `role` field ("user" |
// "admin") that the stock client types do not know about, so we widen the
// inferred user type here and cast at the single fetch point.
import { authClient } from "./auth-client";

export type SessionRole = "user" | "admin";

type InferredSessionUser = (typeof authClient)["$Infer"]["Session"]["user"];

export type SessionUser = InferredSessionUser & { role: SessionRole };

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
