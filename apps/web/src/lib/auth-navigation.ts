// 401 handling for the api client. Wandit has no /login page — auth is a
// modal overlaying any route (features/auth) — so the default reaction to an
// expired session is a hard redirect to "/" with ?auth=required, the same
// signal routes/_auth/route.tsx sends. AuthModalProvider can register a
// handler here to open the modal in place instead of navigating.

const REDIRECT_LOCK_MS = 750;

type AuthRedirectHandlerOptions = {
	reason: "unauthorized";
};

type AuthRedirectHandler = (
	options: AuthRedirectHandlerOptions,
) => Promise<void> | void;

let authRedirectHandler: AuthRedirectHandler | null = null;
let redirectInProgress = false;

export function registerAuthRedirectHandler(handler: AuthRedirectHandler) {
	authRedirectHandler = handler;

	return () => {
		if (authRedirectHandler === handler) {
			authRedirectHandler = null;
		}
	};
}

export function redirectToLoginAfterUnauthorized() {
	if (typeof window === "undefined" || redirectInProgress) {
		return;
	}

	// The lock dedupes the burst of 401s a page of parallel queries produces.
	redirectInProgress = true;

	const handler = authRedirectHandler;

	if (!handler) {
		fallbackRedirectToLanding();
		releaseRedirectLock();
		return;
	}

	// .then(() => handler(...)) rather than Promise.resolve(handler(...)):
	// a synchronously-throwing handler must land in .catch, not escape and
	// leak the redirect lock.
	void Promise.resolve()
		.then(() => handler({ reason: "unauthorized" }))
		.catch(() => {
			fallbackRedirectToLanding();
		})
		.finally(releaseRedirectLock);
}

function fallbackRedirectToLanding() {
	const url = new URL("/", window.location.origin);
	url.searchParams.set("auth", "required");

	const next = sanitizeAuthRedirectPath(window.location.pathname);
	if (next && next !== "/") {
		url.searchParams.set("next", next);
	}

	window.location.replace(url.toString());
}

function releaseRedirectLock() {
	window.setTimeout(() => {
		redirectInProgress = false;
	}, REDIRECT_LOCK_MS);
}

export function sanitizeAuthRedirectPath(
	next: string | undefined,
): string | undefined {
	if (!next?.startsWith("/") || next.startsWith("//")) {
		return undefined;
	}

	return next;
}
