/**
 * The pages of the app and their paths. src/main.tsx creates the router once.
 * The router uses browser history, so the preview bridge posts the real page path to the builder.
 * A reload on a page path still loads index.html: Vite dev and the Tauri asset resolver both fall back to it.
 * To add a page: add a route here, then its entry in src/features/app-shell/lib/nav-items.ts.
 */
import {
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { HomePage } from "~/features/home";
import { SettingsPage } from "~/features/settings";
import { RootLayout } from "./root-layout";

const rootRoute = createRootRoute({ component: RootLayout });

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomePage,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: SettingsPage,
});

const routeTree = rootRoute.addChildren([homeRoute, settingsRoute]);

/**
 * Builds the router on the default browser history. main.tsx calls it after the preview bridge,
 * because the history wraps pushState at creation.
 */
export function createAppRouter() {
	return createRouter({ routeTree });
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
