import type { DesignWorld } from "../types";

export const circuit: DesignWorld = {
	id: "circuit",
	name: "Circuit",
	family: "clean-tech",
	tagline: "Datasheet precision in white and electric blue",
	kind: "cod",
	mood: ["precise", "technical", "confident"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["electronics & gadgets", "car accessories", "fitness equipment"],
	avoidFor: ["kids & baby"],
	fusesWith: ["manette", "remede", "tendance", "expo", "nadhara", "telj"],
	preview: {
		ground: "#FAFBFC",
		ink: "#0C1420",
		accent: "#0057FF",
		fontFamily: "Space Grotesk",
		sampleWord: "S2 SPEC",
	},
	doc: `
CIRCUIT — THE DATASHEET IN DAYLIGHT

1. PHILOSOPHY

Circuit believes a specification is more seductive than an adjective. This world sells gadgets
the way an engineer would if an engineer cared about conversion: white light, one electric
blue, and every claim pinned to a number with a unit. The product photo is never decoration —
it is a diagram waiting to be annotated. Leader lines reach into it and name what matters:
"40h battery", "ANC -35dB", "IPX5". The page reads like the product's own datasheet redesigned
by someone with taste, and that precision IS the trust: a seller who publishes the milliamp
count is not hiding anything. COD buyers of electronics fear clones and cheap fakes; Circuit
answers with measured typography, mono digits, and traces that run like a clean PCB. Nothing
glows, nothing explodes, no RGB — restraint separates the lab from the arcade. Where a loud
world would add a badge, Circuit adds a row to the spec strip. The emotion is quiet
competence; the buyer should close the page thinking "these people know exactly what they are
selling", and order because certainty feels safe.

Self-audit before shipping:
- Does every headline claim carry a number and a unit somewhere on the page?
- Are the leader lines annotating a real product photo, with values a spec sheet would back?
- Is electric blue under 10% of every viewport, with white doing the lifting?
- Do all digits sit in mono with tabular alignment — prices, specs, stats?
- Is there exactly one signature motion (hero leader lines drawing) and nothing else fancy?
- Could this page be confused with a gaming brand? (If yes, strip the color.)
- Are the traces right-angled and thin — circuitry, not decoration?
- Is the page fully readable with JavaScript off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook → convince → offer → order form, invisible and inviolable.
- Palette registers: grounds #FAFBFC / #FFFFFF; ink #0C1420; electric blue #0057FF→#1F6BFF;
  cool panel #E8EDF3; success green #12A150 inside the form only.
- Type stacks: Latin display Space Grotesk; body Inter or IBM Plex Sans; mono IBM Plex Mono or
  Space Mono. Arabic display Cairo 600; Arabic body IBM Plex Sans Arabic; Latin mono retained
  for digits and units.
- The three owned tics: feature leader lines, PCB trace dividers, the datasheet strip.
- Motion identity: calibrated slides — x/y:20, power2.out, 0.5s; signature moment: hero leader
  lines draw on load.
- Desktop law: responsive expansion, max 1120px, specs two-column.
- Refused blocks: lottery-contest, before-after, ingredients-infographic.
- Imagery style: minimal white-studio tech photography (see Imagery).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition (from the hero menu or a new one in the same voice).
- Which supported blocks appear, and their order after the hero.
- Form style (from the form menu).
- Proof emphasis: photo-reviews vs stats-band vs comparison-table.
- Accent point within the blue register; whether panels tint cool or stay white.
- Section density: an 8-block minimalist build and a 13-block spec-monster are both legal.
Every client gets a new sibling of this world — same physics, different machine. Never a clone.

3. VISUAL SIGNATURES

- Grounds: #FAFBFC page, #FFFFFF cards, #E8EDF3 cool panels for grouped content. Cards use a
  1px solid #DFE6EE border, radius 14px, no shadow (a 0 1px 2px rgba(12,20,32,0.06) contact
  line is the maximum).
- Leader lines (owned): 1px solid #0C1420 hairlines starting at a 6px filled dot placed ON the
  product photo, running 40-90px (one bend maximum, 90° only), ending at a floating label —
  11px mono caps, letter-spaced 0.08em, ink or electric blue, with the value in 600 ("40H
  PLAYTIME"). Lines draw via stroke-dashoffset or scaleX 0.4s, labels fade 0.2s after,
  staggered 0.15s. 3-5 callouts maximum per photo.
- PCB traces (owned): section dividers drawn as 1px #C9D4E0 lines running horizontally, taking
  one or two right-angle detours, punctuated by 4px node dots (#0057FF at 40% of nodes, ink at
  the rest). Height of the divider zone: 32-48px. Traces never animate except a single node
  that fills blue as the section enters.
- Datasheet strip (owned): full-width rows separated by 1px #E3E9F0 rules; label left in body
  type #4A5568, value right in mono 500 tabular ("6.2 g" / "IPX5" / "Type-C"). Rows are 44px
  tall at 390px. An optional thin blue 2px left rule marks the hero spec.
- Display type: clamp(1.9rem, 6.5vw, 2.75rem), Space Grotesk 600, line-height 1.08, tracking
  -0.01em.
- Body: clamp(0.95rem, 2.5vw, 1.05rem), line-height 1.55.
- Mono captions: 0.72rem, uppercase, tracking 0.08em (Latin only).
- Spacing rhythm: sections 72-96px apart; groups 24px; the page breathes in 8px multiples.
- Buttons: radius 10px rectangles (not pills), #0057FF ground, white 16px/600 text, height
  56px; hover/press darkens to #0046CC. Secondary: 1.5px blue outline on white.

4. COLOR PHYSICS

- Ground register: #FAFBFC to #FFFFFF, with #E8EDF3 as the grouped-content panel tone. Light
  always; Circuit has no dark sections — the lab is lit or it is closed.
- Ink register: #0C1420 headings, #3D4A5C body, #6E7B8C captions. Never pure #000.
- Accent register: #0057FF to #1F6BFF. Pick one point per build; it lives on CTAs, live nodes,
  one leader-label per photo, and the selected states. Hard cap: 10% of any viewport.
- Support: #12A150 success green appears ONLY inside form success/validation. No warning
  yellows; errors are stated in plain ink with a thin red #D64545 field border.
- Forbidden: gradients between hues, purples, RGB anything, warm tones (no gold, no orange),
  glow effects, colored shadows. A single-hue blue tint ramp inside a chart is the only
  gradient-like move allowed.
- Panel logic: when content needs grouping (specs, bundles), it sits on #E8EDF3; the page
  never stacks two panel sections back-to-back — white must separate them.

5. TYPOGRAPHY

Latin stack:
- Display: Space Grotesk 500/600 — the engineered voice. No substitute for display.
- Body: Inter 400/500 (first) or IBM Plex Sans 400/500.
- Mono: IBM Plex Mono 400/500 (first) or Space Mono 400 — all digits, units, spec values,
  prices in tabular alignment.
Arabic stack:
- Display: Cairo 600/700 (geometric, engineered kinship with Grotesk).
- Body: IBM Plex Sans Arabic 400/500.
- Digits and units stay in the Latin mono font — a spec value like "1200 mAh" renders as an
  LTR mono island inside RTL text, wrapped in dir="ltr" spans.
Pairing rule: Space Grotesk + Inter + Plex Mono is the house blend; swap Inter for Plex Sans
only when the client's alphabet mixes heavily with Arabic (Plex harmonizes across scripts).
Size clamps shared across scripts: display clamp(1.9rem, 6.5vw, 2.75rem); section titles
clamp(1.35rem, 4.5vw, 1.8rem); body clamp(0.95rem, 2.5vw, 1.05rem); mono captions 0.72rem.
RTL rules: logical properties everywhere; leader lines mirror (dot on the photo, label toward
the reading edge); mono caps tracking applies to Latin/digits only — NEVER letter-space
Arabic; Arabic body line-height 1.7-1.9; Western Arabic digits (0-9) throughout.

6. SIGNATURE ART & COMPONENTS

- Feature leader lines (owned): the world's centerpiece. Every build annotates at least the
  hero photo. Labels carry measured values, not marketing words — "BASS+" is banned, "10mm
  DRIVER" is law.
- PCB trace dividers (owned): the page's connective tissue. Use sparingly — every second or
  third section boundary; the others get plain space.
- Datasheet strip (owned): the spec-table block's dressing and this world's table style for
  anything tabular (delivery fees, bundle math).
- Supporting cast: white bordered cards; rectangle buttons; status chips (22px tall, panel
  ground, mono caps like "IN STOCK — 24H DISPATCH"); a selected-state ring (2px blue) shared
  by variant swatches and bundle cards; numbered step markers as 28px squares with mono
  digits.
- Imagery: minimal tech product photography on white or near-white seamless. Soft gradient
  contact shadow, floating or angled compositions, macro passes on ports/drivers/textures,
  one accent pass where electric blue light kisses an edge. Neutral cool color balance,
  everything sharp, no lifestyle sets, no hands unless demonstrating scale, no desks with
  plants, no neon rooms, no bokeh cities. The photo should look like it belongs in both a
  spec sheet and a gallery.

7. THE SPINE

Hook → convince → offer → order form — the skeleton every build hangs on, never visible,
never reordered.
- Price placement: EARLY, IN THE HERO, set in mono beside the CTA — old price struck thin, new
  price 700 — because a confident spec sheet does not hide its number. The sticky bar repeats
  it in mono.
- Sticky CTA: bottom bar on mobile — white, 1px top border #DFE6EE, mono price left (RTL:
  right), blue rectangle button "Order — pay on delivery". Appears once the hero CTA leaves
  the viewport; smooth-scrolls to the form.
- Mobile-first at 390px. Desktop law: RESPONSIVE EXPANSION — max 1120px; hero splits
  text | annotated photo; datasheet and convince sections go two-column; the form remains a
  single 560px centered column.

8. BLOCKS TREATMENT

Supported blocks, dressed by Circuit:
- announcement-bar: one mono-caps line on ink ground, white text — "COD AVAILABLE — 24-48H
  DISPATCH". The world's only dark element, 36px tall.
- benefits-icons: 4-6 outcome chips in white cards with 1px borders — icon 24px stroke-style,
  mono caps label, one plain sentence. Grid 2-up at 390px.
- spec-table: the datasheet strip at full glory — 6-12 rows, hero spec carrying the blue left
  rule. This block is near-mandatory; a Circuit page without specs is out of character.
- comparison-table: "vs the generic clone" — three columns (spec | this | clones), check and
  cross drawn as 16px stroke icons, clone column in faded ink. Facts only, no mockery copy.
- stats-band: 3-4 counters on a cool panel — "12,000 UNITS DELIVERED", "4.8/5", "38 CITIES" —
  mono digits counting up once.
- photo-reviews: white cards with 1px border, reviewer name + city + "verified order" chip in
  mono caps, stars as five 12px squares filled blue (this world's star shape), review text in
  plain body.
- guarantee-seal: a square badge (not a circle) with a 1.5px ink border and mono caps —
  "14-DAY EXCHANGE / TESTED BEFORE DISPATCH" — sitting beside plain reassurance lines.
- price-anchor: a datasheet row grown large: "PRICE" label, struck old value, new value in
  mono 700 at clamp(1.6rem, 5vw, 2.2rem), a per-day line beneath in captions.
- bundle-offers: 1x/2x cards as white bordered rectangles with mono math ("2x — save 18%"),
  selected state = 2px blue ring; feeds the form's option state.
- variant-gallery: swatch squares (colors) or model chips with per-variant thumbnail; the
  chosen variant updates the hero photo where feasible; selected ring shared with bundles.
- unboxing-gallery: "IN THE BOX" grid — each item photographed on white, mono caption,
  count badge "×2"; ends with a total-pieces chip.
- order-steps: 4 numbered squares — form → confirmation call → 24-48h delivery → pay at door;
  each step one sentence, mono step digits.
- faq: hairline accordion, plus-sign toggles rotating to ×, questions in 500, answers plain.
- trust-footer: quiet ink-on-white band — brand, phone/WhatsApp in mono, policies, "COD
  nationwide" line, tiny PCB trace as the final divider.

Refused blocks:
- lottery-contest: raffles are noise in a lab; precision and prizes do not mix.
- before-after: gadgets have specs, not transformations; the comparison-table carries any
  "versus" story.
- ingredients-infographic: components live in the spec-table; "ingredients" is another
  world's metaphor.

9. HERO MENU

- The annotated hero: product photo center-stage with 3-4 leader-line callouts drawing on
  load, name above, price + CTA below. The world's signature opening.
- The spec-first stack: headline, then a 3-row mini datasheet strip (the three killer specs),
  then the photo, price, CTA. For products whose numbers ARE the hook.
- The floating split: photo floating at a dynamic angle on one side, text stack the other;
  at 390px the photo crops tight above the text. One leader line maximum here.
- The datasheet cover: the hero framed as the first page of a spec document — mono header row
  ("MODEL — AURA-2 / REV 1.3"), big product name, photo, and the price as the final row.
- The offer-card hero: everything inside one bordered card — photo, name, three spec chips,
  price math, CTA — the page opening as a product ticket.
- The demo-loop hero: a short muted video loop (≤2 MB, poster fallback) of the product in
  operation, annotated headline over white beneath it, price + CTA. The only hero where
  motion outranks the leader lines.

10. FORM MENU

- The order sheet: one white bordered card, fields stacked with mono field labels (NAME /
  PHONE / REGION), options as selected-ring chips, blue rectangle submit. Success state
  prints an order number in mono.
- The config wizard: three steps — configure (variant/bundle) → coordinates → confirm — with
  a thin blue progress rule and mono step counter "STEP 2/3". For variant-heavy gadgets.
- The hero-echo: a two-field quick strip (phone + region) directly under the hero price for
  decided buyers, repeated as the full order sheet at page end; the strip carries "we call
  you to confirm" in captions.
- The sticky-driven anchor: the sticky bar's button is the form's only advertisement; the
  form itself waits at page end as a full order sheet with the spec summary printed above it.

11. MOTION IDENTITY

Calibrated slides: entrances translate x or y by 20px with opacity, power2.out, 0.5s,
staggered 0.1s. Leader lines: line draws 0.4s (scaleX from the dot, or dashoffset), label
fades 0.2s later; hero callouts stagger 0.15s. THE signature scroll moment: the hero
annotation sequence on load — nothing else on the page may draw. Node dots on traces fill
blue as their section enters (0.2s). Counters count once. Reduced motion: everything set to
final state; lines pre-drawn, counters printed. Banned: rotation, scaling entrances beyond
1.02, bounces, loops of any kind, parallax, pinning, glow pulses.

12. BAN LIST

Generic slop: purple-to-blue gradients on white, glassmorphism, emoji as design system,
Poppins-for-everything, lorem ipsum, fake trustpilot logos, cookie-cutter 3-column icon rows
with drop shadows, hero carousels, parallax overuse, backdrop-blur.
Neighbors' tics, banned by name: gabarit's dimension lines with mm/cm and title-block
cartouches (Circuit annotates FEATURES with values, never draws measurement arrows);
observatoire's constellation maps and orbital ellipses; hypertexte's visible-border layout
tables; phosphore's ASCII frames, prompt furniture and typed-text reveals; manette's RGB
conic sweeps, chamfer-cut panels and loadout chips; remede's dosage bars and blister grid;
kenz's spotlight cone. If the page starts glowing, it has defected to manette — arrest it.
Refused blocks (restated): lottery-contest, before-after, ingredients-infographic.
This world's own temptations, banned: fake "AS SEEN ON" walls, spec values without units,
dark-mode heroes, blue gradients as section grounds, circuit-board photo backdrops (traces
are drawn, never photographed).

13. EXAMPLE VARIATIONS

- "Aura Field" (electronics & gadgets): annotated hero for ANC earbuds; order:
  announcement-bar, benefits chips, spec-table with blue hero row, stats-band, photo-reviews,
  price-anchor, bundle 1x/2x, unboxing grid, order-steps, faq, trust-footer; order-sheet
  form. Mood: the flagship — leader lines carry the page, everything else stays flat.
- "Dash Sentinel" (car accessories): spec-first stack hero for a dash cam; order: benefits,
  comparison-table vs clones, spec-table, photo-reviews, variant-gallery (32/64GB),
  price-anchor, order-steps, faq; config-wizard form. Mood: the engineer's purchase — the
  comparison table is the emphasis, hero draws only one callout.
- "Pulse Track" (fitness equipment): demo-loop hero for a smart jump rope; order: benefits,
  spec-table, stats-band with workout counters, photo-reviews, bundle-offers, unboxing,
  faq, trust-footer; hero-echo form. Mood: kinetic but disciplined — the video loop is the
  only moving image, counters are the motion emphasis.
- "Volt Case" (electronics & gadgets): offer-card hero for a 20,000mAh power bank; order:
  spec-table, benefits, photo-reviews, price-anchor with per-charge math, cross-sell cable
  via bundle card, order-steps, faq; sticky-driven anchor form. Mood: the ticket — one card
  aesthetic repeated down the page, traces used at every boundary.
- "Aura Fleet" (electronics & gadgets): datasheet-cover hero for a tablet; order: benefits,
  spec-table two-column, comparison-table, stats-band, variant-gallery (colors),
  price-anchor, faq, trust-footer; config-wizard form with mono step counter. Mood: the
  document — mono voice everywhere, node dots as the only blue outside the CTA.
- "Grip Torque" (car accessories): floating-split hero for a magnetic phone mount; order:
  benefits, spec-table short, photo-reviews, price-anchor, bundle 2x for both cars,
  order-steps, faq; order-sheet form. Mood: the quick decisive build — 8 blocks, wide
  spacing, a single leader line in the hero and no traces until the footer.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
