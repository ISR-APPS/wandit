// Root route: the html shell, the head, and the providers.
// Every route renders inside this document. router.tsx gives it the QueryClient.
// <html> carries src/styles/theme.json (theme.ts): data-* axes, the dark class, and the palette and font variables. The Phosphor IconContext carries its icons axis.
// The font links of the theme render in <head>, so a live theme from the builder loads its fonts.
// D19: user pixel ids and third-party scripts go in head() once, below.
import { IconContext } from "@phosphor-icons/react";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { Direction } from "radix-ui";
import { type ReactNode, useMemo } from "react";
import { I18nProvider, useT } from "~/shared/i18n";
import { Toaster } from "~/shared/ui/sonner";
import {
	fontLinksOf,
	themeAttributesOf,
	themeStyleOf,
	useAppTheme,
} from "~/styles/theme";
import tokensCss from "~/styles/tokens.css?url";
import { installPreviewBridge } from "~/wandit/preview-bridge";

// Dev-only bridge to the wandit preview frame. It installs at module load,
// before the first render, so an error of the first render reaches the host.
if (import.meta.env.DEV) {
	installPreviewBridge();
}

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
		links: [{ rel: "stylesheet", href: tokensCss }],
		// WANDIT-PIXELS: when the user gives a pixel id or a third-party script,
		// add one entry here. Never put it in a page component. Example:
		// scripts: [{ src: "https://connect.example.net/pixel.js", async: true }],
	}),
	component: RootComponent,
});

function RootComponent() {
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
	const theme = useAppTheme();
	const fontLinks = fontLinksOf(theme);
	const iconWeight = theme.selection.icons;
	// A new value object re-renders every icon, so the memo keeps one object per weight.
	// The value replaces the default context, so it repeats its "1em" size: without it, an icon has no width.
	// aria-hidden keeps a decorative icon out of the accessibility tree. A prop on the icon wins over it.
	const iconContext = useMemo(
		() => ({ size: "1em", weight: iconWeight, "aria-hidden": true }),
		[iconWeight],
	);
	return (
		// engine.css selects on the data-* axes and the dark class, and maps the inline variables to the role tokens.
		<html
			lang={locale}
			dir={dir}
			{...themeAttributesOf(theme)}
			style={themeStyleOf(theme)}
		>
			<head>
				<HeadContent />
				{/* A font file is a CORS request, so its preconnect needs crossOrigin. */}
				{fontLinks.fileOrigins.map((origin) => (
					<link
						key={origin}
						rel="preconnect"
						href={origin}
						crossOrigin="anonymous"
					/>
				))}
				{/* precedence makes React 19 load a stylesheet as a resource, so a new font of a live theme loads too. */}
				{fontLinks.stylesheets.map((href) => (
					<link
						key={href}
						rel="stylesheet"
						href={href}
						precedence="theme-font"
					/>
				))}
			</head>
			<body>
				{/* LIMIT: a cold dev preview pre-bundles all 1,512 Phosphor icons once, about 0.4 s and 6.7 MB. Each icon ships its 6 weights, about 1.9 kB minified each. Upgrade: a Vite plugin maps each root import to its dist/csr file. A build step keeps only the weight of theme.json. */}
				<IconContext.Provider value={iconContext}>
					{/* Without a provider, Radix menus and tabs act left to right in Arabic. */}
					<Direction.Provider dir={dir}>
						{children}
						<Toaster />
					</Direction.Provider>
				</IconContext.Provider>
				<Scripts />
			</body>
		</html>
	);
}
