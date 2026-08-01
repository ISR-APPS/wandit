import type { DesignWorld } from "../types";

export const viral: DesignWorld = {
	id: "viral",
	name: "Viral",
	family: "creator-merch",
	tagline: "Creator-drop energy: split screens and caption pills",
	kind: "cod",
	mood: ["viral", "cut", "bold", "young"],
	energy: "loud",
	priceFeel: "accessible",
	industries: [
		"electronics & gadgets",
		"fashion & apparel",
		"beauty & cosmetics",
	],
	avoidFor: ["home & kitchen", "pets", "jewelry & watches"],
	fusesWith: ["trottoir", "manette", "mixtape"],
	preview: {
		ground: "#101013",
		ink: "#FFFFFF",
		accent: "#D8F34E",
		fontFamily: "Archivo Black",
		sampleWord: "CLIP",
	},
	doc: `
VIRAL — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Viral is the creator drop: the page edited like a video that blew up last night. Hard cuts, no dissolves. Two colors slammed against each other. Sentences chopped into fragments and stacked as pills, the way captions land over a talking head. Proof that reads like a mentions tab, not like a testimonial column. This world sells to buyers who scroll ninety clips before breakfast and can smell corporate from the first frame — so the page must feel AUTHORED, quick, a little cocky, and absolutely never like a template with a logo swapped in.

The discipline underneath the noise: Viral never draws phone UI. No fake status bars, no fake app chrome, no mock dashboards — the ENERGY of social video is translated into print language: pills, splits, tags. That translation is the taste test. Done right, the page feels like a poster cut by an editor; done wrong it becomes a screenshot cosplay, and screenshot cosplay is banned. The spine stays invisible and absolute — hook, convince, offer, order form — because virality is the costume; the skeleton is still a seller that wants a name, a phone and a wilaya.

Copy is written in cuts. Fragments over sentences. Verbs over adjectives. The reader is "tu", never "vous", in French builds; direct address always. One joke maximum per page — one lands, two beg.

Self-audit before shipping:
- Is every headline moment built from stacked caption pills, not plain heading text?
- Does at least one section split into two hard color halves with content straddling the seam?
- Is the proof dressed as @-tags, not as classic review cards with stars-and-borders?
- Zero drawn phone UI anywhere — no status bars, no chat chrome, no fake apps?
- Exactly ONE duo (ink + one accent + white) — no third hue leaking in?
- Do all cuts land in 0.25s or less with zero easing tails?
- Could the price, the offer and the delivery promise be quoted after one scroll?
- Fully readable with JavaScript off, zero overflow at 390/768/1440?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The edit never reorders the story.
- Palette: ink #101013 + white #FFFFFF + ONE accent chosen from lime #D8F34E, tangerine #FF7A3D or lilac #C9B8FF. One duo per build, held everywhere.
- Type stacks: Latin display Archivo Black or Space Grotesk 700; body Inter. Arabic display Changa 800; body Almarai.
- The three owned tics: caption pills, split-screens, @-tag proof chips.
- Motion identity "jump cut": 0.25s hard cuts, caption pills stagger once in the hero.
- Desktop law: centered mobile shell (~430px) — the vertical-video shape IS the brand.
- Refused blocks: delivery-map, press-badges.
- Imagery: hard split-color studio photography per Signature Art.

CLIENT-OWNED — re-decided fresh for every build:
- Hero composition from the hero menu.
- Block choice within the supported set and the block ORDER — a gadget drop and an apparel drop cut differently.
- Form style from the form menu.
- Which accent of the three duos this brand wears.
- Proof emphasis: @-tag wall, stats-band, or photo-reviews dressed as tags.
- Density: a 9-block sprint or a 13-block full edit.
Every client gets a new cut, never someone else's export. Same hero + same block order + same form as a previous build = failed render.

3. VISUAL SIGNATURES

Measured values:
- Grounds: ink #101013 and pure white #FFFFFF as slabs; the accent as a third slab used sparingly (max one accent-ground section per build).
- Ink on white: #101013. Ink on dark: #FFFFFF. Secondary text: 62% opacity of the ink color. No grays as hues — only opacity steps.
- Accent duos: lime #D8F34E (default), tangerine #FF7A3D, lilac #C9B8FF. Accent carries: pills, seams, CTA fill, tag brackets, underlines. Accent NEVER carries body text.
- Display: clamp(30px, 8.5vw, 46px) Archivo Black, line-height 1.02, tracking -0.01em; caps for Latin. Arabic display Changa 800 at 92% of the clamp, no tracking ever.
- Caption pills (tic): each fragment in its own pill — padding 10px 18px, radius 999px, font display at clamp(17px, 4.6vw, 22px); pills alternate white-on-ink and accent-on-ink (ink text); stack offset: each pill indents 12-20px from the previous, alternating sides. Max 4 pills per stack.
- Split-screens (tic): a section cut vertically OR horizontally into exactly two halves (ink half + white half, or accent half + ink half); the seam is hard, 0px blur, and one element (product image, price chip or pill stack) straddles it, centered on the seam. On 390px, vertical splits become stacked halves with the straddling element overlapping the boundary.
- @-tag chips (tic): proof rendered as chips [ @nom_ville ] in mono-spaced brackets — Space Grotesk 600 — with a small solid triangle play glyph before the handle; quote beneath in body type, no star rows, no card borders; chips sit on hairline rules.
- Radii: 999px pills, 12px on media blocks, 0px on split seams and slabs.
- Borders: none on cards (slabs separate by color); 1.5px ink outline allowed on the accent CTA only.
- Shadows: none. Depth is color collision.
- Spacing: sections clamp(56px, 14vw, 84px); pill stacks tight at 8px gaps.

4. COLOR PHYSICS

Ground register: #101013 and #FFFFFF alternate as hard slabs — the page reads as an edit timeline of dark and light cuts. The accent may ground AT MOST one section per build (the offer or the drop moment). Ink register: #101013 / #FFFFFF full strength; 62% opacity for secondary lines; 40% for legal only. Accent physics: exactly one accent per build; it must appear in the first viewport (a pill or the CTA), at the offer, and on the sticky bar — nowhere else is it entitled. Coverage cap ~15% of any viewport except the single accent-ground section. Forbidden: gradients of any kind, a second accent hue, grays as colors, pastel softening, glow effects, and the classic AI slop set (purple-blue gradients on white, glassmorphism, emoji-as-design). Form errors: #FF4438, form-internal only.

5. TYPOGRAPHY

Latin stack. Display: Archivo Black first — its blunt weight IS the caption voice; Space Grotesk 700 as the alternative when the client's name needs tech sharpness. Body: Inter 400/600. Numbers tabular in stats and prices. Latin caps on display; body sentence-case.
Arabic stack. Display: Changa 800 — condensed, loud, cuts well into pills; body Almarai 400/700. NEVER letter-spacing on Arabic; Arabic display at 92% of Latin clamps; Arabic body line-height 1.75-1.9.
Pairing rule: one display + Inter/Almarai body; the display face owns pills, prices, section kickers; body owns everything else. RTL builds: pill stacks indent from the right, splits mirror, the straddling element stays centered on the seam; digits Western Arabic; phone numbers wrapped LTR.

6. SIGNATURE ART AND COMPONENTS

The caption pill stack is the voice: every section opens with 2-4 stacked pills instead of a plain heading — fragment one states the hook, fragment two lands the point, an optional third carries the number ("-30% AUJOURD'HUI"). The split-screen is the stage: the hero or the offer cuts the viewport into two slabs, and the product photo or price chip sits ON the seam, half in each world. The @-tag chips are the crowd: a wall or column of bracketed handles with play triangles, each with one blunt quote — the page's applause.

Supporting cast: price chips (display type in an accent pill, old price struck in ink 62%); kicker lines (10-11px caps, tracked 0.14em Latin only, "DROP 004 / ALGER"); hairline rules (1px, ink at 20%) separating tag rows; the CTA as a full-width accent slab with ink text and 1.5px ink outline; stat numbers in display type with pill labels. Icons: none — Viral uses words and glyph triangles only.

Imagery. Hard split-color studio photography: the product shot on a two-tone set (accent panel + ink panel), harsh even light, zero softbox romance, deep crisp shadows, product held or arranged at graphic angles; crops are tight and confident; at least one image straddles its section seam. For apparel: torso/hands only, no faces. Color-grade: whites clean, accent saturated to match the build's duo. Banned in photos: lifestyle clutter, golden-hour warmth, bokeh, marble props, anything that whispers when the page shouts.

7. THE SPINE

Hook, convince, offer, order form — invisible and untouchable. Viral's preferred price placement: FIRST PRICE IN THE HERO, inside a caption pill (the price IS content here); the sticky bar repeats it. Sticky CTA: a full-width bottom bar, ink ground, accent CTA slab with the price baked into the label ("COMMANDER — 5 400 DA"); appears after the hero cut, always reachable, taps scroll to the form. Mobile-first at 390px; desktop law: centered mobile shell at ~430px on an ink ground with the accent as a thin page-edge line left and right — the vertical-video silhouette, held proudly.

8. BLOCKS TREATMENT

Supported blocks, dressed by Viral:
- announcement-bar: one ink strip, one fragment ("LIVRAISON 58 WILAYAS — CASH À LA PORTE"), display type at 12px caps. No rotation, no ticker.
- hero: pill stack + split or straddle composition + price pill + CTA. The first cut decides the sale.
- benefits-icons: no icons — benefit FRAGMENTS as a pill wall (2-column pill grid), each pill one gain, alternating fills.
- how-it-works-steps: three cuts numbered 01/02/03 in display type, each step one fragment + one tight photo; steps separated by hairlines, not cards.
- stats-band: an ink slab with 3 display numbers in accent + pill labels ("12K COMMANDES", "4.8/5", "48H CHRONO").
- photo-reviews: dressed as @-tag chips with quotes; optional small square photos, 12px radius, no borders.
- whatsapp-proof: allowed but translated — screenshots are NOT drawn; the messages become @-tag chips with time-stamps in mono. No chat bubbles, no app chrome.
- variant-gallery: variants as accent-outlined pills (S/M/L or colors as ink swatch dots inside pills), selected pill fills accent.
- bundle-offers: two or three offer slabs (SOLO / DUO / SQUAD), the featured one on the accent ground; per-unit math in mono.
- countdown: a single pill with mono digits ("FIN DU DROP 04:12:33"), blinking nothing; sits under the offer, never in the hero.
- stock-urgency: one fragment pill ("RESTE 37 KITS") in accent outline; honest numbers only.
- price-anchor: the split-screen moment — old price on the ink half struck, new price straddling the seam in a giant accent pill, savings fragment beneath.
- cross-sell: one add-on slab with a checkbox pill ("+ MICRO CRAVATE +900 DA") feeding the form total.
- order-steps: four fragments in a pill column (COMMANDE → APPEL → LIVRAISON → CASH), arrows as solid triangles.
- faq: hairline accordion, question in display 16px, answer in body; no boxes.
- trust-footer: ink slab, brand fragment, phone huge in display type, WhatsApp line, legal at 40%.
- order-form: see form menu.

Refused blocks:
- delivery-map: maps are geography homework; Viral states "58 wilayas" in one pill and moves on.
- press-badges: borrowed logos are corporate cosplay; the @-wall IS the authority.

9. HERO MENU

- The Cold Open: full ink slab, 3-pill caption stack, price pill, CTA — no image until section two. For products whose name alone pulls.
- The Seam Stand: vertical split (accent | ink), product photo standing ON the seam, pills on the light half, price + CTA on the dark half.
- The Straddle Drop: white ground, giant product image center, one accent pill stack overlapping the image's bottom edge, CTA beneath; kicker line above ("DROP 004 — ALGER").
- The Stacked Cut: horizontal split — top half ink with pills, bottom half white with image + price + CTA; the product overlaps the horizon line.
- The Tag Storm: hero where 3 @-tag chips float around the product ("déjà 12K créateurs"), pills beneath, CTA in accent; proof-first for known products.
- The Price Slam: the price IS the hero — a massive accent pill with the number, product photo small and tilted beside it, one fragment above, CTA below. For aggressive offers.

10. FORM MENU

- The Checkout Cut (single card): one ink-outlined white slab, fields stacked, labels in display 12px caps, accent CTA; COD reassurance as three fragment pills under the button.
- The Two-Take (2-step wizard): take 01 — bundle/variant pills; take 02 — nom/téléphone/wilaya; progress shown as 01/02 in display type. Hard cut between takes.
- The Echo Pill (hero-echo): a single phone-field pill + CTA directly under the hero ("On t'appelle. 30 sec.") that scrolls to the full form at the end; full form is the Checkout Cut.
- The Bar Take (sticky-driven): the sticky bar is the only CTA until the form; tapping it hard-cuts (no smooth scroll under 0.25s? — smooth scroll allowed but fast) to the form with the first field focused.

11. MOTION IDENTITY

Jump cut. Everything enters in 0.25s or less, ease "power4.out" truncated — no bounce, no overshoot, no easing tails visible. Caption pills land one-by-one (0.08s stagger) ONCE in the hero: that is the signature moment, never repeated elsewhere. Splits do not animate their seams; content inside cuts in. @-tag chips appear in two quick batches, not one-by-one. The countdown updates without animation. Reduced motion: everything static, pills pre-landed. Banned: parallax, floats, loops of any kind, scroll-scrubbing, typewriter effects, and anything longer than 0.3s.

12. BAN LIST

Generic slop: purple-blue gradients on white, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trustpilot walls, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics banned by name: iris's drawn mock-UI product panels and aurora-hairline gradient capsule (Viral draws ZERO interface chrome); eclat's photo-orbit statement; affiche's poster-color full-section rotation — Viral splits sections in two, it never rotates whole grounds through a palette; manifeste's black/white inversion flips and words-as-layout; gloss's smear swatch bars and vanity bulbs; tendance's code-switch headline (Viral fragments, it never embeds Latin names in Arabic syntax as a device); trottoir's courier labels and receipt rail; manette's RGB conic sweeps.
Viral's own temptations, banned: drawing a fake phone, a third color, star-rating rows, more than four pills in a stack, two jokes, italic type anywhere, soft shadows to "help" the splits.
Refused blocks restated: delivery-map, press-badges.

13. EXAMPLE VARIATIONS

- "Kit Créateur 004" — electronics & gadgets. The Seam Stand hero (lime duo); order: announcement, hero, stats-band, benefits pill wall, how-it-works 3 cuts, @-tag wall, price-anchor split, cross-sell, countdown pill, order-form Checkout Cut, faq, trust-footer. Signature: hero pill stagger. Mood: confident editor.
- "Hoodie Drop Oran" — fashion & apparel. The Straddle Drop hero (tangerine duo); order: announcement, hero, variant pills (S-XL), photo-reviews as tags with square photos, stats-band, bundle SOLO/DUO/SQUAD, stock pill, price slam section, order-form Two-Take, trust-footer. Signature: pills land in hero; splits carry the bundle. Mood: street but clean.
- "Lash Kit Virale" — beauty & cosmetics. The Tag Storm hero (lilac duo); order: announcement, hero, benefits wall, how-it-works, whatsapp-proof translated to tags, price-anchor split, countdown, cross-sell (+pinceau), order-form Echo Pill + full form, faq, footer. Mood: soft product, hard edit.
- "Micro Pocket" — electronics & gadgets. The Price Slam hero (lime duo); order: announcement, hero, spec fragments as pill wall, stats-band, @-tag wall, bundle DUO push, order-form Bar Take, faq, footer. Lean 9-block sprint. Mood: aggressive value.
- "Claquettes Squad" — fashion & apparel. The Cold Open hero (tangerine duo — name carries); order: announcement, hero, photo grid straddle section, variant pills, reviews as tags, price-anchor, stock pill, order-form Checkout Cut, footer. Mood: inside joke you can buy.
- "Ring Mini Studio" — electronics & gadgets. The Stacked Cut hero (lilac duo); order: announcement, hero, how-it-works cuts, stats-band, @-tag wall, price-anchor split, countdown, order-form Two-Take, faq, footer. Signature emphasis on the offer split. Mood: builder energy.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
