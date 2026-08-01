import type { DesignWorld } from "../types";

export const hammam: DesignWorld = {
	id: "hammam",
	name: "Hammam",
	family: "serene-spa",
	tagline: "Steam, stone and celadon — the calmest seller",
	kind: "cod",
	mood: ["serene", "mineral", "ritual"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["beauty & cosmetics", "health & wellness", "home & kitchen"],
	avoidFor: ["electronics & gadgets", "car accessories"],
	fusesWith: ["argan", "rimel", "remede", "atay"],
	preview: {
		ground: "#EDE9E2",
		ink: "#39413E",
		accent: "#9DB8AC",
		fontFamily: "Reem Kufi",
		sampleWord: "حمّام",
	},
	doc: `
HAMMAM — STEAM AND STONE

1. PHILOSOPHY

Hammam sells the way warm water convinces a tired body: slowly, wordlessly, by temperature.
This is the quietest funnel in the library — a ritual room rendered as a page. Stone-colored
grounds, celadon the shade of water over tile, and steam: soft white veils rising over the
edges of photographs like the first minute inside the bathhouse. Nothing here hurries the
buyer, because hurry is the enemy of the thing being sold — self-care, ritual, the fifteen
minutes a person keeps for themselves. Every block is a stone worn smooth: rounded, heavy,
placed with intention. Where other worlds argue, Hammam breathes. The persuasion is
sensory — texture photography you can almost touch, ingredient lists that read like a
tradition, and a rhythm of whitespace that lowers the reader's pulse. Urgency mechanics are
banned not as a style choice but as a law of physics: steam does not count down. The page
must feel like it costs more than it does — premium through calm, never through gold. If a
build ever feels busy, remove blocks until it exhales.

Self-audit before shipping:
- Does the page lower your pulse when you scroll it slowly?
- Is every edge soft — veils, pebbles, rings — with nothing sharp or loud anywhere?
- Are the steam veils doing real work over at least two photographs?
- Is celadon under 15% of every viewport, with stone grounds carrying the rest?
- Is there exactly one ripple-ring expansion, placed at the offer?
- Did any urgency mechanic sneak in — a timer, a stock count, a "hurry"? Delete it.
- Do Arabic lines breathe at 1.8 line-height with zero letter-spacing?
- Is the page fully readable with JavaScript off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook → convince → offer → order form, invisible, in that order, always.
- Palette registers: grounds #EDE9E2 / #E4E0D8; ink #39413E; celadon #9DB8AC; warm stone
  #C9C0B2; steam gradients from #FFFFFF00 to #FFFFFFcc. No dark sections.
- Type stacks: Latin display EB Garamond or Cormorant Infant; Latin body Jost or Mulish.
  Arabic display Reem Kufi or Amiri; Arabic body Almarai 300/400 or Noto Naskh Arabic.
- The three owned tics: steam veils, pebble-stack markers, ripple rings.
- Motion identity: exhale — opacity-led, 1.2–1.6s, sine, movement 10px or less; ONE ripple
  ring expands when the offer enters.
- Desktop law: centered mobile shell (~470px) on a wide stone ground.
- Refused blocks: lottery-contest, countdown, stock-urgency, comparison-table.
- Imagery style: travertine-and-steam spa still life (see Imagery).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition (from the hero menu or a new one in the same breath).
- Block choice within the supported set, and their order after the hero.
- Form style (from the form menu).
- Proof type emphasis: photo-reviews vs before-after vs quiet ingredient authority.
- Where in the celadon register the accent sits; how prominent the warm stone tone is.
- Section density and rhythm: five long exhales or nine shorter ones — both legal.
Every client receives a new sibling of this world — same stillness, new room. Never a clone.

3. VISUAL SIGNATURES

- Grounds: page #EDE9E2; alternate sections #E4E0D8; cards #F4F1EB with NO border — cards
  are separated by tone, not by line. Radius 20px on all containers (stones, not boxes).
- Ink: #39413E for headings, #565E5A body, #838B86 captions. Contrast stays gentle but must
  pass 4.5:1 for body text — serenity is not illegibility.
- Steam veils (owned): CSS gradients from #FFFFFF00 to #FFFFFFcc rising from the bottom of
  photographs (height 30-45% of the image) and lying over section boundaries as 80-120px
  soft white fades. On photos, the veil carries the caption. Veils may drift upward 8px in a
  slow loop (6s, sine, yoyo) — the only permitted loop.
- Pebble-stack markers (owned): step and bullet art drawn as 2-3 stacked rounded stones
  (SVG ellipses, fills #C9C0B2 / #9DB8AC / #B8B0A2, no outlines), the stack 28-40px tall;
  the active step's top stone tints celadon. Used for how-it-works, list bullets, and
  progress in wizard forms.
- Ripple rings (owned): concentric 1px circles (#9DB8AC at 40-60% opacity), 3-4 rings,
  40-160px diameters, used as section dividers (static) — and ONCE per page, at the offer,
  one ring animates: scale 0.6→1.15, opacity fading, 1.6s, sine.out.
- Display type: clamp(1.7rem, 5.8vw, 2.4rem), weight 500 (Garamond) — never bold; elegance
  carries weight here, not mass. Line-height 1.25.
- Body: clamp(0.95rem, 2.5vw, 1.05rem), line-height 1.65 Latin / 1.8 Arabic.
- Spacing rhythm: sections 96-128px apart — the widest breathing in the COD library; inner
  padding 24-28px.
- Buttons: 999px pill, ground #39413E (ink, not celadon), text #F4F1EB, height 56px; the
  only dark element on the page. Hover deepens to #2E3532. Secondary: no button — a quiet
  underlined text link.

4. COLOR PHYSICS

- Ground register: #EDE9E2 to #E4E0D8, with #F4F1EB for raised surfaces. All warm-gray
  stone; never white-white pages (steam needs a tinted ground to be seen).
- Ink register: #39413E to #838B86. Never black, never cold gray.
- Accent register: celadon #9DB8AC, drifting toward #8FADA0 (deeper water) or #ABC2B6
  (misted) per build — one point chosen and held. Cap: 15% of any viewport. Celadon lives
  on rings, active stones, small labels, ingredient chips — never on buttons, never as a
  section ground.
- Support: warm stone #C9C0B2 for pebbles and soft emphasis; steam whites only as gradients,
  never as flat fills.
- Forbidden: pure white flat sections, black, gold, any saturated hue, dark sections of any
  kind, multi-hue gradients. Heat here is implied by softness, never by warm oranges.
- Light logic: one continuous daylight — the page has no dramatic lighting changes; contrast
  between sections comes from the two-tone stone alternation and the veils between them.

5. TYPOGRAPHY

Latin stack:
- Display: EB Garamond 500 (first choice) or Cormorant Infant 500/600 — a humanist serif
  with water in it. Italic permitted for one ritual word per page.
- Body: Jost 400 (first) or Mulish 400 — round geometric calm under the serif.
Arabic stack:
- Display: Reem Kufi 400/500 (first choice — geometric, bathhouse-tile kinship) or Amiri 400
  for a more classical client.
- Body: Almarai 300/400 (first) or Noto Naskh Arabic 400.
Pairing rules: EB Garamond pairs with Jost; Cormorant Infant pairs with Mulish; Reem Kufi
pairs with Almarai; Amiri pairs with Noto Naskh. Never cross the pairs in one build.
Size clamps shared across scripts: display clamp(1.7rem, 5.8vw, 2.4rem); section titles
clamp(1.25rem, 4.2vw, 1.6rem); body clamp(0.95rem, 2.5vw, 1.05rem); captions 0.8rem.
Arabic display runs visually larger per glyph — trust the clamp minimums and add 0.05em
word-spacing if lines feel dense.
RTL rules: logical properties only; veils and rings are symmetric and need no mirroring;
pebble stacks and step flows mirror (first stone on the reading side); NEVER letter-space
Arabic — the tracking on Latin captions (0.06em) does not apply to Arabic; Arabic body
line-height 1.7–1.9; Western Arabic digits (0-9) for prices and phones, in dir="ltr" spans.

6. SIGNATURE ART & COMPONENTS

- Steam veils (owned): the world's atmosphere machine. Every build veils at least the hero
  photo and one section boundary. Veils hold captions: small ink text sitting inside the
  white fade at a photo's foot.
- Pebble-stack markers (owned): the step system. Three stones = three steps; the ritual
  (préparer → appliquer → rincer) reads as stones gaining celadon one by one on scroll.
- Ripple rings (owned): dividers between major movements of the page; static except the one
  offer ring. Rings never carry text — they are pauses, not frames.
- Supporting cast: tone-separated cards (#F4F1EB, radius 20px, no borders, no shadows);
  ingredient chips — small rounded tags in celadon-tinted ground with the ingredient name
  and origin ("غاسول — الأطلس"); a quiet star row for reviews (stars as 10px stone dots,
  filled celadon); the ink pill button; underlined text links.
- Imagery: spa still-life photography — travertine and worn stone surfaces, products
  arranged with ceramic bowls, olive soap textures, folded linen, water traces; soft
  diffused daylight as if through a skylight; celadon ceramics as the recurring prop; real
  steam or mist softening the frame's edges; muted, low-saturation grading with warm gray
  balance. Banned in photos: people's faces, hard flash, saturated color, marble-luxury
  clichés, gold props, dark moody grading. The camera never rushes: compositions are
  centered or gently off-axis, always with resting space.

7. THE SPINE

Hook → convince → offer → order form. The ritual has an order and the page keeps it,
invisibly: the hero warms, the middle convinces through senses and tradition, the offer
surfaces once, the form closes like the cool room at the end.
- Price placement: Hammam is a STICKY-BAR-FIRST world — the hero may keep the price off its
  opening breath (a rare privilege), because the sticky bar carries it from the first
  scroll: a slim stone-toned bar, price in quiet ink, "اطلبي الآن" pill. If a build prefers
  hero price, it prints it small under the title — never struck-through theatrics up top.
- Sticky CTA: the slim bottom bar described above — ground #F4F1EB at 96% opacity, 1px top
  fade (a steam veil, not a border), ink price, ink pill button. Tapping exhales the page
  down to the form.
- Mobile-first at 390px. Desktop law: CENTERED MOBILE SHELL — the page lives as a ~470px
  column resting on a wide #E4E0D8 stone ground; the ground may carry one enormous, nearly
  invisible ripple ring set (opacity 5%) behind the shell. Never a responsive expansion.

8. BLOCKS TREATMENT

Supported blocks, dressed by Hammam:
- announcement-bar: a whisper — one line, stone ground, ink text, "توصيل لكل المدن — الدفع
  عند الاستلام". No rotation, no timer.
- problem-solution: dressed as "the day → the ritual". Two lines naming the tiredness, a
  veiled photograph, then the product as the ritual's heart. Copy stays sensory, never
  clinical.
- benefits-icons: 3-5 stones — each benefit sits beside a small pebble-stack marker, label
  in body type, one sensory sentence. Never an icon grid; stones are the icons.
- ingredients-infographic: the tradition list — each ingredient as a chip with origin
  ("صابون بلدي — زيت الزيتون"), arranged around one veiled texture photo; a short line on
  the craft. No percentages shouting; provenance is the authority.
- how-it-works-steps: the ritual — 3 steps with pebble stacks gaining celadon, one line
  each ("تبخير · تقشير · ترطيب"), small square photos veiled at the foot.
- before-after: permitted, but bathed — the pair sits under one shared steam veil, captions
  "قبل / بعد ٤ أسابيع" in the veil, and an honesty line. Soft crossfade allowed on tap;
  no slider handles.
- photo-reviews: 3-5 quiet cards — name, city, stone-dot stars, two sentences at most,
  optional customer photo veiled at its base. "طلب مؤكد" tag in celadon.
- guarantee-seal: not a seal — a smooth stone: a rounded pebble shape carrying "استبدال
  خلال ١٤ يوم" with the reassurance lines beside it. Flat, no engraving.
- price-anchor: the offer surfaces once, mid-late page, inside the ripple moment: price in
  display serif, old price small and struck once, a per-ritual line ("أقل من ثمن جلسة
  حمّام واحدة"), and the ring expanding behind. This is the page's single flourish.
- bundle-offers: ritual sets — 1x "طقم كامل" / 2x "لكِ ولها" cards in tone-separated
  stone cards, per-set math small; the chosen card's ground tints celadon at 10%.
- unboxing-gallery: "ماذا يصلك" — the set's pieces photographed together, then listed as
  stones (kessa, savon noir, ghassoul, حقيبة قطنية), count chip "٥ قطع" (digits 0-9: "5").
- order-steps: 4 stones — الطلب → مكالمة تأكيد → التوصيل ٢٤-٤٨ س → الدفع عند الباب. The
  confirmation call framed as care ("نتصل بكِ للتأكيد بهدوء").
- faq: hairline-free accordion — questions separated by tone alone, a small stone dot
  rotating as the toggle. 4-6 gentle questions.
- trust-footer: the cool room — brand line, phone/WhatsApp, return policy, "الدفع عند
  الاستلام — لكل المدن", ending with one static ripple ring as the page's final breath.

Refused blocks:
- lottery-contest: a raffle in a bathhouse is vandalism. Never.
- countdown: steam does not count down; timed pressure breaks the world's one promise.
- stock-urgency: scarcity panic raises the pulse this page exists to lower.
- comparison-table: Hammam does not argue with competitors; it does not acknowledge them.

9. HERO MENU

- The veil hero: full-bleed product still life, steam veil rising from the foot carrying
  the product name and one ritual line; CTA pill floating at thumb height. Price on the
  sticky bar. The world's signature opening.
- The still-life split: photo above (veiled), text beneath — name, one sensory sentence,
  small price line, CTA. The most conventional breath, for clients who need price up top.
- The ritual story hero: display-serif sentence first ("خمس عشرة دقيقة لكِ وحدك"), then a
  smaller veiled photo, then CTA. Opens with the feeling, not the object.
- The set-card hero: the full ritual set arranged flat-lay in one tone-card, each piece
  labeled quietly, price under the card, CTA. For multi-piece offers.
- The before-after hero: the bathed pair as the opening image under one veil, a single
  claim line, CTA. Only for products with honest transformation photos.
- The stone stack hero: no photo in the first breath — a large pebble-stack rendering with
  the promise in display serif, the product photo arriving one exhale below. The boldest
  quiet opening; use once per client at most.

10. FORM MENU

- The stone card: one tone-separated card (#F4F1EB), fields stacked — الاسم الكامل،
  الهاتف، المدينة (select), الخيارات — each field a rounded 16px-radius input with a soft
  #DDD8CE 1px line; ink pill submit. Success: the card exhales into a thank-you with an
  order number and "سنتصل بكِ للتأكيد".
- The ritual wizard: three unhurried steps (اختاري طقمك → معلوماتك → التأكيد) with
  pebble-stack progress gaining celadon; one screen per step, generous padding.
- The hero-echo: a two-field whisper (الهاتف + المدينة) under the hero CTA for the
  already-convinced, repeated as the full stone card at the end; the whisper carries
  "نتصل بكِ خلال ساعات العمل".
- The sticky-driven close: the sticky bar is the only mid-page order prompt; the stone
  card waits at the end after the trust-footer's ripple, keeping the body of the page
  entirely ritual.

11. MOTION IDENTITY

Exhale: entrances are opacity 0→1 with at most 10px of vertical drift, sine.out, 1.2–1.6s,
staggered 0.15s. Veils may drift 8px in a 6s yoyo loop — the only loop. THE signature
scroll moment: the single ripple ring expanding behind the price-anchor when the offer
enters (scale 0.6→1.15, 1.6s, sine.out, once). Pebble stones tint celadon with a 0.4s
crossfade as steps activate. The sticky bar fades in over 0.5s. Reduced motion: everything
static at final state; the veil loop stops; the ring renders expanded. Banned: slides over
10px, scaling entrances, bounces, spins, staggered letter animations, anything faster than
0.4s, parallax, pinning, scroll-scrubbed transforms.

12. BAN LIST

Generic slop: purple-to-blue gradients on white, glassmorphism, emoji as design system,
Poppins-for-everything, lorem ipsum, fake trustpilot logos, cookie-cutter 3-column icon
rows with drop shadows, hero carousels, parallax overuse, backdrop-blur.
Neighbors' tics, banned by name: wabi's single sumi-e ink stroke, vertical writing-mode
labels and off-center ma composition; ecrin's centered plumb line and roman-numeral
markers; matiere's arch-only geometry (no arches — Hammam's curves are stones and rings,
never doorways); aquarelle's watercolor washes and pigment-bloom masks (veils are steam,
not paint — always pure white gradients, never colored or textured); observatoire's
orbital ellipse diagrams (rings are concentric and body-less); kenz's spotlight cone and
gold dust; remede's dosage bars, blister grid and green-cross punctuation; rimel's blush
orbs and shine sweep.
Refused blocks (restated): lottery-contest, countdown, stock-urgency, comparison-table.
This world's own temptations, banned: gold accents "for premium", black premium sections,
lavender or spa-purple tints, zellige tile patterns (zellij's territory), essential-oil
clip-art, script fonts.

13. EXAMPLE VARIATIONS

- "البخار الأول" (beauty & cosmetics): veil hero for a black-soap ritual set; order:
  announcement-bar, problem-solution (the tired day), ingredients tradition list,
  how-it-works ritual stones, photo-reviews, price-anchor with ripple, unboxing "ماذا
  يصلك", order-steps, faq, trust-footer; stone-card form. Mood: the flagship bathhouse
  page — veils everywhere, price only on the sticky bar until the ripple moment.
- "طين الأطلس" (beauty & cosmetics): still-life split hero for ghassoul clay; order:
  ingredients (origin-led), before-after bathed pair, benefits stones, photo-reviews,
  price-anchor, bundle 1x/2x, order-steps, faq; hero-echo form. Mood: provenance as
  authority — the Atlas origin story carries the convince arc.
- "جلسة المساء" (health & wellness): ritual story hero for a bath-salts and oil evening
  set; order: problem-solution, how-it-works (three evening steps), ingredients chips,
  photo-reviews, guarantee stone, price-anchor, faq, trust-footer; sticky-driven close
  form. Mood: the quietest build — six exhales, no bundles, the ripple as the only event.
- "طقم العروس" (beauty & cosmetics): set-card hero for a bridal hammam set; order:
  unboxing first (the gift laid out), benefits stones, ingredients, photo-reviews,
  bundle sets (لها / للأم والعروس), price-anchor, order-steps, faq; ritual-wizard form.
  Mood: the gift page — flat-lay photography leads, the wizard's stones make ordering
  ceremonial.
- "ماء الورد" (home & kitchen): stone-stack hero for a copper rose-water still and
  bottle set; order: the craft story (problem-solution reframed as heritage), ingredients,
  how-it-works, photo-reviews, price-anchor, unboxing, faq, trust-footer; stone-card
  form. Mood: the artisanal object — the boldest hero, photography macro on copper and
  water.
- "نَفَس" (health & wellness): before-after hero for a steam-facial kit; order: benefits
  stones, how-it-works, ingredients, photo-reviews with customer photos, guarantee stone,
  price-anchor, order-steps, faq; hero-echo form placed under a veiled hero pair. Mood:
  proof-forward but bathed — the pair opens, the ritual explains, the ring closes.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
