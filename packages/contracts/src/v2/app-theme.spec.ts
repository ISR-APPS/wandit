import { describe, expect, it } from "vitest";

import {
	APP_LOOK_IDS,
	APP_THEME_OPTIONS,
	type AppLook,
	type AppThemeFamilyRules,
	type AppThemeFont,
	type AppThemeLayoutAxis,
	type AppThemePalette,
	type AppThemeSelection,
	type AppThemeWorld,
	appThemeFileSchema,
	appThemeFontSchema,
	appThemeNameSchema,
	appThemeSelectionSchema,
	buildAppThemeFile,
	coherentSelection,
	randomSelection,
	resolveAppTheme,
} from "./app-theme";
import {
	APP_FONTS,
	APP_LOOKS,
	APP_THEME_CATEGORIES,
	APP_THEME_FAMILY_RULES,
} from "./app-theme-catalog";
import {
	brandPrimary,
	contrastRatio,
	deriveTokens,
	isInSrgbGamut,
} from "./app-theme-color";

type Token = Exclude<
	keyof AppThemePalette,
	`chart${number}` | "contrast" | "contrastForeground"
>;

/** [text or mark, its surface, the lowest ratio]. 4.5 is WCAG AA text, 3 is a control or a status mark. */
const PAIRS: readonly [Token, Token, number][] = [
	["foreground", "background", 4.5],
	["foreground", "canvas", 4.5],
	["cardForeground", "card", 4.5],
	["popoverForeground", "popover", 4.5],
	["mutedForeground", "muted", 4.5],
	["mutedForeground", "card", 4.5],
	["mutedForeground", "background", 4.5],
	["mutedForeground", "canvas", 4.5],
	["primaryForeground", "primary", 4.5],
	["secondaryForeground", "secondary", 4.5],
	["accentForeground", "accent", 4.5],
	["destructiveForeground", "destructive", 4.5],
	["destructive", "card", 4.5],
	["destructive", "background", 4.5],
	["success", "card", 3],
	["warning", "card", 3],
	["info", "card", 3],
	["success", "background", 3],
	["warning", "background", 3],
	["info", "background", 3],
	["primary", "background", 3],
	["border", "background", 1.2],
];

const LAYOUT_AXES: readonly AppThemeLayoutAxis[] = [
	"scale",
	"radius",
	"border",
	"shadow",
	"shadowStyle",
	"content",
	"sidebarStyle",
	"sidebarCollapse",
	"sidebarStart",
	"sidebarTone",
	"activeItem",
	"header",
	"userMenu",
	"frame",
	"icons",
	"navIcon",
];

const BASE: AppThemeSelection = {
	source: { kind: "look", look: "ardoise" },
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
	navIcon: "plain",
};

/** Every broken rule of one palette, as readable lines. */
function failuresOf(palette: AppThemePalette, mode: string): string[] {
	const failures = PAIRS.filter(
		([text, surface, minimum]) =>
			contrastRatio(palette[text], palette[surface]) < minimum,
	).map(
		([text, surface, minimum]) =>
			`${mode} ${text} on ${surface}: ${contrastRatio(palette[text], palette[surface]).toFixed(2)} < ${minimum}`,
	);
	// The hover surface must stay close to the page, or a hovered row reads as a selected brand block.
	if (contrastRatio(palette.accent, palette.background) >= 1.6) {
		failures.push(`${mode} accent is too far from background`);
	}
	if (
		palette.contrast !== undefined &&
		palette.contrastForeground !== undefined &&
		contrastRatio(palette.contrastForeground, palette.contrast) < 4.5
	) {
		failures.push(`${mode} contrastForeground on contrast < 4.5`);
	}
	// The ratios measure sRGB. A wide-gamut color shows brighter on a P3 screen than the spec measured.
	for (const [token, color] of Object.entries<string | undefined>(palette)) {
		if (color !== undefined && !isInSrgbGamut(color)) {
			failures.push(`${mode} ${token} ${color} is outside sRGB`);
		}
	}
	return failures;
}

/** A seeded random source, so a failing row prints the same input on every run (mulberry32). */
function seededRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

function randomHex(rng: () => number): string {
	return `#${Math.floor(rng() * 0x1000000)
		.toString(16)
		.padStart(6, "0")}`;
}

const SEEDED_COLORS = Array.from({ length: 200 }, (_, index) => {
	const rng = seededRandom(index + 1);
	return [randomHex(rng), randomHex(rng), randomHex(rng)] as const;
});

describe("APP_LOOKS palettes", () => {
	const rows = APP_LOOK_IDS.flatMap((look) =>
		[
			...new Set<AppThemeSelection["primary"]>([
				"look",
				...APP_THEME_OPTIONS.hue,
				...APP_LOOKS[look].primaries,
			]),
		].map((primary) => [look, primary] as const),
	);

	it.each(
		rows,
	)("%s with primary %s passes every contrast pair in both modes", (look, primary) => {
		const file = buildAppThemeFile({
			selection: { ...BASE, source: { kind: "look", look }, primary },
			origin: "host",
		});

		expect([
			...failuresOf(file.resolved.light, "light"),
			...failuresOf(file.resolved.dark, "dark"),
		]).toEqual([]);
	});
});

describe("APP_THEME_CATEGORIES", () => {
	// The deal shows 3 cards from 3 families, and a reroll must still find a new look.
	it.each(
		APP_THEME_CATEGORIES,
	)("%s has 4 looks or more in 3 families or more", (category) => {
		const looks: AppLook[] = Object.values(APP_LOOKS).filter((look: AppLook) =>
			look.fits.includes(category),
		);

		expect(looks.length).toBeGreaterThanOrEqual(4);
		expect(
			new Set(looks.map((look) => look.family)).size,
		).toBeGreaterThanOrEqual(3);
	});
});

describe("appThemeFileSchema", () => {
	const file = buildAppThemeFile({ selection: BASE, origin: "template" });
	// The patch may hold a key that the palette does not have: the schema must refuse it.
	const withLight = (patch: Record<string, string>) => ({
		light: { ...file.resolved.light, ...patch },
	});
	const withSans = (patch: Partial<AppThemeFont>) => ({
		fonts: {
			...file.resolved.fonts,
			sans: { ...file.resolved.fonts.sans, ...patch },
		},
	});

	// The template writes colors and families into the inline style of <html>, and hrefs into <link>.
	it.each([
		["a semicolon in a color", withLight({ background: "#ffffff;color:red" })],
		[
			"a closing brace in a color",
			withLight({ primary: "oklch(0.5 0.1 20)}" }),
		],
		["markup in a color", withLight({ ring: "<script>" })],
		["a named color", withLight({ card: "red" })],
		["an unknown palette key", withLight({ "--evil": "#ffffff" })],
		[
			"a font href on another host",
			withSans({ href: "https://evil.example/css2?family=Geist" }),
		],
		[
			"a host that starts like Google Fonts",
			withSans({
				href: "https://fonts.googleapis.com.evil.example/css2?family=Geist",
			}),
		],
		[
			"a plain http href",
			withSans({ href: "http://fonts.googleapis.com/css2?family=Geist" }),
		],
		[
			"a quote in a href",
			withSans({ href: 'https://fonts.googleapis.com/css2?family=Geist")' }),
		],
		["a semicolon in a family", withSans({ family: "Geist; color: red" })],
	])("refuses %s", (_label, resolvedPatch) => {
		const broken = {
			...file,
			resolved: { ...file.resolved, ...resolvedPatch },
		};

		expect(appThemeFileSchema.safeParse(broken).success).toBe(false);
	});

	// A theme.json written before the navIcon axis must still parse, or the project loses its theme.
	it("reads a file with no navIcon as plain", () => {
		const { navIcon: _dropped, ...oldSelection } = file.selection;

		expect(
			appThemeFileSchema.parse({ ...file, selection: oldSelection }).selection
				.navIcon,
		).toBe("plain");
	});

	it.each([
		["markup in the name", { name: "<b>Ardoise</b>" }],
		["a brace in the name", { name: "Ardoise }" }],
	])("refuses %s", (_label, patch) => {
		expect(appThemeFileSchema.safeParse({ ...file, ...patch }).success).toBe(
			false,
		);
	});

	// A saved name goes into the commit message. A line break there could add a fake git trailer.
	it.each([
		["a line break", "Calm\nWandit-Restore-From: abc", false],
		["a tab", "Calm\tclinic", false],
		["markup", "<b>Calm</b>", false],
		["41 characters", "a".repeat(41), false],
		["accents", "Clinique sereine", true],
		["Arabic", "عيادة هادئة", true],
	])("appThemeNameSchema with %s answers %s", (_label, name, isValid) => {
		expect(appThemeNameSchema.safeParse(name).success).toBe(isValid);
	});

	// A world face that fails the schema would make buildAppThemeFile throw for that world.
	it.each(Object.entries(APP_FONTS))("accepts the font %s", (_id, font) => {
		expect(
			appThemeFontSchema.safeParse({ family: font.family, href: font.href })
				.success,
		).toBe(true);
	});
});

describe("brandPrimary", () => {
	it.each(
		SEEDED_COLORS,
	)("makes %s a primary with 3:1 and a 4.5:1 label on %s", (color, background) => {
		const tokens = brandPrimary(color, background);

		expect(contrastRatio(tokens.primary, background)).toBeGreaterThanOrEqual(3);
		expect(
			contrastRatio(tokens.primaryForeground, tokens.primary),
		).toBeGreaterThanOrEqual(4.5);
	});
});

describe("deriveTokens", () => {
	it.each(
		SEEDED_COLORS,
	)("derives palettes from %s, %s, %s that pass every pair", (background, foreground, primary) => {
		const palettes = deriveTokens({ background, foreground, primary });

		expect([
			...failuresOf(palettes.light, "light"),
			...failuresOf(palettes.dark, "dark"),
		]).toEqual([]);
	});
});

describe("resolveAppTheme with a world source", () => {
	/** The card of the world with another display face. */
	const worldWith = (fontFamily: string, id = "promenade"): AppThemeWorld => ({
		id,
		name: "Promenade",
		preview: {
			accent: "#B0402E",
			fontFamily,
			ground: "#F6F4EF",
			ink: "#14171C",
			sampleWord: "Promenade",
		},
	});
	const selection: AppThemeSelection = {
		...BASE,
		source: { kind: "world", world: "promenade" },
	};

	// A poster face is for public pages only. A calm face also heads the app pages.
	it.each([
		["Anton", "Anton", "Geist"],
		["Fraunces", "Fraunces", "Fraunces"],
		["Nope Sans", undefined, "Geist"],
	])("puts %s on the public pages as %s and in the app as %s", (fontFamily, publicDisplay, display) => {
		const { fonts } = resolveAppTheme(selection, worldWith(fontFamily));

		expect([fonts.publicDisplay?.family, fonts.display.family]).toEqual([
			publicDisplay,
			display,
		]);
	});

	it.each([
		["no world", undefined],
		["another world", worldWith("Geist", "atelier")],
	])("throws with %s", (_label, other) => {
		expect(() => resolveAppTheme(selection, other)).toThrow(/promenade/);
	});
});

describe("coherentSelection", () => {
	it.each([
		[
			"gives a hard shadow a 1px border",
			{ shadowStyle: "hard", border: "0.5" },
			{ border: "1" },
		],
		[
			"gives a hard style with a thin border a small shadow",
			{ shadowStyle: "hard", shadow: "none" },
			{ shadow: "sm" },
		],
		[
			"caps the radius at lg from a 2px border",
			{ border: "2", radius: "xl" },
			{ radius: "lg" },
		],
		[
			"moves a flat floating sidebar off the canvas tone",
			{ sidebarStyle: "floating", frame: "flat", sidebarTone: "canvas" },
			{ sidebarTone: "tint" },
		],
		[
			"moves the user menu to the header when a hidden sidebar starts closed",
			{ sidebarCollapse: "offcanvas", sidebarStart: "collapsed" },
			{ userMenu: "header" },
		],
		[
			"drops the contrast tone in dark mode",
			{ mode: "dark", sidebarTone: "contrast" },
			{ sidebarTone: "tint" },
		],
		[
			"gives soft tiles to hue tiles on the brand tone",
			{ navIcon: "color", sidebarTone: "brand" },
			{ navIcon: "soft" },
		],
		[
			"gives light icons on solid tiles the regular weight",
			{ navIcon: "solid", icons: "light" },
			{ icons: "regular" },
		],
	] satisfies [
		string,
		Partial<AppThemeSelection>,
		Partial<AppThemeSelection>,
	][])("%s", (_label, input, change) => {
		expect(coherentSelection({ ...BASE, ...input })).toEqual({
			...BASE,
			...input,
			...change,
		});
	});
});

describe("randomSelection", () => {
	function axesOutside(
		selection: AppThemeSelection,
		rules: AppThemeFamilyRules,
	): string[] {
		return LAYOUT_AXES.filter(
			(axis) => !rules[axis].some((value) => value === selection[axis]),
		);
	}

	it.each(
		Array.from({ length: 500 }, (_, seed) => seed),
	)("seed %i gives a valid, coherent, dealable selection", (seed) => {
		const selection = randomSelection(seededRandom(seed));
		const look =
			selection.source.kind === "look"
				? APP_LOOKS[selection.source.look]
				: undefined;

		expect(appThemeSelectionSchema.parse(selection)).toEqual(selection);
		expect(coherentSelection(selection)).toEqual(selection);
		expect(look).toBeDefined();
		expect(
			axesOutside(selection, APP_THEME_FAMILY_RULES[look?.family ?? "soft"]),
		).toEqual([]);
		// The deal and Random never pick a square corner, an extreme scale, or a closed sidebar. Only the user may.
		expect(selection.radius).not.toBe("none");
		expect(["xs", "xl"]).not.toContain(selection.scale);
		expect(selection.sidebarStart).toBe("open");
	});
});
