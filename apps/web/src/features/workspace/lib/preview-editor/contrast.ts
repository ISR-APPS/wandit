// WCAG contrast math + small color helpers for the theme/element panels.
// Hex-only on purpose (contract: the panel edits hex; non-hex builder values
// skip the contrast check silently).

type Rgb = { r: number; g: number; b: number };

/** Parse #rgb / #rrggbb / #rrggbbaa (alpha ignored). Null otherwise. */
export function parseHexColor(value: string): Rgb | null {
	const hex = value.trim();
	if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) {
		return null;
	}
	const digits = hex.slice(1);
	const expanded =
		digits.length === 3
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

/** Computed-style `rgb(…)` / `rgba(…)` → #rrggbb (used to seed the element
 *  panel's color input from the iframe's computed styles). */
export function cssColorToHex(value: string): string | null {
	const direct = normalizeHex(value);
	if (direct) return direct;
	const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value.trim());
	if (!match) return null;
	const channel = (raw: string | undefined) =>
		Math.min(255, Number.parseInt(raw ?? "0", 10))
			.toString(16)
			.padStart(2, "0");
	return `#${channel(match[1])}${channel(match[2])}${channel(match[3])}`;
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
