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

	const next = sanitizeAuthRedirectPath(
		`${window.location.pathname}${window.location.search}`,
	);
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

/**
 * Only same-origin relative paths. Rejects protocol-relative URLs, backslash
 * open-redirect tricks ("/\\evil.example"), and control characters.
 */
export function sanitizeAuthRedirectPath(
	next: string | undefined,
): string | undefined {
	if (!next?.startsWith("/") || next.startsWith("//")) {
		return undefined;
	}

	if (next.includes("\\")) {
		return undefined;
	}
	for (let i = 0; i < next.length; i += 1) {
		const code = next.charCodeAt(i);
		if (code < 32 || code === 127) {
			return undefined;
		}
	}

	try {
		const url = new URL(next, "https://wandit.invalid");
		if (url.origin !== "https://wandit.invalid") {
			return undefined;
		}
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return undefined;
	}
}

export function buildAuthCallbackUrls(
	origin: string,
	destination: string,
): {
	callbackURL: string;
	errorCallbackURL: string;
} {
	const safeDestination = sanitizeAuthRedirectPath(destination) ?? "/dashboard";
	const callbackURL = new URL(safeDestination, origin).toString();
	const errorCallbackURL = new URL("/", origin);
	errorCallbackURL.searchParams.set("auth", "error");
	errorCallbackURL.searchParams.set("next", safeDestination);

	return {
		callbackURL,
		errorCallbackURL: errorCallbackURL.toString(),
	};
}
