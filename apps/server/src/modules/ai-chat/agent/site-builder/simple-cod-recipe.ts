/**
 * SIMPLE COD mode — the design authority that replaces design worlds.
 *
 * The simple mode exists because most merchants want the proven, clean COD
 * page (the classic Algerian one-column funnel), not an art-directed world.
 * Two pieces ship together in the designer-prompt snapshot:
 *
 * 1. SIMPLE_COD_STYLE_DOC — the permanent style law modeled on the
 *    highest-converting simple COD pages (hero → product-specific supports →
 *    form → optional post-form reassurance, one accent color, one simple
 *    Arabic family, uniform rounded cards).
 * 2. sampleSimpleCodRecipe() — a server-side sampled recipe (surface, accent
 *    family, fonts, radius, card style, hero layout, trust strip, structure)
 *    so two merchants never receive the same-looking page. Sampled at queue
 *    time and snapshotted into the attempt spec, exactly like world docs are.
 *
 * Brand facts still win: a brief's BRAND ASSETS colors override the sampled
 * accent, and user product photos steer the palette temperature.
 */

export const SIMPLE_COD_STYLE_DOC = `# SIMPLE COD STYLE — DESIGN AUTHORITY

No design-world document follows. This style document is the DESIGN AUTHORITY
for this build. The COD genre law above stays law for selling anatomy, form
canon, locale facts and engineering. The sampled STRUCTURE plan replaces its
generic block-order, CTA-frequency, price-repetition, and tail defaults. Where
the genre's aesthetic guidance assumes a design world (vessels, ornament
families, motion identities, ceremony density), THIS document wins. The build
recipe below it supplies this build's sampled values — commit to them.

## The look (the proven simple funnel)
One clean, calm, single-column funnel that a phone buyer scans in seconds.
The page looks like a well-made store page, not an art project: neutral
ground, ONE accent color doing every important job, uniform rounded cards
with quiet borders, one simple Arabic font family, honest product photos.
Restraint is the style: white space is functional, never theatrical.

- Column: mobile-first, one column, content capped around 42rem (about
  672px) and centered. On desktop the column may relax to about 720-840px;
  a supporting two-up grid (benefit cards, gallery pairs) is allowed at
  768px+. Never a 12-column editorial grid, never sidebars.
- Surfaces: the RECIPE names the surface pole (light, dark, or tinted).
  Cards sit one visible step off the ground (recipe card treatment). Section
  seams are simple: a hairline border or spacing — never sculpted dividers,
  waves, or ornament bands.
- The accent works everywhere it matters and nowhere else: new price, primary
  CTA, selected bundle, focus rings, section lead-ins, trust icons, the
  discount badge. Soft accent surfaces are the signature: accent at about
  8-12% for chip/badge fills with an accent 20-30% border — that pill reads
  "offer" instantly.
- Icon-and-text cards ARE the style for benefits and trust rows (this
  overrides the genre's uniform-icon-row caution): 3-4 cards, each one icon +
  one bold claim + one concrete sentence. The card GRID is uniform; the
  CONTENT of each card must be specific (a number, a material, a use-case) —
  empty claims stay banned.
- Photos are shown big and honest inside the card system: full-width rounded
  image cards with a 1px border and the discount badge overlaid on the hero
  shot. Gallery shots get one-line concrete captions.

## Typography (simple by law)
- ONE Arabic family from the recipe serves BOTH heading and body roles;
  weight does the hierarchy (heading 700-800, body 400-500). Latin pages use
  the recipe's Latin family the same way. Both token stacks may name the same
  family — that sameness IS the simple look.
- No display serifs, no calligraphic faces, no decorative Arabic faces.
  Sizes stay modest: hero H1 about 1.5-1.9rem on mobile; section titles about
  1.15-1.35rem. Prices are the loudest numerals on the page.

## The blocks, the simple way
- hero: always carries brand/product identity, one concrete promise, the main
  product photo, struck-old + large-new price, a full-width primary CTA, and
  2-3 factual trust items. The recipe's HERO order places that complete
  payload; the STRUCTURE signature may move its trust treatment into a price
  card but never removes any payload.
- announcement-bar: slim brand/product line with one factual delivery pill.
  It is chrome, not a counted content block.
- problem-solution: one emotional beat — one pain headline, then the product
  as the answer beside the strongest supplied photo. With weak photos, use a
  text-led card and one honest image; never fabricate a designed poster.
- benefits-icons: 3-4 uniform cards as above.
- ingredients-infographic: HTML feature captions and leader lines around the
  supplied product image. Never bake labels into an image; when no parts can
  be annotated, use a compact spec-table.
- how-it-works-steps: 3 numbered steps from brief facts, one concrete action
  per step.
- spec-table: one compact factual table or key-value list for size, material,
  contents, compatibility, or use. One card, no invented specifications.
- unboxing-gallery: 2-3 supplied demo photos in captioned cards. Each caption
  is one concrete line; when fewer than 2 usable photos exist, use
  how-it-works-steps.
- photo-reviews / variant-gallery: image cards with concrete captions; only
  supplied photos and supplied reviews.
- price-anchor: one full offer-recap card — struck-old + large-new price,
  included items, and only a real gift or offer fact from the brief.
- cross-sell: a gift-with-purchase showcase only when the brief supplies a
  real gift. It is not permission to invent an add-on or bonus.
- bundle-offers: never a standalone block. Put radio bundle cards (1x / 2x /
  3x), or a quantity stepper, FIRST inside order-form and synchronize them
  with the form total and sticky bar.
- order-form: the climax card. It may carry a slightly stronger border or the
  accent as a top rule. Stacked labeled fields, generous touch targets
  (inputs at least 48px tall), the genre's form canon in full, submit button
  restating the total. The phone field carries the flag and the +213 prefix
  chip inside its input group, as quiet chrome on the field's leading edge —
  decorative only, the typed value is submitted raw. On success the form card
  is replaced in place by an accent check, a thank-you line, the order
  number, the 3-row recap, and the call-you line with the supplied delivery
  window.
- faq: native <details> items inside cards — 3-5 questions max. It may sit
  after the form as the closing trust band.
- sticky-cta: slim fixed bottom bar (price + CTA) obeying the genre's triple
  law.
- trust-footer: one quiet line — brand, year, the supplied contact.

## Copy — e-commerce selling copy
Write like a top Algerian e-commerce seller: warm darija-flavored Arabic (or
the brief's language), second person, short sentences that push toward the
order. Benefit before feature, number before adjective. Repeat the price and
"الدفع عند الاستلام" naturally. Headlines promise the outcome; body lines
prove it with a concrete fact from the brief. Never corporate filler, never
invented claims, never empty superlatives.

## Simple ban list
Glassmorphism · gradient text or purple-blue gradient washes · decorative SVG
ornament systems · background patterns and textures · parallax, pinned or
scrubbed scenes · GSAP or any external script · multi-column editorial
desktop layouts · carousels · more than 6 content blocks · more than one
accent color · display/serif/calligraphic fonts · whitespace-as-luxury
pacing · any invented urgency, review, badge, or fact.

## Motion — nearly none
Hover/active states on buttons and cards, focus-visible rings, smooth scroll
to the form, ONE soft once-only reveal (opacity/translate about 0.3-0.5s) at
most, and the sticky bar's show/hide. Everything else stays still. All of it
is plain CSS plus the small vanilla JS the funnel needs; prefers-reduced-
motion turns reveals instant.`;

// ---------------------------------------------------------------------------
// The sampled recipe
// ---------------------------------------------------------------------------

type RecipeLever<T> = readonly (readonly [T, number])[];

/** Weighted pick: weights are relative, not required to sum to 1. */
function pick<T>(lever: RecipeLever<T>): T {
	const total = lever.reduce((sum, [, weight]) => sum + weight, 0);
	let roll = Math.random() * total;

	for (const [value, weight] of lever) {
		roll -= weight;

		if (roll <= 0) {
			return value;
		}
	}

	// Unreachable with positive weights; satisfies the compiler honestly.
	return (lever[lever.length - 1] as readonly [T, number])[0];
}

export type SimpleCodSkeleton = {
	name: string;
	weight: number;
	/** Counted content blocks in order. First is hero; order-form is last or near-last. Chrome is excluded. */
	blocks: readonly string[];
	/** Law-toned top bar, corridor, CTA cadence, tail, and fallback lines. */
	plan: string;
};

export const SIMPLE_COD_SKELETONS: readonly SimpleCodSkeleton[] = [
	{
		name: "classic-funnel",
		weight: 28,
		blocks: ["hero", "benefits-icons", "unboxing-gallery", "order-form"],
		plan: `  TOP BAR: Sticky slim brand bar with a small anchor pill CTA to #order-form.
  unboxing-gallery: 2-3 captioned product demo photo cards. Supplied photos only; use one concrete caption per card.
  FALLBACK: With fewer than 2 usable photos, replace unboxing-gallery with how-it-works-steps — 3 numbered steps from brief facts.
  CTA CADENCE: Hero CTA + top-bar pill + bottom sticky bar + form submit. No other mid-page CTAs.
  TAIL: One-line trust-footer.`,
	},
	{
		name: "poster-funnel",
		weight: 20,
		blocks: ["hero", "problem-solution", "benefits-icons", "order-form", "faq"],
		plan: `  TOP BAR: Slim brand-only bar, dark or accent-tinted, with the logo or wordmark centered.
  problem-solution: One emotional beat — the pain in one headline, then the product as the answer over or beside the strongest supplied photo. Never fabricate a designed poster.
  FALLBACK: With weak photos, render problem-solution as a text-led card with one supplied image.
  faq: Place it AFTER order-form as the closing band. Use 3-5 native details items for COD, inspect-before-pay, delivery time, and exchange terms supported by brief facts. It doubles as the trust footer.
  CTA CADENCE: No inline CTAs between hero and form. The bottom sticky bar carries the journey.
  TAIL: The post-form faq band is the tail. No separate footer.`,
	},
	{
		name: "offer-metronome",
		weight: 16,
		blocks: [
			"hero",
			"benefits-icons",
			"spec-table",
			"price-anchor",
			"order-form",
		],
		plan: `  TOP BAR: Announcement bar with the product name and one 58-wilaya delivery-coverage pill.
  spec-table: One compact factual table or list from brief facts — size, material, contents, and usage — inside one card.
  price-anchor: A full offer-recap card immediately before the form: struck-old + new price, what is included, and any REAL gift or offer fact from the brief. Invented urgency stays banned.
  CTA CADENCE: METRONOME — every support block ends with the same full-width CTA and an identical one-line price recap subline.
  TAIL: Hard stop after the form success/footer line. At most one quiet legal line.`,
	},
	{
		name: "technical-catalog",
		weight: 16,
		blocks: [
			"hero",
			"ingredients-infographic",
			"unboxing-gallery",
			"order-form",
		],
		plan: `  TOP BAR: Announcement bar with one factual delivery pill.
  ingredients-infographic: HTML captions and leader lines annotate the supplied product image. Never bake text into images.
  FALLBACK: When the product has no annotatable parts, replace ingredients-infographic with spec-table.
  unboxing-gallery: Use the classic-funnel treatment — 2-3 supplied demo photos with one concrete caption each.
  FALLBACK: With fewer than 2 usable photos, replace unboxing-gallery with how-it-works-steps — 3 numbered steps from brief facts.
  HERO SIGNATURE: Use the PRICE CARD treatment regardless of the HERO roll's trust-chip placement. Price, struck old price, COD note, and 2-3 trust chips live inside one card.
  CTA CADENCE: Hero CTA + bottom sticky bar + form submit only.
  TAIL: Minimal one-line trust-footer.`,
	},
	{
		name: "variant-lookbook",
		weight: 12,
		blocks: ["hero", "variant-gallery", "benefits-icons", "order-form"],
		plan: `  TOP BAR: None. Keep the required brand badge inside hero.
  variant-gallery: Show the color or model set as selectable image cards. Selection scrolls to and preselects the form's variant field.
  GATE: This skeleton assumes 3+ visually distinct supplied variant photos.
  FALLBACK: With fewer than 3 visually distinct supplied variant photos, replace variant-gallery with unboxing-gallery using captioned demo photos.
  CTA CADENCE: Hero CTA + bottom sticky bar + form submit only.
  TAIL: One-line trust-footer.`,
	},
	{
		name: "proof-minimal",
		weight: 8,
		blocks: ["hero", "cross-sell", "photo-reviews", "order-form"],
		plan: `  TOP BAR: None. Keep the required brand badge inside hero.
  HERO EYEBROW: A numeric social-proof eyebrow is legal ONLY when the brief supplies the real number. Otherwise use the standard badge.
  cross-sell: A free-gift or with-purchase showcase ONLY when the brief supplies a real gift.
  FALLBACK: Without a real gift, replace cross-sell with benefits-icons.
  photo-reviews: Use ONLY real reviews and photos supplied in the brief.
  FALLBACK: Without real reviews or review photos, replace photo-reviews with faq BEFORE the form.
  CTA CADENCE: Deliberately sparse — hero CTA + bottom sticky bar + form submit only.
  TAIL: One-line trust-footer.`,
	},
];

const STRUCTURES: RecipeLever<SimpleCodSkeleton> = SIMPLE_COD_SKELETONS.map(
	(skeleton) => [skeleton, skeleton.weight] as const,
);

// Light dominates on purpose: the proven simple COD pages are mostly light.
const SURFACES: RecipeLever<string> = [
	[
		"LIGHT — near-white ground (a barely-warm or barely-cool off-white, never pure #fff), near-black ink, white cards.",
		55,
	],
	[
		"DARK — deep neutral ground (a very dark blue-gray or warm charcoal, never pure #000), off-white ink, cards one step lighter than the ground.",
		25,
	],
	[
		"TINTED — a soft wash of the accent family as the ground (about 4-8% tint over off-white), dark ink, white cards; the tint makes the page feel branded without loudness.",
		20,
	],
];

// Every family ships example anchors so the builder lands in the intended
// register; the brief's brand colors and the product photos still outrank
// these. No violet/purple family on purpose (house rule).
const ACCENT_FAMILIES: RecipeLever<string> = [
	["TEAL family (around #00A88F / #0D9488)", 1],
	["EMERALD family (around #059669 / #16A34A)", 1],
	["ORANGE family (around #EA580C / #F97316)", 1],
	["WARM RED family (around #DC2626 / #E11D48)", 1],
	["ROYAL BLUE family (around #2563EB / #1D4ED8)", 1],
	["AMBER-GOLD family (around #D97706 / #B45309)", 1],
	["ROSE family (around #E11D48 / #DB2777)", 1],
	["CYAN family (around #0891B2 / #0E7490)", 1],
];

// The simple Arabic faces merchants already trust on classic COD pages.
const ARABIC_FONTS: RecipeLever<string> = [
	["Cairo", 3],
	["Tajawal", 3],
	["Almarai", 2],
	["IBM Plex Sans Arabic", 2],
	["Rubik", 1],
];

const LATIN_FONTS: RecipeLever<string> = [
	["Poppins", 2],
	["DM Sans", 2],
	["Manrope", 2],
	["Nunito Sans", 1],
];

const RADII: RecipeLever<string> = [
	["0.75rem", 3],
	["1rem", 4],
	["1.25rem", 3],
];

const CARD_STYLES: RecipeLever<string> = [
	[
		"HAIRLINE BORDER — every card is a quiet 1px border (border token) on the card surface, no shadow.",
		4,
	],
	[
		"SOFT SHADOW — cards carry a soft small shadow and a barely-visible border; the form card's shadow is one step stronger.",
		3,
	],
	[
		"FLAT DIVIDED — cards are flat surface shifts separated by hairline rules; the accent appears as a thin top rule on key cards.",
		3,
	],
];

const HERO_LAYOUTS: RecipeLever<string> = [
	[
		"PRICE CARD — badge, H1, one-line subtitle, product photo card with discount badge, then a self-contained price card (new + struck old + COD line + 2-3 trust chips inside the card), full-width CTA.",
		3,
	],
	[
		"RECAP CLOSE — two-line H1 (second line accent), product photo card, struck-old + large-new price row, offer chip, full-width CTA, then a one-line price recap under the CTA.",
		3,
	],
	[
		"IMAGE FIRST — product photo card opens the hero, then eyebrow chip, H1, subtitle with the price woven in as prose (struck old beside it), 2-3 checkmark trust lines, full-width CTA.",
		3,
	],
	[
		"TRUST EYEBROW — trust/social eyebrow pill, H1, trust chip row, product photo card, price row, full-width CTA.",
		1,
	],
];

const TRUST_STRIPS: RecipeLever<string> = [
	[
		"ICON ROW — one 3-column row of icon + short label cells, divided by hairlines.",
		4,
	],
	[
		"PILL BADGES — 2-3 soft accent chips (accent tint fill + accent border) in a wrapped row.",
		3,
	],
	[
		"CHECKLIST — a tight vertical list of check-icon + one-line facts inside one card.",
		3,
	],
];

/**
 * Sample one build's recipe. Called once at queue time by generate_page and
 * snapshotted into the attempt spec, so a retry of the same attempt replays
 * the same recipe while a fresh generation rolls new dice.
 */
export function sampleSimpleCodRecipe(): string {
	const structure = pick(STRUCTURES);

	return `# THIS BUILD'S RECIPE (server-sampled — commit to it)

Execute the SIMPLE COD STYLE with exactly these sampled values. The brief's
BRAND ASSETS outrank the sampled accent: when the user gave brand colors, or
the product photos clearly own a color, anchor the accent there and keep the
rest of the recipe. Never re-roll or average the levers.

- SURFACE: ${pick(SURFACES)}
- ACCENT: ${pick(ACCENT_FAMILIES)} — instantiate ONE exact accent hex from this family (tuned to the surface for contrast) and derive its tints/borders with color-mix.
- ARABIC FONT: "${pick(ARABIC_FONTS)}" for BOTH --font-heading and --font-body (weights make the hierarchy).
- LATIN FONT: "${pick(LATIN_FONTS)}" for Latin-language pages and Latin numerals when the Arabic face lacks them.
- RADIUS: --radius: ${pick(RADII)}.
- CARDS: ${pick(CARD_STYLES)}
- HERO: ${pick(HERO_LAYOUTS)}
- TRUST STRIP: ${pick(TRUST_STRIPS)}
- STRUCTURE: ${structure.name}
  COUNTED BLOCKS: ${structure.blocks.join(" → ")}.
${structure.plan}

STRUCTURE LAWS FOR EVERY ROLL:
- Bundles and quantity offers NEVER render as a standalone block. Radio bundle cards, or a quantity stepper, live FIRST inside order-form and stay synchronized with totals and the sticky bar. When SECTIONS lists bundle-offers, fold it into the form.
- Chrome does not count toward the 4-6 block law. Top/announcement bar, sticky-cta, and a one-line trust-footer are chrome. Count hero, supports, order-form, and any post-form content band such as faq.
- The bottom sticky bar and its triple law stay MANDATORY. A classic-funnel top-bar pill is additional chrome, never a replacement.
- Every skeleton inherits reference ORDER only. Every hero still carries identity, promise, product, struck-old + new price, CTA, and trust chips.`;
}
