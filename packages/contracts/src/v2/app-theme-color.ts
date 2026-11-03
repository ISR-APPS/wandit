/**
 * Color math of the V2 app theme: it reads colors, converts OKLCH and sRGB, and measures WCAG contrast.
 * It also derives palettes that pass the contrast rules.
 * resolveAppTheme (app-theme.ts) calls it on the server and in the builder. app-theme.spec.ts measures with it.
 * The OKLab matrices come from Björn Ottosson, OKLab (2020). This file ports them from the old check-theme.mjs.
 */
import type { AppThemePalette } from "./app-theme";

/** A color in OKLCH. `l` is 0 to 1, `c` is 0 to about 0.4, `h` is the hue in degrees, 0 to 360. */
export type Oklch = { l: number; c: number; h: number };

/** The three seed colors of a brand or a V1 world, each `#rrggbb`. deriveTokens builds a palette from them. */
export type AppThemeSeeds = {
	background: string;
	foreground: string;
	primary: string;
};

/** The fill, the label, and the focus ring of a primary. brandPrimary makes them pass on one ground. */
export type AppThemePrimaryTokens = Pick<
	AppThemePalette,
	"primary" | "primaryForeground" | "ring"
>;

/** Body text and the label of a fill: WCAG 2 level AA. */
const TEXT_CONTRAST = 4.5;
/** A control edge and a status mark on its surface: WCAG 2 non-text contrast (1.4.11). */
const UI_CONTRAST = 3;
/** A border on the page. The spec asks 1.2:1, and the margin keeps the hex rounding above it. */
const BORDER_CONTRAST = 1.25;
/** OKLCH lightness moved per try. Small steps keep a moved color close to its seed. */
const LIGHTNESS_STEP = 0.005;
/**
 * sqrt(1.05 * 0.05) - 0.05: the luminance where black text and white text have the same contrast.
 * A ground above it is a light ground.
 */
const MID_LUMINANCE = 0.1791;

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;
const OKLCH_PATTERN =
	/^oklch\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)\)$/;

/**
 * Reads `#rrggbb` (any case) or `oklch(L C H)` with plain decimals, the two forms of the theme schema.
 * Returns null for any other text.
 */
export function parseColor(text: string): Oklch | null {
	const hex = HEX_PATTERN.exec(text.trim());
	if (hex?.[1] !== undefined) {
		const digits = hex[1];
		return oklchOfLinear(
			[0, 2, 4].map((at) =>
				linearOf(Number.parseInt(digits.slice(at, at + 2), 16) / 255),
			),
		);
	}
	const oklch = OKLCH_PATTERN.exec(text.trim());
	if (oklch === null) {
		return null;
	}
	return { l: Number(oklch[1]), c: Number(oklch[2]), h: Number(oklch[3]) };
}

/**
 * The `#rrggbb` of an OKLCH color. A color outside sRGB keeps its lightness and hue and loses chroma
 * until it fits, as CSS Color 4 asks. So the hex shows the same color on every screen.
 */
export function toHex(color: Oklch): string {
	return `#${srgbOf(color)
		.map((channel) =>
			Math.round(gammaOf(channel) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/**
 * True when the color shows the same on an sRGB screen and on a wide-gamut screen.
 * The contrast math measures sRGB, so a palette color outside sRGB gives a wrong ratio.
 */
export function isInSrgbGamut(text: string): boolean {
	return isLinearInGamut(linearOfOklch(readColor(text)));
}

/** The WCAG 2 contrast ratio of two colors, 1 to 21. It throws on a text that parseColor cannot read. */
export function contrastRatio(first: string, second: string): number {
	return contrastOf(readColor(first), readColor(second));
}

/**
 * The color `weight` of the way from `first` to `second` in OKLCH (0 gives `first`, 1 gives `second`).
 * The hue takes the short way round. Returns `#rrggbb`.
 */
export function mixOklch(
	first: string,
	second: string,
	weight: number,
): string {
	return toHex(mix(readColor(first), readColor(second), weight));
}

/**
 * Keeps the hue of a brand color and makes it a primary for one ground. When the fill has less than 3:1
 * on the ground, it gets darker on a light ground and lighter on a dark ground until it has 3:1.
 * The label is white or a near-black of the same hue, the one with more contrast, and it gets 4.5:1.
 */
export function brandPrimary(
	color: string,
	background: string,
): AppThemePrimaryTokens {
	const ground = readColor(background);
	return signalPair(readColor(color), [ground], UI_CONTRAST, awayFrom(ground));
}

/**
 * A full light and dark palette from three seeds. The seeds give one mode: a light background gives
 * the light palette, a dark one the dark palette. The other mode keeps their hues on a flipped ground.
 * Every pair of the contrast spec passes, whatever the seeds are.
 */
export function deriveTokens(seeds: AppThemeSeeds): {
	light: AppThemePalette;
	dark: AppThemePalette;
} {
	const ground = readColor(seeds.background);
	const ink = readColor(seeds.foreground);
	const brand = readColor(seeds.primary);
	const seedsAreLight = isLight(ground);
	// The flipped mode gets a near-white or a near-black ground and ink, with a hint of the seed hues.
	return {
		light: paletteOf(
			seedsAreLight
				? ground
				: { l: 0.98, c: Math.min(ground.c, 0.012), h: ground.h },
			seedsAreLight
				? ink
				: { l: 0.24, c: Math.min(ground.c, 0.04), h: ground.h },
			brand,
			"light",
		),
		dark: paletteOf(
			seedsAreLight
				? { l: 0.19, c: Math.min(ground.c, 0.03), h: ground.h }
				: ground,
			seedsAreLight ? { l: 0.96, c: Math.min(ink.c, 0.012), h: ink.h } : ink,
			brand,
			"dark",
		),
	};
}

/** One mode of deriveTokens. `ground`, `ink`, and `brand` are the seeds of that mode. */
function paletteOf(
	ground: Oklch,
	ink: Oklch,
	brand: Oklch,
	mode: "light" | "dark",
): AppThemePalette {
	const isLightMode = mode === "light";
	const away = isLightMode ? -LIGHTNESS_STEP : LIGHTNESS_STEP;
	// An app page stays calm: the ground stays near white or near black, whatever the brand ground is.
	const background = isLightMode
		? {
				l: clamp(ground.l, 0.93, 0.995),
				c: Math.min(ground.c, 0.04),
				h: ground.h,
			}
		: {
				l: clamp(ground.l, 0.14, 0.24),
				c: Math.min(ground.c, 0.05),
				h: ground.h,
			};
	// A light card is a step paler than the page, a dark card a step lighter. The canvas sits under both.
	const card = isLightMode
		? {
				l: Math.min(1, background.l + 0.02),
				c: background.c / 2,
				h: background.h,
			}
		: { ...background, l: background.l + 0.03 };
	// A light popover is the card. A dark popover takes one more step, so a menu shows above a card.
	const popover = isLightMode
		? card
		: { ...background, l: background.l + 0.05 };
	const canvas = {
		...background,
		l: background.l + (isLightMode ? -0.025 : -0.03),
	};
	const surfaces = [background, card, popover, canvas];
	// Body text starts as a near-black ink (L 0.3 or less) or a near-white ink (L 0.92 or more).
	// So it keeps at least about 9.8:1 on every surface. The chroma caps keep only a hint of the ink hue.
	// sRGB holds less chroma near white, so the near-white cap (0.03) is half the near-black cap (0.06).
	const foreground = pushUntil(
		isLightMode
			? { l: Math.min(ink.l, 0.3), c: Math.min(ink.c, 0.06), h: ink.h }
			: { l: Math.max(ink.l, 0.92), c: Math.min(ink.c, 0.03), h: ink.h },
		surfaces,
		TEXT_CONTRAST,
		away,
	);
	// Muted and secondary are small steps from the page toward the text. Dark mode needs larger steps to show.
	const muted = mix(background, foreground, isLightMode ? 0.045 : 0.07);
	const secondary = mix(background, foreground, isLightMode ? 0.07 : 0.1);
	// The hover surface: a small lightness step from the page, with a hint of the brand hue.
	// Dark mode takes the larger step, because a small step does not show on a dark page.
	const accent = {
		l: background.l + (isLightMode ? -0.035 : 0.07),
		c: Math.min(brand.c, isLightMode ? 0.035 : 0.045),
		h: brand.h,
	};
	const primary = signalPair(brand, [background], UI_CONTRAST, away);
	// Form errors are text in the destructive color, so it needs 4.5:1 on the page and on a card.
	// The seeds are near Tailwind red-600 (light, with less chroma) and red-400 (dark).
	const destructive = signalPair(
		isLightMode ? { l: 0.55, c: 0.2, h: 25 } : { l: 0.68, c: 0.19, h: 22 },
		[background, card],
		TEXT_CONTRAST,
		away,
	);
	// The status seeds are a calm green, amber, and blue. Each one moves until it has 3:1 on the page and the card.
	const statusOf = (seed: Oklch) =>
		toHex(pushUntil(seed, [background, card], UI_CONTRAST, away));
	return {
		background: toHex(background),
		foreground: toHex(foreground),
		card: toHex(card),
		cardForeground: toHex(foreground),
		popover: toHex(popover),
		popoverForeground: toHex(foreground),
		primary: primary.primary,
		primaryForeground: primary.primaryForeground,
		secondary: toHex(secondary),
		secondaryForeground: toHex(
			pushUntil(foreground, [secondary], TEXT_CONTRAST, away),
		),
		muted: toHex(muted),
		// Muted text is body text faded toward the page. In light mode, a 42 percent fade ends near or under 4.5:1.
		// pushUntil then darkens it to 4.5:1. In dark mode, a 30 percent fade keeps 5:1 or more, so it does not move.
		mutedForeground: toHex(
			pushUntil(
				mix(foreground, background, isLightMode ? 0.42 : 0.3),
				[...surfaces, muted, secondary],
				TEXT_CONTRAST,
				away,
			),
		),
		accent: toHex(accent),
		accentForeground: toHex(
			pushUntil(foreground, [accent], TEXT_CONTRAST, away),
		),
		destructive: destructive.primary,
		destructiveForeground: destructive.primaryForeground,
		// The border is a 12 to 14 percent step toward the text, and it keeps 1.25:1 on the page at least.
		border: toHex(
			pushUntil(
				mix(background, foreground, isLightMode ? 0.12 : 0.14),
				[background],
				BORDER_CONTRAST,
				away,
			),
		),
		// The field edge is a 20 percent step toward the text, larger than the border step.
		// It has about 1.5:1 on the page, so an empty field shows where to type.
		input: toHex(mix(background, foreground, 0.2)),
		ring: primary.ring,
		success: statusOf(
			isLightMode ? { l: 0.52, c: 0.13, h: 155 } : { l: 0.76, c: 0.14, h: 155 },
		),
		warning: statusOf(
			isLightMode ? { l: 0.56, c: 0.12, h: 65 } : { l: 0.82, c: 0.13, h: 80 },
		),
		info: statusOf(
			isLightMode ? { l: 0.52, c: 0.12, h: 245 } : { l: 0.76, c: 0.11, h: 240 },
		),
		canvas: toHex(canvas),
		// A light shadow is a dark ink of the text hue. A dark shadow is near black, so it shows on a dark page.
		shadowColor: toHex(
			isLightMode
				? { l: 0.25, c: Math.min(foreground.c, 0.04), h: foreground.h }
				: { l: 0.08, c: Math.min(background.c, 0.02), h: background.h },
		),
	};
}

/**
 * A fill with `minimum` contrast on each surface, and a white or near-black label with 4.5:1 on it.
 * `away` is the lightness step that moves the fill away from the surfaces.
 */
function signalPair(
	color: Oklch,
	surfaces: readonly Oklch[],
	minimum: number,
	away: number,
): AppThemePrimaryTokens {
	let fill = pushUntil(color, surfaces, minimum, away);
	let label = labelOf(fill);
	// Near the middle grey both labels stay under 4.5:1. One more step away from the ground fixes one of them.
	while (
		contrastOf(label, fill) < TEXT_CONTRAST &&
		isLightness(fill.l + away)
	) {
		fill = { ...fill, l: fill.l + away };
		label = labelOf(fill);
	}
	const hex = toHex(fill);
	return { primary: hex, primaryForeground: toHex(label), ring: hex };
}

/** White, or a near-black with the hue of the fill: the one with more contrast on the fill. */
function labelOf(fill: Oklch): Oklch {
	const white = { l: 1, c: 0, h: 0 };
	const ink = { l: 0.18, c: Math.min(fill.c, 0.03), h: fill.h };
	return contrastOf(white, fill) >= contrastOf(ink, fill) ? white : ink;
}

/**
 * Moves the lightness of `color` by `step` until it has `minimum` contrast on every surface.
 * It stops at lightness 0 or 1, where black or white has the most contrast that exists.
 */
function pushUntil(
	color: Oklch,
	surfaces: readonly Oklch[],
	minimum: number,
	step: number,
): Oklch {
	let moved = { ...color, l: clamp(color.l, 0, 1) };
	while (
		Math.min(...surfaces.map((surface) => contrastOf(moved, surface))) <
			minimum &&
		isLightness(moved.l + step)
	) {
		moved = { ...moved, l: moved.l + step };
	}
	return moved;
}

/** The lightness step that raises contrast on `ground`: darker on a light ground, lighter on a dark one. */
function awayFrom(ground: Oklch): number {
	return isLight(ground) ? -LIGHTNESS_STEP : LIGHTNESS_STEP;
}

function isLight(color: Oklch): boolean {
	return luminanceOf(color) > MID_LUMINANCE;
}

function isLightness(value: number): boolean {
	return value >= 0 && value <= 1;
}

function readColor(text: string): Oklch {
	const color = parseColor(text);
	if (color === null) {
		throw new Error(
			`The theme color "${text}" is not #rrggbb or oklch(L C H).`,
		);
	}
	return color;
}

function mix(first: Oklch, second: Oklch, weight: number): Oklch {
	// A grey has no hue of its own. It takes the hue of the other color, so the mix does not swing through red.
	const firstHue = first.c < 0.002 ? second.h : first.h;
	const secondHue = second.c < 0.002 ? first.h : second.h;
	const turn = ((secondHue - firstHue + 540) % 360) - 180;
	return {
		l: first.l + (second.l - first.l) * weight,
		c: first.c + (second.c - first.c) * weight,
		h: (firstHue + turn * weight + 360) % 360,
	};
}

function contrastOf(first: Oklch, second: Oklch): number {
	const one = luminanceOf(first);
	const two = luminanceOf(second);
	// The WCAG 2 ratio: (lighter + 0.05) / (darker + 0.05).
	return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

/** The WCAG relative luminance of the color as its hex shows it, 0 to 1. */
function luminanceOf(color: Oklch): number {
	const [red, green, blue] = srgbOf(color).map((channel) =>
		linearOf(Math.round(gammaOf(channel) * 255) / 255),
	);
	// The WCAG 2 luminance weights of red, green, and blue.
	return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

/** The linear sRGB channels (0 to 1) of a color, mapped into sRGB by less chroma when it is outside. */
function srgbOf(color: Oklch): number[] {
	const l = clamp(color.l, 0, 1);
	const exact = linearOfOklch({ ...color, l });
	if (isLinearInGamut(exact)) {
		return exact.map((channel) => clamp(channel, 0, 1));
	}
	let low = 0;
	let high = color.c;
	// 20 halvings find the chroma to 1e-6 of the largest one that fits.
	for (let step = 0; step < 20; step++) {
		const middle = (low + high) / 2;
		if (isLinearInGamut(linearOfOklch({ ...color, l, c: middle }))) {
			low = middle;
		} else {
			high = middle;
		}
	}
	return linearOfOklch({ ...color, l, c: low }).map((channel) =>
		clamp(channel, 0, 1),
	);
}

function isLinearInGamut(channels: number[]): boolean {
	// The tolerance absorbs float error, so a hex color always counts as inside.
	return channels.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);
}

/** OKLCH to linear sRGB, by way of OKLab. */
function linearOfOklch(color: Oklch): number[] {
	const hue = (color.h * Math.PI) / 180;
	const a = color.c * Math.cos(hue);
	const b = color.c * Math.sin(hue);
	const l = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

/** Linear sRGB to OKLCH, by way of OKLab. The hue of a grey is 0. */
function oklchOfLinear([red = 0, green = 0, blue = 0]: number[]): Oklch {
	const l = Math.cbrt(
		0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
	);
	const m = Math.cbrt(
		0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
	);
	const s = Math.cbrt(
		0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
	);
	const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
	const chroma = Math.hypot(a, b);
	return {
		l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		c: chroma,
		h: chroma < 1e-6 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
	};
}

/** The sRGB transfer function (IEC 61966-2-1): a 0 to 1 channel to linear light. */
function linearOf(channel: number): number {
	return channel <= 0.04045
		? channel / 12.92
		: ((channel + 0.055) / 1.055) ** 2.4;
}

/** The inverse of linearOf: linear light to a 0 to 1 channel. */
function gammaOf(channel: number): number {
	return channel <= 0.0031308
		? channel * 12.92
		: 1.055 * channel ** (1 / 2.4) - 0.055;
}

function clamp(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}
