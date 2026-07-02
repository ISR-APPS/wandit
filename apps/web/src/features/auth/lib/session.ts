import { useSyncExternalStore } from "react";

import { authClient } from "./auth-client";
import { MOCK_AUTH } from "./constants";
import { MOCK_USER, mockSessionStore, type SessionUser } from "./mock-session";

export type { SessionUser };

type SessionResult = {
	data: { user: SessionUser } | null;
	isPending: boolean;
};

const FAKE_LATENCY_MS = 450;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function useMockSession(): SessionResult {
	const data = useSyncExternalStore(
		mockSessionStore.subscribe,
		mockSessionStore.getSnapshot,
		mockSessionStore.getServerSnapshot,
	);
	return { data, isPending: false };
}

function useRealSession(): SessionResult {
	const { data, isPending } = authClient.useSession();
	return {
		data: data
			? {
					user: {
						id: data.user.id,
						name: data.user.name,
						email: data.user.email,
						image: data.user.image ?? undefined,
					},
				}
			: null,
		isPending,
	};
}

// Hook identity is fixed at module load (MOCK_AUTH is a build-time constant),
// so rules-of-hooks hold.
export const useSession: () => SessionResult = MOCK_AUTH
	? useMockSession
	: useRealSession;

export async function getSession(): Promise<{ user: SessionUser } | null> {
	if (MOCK_AUTH) return mockSessionStore.getSnapshot();
	const result = await authClient.getSession();
	if (!result.data) return null;
	const { user } = result.data;
	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image ?? undefined,
		},
	};
}

export async function signInMock(
	provider: "google" | "magic-link",
): Promise<void> {
	void provider; // both providers resolve to the same mock user
	await wait(FAKE_LATENCY_MS);
	mockSessionStore.signIn(MOCK_USER);
}

export async function signOut(): Promise<void> {
	if (MOCK_AUTH) {
		mockSessionStore.signOut();
		return;
	}
	await authClient.signOut();
}
