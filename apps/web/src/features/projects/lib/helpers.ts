/**
 * Pure helper functions for the projects feature.
 *
 * Flow position:
 * - useCreateProjectWithPrompt() uses deriveProjectName() before creating a
 *   project so the dashboard can show a readable temporary name immediately.
 * - Project cards use projectTileLook() to color the app tile and the stage,
 *   projectTileGlyph() for the letter on the tile, and shouldShowProjectPreview()
 *   to recover when a newer thumbnail replaces one that failed.
 * - The workspace generation card uses thumbGradient() for its placeholder art.
 * - These helpers do not call the API; they only turn local inputs into display
 *   data.
 *
 * Gotchas:
 * - Project naming is intentionally simple MVP logic, not AI-generated naming.
 * - thumbGradient() and projectTileLook() must stay deterministic, so a card
 *   keeps the same colors after each reload.
 */
import { getCurrentDictionary, getCurrentLocale, translate } from "@/lib/i18n";

/** Connector words (FR/EN/AR transliterations) a name must not end on. */
// These are words that often need another word after them. Dropping them avoids
// names like "Landing Page For" or "Vitrine Pour Salon De".
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
// Exported because the create-project hook needs a friendly name before the API
// returns the new project list data.
export function deriveProjectName(prompt: string): string {
	// Normalize whitespace, keep only the first few words, and let the stopword
	// cleanup below improve the ending.
	const words = prompt
		.trim()
		.replace(/\s+/g, " ")
		.split(" ")
		.filter(Boolean)
		.slice(0, 5);

	// Trim weak ending words only while there is still at least one stronger word
	// left. This protects a one-word prompt from becoming empty.
	while (
		words.length > 1 &&
		TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase())
	) {
		words.pop();
	}

	// Basic title-case is enough for Latin scripts and harmless for scripts that
	// do not have uppercase/lowercase in the same way.
	const name = words
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
	// Empty prompts should already be blocked by the PromptBox/server, but this
	// fallback keeps the helper safe if it is called directly.
	if (!name)
		return translate(
			getCurrentDictionary(),
			"projects.untitled",
			undefined,
			getCurrentLocale(),
		);
	// The ellipsis is visual only; it keeps long prompt snippets from dominating
	// dashboard cards.
	return name.length > 48 ? `${name.slice(0, 48).trimEnd()}…` : name;
}

/** Integer mixer — spreads consecutive seeds across the hue set. */
// Hash-like mixer: nearby numeric seeds should not produce nearly identical
// gradients, so project cards look varied in a grid.
function mix(n: number): number {
	let x = n | 0;
	x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
	x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
	x ^= x >>> 16;
	return x >>> 0;
}

/** Warm-friendly hue set (OKLCH degrees): ambers, corals, roses, mints. */
// OKLCH hue degrees are easier to reason about than raw RGB for this kind of
// generated color palette.
const WARM_HUES = [15, 30, 45, 65, 85, 110, 155, 340] as const;

/**
 * thumbGradient(seed): deterministic diagonal gradient for project
 * thumbnails — hash the stored seed, pick two distinct warm hues, vary
 * lightness slightly so cards never repeat. Returns a CSS background value.
 */
// Exported for the workspace generation card. Same seed in, same CSS gradient out.
export function thumbGradient(seed: number): string {
	const h = mix(seed);
	// Pick the first hue directly from the mixed seed.
	const hue1 = WARM_HUES[h % WARM_HUES.length];
	// Pick a second hue from a different bit range, then force it to differ from
	// the first so the gradient has visible contrast.
	let index2 = (h >>> 3) % WARM_HUES.length;
	if (WARM_HUES[index2] === hue1) index2 = (index2 + 3) % WARM_HUES.length;
	const hue2 = WARM_HUES[index2];
	// Small lightness variations keep repeated hue pairs from looking identical.
	const l1 = (52 + ((h >>> 6) % 12)) / 100; // 0.52–0.63
	const l2 = (32 + ((h >>> 9) % 10)) / 100; // 0.32–0.41
	return `linear-gradient(135deg, oklch(${l1} 0.13 ${hue1}), oklch(${l2} 0.12 ${hue2}))`;
}

/** The colors of one project app tile. Each field is a CSS color. */
export type ProjectTileLook = {
	/** Top-start color of the tile gradient. */
	from: string;
	/** Bottom-end color of the tile gradient. The card stage tint also uses it. */
	to: string;
	/** Color of the letter on the tile. The same as the glyph color of the landing icon. */
	ink: string;
};

// A copy of the 12 looks of APP_ICON_LOOKS in the landing ideas wall. We copy
// and do not import, because the landing icons and the cards can change apart.
const PROJECT_TILE_LOOKS = [
	{ from: "#2a2a2a", to: "#050505", ink: "#e3b55f" },
	{ from: "#ffffff", to: "#e6defe", ink: "#6d4aff" },
	{ from: "#e6ff6b", to: "#a6dc12", ink: "#16181d" },
	{ from: "#fbf3e8", to: "#ead2b2", ink: "#c8553d" },
	{ from: "#3ee0cb", to: "#0c8f80", ink: "#ffffff" },
	{ from: "#2fd27a", to: "#0a7a3f", ink: "#ffffff" },
	{ from: "#5a2bb8", to: "#22094f", ink: "#ff9fe2" },
	{ from: "#ff6aa4", to: "#d9105f", ink: "#ffffff" },
	{ from: "#6fd3ff", to: "#1677ff", ink: "#ffffff" },
	{ from: "#fff6dc", to: "#ffd47a", ink: "#c2410c" },
	{ from: "#ff7a66", to: "#e02f24", ink: "#ffffff" },
	{ from: "#7486ff", to: "#3341d8", ink: "#ffffff" },
] as const satisfies readonly ProjectTileLook[];

/**
 * Picks the app tile colors of a project card from `Project.thumbnailSeed`.
 * The same seed always gives the same look, so a card keeps its colors.
 */
export function projectTileLook(seed: number): ProjectTileLook {
	return PROJECT_TILE_LOOKS[mix(seed) % PROJECT_TILE_LOOKS.length];
}

/**
 * The letter on the app tile of a project card: the first letter or digit of
 * the name, in upper case. "[S1] chat" gives "S". A name with no letter gives "✦".
 */
export function projectTileGlyph(name: string): string {
	// \p{L} and \p{N} match a letter or a digit in every script, Arabic too.
	return name.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? "✦";
}

/** A failed thumbnail only suppresses the exact URL whose request failed. */
export function shouldShowProjectPreview(
	previewImageUrl: string | null,
	failedPreviewImageUrl: string | null,
): boolean {
	return Boolean(previewImageUrl) && previewImageUrl !== failedPreviewImageUrl;
}
