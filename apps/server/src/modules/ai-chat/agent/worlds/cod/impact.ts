import type { DesignWorld } from "../types";

export const impact: DesignWorld = {
	id: "impact",
	name: "Impact",
	family: "sport-energy",
	tagline: "Locker-room intensity in charcoal and lime",
	kind: "cod",
	mood: ["intense", "disciplined", "electric"],
	energy: "loud",
	priceFeel: "accessible",
	industries: ["fitness equipment", "health & wellness", "fashion & apparel"],
	avoidFor: ["kids & baby", "jewelry & watches", "beauty & cosmetics"],
	fusesWith: ["trottoir", "bivouac"],
	preview: {
		ground: "#16181A",
		ink: "#F2F5F0",
		accent: "#BFF130",
		fontFamily: "Oswald",
		sampleWord: "ONE MORE",
	},
	doc: `
=== IMPACT — WORLD DOC (kind: cod-page) ===

1. PHILOSOPHY

Impact is the locker room four minutes before the final. Charcoal walls, one caged work light, tape on wrists, nobody talking. The page does not decorate — it counts. Every section is a set, every scroll is a rep, and the lime accent is the jolt of adrenaline that fires exactly when needed and never lingers. This world sells effort-products: gear, programs, fuel. It respects the buyer as an athlete-in-progress, so the voice is a coach's voice — short imperatives, numbers over adjectives, zero flattery. Where other worlds seduce, Impact challenges: it shows the work, prices the work, and dares you to start. Discipline is the aesthetic. Charcoal is discipline. Lime is the payoff. Nothing else gets in the frame.

The page must feel HEAVY. Weight comes from near-black grounds, condensed caps with tight leading, photos crushed into charcoal/lime duotone with grain, and motion that snaps like a rack of plates being dropped — fast, hard, done. It must never feel neon-gamer, never hazard-industrial, never sports-jersey nostalgic. Those are other worlds. Impact is training, not fandom.

Self-audit checklist — answer before shipping:
- Does the hero answer "what is it, what will it do to me, how much" inside one 390px viewport?
- Is every photo passed through the lime duotone grain treatment — no raw full-color photos leaking through?
- Do workout-set labels head the major sections, and do they count in a coherent sequence?
- Is lime under 12% of any viewport — a jolt, not a wash?
- Does motion finish in 0.35s or less, with power4.out, and does exactly one count-up moment exist?
- Are all forms thumb-sized (52px+ fields) with COD reassurance in coach voice beside them?
- Zero horizontal overflow at 390 / 768 / 1440?
- Could a stranger sort this page from a gamer page and a construction page in two seconds?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, non-negotiable:
- The selling spine: hook then convince then offer then order form, in that order, invisible to the buyer.
- Palette registers: charcoal grounds #16181A to #1D2023, ink #F2F5F0, lime accent #BFF130 to #CDF24C, steel panels #2A2E33. At most ONE inverted white section per build.
- Type stacks: Latin display Oswald or Archivo Black; body Barlow or Inter. Arabic display Cairo (800) or Changa; body Almarai.
- The three owned tics: lime duotone grain photos, workout-set labels, plate-stack markers.
- Motion identity "explosive reps": 0.35s power4.out slides, hard staggers, one count-up signature.
- Desktop law: responsive expansion, max 1100px, split hero.
- Refused blocks: lottery-contest, press-badges.
- Imagery style: gritty dark-gym photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client, never copied from a previous build:
- Hero composition (choose from the hero menu, or a justified new one in-world).
- Block choice within the supported set, and BLOCK ORDER — the convince sequence must be rebuilt around this client's product logic.
- Form style (from the form menu).
- Proof type emphasis: photo reviews vs video vs WhatsApp vs stats — pick what this product earns.
- Accent rotation within the lime register (a build may sit at #BFF130 or drift warm to #CDF24C).
- Section density and rhythm: a lean 8-block sprint or a 13-block full session.
Every client receives a new sibling of this world — same blood, different body. A clone is a failed build.

3. VISUAL SIGNATURES — measured values

- Grounds: #16181A primary, #1D2023 alternate sections, #2A2E33 steel cards/panels. Optional single inverted section: ground #F2F5F0, ink #16181A.
- Ink: #F2F5F0 on dark; muted ink #A8AFA9 for secondary lines (60% usage cap of text).
- Lime: #BFF130 base, #CDF24C warm end. Used for: numbers, one word per headline max, CTA fill, plate-marker fills, duotone highlight channel.
- Display type: clamp(2.2rem, 9vw, 3.4rem) mobile hero; section heads clamp(1.6rem, 6.5vw, 2.2rem); ALL CAPS, letter-spacing 0.01em Latin, line-height 0.95 to 1.05.
- Body: clamp(0.95rem, 4vw, 1.05rem), line-height 1.55 Latin.
- Workout-set labels: 0.72rem caps, letter-spacing 0.14em (Latin only), color lime, format "SET 02 · PROOF" — a thin 2px lime rule 24px wide sits to its start side.
- Radii: 4px on cards and fields — Impact is squared-off, never pill except the sticky bar (24px).
- Borders: 1px #2A2E33 on cards; CTA has no border, solid lime fill, ink #16181A text.
- Shadows: none. Depth comes from ground steps, not shadows.
- Spacing rhythm: section padding-block clamp(56px, 14vw, 88px); intra-block gaps 16/24/40px scale.
- Duotone grain treatment (tic): every photo gets a charcoal-to-lime duotone map (shadows #16181A, highlights toward #BFF130 at low opacity), contrast +15%, and a visible grain overlay (SVG feTurbulence or a tiled noise PNG at 6-9% opacity). Implementation: image inside a figure; a lime-tinted overlay with mix-blend-mode multiply/screen pair, plus the grain layer. No raw photo ships.
- Plate-stack markers (tic): bullets and step marks drawn as 2 to 4 barbell plates seen edge-on — stacked rounded-end bars of decreasing width (18/14/10px wide, 4px tall, 2px gap), lime for the active/current, steel #2A2E33 for the rest. Progress = more plates filled.

4. COLOR PHYSICS

- Ground register: #16181A to #1D2023. Sections alternate within this register only; the jump between adjacent sections stays subtle (a felt shift, not a stripe).
- Ink register: #F2F5F0 to #A8AFA9. Headlines always full ink; support text may drop to the muted end.
- Accent register: #BFF130 to #CDF24C. Hard cap: lime occupies under 12% of any viewport. Lime is never a background for body text longer than one line.
- Steel support: #2A2E33 for cards, rules, inactive states — unlimited structural use.
- The single inverted section: at most one per build, ground #F2F5F0 — used to spotlight the offer or the before/after beat. Lime on white must darken to #8CB515 for contrast.
- Forbidden: any red/orange urgency color (urgency is typographic here), pure #000000, pure #FFFFFF grounds outside the inverted section, gradients of any kind except the duotone photo treatment, and any second hue family. Errors in forms use #E5484D, the only sanctioned exception, form-internal only.

5. TYPOGRAPHY

Latin stack:
- Display: Oswald (500/600) first; Archivo Black when the client's product wants extra mass (one of the two per build, never mixed).
- Body: Barlow (400/500) or Inter (400/500).
- Numeric moments (counters, prices): the display face, tabular where possible.
Arabic stack:
- Display: Cairo (800) first choice; Changa (700) alternate — both hold condensed-caps energy in Arabic.
- Body: Almarai (400/700).
- Pairing rule: Cairo display pairs with Almarai body; Changa display also pairs with Almarai.
Size clamps are SHARED across scripts, but Arabic display renders around 10% smaller at the same clamp — set Arabic display top end at 3.1rem instead of 3.4rem.
Weight rules: display never below 500; body never above 500 except prices.
RTL mirroring: use logical properties throughout (padding-inline, margin-inline-start, inset-inline-end). NEVER letter-spacing on Arabic text — tracking applies to Latin and digits only. Arabic body line-height 1.7 to 1.9. Digits: Western Arabic numerals (0-9) for prices, reps, counters. x-axis motion flips sign under RTL. The workout-set label's little lime rule sits on the logical start side.

6. SIGNATURE ART & COMPONENTS

- Lime duotone grain photos (owned tic): the world's entire photographic surface. Build as figure > img + two absolutely-positioned overlay layers (duotone tint pair + grain). Every product shot, every athlete shot, every review photo passes through it.
- Workout-set labels (owned tic): section furniture. Format "SET 01 · THE PROBLEM", "SET 02 · PROOF", counting through the page in order, ending with "FINAL SET · ORDER". Never decorative — the numbering must match actual section order.
- Plate-stack markers (owned tic): list bullets, step indicators, bundle-tier indicators, form-step progress. Active plate lime, others steel.
- CTA button: solid lime block, ink text #16181A, caps, 4px radius, 56px min height; presses down 2px on tap (translateY, no shadow play).
- Cards: #2A2E33 steel panels, 1px border #343A40, 4px radius, no shadow.
- Chips: squared 4px, 1px steel border, caps 0.72rem.
- Dividers: a 2px lime rule 24-40px wide, start-aligned — never full-width.
- Sticky bar: charcoal #101214 bar, price in ink, lime CTA pill (24px radius exception).
Imagery (art direction for ANY product in this world): gritty fitness product photography in a dark concrete gym; hard single-source directional light raking across the product; chalk dust hanging in the air; lime green accents present in the scene (band, cable, tape) so the duotone has a native anchor; charcoal/near-black backdrop; high contrast, crushed blacks, visible grain; camera low and close, product treated like an opponent. BANNED in photos: bright daylight, white studio seamless, smiling lifestyle groups, pastel props, soft shadows. Shots needed per build: one hero product shot, one in-use action shot, one macro texture/detail, one flat "kit" layout, review-scale shots as earned.

7. THE SPINE

Hook, convince, offer, order form — in that order, always, invisible to the buyer. Impact's implementations:
- Price placement: HERO-FIRST. The price appears in the hero as a plain, unmissable number near the CTA ("299 SAR" scale: display face, lime). The sticky bar repeats it.
- Sticky CTA: a slim charcoal bar (bottom, 100% width) appearing after the hero scrolls past; left side price + one-line stock or delivery note, right side lime pill "ORDER NOW" that smooth-scrolls to the form. In RTL the pill sits on the logical end.
- Mobile-first: designed at 390px. Desktop law: RESPONSIVE EXPANSION, max content width 1100px; the hero splits into photo + copy columns; convince sections may go two-column; the form stays a single centered column capped at 520px.

8. BLOCKS TREATMENT (supported: 14)

- announcement-bar: a single charcoal strip, caps, plain — "COD · DELIVERY 24-72H · ALL REGIONS". One lime word max. No rotation gimmicks.
- problem-solution: "SET 01" opener. Pain lines set as short punched caps statements stacked like a workout card; the product enters as the answer with a duotone action shot.
- benefits-icons: squared steel chips with plate-stack markers as the icon language plus a 3-word caps label each. Max 6, grid of 2 on mobile.
- how-it-works-steps: numbered as reps — "REP 1 / REP 2 / REP 3", each with a duotone photo sliver and one imperative sentence. Plate-stack shows progress.
- before-after: the world's strongest proof. Two duotone frames side by side labeled "DAY 1 / DAY 90" in workout-set label style; honest timeframe caption underneath. Never a slider gimmick on mobile — side-by-side.
- stats-band: the signature count-up moment. 3-4 giant display numbers (orders, rating, cities, kg shipped) that rep-count up once when entering. Lime numbers, muted caps captions.
- photo-reviews: steel cards, reviewer name + city in caps, stars drawn as small lime plates, review text in body face, duotone customer photos where present. "VERIFIED COD" chip.
- video-testimonial: one muted loop inside a steel frame, poster duotone-treated, caption in workout-set label style. ≤2MB law respected.
- comparison-table: "US VS EXCUSES" — check/cross matrix in steel panel; checks are lime plates, crosses muted. Max 6 rows, 2 rival columns max.
- price-anchor: a full "offer plate": old price struck in muted ink, new price giant in lime, per-session math in one line ("under 3 SAR per workout"). COD note beneath.
- bundle-offers: 1x/2x/3x as three steel cards; tier indicated by plate-stack (one plate, two plates, three plates); "MOST PICKED" flag in lime caps on the middle card; selecting feeds the form.
- countdown: allowed but disciplined — a plain digital-style timer in the display face inside a steel strip, "OFFER RESETS SUNDAY" honesty line. No flashing.
- variant-gallery: colorway/resistance-level chips with duotone thumbnails; selected chip gets lime border and a filled plate marker.
- size-guide: apparel builds only — a steel table, cm rows, caps headers; "measure like this" one-liner. No diagrams beyond a single simple SVG.
- order-steps: 3 steps in coach voice — "FILL THE FORM / WE CALL YOU / PAY AT YOUR DOOR", plate-stack progression, one line each.
(Also always: hero, order-form, sticky-cta, faq and trust-footer in world skin — faq as steel accordion rows with plus markers, trust-footer as a quiet charcoal strip with contact + policies.)

REFUSED BLOCKS:
- lottery-contest: prizes are luck; Impact sells earned results. Tonally poison.
- press-badges: borrowed authority is weakness here — the proof is the work, not the logos.

9. HERO MENU (choose ONE per build, or justify a new in-world composition)

- THE OPENING REP (price-first stack): giant product name in caps, one-line promise, price + CTA immediately, duotone product shot below the fold line. For buyers who already want it.
- SPLIT SQUAT (photo-split): 55/45 vertical split — duotone action photo on one side (product mid-use), stacked copy + price + CTA on the other. Desktop expands this to true columns.
- GAME TAPE (video hero): the muted loop as hero background band (not full-bleed page), title and price punched over a darkened lower third of it, poster fallback duotone-treated.
- DAY 1 / DAY 90 (before-after hero): the transformation pair IS the hook, product name above, price and CTA directly under the pair. For results-products (bands, programs, supplements).
- THE PROGRAM CARD (offer-card hero): the hero is a steel offer plate — product thumb, what's included as plate-marked list, price math, CTA. Feels like signing a program.
- THE CALLOUT (story-hook hero): a coach's challenge in huge caps ("STILL WAITING FOR MOTIVATION?"), product revealed at the second beat with price. Highest risk, use when the client's product needs re-framing.

10. FORM MENU (choose ONE per build)

- THE SIGN-UP SHEET (single card): one steel panel, all fields stacked, plate-stack bullets marking field groups, lime submit. Header: "FINAL SET · YOUR ORDER".
- THREE SETS (multi-step wizard): 3 micro-steps (choose pack / your info / confirm), plate-stack as progress indicator, one field group per screen, 0.35s snap transitions. Best with bundles.
- WARM-UP + WORKING SET (hero-echo): a compact 2-field strip (name+phone) right under the hero CTA for the already-sold, repeated full-size with all fields at page end. Both submit to the same success state.
- COACH'S WHISTLE (sticky-driven): the sticky bar's CTA is the only entry; tapping slides the full form up as a bottom sheet (still in-page, not a modal library). For lean sprint builds.
All forms: 52px+ fields, visible labels, region select with real names, COD reassurance line in coach voice ("Pay when it's in your hands. 72h delivery."), inline validation, success state = a lime "ORDER LOGGED" plate with order number and "we call you within 24h".

11. MOTION IDENTITY — "explosive reps"

- Entrances: x or y 28px slides + fade, power4.out, 0.35s, staggers 0.06-0.09s. Hard and short — motion ends before the eye asks.
- The ONE signature scroll moment: the stats-band (or price-anchor if no stats-band) numbers rep-count from 0 to value in 0.8s when first entering view. Once per page, never repeated elsewhere.
- Sticky bar: slides up 0.3s when the hero leaves.
- CTA tap: translateY 2px down/up, 0.1s.
- Continuous loops: NONE. Impact does not idle.
- Reduced motion: all entrances disabled (content visible via dual-visibility law), count-up replaced by static final numbers.
- Banned motion: overshoot easings of any kind, bounces, floats, parallax, pinning on mobile, marquees, flicker.

12. BAN LIST

Generic slop: purple-blue gradients on white, glassmorphism, emoji as design system, Poppins-everything, lorem ipsum, fake trustpilot widgets, cookie-cutter 3-column icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur anywhere, back.out overshoot.
Neighbor tics banned BY NAME: maillot's diagonal slice transitions, giant jersey numerals and chant stacks; chantier's stencil spray caps and hazard stripes; voltage's neon-tube glow type; gazette's halftone dot imagery; clair's duotone spot ILLUSTRATIONS (Impact duotones photographs only, never illustration scenes); cinetique's machine-telemetry captions (SYS.STATUS style) — Impact's set labels are gym voice, never system voice; trottoir's courier labels, receipts and chevron rails; manette's RGB conic sweeps and chamfered corners; kenz's spotlight cone.
Refused blocks: lottery-contest, press-badges.
World-specific temptations to refuse: red urgency stickers, flame/lightning iconography, "beast mode" clichés, hazard tape, scoreboard/LED fonts, more than one lime word per headline.

13. EXAMPLE VARIATIONS

- "FORGE" (fitness equipment — resistance bands): SPLIT SQUAT hero; order: announcement-bar, problem-solution, benefits-icons, before-after, stats-band, photo-reviews, price-anchor, bundle-offers, order-steps, faq; THREE SETS wizard form; mood: full program energy, count-up lives in stats-band.
- "5AM CLUB" (health & wellness — pre-workout supplement): THE CALLOUT hero; order: announcement-bar, problem-solution, how-it-works-steps (REP 1-3 dosing), comparison-table, photo-reviews, price-anchor, countdown, order-steps, faq; THE SIGN-UP SHEET form; mood: harsh-love coach, count-up moved to price-anchor savings number.
- "SECOND SKIN" (fashion & apparel — compression wear): DAY 1 / DAY 90 hero; order: benefits-icons, variant-gallery, size-guide, photo-reviews, stats-band, price-anchor, order-steps, trust-footer-heavy close; WARM-UP + WORKING SET hero-echo form; mood: quieter discipline, single inverted white section holds the size-guide.
- "GRIP" (fitness equipment — adjustable dumbbell): THE PROGRAM CARD hero; order: spec-style benefits-icons, how-it-works-steps, video-testimonial, comparison-table, price-anchor, bundle-offers (1/2 dumbbells), faq, order-steps; COACH'S WHISTLE sticky-driven form; mood: hardware-serious, count-up on the kg number in the hero card.
- "LAST ROUND" (fitness equipment — boxing set): GAME TAPE video hero; order: problem-solution, benefits-icons, stats-band, whatsapp-style photo-reviews mix, price-anchor, stock-urgency, order-steps, faq; THE SIGN-UP SHEET form; mood: fight-camp adrenaline, count-up in stats-band, stock number styled as remaining spots.
- "MACRO" (health & wellness — meal-prep scale kit): THE OPENING REP hero; order: benefits-icons, how-it-works-steps, comparison-table, photo-reviews, price-anchor, cross-sell (shaker), order-steps, faq; THREE SETS wizard; mood: measured and calm-for-Impact, the inverted white section carries comparison-table.
- "TEMPO" (fashion & apparel — running shorts): SPLIT SQUAT hero with in-run photo; order: variant-gallery, benefits-icons, size-guide, photo-reviews, price-anchor, bundle-offers (2-pack), order-steps; COACH'S WHISTLE form; mood: race-day lightness, count-up on the reviews count.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
