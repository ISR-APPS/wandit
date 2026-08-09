/**
 * auth-redirect.ts — where the app sends the user after an unauthorized (401).
 *
 * This is the native replacement for the web app's auth-navigation.ts. The web
 * version uses window.location — which does not exist on a phone. Here we use
 * expo-router's imperative `router` instead.
 *
 * base-service.ts calls this when the server rejects a request with 401 (the
 * session expired or is missing). The re-entrancy lock stops a burst of parallel
 * failing requests from firing many redirects at once.
 */
import { router } from "expo-router";

// Guards against a flood of 401s all triggering navigation in the same tick.
let redirectInProgress = false;
const REDIRECT_LOCK_MS = 1_000;

// Send the user back to the sign-in screen. Note: the root navigator's
// Stack.Protected guard also swaps to the (auth) stack once the session clears,
// so this is a belt-and-suspenders redirect for the moment right after a 401.
export function redirectToSignIn() {
	if (redirectInProgress) {
		return;
	}

	redirectInProgress = true;

	try {
		router.replace("/sign-in");
	} finally {
		setTimeout(() => {
			redirectInProgress = false;
		}, REDIRECT_LOCK_MS);
	}
}
