import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { DirectionProvider } from "@wandit/ui/components/direction";
import { Toaster } from "@wandit/ui/components/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthModalProvider } from "@/features/auth";
import { AppI18nProvider, pageTitle, useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

import "../index.css";

// Grows when the backend lands: session, preloaded queries…
export type RouterAppContext = Record<string, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: pageTitle("common.appTitle"),
			},
			{
				name: "description",
				content: pageTitle("common.appDescription"),
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<QueryClientProvider client={queryClient}>
				<AppI18nProvider>
					<RootProviders />
				</AppI18nProvider>
			</QueryClientProvider>
			<TanStackRouterDevtools position="bottom-left" />
		</>
	);
}

function RootProviders() {
	const { dir } = useI18n();

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="dark"
			disableTransitionOnChange
			storageKey="wandit-theme"
		>
			<DirectionProvider dir={dir}>
				<AuthModalProvider>
					<Outlet />
				</AuthModalProvider>
				<Toaster richColors dir={dir} />
			</DirectionProvider>
		</ThemeProvider>
	);
}
