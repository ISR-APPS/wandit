import type { DesignWorld } from "../types";

export const bureau: DesignWorld = {
	id: "bureau",
	name: "Bureau",
	family: "executive-desk",
	tagline: "Banker-lamp green, walnut and quiet authority",
	kind: "cod",
	mood: ["executive", "composed", "leathered"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"home & kitchen",
		"jewelry & watches",
		"electronics & gadgets",
		"fashion & apparel",
	],
	avoidFor: ["kids & baby", "pets", "fitness equipment"],
	fusesWith: ["kenz", "qahwa"],
	preview: {
		ground: "#F5F1E8",
		ink: "#26201A",
		accent: "#1E5C46",
		fontFamily: "Libre Caslon Text",
		sampleWord: "Bureau",
	},
	doc: `
BUREAU — THE CORNER OFFICE AT 8AM

1. PHILOSOPHY

Bureau sells to the man who arrives before his assistant and leaves after the cleaners — or
to whoever is buying his gift. It is the corner office at eight in the morning: walnut still
cold, the banker lamp already warm, a leather valet tray holding yesterday's watch. This
world moves at the speed of signatures, not sales. Its persuasion is composure: paper-cream
grounds, one pool of green lamplight, brass that says its name once and never again. The
COD funnel underneath is unchanged — hook, convince, offer, order form — but Bureau walks
it like a contract review: the hero states the object and its price without ceremony, the
middle testifies in materials (full-grain, solid walnut, machined brass), the offer is a
line item, and the form is signed at the door when the courier arrives. Copy is short,
declarative, third-person confident with second-person address reserved for the close. If
a sentence would sound wrong read aloud in a boardroom, it does not ship. Bureau serves
desk goods, writing instruments, watches and leather accessories, and the quieter end of
office electronics — objects a man keeps for a decade and mentions never.

Self-audit checklist — answer yes before shipping:
- Does the hero read as a lit desk, not a product grid?
- Is the banker-lamp glow visible as LIGHT pooling on content, exactly once per viewport?
- Are all leather surfaces deboss-only — zero stitches, zero metallic foil?
- Is brass confined to nameplates, the pen, and price numerals?
- Could every sentence survive a boardroom reading?
- Is the green never brighter than #1E5C46 — lamp glass, not lime?
- Does the form feel like signing for a delivery, with COD reassurance stated plainly?
- Zero horizontal overflow at 390 / 768 / 1440, fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. In order. Invisible.
- Palette registers: paper #F5F1E8 grounds with walnut #3A2A1E sections; banker green
  #1E5C46; ink #26201A; brass #B4934E; oxblood #5C2E2A capped at 6%.
- Type stacks: display Libre Caslon Text or Playfair Display; body Inter. Arabic display
  Amiri; body Almarai.
- The three owned tics: banker-lamp glow, deboss panels, brass nameplate labels.
- Motion identity: measured — 0.5s power2 fades; the lamp warms up once over the offer.
- Desktop law: responsive expansion, max 1040px.
- Refused blocks: lottery-contest, countdown, stock-urgency, whatsapp-proof.
- Imagery style: executive desk photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu, or a justified invention within it.
- Block choice within the supported set, and BLOCK ORDER — a pen page and an organizer
  page must not share a rundown.
- Form style from the form menu.
- Proof lead: photo-reviews or press-badges or quiet spec authority — pick per product.
- Where the walnut interludes fall, and whether oxblood appears at all.
- Section density: a single pen may run 8 measured beats; a full desk set 13.
Every client receives a new sibling — same office, different desk. Repeating a previous
build's hero + form + block order fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: paper #F5F1E8 base; alternate #EFE9DD; walnut interludes #3A2A1E (max two per
  build); card surface #FBF8F1.
- Ink: #26201A headings, #4A4038 body, #8A7E6E captions; paper ink on walnut is #F5F1E8.
- Banker green #1E5C46: the lamp's glass, key labels, the primary CTA fill, one underline
  per viewport at most. May deepen to #164536, never brighten.
- Brass #B4934E: nameplate fills, the price numerals, pen photography echoes; under 5% of
  any viewport. Oxblood #5C2E2A: one accent object per build (a ribbon marker line, a seal-
  free stamp of color on the guarantee), 6% cap.
- Display type: hero clamp(1.8rem, 6.4vw, 2.6rem), line-height 1.18; section titles
  clamp(1.35rem, 5vw, 1.85rem); body clamp(0.98rem, 4vw, 1.05rem), line-height 1.62 Latin /
  1.8 Arabic. Labels 11px caps, letter-spacing 0.14em (Latin only).
- Radii: 6px on cards and fields — filing-cabinet corners, softened; the CTA 8px; imagery
  6px. Nothing pill-shaped except nothing; Bureau owns no pills.
- Borders: 1px #D8CFC0 hairlines on paper cards; walnut sections borderless. Shadows:
  banned except the lamp glow itself.
- BANKER-LAMP GLOW (tic): a radial gradient pool — center rgba(240,220,160,0.32) warmed by
  rgba(30,92,70,0.10) at the rim, transparent by 70% — anchored to a drawn or photographed
  banker lamp, pooling over the key content of a section (the price, the offer card, the
  hero object). One pool per viewport, always motivated by a lamp presence.
- DEBOSS PANELS (tic): leather cards rendered tone-on-tone — ground #E9E2D4 with an inset
  relief border achieved by a 1px lighter top-start edge and 1px darker bottom-end edge
  (blind emboss), content pressed 2px inward. Zero metallic, zero stitching, zero grain
  exaggeration.
- BRASS NAMEPLATE LABELS (tic): section labels and badges as engraved brass plates — brass
  fill, 2px darker brass inner keyline, label in ink caps letterpressed (1px lighter text
  shadow downward), corners 2px. Screwless, always horizontal, max width 60% of column.
- Spacing rhythm: sections clamp(60px, 15vw, 92px); desk photography given wide margins.

4. COLOR PHYSICS

Ground register: paper #F5F1E8 to #EFE9DD — the page is stationery, not screen. Walnut
#3A2A1E carries at most two interludes (the offer, or provenance); a third turns the office
into a cigar bar. Ink register: #26201A / #4A4038 / #8A7E6E, three steps, never gray-blue.
Accent physics: banker green is the world's authority color — CTA fill, lamp glass, chosen
labels; it never floods a ground. Brass is engraved value — nameplates and prices only.
Oxblood is the single personal effect — one appearance per build. Forbidden: black
(#26201A is as dark as ink gets on paper), pure white, blues of any kind, lime or mint
(telj and atay territory), red urgency, gradients outside the lamp glow, silver, and coffee
furniture of any sort (qahwa's rings and sleeves stay in the café).

5. TYPOGRAPHY

Latin stack. Display: Libre Caslon Text (700) — book-plate authority; Playfair Display
(600) as the alternative when the client wants more contrast. Body: Inter (400/600).
Pairing rule: ONE display + Inter, per build; display appears in the hero, section titles,
prices and nameplates; Inter carries argument and form. Small caps labels tracked 0.14em.
Arabic stack. Display: Amiri (700) — its bookish naskh matches Caslon's gravity. Body:
Almarai (400/700). Pairing rule: Amiri + Almarai always; Arabic display sits ~8% smaller
at the same clamp.
RTL law: logical properties throughout; no letter-spacing on Arabic; Arabic body line-height
1.8; digits Western, prices wrapped LTR ("349 AED" as one unit); the deboss light edge and
nameplate letterpress shadow keep a top-start light source when mirrored; x-drift flips.

6. SIGNATURE ART AND COMPONENTS

The lamp is the world's hearth: every build draws or photographs one banker lamp and lets
its glow pool exactly where attention should rest. Deboss panels carry the leather story —
specs, guarantees, reviews pressed quietly into the surface. Brass nameplates name what
matters: sections, the product, the price. Supporting cast: a walnut rule (2px #3A2A1E)
under section titles on paper; ledger rows for specs (hairline-separated, value
right-aligned in Inter tabular); a pen-nib bullet (small brass nib glyph) for lists; the
oxblood ribbon-line as a page marker beside key paragraphs; order-step markers as brass
plate numerals. Photography sits in 6px frames or bleeds within its section.

Component measurements, for the builder's hand: nameplates run 28-36px tall with 10-14px
horizontal padding and a 2px inner keyline inset 3px from the edge; ledger rows sit on a
44px rhythm with 1px hairlines and 16px label-to-value gutters; deboss panels take 20-24px
padding with the relief border inset 8px; the lamp pool spans 60-75% of its section's
width and never crosses a section boundary; the oxblood ribbon-line is exactly 3px wide
and full card height. Copy register: sentences average eleven words; verbs of possession
and endurance (keeps, holds, outlasts) over verbs of excitement; numbers written plainly
(twelve months, not 12 MONTHS!); the only permitted warmth is the closing line before the
form — one sentence acknowledging the man or the giver.

Imagery. Executive desk photography: walnut desk surfaces, one green banker lamp glowing
warm, embossed leather goods (valet trays, folios), machined brass pens, a wristwatch
resting face-up, morning office light through blinds from the start side, deep composed
shadows. Macro on material honesty: leather relief, brass knurling, walnut grain. Banned in
photos: faces and hands with logos, glass towers, laptops with visible brands, coffee cups
(qahwa's), stitching close-ups (caravane's), gold jewelry displays (dahab's), harsh flash.

7. THE SPINE

Hook, convince, offer, order form — the contract's clauses in order. Price placement:
Bureau states the price IN THE HERO, brass numerals under the title, no strike theater by
default (old price, when used, is a single thin rule through smaller brass). Sticky CTA: a
paper bar with hairline top, product name in display, price in brass, and a banker-green
button labeled to order; it appears once the hero scrolls past and leads to the form.
Mobile-first at 390px. Desktop law: responsive expansion to max 1040px — the desk widens,
imagery and ledger rows go two-column, the lamp pool holds the offer column.

8. BLOCKS TREATMENT

Supported blocks, dressed by Bureau:
- announcement-bar: one paper line, hairline beneath — delivery time + pay-on-delivery,
  separated by a brass middot. Static.
- problem-solution: the cluttered-desk paragraph against the composed-desk photograph; two
  pains, one verdict, the lamp pooling on the answer.
- benefits-icons: 3-4 pen-nib bulleted lines — material, mechanism, warranty, presentation
  — set as a ledger, not icon circles.
- spec-table: the ledger proper — hairline rows, labels in caps, values right-aligned
  tabular; walnut header row on paper.
- unboxing-gallery: what the box contains — deboss panel with a quiet flat lay photo and a
  numbered manifest (1 organizer, 1 pen, 1 tray...).
- photo-reviews: 2-4 deboss panels, reviewer name + title-like city line ("K. Mansouri —
  Dubai"), stars as small brass nibs, two sentences maximum.
- press-badges: a single paper row of grayscale press marks with a brass nameplate reading
  "as noted in" — only when the client has real citations.
- guarantee-seal: a deboss panel carrying the oxblood accent — 12-month mechanism warranty,
  7-day exchange — closed by a brass nameplate.
- bundle-offers: two or three ledger columns (the pen alone, the set, the full desk),
  chosen column's nameplate fills brass; feeds the form.
- cross-sell: one line beneath the offer — "add the matching card holder" — with a small
  deboss thumbnail and a checkbox that behaves like initialing a clause.
- price-anchor: the line item — object, brass price, payment-at-door clause beneath, lamp
  glow pooled on it.
- order-steps: four brass-numbered plates — order, confirmation call, delivery, payment at
  the door. One line each.
- faq: 4-6 ledger questions, hairline rules, answers in boardroom brevity.
- trust-footer: walnut ground, the marque in display, phone + hours, policies in small
  paper type.
Refused blocks: lottery-contest (unthinkable in this office), countdown and stock-urgency
(authority does not fidget), whatsapp-proof (correspondence here is signed, not chatted).

9. HERO MENU

- The Lit Desk: full-width desk photograph, lamp glowing over the object, title and brass
  price on the paper margin below, green CTA. The default.
- The Nameplate: object centered on paper, an oversized brass nameplate carrying the
  product name as the title, price beneath, lamp glow from the start-side corner.
- The Ledger Split: photo end-side, start-side a ledger stack — name, three material
  lines, price, CTA — hairlines between.
- The Valet Tray: overhead flat lay of the set arranged in its tray, title band across the
  lower third on walnut, price in brass.
- The Provenance Page: walnut hero, paper card floating with the object photo, a short
  origin paragraph, price and CTA — for builds selling maker story first.
- The Morning Blinds: photo with strong blind-light stripes, title set in the shadowed
  band, lamp unlit until the offer (its warm-up lands there). Use once per client at most.

10. FORM MENU

- The Delivery Docket: single paper card ruled like a form — name, phone, city/emirate,
  address note — each field hairline-underlined, signed with the green CTA. The default.
- The Two Clauses: 2-step wizard — clause one the configuration (bundle, engraving text if
  offered), clause two the coordinates; brass step plates track progress.
- The Standing Order: compact 2-field echo (phone + city) beside the hero price for repeat
  clientele, full docket at the page end.
- The Counter Signature: the sticky bar opens the docket with fields focused — for short
  single-object builds.

11. MOTION IDENTITY

Measured. Entrances: opacity with 12px rise, 0.5s, power2.out, staggered 100ms; ledger rows
settle in sequence. The ONE signature moment: the banker-lamp glow WARMS UP once over the
offer — radial pool fading from nothing to full warmth in 1.1s, sine.inOut — as the offer
enters. Nameplates arrive already engraved (no draw-on). No loops, no parallax, no
overshoot, no typed text. Reduced motion: everything static, lamp already warm. All motion
gated on gsap + ScrollTrigger; the page reads fully with JavaScript off.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur (voltage's only), back.out overshoot (guimauve's). Neighbors banned by name:
caravane's saddle stitches and brass rivets; kenz's spotlight cone, gold dust and velvet
jewel-box (Bureau's lamp pool is warm and motivated by a lamp, never a theatrical cone in
darkness); pupitre's footnote system, Oxford double rules and wax-seal crest; riviera's
ceramic plaques; chantier's steel plates and corner bolts; orfevre's self-drawing gold
engravings; qahwa's coffee-ring stains, latte swirls and sleeve bands (sibling wall — no
coffee furniture on this desk); an2000's chrome; hypertexte's web furniture. Bureau's own
temptations, banned: gold instead of brass, a second lamp pool per viewport, stitched
leather, blue ink, marble textures, exclamation marks. Refused blocks: lottery-contest,
countdown, stock-urgency, whatsapp-proof.

13. EXAMPLE VARIATIONS

- "Meridian Standard" — home & kitchen (walnut desk set). Lit Desk hero; blocks:
  announcement, problem-solution, benefits-ledger, spec-table, unboxing, photo-reviews,
  guarantee, price-anchor, order-steps, faq, trust-footer; Delivery Docket form. Lamp
  warm-up on the price-anchor. Mood: 8am, contracts out.
- "The Signature Pen" — jewelry & watches adjacent (brass fountain pen). Nameplate hero;
  blocks: announcement, benefits, spec-table (nib, mechanism), photo-reviews, guarantee,
  cross-sell (leather sleeve), price-anchor, order-steps, trust-footer; Counter Signature
  form. Lamp pool on the hero nameplate. Mood: one instrument, one owner.
- "Valet & Watch" — jewelry & watches (leather valet + watch roll). Valet Tray hero;
  blocks: announcement, problem-solution, benefits, unboxing, photo-reviews, press-badges,
  guarantee, bundle-offers (tray / tray+roll), price-anchor, order-steps, faq,
  trust-footer; Two Clauses wizard. Warm-up on bundle column. Mood: end-of-day ritual.
- "The Gift Order" — fashion & apparel adjacent (folio + card holder gift). Ledger Split
  hero; blocks: announcement, benefits, unboxing (gift presentation), photo-reviews,
  guarantee (gift exchange clause), price-anchor, order-steps, faq, trust-footer; Delivery
  Docket with gift-note field. Warm-up on unboxing. Mood: chosen for him.
- "Desk Electronics, Quietly" — electronics & gadgets (walnut wireless charger). Provenance
  Page hero; blocks: announcement, problem-solution (cable clutter), spec-table, benefits,
  photo-reviews, guarantee, cross-sell (pen), price-anchor, order-steps, trust-footer;
  Standing Order echo + docket. Warm-up on spec-table. Mood: technology in walnut.
- "The Corner Office Opens" — home & kitchen (full executive set, flagship). Morning Blinds
  hero; blocks: announcement, problem-solution, benefits, spec-table, unboxing,
  photo-reviews, press-badges, guarantee, bundle-offers, price-anchor, order-steps, faq,
  trust-footer; Two Clauses wizard. The unlit-to-lit lamp carries the page. Mood: opening
  day of a serious marque.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
