import type { DesignWorld } from "../types";

export const dukkan: DesignWorld = {
	id: "dukkan",
	name: "Dukkan",
	family: "sign-paint",
	tagline: "Hand-painted shop signs, pompoms and fresh paint",
	kind: "cod",
	mood: ["handmade", "festive", "warm", "crafted"],
	energy: "loud",
	priceFeel: "accessible",
	industries: ["home & kitchen", "health & wellness", "pets"],
	avoidFor: ["electronics & gadgets", "jewelry & watches", "car accessories"],
	fusesWith: ["souk", "khodra", "zman"],
	preview: {
		ground: "#F7F1E6",
		ink: "#1C1A17",
		accent: "#C63B2A",
		fontFamily: "Rakkas",
		sampleWord: "الدكان",
	},
	doc: `
DUKKAN — THE HAND-PAINTED CORNER SHOP

1. PHILOSOPHY

Dukkan is the shop whose sign was painted by the owner's cousin who "knows how to draw":
whitewashed wall, wooden planks lettered by brush, a pompom garland left over from last Eid,
an arrow painted straight onto the wall pointing at the counter. It is loud the way a
craftsman is loud — with paint, not with print. Where Souk shouts in printed stickers and
mechanical flaps, Dukkan shouts in brushstrokes: every price sits on a painted board, every
direction is a painted arrow, every celebration hangs on a string of yarn pompoms. The page
must feel touched by hands. Edges wobble a degree or two. Paint drips are honest. Nothing is
machine-perfect, and that is precisely the trust: a shopkeeper who paints his own sign
stands behind his own goods.

The voice is the shopkeeper's voice — direct, warm, proud, a little theatrical: "هريسة
تسخّن القلب"، "جرّبها وإلا رجّعها". Claims are concrete (grams, jars, days), because the
painted sign tradition never lies about the price of tomatoes. The COD spine — hook,
convince, offer, order form — runs under the paint untouched: form fields big as counter
tops, pay-at-the-door said plainly on a painted plank.

Self-audit before shipping:
- Does every price on the page sit on a painted plank (brush texture, slight tilt)?
- Are the arrows brush-painted with visible stroke ends and an honest drip or two?
- Do pompom garlands hang at section changes — round yarn balls on a string, never confetti?
- Is exactly ONE paint-wipe signature moment present (the hero underline painting itself)?
- Is one paint color dominant (red OR mustard OR sky), the others under 10%?
- Could a customer smell the paint — or did it slip into printed-flyer perfection?
- Is the form a counter transaction: big fields, painted submit plank, COD stated?
- Zero horizontal overflow at 390 / 768 / 1440; readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The shop never rearranges its
  counter.
- Palette registers: whitewash #F7F1E6 ground, painted teal #14666B section alternates; ink
  #1C1A17; paint red #C63B2A, mustard #E3A72F, sky #3E8FB0 with ONE dominant per build;
  wood #B98A5A for planks.
- Type stacks: Latin display Fugaz One or Alfa Slab One; body Karla. Arabic display Rakkas
  or Lalezar; body Almarai.
- The three owned tics: painted price planks, pompom garlands, painted arrow signs.
- Motion identity "fresh paint": 0.4s pops; one paint-wipe underline signature.
- Desktop law: centered mobile shell (~450px) on whitewash.
- Refused blocks: spec-table, comparison-table, press-badges.
- Imagery style: artisan shop photography per Signature Art.

CLIENT-OWNED — re-decided fresh every build:
- Hero composition from the hero menu.
- Block choice within the supported set and BLOCK ORDER — a harissa page and a pet-food page
  run different market patter.
- Form style from the form menu.
- Dominant paint color (red, mustard or sky) and which sections go teal.
- Proof lead: photo-reviews or whatsapp-proof or stats — the shopkeeper picks his best
  witnesses.
- Where the pompom garlands hang (2-4 per page) and plank tilt directions.
Every client gets a freshly painted shop — same brush, new sign. Copies peel.

3. VISUAL SIGNATURES

Measured values. Grounds: whitewash #F7F1E6 (subtle plaster unevenness allowed via a 2-3%
noise), painted teal #14666B full-bleed alternates (roller texture at edges), wood plank
#B98A5A elements. Ink #1C1A17 for text on light; whitewash text on teal. Paint colors: red
#C63B2A, mustard #E3A72F, sky #3E8FB0 — dominant gets CTAs, planks' lettering and arrows;
others cameo under 10% each. Display type: clamp(30px, 8.5vw, 46px), Rakkas/Fugaz weight
carrying the sign-painter's confidence; section titles clamp(20px, 6vw, 28px); body
clamp(15px, 4vw, 16.5px), line-height 1.6 Latin / 1.8 Arabic. Prices ON PLANKS: clamp(24px,
7vw, 34px). Radii: 10px cards; planks 4px with clipped corners; pills for chips only.
Borders: 2px ink on cards (hand-ruled feel — permitted 0.5° rotation); no hairlines, this
shop owns no ruler. Shadows: planks and cards cast 0 3px 0 rgba(28,26,23,0.18) — a painted-
on shadow, flat, never blurred deep.

The tics, precisely:
- PAINTED PRICE PLANKS: a wooden board (wood texture + 2 nail dots), tilted -2° to 2°,
  carrying brush-lettered price/label in the dominant paint color with visible stroke
  texture (SVG brush path or textured font treatment) and 1-2 small drips from a letter.
  Every price on the page lives on a plank — hero, offer, bundles, sticky bar chip.
- POMPOM GARLANDS: a string (1.5px ink line, gentle catenary sag) strung with 7-12 yarn
  pompoms (12-18px circles with short radial fringe strokes) in mixed paint colors; hung at
  2-4 section boundaries. Round yarn balls with fringe — never flat dots, never confetti
  shapes, never fringe-only tassels.
- PAINTED ARROW SIGNS: brush-stroke arrows (thick tapering stroke, blunt start, painted
  head, 1 drip allowed) guiding to the next beat and the form — "من هنا" lettered beside
  the final one. Wobble permitted; mechanical chevrons forbidden.

4. COLOR PHYSICS

Ground register: whitewash #F7F1E6 dominates (60-75% of page height); painted teal #14666B
takes 1-3 full sections (the painted feature walls); wood tones live only on planks and
crate-free furniture. Ink register: #1C1A17, softened to #4A453D for secondary lines.
Accent physics: choose the dominant paint at build time — red for food heat, mustard for
honey/grain warmth, sky for clean/care products — the dominant paints CTAs, plank lettering,
arrows and the sticky bar; the other two appear only in pompoms and small chips. White
#FBF7EF is the lettering color on teal walls. Forbidden: gradients (paint is flat), black
sections, neon anything, silver/chrome, more than one dominant, and photographic textures
used as grounds (texture is painted, not imported).

5. TYPOGRAPHY

Latin stack. Display: Fugaz One — brush-adjacent momentum; Alfa Slab One when the client
needs heavier planks. Body: Karla (400/700). Display is for signs: product name, section
titles, plank lettering, arrows' labels. Body never letter-spaced beyond 0.02em. Arabic
stack. Display: Rakkas — the ruqaa sign-painter's hand, generous and confident; Lalezar as
the rounder alternative. Body: Almarai (400/700). Pairing rule: Rakkas + Almarai default;
Lalezar + Almarai for softer goods. Shared clamps; Arabic display runs ~8% smaller at the
top end. Arabic body line-height 1.75-1.9; NEVER letter-spacing on Arabic; Rakkas is
display-only, never body. Digits: Western Arabic numerals on planks and forms; phone in an
LTR span. RTL: logical properties; arrows point start-ward (right in RTL) toward flow;
plank tilts mirror; garland sag is symmetric.

6. SIGNATURE ART & COMPONENTS

The plank is the master component (wood grain, nails, brush lettering, painted shadow).
Variants: price plank, label plank (section kickers), submit plank (the form's button is a
plank). Supporting cast: painted feature walls (teal sections with roller-edge tops);
counter cards (2px ink-bordered whitewash cards, 0.5° rotations); jar chips (small rounded
chips with hand-drawn icon + label); the garland; the arrows; a hand-drawn shop stamp is
FORBIDDEN (seals belong elsewhere) — the shop signs its work with paint alone.

Imagery. Artisan shop photography: products on wooden shelves or against whitewashed walls,
warm afternoon market light, honest styling (jars slightly unaligned, cloth under goods),
paint-color props echoing the dominant. For food: ingredients raw and generous. For care/
pets: the animal or object in the courtyard light of the shop. Depth of field shallow,
colors warm, zero studio sterility. No text, no logos, faces avoided (hands welcome). The
world doc's imagery is reproducible for any niche product: photograph it as shop stock —
shelved, handled, sold by a proud shopkeeper.

7. THE SPINE

Hook, convince, offer, order form — the counter ritual, invisible and locked. Price
placement law: first price appears IN THE HERO on a painted plank; the sticky bar repeats
it as a mini-plank chip. Sticky CTA: a whitewash bar with 2px ink top border; inside, a
mini plank with the price and a dominant-paint CTA "اطلب من الدكان" — always scrolls to the
form. Mobile-first 390px; desktop is the centered mobile shell (~450px) floating on
whitewash with a painted teal band glimpsed at the shell's edges.

8. BLOCKS TREATMENT

Supported blocks, dressed by Dukkan:
- announcement-bar: a thin painted banner — whitewash text on dominant paint — one message
  ("التوصيل لكل الولايات · خلاص عند الباب"), ends cut like a ribbon.
- problem-solution: shop patter — two pains painted as short lines on the wall, the answer
  on a plank; a small arrow bridges them.
- benefits-icons: 4-6 counter cards with hand-drawn line icons (pot, flame, leaf, paw) and
  one-word labels; garland above the row.
- ingredients-infographic: the honest jar — contents listed on a label plank with amounts
  in grams; "بلا مواد حافظة" painted beneath.
- how-it-works-steps: 3 steps as small planks nailed in a row, arrows between them.
- variant-gallery: jars/flavors as shelf items — photo chips with painted name tags;
  selected gets a brighter tag. Feeds the form.
- photo-reviews: customers of the quartier — name, city, stars painted as small brush ticks,
  two lines each, optional photo in a 2px frame.
- whatsapp-proof: reorder messages in a counter card, bubbles tinted whitewash/dominant.
- stats-band: painted tallies on the teal wall — "مرطبان مبيوع 4200+" — numerals in display,
  four strokes and a slash tally motif beside.
- guarantee-seal: a plank oath — "جرّبها، ما عجبتكش؟ نرجعولك دراهمك" with the shopkeeper's
  painted underline; no badges, the word is the bond.
- price-anchor: the day's sign — old price on a small faded plank crossed with ONE brush
  stroke, new price on the big plank, savings painted in the corner.
- bundle-offers: shelf deals — 1x/2x/3x planks with per-jar math painted small, middle one
  garlanded.
- cross-sell: "زيد معاها" — one companion jar with a painted +price tag, checkbox styled as
  a painted tick box.
- order-steps: the counter routine: تكتب، نعيطولك، نوصلوها، تخلص عند الباب — four mini
  planks with icons.
- faq + trust-footer: faq lines separated by thin painted rules; footer on the teal wall —
  phone plank, WhatsApp plank, the arrow pointing back up.
Refused blocks: spec-table (a shopkeeper explains, he does not tabulate), comparison-table
(he never names rivals), press-badges (his fame is the quartier, not the TV).

9. HERO MENU

- The Shop Sign: product photo center, name lettered above in display, price plank tilted
  at the photo's corner, CTA plank beneath, garland across the top. The default facade.
- The Counter Drop: photo full-bleed top 55%, then a whitewash counter card overlapping
  with name, one patter line, plank price, CTA; arrow enters from the card's edge.
- The Teal Wall: hero on a painted teal section — whitewash lettering, product cut out
  against the wall, plank price nailed beside; boldest option.
- The Tasting Line: story-hook — one Rakkas line ("ذوق وحدة، تفهم كلشي")، small photo,
  plank price, CTA; patter-first for known products.
- The Shelf Trio: variant-first — three jars on a painted shelf line, tags beneath, price
  plank shows the selected; for flavor-led goods.
- The Painted Promise: split — headline and three painted ticks (promises) start-side,
  photo end-side, plank + CTA under the ticks.

10. FORM MENU

- Counter Card (default): one whitewash card, 2px ink border, big labeled fields, submit as
  a full-width painted plank; COD line painted small beneath.
- Two-Plank Wizard: step 1 choose jar/bundle (shelf chips), step 2 name/phone/wilaya;
  progress = two small planks, painted tick on the done one.
- Hero-Echo Ticket: a 2-field quick form under the hero (phone + wilaya) styled as a small
  counter card, full form repeated at the end; both validate identically, and the ticket's
  submit plank reads "احجزلي وحدة" while the full form's reads the complete order line.
- Garland Form: fields inside a card whose top edge carries the garland; for festive builds;
  otherwise identical laws.

11. MOTION IDENTITY

Fresh paint: entrances are 0.4s power2.out pops with a 1° rotation settle (things are
placed by hand, they land almost straight). Pompoms may sway ±2° in a slow loop — the only
loop. The ONE signature moment: the hero's plank underline paints itself once — a clip-path
brush wipe, 0.6s, with a tiny drip appearing at its end; never a line self-drawing (that is
another world's engraving). Reduced motion: everything visible and still, underline complete.
All motion gated per DEMO-LAWS; gsap.set only for hiding; page readable with JS off.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: souk's
starburst price badges, price-slash theater and split-flap countdown (the plank's single
brush stroke is Dukkan's only cross-out); trottoir's chevron rails (mechanical arrows
forbidden); chantier's stencil spray caps and hazard stripes; aquarelle's watercolor washes
and brush underpainting behind titles; carnet's handwritten annotations with arrows (plank
lettering is DISPLAY signage, never margin notes); khodra's crate-slat bands and wax-paper
panels (sister market world — hard wall; planks are painted boards, never crate frames);
crochet's yarn-loop borders and granny squares (pompoms only here); orfevre's self-drawing
lines; dukkan never uses printed halftones, barcode furniture, or metallic effects.
Dukkan's own temptations, banned: more than one cross-out stroke, garlands on every
section, three paints at equal weight, distressed-font fakery (texture comes from the
lettering treatment, not grunge fonts), and cartoon mascots. Refused blocks restated:
spec-table, comparison-table, press-badges.

13. EXAMPLE VARIATIONS

- "Harissa El Dar" — home & kitchen (artisan harissa trio, ar-TN). Shop Sign hero; announce,
  ingredients plank, benefits, Shelf variant-gallery, photo-reviews, stats on teal, price-
  anchor, bundles, order-steps, Counter Card form, faq, footer. Red dominant. Paint-wipe on
  hero plank.
- "Zit Zitoun" — health & wellness (olive oil 1L, fr-TN). Counter Drop hero; problem patter
  (industrial oils), ingredients, how-it-works (3 uses), whatsapp-proof, guarantee oath,
  price-anchor, cross-sell (soap), Two-Plank Wizard, faq, footer. Mustard dominant.
- "Croquettes du Quartier" — pets (dog kibble 5kg). Painted Promise hero; benefits (paw
  icons), ingredients grams, stats tallies, photo-reviews with dog photos, guarantee,
  bundles 1/2/3 sacks, order-steps, Garland Form, footer. Sky dominant; garlands ×2 only.
- "Assel Hor" — health & wellness (mountain honey). Tasting Line hero; ingredients (one
  origin line), benefits, whatsapp-proof, price-anchor with faded old plank, bundle duo,
  Counter Card form, faq, footer — a lean 9-beat shop. Mustard dominant.
- "Tajine Msemen Kit" — home & kitchen (breakfast kit). Teal Wall hero; how-it-works steps
  planks, benefits, photo-reviews, stats, price-anchor, cross-sell (honey), Hero-Echo
  Ticket + full form, footer. Red dominant; arrows lead every transition.
- "Sabon Bledi" — health & wellness (natural soap set). Shelf Trio hero; variant tags,
  benefits, ingredients, photo-reviews, guarantee oath, price-anchor, Two-Plank Wizard,
  faq, footer. Sky dominant; single garland at the offer.
- "Makla Del Qtat" — pets (cat treats jar). Shop Sign hero with the jar under the painted
  name; benefits (paw ticks), ingredients grams, whatsapp-proof from cat owners, stats
  tallies on the teal wall, guarantee oath, price-anchor with the single brush cross-out,
  bundle duo, Hero-Echo Ticket + Counter Card, footer. Mustard dominant, one garland, the
  painted arrow labeled "للقطوسة من هنا" — the shop at its most affectionate.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
