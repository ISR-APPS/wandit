/**
 * The V2 app theme: the schema of `templates/web-app/src/styles/theme.json` and its option lists.
 * Its pure functions resolve a selection into palettes, fonts, and voice.
 * The host writes the file with buildAppThemeFile. The builder Thème sheet calls resolveAppTheme in the
 * browser. The template parses the file with a copy of these schemas. Looks come from app-theme-catalog.ts.
 * It also holds the body and answer schemas of the theme GET and PUT routes of the API.
 * index.ts does not export this file: import "@wandit/contracts/v2/app-theme", in a lazy chunk on the web.
 */
import { z } from "zod";

import { type WorldCard, worldCardSchema } from "../v1/ai-chat";
import {
	APP_DEFAULT_LOOK,
	APP_FONTS,
	APP_HUES,
	type APP_LOOK_FAMILIES,
	APP_LOOKS,
	type APP_THEME_CATEGORIES,
	APP_THEME_FAMILY_RULES,
} from "./app-theme-catalog";
import { brandPrimary, deriveTokens } from "./app-theme-color";
import { commitShaSchema } from "./versions";

/**
 * Every enum of theme.json. The template copies this object into src/styles/theme-options.ts
 * with no import, and a host spec checks that the two stay equal.
 */
export const APP_THEME_OPTIONS = {
	/** Who wrote the file last. Only "user" survives a business-only patch of the deal. */
	origin: ["template", "host", "user"],
	/** Where the palette comes from: a curated look, the poles of a V1 world, or three brand seeds. */
	sourceKind: ["look", "world", "seeds"],
	mode: ["light", "dark"],
	/** The 17 Tailwind v4 hues of the Primary row. APP_HUES holds their colors. */
	hue: [
		"red",
		"orange",
		"amber",
		"yellow",
		"lime",
		"green",
		"emerald",
		"teal",
		"cyan",
		"sky",
		"blue",
		"indigo",
		"violet",
		"purple",
		"fuchsia",
		"pink",
		"rose",
	],
	/** The size of the text and the spacing of the whole app. "md" is the designed size. */
	scale: ["xs", "sm", "md", "lg", "xl"],
	/** The corner radius of cards, controls, and panels. */
	radius: ["none", "sm", "md", "lg", "xl"],
	/** Border widths in px. "0.5" is one device pixel on a 2x screen. */
	border: ["0.5", "1", "1.5", "2", "3"],
	/** The depth of the card and panel shadows. */
	shadow: ["none", "sm", "md", "lg"],
	/** "soft" is a blurred shadow. "hard" is a 0-blur offset copy of the edge, the press look. */
	shadowStyle: ["soft", "hard"],
	/** "centered" holds the page content at 72rem. */
	content: ["full", "centered"],
	/** The kit Sidebar variant: inset, sidebar ("classic"), or floating. */
	sidebarStyle: ["inset", "classic", "floating"],
	/** What the sidebar toggle does on desktop: icons only, icons with labels under them, or hide. */
	sidebarCollapse: ["icons", "rail", "offcanvas"],
	/** The desktop sidebar state at page load. */
	sidebarStart: ["open", "collapsed"],
	/** The sidebar ground: the canvas, a tint of the page, the `contrast` slab, or the primary. */
	sidebarTone: ["canvas", "tint", "contrast", "brand"],
	/** How the selected nav item and the selected tab show. */
	activeItem: ["pill", "bar", "block", "outline", "quiet"],
	/** The top bar of /app: a solid bar with an edge, a blurred see-through bar, or no ground. */
	header: ["bar", "blur", "plain"],
	/** Where the user avatar menu sits: in the sidebar footer, under the brand row, or at the end of the top bar. */
	userMenu: ["sidebar-footer", "sidebar-header", "header"],
	/** The edge and the shadow of the inset page panel and of the floating sidebar. */
	frame: ["outlined", "flat"],
	/**
	 * The Phosphor weight of every icon. The strokes on the 256 grid: thin 8, light 12, regular 16, bold 24.
	 * fill draws solid shapes. duotone adds a 20% fill under the regular line.
	 */
	icons: ["thin", "light", "regular", "bold", "fill", "duotone"],
	/**
	 * The frame of the main nav icons. plain shows the glyph alone. soft adds a faint tile.
	 * solid also makes the active tile solid. color gives each item its own hue tile, as in iOS Settings.
	 * The glyph stays the same icon.
	 */
	navIcon: ["plain", "soft", "solid", "color"],
	/** The CSS font weight of headings. Each look uses a weight that its display face has. */
	headingWeight: [500, 600, 700, 800],
	/** Letter spacing of headings: tight -0.03em, snug -0.02em, normal 0. */
	headingTracking: ["tight", "snug", "normal"],
	/** The face of KPI figures: the display face or the body face. */
	numerals: ["display", "sans"],
} as const;

/** One look family of the catalog. The deal shows 3 cards from 3 different families. */
export type AppLookFamily = (typeof APP_LOOK_FAMILIES)[number];
/** A business category of the deal, for example "medical". "other" is the fallback. */
export type AppThemeCategory = (typeof APP_THEME_CATEGORIES)[number];
/** The id of a look of APP_LOOKS, for example "ardoise". */
export type AppLookId = keyof typeof APP_LOOKS;
/** The id of a font of APP_FONTS, for example "geist". */
export type AppFontId = keyof typeof APP_FONTS;
/** One value of a list of APP_THEME_OPTIONS. The catalog types use it, because the selection type depends on the catalog. */
type AppThemeOption<Name extends keyof typeof APP_THEME_OPTIONS> =
	(typeof APP_THEME_OPTIONS)[Name][number];
/** A hue id of the Primary row, for example "violet". APP_HUES holds its light and dark colors. */
export type AppThemeHue = AppThemeOption<"hue">;
/** Who wrote theme.json last. buildAppThemeFile takes it from its caller. */
export type AppThemeOrigin = AppThemeOption<"origin">;

/**
 * The use of a font. body and display faces are never condensed and never caps-only.
 * public-display holds the poster faces of the V1 worlds: public pages use them, the app area never does.
 */
export type AppFontRole =
	| "body"
	| "display"
	| "public-display"
	| "arabic-body"
	| "arabic-display";

/** One font of APP_FONTS. `href` is the stylesheet of the family with the weights that it has. */
export type AppFont = { family: string; href: string; role: AppFontRole };

/** The ids of the fonts of APP_FONTS with one of the roles. The catalog type checks the look fonts with it. */
type AppFontIdWithRole<Role extends AppFontRole> = {
	[Id in AppFontId]: (typeof APP_FONTS)[Id]["role"] extends Role ? Id : never;
}[AppFontId];

/** A primary choice of a look: a hue id, or a `#rrggbb` brand color. */
export type AppLookPrimary = AppThemeHue | `#${string}`;

/**
 * The selection fields that the deal and Random pick per family. The others (source, mode, primary,
 * fonts) come from the look.
 */
export type AppThemeLayoutAxis = Exclude<
	keyof AppThemeSelection,
	"source" | "mode" | "primary" | "font" | "displayFont"
>;

/** The values that the deal and Random may pick for each layout axis, for one family. */
export type AppThemeFamilyRules = {
	readonly [Axis in AppThemeLayoutAxis]: readonly [
		AppThemeSelection[Axis],
		...AppThemeSelection[Axis][],
	];
};

/** One curated look of APP_LOOKS. The deal, Random, the Look row of the Thème sheet, and resolveAppTheme read it. */
export type AppLook = {
	/** Shown in the builder and in the version label "Theme: <name>". */
	name: string;
	family: AppLookFamily;
	/** The business categories that the deal offers this look to. 4 to 8 ids. */
	fits: readonly AppThemeCategory[];
	/** Three dots for the UI: the primary of the default mode, then two signature colors of the look. */
	swatches: readonly [string, string, string];
	palette: { light: AppThemePalette; dark: AppThemePalette };
	font: AppFontIdWithRole<"body">;
	/** The heading face. A body face makes calm headings, so it is allowed too. */
	displayFont: AppFontIdWithRole<"display" | "body">;
	arabicSans: AppFontIdWithRole<"arabic-body">;
	arabicDisplay: AppFontIdWithRole<"arabic-display" | "arabic-body">;
	voice: AppThemeVoice;
	/** 2 or 3 primaries that the deal and Random may use instead of the look's own. The spec tests each one. */
	primaries: readonly AppLookPrimary[];
	/** The values the look is designed with. The deal and the Reset button of the Thème sheet start from them. */
	defaults: {
		mode: AppThemeOption<"mode">;
		radius: "md" | "lg" | "xl";
		border: AppThemeOption<"border">;
		shadow: AppThemeOption<"shadow">;
		shadowStyle: AppThemeOption<"shadowStyle">;
	};
};

/**
 * The part of a V1 WorldCard that resolveAppTheme reads for a world source: the server gets it from
 * `worldCardOf`, the builder from the theme GET route. `id` must equal the `world` of the selection source.
 * `preview.ground`, `ink`, and `accent` are `#rrggbb` in any case: the background, text, and primary seeds.
 * `preview.fontFamily` is a Google Fonts family. A family that is in APP_FONTS becomes the public display face.
 */
export type AppThemeWorld = Pick<WorldCard, "id" | "name" | "preview">;

/** Every look id, in catalog order. The Look row of the Thème sheet and the set_theme tool list them. */
// SAFETY: Object.keys returns the own keys of the APP_LOOKS literal, and the catalog has 20 looks.
export const APP_LOOK_IDS = Object.keys(APP_LOOKS) as [
	AppLookId,
	...AppLookId[],
];

// SAFETY: Object.keys returns the own keys of the APP_FONTS literal.
const APP_FONT_IDS = Object.keys(APP_FONTS) as AppFontId[];

/** The ids of the body fonts: the choices of the Font row. The type keeps poster and Arabic faces out. */
export const APP_BODY_FONT_IDS = APP_FONT_IDS.filter(
	(id): id is AppFontIdWithRole<"body"> => APP_FONTS[id].role === "body",
);

/** The ids of the heading fonts: display faces and body faces. The choices of the Display font row. */
export const APP_DISPLAY_FONT_IDS = APP_FONT_IDS.filter(
	(id): id is AppFontIdWithRole<"display" | "body"> =>
		APP_FONTS[id].role === "display" || APP_FONTS[id].role === "body",
);

/**
 * The only color forms that theme.json accepts: `#rrggbb` in lower case, or `oklch(L C H)` with plain
 * decimals. The template writes the colors into the inline style of <html>, so this is the injection guard.
 */
export const appThemeColorSchema = z
	.string()
	.regex(
		/^(#[0-9a-f]{6}|oklch\(\d(\.\d{1,4})? \d(\.\d{1,4})? \d{1,3}(\.\d{1,2})?\))$/,
	);

/**
 * `#rrggbb` in lower case: the form of a brand color in a selection. The template literal type keeps a
 * hue typo such as "viloet" out of the primary type.
 */
const hexColorSchema = z.templateLiteral([
	"#",
	z.string().regex(/^[0-9a-f]{6}$/),
]);

/** A light or a dark palette. 24 tokens are required. The CSS has fallbacks for the 7 optional ones. */
export const appThemePaletteSchema = z.strictObject({
	background: appThemeColorSchema,
	foreground: appThemeColorSchema,
	card: appThemeColorSchema,
	cardForeground: appThemeColorSchema,
	popover: appThemeColorSchema,
	popoverForeground: appThemeColorSchema,
	primary: appThemeColorSchema,
	primaryForeground: appThemeColorSchema,
	secondary: appThemeColorSchema,
	secondaryForeground: appThemeColorSchema,
	muted: appThemeColorSchema,
	mutedForeground: appThemeColorSchema,
	/** The hover and selected surface of the kit. It is never the brand color. */
	accent: appThemeColorSchema,
	accentForeground: appThemeColorSchema,
	destructive: appThemeColorSchema,
	destructiveForeground: appThemeColorSchema,
	border: appThemeColorSchema,
	input: appThemeColorSchema,
	ring: appThemeColorSchema,
	success: appThemeColorSchema,
	warning: appThemeColorSchema,
	info: appThemeColorSchema,
	/** The ground behind the inset page panel and the floating sidebar. */
	canvas: appThemeColorSchema,
	shadowColor: appThemeColorSchema,
	/** Fallback: a ramp from the primary. */
	chart1: appThemeColorSchema.optional(),
	chart2: appThemeColorSchema.optional(),
	chart3: appThemeColorSchema.optional(),
	chart4: appThemeColorSchema.optional(),
	chart5: appThemeColorSchema.optional(),
	/** The slab of sidebarTone "contrast". Fallback: foreground on background. */
	contrast: appThemeColorSchema.optional(),
	contrastForeground: appThemeColorSchema.optional(),
});

/**
 * One font face of theme.json. The family goes into the inline style, so it has only letters, digits,
 * and spaces. The stylesheet comes only from Google Fonts or Fontshare.
 */
export const appThemeFontSchema = z.strictObject({
	family: z.string().regex(/^[A-Za-z0-9 ]{1,40}$/),
	href: z
		.string()
		.regex(
			/^https:\/\/(fonts\.googleapis\.com\/css2|api\.fontshare\.com\/v2\/css)\?[A-Za-z0-9:/?&=@;.,+_%[\]-]+$/,
		),
});

/** The heading voice. The template puts it on <html> as data attributes, never inline. */
export const appThemeVoiceSchema = z.strictObject({
	headingWeight: z.literal(APP_THEME_OPTIONS.headingWeight),
	headingTracking: z.enum(APP_THEME_OPTIONS.headingTracking),
	numerals: z.enum(APP_THEME_OPTIONS.numerals),
});

/** The part of theme.json that only resolveAppTheme writes. The template only reads it. */
export const appThemeResolvedSchema = z.strictObject({
	light: appThemePaletteSchema,
	dark: appThemePaletteSchema,
	fonts: z.strictObject({
		sans: appThemeFontSchema,
		/** The app-safe display face, used inside /app. */
		display: appThemeFontSchema,
		/** World sources only: the display face of the public pages. */
		publicDisplay: appThemeFontSchema.optional(),
		arabicSans: appThemeFontSchema,
		arabicDisplay: appThemeFontSchema,
	}),
	voice: appThemeVoiceSchema,
});

/** Where the palette comes from: a curated look, the poles of a V1 world, or three brand seeds. */
export const appThemeSourceSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("look"), look: z.enum(APP_LOOK_IDS) }),
	z.strictObject({
		kind: z.literal("world"),
		/** A V1 world id, for example "promenade". The server knows the world registry. */
		world: z.string().regex(/^[a-z0-9-]{1,40}$/),
	}),
	z.strictObject({
		kind: z.literal("seeds"),
		background: hexColorSchema,
		foreground: hexColorSchema,
		primary: hexColorSchema,
	}),
]);

/** What the user and the agent choose. The builder PUT sends only this part. */
export const appThemeSelectionSchema = z.strictObject({
	source: appThemeSourceSchema,
	mode: z.enum(APP_THEME_OPTIONS.mode),
	/** "look" keeps the primary of the source, a hue id takes APP_HUES, a hex is a brand color. */
	primary: z.union([
		z.literal("look"),
		z.enum(APP_THEME_OPTIONS.hue),
		hexColorSchema,
	]),
	font: z.union([z.literal("look"), z.enum(APP_BODY_FONT_IDS)]),
	displayFont: z.union([z.literal("look"), z.enum(APP_DISPLAY_FONT_IDS)]),
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

/** The whole theme.json. Written as `JSON.stringify(file, null, "\t") + "\n"`. */
export const appThemeFileSchema = z.strictObject({
	version: z.literal(1),
	origin: z.enum(APP_THEME_OPTIONS.origin),
	/** Shown in the builder and in the version label "Theme: <name>". No markup and no CSS characters. */
	name: z.string().regex(/^[^<>{};]{1,40}$/),
	selection: appThemeSelectionSchema,
	resolved: appThemeResolvedSchema,
});

/** The color tokens of one mode. The template writes each one as a `--theme-<mode>-<key>` variable on <html>. */
export type AppThemePalette = z.infer<typeof appThemePaletteSchema>;
/** One font face of theme.json. The template loads `href` as a <link> and writes `family` into a `--theme-font-*` variable. */
export type AppThemeFont = z.infer<typeof appThemeFontSchema>;
/** The heading voice of a look. The template puts it on <html> as data attributes. */
export type AppThemeVoice = z.infer<typeof appThemeVoiceSchema>;
/** The output of resolveAppTheme. Only the resolver writes it, and the template only reads it. */
export type AppThemeResolved = z.infer<typeof appThemeResolvedSchema>;
/** The palette source of a selection. A world source needs an AppThemeWorld to resolve. */
export type AppThemeSource = z.infer<typeof appThemeSourceSchema>;
/** The body of the builder PUT, and the output of the deal and Random. The user and the agent edit it. */
export type AppThemeSelection = z.infer<typeof appThemeSelectionSchema>;
/** The parsed theme.json. Only the host writes it, with buildAppThemeFile. */
export type AppThemeFile = z.infer<typeof appThemeFileSchema>;

/**
 * The selection of templates/web-app/src/styles/theme.json, the look of a project before the host writes a theme.
 * The theme GET answers it for a project before web-app@1.1.0. A host drift spec pins it to the template file.
 */
export const APP_THEME_TEMPLATE_SELECTION: AppThemeSelection = {
	source: { kind: "look", look: APP_DEFAULT_LOOK },
	mode: "light",
	primary: "look",
	font: "look",
	displayFont: "look",
	scale: "md",
	radius: "lg",
	border: "1",
	shadow: "sm",
	shadowStyle: "soft",
	content: "full",
	sidebarStyle: "inset",
	sidebarCollapse: "icons",
	sidebarStart: "open",
	sidebarTone: "tint",
	activeItem: "pill",
	header: "blur",
	userMenu: "sidebar-footer",
	frame: "outlined",
	icons: "regular",
	navIcon: "soft",
};

// The theme route schemas live here, not in versions.ts. index.ts exports versions.ts, and these
// schemas pull the look catalog into every bundle.
/**
 * Answer of `GET /api/v2/projects/:id/theme`. `headSha` is the commit of the theme: the sandbox HEAD,
 * or the stored `main` head when no sandbox runs. The web sends it back as `expectedHeadSha`.
 */
export const getAppThemeResponseSchema = z.object({
	/** The project theme. A missing or broken file gives the file that the next turn writes. */
	theme: appThemeFileSchema,
	/** The card of the world of a world source, for resolveAppTheme in the browser. Else null. */
	world: worldCardSchema.nullable(),
	headSha: commitShaSchema,
	/** False before web-app@1.1.0: `theme` is then the template default, and the Thème sheet stays off. */
	editable: z.boolean(),
});

/** TypeScript theme GET response. */
export type GetAppThemeResponse = z.infer<typeof getAppThemeResponseSchema>;

/**
 * Body of `PUT /api/v2/projects/:id/theme`. The server resolves the selection and writes the file.
 * A stale `expectedHeadSha` answers 409 THEME_HEAD_MOVED.
 */
export const putAppThemeBodySchema = z.object({
	selection: appThemeSelectionSchema,
	/** The `headSha` of the last theme GET. Compare-and-swap input. */
	expectedHeadSha: commitShaSchema,
});

/** TypeScript theme PUT body. */
export type PutAppThemeBody = z.infer<typeof putAppThemeBodySchema>;

/** Answer of the theme PUT: the written file and the sha of its "theme" commit, the new head. */
export const putAppThemeResponseSchema = z.object({
	theme: appThemeFileSchema,
	headSha: commitShaSchema,
});

/** TypeScript theme PUT response. */
export type PutAppThemeResponse = z.infer<typeof putAppThemeResponseSchema>;

/**
 * The palettes, fonts, and voice of a selection: the `resolved` part of theme.json.
 * A world source needs `world`, the card of that world. It throws when `world` is missing or is another world.
 */
export function resolveAppTheme(
	selection: AppThemeSelection,
	world?: AppThemeWorld,
): AppThemeResolved {
	const { source } = selection;
	// A world or a seeds source has no look. It takes the fonts and the voice of the default look.
	const look =
		APP_LOOKS[source.kind === "look" ? source.look : APP_DEFAULT_LOOK];
	const sourceWorld =
		source.kind === "world" ? checkedWorld(source.world, world) : undefined;
	const palettes =
		sourceWorld !== undefined
			? deriveTokens({
					background: sourceWorld.preview.ground,
					foreground: sourceWorld.preview.ink,
					primary: sourceWorld.preview.accent,
				})
			: source.kind === "seeds"
				? deriveTokens(source)
				: look.palette;
	const worldFont = APP_FONT_IDS.find(
		(id) => APP_FONTS[id].family === sourceWorld?.preview.fontFamily,
	);
	// A world face that is calm enough for the app also heads the app pages. A poster face stays public.
	const worldDisplay = APP_DISPLAY_FONT_IDS.find((id) => id === worldFont);
	const displayFont =
		selection.displayFont !== "look"
			? selection.displayFont
			: (worldDisplay ?? look.displayFont);
	return {
		light: withPrimary(palettes.light, selection.primary, "light"),
		dark: withPrimary(palettes.dark, selection.primary, "dark"),
		fonts: {
			sans: fontOf(selection.font === "look" ? look.font : selection.font),
			display: fontOf(displayFont),
			...(worldFont === undefined ? {} : { publicDisplay: fontOf(worldFont) }),
			arabicSans: fontOf(look.arabicSans),
			arabicDisplay: fontOf(look.arabicDisplay),
		},
		voice: look.voice,
	};
}

/**
 * The whole theme.json for a selection. The name is the look name, the world name, or "Brand colors",
 * unless `name` is given. It parses the result, so a bug throws here and never reaches the sandbox.
 */
export function buildAppThemeFile(input: {
	selection: AppThemeSelection;
	origin: AppThemeOrigin;
	/** The card of the world of a world source. */
	world?: AppThemeWorld;
	/** Replaces the default name. At most 40 characters are kept. */
	name?: string;
}): AppThemeFile {
	const { selection, origin, world } = input;
	const { source } = selection;
	const defaultName =
		source.kind === "look"
			? APP_LOOKS[source.look].name
			: source.kind === "world"
				? (world?.name ?? source.world)
				: "Brand colors";
	return appThemeFileSchema.parse({
		version: 1,
		origin,
		name: (input.name ?? defaultName).slice(0, 40),
		selection,
		resolved: resolveAppTheme(selection, world),
	});
}

/**
 * Applies the coherence rules to a selection. The deal and Random call it on every selection they make.
 * Each rule changes the fewest fields that make the look hold together.
 */
export function coherentSelection(
	selection: AppThemeSelection,
): AppThemeSelection {
	const next = { ...selection };
	const isThinBorder = next.border === "0.5" || next.border === "1";
	// A hard shadow is an offset copy of the edge, so the edge must be at least 1px.
	if (next.shadowStyle === "hard" && next.border === "0.5") {
		next.border = "1";
	}
	// A hard style with no shadow and a thin edge draws flat boxes. Only the soft style may go flat.
	if (next.shadowStyle === "hard" && next.shadow === "none" && isThinBorder) {
		next.shadow = "sm";
	}
	// From 2px, xl corners read as a cartoon. lg stays, because the pop family rules allow only lg and xl.
	if ((next.border === "2" || next.border === "3") && next.radius === "xl") {
		next.radius = "lg";
	}
	// A floating sidebar with no frame needs its own tone, else it melts into the canvas.
	if (
		next.sidebarStyle === "floating" &&
		next.frame === "flat" &&
		next.sidebarTone === "canvas"
	) {
		next.sidebarTone = "tint";
	}
	// A hidden sidebar that starts closed hides its footer, so the user menu moves to the header to keep logout.
	if (
		next.sidebarCollapse === "offcanvas" &&
		next.sidebarStart === "collapsed"
	) {
		next.userMenu = "header";
	}
	// The contrast tone is a dark slab. On a dark page it has no contrast.
	if (next.mode === "dark" && next.sidebarTone === "contrast") {
		next.sidebarTone = "tint";
	}
	// Hue tiles need a calm ground. On the brand tone one tile melts into the primary, and the others clash with it.
	if (next.navIcon === "color" && next.sidebarTone === "brand") {
		next.navIcon = "soft";
	}
	// A solid or a hue tile has a white glyph. A thin or a light line on it is too faint to read.
	if (
		(next.navIcon === "solid" || next.navIcon === "color") &&
		(next.icons === "thin" || next.icons === "light")
	) {
		next.icons = "regular";
	}
	return next;
}

/**
 * The selection of the Random button: any look, any mode, a primary of the look, and layout values from
 * the rules of its family. `rng` returns a number in [0, 1), like Math.random. The result is coherent.
 */
export function randomSelection(rng: () => number): AppThemeSelection {
	const pick = <Value extends string>(
		options: readonly [Value, ...Value[]],
	): Value => options[Math.floor(rng() * options.length)] ?? options[0];
	const lookId = pick(APP_LOOK_IDS);
	const look = APP_LOOKS[lookId];
	const rules = APP_THEME_FAMILY_RULES[look.family];
	return coherentSelection({
		source: { kind: "look", look: lookId },
		mode: pick(APP_THEME_OPTIONS.mode),
		primary: pick(["look", ...look.primaries]),
		// The look fonts are a designed pair. Random keeps them, so the result stays readable.
		font: "look",
		displayFont: "look",
		scale: pick(rules.scale),
		radius: pick(rules.radius),
		border: pick(rules.border),
		shadow: pick(rules.shadow),
		shadowStyle: pick(rules.shadowStyle),
		content: pick(rules.content),
		sidebarStyle: pick(rules.sidebarStyle),
		sidebarCollapse: pick(rules.sidebarCollapse),
		sidebarStart: pick(rules.sidebarStart),
		sidebarTone: pick(rules.sidebarTone),
		activeItem: pick(rules.activeItem),
		header: pick(rules.header),
		userMenu: pick(rules.userMenu),
		frame: pick(rules.frame),
		icons: pick(rules.icons),
		navIcon: pick(rules.navIcon),
	});
}

/** The palette with the primary of the selection. "look" keeps the palette primary. */
function withPrimary(
	palette: AppThemePalette,
	primary: AppThemeSelection["primary"],
	mode: AppThemeSelection["mode"],
): AppThemePalette {
	if (primary === "look") {
		return palette;
	}
	const tokens = brandPrimary(
		isAppThemeHue(primary) ? APP_HUES[primary][mode] : primary,
		palette.background,
	);
	// The first chart series follows the primary, as the look palettes do.
	return { ...palette, ...tokens, chart1: tokens.primary };
}

function isAppThemeHue(value: string): value is AppThemeHue {
	return Object.hasOwn(APP_HUES, value);
}

function checkedWorld(
	id: string,
	world: AppThemeWorld | undefined,
): AppThemeWorld {
	if (world?.id !== id) {
		throw new Error(
			`The theme source is the world "${id}", but the resolver got ${world === undefined ? "no world" : `the world "${world.id}"`}.`,
		);
	}
	return world;
}

function fontOf(id: AppFontId): AppThemeFont {
	const { family, href } = APP_FONTS[id];
	return { family, href };
}
