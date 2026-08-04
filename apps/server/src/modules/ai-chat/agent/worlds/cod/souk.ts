import type { DesignWorld } from "../types";

export const souk: DesignWorld = {
	id: "souk",
	name: "Souk",
	family: "loud-promo",
	tagline: "Friday-market energy — prices that shout and mean it",
	kind: "cod",
	mood: ["loud", "festive", "urgent", "bazaar"],
	energy: "loud",
	priceFeel: "accessible",
	industries: [
		"home & kitchen",
		"electronics & gadgets",
		"fashion & apparel",
		"car accessories",
		"fitness equipment",
	],
	avoidFor: ["jewelry & watches"],
	fusesWith: ["teleachat", "bonplan", "dukkan", "khodra"],
	preview: {
		ground: "#FFC917",
		ink: "#191411",
		accent: "#E42313",
		fontFamily: "Lalezar",
		sampleWord: "تخفيض!",
	},
	doc: `
SOUK — THE WORLD DOC

1. PHILOSOPHY

Souk is the Friday market at full voice. It is the stall where the seller stands on a crate,
holds the product over his head, and tells the whole street the price — and the street stops,
because the price is real. This world sells the way the Maghreb actually buys: out loud, in
daylight, with the discount written in numbers big enough to read from across the road. Nothing
here whispers. Nothing here apologizes. But — and this is the soul of the world — nothing here
lies either. Souk is loud the way a wedding is loud: from joy and conviction, not desperation.
The yellow is the sun on tarpaulin. The red is the marker the seller uses to slash yesterday's
price. Every element earns its noise by carrying information a buyer wants: what it costs, what
it costed, how long the deal lasts, how many neighbors already bought one.

The danger of a loud world is mush — when everything shouts, nothing is heard. Souk survives by
hierarchy of volume: ONE starburst per viewport shouts the price, one strip pulses, and the rest
of the section holds still in dense, honest, black-on-yellow or black-on-white layout. Density
is welcome; chaos is banned. Think of a well-run stall: crowded, but the seller knows where
every item sits.

Self-audit checklist — answer YES to ship:
- Can a buyer read the current price within one second of landing, without scrolling?
- Is there exactly ONE starburst badge visible per viewport, never two competing?
- Does every red element carry price/urgency information (never decoration)?
- Is the old price visibly slashed with the arrow pointing to the new one somewhere on the page?
- Do the yellow and white grounds alternate so sections are countable at arm's length?
- Would a real Algiers stall-holder recognize the voice as his own, not a parody?
- Is the page still dense and readable with JavaScript off?
- Did you keep green under 8% and only on delivery/free flags?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook, then convince, then offer, then order form. Invisible, inviolable.
- Palette registers: sun-yellow grounds #FFC917 alternating with #FFFFFF; ink #191411; fire-red
  register #E42313 to #F03A2B; market green #0A8F3C capped at 8% and only for delivery/free
  flags.
- Type stacks: display Lalezar or Changa; body Rubik or Almarai. Both scripts, always.
- The three owned tics: starburst price badges, price-slash theater, split-flap countdown.
- Motion identity: megaphone pulses — expo.out entrances at 0.35s, continuous gentle pulse on
  price badges, the slash-and-arrow signature moment. No overshoot easing, ever.
- Desktop law: centered mobile shell, ~440px, on a patterned yellow ground.
- Refused blocks: spec-table, ingredients-infographic.
- Imagery style: bazaar-poster product photography — saturated backdrop, hard bright light, high
  energy (full spec in Signature Art).

CLIENT-OWNED — must be re-decided fresh, every single build:
- Hero composition (pick from the hero menu, or invent within the world's voice).
- Block choice from the supported set, and BLOCK ORDER — a vacuum funnel and an abaya funnel
  must not share a sequence.
- Form style (from the form menu).
- Proof type: photo-reviews or whatsapp-proof or stats-band — rotate the lead proof.
- Accent rotation within the red register; which sections sit on yellow vs white.
- Section density and rhythm: some builds are machine-gun short sections, others breathe.

Every client receives a new sibling of Souk — same blood, new face. A clone is a failed build.

3. VISUAL SIGNATURES

Measured law. Grounds: #FFC917 (sun) and #FFFFFF (stall canvas), alternating; never two yellow
sections adjacent. Ink #191411 — a warm near-black, never pure #000. Red register #E42313 to
#F03A2B for price, urgency, slashes. Market green #0A8F3C only on delivery/free chips.

Type scale (shared Latin/Arabic): display clamp(2.1rem, 8.5vw, 3.4rem) — Arabic display sits at
90% of the Latin value; section titles clamp(1.45rem, 6vw, 2.1rem); body clamp(0.95rem, 4vw,
1.05rem); price numerals in starbursts clamp(1.6rem, 7vw, 2.6rem), weight 700+.

Shapes: radius is small and workmanlike — 10px on cards, 12px on form fields, 999px only on the
sticky pill. Borders: 2px solid #191411 on offer cards (honest stall-table edges). Shadows:
one flat ambient only, 0 6px 0 rgba(25,20,17,0.08) — soft, never the hard offset kind.

The tics, precisely:
- Starburst price badge: a 16-to-20-point serrated star (SVG polygon), fill red register, price
  in white inside, rotated -6deg to -10deg, min 96px wide on mobile. ONE per viewport. It
  carries the continuous pulse (scale 1 to 1.06, 1.1s, sine yoyo).
- Price-slash theater: old price in ink at 0.9em, crossed by a hand-drawn X (two SVG strokes,
  4px, red, slight wobble in the path), then a chunky arrow (SVG, red) pointing at the new
  price at 1.6em minimum. The X draws stroke-by-stroke and the arrow shoots in on scroll.
- Split-flap countdown: each digit a tile 44x56px, ink ground, yellow numeral, a 1px horizontal
  seam across the middle (pseudo-element), 6px radius. Digits change with a quick rotateX flap
  (0.3s). Tiles sit in pairs with a colon gap: أيام, ساعات, دقائق, ثواني labels beneath in
  0.7rem.

Spacing rhythm: sections run tight — 40px to 56px vertical padding on mobile, never more. Souk
does not do luxury air.

4. COLOR PHYSICS

Ground register: #FFC917 base sun-yellow; a build may warm it to #FFD23F or deepen toward
#F5BD00, but yellow stays unmistakably yellow — no cream, no mustard-brown. White sections are
pure #FFFFFF. Alternation is law: yellow, white, yellow, white; the order form always sits on
white for legibility, inside a yellow-framed card if the build wants heat.

Ink register: #191411 to #221B15. Never gray text; secondary text is ink at 70% opacity.

Accent register (red): #E42313 core, #F03A2B hot variant; a build picks ONE and holds it. Red
is a siren: prices, slashes, countdown urgency, the starburst, the CTA. If a red element could
be deleted without losing information, it should never have been red.

Support: market green #0A8F3C, hard cap 8% of visible surface, only on "توصيل مجاني" /
free-delivery / in-stock flags. Forbidden colors: any blue, any purple, any pastel, gradients of
any kind (Souk is FLAT — a gradient is a lie on a market stall), black backgrounds (that is the
night; Souk sells at noon).

5. TYPOGRAPHY

Latin stack: display Lalezar (its Latin glyphs carry the same bazaar weight) or Changa 700-800;
body Rubik 400/500/700, alternative Almarai for a softer build. Mono is not part of this world.
Arabic stack: display Lalezar first choice — it IS the hand-painted souk sign — or Changa
ExtraBold; body Rubik (excellent Arabic coverage) or Almarai 400/700. Pairing rule: display and
body must come from DIFFERENT families; Lalezar for shouting, Rubik for explaining.

Size clamps are shared across scripts (see Visual Signatures) with Arabic display at 90% of the
Latin computed size. Weight rules: display never below 700 visual weight; body 400 with 700
emphasis; prices always 700+.

RTL law: build with logical properties (margin-inline, padding-inline, inset-inline) so the
mirror is free. NEVER letter-spacing on Arabic — it severs the letterforms; tracking games are
Latin-only. Arabic body line-height 1.7 to 1.9; display 1.2. Digits: Western Arabic numerals
(0-9) for all prices and phone numbers, as DZ commerce actually writes them; wrap phone numbers
in an LTR span. Chevrons and the slash-arrow flip direction in RTL — forward points left.

6. SIGNATURE ART AND COMPONENTS

The starburst badge is the crown jewel: serrated SVG star, red on yellow or red on white, price
in white bold inside, tilted, pulsing. It marks THE price moment of each viewport — hero, offer,
form header. Supporting cast: stall cards (white, 2px ink border, 10px radius, tight padding);
megaphone chips (small ink-on-yellow caps labels with a tiny loudspeaker glyph for announcements
); flag chips (green, white text, only delivery/free); tally chips (ink pills showing "+2,340
طلب" style counts). Dividers between same-ground blocks: a 3px dashed ink rule, like the chalk
line on a stall table. The price-slash unit and split-flap tiles (spec in section 3) complete
the kit. Buttons: CTA is a red slab, 56px tall minimum, white Lalezar/Changa text, 10px radius,
2px ink border — it must look pressable with a thumb in one second.

Imagery: bazaar-poster product photography. Saturated seamless backdrop in sun-yellow or hot
red, hard bright frontal light with crisp shadows, the product hero-scaled and centered or
held mid-air, bold red props (crates, ribbons, price tags without text), zero mood haze, zero
lifestyle clutter. Grain minimal; punch maximal. Banned in photos: pastel sets, marble, plants,
moody rim light, white-on-white minimalism, any visible text or logos. Every photo in one build
uses the SAME backdrop hue family so the page reads as one poster. This spec must be reproduced
for any product: a vacuum, an abaya, a dumbbell — all get the same treatment.

7. THE SPINE

Hook, convince, offer, order form — in that order, invisible to the buyer, unbreakable by the
builder. Souk's price placement: EARLY-HERO, always — the starburst carries the price inside
the first viewport; Souk never hides a price behind a scroll. The sticky CTA is a full-width
bottom bar on mobile: red slab, white text "اطلب الآن — الدفع عند الاستلام", with the price
repeated at its end; it appears after the hero scrolls past and taps smooth-scroll to the
order form. Mobile-first at 390px is the design canvas. Desktop law: centered mobile shell —
the funnel lives in a ~440px column, centered on a patterned yellow ground (a subtle repeating
diagonal of paler yellow stripes at 4% opacity), with the sticky bar constrained to the shell's
width. Souk never expands to desktop grids; the stall travels whole.

8. BLOCKS TREATMENT

Supported blocks and their Souk dressing:
- announcement-bar: an ink strip on top, yellow text, two alternating messages swapped by a
  quick flap (offer deadline / free delivery threshold). Never more than one line tall.
- price-anchor: the theater stage — old price slashed with the drawn X, arrow shooting to the
  new price inside a starburst. Savings stated in dinars, not just percent: "وفّر 4,000 دج".
- bundle-offers: stall crates — three bordered cards, quantity big, per-unit price falling,
  the middle card flagged "الأكثر طلباً" with a small red banner; selecting one updates the
  form. Cards sit shoulder-to-shoulder, dense.
- countdown: the split-flap tiles under a one-line reason ("السعر يرجع بعد:"). Honest restock
  line in small text beneath.
- stock-urgency: a tally chip plus a thin ink progress bar draining toward red; "بقي 17 فقط"
  with today's order count. Numbers plausible, never theatrical thousands.
- lottery-contest: the tombola corner — a bordered card with the prize photographed like any
  product, entry rule in one line ("كل طلبية = ورقة في القرعة"), draw date in a flap tile.
- before-after: a hard-split pair with corner labels "قبل"/"بعد" in bordered chips. RTL reading
  law: the "قبل" half sits on the RIGHT (readers start right) — mirror the imagery if needed
  (photos only, never text), then label truthfully.
- benefits-icons: 4-6 tight chips, ink icon on white, one-word labels; a benefits strip, not a
  benefits garden — no three-column drop-shadow rows.
- photo-reviews: stall polio — review cards with 2px ink borders, name + wilaya + stars, short
  sentences; customer photos framed square with a red corner tag "طلب مؤكد".
- whatsapp-proof: recreated chat threads inside a white card, standard bubble shapes, real
  timestamps; the header names the customer's wilaya. Souk treats these as market gossip —
  buyers trust neighbors.
- stats-band: an ink section, yellow numerals counting up — orders, wilayas covered, rating.
  Three numbers maximum; each earns a one-word label.
- variant-gallery: color/size chips as market tickets — bordered swatch squares with the
  selected one tilted 3 degrees and topped by a mini-starburst check.
- cross-sell: "زيد معاها" — one companion card at a slashed add-on price with a checkbox that
  feeds the form total.
- order-steps: four steps in a horizontal scroll strip: تملأ الاستمارة، نتصل بيك، التوصيل،
  تخلص عند الباب — each in a bordered chip with a numeral.
- trust-footer: ink ground, yellow text, phone + WhatsApp huge (tappable), wilaya coverage
  line, honest legal mentions.

Refused blocks:
- spec-table: Souk shouts benefits, it does not read datasheets — a spec table kills the
  street voice.
- ingredients-infographic: lab talk belongs to remede; the stall proves by demonstration and
  neighbors, not molecules.

9. HERO MENU

- The Criée (price-first stack): announcement strip, product name in Lalezar filling the width,
  product photo center, starburst price overlapping the photo's corner, CTA slab beneath. The
  classic stall shout.
- Stall Split: photo left 55%, stacked name + promise + slashed price + CTA right; on 390px the
  split stacks but the starburst keeps overlapping the photo seam.
- Flash Offer-Card: the entire hero is one bordered offer card on yellow — product photo inside,
  price theater inside, CTA inside — like a printed flyer pinned to the stall.
- Demo-Reel Hero: the muted product-demo loop (or poster) inside a bordered frame, starburst
  pinned to its corner, one-line promise above, CTA below. For gadgets that sell by moving.
- Crate Bundle Hero: the 3-pack bundle cards ARE the hero, price-per-unit falling left to
  right, one starburst on the best deal; for consumables and multi-buys.
- Countdown-Crown: split-flap tiles sit directly under the headline before the photo; for
  genuine deadline drops. Use sparingly — urgency in the hero must be true.

10. FORM MENU

- The Order Counter (single card): one white card, 2px ink border, all fields stacked, red CTA
  slab, COD reassurance chips directly beneath — the default stall transaction.
- Haggle Steps (multi-step wizard): three quick flaps — 1 choose bundle, 2 name + phone +
  wilaya, 3 confirm summary with the slashed total restated. Progress shown as flap tiles.
- Echo Form: a compact 2-field teaser (phone + wilaya) right under the hero for the impatient,
  repeated full-size at the page end; the teaser scrolls you to the full form on submit.
- Bar-Driven: the sticky bottom bar is the only CTA until the form; tapping opens the form
  section with fields already focused. For short punchy builds.

11. MOTION IDENTITY

Megaphone pulses. Entrances: x or y 24px slides, expo.out, 0.35s, staggered 0.06s — the crowd
assembling fast. Price starbursts carry the only continuous loop: scale 1 to 1.06, sine
in-out, 1.1s yoyo. THE signature scroll moment (one per page): when price-anchor enters, the
X-slash draws itself stroke by stroke (0.4s) and the arrow shoots to the new price (0.25s,
expo.out) — nothing else on the page may claim this beat. Split-flap digits flap with rotateX
steps of 0.3s. Reduced motion: all entrances become instant, the pulse stops, the slash and
arrow render pre-drawn. Banned motion: overshoot/elastic easings, parallax, pinned scenes,
marquees, rotation loops, anything longer than 0.5s.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji-as-design, Poppins-everything, lorem
ipsum, fake trustpilot walls, cookie-cutter icon-row-with-shadows, hero carousels, parallax,
backdrop-blur.
Neighbors' tics, banned by name: bloc's rotated flat price-chips and hard offset shadows;
cinetique's crossing marquees; guimauve's back.out bounces; teleachat's TV bezel, lower-third
straps and value-stack tower; affiche's fit-to-viewport headline; dar's gingham hem strips and
daylight beam.
Refused blocks: spec-table, ingredients-infographic.
World-specific temptations, equally banned: two starbursts in one viewport; red body text;
gradient yellows; fake countdown that resets on reload without the honesty line; black
sections; more than one pulse loop per viewport; decorative red.

13. EXAMPLE VARIATIONS

- ROCKET FRIDAY (electronics & gadgets, cordless vacuum). Criée hero, then announcement-bar,
  benefits-icons, whatsapp-proof, price-anchor with full slash theater, bundle-offers,
  countdown, order-steps, trust-footer. Order Counter form. Mood: peak Friday rush; the slash
  moment is the page's only theater, proof rides on neighbors' chats.
- QUARTIER CHIC (fashion & apparel, abaya 3-pack). Crate Bundle hero — packs as the opening
  pitch — then variant-gallery (colors as tickets), photo-reviews, stats-band, price-anchor,
  order-steps, faq, trust-footer. Haggle Steps wizard (bundle first). Mood: the fabric stall
  with the longest queue; pulse lives on the bundle best-deal badge.
- GARAGE SAMEDI (car accessories, 12V car vacuum). Demo-Reel hero showing suction, then
  benefits-icons, comparison against "المكنسة القديمة" via photo-reviews captions (no
  comparison-table needed), stock-urgency, price-anchor, cross-sell (microfiber kit),
  order-steps, trust-footer. Echo Form under the hero. Mood: weekend garage energy; the
  stock bar is the urgency carrier, countdown absent.
- COUPE DU BLED (home & kitchen, couscous-pot set). Flash Offer-Card hero, then how-it-works
  visual via order-steps, photo-reviews with customer kitchen photos, stats-band, bundle-offers,
  lottery-contest (win a full tajine set, draw on Eid), trust-footer. Bar-Driven form. Mood:
  festive pre-Eid stall; the lottery flap tile carries the date, slash theater sits inside the
  offer card.
- MUSCLE MARCHÉ (fitness equipment, adjustable dumbbells). Stall Split hero, then stats-band
  first (kilos sold), benefits-icons, whatsapp-proof from gym-rats, price-anchor, countdown
  with honest restock line, order-steps, faq, trust-footer. Order Counter form with weight
  variant chips. Mood: loud but sweaty-practical; flap tiles are the page's second voice.
- LAMPADAIRE EXPRESS (electronics & gadgets, LED projector). Countdown-Crown hero (true 48h
  drop), then demo photos strip, photo-reviews, price-anchor, bundle-offers (1x/2x),
  stock-urgency, order-steps, trust-footer. Echo Form + full form at end. Mood: tonight-only
  street screening; the crown countdown is the theater, the slash renders pre-drawn.
- SOUK EL FELLAH (home & kitchen, multi-cooker). Criée hero on white variant ground, then
  whatsapp-proof leading, benefits-icons, price-anchor, cross-sell (steamer basket),
  stats-band, order-steps, faq, trust-footer. Haggle Steps wizard. Mood: trusted morning
  market; green delivery flags do quiet work, one starburst rules the hero only.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
