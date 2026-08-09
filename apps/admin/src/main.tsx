import { createRouter, RouterProvider } from "@tanstack/react-router";
import {
	initBrowserSentry,
	Sentry,
	sentryCreateRootOptions,
	sentryDefaultOnCatch,
} from "@wandit/observability/browser";
import ReactDOM from "react-dom/client";

import RouteError, { ErrorScreen } from "@/components/route-error";
import { applyThemeConfig, readThemeConfig } from "@/lib/themes";

import { routeTree } from "./routeTree.gen";

applyThemeConfig(readThemeConfig());

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
	// The router wraps every route in its own CatchBoundary, so route render
	// errors never reach a React ErrorBoundary — this hook is the reliable
	// Sentry capture point for them.
	defaultOnCatch: sentryDefaultOnCatch,
	defaultErrorComponent: RouteError,
	context: {},
});

// After createRouter (the tracing integration needs the router instance),
// before anything renders. No-op without VITE_SENTRY_DSN (local dev).
// Raw import.meta.env on purpose: admin supports same-origin deployments
// where VITE_SERVER_URL is absent (see lib/server-url.ts), and @wandit/env's
// shared web schema would throw on that.
initBrowserSentry({
	dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
	environment:
		(import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
		(import.meta.env.MODE === "production" ? "production" : "development"),
	router,
	apiOrigin:
		(import.meta.env.VITE_SERVER_URL as string | undefined) || undefined,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
	// React 19 reports render errors only through these root callbacks.
	ReactDOM.createRoot(rootElement, sentryCreateRootOptions()).render(
		// Catches errors thrown by the provider stack in __root.tsx, which sits
		// outside the router's own error boundaries.
		<Sentry.ErrorBoundary fallback={<ErrorScreen />}>
			<RouterProvider router={router} />
		</Sentry.ErrorBoundary>,
	);
}
