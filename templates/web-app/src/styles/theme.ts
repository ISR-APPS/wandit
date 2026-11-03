/**
 * The app theme: the zod schema of src/styles/theme.json, the parsed file, and a live store.
 * __root.tsx puts the theme on <html>: themeAttributesOf, themeStyleOf, and fontLinksOf.
 * The app shell and the Toaster read useAppTheme(). The dev preview bridge calls setLiveTheme.
 * Only the host writes theme.json. The schema is the guard for the inline style on <html>.
 */
import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import themeJson from "./theme.json";
import { APP_THEME_OPTIONS } from "./theme-options";

// A hex or an oklch() color. No other character can reach the inline style, so a value cannot close a declaration.
const colorSchema = z
	.string()
	.regex(
		/^#[0-9a-f]{6}$|^oklch\(\d(\.\d{1,4})? \d(\.\d{1,4})? \d{1,3}(\.\d{1,2})?\)$/,
	);

// A lower-case "#rrggbb": the form of the brand seeds and of a brand primary.
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

// A catalog id of the host: a look, a world, or a font.
const catalogIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

const paletteSchema = z.strictObject({
	background: colorSchema,
	foreground: colorSchema,
	card: colorSchema,
	cardForeground: colorSchema,
	popover: colorSchema,
	popoverForeground: colorSchema,
	primary: colorSchema,
	primaryForeground: colorSchema,
	secondary: colorSchema,
	secondaryForeground: colorSchema,
	muted: colorSchema,
	mutedForeground: colorSchema,
	/** The kit hover and selected surface. Never the brand color. */
	accent: colorSchema,
	accentForeground: colorSchema,
	destructive: colorSchema,
	destructiveForeground: colorSchema,
	border: colorSchema,
	input: colorSchema,
	ring: colorSchema,
	success: colorSchema,
	warning: colorSchema,
	info: colorSchema,
	/** The surface behind the panels: the inset backdrop and the floating page. */
	canvas: colorSchema,
	/** The color of the soft shadows. The hard shadow uses foreground. */
	shadowColor: colorSchema,
	// engine.css gives the optional colors a fallback: a ramp of primary, and foreground on background.
	chart1: colorSchema.optional(),
	chart2: colorSchema.optional(),
	chart3: colorSchema.optional(),
	chart4: colorSchema.optional(),
	chart5: colorSchema.optional(),
	/** The reverse surface of sidebarTone "contrast". */
	contrast: colorSchema.optional(),
	contrastForeground: colorSchema.optional(),
});

const fontSchema = z.strictObject({
	/** The CSS family name. themeStyleOf puts it in double quotes. */
	family: z.string().regex(/^[A-Za-z0-9 ]{1,40}$/),
	/** The stylesheet of the family. Only the Google Fonts and Fontshare css hosts. */
	href: z
		.string()
		.regex(
			/^https:\/\/(fonts\.googleapis\.com\/css2|api\.fontshare\.com\/v2\/css)\?[A-Za-z0-9:/?&=@;.,+_%[\]-]+$/,
		),
});

/** The choices of the user and the agent. The builder PUT sends only this part. */
const selectionSchema = z.strictObject({
	source: z.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("look"), look: catalogIdSchema }),
		z.strictObject({ kind: z.literal("world"), world: catalogIdSchema }),
		z.strictObject({
			kind: z.literal("seeds"),
			background: z.string().regex(HEX_COLOR_PATTERN),
			foreground: z.string().regex(HEX_COLOR_PATTERN),
			primary: z.string().regex(HEX_COLOR_PATTERN),
		}),
	]),
	mode: z.enum(APP_THEME_OPTIONS.mode),
	/** "look" keeps the primary of the look. A hue or a "#rrggbb" brand color replaces it. */
	primary: z.union([
		z.literal("look"),
		z.enum(APP_THEME_OPTIONS.hue),
		z.string().regex(HEX_COLOR_PATTERN),
	]),
	/** "look" or a body font id of the host catalog. */
	font: z.union([z.literal("look"), catalogIdSchema]),
	/** "look" or a display font id of the host catalog. */
	displayFont: z.union([z.literal("look"), catalogIdSchema]),
	scale: z.enum(APP_THEME_OPTIONS.scale),
	radius: z.enum(APP_THEME_OPTIONS.radius),
	border: z.enum(APP_THEME_OPTIONS.border),
	shadow: z.enum(APP_THEME_OPTIONS.shadow),
	shadowStyle: z.enum(APP_THEME_OPTIONS.shadowStyle),
	content: z.enum(APP_THEME_OPTIONS.content),
	sidebarStyle: z.enum(APP_THEME_OPTIONS.sidebarStyle),
	sidebarCollapse: z.enum(APP_THEME_OPTIONS.sidebarCollapse),
	sidebarStart: z.enum(APP_THEME_OPTIONS.sidebarStart),
	sidebarTone: z.enum(APP_THEME_OPTIONS.sidebarTone),
	activeItem: z.enum(APP_THEME_OPTIONS.activeItem),
	header: z.enum(APP_THEME_OPTIONS.header),
	userMenu: z.enum(APP_THEME_OPTIONS.userMenu),
	frame: z.enum(APP_THEME_OPTIONS.frame),
	icons: z.enum(APP_THEME_OPTIONS.icons),
	// A theme.json from before this axis has no navIcon. It reads as "plain", the look it had.
	navIcon: z.enum(APP_THEME_OPTIONS.navIcon).default("plain"),
});

/**
 * The whole theme.json. Every object is strict: an unknown key fails the parse, so only known keys reach <html>.
 * The host computes "resolved" from "selection". This file never computes it.
 */
export const appThemeFileSchema = z.strictObject({
	version: z.literal(1),
	/** Who wrote the file last. "template" is this default file; the host replaces it before the first turn. */
	origin: z.enum(APP_THEME_OPTIONS.origin),
	/** The look name for the builder. The page never shows it. */
	name: z.string().regex(/^[^<>{};]{1,40}$/),
	selection: selectionSchema,
	resolved: z.strictObject({
		light: paletteSchema,
		dark: paletteSchema,
		fonts: z.strictObject({
			sans: fontSchema,
			/** The display face of the app area. */
			display: fontSchema,
			/** The poster face of the public pages. Only a world source sets it. */
			publicDisplay: fontSchema.optional(),
			arabicSans: fontSchema,
			arabicDisplay: fontSchema,
		}),
		voice: z.strictObject({
			headingWeight: z.literal(APP_THEME_OPTIONS.headingWeight),
			headingTracking: z.enum(APP_THEME_OPTIONS.headingTracking),
			/** The face of KPI figures: the display face or the body face. */
			numerals: z.enum(APP_THEME_OPTIONS.numerals),
		}),
	}),
});

/** A valid theme.json. The shell, the Toaster, and the root route read it through useAppTheme(). */
export type AppThemeFile = z.infer<typeof appThemeFileSchema>;

const parsedThemeFile = appThemeFileSchema.safeParse(themeJson);
// A broken file stops the app at load with the path of each bad field. The host rewrites the file before the next turn.
if (!parsedThemeFile.success) {
	throw new Error(
		`src/styles/theme.json is not a valid theme file:\n${z.prettifyError(parsedThemeFile.error)}`,
	);
}
const THEME_FILE = parsedThemeFile.data;

/** The theme that the dev preview bridge set. Null shows THEME_FILE. Production never sets it. */
let liveTheme: AppThemeFile | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);
	return () => {
		listeners.delete(onChange);
	};
}

/** Shows `file` on every page at once, with no reload. Null goes back to theme.json. Only the dev bridge calls it. */
export function setLiveTheme(file: AppThemeFile | null) {
	liveTheme = file;
	for (const listener of listeners) {
		listener();
	}
}

/** The theme on screen: the live theme of the builder, else theme.json. SSR and hydration always use theme.json. */
export function useAppTheme(): AppThemeFile {
	return useSyncExternalStore(
		subscribe,
		() => liveTheme ?? THEME_FILE,
		() => THEME_FILE,
	);
}

/**
 * The <html> props that engine.css reads: the dark class, one data-* attribute per CSS axis, and the voice.
 * sidebarStyle, sidebarCollapse, sidebarStart, and userMenu get no attribute: AppShell reads them and passes kit props.
 * icons gets no attribute: __root.tsx gives it to the Phosphor IconContext.
 */
export function themeAttributesOf({ selection, resolved }: AppThemeFile) {
	return {
		className: selection.mode === "dark" ? "dark" : undefined,
		"data-scale": selection.scale,
		"data-radius": selection.radius,
		"data-border": selection.border,
		"data-shadow": selection.shadow,
		"data-shadow-style": selection.shadowStyle,
		"data-content": selection.content,
		"data-sidebar-tone": selection.sidebarTone,
		"data-active-item": selection.activeItem,
		"data-header": selection.header,
		"data-frame": selection.frame,
		"data-nav-icon": selection.navIcon,
		"data-heading-weight": String(resolved.voice.headingWeight),
		"data-heading-tracking": resolved.voice.headingTracking,
		"data-numerals": resolved.voice.numerals,
	};
}

/** "cardForeground" gives "card-foreground", "chart1" gives "chart-1". */
function kebabOf(key: string): string {
	return key.replace(/[A-Z]|\d+/g, (part) => `-${part.toLowerCase()}`);
}

/**
 * The inline style of <html>: the source variables that engine.css maps to the role tokens.
 * --theme-light-<key> and --theme-dark-<key> for each palette key, so the .dark class still switches the mode,
 * and one --theme-font-<name> per font family. The schema allows only safe characters in each value.
 */
export function themeStyleOf({ resolved }: AppThemeFile): CSSProperties {
	const style: Record<`--${string}`, string> = {};
	for (const mode of ["light", "dark"] as const) {
		for (const [key, color] of Object.entries(resolved[mode])) {
			if (color !== undefined) {
				style[`--theme-${mode}-${kebabOf(key)}`] = color;
			}
		}
	}
	for (const [name, font] of Object.entries(resolved.fonts)) {
		if (font !== undefined) {
			style[`--theme-font-${kebabOf(name)}`] = `"${font.family}"`;
		}
	}
	return style;
}

/**
 * The font links of the theme for <head>: the css URL of every font (two fonts with one href load once),
 * and the origins that serve the font files, for a preconnect while the css loads.
 */
export function fontLinksOf({ resolved }: AppThemeFile) {
	const stylesheets = [
		...new Set(
			Object.values(resolved.fonts).flatMap((font) =>
				font === undefined ? [] : [font.href],
			),
		),
	];
	// The schema allows two css hosts. Google Fonts serves its files from fonts.gstatic.com, Fontshare from cdn.fontshare.com.
	const fileOrigins = [
		...new Set(
			stylesheets.map((href) =>
				href.startsWith("https://fonts.googleapis.com/")
					? "https://fonts.gstatic.com"
					: "https://cdn.fontshare.com",
			),
		),
	];
	return { stylesheets, fileOrigins };
}
