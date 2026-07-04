import { getCurrentDictionary, getCurrentLocale, translate } from "@/lib/i18n";

/** Connector words (FR/EN/AR transliterations) a name must not end on. */
const TRAILING_STOPWORDS = new Set([
	"de",
	"du",
	"des",
	"la",
	"le",
	"les",
	"un",
	"une",
	"pour",
	"avec",
	"et",
	"à",
	"au",
	"aux",
	"en",
	"sur",
	"a",
	"an",
	"the",
	"for",
	"with",
	"and",
	"of",
	"to",
	"in",
	"on",
]);

/**
 * deriveProjectName(prompt): short human name from the first prompt
 * (MVP naming — AI-suggested names post-MVP). Takes the first ~5 words,
 * drops trailing connector words so names don't end mid-phrase
 * ("Vitrine Pour Salon De" → "Vitrine Pour Salon"), title-cases them
 * (a no-op for Arabic script) and caps the length.
 */
export function deriveProjectName(prompt: string): string {
	const words = prompt
		.trim()
		.replace(/\s+/g, " ")
		.split(" ")
		.filter(Boolean)
		.slice(0, 5);

	while (
		words.length > 1 &&
		TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase())
	) {
		words.pop();
	}

	const name = words
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
	if (!name)
		return translate(
			getCurrentDictionary(),
			"projects.untitled",
			undefined,
			getCurrentLocale(),
		);
	return name.length > 48 ? `${name.slice(0, 48).trimEnd()}…` : name;
}

/** Integer mixer — spreads consecutive seeds across the hue set. */
function mix(n: number): number {
	let x = n | 0;
	x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
	x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
	x ^= x >>> 16;
	return x >>> 0;
}

/** Warm-friendly hue set (OKLCH degrees): ambers, corals, roses, mints. */
const WARM_HUES = [15, 30, 45, 65, 85, 110, 155, 340] as const;

/**
 * thumbGradient(seed): deterministic diagonal gradient for project card
 * thumbnails — hash the stored seed, pick two distinct warm hues, vary
 * lightness slightly so cards never repeat. Returns a CSS background value.
 */
export function thumbGradient(seed: number): string {
	const h = mix(seed);
	const hue1 = WARM_HUES[h % WARM_HUES.length];
	let index2 = (h >>> 3) % WARM_HUES.length;
	if (WARM_HUES[index2] === hue1) index2 = (index2 + 3) % WARM_HUES.length;
	const hue2 = WARM_HUES[index2];
	const l1 = (52 + ((h >>> 6) % 12)) / 100; // 0.52–0.63
	const l2 = (32 + ((h >>> 9) % 10)) / 100; // 0.32–0.41
	return `linear-gradient(135deg, oklch(${l1} 0.13 ${hue1}), oklch(${l2} 0.12 ${hue2}))`;
}
