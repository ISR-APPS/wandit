import type { DesignWorld } from "../types";

export const jnina: DesignWorld = {
	id: "jnina",
	name: "Jnina",
	family: "balcony-garden",
	tagline: "Terracotta, seed packets and first harvests",
	kind: "cod",
	mood: ["green", "hopeful", "earthy", "domestic"],
	energy: "quiet",
	priceFeel: "accessible",
	industries: ["home & kitchen", "health & wellness", "kids & baby", "pets"],
	avoidFor: ["jewelry & watches", "electronics & gadgets", "fashion & apparel"],
	fusesWith: ["khodra", "dar"],
	preview: {
		ground: "#EFF4EA",
		ink: "#2C3A26",
		accent: "#C1613C",
		fontFamily: "Salsa",
		sampleWord: "Jnina",
	},
	doc: `
JNINA — THE BALCONY POTAGER

1. PHILOSOPHY

Jnina is the fourth-floor balcony that decided to feed its kitchen. Six terracotta pots, a
bag of dark soil, seed packets fanned like playing cards — and the stubborn optimism of a
first harvest. This world sells beginnings: gardening kits, herb starters, anything that
turns a household toward green. Its persuasion is hope with dirt under its nails. Nothing
here is corporate-botanical or spa-calm; Jnina is DOMESTIC — the smell of watered clay, a
child counting sprouts, mint picked for the evening tea. The page keeps the invisible COD
spine — hook, convince, offer, order form — and walks it like a growing season: the hero
plants the promise and the price, the middle proves ease (three gestures, germination
guaranteed), the offer bundles the balcony, and the form asks only what the courier needs,
paid at the door. Copy is warm, plain, faintly proud — the neighbor who gives you cuttings,
not the agronomist. Jnina serves home & kitchen first, then wellness (grow what you drink),
kids (the sprout is the lesson) and pets (a pot of cat grass).

Self-audit checklist — answer yes before shipping:
- Does the hero smell of watered terracotta — clay, soil, young green — not of a garden
  center's promo aisle?
- Are the seed-packet cards drawn as ENVELOPES — flap, variety name — not plain cards?
- Do terracotta rim bands cap their sections like real pot rims (profile, not stripe)?
- Do seedling stakes mark steps WITHOUT numbers or measurements?
- Is the soil band used at most twice, and never as a dark-luxury moment?
- Would a ten-year-old understand every step of the how-it-works?
- Is germination guaranteed somewhere, in plain words?
- Zero horizontal overflow at 390 / 768 / 1440, fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. In order, invisible.
- Palette registers: sky milk #EFF4EA grounds with soil #4A3423 band sections; ink #2C3A26;
  terracotta #C1613C; leaf #5E8C4A; seed-paper #E9DCC2.
- Type stacks: display Bree Serif or Fraunces; body Karla. Arabic display Cairo; body
  Almarai.
- The three owned tics: seed-packet cards, terracotta rim bands, seedling-stake markers.
- Motion identity: sprout — 0.5s grow-ins from the soil line, sine.out, no overshoot; one
  stake row sprouts in sequence.
- Desktop law: responsive expansion, max 1040px.
- Refused blocks: lottery-contest, countdown, comparison-table, video-testimonial.
- Imagery style: balcony gardening photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER — a herb kit and a kids grow-set
  must not share a sequence.
- Form style from the form menu, and whether a quick echo exists.
- Proof lead: photo-reviews or whatsapp-proof — pick the neighborhood's voice.
- Where the soil bands fall (one or two), and which accent (terracotta or leaf) leads.
- Section density: a single pot may run 8 beats; the full balcony kit 14.
Every client receives a new sibling — same balcony, new season. Repeating a previous
hero + form + block order combination fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: sky milk #EFF4EA base, warm variant #F3F5EC; soil bands #4A3423 (max two);
  seed-paper surfaces #E9DCC2; card white #FBFCF8.
- Ink: #2C3A26 headings, #46543E body, #7C8874 captions; seed-paper ink #4A3423; soil-band
  ink #F1EDE2.
- Terracotta #C1613C: CTAs, prices, rim bands, pot photography echoes; may deepen to
  #A84F30 on press. Leaf #5E8C4A: sprout marks, germination checks, one underline per
  viewport; ≤10%.
- Display type: hero clamp(1.8rem, 6.6vw, 2.6rem), line-height 1.22; section titles
  clamp(1.35rem, 5vw, 1.8rem); body clamp(0.98rem, 4vw, 1.05rem), line-height 1.62 Latin /
  1.8 Arabic. Labels 11px caps tracked 0.12em (Latin only).
- Radii: 14px cards, 10px fields, 999px on the CTA (a smooth pebble-free pill) and on
  pot-rim ends.
- Borders: 1px #D9DECB on cards; seed-packet cards use a 1px #C9B892 rule plus their flap.
  Shadows banned; depth comes from paper tones and the rim bands.
- SEED-PACKET CARDS (tic): the card system — a vertical envelope 3:4-ish with a triangular
  flap fold at top (visible crease line, 1px), variety name in display across the upper
  third, illustration-or-photo window beneath, a tiny sowing line at the foot ("semis:
  mars-juin"). Used for variants, kit contents, even reviews (the reviewer as a packet).
- TERRACOTTA RIM BANDS (tic): section headers capped by a clay pot-rim PROFILE — a 18-26px
  terracotta band with the rim's characteristic lip (a 4px darker under-edge and rounded
  outer corners), running full column width above the title. Never a flat stripe; the lip
  is what makes it a rim.
- SEEDLING-STAKE MARKERS (tic): steps and bullets as drawn plant stakes — a 2px wooden
  stick with a small leaf-pair sprout at its top — planted on a soil-dot base; completed
  steps carry a leaf, pending steps a bare stick. NO numbers, NO cm ticks, NO ruler
  markings ever.
- Spacing rhythm: sections clamp(56px, 14vw, 84px); pots and packets always given soil
  room below (min 20px).

4. COLOR PHYSICS

Ground register: sky milk #EFF4EA to #F3F5EC — morning balcony light, never clinical.
Soil #4A3423 bands ground the page at most twice: the offer bed and/or the provenance
bed. Seed-paper #E9DCC2 carries the packet system and warm cards. Ink register: #2C3A26 /
#46543E / #7C8874 — garden greens gone readable; on soil, #F1EDE2. Accent physics: the
build chooses its LEAD — terracotta-led (default, warm domestic) or leaf-led (fresher,
for herb-forward kits); the other accent supports under 10%. Terracotta owns CTAs and
prices always. Forbidden: black, pure white, neon greens, blues (the sky stays milk, not
azure), gradients (clay and paper are flat), purple, and any luxury metallic.

5. TYPOGRAPHY

Latin stack. Display: Bree Serif (700) — round-shouldered and friendly; Fraunces (600,
soft) as the alternative for warmer builds. Body: Karla (400/700). Pairing rule: ONE
display + Karla; display on hero, titles, packet variety names, prices; Karla for
everything else; Karla 700 reserved for prices and germination promises.
Arabic stack. Display: Cairo (700). Body: Almarai (400/700). Pairing rule: Cairo + Almarai
always; Arabic display ~8% smaller at the same clamp.
Shared clamps as measured. RTL law: logical properties throughout; no letter-spacing on
Arabic; Arabic body line-height 1.8; digits Western, prices wrapped LTR ("3 200 DA" as one
unit); packet flaps keep their fold top-start; stake rows read start to end and mirror in
RTL; x-drift flips.

6. SIGNATURE ART AND COMPONENTS

The packet is the page's storyteller: seed-packet cards hold variants, contents and even
voices, each with its flap crease and sowing line. Terracotta rim bands cap the sections
like pots waiting to be filled; seedling stakes measure progress in growth, not numbers.
Supporting cast: a watering-can spout line (thin terracotta arc with three drops) as a
minor divider; germination checks (leaf-shaped ticks in leaf green); the soil-line rule
(a 3px #4A3423 baseline under hero imagery); harvest chips (small rounded tags in leaf
green naming what you'll pick: menthe, basilic, tomate cerise); order-step stakes planted
in a soil strip. Photography sits in 14px frames; the hero may bleed.

Component measurements, for the builder's hand: seed-packet cards keep a 3:4 ratio with the
flap crease at 22% of height (1px line, 4% ink shadow beneath the fold), variety name band
from 24% to 38%, window from 40% to 82%, sowing line in the last 12% at 11px; rim bands run
18-26px tall, lip under-edge 4px darker, outer corners rounded 8px, the band overhanging
its section title by 6px; stakes are 2px sticks 28-40px tall with leaf-pairs 10px wide at
the tip and a 6px soil dot at the base; harvest chips 22px tall, leaf-green at 12% fill
with full-strength text; the watering arc spans 64px with three 3px drops. Copy register:
the neighbor's voice — sentences under twelve words, verbs of tending (plante, arrose,
récolte, pousse), diminutives welcome once per section, and every promise measured in
days or harvests, never percentages. The child and the kitchen may appear; the laboratory
may not. Prices are said once plainly and once in harvests ("moins cher qu'un mois de
menthe"), and the doorstep payment closes warm: you pay when the balcony's future is in
your hands.

Imagery. Balcony gardening photography: terracotta pots on a sunlit balcony ledge, dark
rich soil, young seedlings with two true leaves, seed packets fanned, hands planting
(no faces), warm spring morning light, the city soft behind the railing. Macro on soil
crumb, clay texture, first sprouts. Banned in photos: manicured estate gardens, greenhouse
industry, herbier-style pressed specimens, ruler-staked seedlings, faces, plastic-pot
catalogs, rain gloom.

7. THE SPINE

Hook, convince, offer, order form — sow, tend, harvest, sign at the door. Price placement:
IN THE HERO — terracotta numerals beside the kit's name, with the old price (when true)
struck by a single thin line. Sticky CTA: a sky-milk bar with soil hairline, kit name +
price, terracotta pill button; appears after the hero and leads to the form. Mobile-first
at 390px. Desktop law: responsive expansion to max 1040px — packets fan into rows of
three, the how-to stakes line up horizontally, the balcony widens.

8. BLOCKS TREATMENT

Supported blocks, dressed by Jnina:
- announcement-bar: one line on seed-paper — delivery + pay-at-the-door + season note
  ("c'est la saison des semis") — with a tiny sprout glyph.
- problem-solution: the balcony-standing-empty paragraph against the first-harvest photo;
  two pains (herbs that wilt in bags, balconies of dust), one green verdict under a rim
  band.
- benefits-icons: 3-4 stake-marked lines — tout inclus, sans jardin, prêt en 10 minutes,
  germination garantie — ledger-set with leaf checks.
- ingredients-infographic: the kit's contents as an annotated spread — pots, soil,
  packets, guide — each item flagged with a harvest chip; the block reads as "what fills
  your balcony".
- how-it-works-steps: three stakes in a soil strip — plante, arrose, récolte — one
  sentence each; the signature sprout sequence lives here by default.
- unboxing-gallery: the delivered box opened — pots nested, soil brick, packet fan — a
  numbered manifest set on seed-paper.
- photo-reviews: 3-5 packet-format cards — reviewer name as the "variety", city as origin,
  a harvest photo in the window, two sentences below.
- whatsapp-proof: one recreated neighborly thread — the sprout photo sent to the family
  group — bubbles on sky milk, no platform branding.
- guarantee-seal: the germination promise on a seed-paper card — "ça pousse ou on renvoie
  les graines" — sealed with a leaf check, terracotta rim above.
- bundle-offers: balcon starter / balcon complet / balcon + enfants as three packets side
  by side, chosen packet's flap opens (state change); feeds the form.
- price-anchor: the season's price — kit name, terracotta price, per-harvest line ("moins
  cher qu'un mois de menthe du marché"), payment at the door beneath.
- order-steps: four stakes — commande, appel, livraison 24-72h, paiement à la porte — each
  gaining its leaf as scroll passes.
- faq: 4-6 questions (soleil? arrosage? enfants? animaux?) with watering-arc separators.
- trust-footer: soil band — the marque, phone + WhatsApp, seasons served, policies in
  seed-paper ink.
Refused blocks: lottery-contest (a garden is not a tombola), countdown (seasons, not
timers), comparison-table (Jnina argues with no one), video-testimonial (the sprout photo
says it).

9. HERO MENU

- The Ledge: full-bleed balcony photo, kit name + price on a sky-milk margin below, rim
  band capping the title. The default.
- The Packet Fan: seed packets fanned as the hero art, pots beneath, price on the leading
  packet; for variety-led kits.
- The First Sprout: macro seedling hero, title and price beside on milk, soil-line rule
  under; for hope-led builds.
- The Kit Flat: overhead flat lay of everything included, annotated with harvest chips,
  price in the corner card; contents-led.
- The Before-Balcony: empty ledge photo start-side, planted ledge end-side (an honest
  pairing, not a transformation ritual), title above, price below.
- The Child's Row: small hands planting (no face), title warm, price on a packet card;
  for kids grow-sets only.

10. FORM MENU

- The Sowing Card: single card on seed-paper — name, phone, wilaya, kit choice as packet
  chips — stake-marked submit. The default.
- The Two Seasons: 2-step wizard — kit and extras first, coordinates second; two stakes
  track it, sprouting as completed.
- The Quick Cutting: phone + wilaya echo under the hero for the decided, full sowing card
  at the end.
- The Bar Planting: the sticky bar opens the sowing card with fields focused; for
  single-kit builds.

11. MOTION IDENTITY

Sprout. Entrances: elements grow in from their soil line — scaleY 0.85 to 1 with origin
bottom, plus fade, 0.5s, sine.out, staggered 90ms; NO overshoot ever (a sprout does not
bounce). The ONE signature moment: a stake row sprouts in sequence — each stake's leaf
unfolding (scale 0 to 1 at the stake tip) with 140ms stagger, once, on entry. Rim bands
and packets arrive whole. No loops, no parallax, no sway. Reduced motion: everything
static, leaves grown. All motion gated on gsap + ScrollTrigger; the page reads fully
without JavaScript.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur (voltage's only), back.out overshoot (guimauve's). Neighbors banned by name:
herbier's botanical specimen plates, pressed-leaf silhouettes and tied tags; cartable's
wooden ruler dividers (stakes carry NO measurements); khodra's crate-slat bands, wax-paper
crinkle and produce stickers (sibling wall — the market stays downstairs); argan's oil
ribbon, droplet badges and spice swatches; dar's gingham hems and daylight beam; crochet's
yarn loops and granny squares; gabarit's dimension lines; aquarelle's washes. Jnina's own
temptations, banned: cm-marked growth rulers, greenhouse-tech vibes, macro bees and
insects, terracotta as full-page ground, numbered stakes, estate-garden fantasy
photography. Refused blocks: lottery-contest, countdown, comparison-table,
video-testimonial.

13. EXAMPLE VARIATIONS

- "Balcon Bladi" — home & kitchen (kit potager 6 pots). Ledge hero; blocks: announcement,
  problem-solution, ingredients-infographic, how-it-works, unboxing, photo-reviews,
  guarantee, bundle-offers, price-anchor, order-steps, faq, trust-footer; Sowing Card
  form. Sprout sequence on how-it-works. Mood: the balcony wakes up.
- "Menthe d'Abord" — health & wellness (kit menthe + verveine pour tisanes). First Sprout
  hero; blocks: announcement, problem-solution, benefits, how-it-works, photo-reviews,
  guarantee, price-anchor, order-steps, faq, trust-footer; Quick Cutting echo + card.
  Sprout on order-steps. Mood: grow what you drink.
- "Les Petites Mains" — kids & baby (grow-set enfant, pots peints). Child's Row hero;
  blocks: announcement, benefits, how-it-works, unboxing, whatsapp-proof, guarantee,
  price-anchor, order-steps, trust-footer; Two Seasons wizard. Sprout on the wizard
  stakes. Mood: the lesson that grows.
- "Herbe à Chat du Dimanche" — pets (kit herbe à chat). Kit Flat hero; blocks:
  announcement, problem-solution, how-it-works, photo-reviews, guarantee, price-anchor,
  order-steps, faq, trust-footer; Bar Planting form. Sprout on benefits stakes. Mood: the
  cat approves.
- "Du Vide au Vert" — home & kitchen (kit complet + jardinière). Before-Balcony hero;
  blocks: announcement, ingredients-infographic, benefits, how-it-works, unboxing,
  photo-reviews, whatsapp-proof, guarantee, bundle-offers, price-anchor, order-steps,
  faq, trust-footer; Sowing Card form. Sprout on bundle flaps' stakes. Mood: the honest
  pairing.
- "Fan de Semis" — home & kitchen (coffret 12 variétés de graines). Packet Fan hero;
  blocks: announcement, benefits, ingredients-infographic, photo-reviews, guarantee,
  price-anchor, order-steps, faq, trust-footer; Two Seasons wizard. Sprout on
  order-steps. Mood: a deck of springs.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
