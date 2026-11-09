/**
 * The AI theme designer of the builder Thème sheet: its two prompts and the reading of its answer. Pure functions, no I/O.
 * AppThemeDesignService sends the prompts to the model. It turns the parsed answer into a selection and a name with this file.
 * The fonts and the family rules come from "@wandit/contracts/v2/app-theme-catalog", so the prompt follows the catalog.
 */
import {
	APP_BODY_FONT_IDS,
	APP_DISPLAY_FONT_IDS,
	APP_THEME_OPTIONS,
	type AppLookFamily,
	type AppThemeDesign,
	type AppThemeResolved,
	type AppThemeSelection,
	coherentSelection,
} from "@wandit/contracts/v2/app-theme";
import {
	APP_FONTS,
	APP_LOOK_FAMILIES,
	APP_THEME_FAMILY_RULES,
} from "@wandit/contracts/v2/app-theme-catalog";
import { parseColor, toHex } from "@wandit/contracts/v2/app-theme-color";

/** The name of a designed theme when the model name has no usable character. */
const FALLBACK_THEME_NAME = "AI theme";

/** 40: the limit of the theme.json name. The file schema counts UTF-16 code units. */
const THEME_NAME_MAX_LENGTH = 40;

/** The style axes that the model chooses. The seeds, the mode, and the fonts have their own prompt section. */
type DesignedStyleAxis = Exclude<
	keyof AppThemeDesign,
	| "name"
	| "mode"
	| "background"
	| "foreground"
	| "primary"
	| "font"
	| "displayFont"
>;

/** A body or a display font id: the ids that `displayFont` accepts. Body ids are a part of them. */
type DesignFontId = (typeof APP_DISPLAY_FONT_IDS)[number];

/** What each style axis does. The type makes the compiler ask for a note when an axis joins the design schema. */
const STYLE_AXIS_NOTES: { readonly [Axis in DesignedStyleAxis]: string } = {
	radius: "corner radius of cards, controls, and panels",
	border: "edge width in px; 0.5 is a hairline, 2 and 3 are bold outlines",
	shadow: "depth of the card and panel shadows",
	shadowStyle:
		"soft is a blurred shadow; hard is a 0-blur offset copy of the edge, the pressed sticker look",
	sidebarStyle:
		"inset puts the page on a raised panel, classic is a full-height side column, floating is a detached rounded card",
	sidebarTone:
		"the sidebar ground: canvas is the page ground, tint is a light shade, contrast is a dark slab, brand is the primary",
	activeItem:
		"how the selected nav item and tab show: pill, bar (an edge line), block, outline, or quiet (text only)",
	header:
		"the top bar: bar is solid with an edge, blur is see-through, plain has no ground",
	frame: "outlined gives the inset panel an edge, flat gives it none",
	icons:
		"the Phosphor weight of every icon; thin is faint at small sizes, fill draws solid shapes, duotone adds a soft fill",
	navIcon:
		"the tile behind each nav icon: plain is none, soft is faint, solid is filled, color gives each item its own hue",
};

/**
 * The character of each font, for the font choice of the model. The type makes the compiler ask for a note
 * when a body or a display font joins APP_FONTS.
 */
const FONT_NOTES: { readonly [Id in DesignFontId]: string } = {
	geist: "neutral technical grotesk, the clean SaaS default",
	inter: "the workhorse UI sans, very legible at small sizes",
	"inter-tight": "Inter with tight spacing, for dense modern dashboards",
	"dm-sans": "low-contrast geometric, friendly and clean",
	"plus-jakarta-sans": "modern geometric with soft curves, a startup feel",
	manrope: "semi-rounded geometric, calm and contemporary",
	figtree: "friendly geometric, light and approachable",
	outfit: "round geometric, playful but tidy",
	lexend: "wide and very readable, for education and accessibility",
	"public-sans": "plain neutral grotesk, trustworthy and institutional",
	"ibm-plex-sans": "engineered grotesk, corporate and technical",
	"instrument-sans": "crisp neo-grotesk with editorial precision",
	"hanken-grotesk": "light open grotesk, quiet and elegant",
	karla: "quirky grotesk, warm and informal",
	nunito: "rounded terminals, soft and kind, for care and kids",
	"red-hat-text": "sturdy humanist, dependable enterprise",
	"albert-sans": "Scandinavian geometric, clean and calm",
	"schibsted-grotesk": "news grotesk, firm and journalistic",
	"familjen-grotesk": "characterful grotesk, a design-studio feel",
	epilogue: "sharp grotesk with character, for bold brands",
	jost: "geometric in the Futura line, fashion and premium",
	archivo: "strong grotesk, industrial, logistics, and sport",
	"space-grotesk": "techy grotesk with odd details, dev tools and crypto",
	satoshi: "polished modern geometric, a refined startup",
	"general-sans": "neutral refined geometric, versatile",
	sora: "geometric with wide forms, tech and fintech",
	"red-hat-display": "firm geometric headings, confident corporate",
	"bricolage-grotesque":
		"expressive grotesk with ink traps, creative and lively",
	unbounded: "wide rounded display, bold, young, and loud",
	fredoka: "very round, playful, for kids and food",
	"baloo-2": "chunky rounded, warm and family-friendly",
	syne: "eccentric wide display, art, agencies, and fashion",
	fraunces: "soft wonky serif, warm and crafted, food and hospitality",
	newsreader: "editorial serif, news, media, and publishing",
	"source-serif-4": "sober book serif, legal, finance, and academia",
	"cormorant-garamond":
		"refined high-contrast Garamond, luxury, beauty, and weddings",
	cormorant: "dramatic display Garamond, luxury at large sizes",
	"playfair-display": "high-contrast transitional serif, elegant and premium",
	lora: "brushed contemporary serif, warm, literary, and wellness",
	"eb-garamond": "classic old-style serif, heritage, law, and nonprofit",
	spectral: "screen-first serif, elegant consulting",
	"bodoni-moda": "sharp didone, fashion and luxury",
	"libre-caslon-text": "traditional Caslon, established banking and law",
	tinos: "Times-like serif, formal and institutional",
	"ibm-plex-mono": "monospace, dev tools, data, and technical apps",
};

/** The character of each look family, next to its rules in the prompt. */
const FAMILY_NOTES: { readonly [Family in AppLookFamily]: string } = {
	soft: "airy and tinted, calm SaaS, care, and wellness",
	crisp: "precise with hairlines, finance, data, and tools",
	warm: "earthy with serif voices, hospitality, food, and crafts",
	pop: "joyful with outlines and hard shadows, kids, events, and young brands",
	luxe: "ivory or black with gold and high-contrast serifs, beauty, hotels, and real estate",
	editorial:
		"paper, ink, and print serifs with no shadow, media, publishing, and nonprofits",
	brutal:
		"loud flat color, thick edges, and hard offset shadows, agencies, drops, and events",
	mono: "gray scale with one sharp accent and fine lines, dev tools, data, and finance",
	midnight:
		"dark first with electric accents and glow, tech, gaming, and nightlife",
	industrial:
		"steel grays and safety colors with a dark slab sidebar, construction, fleets, and stock",
	corporate:
		"a deep navy, green, or burgundy brand sidebar, banks, law firms, and HR",
	medina:
		"zellige blue, mint, saffron, and terracotta, Moroccan food, riads, crafts, and travel",
};

// SAFETY: Object.keys returns the own keys of the STYLE_AXIS_NOTES literal, and its type lists every axis.
const STYLE_AXES = Object.keys(STYLE_AXIS_NOTES) as DesignedStyleAxis[];

/** The display faces that are not body faces. A body face also works as a calm display face. */
const DISPLAY_ONLY_FONT_IDS = APP_DISPLAY_FONT_IDS.filter(
	(id) => APP_FONTS[id].role === "display",
);

const fontLineOf = (id: DesignFontId) =>
	`- ${id} (${APP_FONTS[id].family}): ${FONT_NOTES[id]}`;

/**
 * The system prompt of the theme designer. It lists every font id, every axis value, and the family
 * archetypes from APP_THEME_FAMILY_RULES. So a catalog change reaches the prompt with no edit here.
 */
export const THEME_DESIGNER_SYSTEM_PROMPT = [
	"You are a senior brand and product designer. You design the theme of a business admin app: a sidebar, a top bar, cards, tables, charts, and forms.",
	"Answer with one theme that fits the schema. Design for the business, the audience, and the mood that the user describes.",
	"",
	"## Colors",
	"Pick the mode, then give three seed colors for that mode as #rrggbb.",
	"- background: the page ground. Near white for light (a faint tint of the brand is good), near black for dark.",
	"- foreground: the text ink. A deep neutral or a very dark shade of the brand on light, a soft off-white on dark.",
	"- primary: a confident brand color for buttons, links, and focus. Saturated and distinct, never gray.",
	"The host derives every other token (cards, borders, muted text, charts, sidebar) from the three seeds and guarantees text contrast. Choose the brand, not the details.",
	`- mode (${APP_THEME_OPTIONS.mode.join(" | ")}): light suits most business apps. Pick dark when the user asks for it or the brand lives at night (nightlife, gaming, cinema, luxury).`,
	"",
	"## Fonts",
	"font is the body face of every screen. displayFont heads the pages and the KPI figures.",
	"Body faces (also valid as displayFont, for calm headings):",
	...APP_BODY_FONT_IDS.map(fontLineOf),
	"Display faces (displayFont only):",
	...DISPLAY_ONLY_FONT_IDS.map(fontLineOf),
	"",
	"## Style axes",
	...STYLE_AXES.map(
		(axis) =>
			`- ${axis} (${APP_THEME_OPTIONS[axis].join(" | ")}): ${STYLE_AXIS_NOTES[axis]}.`,
	),
	"",
	"## Families",
	"Each family lists the values that hold together. Pick the family that fits the brand and stay inside its values, unless the user asks for another value.",
	...APP_LOOK_FAMILIES.map(
		(family) =>
			`- ${family}, ${FAMILY_NOTES[family]}: ` +
			STYLE_AXES.map(
				(axis) => `${axis} ${APP_THEME_FAMILY_RULES[family][axis].join("|")}`,
			).join("; "),
	),
	"The host also fixes clashes: a hard shadowStyle gets a border of 1 or more, a color navIcon needs a sidebarTone other than brand, and dark mode turns a contrast sidebarTone into tint.",
	"",
	"## Name",
	"name: 1 to 3 evocative words in the language of the user, for example Bleu nuit or Menthe douce. No quotes, no punctuation, no emoji.",
].join("\n");

/**
 * The `#rrggbb` of a palette color, for the summary of the current theme. The palette schema allows only
 * hex and oklch, and parseColor reads both. The raw text is only a fallback.
 */
function hexOf(color: string): string {
	const parsed = parseColor(color);
	return parsed === null ? color : toHex(parsed);
}

/**
 * The user prompt of the theme designer: the request and a short summary of the theme on screen.
 * A partial request keeps the rest of the theme. A request for a new theme ignores it.
 */
export function themeDesignerUserPrompt(input: {
	/** The words of the user, already trimmed by the body schema. At most 600 characters. */
	request: string;
	/** The name of the theme on screen: the sheet draft, else the saved theme. */
	name: string;
	selection: AppThemeSelection;
	/** The resolved palettes and fonts of `selection`. Null for a world source whose world card is gone. */
	resolved: AppThemeResolved | null;
}): string {
	const { name, request, resolved, selection } = input;
	const palette = resolved?.[selection.mode];
	return [
		"The user asks:",
		'"""',
		request,
		'"""',
		"",
		`The theme on screen now: "${name}", ${selection.mode} mode.`,
		...(palette === undefined
			? []
			: [
					`Colors: background ${hexOf(palette.background)}, text ${hexOf(palette.foreground)}, primary ${hexOf(palette.primary)}.`,
				]),
		resolved === null
			? `Fonts: ${selection.font} body, ${selection.displayFont} headings.`
			: `Fonts: ${resolved.fonts.sans.family} body, ${resolved.fonts.display.family} headings.`,
		`Style: radius ${selection.radius}, border ${selection.border} px, shadow ${selection.shadow} ${selection.shadowStyle}, ` +
			`sidebar ${selection.sidebarStyle} on ${selection.sidebarTone}, icons ${selection.icons}.`,
		"",
		'When the request changes only a part, such as "darker", "rounder", or "another blue", keep every other value of the theme on screen.',
		"When the request asks for a new theme, a brand, or a business, ignore the theme on screen and design from the request.",
	].join("\n");
}

/**
 * The selection of a model answer: a seeds source in lower case, the fonts, the mode, and the style axes.
 * scale, content, sidebarCollapse, sidebarStart, and userMenu stay the choice of the user. coherentSelection runs last.
 */
export function designedThemeSelection(
	design: AppThemeDesign,
	current: AppThemeSelection,
): AppThemeSelection {
	// The design schema accepts upper case. The selection schema wants `#rrggbb` in lower case.
	const seedOf = (hex: string): `#${string}` =>
		`#${hex.slice(1).toLowerCase()}`;
	return coherentSelection({
		source: {
			kind: "seeds",
			background: seedOf(design.background),
			foreground: seedOf(design.foreground),
			primary: seedOf(design.primary),
		},
		mode: design.mode,
		// "look" keeps the primary seed. A hue or a second hex would replace it.
		primary: "look",
		font: design.font,
		displayFont: design.displayFont,
		radius: design.radius,
		border: design.border,
		shadow: design.shadow,
		shadowStyle: design.shadowStyle,
		sidebarStyle: design.sidebarStyle,
		sidebarTone: design.sidebarTone,
		activeItem: design.activeItem,
		header: design.header,
		frame: design.frame,
		icons: design.icons,
		navIcon: design.navIcon,
		// Product rule: the structure axes change how the app works, so only the user changes them.
		scale: current.scale,
		content: current.content,
		sidebarCollapse: current.sidebarCollapse,
		sidebarStart: current.sidebarStart,
		userMenu: current.userMenu,
	});
}

/**
 * The theme.json name of a model answer. Control characters and `< > { } ;` become spaces, spaces collapse,
 * and at most 40 code units stay. A name with nothing left is "AI theme".
 */
export function designedThemeName(raw: string): string {
	const cleaned = raw
		.replace(/[\p{Cc}<>{};]/gu, " ")
		.replace(/\s+/gu, " ")
		.trim();
	// Whole code points only: a cut through a surrogate pair would leave half of an emoji.
	let name = "";
	for (const character of cleaned) {
		if (name.length + character.length > THEME_NAME_MAX_LENGTH) {
			break;
		}
		name += character;
	}
	return name.trim() || FALLBACK_THEME_NAME;
}
