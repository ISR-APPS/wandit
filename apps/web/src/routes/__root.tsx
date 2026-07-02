import { Toaster } from "@my-better-t-app/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthModalProvider } from "@/features/auth";
import { queryClient } from "@/lib/query-client";

import "../index.css";

// Grows when the backend lands: session, preloaded queries…
export type RouterAppContext = Record<string, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "Wandit — AI landing pages that sell",
			},
			{
				name: "description",
				content:
					"Wandit turns a prompt into a ready-to-run landing page — publish and collect orders in minutes.",
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
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					disableTransitionOnChange
					storageKey="wandit-theme"
				>
					<AuthModalProvider>
						<Outlet />
					</AuthModalProvider>
					<Toaster richColors />
				</ThemeProvider>
			</QueryClientProvider>
			<TanStackRouterDevtools position="bottom-left" />
		</>
	);
}
