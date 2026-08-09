import type { DesignWorld } from "../types";

export const oud: DesignWorld = {
	id: "oud",
	name: "Oud",
	family: "parfum-noir",
	tagline: "Bordeaux night, amber light, the note pyramid",
	kind: "cod",
	mood: ["oriental", "deep", "warm", "refined"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["beauty & cosmetics", "jewelry & watches", "fashion & apparel"],
	avoidFor: ["kids & baby", "fitness equipment", "home & kitchen"],
	fusesWith: ["kenz", "hikaya"],
	preview: {
		ground: "#1D1016",
		ink: "#F1E6D8",
		accent: "#C98F4E",
		fontFamily: "Cormorant Garamond",
		sampleWord: "عود",
	},
	doc: `
OUD — THE INCENSE CHAMBER

1. PHILOSOPHY

Oud is the room where the good perfume is kept: bordeaux walls gone almost black, one amber
lamp, the outline of a flacon remembered on the wall like a family crest. It sells scent and
the objects of scent — perfume, bakhoor, the fine accessories that share a drawer with them
— to buyers for whom fragrance is lineage, not novelty. The world's persuasion is depth:
where a glam page dazzles and a vault page isolates, Oud SURROUNDS. Wine-dark grounds warm
at the corners, an enormous quiet bottle-silhouette watermarks the section, and the one
technical diagram this world allows — the note pyramid — is drawn like an heirloom chart:
top notes, heart, base, descending as the evening does.

The voice is a connoisseur's murmur, Arabic-first and unhurried: "يبدأ بالورد، ويبقى
العنبر". Claims are sensory but precise — concentration, millilitres, hours of sillage —
because perfume people respect numbers whispered, not shouted. The COD spine — hook,
convince, offer, order form — runs under the incense: hook is the first breath, convincing
is the dry-down, the offer is poured once, and the form closes like a stoppered bottle,
with pay-at-the-door said plainly in candle ink.

Self-audit before shipping:
- Does the page read bordeaux-dark with amber warmth — never black-and-gold, never violet?
- Is the note pyramid present, three tiers, drawn as the world's one diagram?
- Do flacon watermarks sit behind sections at 1px outline and 6-8% opacity, huge and calm?
- Are bloom corners true corner shading (two opposite corners), never discs behind content?
- Is brass confined to hairlines; amber to text accents and the CTA?
- Could every line be murmured across a perfume counter without embarrassment?
- Is exactly ONE signature moment present (the pyramid assembling, once)?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The evening unfolds in order.
- Palette registers: grounds #1D1016→#2A171F; ink #F1E6D8; amber #C98F4E; wine #7E2A3C;
  brass hairlines #9C7A4A.
- Type stacks: Latin display Cormorant Garamond (600) or Italiana; body Jost. Arabic
  display Amiri; body Noto Naskh Arabic.
- The three owned tics: note pyramids, flacon watermarks, bordeaux bloom corners.
- Motion identity "warm settle": 1s fades; the pyramid assembles tier-by-tier once.
- Desktop law: centered mobile shell (~470px).
- Refused blocks: lottery-contest, stock-urgency, comparison-table, before-after.
- Imagery style: bordeaux-dark perfume photography per Signature Art.

CLIENT-OWNED — re-decided fresh for every build:
- Hero composition from the hero menu.
- Block choice within the supported set and BLOCK ORDER.
- Form style from the form menu.
- Which sections carry watermarks (2-3 per page) and the silhouette's identity (flacon,
  mabkhara, the product's own outline).
- Proof emphasis: photo-reviews or whatsapp-proof or stats.
- Amber temperature within register (honeyed or duskier) and where wine appears.
Every client receives a new blend — same chamber, different attar. A copied blend is a
counterfeit and fails.

3. VISUAL SIGNATURES

Measured values. Grounds: #1D1016 base, #241319 raised panels, #2A171F the warmest band
(one per page, usually the offer). Ink: #F1E6D8 headings, #D9C8B4 body, #B39A82 captions.
Amber #C98F4E for CTAs, accents, prices (press #B77E41); wine #7E2A3C for one emotional
line or underline per viewport; brass #9C7A4A strictly 1px rules and frames. Display:
clamp(30px, 8vw, 46px) Cormorant Garamond, line-height 1.16; section titles clamp(21px,
5.5vw, 29px); body clamp(15px, 4vw, 16.5px), line-height 1.65 Latin / 1.85 Arabic. Prices
clamp(22px, 6vw, 30px) amber with a 24px brass rule above. Radii: 10px cards; photos
square in 1px brass frames. Shadows: none — depth is tonal; warmth is the two bloom
corners per section (radial #7E2A3C at 14-18% opacity, 300-420px, anchored at two OPPOSITE
corners, alternating pairs section to section). Spacing rhythm: sections at clamp(64px,
16vw, 96px) vertical padding; attar cards carry 20-24px internal padding on a 20px
baseline. Form fields: 54-56px height, bordeaux-raised ground #241319, 1px brass border
brightening to amber on focus (2px, no glow ring — lamps do not flash), labels always
above in caption ink, error states in wine #7E2A3C with a one-line murmured correction
("رقم الهاتف ناقص") — never red alarm. The sticky bar is 60px, its brass hairline 1px,
its pill 44px high; on scroll the bar fades in over 0.4s and never slides.

The tics, precisely:
- NOTE PYRAMIDS: a three-tier stacked diagram — three horizontal bands narrowing upward
  (top/heart/base), each band a brass-hairline rectangle with the tier name in caption
  size and its notes in body ("قمة: ورد طائفي، زعفران")، amber tier-numerals at the start
  edge. Drawn once per page; the world's only chart.
- FLACON WATERMARKS: an enormous product-silhouette outline (1px brass at 6-8% opacity,
  120-180% of viewport height) placed behind 2-3 sections, cropped by the section edges,
  never complete, never filled.
- BORDEAUX BLOOM CORNERS: the corner-shading described above — always corners, always a
  pair, never centered glows, never discs floating behind content.

4. COLOR PHYSICS

Ground register: the three bordeaux-black steps; a build maps its warmth — the #2A171F
band belongs to the offer or the finale form. Ink register: candle parchment trio; pure
white forbidden. Accent physics: amber #C98F4E is the lamp — CTAs, prices, tier numerals,
key words; honeyed drift to #D6A05E or dusk to #B87F42, one temperature per build. Wine
#7E2A3C appears at most once per viewport (a line, an underline, a single word). Brass is
frame metal only. Forbidden: gold-on-black vault codes (that is kenz), violet (falak),
rose-gold (hikaya), silver, any green or blue, gradients on text, glitter, and smoke
imagery drawn as UI (photography may hold real smoke; the interface may not).

5. TYPOGRAPHY

Latin stack. Display: Cormorant Garamond (600) — the connoisseur's serif; Italiana as the
thinner alternate for modern niche brands. Body: Jost (300/400). One display + Jost.
Small-caps Latin labels at 11-12px tracked 0.16em ("EAU DE PARFUM", "SILLAGE 8H"). Arabic
stack. Display: Amiri (400/700) — poetry-grade naskh; body Noto Naskh Arabic (400/600).
Amiri + Noto Naskh fixed. Shared clamps; Arabic display ~8% smaller at top. Arabic body
line-height 1.8-1.9; NEVER letter-spacing on Arabic. Digits: Western Arabic numerals; the
price format for the demo market is "289 ر.س" with digits in an LTR span. RTL: logical
properties; pyramid tier-numerals sit on the start edge; watermarks may mirror freely;
bloom corner pairs mirror with the flow.

6. SIGNATURE ART & COMPONENTS

The chamber set: sections as tonal rooms, watermark silhouettes on the walls, bloom
corners warming each room differently. Components: attar cards (raised panels, 1px brass
frame, 10px radius) for benefits/reviews/offer; the pyramid; sillage meter FORBIDDEN
(no bars, no gauges — duration is spoken in words and hours); ritual steps as numbered
brass circles; the CTA — an amber pill, bordeaux text, 56px, brass outer hairline; chips
as bordeaux pills with amber text.

Imagery. Bordeaux-dark perfume photography: dark glass flacons on stone or dark wood,
amber side light, oud chips, dried rose, saffron threads as props, wine-dark backdrop
swallowing edges, real smoke wisps permitted IN PHOTOGRAPHS only, macro details of glass
and liquid. Abundant shadow, honeyed highlights. No faces; hands allowed with rings. No
text or logos in frame. Any product in this world's niches receives the same treatment:
photographed as an heirloom of scent — even a watch or an abaya is staged beside the
flacon's light.

7. THE SPINE

Hook, convince, offer, order form — the evening's order, locked. Price placement law: the
price appears in the hero, small and amber under the product name (murmured, not
announced), and is restated fully at the price-anchor. Sticky CTA: a slim #1D1016 bar,
brass top hairline, amber price + pill "اطلب عطرك"; appears after the hero, always
scrolls to the form. Mobile-first 390px; desktop is the centered mobile shell (~470px) on
wide bordeaux-black with one faint watermark behind the shell.

8. BLOCKS TREATMENT

Supported blocks, dressed by Oud:
- announcement-bar: one candle line on the base ground ("توصيل لكل المدن · الدفع عند
  الاستلام"), brass hairline beneath.
- problem-solution: the wrong-perfume ache — two murmured lines, then the attar card
  where the scent answers; a bloom pair warms the turn.
- ingredients-infographic: THE NOTE PYRAMID — this world's mandatory dressing of the
  block; origins line beneath ("عود كمبودي، ورد طائفي").
- benefits-icons: 3-4 attar cards with thin brass icons (drop, flame, hourglass, moon):
  concentration, longevity, sillage, occasion.
- how-it-works-steps: the ritual — 3 steps (نقطتين على المعصم…) in brass-circled
  numerals with one line each.
- photo-reviews: the majlis speaks — name, city, stars as brass diamonds, two lines; one
  review may be elevated large in display italic (Latin) / Amiri (Arabic).
- whatsapp-proof: allowed as reorder murmurs — bubbles restyled bordeaux/candle in an
  attar card; used sparingly.
- stats-band: three numbers on the warmest band — "زبون دايم 4800+" — settle once, no
  racing.
- guarantee-seal: the house's word — an attar card with brass frame: authenticity,
  exchange window, pay at the door; no medals, no ribbons.
- price-anchor: the pouring — warmest band, watermark behind, old price struck small in
  smoke, new price amber in display, one wine underline; per-use math allowed ("أقل من
  ريالين لليلة").
- bundle-offers: attar duos — 50ml vs the coffret (perfume + bakhoor) — two cards, the
  coffret brass-framed thicker and flagged "اختيار الذوّاقة"; feeds the form. Per-unit
  math whispered in captions ("العطرة تطلع أرخص في الكوفريه"), never percentage bursts.
- variant-gallery: sizes and concentrations as bordeaux chips with amber text (12ml /
  50ml / 100ml), the selected chip brass-framed; a scent-family variant (عود / مسك /
  ورد) may swap the hero photo and the pyramid's notes together — the page must stay
  coherent when it does. Feeds the form.
- cross-sell: one companion at the door — a small attar card ("زيد المبخرة بـ 89 ر.س")
  with a single checkbox styled as a brass-ringed dot; total restated in the form.
- unboxing-gallery: the coffret opened — pieces on bordeaux velvet-DARK ground (photo),
  each named in captions; count chip in amber.
- order-steps: four murmurs: تطلب، نتصل، نغلّف بعناية، تدفع عند الباب — thin icons, one
  line each.
- faq + trust-footer: faq as brass-ruled accordions; footer on base ground — phone,
  WhatsApp, the house line "بيت عطور منذ 2016", closing brass rule.
Refused blocks: lottery-contest (heritage is not raffled), stock-urgency (scarcity is
implied, never counted), comparison-table (a house never names rivals), before-after
(scent has no photographs of after).

9. HERO MENU

- The First Breath: flacon photo center in amber light, name above in display, one
  murmured hook line, small amber price, CTA; watermark behind. The default.
- The Pyramid Open: ingredients-led — the note pyramid sits directly under the name and
  price, photo beside/beneath; for scent-literate audiences.
- The Heirloom: story-hook — one Amiri line ("العطر اللي يسألوك عليه")، photo in brass
  frame, price, CTA; quietest.
- The Coffret Reveal: multi-piece hero — the opened box photo full-width top, then name,
  price, CTA on the base ground; for gift sets.
- The Silhouette: the watermark itself is the hero's art — huge outline behind name/price/
  CTA, small real photo anchored at the base; boldest composition.
- The Majlis Split: photo end-side, start-side name + two vows + price + CTA; the most
  conventional, for restrained builds.

10. FORM MENU

- The Stopper (default): one attar card on the warmest band — big labeled fields, amber
  submit pill, COD line in candle ink; brass frame. The success state seals the bottle: a
  brass-framed card with the order number, "نتصل بك للتأكيد", and the house's thanks in
  Amiri — no confetti, no ticks, the chamber stays calm even in celebration.
- Two-Pour Wizard: pour one selects size/coffret (attar cards), pour two takes name,
  phone, city; progress as two small flacon glyphs (filled = done).
- Echo Drop: a compact 2-field form under the hero for the devoted, repeated in full at
  the end; both validate identically.
- The Ledger: form styled as the house's order ledger — fields on ruled brass hairlines;
  for heritage-heavy builds; laws unchanged.

11. MOTION IDENTITY

Warm settle: entrances 1s power1.out fades with 10px rises, staggered 120ms; the room
breathes slowly. Blooms and watermarks are static. The ONE signature moment: the note
pyramid assembles tier-by-tier — base, heart, top — 0.4s each, once, on entry. Numbers
settle once. Reduced motion: everything visible, pyramid complete. Gated per DEMO-LAWS;
gsap.set only for hiding; the chamber reads fully with JavaScript off.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: kenz's
spotlight cone, gold-dust drift and velvet jewel-box (Oud warms rooms, never spotlights
jewels); falak's smoke threads, moon phases and crystal facets (smoke lives only inside
photographs here); rimel's blush orbs (blooms are corner shading, never discs behind
content); hikaya's subtitle strips, episode chips and curtains; cinetique's ghost stroked
numerals (watermarks are product silhouettes, never numerals); iris's single aura;
hammam's steam veils; dahab's per-gram plaques and crimson vitrines. Oud's own
temptations, banned: gold-on-black styling, filled silhouettes, more than three
watermarks, smoke as SVG decoration, sillage meters/gauges of any kind, and oud-wood
texture wallpaper. Refused blocks restated: lottery-contest, stock-urgency,
comparison-table, before-after.

13. EXAMPLE VARIATIONS

- "Oud El Leil" — beauty & cosmetics (niche EDP 50ml, ar-SA). First Breath hero; announce,
  problem murmur, NOTE PYRAMID, benefits, photo-reviews with one elevated, stats band,
  guarantee, price-anchor pour, bundle coffret, order-steps, The Stopper form, faq,
  footer. Watermarks ×2.
- "Bakhoor Es-Salon" — beauty & cosmetics (bakhoor + mabkhara set). Coffret Reveal hero;
  how-it-works ritual, pyramid (smoke notes), benefits, whatsapp murmurs, guarantee,
  price-anchor, unboxing, Two-Pour Wizard, footer. Mabkhara silhouette watermark.
- "Misk Al Fajr" — beauty & cosmetics (musk attar 12ml). Heirloom hero; pyramid, benefits
  (3), photo-reviews, guarantee, price-anchor with per-night math, Echo Drop + full
  Stopper, faq, footer — a lean 9-beat evening.
- "Sa3at Al Atr" — jewelry & watches (dress watch staged in the chamber). Majlis Split
  hero; benefits, photo-reviews, stats, guarantee, price-anchor, unboxing (watch +
  travel pouch), The Ledger form, faq, footer. The pyramid absent — its slot given to a
  brass-ruled heritage note; watermark is the watch's outline.
- "Abaya Layl" — fashion & apparel (evening abaya). Silhouette hero (abaya outline);
  benefits (fabric, cut, occasion), photo-reviews, guarantee, price-anchor, variant sizes
  as bordeaux chips, Two-Pour Wizard, footer. Wine underline on the hero only.
- "Coffret Al 3iid" — beauty & cosmetics (perfume + bakhoor gift). Pyramid Open hero;
  unboxing, benefits, photo-reviews, stats, guarantee, price-anchor, bundle (solo vs
  coffret), The Stopper, faq, footer. Blooms alternate all four corners across the page.
- "Khatm Al Majlis" — jewelry & watches (men's aqeeq ring). The Heirloom hero with the
  ring's outline as watermark; benefits (stone, silver, occasion), photo-reviews, cross-
  sell (travel pouch), guarantee, price-anchor with wine underline, variant sizes as
  chips, Echo Drop + full Stopper, faq, footer. Mood: the quiet uncle of the library —
  proof the chamber sells metal as gracefully as musk, with the pyramid's slot given to
  a three-line provenance note on brass rules.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
