import * as Sentry from "@sentry/react";

import {
	isEnabled,
	scrubEvent,
	type WanditSentryOptions,
} from "./internal/shared";

/** The full `@sentry/react` API (ErrorBoundary, captureException, ...). */
export * as Sentry from "@sentry/react";

type AnyRouter = Parameters<
	typeof Sentry.tanstackRouterBrowserTracingIntegration
>[0];
type Integration = Parameters<typeof Sentry.addIntegration>[0];

export interface InitBrowserSentryOptions extends WanditSentryOptions {
	/** The TanStack Router instance — create the router first, then init. */
	router: AnyRouter;
	/** API origin to propagate traces to (e.g. env.VITE_SERVER_URL). */
	apiOrigin?: string;
	/** Same-origin-ish envelope forwarder to dodge ad-blockers. */
	tunnel?: string;
	/** App-owned integrations appended without coupling this package to them. */
	extraIntegrations?: Integration[];
}

let initialized = false;

// URLs can carry user content (the preview route serializes the full prompt
// into its query string) — never let a query string reach Sentry.
const stripQuery = (url: string): string => url.split("?")[0] ?? url;

/**
 * Initialize Sentry for a Vite/React SPA. Call once in main.tsx, after
 * `createRouter` and before rendering. Guarded against Vite HMR re-runs;
 * no-op when no DSN is configured (local dev).
 */
export function initBrowserSentry(options: InitBrowserSentryOptions): void {
	if (initialized || !isEnabled(options)) {
		return;
	}
	initialized = true;
	Sentry.init({
		dsn: options.dsn,
		environment: options.environment,
		// Only override when explicitly configured: an undefined release here
		// would clobber the `wandit-web@<sha>` the Sentry vite plugin injects
		// into the bundle (window.SENTRY_RELEASE), which is the default path.
		...(options.release ? { release: options.release } : {}),
		sendDefaultPii: false,
		tunnel: options.tunnel,
		// Vendor-internal control flow from @electric-sql/client (pulled in by
		// @trigger.dev/react-hooks): stream teardown rejects with a bare
		// "pause-stream" sentinel or a reasonless AbortError. Never actionable
		// in app code.
		ignoreErrors: ["pause-stream", "signal is aborted without reason"],
		integrations: [
			Sentry.tanstackRouterBrowserTracingIntegration(options.router),
			...(options.extraIntegrations ?? []),
		],
		// SPA volume is low — full tracing gives complete SPA→API traces.
		tracesSampleRate: options.tracesSampleRate ?? 1.0,
		tracePropagationTargets: options.apiOrigin
			? [/^\//, options.apiOrigin]
			: [/^\//],
		beforeSend: (event) => {
			if (event.request?.url) {
				event.request.url = stripQuery(event.request.url);
			}
			return scrubEvent(event);
		},
		beforeSendTransaction: (event) => {
			if (event.request?.url) {
				event.request.url = stripQuery(event.request.url);
			}
			return scrubEvent(event);
		},
		beforeSendSpan: (span) => {
			const data = span.data as Record<string, unknown> | undefined;
			if (data) {
				for (const key of ["url.full", "http.url"]) {
					const value = data[key];
					if (typeof value === "string") {
						data[key] = stripQuery(value);
					}
				}
				delete data["url.query"];
				delete data["http.query"];
			}
			if (typeof span.description === "string") {
				span.description = stripQuery(span.description);
			}
			return span;
		},
	});
}

/**
 * React 19 no longer rethrows render errors to window — these root options
 * are the only way Sentry sees them. Spread into `createRoot(el, {...})`.
 *
 * Returns {} when Sentry is disabled so React's default console reporting
 * stays intact in local dev. Deliberately no onCaughtError: caught errors
 * belong to the router's defaultOnCatch / Sentry.ErrorBoundary, which attach
 * proper context — claiming them here first would strip that.
 */
export function sentryCreateRootOptions() {
	if (!initialized) {
		return {};
	}
	return {
		onUncaughtError: Sentry.reactErrorHandler((error) => {
			// Keep parity with React's default behavior — custom handlers
			// replace its console reporting.
			console.error("Uncaught render error:", error);
		}),
		onRecoverableError: Sentry.reactErrorHandler(),
	};
}

/**
 * For `createRouter({ defaultOnCatch })`: TanStack Router wraps every route
 * in its own CatchBoundary, so route render errors never reach a React
 * ErrorBoundary — this hook is the only reliable capture point for them.
 */
export function sentryDefaultOnCatch(
	error: Error,
	errorInfo?: { componentStack?: string | null },
): void {
	Sentry.captureException(error, {
		captureContext: {
			contexts: {
				react: { componentStack: errorInfo?.componentStack ?? undefined },
			},
		},
	});
}
