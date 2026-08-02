import type { DesignWorld } from "../types";

export const remede: DesignWorld = {
	id: "remede",
	name: "Remède",
	family: "clinical-pharma",
	tagline: "Pharmacy-counter trust: measured, white, clinically calm",
	kind: "cod",
	mood: ["clinical", "precise", "reassuring"],
	energy: "quiet",
	priceFeel: "accessible",
	industries: ["health & wellness", "beauty & cosmetics", "pets"],
	avoidFor: ["fashion & apparel", "jewelry & watches"],
	fusesWith: ["hammam", "circuit"],
	preview: {
		ground: "#FFFFFF",
		ink: "#0F2E33",
		accent: "#0E9A8C",
		fontFamily: "IBM Plex Sans",
		sampleWord: "Remède",
	},
	doc: `
REMÈDE — THE PHARMACY COUNTER

1. PHILOSOPHY

Remède sells the way a good pharmacist sells: quietly, with numbers, never raising its voice.
The page is a white counter under even light. Every claim is measured — a percentage, a
milligram, a day count — and everything that cannot be measured is left unsaid. Where a loud
funnel shouts "miracle", Remède prints "94% saw a difference in 28 days" next to a bar that
fills to exactly 94%. The buyer's fear in COD commerce is being fooled; Remède's entire
aesthetic is the visual promise that nobody here is fooling anyone. White is not emptiness —
it is the sterile field. Teal is not decoration — it is the pharmacy sign. The blister grid is
not a card layout — it is the product's own packaging logic turned into interface. Restraint
is the persuasion. The page must feel like it was reviewed by someone in a lab coat before it
was allowed to go live. Density stays low, whitespace stays clinical, and the one permitted
warmth is the reassuring calm of a professional telling you it will be fine.

Self-audit before shipping:
- Does every efficacy claim carry a number and a unit (%, mg, days)?
- Could this page be mistaken for a party invitation? (If yes, start over.)
- Is teal under 15% of any viewport, and is white doing most of the work?
- Do the dosage bars fill to values that match the printed numbers exactly?
- Is there exactly one signature scroll moment, and is it the bars filling?
- Would a real pharmacist wince at any sentence? Remove it.
- Are the form fields 52px+ tall with visible labels, like a proper medical form?
- Is the page readable end-to-end with JavaScript disabled?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook → convince → offer → order form, in that order, invisible to the buyer.
- Palette registers: white grounds #FFFFFF / #F2F8F7; ink #0F2E33; teal accent #0E9A8C→#12A8A0;
  clinical blue #2A6FDB capped at 10%; coral #E5484D for form errors only.
- Type stacks: Latin display IBM Plex Sans 600/700 or Archivo; Latin body Inter or IBM Plex
  Sans. Arabic display and body IBM Plex Sans Arabic or Noto Sans Arabic. Tabular numerals.
- The three owned tics: dosage bars, blister-pack grid, green-cross punctuation.
- Motion identity: precision fades — opacity plus y:16, power1.out, 0.5–0.6s; the single
  signature moment is dosage bars filling with a count-up.
- Desktop law: responsive expansion, max 1080px, convince sections go two-column.
- Refused blocks: lottery-contest, whatsapp-proof, stock-urgency.
- Imagery style: high-key clinical product photography on white seamless (see Imagery).

CLIENT-OWNED — re-decided fresh for every client, never copied from a previous build:
- Hero composition (choose from the hero menu, or a new one in the same voice).
- Block choice within the supported set, and the block order after the hero.
- Form style (choose from the form menu).
- Proof type emphasis: photo-reviews vs before-after vs stats-band.
- Accent rotation: where in the teal register this build sits, and whether clinical blue
  appears at all.
- Section density and rhythm: a 9-block page and a 13-block page are both legal.
Every client receives a new sibling of this world — same laws, new body. Never a clone.

3. VISUAL SIGNATURES

- Grounds: pure #FFFFFF page; alternate sections #F2F8F7 (mint-white). Cards #FFFFFF with a
  1px solid #DCE9E7 border, radius 12px, and NO drop shadow — clinical surfaces sit flat.
- Ink: #0F2E33 for headings, #2A4247 for body, #6B8489 for captions.
- Dosage bars: track 8px tall, radius 4px, background #E3EFED; fill is a flat teal #0E9A8C
  (no gradient), height 8px; label row above: ingredient name left, value right in tabular
  figures ("Collagène marin — 5 000 mg"). Fill animates 0→N% on scroll; the % text counts up
  in sync. Bars stack with 20px gaps.
- Blister-pack grid: a grid of capsule cells — each cell a 999px-radius pill or a 16px-radius
  rounded rectangle, background #FFFFFF, border 1.5px solid #DCE9E7, inner padding 16-20px,
  with a subtle 2px inset highlight at the top edge (the foil dome). Cells hold one benefit or
  one step each: icon 24px, label 15px/600, support line 13px. Grid gaps 12px, 2 columns at
  390px, 3-4 on desktop.
- Green-cross punctuation: a 12-16px pharmacy cross glyph (two crossed 3px bars, teal #0E9A8C)
  used as the section divider — centered, alone, with 48px space above and below — and as the
  bullet marker in lists. Never larger than 20px; never decorated.
- Display type: clamp(1.75rem, 6vw, 2.5rem), weight 700, line-height 1.15, ink #0F2E33.
- Body: clamp(0.95rem, 2.5vw, 1.05rem), line-height 1.6 (Latin) / 1.8 (Arabic).
- Section spacing: 64-80px vertical between sections; inner card padding 20-24px.
- Buttons: 999px pill, background #0E9A8C, text #FFFFFF 16px/600, height 56px, full-width on
  mobile; pressed state darkens to #0B7F73. Secondary buttons are 1.5px teal outlines.

4. COLOR PHYSICS

- Ground register: #FFFFFF to #F2F8F7. At least 70% of every viewport is ground. Never a dark
  section — Remède has no night mode; the lab lights never go off.
- Ink register: #0F2E33 (max contrast) down to #6B8489 (captions). Never pure black.
- Accent register: teal #0E9A8C to #12A8A0. One build picks ONE point in this register and
  holds it everywhere — bars, buttons, crosses. Usage cap: about 15% of any viewport.
- Support: clinical blue #2A6FDB for links, info chips or one secondary stat family — hard cap
  10%, and it never appears on buttons. Coral #E5484D exists ONLY inside form validation.
- Forbidden colors: purple, orange, warm yellows, gold, any gradient between two hues. A teal
  monochrome tint gradient on a chart fill is the only gradient allowed.
- Light logic: white page, mint-white interludes for rhythm. If a build needs a "highlight"
  moment (the offer), it earns it with a teal 2px border, never with a colored ground.

5. TYPOGRAPHY

Latin stack:
- Display: IBM Plex Sans 600/700 (first choice) or Archivo 600/700. Tight, engineered, cool.
- Body: Inter 400/500 or IBM Plex Sans 400/500.
- Numerals: font-variant-numeric: tabular-nums everywhere — prices, dosages, stats. Numbers
  are the voice of this world; they must align like a lab report.
Arabic stack:
- Display: IBM Plex Sans Arabic 600/700 (first choice) or Noto Sans Arabic 600/700.
- Body: IBM Plex Sans Arabic 400 or Noto Sans Arabic 400.
Pairing rule: never mix the two families in one role; if display is Plex, body is Plex or
Inter, and the Arabic side stays Plex Arabic throughout.
Size clamps (shared across scripts): display clamp(1.75rem, 6vw, 2.5rem); section titles
clamp(1.3rem, 4.5vw, 1.7rem); body clamp(0.95rem, 2.5vw, 1.05rem); captions 0.8rem. Arabic
display sits about 10% smaller at the same clamp — let the clamp minimum carry it.
RTL rules: logical properties only (padding-inline, margin-inline-start, inset-inline-end);
dosage bars fill from the reading side (right in RTL); NEVER letter-spacing on Arabic text —
tracking is a Latin-and-digits privilege; Arabic body line-height 1.7–1.9; digits are Western
Arabic (0-9) for prices, doses and phone numbers, wrapped in dir="ltr" spans where needed.

6. SIGNATURE ART & COMPONENTS

- The dosage bar (owned): the world's proof engine. Use it for ingredients, satisfaction
  percentages, absorption rates. Implementation: label row + track + flat fill; ScrollTrigger
  starts the fill at 70% viewport entry; count-up runs in the same tween duration (0.9s,
  power1.inOut). Never more than 5 bars in one group.
- The blister-pack grid (owned): benefits, steps, or "what's inside" set in capsule cells on
  the foil grid. The grid ground may tint #F2F8F7 to read as the foil sheet. Cells never
  rotate, never overlap — pharmaceutical order is the point.
- Green-cross punctuation (owned): the divider and bullet system described above. It is the
  only ornament this world possesses. If a section needs "decoration", it gets a cross and
  likes it.
- Supporting cast: flat white cards with 1px #DCE9E7 borders; pill buttons; info chips (24px
  tall, mint ground, teal text, tabular digits); a "posologie" strip — a horizontal row of
  day/dose markers (J1 → J30) used for cures and protocols; checkmark lists where the check
  is a small teal cross-in-circle.
- Imagery: high-key clinical product photography on a white or near-white seamless sweep.
  Soft, even, shadowless studio light (a faint contact shadow only), true whites, cool
  neutrals, the product perfectly centered or in clean 3/4 view. Props limited to laboratory
  glassware, water, a single ingredient element (a citrus slice, a kelp strand) placed with
  tweezers-precision. Teal may appear as a prop accent, never as a colored backdrop. Banned in
  photos: lifestyle clutter, hands wearing rings, warm golden-hour light, bokeh, dramatic
  shadows, marble countertops. The photo should look like evidence, not ambiance.

7. THE SPINE

Hook → convince → offer → order form. The buyer never sees the skeleton; they feel a calm
professional walking them from symptom to solution to signature.
- Price placement: Remède prints the price EARLY IN THE HERO, small and unashamed, the way a
  pharmacy shelf label does — near the CTA, in tabular figures with the old price struck in
  one thin line. The sticky bar repeats it.
- Sticky CTA: a full-width bottom bar on mobile — white ground, 1px top border #DCE9E7, price
  on the reading side, teal pill button "Commander — paiement à la livraison" opposite. It
  appears after the hero scrolls past and smooth-scrolls to the form.
- Mobile-first: designed at 390px. Desktop law: RESPONSIVE EXPANSION — max content width
  1080px, hero goes two-column (text | product), convince sections pair up (bars | photo),
  the form stays a single centered 560px column.

8. BLOCKS TREATMENT

Supported blocks and their Remède dressing:
- announcement-bar: one line, mint ground, teal text, a single rotating message pair —
  "Paiement à la livraison" / "Livraison 24-48h". No countdown inside it.
- problem-solution: dressed as "symptômes → protocole". Two or three symptom lines with
  cross-in-circle markers, then the product photo with a one-sentence protocol answer.
- benefits-icons: ALWAYS the blister-pack grid. 4-6 capsule cells, icon + label + one support
  line. Never a bare 3-column icon row.
- ingredients-infographic: the world's centerpiece — dosage bars per ingredient with mg/%
  values, plus a "sans" list (sans parabènes, sans sucre) in small capsule chips.
- how-it-works-steps: the posologie strip — J1/J7/J14/J28 markers with one line each, walking
  the cure timeline. Steps may alternate with small product photos.
- before-after: clinical framing — two photos side by side in flat bordered frames, a "J0 /
  J28" caption in tabular figures, and an honesty line ("résultats individuels variables").
  No slider theatrics; a static pair reads more credible here.
- stats-band: 3-4 counters in tabular figures on a mint band — "12 400 cures livrées",
  "94% satisfaites", "48h livraison". Counters count up once.
- photo-reviews: flat white cards, 1px border, name + city + verified-order chip, stars as
  small teal crosses (the world's star substitute), 1-3 measured sentences. No avatars.
- guarantee-seal: a circular stamp-like badge drawn in 1.5px teal line — "Satisfait ou
  échangé — 14 jours" — beside the reassurance sentences. Flat, never gold, never waxy.
- price-anchor: the pharmacy shelf label enlarged: old price struck with one thin line, new
  price in 700 tabular figures, per-day math underneath ("soit 43 DA / jour").
- bundle-offers: cure durations, not "packs" — 30 / 60 / 90 jours cards; per-day price falls
  as the cure lengthens; the recommended cure carries a thin teal "Conseillé" chip.
- order-steps: 4 steps in capsule cells — commande → appel de confirmation → livraison 24-48h
  → paiement à la porte. The confirmation-call step is emphasized; it is this world's
  trust-native move.
- faq: flat accordion, 1px dividers, cross glyph rotating 45° when open. Questions in 600.
- trust-footer: one quiet band — brand line, phone and WhatsApp contact, return policy link,
  "paiement à la livraison — 58 wilayas" line. No social wall.

Refused blocks:
- lottery-contest: a pharmacy does not raffle. Prize wheels destroy clinical credibility.
- whatsapp-proof: chat screenshots read as gossip here; proof must look audited, not
  forwarded.
- stock-urgency: scarcity panic is the opposite of prescribed calm. Availability is assumed.

9. HERO MENU

- The leaflet stack: centered product photo, name, one measured promise line, price with
  struck anchor, CTA, three micro-trust chips (COD, 48h, échange 14j). The default posture.
- The lab bench split: photo on one side (product + one ingredient prop), text stack on the
  other; at 390px the photo sits above, cropped tight.
- The dosage hero: the product at left-third, and the hero's right side IS three dosage bars
  filling on load — leading with the formula before any lifestyle promise.
- The clinical pair: a restrained before/after pair as the hero visual, J0/J28 captions, the
  price and CTA beneath. For transformation products with strong photo proof.
- The ordonnance card: the entire hero framed as one white bordered card resembling a
  prescription sheet — product name on the top rule, promise as the "indication" line, price
  as the "tarif" line, CTA at the card foot.
- The protocol story: one sentence of symptom empathy in large display type over white, the
  product photo small and clinical beneath it, price chip and CTA following. The quietest
  opening; for audiences tired of being shouted at.

10. FORM MENU

- The prescription card: one white card, 1px border, all fields stacked — nom complet,
  téléphone, wilaya select, options — with the guarantee line printed at the card foot like a
  pharmacist's note. Submit = teal pill.
- The consultation wizard: three gentle steps (votre cure → vos coordonnées → confirmation),
  a thin teal progress line, one screen per step. For pages selling multi-duration cures.
- The hero-echo: a compact two-field strip (téléphone + wilaya) directly under the hero CTA
  for the decided buyer, repeated as the full prescription card at the page end. The compact
  strip states "on vous rappelle pour confirmer".
- The sticky-driven sheet: the sticky bar's button opens the full form as an anchored section
  scroll (never a modal); the form itself is the prescription card.

11. MOTION IDENTITY

Precision fades: entrances are opacity 0→1 with y:16→0, power1.out, 0.5–0.6s, staggered 0.08s
within groups. Nothing slides horizontally except nothing — vertical settle only. The ONE
signature scroll moment: dosage bars filling with their count-ups, once, at 70% entry, 0.9s
power1.inOut. The sticky bar fades in over 0.3s. FAQ opens at 0.25s ease-out. Reduced motion:
all entrances become instant (gsap.set at final values), bars render pre-filled at their
values, count-ups print final numbers. Banned motion: bounces, overshoot of any kind,
parallax, pinned sections, rotating elements, pulse loops, anything that would make a
pharmacist look twice.

12. BAN LIST

Generic slop: purple-to-blue gradients on white, glassmorphism, emoji as design system,
Poppins-for-everything, lorem ipsum, fake trustpilot logos, cookie-cutter 3-column icon rows
with drop shadows, hero carousels, parallax, backdrop-blur.
Neighbors' tics, banned by name: gabarit's dimension lines with mm/cm annotations and
title-block cartouches; pupitre's footnote system and wax-seal crest; clair's duotone spot
illustrations and soft-shadow floating cards; circuit's feature leader lines and PCB trace
dividers; hammam's steam veils, pebble stacks and ripple rings; souk's starburst badges;
kenz's spotlight cone. If a build wants a callout line pointing at the product, it is in the
wrong world — that is circuit's move.
Refused blocks (restated): lottery-contest, whatsapp-proof, stock-urgency.
This world's own temptations, banned: medical-blue full-bleed sections (stay white), DNA
helix or molecule clip-art, stock photos of doctors, star ratings drawn as yellow stars
(stars are teal crosses here), the word "miracle" in any language.

13. EXAMPLE VARIATIONS

- "Cure Marine" (health & wellness): leaflet-stack hero for a collagen cure; order:
  announcement-bar, benefits blister grid, ingredients dosage bars, posologie strip,
  photo-reviews, price-anchor with per-day math, bundle cures 30/60/90, order-steps, faq,
  trust-footer; prescription-card form. Mood: the flagship pharmacy calm; the dosage-bar
  moment carries the page.
- "Peau Neuve" (beauty & cosmetics): clinical-pair hero (J0/J28 faces) for a serum; order:
  problem-solution symptoms, ingredients bars, before-after enlarged mid-page, stats-band,
  guarantee-seal, price-anchor, order-steps, faq; consultation-wizard form. Mood: dermatology
  consult; the before-after pair is the emphasis and the bars stay small.
- "Vet Formula" (pets): lab-bench-split hero for a joint supplement; order: benefits grid,
  how-it-works posologie by weight, dosage bars, photo-reviews from pet owners, price-anchor,
  bundle by animal size, faq, trust-footer; hero-echo form ("on vous rappelle"). Mood: the
  veterinary counter — same calm, warmer copy.
- "Protocole Nuit" (health & wellness): protocol-story hero for a sleep formula; order:
  problem-solution, ingredients bars, stats-band, photo-reviews, guarantee-seal,
  price-anchor, order-steps, faq; sticky-driven sheet form. Mood: the quietest build — wide
  white, few blocks, the count-up stats as the single flourish.
- "Ordonnance Éclat" (beauty & cosmetics): ordonnance-card hero for a hair ampoule kit;
  order: blister benefits, posologie J1→J28, before-after, photo-reviews, bundle-offers,
  order-steps, faq, trust-footer; prescription-card form with the wizard's progress line
  removed. Mood: prescription-as-object; the hero card motif echoes in every section frame.
- "Dose Sport" (health & wellness): dosage hero (bars in the hero itself) for an electrolyte
  formula; order: benefits grid, comparison against sugary drinks via stats-band pairing,
  photo-reviews, price-anchor, bundle 30/60/90, faq; hero-echo form. Mood: the most modern
  build — Plex at its tightest, clinical blue allowed on info chips.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
