/**
 * The Supabase auth session as a React value, with no effect.
 * This module subscribes once to `supabase.auth` when it loads.
 * Screens call `useSession()`. The auth mutations change the session.
 */
import type { Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { queryClient } from "@/shared/lib/query-client";
import { supabase } from "@/shared/lib/supabase";

/** `loading` until supabase-js reads the saved session from storage. */
export type SessionState =
	| { status: "loading" }
	| { status: "signed-out" }
	| { status: "signed-in"; session: Session };

let current: SessionState = { status: "loading" };
const listeners = new Set<() => void>();

// supabase-js sends INITIAL_SESSION after it reads the storage, then every change.
supabase.auth.onAuthStateChange((event, session) => {
	current =
		session === null
			? { status: "signed-out" }
			: { status: "signed-in", session };
	// The cached rows belong to the user who left. A sign-out drops them all.
	if (event === "SIGNED_OUT") {
		queryClient.clear();
	}
	for (const listener of listeners) {
		listener();
	}
});

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot() {
	return current;
}

/** The current session. Renders again on sign-in, sign-out, and token refresh. */
export function useSession(): SessionState {
	return useSyncExternalStore(subscribe, getSnapshot);
}
