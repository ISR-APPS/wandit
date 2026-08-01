import type { DesignWorld } from "../types";

export const qahwa: DesignWorld = {
	id: "qahwa",
	name: "Qahwa",
	family: "coffee-roast",
	tagline: "Roaster's counter: crema, kraft and coffee rings",
	kind: "cod",
	mood: ["roasted", "warm", "crafted", "morning"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["home & kitchen", "health & wellness", "electronics & gadgets"],
	avoidFor: ["kids & baby", "jewelry & watches", "fashion & apparel"],
	fusesWith: ["dar", "bureau"],
	preview: {
		ground: "#F3E7D3",
		ink: "#241811",
		accent: "#B97A3C",
		fontFamily: "Fraunces",
		sampleWord: "قهوة",
	},
	doc: `
QAHWA — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Qahwa is the specialty roaster's counter at eight in the morning: walnut worn smooth, the
grinder still warm, a cup ring drying where the last customer set their espresso down. This
world sells coffee gear and coffee itself — drippers, moulins, machines, beans — to people who
have decided that the daily cup deserves respect. Its persuasion is craft made visible: the
ratio written like a recipe, the origin named like a friend, the crema photographed close
enough to smell. Nothing here rushes. A pour-over takes three minutes and the page takes its
time the same way, letting warmth and competence do the selling.

The register is precise but never clinical. Where a pharmacy world proves with milligrams,
Qahwa proves with 1:16 and 92 degrees — numbers that smell of the counter, set in mono like a
barista's notebook. The imperfect coffee-ring stain is the world's honesty mark: this page has
been USED, this seller actually drinks what they sell. Copy speaks in first-person craft
("nous torréfions le mardi, vous buvez le jeudi") and never in promo theater. The spine —
hook, convince, offer, order form — runs like a brew cycle: bloom, pour, draw-down, cup.

Self-audit checklist — answer YES to ship:
- Does the hero feel like a counter you would lean on — walnut, crema, morning side-light?
- Is the price stated plainly in the first viewport, near the CTA, no theater?
- Are there at most two coffee-ring stains per section, always behind, never over text?
- Do the brew numbers (grammes, ratio, degrés) appear in mono where they matter?
- Does one latte swirl — and only one — draw itself at the offer?
- Do sleeve bands carry the section headers, corrugation visible, never plain strips?
- Fully readable with JavaScript off, zero overflow at 390 / 768 / 1440?
- Would a barista respect this page, and a grandmother still find the order button?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook, then convince, then offer, then order form. Invisible, inviolable.
- Palette registers: crema grounds #F3E7D3 alternating with roast #2E1F16; ink #241811 on
  crema, crema on roast; caramel #B97A3C; kraft #C9AE8A.
- Type stacks: Latin display Fraunces (900, soft optics) or Bree Serif, body Mulish, mono
  Space Mono for brew data; Arabic display Cairo, body Almarai.
- The three owned tics: coffee-ring stains, latte-swirl dividers, sleeve bands.
- Motion identity: slow brew — 0.6s sine fades; the single swirl draw at the offer.
- Desktop law: centered mobile shell, ~460px, on roast-brown.
- Refused blocks: lottery-contest, size-guide, before-after.
- Imagery style: specialty-coffee photography on walnut (full spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu, or invented inside the counter's voice.
- Block choice within the supported set and BLOCK ORDER — a machine funnel and a bean
  subscription funnel brew differently.
- Form style from the form menu.
- Proof lead: photo-reviews, or quiet stats, or the origin story — one leads.
- Where the roast interlude sections fall, and how many (one to three).
- Density: a lean espresso page of 8 blocks or a full tasting of 13.
Every client receives a new sibling — same counter, different morning. Repeating a previous
build's hero + block order + form combination fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: crema #F3E7D3 base; warm alternate #EFDFC6; roast interludes #2E1F16 (one to three
  per page, never adjacent); kraft panels #C9AE8A at 30% opacity over crema for quiet cards.
- Ink: #241811 headings on crema, #4A3A2C body, #8A7663 captions; on roast, crema #F3E7D3
  headings with #D9C6A8 body. Pure black and pure white are both banned — everything is
  toasted.
- Caramel #B97A3C: prices, CTAs, links, the swirl. Hover deepens to #9E6428.
- Display type: hero clamp(1.8rem, 7vw, 2.7rem), line-height 1.15 Latin / 1.35 Arabic;
  section titles clamp(1.35rem, 5vw, 1.9rem); body clamp(0.98rem, 4vw, 1.05rem) line-height
  1.65 / 1.85. Brew data in Space Mono 0.85 to 0.95rem, always with units (18g, 1:16, 92°C).
- Radii: cards 10px, fields 10px, chips 999px. Borders 1px solid rgba(36,24,17,0.14). Shadows:
  none on crema (tone separates); on roast, cards lift with a 1px crema keyline instead.
- Spacing: sections 64 to 88px vertical on mobile; roast interludes run tighter, 48 to 64px.

The tics, precisely:
- COFFEE-RING STAINS: circular cup-ring marks, 90 to 150px diameter, drawn as an irregular
  1.5 to 3px ring with one thicker arc and a faint secondary ghost ring offset 4 to 8px;
  color #B97A3C at 10 to 16% opacity on crema, crema at 8% on roast. Placement: BEHIND titles
  and card corners, one or two per section maximum, always partially cropped by an edge —
  a set-down cup, not a printed logo. Never under running body text.
- LATTE-SWIRL DIVIDERS: a single continuous rosetta-like path (SVG, 2 to 3px stroke) sweeping
  the section width with 3 to 5 leaf lobes, crema-colored on roast grounds and caramel on
  crema grounds. Static as furniture everywhere except the offer, where the ONE animated
  swirl draws itself.
- SLEEVE BANDS: corrugated cup-sleeve strips — repeating vertical ribs (6 to 8px pitch,
  alternating kraft tones) with a 1px chamfered top and bottom edge — used as section headers
  and price bands, 44 to 60px tall, carrying the section label or the price line embossed in
  ink. The sleeve is kraft on crema sections and roast-toned on interludes.

4. COLOR PHYSICS

Ground register: crema #F3E7D3 to #EFDFC6 carries 60 to 75% of the page; roast #2E1F16 to
#241811 interludes carry the drama — the offer or the origin story lives on roast. The order
form always sits on crema for legibility.
Ink register: toasted browns only — #241811, #4A3A2C, #8A7663. Secondary text is ink at 70%,
never gray.
Accent register: caramel #B97A3C to #9E6428, one temperature per build. Caramel is flavor:
prices, CTAs, the swirl, ratio highlights. Cap 12% of any viewport.
Support: kraft #C9AE8A for sleeves and quiet panels, cap 15%. Forbidden: any blue or green
(coffee has neither), bazaar red-yellow, pastel anything, pure white cups (crema is the
lightest note), gradients except the photographic ones, and cold grays.

5. TYPOGRAPHY

Latin stack: display Fraunces 900 with soft optical sizing — its plump serifs pour well — or
Bree Serif for a rounder neighborhood-café build; body Mulish 400/600; mono Space Mono for
every brew number, ratio, temperature and weight. Pairing rule: one display + Mulish + Space
Mono; the mono NEVER sets sentences, only data.
Arabic stack: display Cairo 700/800; body Almarai 400/700. Cairo's even blacks match Fraunces'
weight on the page; Almarai stays transparent. Brew data remains in Space Mono with Western
digits inside an LTR span.
Shared clamps as in Visual Signatures; Arabic display at 92% of Latin ceiling, line-height 1.35;
Arabic body 1.75 to 1.9. NEVER letter-spacing on Arabic; Latin small-caps labels (LE KIT,
ORIGINE) may take 0.08em at 11 to 12px.
RTL: logical properties throughout; the latte swirl mirrors; sleeve ribs are symmetric; ring
stains crop toward the start edge; x-slides reverse.

6. SIGNATURE ART AND COMPONENTS

The tics work as a counter ritual. Ring stains mark the page as lived-in — they anchor titles
the way a cup anchors a conversation. Sleeve bands organize: wherever the buyer must grab
something (a section's start, a price), the corrugation says "hold here, it is hot". The
swirl is the reward — poured once, at the offer, the way the rosetta lands last.

Supporting cast: kraft tasting cards (origin, notes, altitude in mono); a caramel CTA set like
a stamped sleeve; quiet 1px rules in ink at 14%; bean-count dots (3 to 5 roasted-bean glyphs)
as intensity meters for roast level — drawn 2px stroke, never emoji; the sticky bar as a slim
roast band with crema text and caramel button.

Imagery: specialty coffee photography on a walnut counter. Warm morning side-light, crema
tones, roasted beans scattered with intent, the kit's steel and wood in focus, steam allowed
as faint wisps rising from cups (never fog banks). Hands appear mid-craft — pouring, grinding
— without faces. Banned in photos: latte-art clichés shot from ceiling height, neon café
signage, laptops-and-lifestyle staging, white studio seamless. The palette must live in the
frame: walnut, crema, caramel, roast.

7. THE SPINE

Hook, convince, offer, order form — the brew order, inviolable. Price appears in the HERO,
plainly, in caramel beside the CTA: specialty buyers respect a stated price more than a
teased one. The sticky CTA is a slim roast-brown band, bottom-fixed, crema label and caramel
button, price always visible; tapping pours the page down to the form. Mobile-first at 390px.
Desktop law: centered mobile shell — the page holds ~460px on a roast-brown ground, like a
menu card standing on the counter; the ground may carry one faint oversized ring stain at 4%
opacity, page-fixed.

8. BLOCKS TREATMENT

Supported blocks, dressed by Qahwa:
- announcement-bar: one crema line on roast — delivery promise, COD, torréfaction day; mono
  for any number.
- problem-solution: the sad-cup pain (amertume, café éventé, capsules chères) told in two
  short beats on crema, answered on a roast interlude with the kit in its light.
- ingredients-infographic: for beans and blends — origin, altitude, process, notes as a kraft
  tasting card with mono data and a bean-count intensity row; for machines it becomes the
  what-is-inside card (burr type, materials).
- how-it-works-steps: the brew method in 3 or 4 steps, each with grammes and seconds in mono;
  sleeve-band header numbers the ritual.
- benefits-icons: 4 to 6 chips with 2px-stroke glyphs (grinder, thermometer, drop) — quiet,
  one line each.
- stats-band: a roast band with three crema numerals — clients servis, tasses par charge,
  jours de fraîcheur — counting once, softly.
- photo-reviews: crema cards, reviewer name and quartier, a mono detail they mention (leur
  ratio, leur méthode); one or two customer photos of home setups.
- unboxing-gallery: what the courier hands over — dripper, filtres, moulin, sachet — laid on
  walnut, each piece named with a small kraft tag drawn as text label (no string tags).
- guarantee-seal: a sleeve-band roundel: satisfait ou torréfié à nouveau — exchange window,
  COD restated; embossed look, no wax, no ribbons.
- price-anchor: old price struck in ink 60%, new price large in caramel, per-cup math in mono
  ("≈ 38 DA la tasse") — the counter argument that closes.
- bundle-offers: kit seul vs kit + recharge cards on crema; the bundle carries a sleeve band
  and the better per-cup math; feeds the form.
- cross-sell: the recharge (250g origine) as a checkbox card with mono weight and caramel
  price; added to the order without leaving the page.
- order-steps: 4 steps to the door with bean-dot markers; confirmation call promised in
  counter voice ("on confirme la mouture au téléphone").
- faq: crema rows, ink chevrons, answers that talk grind sizes and entretien; delivery and
  return questions mandatory.
- trust-footer: roast ground, crema text, phone and WhatsApp prominent, the roaster's line
  ("torréfié à Alger, bu partout") and legal quiet at the end.

Refused blocks:
- lottery-contest: a counter does not raffle its craft; prizes curdle the trust.
- size-guide: nothing here is worn; capacity lives in mono data where it belongs.
- before-after: coffee's transformation is taste, not pixels; a comparison photo would lie.

9. HERO MENU

- Le Comptoir (split): kit photo left on walnut, stack right — kicker, title, two mono data
  chips (1:16, 92°C), price, CTA; stacks vertically at 390px with a ring stain behind the
  title.
- Première Extraction (full-bleed): the pour photo full-width, title and price on a crema
  panel over its lower third, sleeve band beneath as the first section header.
- La Fiche du Torréfacteur (offer-card): the entire hero is one kraft tasting card — product,
  origin line, mono data row, price, CTA — on a roast ground.
- Lundi Matin (story-hook): a kicker names the pain ("le café du bureau, encore"), the title
  answers, photo below with price and CTA pinned on crema.
- Le Rituel (price-first): price large in caramel over crema, the kit beneath, one static
  swirl divider under the price; for offers where the number leads.
- Duo Dégustation (bundle-first): the kit + recharge bundle card as hero with per-cup math in
  mono; solo option as a quiet chip.

10. FORM MENU

- Fiche Comptoir (single card): one crema card — name, phone, wilaya select, grind-choice row
  (entière, filtre, espresso) as kraft chips, caramel submit; COD line beneath in mono-free
  counter voice.
- Écho Espresso (hero-echo): two fields (phone + wilaya) under the hero for the decided,
  repeated in full at the end.
- Deux Temps (2-step wizard): bloom then pour — coordinates first, delivery and grind second;
  progress as two bean dots.
- Barre du Matin (sticky-driven): the roast band is the only CTA until the form; tapping
  focuses the first field.

11. MOTION IDENTITY

Slow brew: opacity-led entrances with 12 to 16px rises, sine easing, 0.6s, staggers at 120ms —
the pace of a careful pour. The ONE signature scroll moment: at the offer, the latte swirl
draws itself once along its path (1.2s, stroke reveal via clip, not a line-drawing library
trick), settling as the offer's crown. Ring stains and sleeves never animate. Counters in the
stats-band rise once, gently. Banned motion: pulsing CTAs, loops of any kind, overshoot,
parallax, typewriter effects, spin. Under prefers-reduced-motion everything is visible and
still, the swirl pre-drawn. All motion gated on gsap + ScrollTrigger and never hidden in CSS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-for-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics, banned by name: grille's single oversized red circle anchor (Qahwa's rings are
plural, casual, stained — never one compositional circle); aquarelle's watercolor washes;
dar's daylight beam; khodra's crate-slat bands and wax-paper crinkle; chantier's stencil
spray; argan's oil ribbon; hikaya's copper-romance styling and subtitle strips.
Own temptations, also banned: coffee-bean rain backgrounds, chalkboard menus, burlap-sack
texture walls, barista portraits, steam fog banks, and the word "artisanal" doing the work
the photography should do.
Refused blocks restated: lottery-contest, size-guide, before-after.

13. EXAMPLE VARIATIONS

- "Kit V60 Origine" — home & kitchen. La Fiche du Torréfacteur offer-card hero; announcement-
  bar, ingredients-infographic (tasting card), how-it-works-steps, photo-reviews, bundle-
  offers, price-anchor, order-steps, faq, trust-footer; Fiche Comptoir form. Mood: the
  roaster explains, once, perfectly.
- "Moulin Manuel Pro" — home & kitchen. Le Comptoir split hero; benefits-icons, stats-band,
  how-it-works-steps, unboxing-gallery, photo-reviews, price-anchor, guarantee-seal, order-
  steps, trust-footer; Deux Temps wizard. Mood: burr-deep competence.
- "Abonnement Torréfaction" — health & wellness. Lundi Matin story-hook hero; problem-
  solution, ingredients-infographic, photo-reviews, bundle-offers (2 sachets par mois),
  cross-sell, price-anchor with per-cup math, faq, trust-footer; Écho Espresso form. Mood:
  the weekly ritual, secured.
- "Machine Espresso Compacte" — electronics & gadgets. Première Extraction full-bleed hero;
  stats-band (bars, litres), benefits-icons, how-it-works-steps, unboxing-gallery, photo-
  reviews, guarantee-seal, price-anchor, order-steps, faq, trust-footer; Barre du Matin
  sticky-driven form. Mood: crema at home, no ceremony lost.
- "Duo Dégustation Fêtes" — home & kitchen. Duo Dégustation bundle hero; ingredients-
  infographic, photo-reviews, guarantee-seal, price-anchor, order-steps, faq, trust-footer;
  Fiche Comptoir form with gift note field. Mood: the giftable counter.
- "Bouilloire Col de Cygne" — home & kitchen. Le Rituel price-first hero; benefits-icons,
  how-it-works-steps, stats-band, photo-reviews, cross-sell (thermomètre), guarantee-seal,
  order-steps, trust-footer; Écho Espresso form. Mood: precision you can pour.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
