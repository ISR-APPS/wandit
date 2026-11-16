/**
 * The root route component: the theme on <html>, the providers that read the theme, and the app frame.
 * src/router.tsx renders it around every page. The pages show only after the database opens (DatabaseGate).
 * <html> carries src/styles/theme.json (theme.ts): data-* axes, the dark class, and the palette and font variables.
 * check-theme.mjs fails when one of these theme parts is missing.
 */
import { IconContext } from "@phosphor-icons/react";
import { Outlet } from "@tanstack/react-router";
import { Direction } from "radix-ui";
import { useLayoutEffect, useMemo } from "react";
import { AppShell, DatabaseGate } from "~/features/app-shell";
import { isDesktopShell } from "~/lib/db";
import { useT } from "~/shared/i18n";
import { Toaster } from "~/shared/ui/sonner";
import {
	fontLinksOf,
	themeAttributesOf,
	themeStyleOf,
	useAppTheme,
} from "~/styles/theme";

// The CSP of the native shell blocks the remote font stylesheets of the theme.
// So the host build puts the theme fonts into dist/wandit-fonts/. The installed app loads that local stylesheet.
// The file holds no font when the host could not fetch one: the engine.css font stacks then apply.
// The host writes this file into every installer. Vite dev and the preview do not have it.
const DESKTOP_FONT_STYLESHEET = "/wandit-fonts/theme.css";

/** Puts the theme and the language on <html>, then renders the gate, the shell, and the current page. */
export function RootLayout() {
	const { locale, dir } = useT();
	const theme = useAppTheme();
	// No preconnect in the shell: the font files are local.
	const fontLinks = isDesktopShell
		? { stylesheets: [DESKTOP_FONT_STYLESHEET], fileOrigins: [] }
		: fontLinksOf(theme);
	const iconWeight = theme.selection.icons;
	// A new value object re-renders every icon, so the memo keeps one object per weight.
	// The value replaces the default context, so it repeats its "1em" size: without it, an icon has no width.
	// aria-hidden keeps a decorative icon out of the accessibility tree. A prop on the icon wins over it.
	const iconContext = useMemo(
		() => ({ size: "1em", weight: iconWeight, "aria-hidden": true }),
		[iconWeight],
	);

	// effect: <html> is outside the React tree, so the theme and the language are copied onto it before paint.
	useLayoutEffect(() => {
		const html = document.documentElement;
		html.lang = locale;
		html.dir = dir;
		// A live theme can drop an optional color, so the old variables go first.
		html.style.cssText = "";
		for (const [name, value] of Object.entries(themeStyleOf(theme))) {
			if (typeof value === "string") {
				html.style.setProperty(name, value);
			}
		}
		// engine.css selects on these data-* axes and on the dark class.
		const { className, ...axes } = themeAttributesOf(theme);
		html.classList.toggle("dark", className === "dark");
		for (const [name, value] of Object.entries(axes)) {
			html.setAttribute(name, value);
		}
	}, [theme, locale, dir]);

	return (
		<>
			{/* React 19 moves these links into <head>. A font file is a CORS request, so its preconnect needs crossOrigin. */}
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
				<link key={href} rel="stylesheet" href={href} precedence="theme-font" />
			))}
			<IconContext.Provider value={iconContext}>
				{/* Without a provider, Radix menus and tabs act left to right in Arabic. */}
				<Direction.Provider dir={dir}>
					<DatabaseGate>
						<AppShell>
							<Outlet />
						</AppShell>
					</DatabaseGate>
					<Toaster />
				</Direction.Provider>
			</IconContext.Provider>
		</>
	);
}
