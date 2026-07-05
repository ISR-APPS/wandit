// DEV-ONLY auth bypass.
//
// Google OAuth can't round-trip inside Expo Go (the wandit:// scheme isn't
// registered there, so openAuthSessionAsync never deep-links back). Until we
// test on a dev build, the Welcome screen's Google button flips this flag and
// the root auth gate lets us straight into (app) without a session.
//
// TODO: delete this file (and its call sites in app/_layout.tsx,
// features/auth/screens/welcome-screen.tsx, features/projects/components/
// projects-drawer.tsx) once the native Google redirect works.
import { useSyncExternalStore } from "react";

let bypassed = false;
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

export function enableAuthBypass() {
	bypassed = true;
	notify();
}

export function disableAuthBypass() {
	bypassed = false;
	notify();
}

export function useAuthBypass() {
	return useSyncExternalStore(
		(callback) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		},
		() => bypassed,
	);
}
