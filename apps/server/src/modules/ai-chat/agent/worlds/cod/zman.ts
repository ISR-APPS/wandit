import type { DesignWorld } from "../types";

export const zman: DesignWorld = {
	id: "zman",
	name: "Zman",
	family: "poster-voyage",
	tagline: "A 1950s travel poster that takes orders at the platform",
	kind: "cod",
	mood: ["nostalgic", "painted", "sunlit", "proud"],
	energy: "medium",
	priceFeel: "premium",
	industries: ["home & kitchen", "health & wellness", "fashion & apparel"],
	avoidFor: ["electronics & gadgets", "car accessories", "fitness equipment"],
	fusesWith: ["fanous", "dukkan"],
	preview: {
		ground: "#F6EDD8",
		ink: "#2A2420",
		accent: "#C03E2E",
		fontFamily: "Alfa Slab One",
		sampleWord: "زمان",
	},
	doc: `
ZMAN — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Zman means the old days, and this world is the 1950s travel poster reborn as a funnel: flat
gouache skies stacked in sunset bands, a casbah painted in four confident colors, palm fronds
that never needed a photograph. It sells heritage goods — dates, olive oil, artisan food,
woven and worn things — as POSTERS sell places: with painted longing and a proud slab title.
The buyer is not purchasing a product; they are purchasing the country at its most golden,
boxed and delivered.

THE IMAGERY LAW, stated plainly because it is this world's foundation: Zman is ILLUSTRATED.
Every image on the page is painted — flat gouache, vintage-tourism poster art with limited
palette, visible brush confidence and zero photographic realism. Photography is BANNED from
this world entirely: no product photos, no lifestyle shots, no photographic textures behind
paint. The product itself appears as a painted still life, rendered by the same poster hand
that painted the casbah behind it. A production build must generate its imagery in this one
painted style, described precisely in Signature Art, and a single build's paintings must read
as one artist's afternoon.

The spine — hook, convince, offer, order form — hangs like posters in a gallery: the hero
poster stops the walker, the middle posters convince panel by panel, the offer is the
centerpiece with its ribbon title, and the form is the ticket booth at the end of the row.

Self-audit checklist — answer YES to ship:
- Is every single image painted gouache — zero photography, zero photo-texture leaks?
- Do the paintings share ONE palette and ONE hand across the whole page?
- Is the price stated in the first viewport, set like a poster's fare line, near the CTA?
- Does exactly ONE title ribbon unfurl, in the hero, and do other ribbons stay still?
- Are the section grounds built from stepped sunset bands — flat, hard-edged, 3 to 4 colors?
- Does the copy speak painted nostalgia (زمان الخير) without drowning the offer's clarity?
- Fully readable with JavaScript off, zero overflow at 390 / 768 / 1440?
- Could a stranger sort this from the comic world and the hand-painted-shop world in two
  seconds?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook, then convince, then offer, then order form. Invisible, inviolable.
- Palette registers: poster cream #F6EDD8; sunset bands apricot #E8A05C, rose #D06A55, teal
  #2E6E6A, night #22384A; ink #2A2420; poster red #C03E2E.
- Type stacks: Latin display Alfa Slab One or Yeseva One, body Karla; Arabic display Lalezar
  or Rakkas, body Almarai.
- The three owned tics: poster-illustration system, title-ribbon banners, stepped sunset
  bands.
- The imagery law: illustrated gouache poster art only; photography banned.
- Motion identity: poster press — 0.45s slab slides; ONE ribbon unfurl in the hero.
- Desktop law: centered mobile shell, ~460px, on poster cream.
- Refused blocks: whatsapp-proof, video-testimonial, stock-urgency, spec-table.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu, or invented inside the poster.
- Block choice within the supported set and BLOCK ORDER — a dates coffret and a silk scarf
  hang different galleries.
- Form style from the form menu.
- Proof lead: photo-reviews (typed postcard-backs) or the origin story painting — one leads.
- Which band palette dominates (a warm apricot build, a dusk teal build, a night build).
- Density: a three-poster stroll of 8 blocks or a full exhibition of 12.
Every client receives a new sibling — same painter, different poster. Repeating a previous
hero + block order + form combination fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: poster cream #F6EDD8 base; section grounds built as stepped sunset bands — 3 to 4
  horizontal flat strips (apricot #E8A05C, rose #D06A55, teal #2E6E6A, night #22384A) with
  hard edges, band heights varying 18 to 42% of the section, always horizon-logical (light
  above dark, or a deliberate night inversion once per page).
- Ink: #2A2420 headings and body on cream and apricot; cream #F6EDD8 text on teal and night
  bands. Poster red #C03E2E: prices, CTAs, ribbon fills, one accent word per section maximum.
- Display type: hero clamp(1.9rem, 7.6vw, 2.9rem), line-height 1.1 Latin / 1.3 Arabic —
  slab-proud; section titles clamp(1.4rem, 5.4vw, 2rem); body clamp(0.97rem, 4vw, 1.05rem)
  line-height 1.6 / 1.8; prices clamp(1.5rem, 6.4vw, 2.3rem) in poster red.
- Radii: 6px on cards and fields — posters have corners; chips 999px only for the sticky pill.
- Borders: 2px solid #2A2420 on offer cards (the poster's printed frame); elsewhere 1px at
  20% ink. Shadows: none — gouache is flat; separation is band against band.
- Spacing: sections 56 to 80px vertical on mobile; band edges themselves create rhythm, so
  padding stays disciplined.

The tics, precisely:
- POSTER-ILLUSTRATION SYSTEM: all imagery painted in flat gouache — 5 to 8 colors per scene
  drawn from the band palette, hard shapes with occasional dry-brush edge, no gradients
  except a two-step sky, no outlines heavier than paint itself, absolutely no photographic
  texture. Scenes: the product as still life, landscapes of its origin, harvest and craft
  moments. People, when needed, are painted small and faceless in the mid-ground, poster
  fashion.
- TITLE-RIBBON BANNERS: heraldic ribbon scrolls — a central band with two swallow-tail ends
  folding behind (fold faces darkened one step), carrying titles in the display face. Fill
  poster red with cream text, or cream with ink text on dark bands. The HERO ribbon is the
  page's crown and the only one that animates; section ribbons are smaller and still. Never
  a gift bow, never curled gift-wrap — these are proclamations, not presents.
- STEPPED SUNSET BANDS: the section grounds themselves (measured above) — the world's
  horizon. Content sits ON the bands; band edges never gradient, never wave, never scallop.
  A build chooses its hour: morning (apricot-led), dusk (rose-teal), or one night section
  where cream text glows.

4. COLOR PHYSICS

Ground register: cream carries the page's margins and the form; sunset bands carry the
sections. Warm bands (apricot, rose) should hold 50 to 70% of banded area in a default build;
teal is the cooling counterweight; night #22384A appears at most once per page as the deep
moment (the offer or the origin story). Ink register: #2A2420 only — one ink, like one
printing plate. Accent physics: poster red #C03E2E is the fare line and the call — prices,
CTAs, ribbon fills, a single accented word per section. Cap 12% of any viewport. Forbidden:
photographic color noise, pastels, neon, purple, gradients beyond a two-step painted sky,
pure black, pure white, and any fifth band color inside one build.

5. TYPOGRAPHY

Latin stack: display Alfa Slab One (400 — the poster's woodtype voice) or Yeseva One for a
softer-serif build; body Karla 400/700. Pairing rule: one display + Karla; display sets hero,
section titles, ribbons and prices; Karla explains beneath the paint.
Arabic stack: display Lalezar (400) — bold poster Arabic — or Rakkas for a more painted hand;
body Almarai 400/700. Pairing rule: Lalezar + Almarai default; Rakkas + Almarai when the
client's voice is more ornamental.
Shared clamps as above; Arabic display at 90% of the Latin ceiling, line-height 1.3 minimum;
Arabic body 1.75 to 1.9. NEVER letter-spacing on Arabic; Latin display may take 0.01em only.
Digits: Western Arabic numerals for prices in both scripts; phone numbers wrapped LTR.
RTL: logical properties everywhere; ribbons mirror their swallow-tails; band logic is
symmetric; x-slides reverse; the painted scenes themselves need no mirroring.

6. SIGNATURE ART AND COMPONENTS

The tics are the print shop. The illustration system IS the world — remove the paintings and
Zman is nothing, which is exactly why the imagery law is absolute. Ribbons proclaim: wherever
a ribbon flies, the page is announcing, and the hero's unfurl is the poster being hung.
Sunset bands set the hour: a buyer scrolling Zman moves through a painted day, morning cream
to apricot noon to teal dusk, arriving at night exactly where the seller wants gravity.

Supporting cast: poster-framed cards (2px ink border, cream fill); painted-chip labels (small
cream rectangles with ink text, like poster corner stamps of price-per-kilo); the fare-line
price lockup (old fare struck once in ink, new fare in poster red); the sticky bar as a slim
night band with cream text and a poster-red button; postcard-back review cards — a cream card
with a vertical dividing rule, typed text on one side and the reviewer's painted-town name on
the other. No handwriting anywhere, no postage stamps.

Imagery, the exact painted spec for production: "vintage 1950s North African travel poster
illustration, flat gouache, limited palette of apricot rose teal night-blue cream, hard-edged
shapes, subtle dry-brush texture, painted still life and landscape, no text in artwork, no
photographic realism". Every asset of one build uses this phrase family with the scene
changed; the paintings must look like one artist, one afternoon, one poster series.

7. THE SPINE

Hook, convince, offer, order form — the gallery walk, in order, invisible. Price appears in
the HERO as the fare line beneath the ribbon title — posters always told you the fare. The
sticky CTA is a slim night-band at the bottom, cream label, poster-red button, price always
aboard; tapping slides the walk to the ticket booth. Mobile-first at 390px. Desktop law:
centered mobile shell — the page hangs at ~460px on wide poster cream like a framed print on
a gallery wall; the cream margin may carry a faint painted palm-frond at 4% opacity, fixed,
at most one.

8. BLOCKS TREATMENT

Supported blocks, dressed by Zman:
- announcement-bar: a slim ink line on cream — delivery promise, COD, تغليف الهدية — with a
  tiny ribbon-end glyph as separator.
- problem-solution: the forgotten-taste pain (تمور بلا روح، هدايا بلا حكاية) painted in two
  beats — a gray-day painting answered by a golden-band painting; captions short.
- ingredients-infographic: origin and content as a painted-map-free card — the oasis painting
  with cream chips naming origin, variety, weight (دقلة نور، توزر، ١ كغ); for worn goods it
  becomes the craft card (حرير، صوف، صباغة يدوية).
- benefits-icons: 4 to 5 painted-chip labels with tiny painted glyphs (palm, sun, box, hand)
  — flat, four-color, never line-icons.
- unboxing-gallery: the coffret's contents as ONE painted flat-lay scene with cream chips
  naming each piece; the painting does the unboxing.
- photo-reviews: postcard-back cards — typed praise, reviewer name and town (بسكرة، توزر،
  الجزائر), a painted town-silhouette thumbnail where a photo would be; ratings as small
  poster-red suns, filled or hollow.
- stats-band: a teal or night band with three cream numerals painted-plain — سنوات الواحة،
  عائلات راضية، أيام للتوصيل — counting once.
- guarantee-seal: a ribbon banner carrying the promise (يوصل سليم، وإلا نبدلوه) with the
  exchange window in Karla/Almarai beneath — a proclamation, not a badge.
- price-anchor: the fare lockup — old fare struck in ink, new fare large in poster red on a
  cream panel framed 2px; per-kilo or per-gift math beneath in body face.
- bundle-offers: ١ كغ vs ٢ كغ vs coffret as three framed poster-cards, the recommended one
  carrying a small still ribbon; feeds the form.
- order-steps: 4 steps as a painted caravan-free strip — numbered cream circles on a band
  (اطلب، نأكدو، التوصيل، الدفع عند الباب); no routes, no dotted lines.
- faq: cream rows with ink rules; questions about freshness, storage, gift wrap, return —
  answered in the host's calm voice.
- trust-footer: the night band — cream text, phone and WhatsApp large, the line "من زمان
  الخير، إلى داركم" and legal small beneath; one last small ribbon, still.

Refused blocks:
- whatsapp-proof: chat bubbles would puncture the painted world; postcards carry the voices.
- video-testimonial: moving pictures break gouache; the paintings must stay sovereign.
- stock-urgency: زمان does not run out; scarcity theater is beneath the poster's dignity.
- spec-table: an engineering grid on a painting is vandalism; facts live in painted chips.

9. HERO MENU

- L'Affiche Complète (full poster): one tall painted scene — casbah, palms, the product still
  life low center — with the ribbon title across the upper third, fare line and CTA on a
  cream panel at the base.
- Nature Morte (still-life-first): the painted product close and proud on an apricot band,
  ribbon above, fare and CTA immediately beneath; for products that are the hero alone.
- Bandes du Soir (stepped-sky split): title and fare on cream at top, the painting below
  running through three bands to night; the ribbon rests on the horizon line.
- Le Retour (story-hook): a kicker of memory (تذكر طعم دار جدك؟), ribbon title answering,
  painting beneath, fare and CTA on cream.
- Galerie (bundle-first): the three coffret options as three small framed posters side by
  side, the middle one ribboned; for gift-season builds.
- Carte Postale (postcard hero): the hero framed as an oversized postcard front — painting
  full-bleed inside the 2px frame, ribbon title, fare stamped in poster red at the corner.

10. FORM MENU

- Guichet (single card): the ticket-booth card on cream — name, phone, wilaya select, gift-
  wrap chip row, poster-red submit; the COD line beneath set like a fare condition.
- Écho du Marcheur (hero-echo): two fields under the hero for the already-sold, repeated in
  full at the booth; the mini slides the walk downward on submit.
- Deux Guichets (2-step wizard): coordinates, then delivery and gift options; progress as two
  small suns filling poster-red.
- Barre de Nuit (sticky-driven): the night band is the only CTA until the booth; tapping
  focuses the first field and the booth's frame draws once.

11. MOTION IDENTITY

Poster press: entrances slide as whole slabs — 24 to 32px, 0.45s, firm ease-out, staggers at
100ms — the feel of prints laid down decisively. The ONE signature scroll moment: the hero
ribbon unfurls once (clip-path wipe along its curve, 0.9s) as the page opens. Band edges,
paintings and chips never animate; suns fill once in ratings. Banned motion: parallax between
painting layers, loops, overshoot, page-long scroll scrubbing, any Ken-Burns drift on
paintings. Under prefers-reduced-motion: everything visible, ribbon pre-unfurled. All motion
gated on gsap + ScrollTrigger; content never hidden in CSS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-for-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics, banned by name: affiche's fit-to-viewport headlines and per-section poster-
color rotation (Zman's bands are stepped WITHIN sections, and type stays disciplined);
atlas's passport stamps, dotted routes and contour lines; gazette's halftone-dot imagery;
bulle's comic panels, speech bubbles and speed lines (painted ≠ drawn cartoon — hard wall);
folies' gold sunbursts and fan rays; jihaz's satin bows (Zman's ribbons are heraldic scrolls,
never presents); dukkan's painted price planks and brush arrows (the shop sibling — Zman is
the printed poster, dukkan is the wet brush; no plank textures, no drips here).
Own temptations, also banned: photographic anything, sepia filters, paper-grain overlays,
postage stamps, torn poster edges, and painting more than one artist's style into one build.
Refused blocks restated: whatsapp-proof, video-testimonial, stock-urgency, spec-table.

13. EXAMPLE VARIATIONS

- "علبة زمان — دقلة نور" — home & kitchen. L'Affiche Complète hero; announcement-bar,
  problem-solution, ingredients-infographic, unboxing-gallery, photo-reviews, guarantee-seal,
  price-anchor, bundle-offers, order-steps, faq, trust-footer; Guichet form. Mood: the oasis
  hung on a wall. Signature: the hero ribbon unfurls over the palms.
- "زيت الزيتون البلدي" — health & wellness. Nature Morte hero; ingredients-infographic,
  stats-band, photo-reviews, price-anchor, bundle-offers (1L/2L/5L), guarantee-seal, order-
  steps, faq, trust-footer; Deux Guichets wizard. Mood: the press of the village, bottled.
- "فولار الحرير الجزائري" — fashion & apparel. Carte Postale hero; problem-solution, craft
  card, photo-reviews, price-anchor, variant-free galerie of three motifs as bundle-offers,
  order-steps, trust-footer; Écho du Marcheur form. Mood: a painted souvenir you can wear.
- "عسل الأوراس الحر" — health & wellness. Le Retour story-hook hero; ingredients-infographic,
  benefits-icons, photo-reviews, stats-band, price-anchor, guarantee-seal, order-steps, faq,
  trust-footer; Guichet form. Mood: the mountain's gold, fare stated.
- "قفطان العيد المطرز" — fashion & apparel. Bandes du Soir hero; craft card, photo-reviews,
  bundle-offers (بالحزام / بدونه), guarantee-seal, price-anchor, order-steps, faq, trust-
  footer; Barre de Nuit sticky-driven form. Mood: dusk bands dressing the season.
- "كوفريه الضيافة الكامل" — home & kitchen. Galerie bundle-first hero; unboxing-gallery,
  photo-reviews, guarantee-seal, price-anchor, order-steps, faq, trust-footer; Deux Guichets
  wizard. Mood: three posters, one welcome.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
