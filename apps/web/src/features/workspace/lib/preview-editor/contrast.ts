// WCAG contrast math + small color helpers for the theme/element panels. The
// editor writes hex, but generated token values may use common CSS functional
// forms; those are normalized for native color-input display and contrast.

type Rgb = { r: number; g: number; b: number };

const clampByte = (value: number) => Math.min(255, Math.max(0, value));

/** Parse #rgb / #rgba / #rrggbb / #rrggbbaa (alpha ignored). Null otherwise. */
export function parseHexColor(value: string): Rgb | null {
	const hex = value.trim();
	if (
		!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
			hex,
		)
	) {
		return null;
	}
	const digits = hex.slice(1);
	const expanded =
		digits.length === 3 || digits.length === 4
			? digits
					.split("")
					.map((digit) => digit + digit)
					.join("")
			: digits;
	return {
		r: Number.parseInt(expanded.slice(0, 2), 16),
		g: Number.parseInt(expanded.slice(2, 4), 16),
		b: Number.parseInt(expanded.slice(4, 6), 16),
	};
}

/** Normalize any accepted hex form to lowercase #rrggbb (alpha dropped) —
 *  the shape the native color input requires. Null for non-hex values. */
export function normalizeHex(value: string): string | null {
	const rgb = parseHexColor(value);
	if (!rgb) return null;
	const channel = (n: number) => n.toString(16).padStart(2, "0");
	return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function rgbChannel(raw: string): number | null {
	const percent = raw.endsWith("%");
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) return null;
	return clampByte(percent ? (value / 100) * 255 : value);
}

function parseRgbFunction(value: string): Rgb | null {
	const body = /^rgba?\((.*)\)$/i.exec(value.trim())?.[1];
	if (!body) return null;
	const channels = (body.split("/")[0] ?? "")
		.replaceAll(",", " ")
		.trim()
		.split(/\s+/);
	if (channels.length < 3) return null;
	const [r, g, b] = channels.slice(0, 3).map(rgbChannel);
	return r === null || g === null || b === null ? null : { r, g, b };
}

function parseAlphaChannel(raw: string): number | null {
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) return null;
	return raw.trim().endsWith("%") ? value / 100 : value;
}

/** True only for explicit zero-alpha colors. Kept separate from
 * cssColorToHex because contrast calculations intentionally flatten alpha,
 * while an inspector read-back must preserve the absence of a background. */
export function isFullyTransparentCssColor(value: string): boolean {
	const trimmed = value.trim().toLowerCase();
	if (trimmed === "transparent") return true;

	const hex = /^#(?:([0-9a-f]{4})|([0-9a-f]{8}))$/i.exec(trimmed);
	const alphaHex = hex?.[1]?.slice(3) ?? hex?.[2]?.slice(6);
	if (alphaHex !== undefined) {
		return (
			Number.parseInt(
				alphaHex.length === 1 ? alphaHex + alphaHex : alphaHex,
				16,
			) === 0
		);
	}

	const body = /^(?:rgba?|hsla?|oklch)\((.*)\)$/i.exec(trimmed)?.[1];
	if (!body) return false;
	const slashAlpha = body.split("/")[1];
	if (slashAlpha !== undefined) {
		return parseAlphaChannel(slashAlpha) === 0;
	}
	const commaChannels = body.split(",");
	return commaChannels.length === 4
		? parseAlphaChannel(commaChannels[3] ?? "") === 0
		: false;
}

function hueDegrees(raw: string): number | null {
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) return null;
	if (raw.endsWith("turn")) return value * 360;
	if (raw.endsWith("grad")) return value * 0.9;
	if (raw.endsWith("rad")) return (value * 180) / Math.PI;
	return value;
}

function parsePercentage(raw: string): number | null {
	if (!raw.endsWith("%")) return null;
	const value = Number.parseFloat(raw);
	return Number.isFinite(value) ? Math.min(1, Math.max(0, value / 100)) : null;
}

function parseHslFunction(value: string): Rgb | null {
	const body = /^hsla?\((.*)\)$/i.exec(value.trim())?.[1];
	if (!body) return null;
	const channels = (body.split("/")[0] ?? "")
		.replaceAll(",", " ")
		.trim()
		.split(/\s+/);
	if (channels.length < 3) return null;
	const hue = hueDegrees(channels[0] ?? "");
	const saturation = parsePercentage(channels[1] ?? "");
	const lightness = parsePercentage(channels[2] ?? "");
	if (hue === null || saturation === null || lightness === null) return null;

	const normalizedHue = ((hue % 360) + 360) % 360;
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const section = normalizedHue / 60;
	const secondary = chroma * (1 - Math.abs((section % 2) - 1));
	const [red, green, blue] =
		section < 1
			? [chroma, secondary, 0]
			: section < 2
				? [secondary, chroma, 0]
				: section < 3
					? [0, chroma, secondary]
					: section < 4
						? [0, secondary, chroma]
						: section < 5
							? [secondary, 0, chroma]
							: [chroma, 0, secondary];
	const offset = lightness - chroma / 2;
	return {
		r: clampByte((red + offset) * 255),
		g: clampByte((green + offset) * 255),
		b: clampByte((blue + offset) * 255),
	};
}

function parseOklchFunction(value: string): Rgb | null {
	const body = /^oklch\((.*)\)$/i.exec(value.trim())?.[1];
	if (!body) return null;
	const channels = (body.split("/")[0] ?? "").trim().split(/\s+/);
	if (channels.length < 3) return null;
	const rawLightness = channels[0] ?? "";
	const parsedLightness = Number.parseFloat(rawLightness);
	const chroma = Number.parseFloat(channels[1] ?? "");
	const hue = hueDegrees(channels[2] ?? "");
	if (
		!Number.isFinite(parsedLightness) ||
		!Number.isFinite(chroma) ||
		hue === null
	) {
		return null;
	}

	const lightness = rawLightness.endsWith("%")
		? parsedLightness / 100
		: parsedLightness;
	const radians = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(radians);
	const b = chroma * Math.sin(radians);
	const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
	const l = lRoot ** 3;
	const m = mRoot ** 3;
	const s = sRoot ** 3;
	const linearToSrgb = (channel: number) =>
		channel <= 0.0031308
			? 12.92 * channel
			: 1.055 * channel ** (1 / 2.4) - 0.055;
	return {
		r: clampByte(
			linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) *
				255,
		),
		g: clampByte(
			linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) *
				255,
		),
		b: clampByte(
			linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) *
				255,
		),
	};
}

/** Common CSS color forms → #rrggbb. Alpha is intentionally ignored because
 * native color inputs and the edit contract are opaque hex. */
export function cssColorToHex(value: string): string | null {
	const direct = normalizeHex(value);
	if (direct) return direct;
	const rgb =
		parseRgbFunction(value) ??
		parseHslFunction(value) ??
		parseOklchFunction(value);
	if (!rgb) return null;
	const channel = (number: number) =>
		Math.round(number).toString(16).padStart(2, "0");
	return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function relativeLuminance({ r, g, b }: Rgb): number {
	const linear = (channel: number) => {
		const c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two hex colors (1–21). Null when either
 *  value is not parseable hex — callers skip the check silently then. */
export function contrastRatio(hexA: string, hexB: string): number | null {
	const a = parseHexColor(hexA);
	const b = parseHexColor(hexB);
	if (!a || !b) return null;
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [darker, lighter] = la < lb ? [la, lb] : [lb, la];
	return (lighter + 0.05) / (darker + 0.05);
}

/** "2.8:1" display form. */
export function formatContrastRatio(ratio: number): string {
	return `${(Math.round(ratio * 10) / 10).toFixed(1)}:1`;
}
