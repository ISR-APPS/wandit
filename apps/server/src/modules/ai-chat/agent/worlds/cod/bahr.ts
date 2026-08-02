import type { DesignWorld } from "../types";

export const bahr: DesignWorld = {
	id: "bahr",
	name: "Bahr",
	family: "marine-summer",
	tagline: "Deep-sea blues, foam crests and coral summer",
	kind: "cod",
	mood: ["marine", "sunny", "fresh", "family"],
	energy: "medium",
	priceFeel: "accessible",
	industries: [
		"home & kitchen",
		"fitness equipment",
		"kids & baby",
		"car accessories",
	],
	avoidFor: ["jewelry & watches", "beauty & cosmetics"],
	fusesWith: ["bivouac", "khodra"],
	preview: {
		ground: "#0E4C6E",
		ink: "#F4E9D2",
		accent: "#FF6A57",
		fontFamily: "Paytone One",
		sampleWord: "البحر",
	},
	doc: `
BAHR — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Bahr means sea, and this world sells the way a good beach day feels: salt in the air, a cooler
heavy with ice, the whole family already in the water. It is the page for summer gear — coolers,
floats, tents, paddles, everything a Tunisian or Algerian family packs into the car at 7am for
Hammamet or Tipaza. The register is REAL ocean, not seaside decoration: rope that has been wet,
nets that have caught something, buoys that have done a season's work. Bahr never plays the
postcard riviera — no awnings, no parasol motifs, no painted ceramic charm. Its blue is the deep
working blue of open water, its white is foam, and its single hot note is coral — the color of a
life ring, used the way a life ring is used: rarely, and when it matters.

The buyer is a parent planning the weekend. They compare capacity in litres, hours of cold,
straps that will not cut into a shoulder on the long walk from the parking. So Bahr's voice is
sunny but practical — it promises the good day AND proves the logistics. Every section should
feel like it was written by someone who has actually carried the thing across hot sand. The
selling spine (hook, convince, offer, order form) rolls underneath like a tide: the hero sells
the day, the middle sells the litres and hours, the offer lands like the moment you find the
perfect spot, and the form is as quick as claiming it.

Self-audit checklist — answer YES to ship:
- Does the hero smell like salt — deep sea ground, foam, real gear — and never like a resort ad?
- Is the price stated plainly in the first viewport, with the primary CTA beside it?
- Is coral under 10% of every viewport, reserved for price, CTA and true urgency?
- Do foam-crest edges cut at least two section transitions, each with trailing bubble dots?
- Are the practical numbers (litres, hours of cold, weight) doing the convincing?
- Do buoy markers carry every step and list — never plain bullets?
- Is the page fully readable with JavaScript off, zero overflow at 390 / 768 / 1440?
- Could a stranger sort this page from a frost world and a bazaar world in two seconds?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook, then convince, then offer, then order form. Invisible, inviolable.
- Palette registers: deep sea grounds #0E4C6E to #116089 alternating with sand #F4E9D2; foam
  white #FDFCF8; coral #FF6A57 capped at 10%; rope tan #C8A272 as structure.
- Type stacks: Latin display Paytone One or Fredoka 700, body Karla; Arabic display Baloo
  Bhaijaan 2, body Almarai.
- The three owned tics: foam-crest edges, net-mesh panels, buoy markers.
- Motion identity: tide push — 0.45s ease-out slides with a subtle secondary settle; ONE
  foam-crest roll-in at the offer. No overshoot, ever.
- Desktop law: responsive expansion, max 1060px.
- Refused blocks: lottery-contest, spec-table, press-badges.
- Imagery style: bright summer beach photography (full spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client, never copied:
- Hero composition, chosen from the hero menu or invented inside the world's voice.
- Block choice within the supported set, and BLOCK ORDER — a cooler funnel and a kids-float
  funnel must not share a sequence.
- Form style from the form menu, and whether a compact echo appears under the hero.
- Proof lead: photo-reviews or whatsapp-proof or stats-band — rotate per product.
- Where coral lands beyond price and CTA (one urgency chip, or nowhere else at all).
- Section rhythm: a lean 8-block day trip or a full 14-block expedition.
Every client gets a new sibling of Bahr — same sea, different day. A build that repeats a
previous hero + block order + form combination has failed the contract.

3. VISUAL SIGNATURES — measured

- Grounds: deep sea #0E4C6E base, #116089 lighter alternate; sand sections #F4E9D2; foam card
  surface #FDFCF8. Alternation is the page's swell: sea, sand, sea, sand — never two sea
  sections adjacent.
- Ink: on sea, foam ivory #F4E9D2 headings with #D7E4E9 secondary; on sand, deep ink #143A4E
  with #4E6875 secondary. Pure black never appears — the sea has no black.
- Coral #FF6A57: price, primary CTA, one true-urgency chip. Hover deepens to #E85742.
- Rope tan #C8A272: structural rules, small labels, strap details. Never body text.
- Display type: hero clamp(1.9rem, 7.5vw, 2.9rem), line-height 1.12 Latin / 1.3 Arabic;
  section titles clamp(1.4rem, 5.5vw, 2rem); body clamp(0.98rem, 4vw, 1.06rem), line-height
  1.6 Latin / 1.8 Arabic. Prices clamp(1.5rem, 6.5vw, 2.3rem) weight 700.
- Radii: cards 16px (beach gear is rounded and friendly), fields 12px, chips and the sticky
  pill 999px. Borders: 1.5px solid rgba(20,58,78,0.16) on sand; 1.5px rgba(244,233,210,0.25)
  on sea. Shadows: one soft ambient only, 0 8px 24px rgba(14,76,110,0.14) — never hard offsets.
- Spacing rhythm: sections breathe 56 to 80px vertical on mobile; content column 20px side
  padding at 390px.

The tics, precisely:
- FOAM-CREST EDGES: section transitions cut as an irregular wave crest (SVG path, 24 to 48px
  amplitude, 2 to 3 crests across 390px), the upper section's color foaming over the next.
  Behind the crest trail 3 to 6 bubble dots (4 to 10px circles, same color, opacity fading
  0.9 to 0.3) scattered within 40px below the cut. Maximum three foam edges per page; the
  offer's edge is the one that animates.
- NET-MESH PANELS: key cards carry a fishing-net overlay — a diagonal crosshatch of 1px lines
  at 45 and -45 degrees, cell size 22 to 30px, opacity 8 to 12%, with small knot dots (2px)
  at intersections along the panel's top edge only. On sea grounds the net is foam-toned; on
  sand it is sea-toned. Never on text-heavy cards — the net dresses imagery and offer panels.
- BUOY MARKERS: steps, bullets and progress marks drawn as buoy floats — a rounded capsule
  22 to 32px tall with two horizontal bands (coral top, foam bottom, 3px ink waterline between)
  and a tiny mast tick above. Active or completed buoys sit upright at full opacity; pending
  buoys tilt 8 degrees at 55% opacity, as if bobbing.

4. COLOR PHYSICS

Ground register: #0E4C6E to #116089 — the sea may lighten toward noon (#12699A ceiling) per
build, but never turns teal-mint (that drifts toward tea worlds) and never navy-black. Sand
register #F4E9D2 to #F0E1C4. The page opens on sea; the order form always sits on sand for
legibility, inside a foam card.
Ink register: #143A4E to #4E6875 on sand; #F4E9D2 to #D7E4E9 on sea. Ink never carries color
temperature tricks — warmth belongs to sand and rope.
Accent physics: coral #FF6A57 is the life-ring — visible instantly because it is rare. Hard cap
10% of any viewport. If a coral element could be deleted without losing money information or
the CTA, it was never allowed to be coral.
Support: rope tan #C8A272 for rules, strap iconography, quiet labels — cap 8%. Foam white is
free. Forbidden: purples, neon greens, bazaar yellow, candy pastels, black grounds, gradients
other than the sea's own two-step ground shift, and any striped-canopy pattern (that awning
belongs to another world).

5. TYPOGRAPHY

Latin stack: display Paytone One (400 — it only ships one weight, and it is enough) or Fredoka
700 for a rounder, younger build; body Karla 400/700. Pairing rule: one display + Karla,
never two displays. Display appears in the hero title, section titles, prices and the sticky
CTA; everything else is Karla.
Arabic stack: display Baloo Bhaijaan 2 (700) — round, buoyant, family-warm; body Almarai
400/700. The pairing is fixed: Baloo Bhaijaan 2 + Almarai.
Shared size clamps as in Visual Signatures; Arabic display sits at 92% of the Latin clamp
ceiling and takes line-height 1.3 minimum. NEVER letter-spacing on Arabic; Latin caps labels
may take 0.06em. Arabic body line-height 1.75 to 1.9. Digits: Western Arabic numerals for
prices, litres and hours in both scripts; phone numbers wrapped in an LTR span.
RTL mirroring: logical properties everywhere; foam-crest paths flip horizontally; buoy tilt
mirrors; x-axis slide directions reverse; the net-mesh is symmetric and needs no mirroring.

6. SIGNATURE ART AND COMPONENTS

The three tics are the crew. Foam-crest edges make the page swell and break like water — they
are the world's silhouette, visible from across the room. Net-mesh panels give gear its
harbor context: the offer card wrapped in net reads as "packed and ready". Buoy markers turn
every process into a swim line — order steps float, size options float, review ratings float
(three of five buoys upright is a 3-star day).

Supporting cast: rounded foam cards with the soft ambient shadow; rope-tan hairline rules
(solid, 1.5px — never dashed, dashes belong to a stitching world); capacity chips (a litre
number in a foam pill with a sea outline); the sticky order bar as a foam pill on a sea band
with coral CTA; strap-handle iconography drawn in 2px rounded strokes. Photography does the
emotional lifting and always shows the gear IN the day it promises.

Imagery: bright summer beach product photography. Deep blue open sea as backdrop, white foam,
hard sunny top-light with real shadows on sand, coral-colored props rationed like the accent,
rope and net details within reach of the product. Families appear as bodies in the water or
hands carrying gear — never faces. Banned in photos: studio seamless backdrops, sunset
melancholy, resort cocktails, parasols, and any urban context. The world doc's palette must
be visible IN the photograph: sea blue, sand, foam, one coral note.

7. THE SPINE

Hook, convince, offer, order form — in that order, always, invisible to the buyer. Bahr's hero
carries the price in plain foam type beside the CTA: a family budgeting a beach season wants
the number before the dream. The sticky CTA is a foam pill riding a slim sea-blue band at the
bottom; it shows the price at all times and rolls the page to the form on tap. First price
appearance is therefore the HERO (sticky echoes it). Mobile is the canvas at 390px. Desktop
law: responsive expansion to max 1060px — sections widen, the hero splits photo-beside-stack,
foam edges stretch their crests, and the form becomes a two-column fiche on sand.

8. BLOCKS TREATMENT

Supported blocks, dressed by Bahr:
- announcement-bar: a slim sea band with foam text — delivery promise and COD, one line, a tiny
  buoy dot as separator.
- problem-solution: the hot-day pain (melted ice, broken handles, sunburnt patience) on sand,
  answered by the product on sea; two beats maximum, photos carry the heat.
- benefits-icons: 4 to 6 foam chips on a sea section, each anchored by a buoy marker instead of
  an icon disc; one-line benefits in Karla.
- stats-band: a sea band with three or four foam numerals — hours of cold, litres, kilograms,
  seasons guaranteed — counting up once.
- how-it-works-steps: 3 buoy-marked steps (pack, carry, open); each step one photo detail and
  one sentence.
- photo-reviews: foam cards on sand, reviewer name and beach city (Hammamet, Sousse, Bizerte),
  star rows drawn as tiny upright buoys, one customer photo per two reviews.
- whatsapp-proof: a recreated family-group thread planning the weekend — green bubbles on a
  foam card, net-mesh header, timestamps; the product settles the argument.
- variant-gallery: size or color variants as foam cards with capacity chips; selected card
  gains a coral waterline border and its buoy stands upright.
- bundle-offers: solo vs pack famille cards; the pack wears a net-mesh overlay and a rope-tan
  "meilleur pour la plage" label; feeds the form total.
- cross-sell: one companion (sac isotherme, pompe) as a small foam card with a checkbox that
  adds it to the order — priced in coral.
- price-anchor: old price struck in rope tan, new price large in coral on foam, the savings
  stated in dinars; sits directly above the offer's animated foam-crest edge.
- guarantee-seal: a foam roundel with a buoy at its center — seasons guaranteed, exchange
  window, pay-at-the-door restated; no ribbons, no wax.
- order-steps: 4 buoy steps from form to door (اطلب، نأكدو، التوصيل، خلّص عند الباب in Arabic
  builds); horizontal swim-line on mobile.
- delivery-map: coastal-first list — governorates or wilayas with delivery time and fee on
  foam rows; the sea section behind makes the geography feel real.
- faq: sand section, foam rows, chevron-free (a small buoy rotates 15 degrees when open).
- trust-footer: deep sea ground, foam text, phone and WhatsApp large, the last foam-crest
  closing the page like the day's final wave.

Refused blocks:
- lottery-contest: a beach day is not a raffle; prize mechanics cheapen the practical trust.
- spec-table: numbers live in stats-band and capacity chips; an engineering grid would dry the
  sun out of the page.
- press-badges: borrowed authority is not how a family picks a cooler; neighbors and litres are.

9. HERO MENU

- Plein Soleil (full-bleed): the beach photo full-width, foam-crest cutting its base, title and
  price on a foam panel riding the lower third, CTA beside the price.
- Marée Split: photo left, stack right (kicker, title, two capacity chips, price, CTA); on
  390px the stack rides below the photo with the first foam edge between.
- La Glacière Ouverte (offer-card): the entire hero is one big foam card in net-mesh — product
  photo, promise line, price, CTA inside; sea all around.
- Jour J (story-hook): a heat-line kicker ("41 degrés à Tunis samedi"), title answering it,
  photo below, price and CTA pinned to the photo's sand strip.
- Cap Famille (bundle-first): the pack famille card IS the hero, solo option as a quiet foam
  chip beneath; for products that sell by the carload.
- Ligne d'Eau (price-first): price enormous in foam on sea, product photo beneath cut by the
  first crest; for offers where the number is the story.

10. FORM MENU

- Fiche de Plage (single card): one foam card on sand — name, phone, region select, variant
  row, coral submit; COD reassurance as a buoy-marked line beneath.
- Écho de Marée (hero-echo): a two-field mini form (phone + region) on the hero's sand strip
  for the decided, repeated full-size at the end; the mini scrolls to the full on submit.
- Deux Vagues (2-step wizard): step one coordinates, step two delivery and variant; progress
  shown as two buoys, the active one upright.
- Barre de Rappel (sticky-driven): the sticky pill is the only CTA until the form; tapping it
  rolls the tide down to the fiche with the first field focused.

11. MOTION IDENTITY

Tide push: entrances slide 24 to 36px with ease-out at 0.45s, then a subtle 4px secondary
settle — the way water arrives and relaxes. Staggers run 80 to 120ms. The ONE signature scroll
moment: at the offer, the foam-crest edge rolls in once via clip-path wipe (0.8s), its bubble
dots fading in behind. Buoys may tilt to upright on their step's entrance (0.3s). Nothing
loops except nothing — Bahr holds still between waves. Banned motion: overshoot and elastic
easings, continuous bobbing loops, parallax depth stacks, scroll-jacking, Ken-Burns drift.
Under prefers-reduced-motion: all content visible and static, crests pre-rolled, buoys upright.
All animation is gated on gsap + ScrollTrigger presence and never hides content in CSS.

12. BAN LIST

Generic slop: purple-blue gradients on white, glassmorphism, emoji as design, Poppins-for-
everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero
carousels, parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics, banned by name: riviera's awning-stripe canopies, painted ceramic plaques and
citrus or parasol motifs; doudou's cloud-scallop edges; gloss's lacquer-drip edges; warqa's
layer-stack cutouts; hammam's ripple rings; telj's frost crystals, fog wipes and icicles (the
cold sibling — Bahr is warm water, never ice); atlas's dotted routes and compass roses.
Own temptations, also banned: cartoon fish and anchors, gradient water fakery, sunset-orange
skies (Bahr is noon), starfish clip-art, and coral used as decoration.
Refused blocks restated: lottery-contest, spec-table, press-badges.

13. EXAMPLE VARIATIONS

- "Captain 25L" — home & kitchen. La Glacière Ouverte offer-card hero; announcement-bar,
  stats-band, benefits-icons, photo-reviews, bundle-offers, price-anchor, order-steps,
  delivery-map, faq, trust-footer; Fiche de Plage form. Mood: the family quartermaster.
  Signature emphasis: the offer's foam-crest roll.
- "Bouée Petit Marin" — kids & baby. Jour J story-hook hero; problem-solution (peur de l'eau),
  benefits-icons, whatsapp-proof (les mamans du groupe), variant-gallery (tailles), guarantee-
  seal, price-anchor, order-steps, faq, trust-footer; Écho de Marée form. Mood: first-swim
  pride. Buoys do the size-selection work.
- "Paddle Léger" — fitness equipment. Marée Split hero; stats-band (poids, charge), how-it-
  works-steps, photo-reviews, cross-sell (pompe double), price-anchor, guarantee-seal,
  order-steps, faq, trust-footer; Deux Vagues wizard. Mood: dawn-patrol calm.
- "Tente UV Famille" — kids & baby. Plein Soleil hero; problem-solution (le soleil de 13h),
  benefits-icons, stats-band (UPF, montage en secondes), photo-reviews, bundle-offers (avec
  sardines de sable), price-anchor, order-steps, delivery-map, trust-footer; Barre de Rappel
  form. Mood: shade as luxury.
- "Coffre Fraîcheur Auto" — car accessories. Ligne d'Eau price-first hero; benefits-icons,
  stats-band (12V, litres), how-it-works-steps, photo-reviews, cross-sell (câble allume-
  cigare), price-anchor, guarantee-seal, order-steps, faq, trust-footer; Fiche de Plage form
  with vehicle note field. Mood: road-trip logistics.
- "Cap Famille Weekend" — home & kitchen. Cap Famille bundle-first hero; whatsapp-proof,
  stats-band, benefits-icons, photo-reviews, price-anchor, guarantee-seal, order-steps,
  delivery-map, faq, trust-footer; Écho de Marée form. Mood: the full carload, one order.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
