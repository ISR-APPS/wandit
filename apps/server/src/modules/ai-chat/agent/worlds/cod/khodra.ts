import type { DesignWorld } from "../types";

export const khodra: DesignWorld = {
	id: "khodra",
	name: "Khodra",
	family: "appetit",
	tagline: "Fresh-market appetite: crates, wax paper, tomato red",
	kind: "cod",
	mood: ["fresh", "appetizing", "honest", "morning"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["home & kitchen", "health & wellness", "pets"],
	avoidFor: ["fashion & apparel", "jewelry & watches", "electronics & gadgets"],
	fusesWith: ["dar", "souk", "dukkan", "jnina", "bahr"],
	preview: {
		ground: "#FBF6EA",
		ink: "#22301F",
		accent: "#D9342B",
		fontFamily: "Bree Serif",
		sampleWord: "طازج",
	},
	doc: `
KHODRA — THE 7AM MARKET STALL

1. PHILOSOPHY

Khodra smells of coriander and wet crates. It is the fresh-market world: cream morning
light, leaf green, tomato red, kraft and wax paper — the visual language of a stall whose
owner arrives before dawn and stacks the good produce where you can pinch it. Khodra sells
kitchen tools, food gear and honest pet supplies the way a marchand sells peaches: by
appetite and by proof. The page never begs; it displays. Products sit ON things — crates,
paper, boards — because at the market nothing floats; everything has weight and a place it
was set down.

The world's honesty rule: freshness never panics. No countdown hysteria, no fake scarcity
— the stall sells out because the stuff is good, and says so with numbers and full bowls.
Copy talks like the marchand: short, warm, sure of its scales. "خضرة الصباح، وسكين يليق
بيها." Appetite does the persuading: the chopped onions glisten, the bowl fills, the
family eats.

Self-audit before shipping:
- Does the page feel set on real surfaces — paper, crates, boards — never on flat voids?
- Are the produce stickers oval, small and PLU-like — never die-cut white-halo stickers?
- Do crate-slat bands frame sections without a single bolt or metal plate?
- Is tomato red rationed to appetite moments (price, CTA, one sticker per section)?
- Does every food photo make someone hungry — glisten, steam, fullness?
- Zero urgency theater: no countdown, no stock panic anywhere?
- Form fields 56px+, labeled, success state in the marchand's warm voice?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — the stall's four gestures.
- Palette registers: cream #FBF6EA grounds with leaf #2E6B3E sections; ink #22301F;
  tomato #D9342B; leaf-light #7FB069; kraft #C9A876.
- Type stacks: Latin display Bree Serif or Fraunces black, body Karla; Arabic display
  Cairo 700, body Almarai.
- The three owned tics: wax-paper crinkle panels, crate-slat bands, produce sticker
  badges.
- Motion identity "market morning": 0.4s pops, sticker slap-ons, nothing loops.
- Desktop law: responsive expansion, max 1060px.
- Refused blocks: lottery-contest, stock-urgency.
- Imagery: fresh-market food photography (spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice and ORDER — a hachoir convinces by action shots, a gamelle by the happy
  bowl.
- Form style from the form menu.
- Proof lead: photo-reviews or whatsapp-proof.
- Which claims earn stickers and where they slap on.
- Green-section rhythm (one interlude or two); density from a brisk 9 to a generous 13.
Every client gets a new stall — same market, different morning. A clone fails.

3. VISUAL SIGNATURES

Measured values. Grounds: cream #FBF6EA primary; leaf #2E6B3E full-bleed interlude
sections (1-2 per page) with cream text; cards are wax-paper panels #FDFBF2 with crinkle
highlights. Ink #22301F; secondary #55604F; captions #8A927F. Tomato #D9342B for price,
CTA, one sticker per section (12% viewport cap). Leaf-light #7FB069 for checks and small
accents; kraft #C9A876 for tags and the footer band.

Type: display clamp(28px, 8vw, 44px) Bree Serif (round slab warmth) or Fraunces 900,
line-height 1.15; Arabic display Cairo 700 at 95%. Section titles clamp(20px, 5.5vw,
27px). Body Karla clamp(15px, 4vw, 16.5px) line-height 1.6; Almarai 1.8. Prices in
display face, tomato or ink.

Shapes: wax-paper panels 10px radius with an irregular 1px #E7DFC9 edge and 2-3 subtle
crinkle highlight strokes (soft white 40% lines, never shadows); crate bands are
horizontal slat groups (3-4 slats, 10-14px tall each, kraft fill, 1px #A98B5F rules,
visible end-grain caps at the sides); stickers are 44-60px ovals, flat fills (tomato,
leaf, cream), 1px darker rim, tiny serrated... no — smooth oval PLU edge, 1-2 word
labels. Buttons: 12px radius slabs, tomato fill, 54px min. Shadows: one soft contact
shadow allowed UNDER photographed objects inside panels (they sit, not float); UI casts
none.

The tics, precisely:
- WAX-PAPER CRINKLE PANELS: content cards rendered as wax paper — the tint, the
  irregular edge, 2-3 crinkle highlights; sections' text sits on them like goods wrapped
  at the counter. Never torn, never folded corners.
- CRATE-SLAT BANDS: section frames/dividers built from horizontal wooden slats with end
  caps; a band may carry a section label on a small kraft tag
  nailed flat (drawn nail head allowed, 4px, one per tag).
- PRODUCE STICKER BADGES: oval stickers slapped on photos and panels ("طازج", "BIO",
  "N°1", "توصيل اليوم") at slight rotations (±6°); at most one tomato sticker per
  section, others leaf or cream.

4. COLOR PHYSICS

Ground register: cream carries the market morning; the leaf-green interlude is the shaded
aisle: 1-2 per page, full-bleed, cream ink on top. Ink register: three steps of garden dark. Tomato
physics: appetite red appears where hunger decides — price, CTA, one sticker, one
underline; never grounds, never paragraphs. Kraft is material, not decoration: tags,
footer, crate fills. Forbidden: purple, blue (no cool tech tones at the market), black
sections, gradients, neon, gray minimalism. Kraft physics: kraft is packaging, so it
appears wherever something is handed over — tags, the footer band, crate fills, the
order number in the success state — and never as a text color; ink on kraft must keep
4.5:1 contrast, which pins kraft between #C9A876 and #D4B588. White exists only inside
wax panels; a bare #FFFFFF section would read as a supermarket, and Khodra is a stall.

5. TYPOGRAPHY

Latin stack: display Bree Serif — the warm slab of a hand-lettered price board tamed —
or Fraunces 900 for juicier builds; body Karla 400/700. Arabic stack: display Cairo 700;
body Almarai 400/700. Pairing: one display per build; prices always display face.

Clamps shared (Arabic display 95%); Arabic body line-height 1.7-1.9; no letter-spacing
on Arabic; Latin small labels may take 0.04em. Digits: Western Arabic numerals; phone
LTR-wrapped. RTL: logical properties; sticker rotations flip sign; crate-band tags sit
on the logical start slat; the checklist checks swap sides.

6. SIGNATURE ART & COMPONENTS

Supporting cast: leaf-check bullets (2px leaf-light checks); kraft price tags (flat
rectangle, hole + no string — herbier owns strings — the hole is empty) for secondary
prices; steam curls (2px, two bends max) allowed over ONE hot-food photo per page;
review cards as wax panels with the buyer's city and drawn stars in leaf; sticky CTA as
a cream bar with 1px leaf rule, price left, tomato button right.

Imagery: fresh-market food photography — morning daylight, warm and real; products
staged on crates, boards and wax paper with real produce round them; action shots
(chopping, pouring, serving) with hands only; glisten and steam encouraged; backgrounds
stay market-warm (cream walls, wood), never studio-white. Pets builds shoot bowls and
paws, no full portraits. Every asset shares the same daylight and surface language.
Banned in photos: studio seamless voids, dark moody grades, blue gels, plastic-perfect
fake food.

Component measurements, for builders: wax panels pad 20px with the irregular edge drawn
as a subtle 1px path offset 0-2px from the true rectangle; crinkle highlights are 2-3
soft white strokes at 40% opacity, 60-120px long, angled 10-30°. Crate bands: slats
10-14px tall with 3px gaps, end caps 8px wide showing grain lines; the nailed kraft tag
is 90-140px wide with its 4px nail head centered top. Stickers: 44-60px ovals, label in
body face 700 at 12-13px, rim 1px darker than the fill; rotation locked between -6° and
6°. Leaf checks: 2px strokes, 16px. Steam curls: 2px, max two bends, 40-70px tall. The
sticky bar: 60px cream, 1px leaf rule, tomato button 42px. Section spacing clamp(52px,
13vw, 80px); the leaf interludes pad an extra 12px top and bottom. Focus rings: 2px leaf
#7FB069, offset 2. Form success: a wax panel with a leaf check circle, order number on a
kraft tag, and the marchand's promise "نتصلو بيك قبل ما نبعثو السلعة" — the market's word,
given plainly.

Copy register: Khodra talks like the marchand who knows your mother's order by heart —
warm, brisk, sure of his scales, allergic to hype. Sentences are short and physical:
what it cuts, how fast, how it washes. Darija-inflected Arabic is the home voice
("يفرم البصلة في ثلاثين ثانية، وعينيك ما يبكوش"); French builds keep the same market
cadence ("Cinq lames. Trente secondes. La chorba est prête."). Numbers beat adjectives
everywhere: blades, seconds, liters, washes. The only permitted superlative is the
sticker's — "N°1" — and it must be earned by a stats-band elsewhere on the page. Words
the market never says are banned: exclusif, révolutionnaire, magique. Words it always
says are welcome: طازج، مضمون، كي توصلك تخلص. Every section should read aloud well over
the noise of a morning market — that is the copy test: if a line needs quiet to work,
rewrite it.

7. THE SPINE

Hook, convince, offer, order form — always. Price placement: the price appears in the
HERO on a kraft tag or beside the title (display, tomato), and again on the sticky bar;
the price-anchor block restates it with the duo math. Sticky CTA: the cream bar above.
Mobile-first 390px. Desktop law: responsive expansion to 1060px — the hero splits, wax
panels ride a 2-column rhythm, crate bands span full width.

8. BLOCKS TREATMENT

Supported blocks, dressed by Khodra:
- announcement-bar: a slim leaf strip, cream text — "توصيل 58 ولاية · الدفع عند
  الاستلام" — one line.
- hero: product on its surface (photo), title, one appetite line, kraft-tag price,
  tomato CTA, 2 micro-trust chips; one sticker slapped on the photo corner.
- problem-solution: two wax panels — the blunt-knife morning vs the five-blade minute;
  action photo in the second.
- benefits-icons: 4-6 leaf-check bullets with short claims on a wax panel ("يفرم في 30
  ثانية").
- how-it-works-steps: 3 steps as small photos in wax panels with numbered kraft tags.
- ingredients-infographic: for food/pet goods — what goes in the bowl, listed with
  leaf checks and one full-bowl photo; origins named.
- photo-reviews: wax panels, name + wilaya + drawn leaf stars; one customer photo in a
  crate-framed thumb.
- whatsapp-proof: a chat recreated on a wax panel, bubbles cream/leaf-tint; the
  marchand's replies short and warm.
- stats-band: a crate-band framed strip: three display counters ("+7000 مطبخ",
  "4.8/5", "58 ولاية").
- variant-gallery: size/model variants as wax cards with sticker labels; selected gains
  a leaf rim; feeds the form.
- bundle-offers: solo / duo عائلي as two-three wax cards, per-unit math, tomato sticker
  "الأوفر" on one; feeds the form.
- cross-sell: one companion card (planche, gants) with a leaf checkbox.
- price-anchor: old price struck in caption, new price big in tomato, savings line,
  COD line beneath.
- guarantee-seal: a kraft tag seal — leaf check, "تبديل خلال 7 أيام"، one warm line;
  never circular text, never wax-stamp.
- order-steps + order-form + faq + trust-footer: per form menu; footer as a kraft band
  with phone, drawn WhatsApp glyph, market address line.

Refused blocks:
- lottery-contest: raffles are night games; the market sells food, not tickets.
- stock-urgency: freshness never panics — the stall restocks at dawn.

9. HERO MENU

- The Morning Stall: full-width photo (product on crate among produce), title + tag
  price + CTA stacked beneath, sticker on the photo. The default.
- Split Crate: photo start-side, text column end-side (stacks mobile); crate band under
  both.
- Action First: the in-use shot leads (chopping burst), product name arrives second —
  for tools whose action sells.
- Basket Hero: bundle photo as hero (everything laid on paper), per-unit math beside —
  for kits and packs.
- Marchand's Word: a one-line spoken claim on a wax panel above the photo ("أنا نبيع
  غير اللي نستعملو في داري") — trust first.
- Sticker Storm: title + photo with three stickers slapped at once (the page's sticker
  budget spent early) — for launch-day energy.

10. FORM MENU

- The Counter Card: one wax panel, kraft header ("سجّل طلبك"), stacked 56px fields,
  tomato submit. The default.
- Two-Basket Steps: step 1 choose bundle/variant, step 2 coordinates; progress as two
  kraft tags.
- Echo Tag: compact phone+wilaya pair under the hero on a small wax card; full Counter
  Card at the end.
- Bar-Driven: sticky bar only until the form, which opens focused.

11. MOTION IDENTITY

Market morning: entrances pop 0.4s power2.out with 12px rise; staggers 80ms. The
signature: produce stickers SLAP ON — scale 1.3 to 1 with a ±6° settle, 0.25s, once per
sticker as its section enters. Steam curls draw once over the hot photo. Counters count
once. Nothing loops, nothing floats. All gated on gsap + ScrollTrigger + no
reduced-motion; stickers sit placed with JS off. Banned: overshoot bounce, parallax,
marquees, wobble loops, any continuous motion.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows, hero carousels, parallax,
backdrop-blur, back.out overshoot. Neighbor tics banned by name: gommette's die-cut
white-halo stickers and peel corners (PLU ovals are flat, rimmed, small); fanzine's torn
paper and tape; herbier's tied string tags and specimen plates (kraft tags have empty
holes, no strings); dar's gingham hems and daylight beam; chantier's steel plates and
bolts; argan's crushed-spice swatches and oil ribbon; dukkan's painted planks and
pompoms; souk's starbursts and split-flap. Refused blocks restated: lottery-contest,
stock-urgency. Khodra's own temptations, banned: countdowns of any kind, more than one
tomato sticker per section, studio-white photo voids, cartoon vegetables, chalkboard
anything.

13. EXAMPLE VARIATIONS

- "Hachoir Bladi" — home & kitchen. Morning Stall hero; problem-solution, benefits,
  how-it-works, photo-reviews, bundle duo, price-anchor, guarantee, Counter Card form,
  faq, footer. One leaf interlude at reviews. Stickers: طازج + الأوفر.
- "Presse-Agrumes Sabah" — health & wellness. Action First hero (jus qui coule);
  ingredients (vitamine C), benefits, whatsapp-proof, price-anchor with per-glass math,
  Echo Tag + Counter Card, faq, footer. Steam swapped for
  citrus glisten.
- "Gamelle Anti-Glouton" — pets. Split Crate hero; problem-solution (le chien qui
  engloutit), benefits, photo-reviews (paw photos), cross-sell (tapis), price-anchor,
  Two-Basket Steps, faq, footer. Stickers in leaf only, tomato saved for price.
- "Kit Couscous du Vendredi" — home & kitchen. Basket Hero; ingredients-infographic,
  how-it-works, stats-band, bundle عائلي, guarantee, Counter Card, faq, footer. Two
  leaf interludes; the fullest, most generous build.
- "Planche + Couteaux Trio" — home & kitchen. Marchand's Word hero; benefits,
  photo-reviews, variant sizes, price-anchor, Bar-Driven form, faq, footer. Sparse
  9-block morning; single sticker on the hero.
- "Distributeur Croquettes" — pets. Sticker Storm hero; how-it-works, whatsapp-proof,
  stats-band, price-anchor, Counter Card, faq, footer. Sticker budget spent in the
  hero; the rest of the page calm.
- "Moulin à Épices Dada" — home & kitchen. Morning Stall hero variant with Action
  second; benefits, photo-reviews, bundle duo, guarantee, Echo Tag + Counter Card,
  faq, footer. Fraunces build (juicier serif), kraft denser.
- "Thermos Soupe de Minuit" — health & wellness. Marchand's Word hero ("سخون حتى
  الفجر، مجرّب في رمضان"); how-it-works, benefits, whatsapp-proof, stats-band inside a
  crate band, cross-sell (louche pliable), price-anchor with per-repas math, guarantee,
  Two-Basket Steps form, faq, footer. One leaf interlude at the proof; steam curls
  spent on the hero's bowl — the only heat the page needs.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
