// Dev-only bridge between the preview iframe and the wandit host.
// The root route calls installPreviewBridge() when import.meta.env.DEV.
// Posts runtime errors to window.parent so the host can show them.
// Posts the page the app shows, so the host address bar can show its path.

interface RuntimeErrorPayload {
	type: "wandit:runtime-error";
	message: string;
	stack?: string;
}

// Same shape as previewRouteMessageSchema in the wandit contracts.
interface RouteChangePayload {
	type: "wandit:route";
	/** Pathname plus query of the page, like `/invoices?page=2`. */
	path: string;
}

function postToHost(payload: RuntimeErrorPayload | RouteChangePayload) {
	if (typeof window === "undefined" || window.parent === window) {
		return;
	}
	// The host listens on the parent frame; "*" is required because the
	// preview origin differs from the host origin.
	window.parent.postMessage(payload, "*");
}

function postError(message: string, stack?: string) {
	postToHost({ type: "wandit:runtime-error", message, stack });
}

// The router replaces the history entry often with the same URL, so only a new path posts.
let lastPostedPath: string | null = null;

function postRoute() {
	const path = window.location.pathname + window.location.search;
	if (path === lastPostedPath) {
		return;
	}
	lastPostedPath = path;
	postToHost({ type: "wandit:route", path });
}

let installed = false;

/** Attaches the error and route listeners once. Safe to call from every render. */
export function installPreviewBridge() {
	if (installed || typeof window === "undefined") {
		return;
	}
	installed = true;

	window.addEventListener("error", (event) => {
		postError(
			event.message,
			event.error instanceof Error ? event.error.stack : undefined,
		);
	});

	window.addEventListener("unhandledrejection", (event) => {
		const reason: unknown = event.reason;
		const message = reason instanceof Error ? reason.message : String(reason);
		const stack = reason instanceof Error ? reason.stack : undefined;
		postError(message, stack);
	});

	// The router changes the page through these two methods, and the browser fires no event for them.
	for (const method of ["pushState", "replaceState"] as const) {
		const original = window.history[method].bind(window.history);
		window.history[method] = (...args: Parameters<History["pushState"]>) => {
			original(...args);
			postRoute();
		};
	}
	window.addEventListener("popstate", postRoute);
	postRoute();
}
