import {
	createBrowserHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	analyticsSentryIntegration,
	initBrowserAnalytics,
} from "@wandit/analytics/browser";
import { env } from "@wandit/env/web";
import { defaultLocale, getDictionary } from "@wandit/internationalization";
import {
	initBrowserSentry,
	Sentry,
	sentryCreateRootOptions,
	sentryDefaultOnCatch,
} from "@wandit/observability/browser";
import ReactDOM from "react-dom/client";

import Loader from "./components/loader";
import RouteError, { ErrorScreen } from "./components/route-error";
import {
	getCurrentLocale,
	setCurrentDictionary,
} from "./lib/i18n/locale-store";
import { routeTree } from "./routeTree.gen";

const history = createBrowserHistory();

const router = createRouter({
	history,
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultPendingComponent: () => <Loader />,
	// The router wraps every route in its own CatchBoundary, so route render
	// errors never reach a React ErrorBoundary — this hook is the reliable
	// Sentry capture point for them.
	defaultOnCatch: sentryDefaultOnCatch,
	defaultErrorComponent: RouteError,
	context: {},
});

const environment =
	env.VITE_SENTRY_ENVIRONMENT ??
	(import.meta.env.MODE === "production" ? "production" : "development");

// The Sentry link integration needs an initialized PostHog instance.
initBrowserAnalytics({
	key: env.VITE_POSTHOG_KEY,
	host: env.VITE_POSTHOG_HOST,
	environment,
});

const posthogSentryIntegration = analyticsSentryIntegration();

// After createRouter (the tracing integration needs the router instance),
// before anything renders. No-op without VITE_SENTRY_DSN (local dev).
initBrowserSentry({
	dsn: env.VITE_SENTRY_DSN,
	environment,
	release: env.VITE_SENTRY_RELEASE,
	router,
	apiOrigin: env.VITE_SERVER_URL,
	extraIntegrations: posthogSentryIntegration ? [posthogSentryIntegration] : [],
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

const initialLocale = getCurrentLocale();

if (initialLocale !== defaultLocale) {
	try {
		setCurrentDictionary(await getDictionary(initialLocale));
	} catch (error) {
		console.error("Failed to preload locale dictionary", error);
	}
}

if (!rootElement.innerHTML) {
	// React 19 reports render errors only through these root callbacks.
	const root = ReactDOM.createRoot(rootElement, sentryCreateRootOptions());
	root.render(
		// Catches errors thrown by the provider stack in __root.tsx, which sits
		// outside the router's own error boundaries.
		<Sentry.ErrorBoundary fallback={<ErrorScreen />}>
			<RouterProvider router={router} />
		</Sentry.ErrorBoundary>,
	);
}
