// Root route: the html shell, the head, and the providers.
// Every route renders inside this document. router.tsx gives it the QueryClient.
// D19: user pixel ids and third-party scripts go in head() once, below.
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { I18nProvider, useT } from "~/shared/i18n";
import { Toaster } from "~/shared/ui/sonner";
import tokensCss from "~/styles/tokens.css?url";

/** What every route gets in `context`. router.tsx creates it once per request. */
type RouterContext = {
	/** The React Query cache. A loader calls `context.queryClient.query(...)` on it. */
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "description", content: "Wandit web app" },
		],
		links: [
			{ rel: "stylesheet", href: tokensCss },
			// Font pairing clash-satoshi (Fontshare) plus the Arabic twins (Google).
			{ rel: "preconnect", href: "https://api.fontshare.com" },
			{
				rel: "stylesheet",
				href: "https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Changa:wght@500;600;700&family=Tajawal:wght@400;500;700&display=swap",
			},
		],
		// WANDIT-PIXELS: when the user gives a pixel id or a third-party script,
		// add one entry here. Never put it in a page component. Example:
		// scripts: [{ src: "https://connect.example.net/pixel.js", async: true }],
	}),
	component: RootComponent,
});

function RootComponent() {
	// effect: the preview bridge listens to window errors, an external system, after hydration.
	useEffect(() => {
		// Dev-only bridge: posts runtime errors to the preview parent frame.
		if (import.meta.env.DEV) {
			void import("~/wandit/preview-bridge").then((m) =>
				m.installPreviewBridge(),
			);
		}
	}, []);

	return (
		<I18nProvider>
			<RootDocument>
				<Outlet />
			</RootDocument>
		</I18nProvider>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	const { locale, dir } = useT();
	return (
		<html lang={locale} dir={dir}>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}
