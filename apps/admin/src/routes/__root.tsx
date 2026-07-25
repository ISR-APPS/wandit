import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

import { ActiveThemeProvider } from "@/components/active-theme";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";

import "../index.css";

export const Route = createRootRoute({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "Wandit Admin",
			},
			{
				name: "description",
				content: "Wandit platform administration workspace",
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
			<ThemeProvider
				attribute="class"
				defaultTheme="light"
				enableSystem
				disableTransitionOnChange
				storageKey="wandit-admin-color-mode"
			>
				<QueryClientProvider client={queryClient}>
					<ActiveThemeProvider>
						<TooltipProvider>
							<Outlet />
						</TooltipProvider>
					</ActiveThemeProvider>
				</QueryClientProvider>
				<Toaster closeButton position="bottom-right" richColors />
			</ThemeProvider>
		</>
	);
}
