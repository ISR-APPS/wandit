import type { DesignWorld } from "../types";

export const nadhara: DesignWorld = {
	id: "nadhara",
	name: "Nadhara",
	family: "optic-shop",
	tagline: "Snellen charm: tortoiseshell, duo-frames, sharp focus",
	kind: "cod",
	mood: ["optical", "precise", "charming"],
	energy: "medium",
	priceFeel: "accessible",
	industries: [
		"fashion & apparel",
		"health & wellness",
		"electronics & gadgets",
	],
	avoidFor: ["kids & baby", "home & kitchen", "car accessories"],
	fusesWith: ["circuit", "tendance"],
	preview: {
		ground: "#FAF8F4",
		ink: "#21302B",
		accent: "#9C5B2B",
		fontFamily: "DM Serif Display",
		sampleWord: "20/20",
	},
	doc: `
NADHARA — THE OPTICIAN'S FITTING ROOM

1. PHILOSOPHY

Nadhara is the neighborhood optician who is also, quietly, the best-dressed shop on the
street. Optical white walls, a Snellen chart nobody reads past the fourth row, and trays of
tortoiseshell that make customers try on a second pair "just to see." This world sells
eyewear and screen-age wellness with a double license: clinical enough to be trusted with
your eyes, charming enough to be trusted with your face. Its language is the exam itself —
letters that shrink, lenses that focus, the honest question "better with, or without?" The
COD spine — hook, convince, offer, order form — runs like a fitting: the hero puts the
frame on the page's face with its price, the middle tests (materials, filtration, fit), the
offer flips to "and the second pair at half," and the form books the delivery, paid when
you see it. Copy is precise with a wink; every claim wears its number. Nadhara serves
glasses first — blue-light, sun, readers — then screen-wellness accessories and the
fashion of the face.

Self-audit checklist — answer yes before shipping:
- Does the hero read as a fitting — frame forward, chart softly behind — not a gadget
  splash?
- Do eye-chart pyramids actually SHRINK row by row, and stay legible to the last row?
- Are duo-frames always TWO circles and a bridge — never a single circle inset?
- Does the focus-pull happen once, on the hero, and nowhere else?
- Is tortoise used as material (amber + spots) rather than flat brown?
- Does every claim carry its number (%, g, TR90, UV400)?
- Is the second-pair offer stated without shouting?
- Zero horizontal overflow at 390 / 768 / 1440, fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. In order, invisible.
- Palette registers: optical white #FAF8F4 grounds with ink-board #1C2B26 sections; ink
  #21302B; tortoise amber #9C5B2B with spots #4A2C17; sage #7FA08C capped at 8%.
- Type stacks: display DM Serif Display or Libre Caslon Text; body Inter; mono Space Mono
  for dioptre and spec values. Arabic display Cairo; body Almarai.
- The three owned tics: eye-chart pyramids, spectacle duo-frames, focus-pull reveals.
- Motion identity: focus — 0.4s eases; ONE focus-pull on the hero image.
- Desktop law: responsive expansion, max 1080px.
- Refused blocks: lottery-contest, ingredients-infographic, delivery-map.
- Imagery style: optical eyewear photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER — a blue-light page and a
  sunglass page must not share a rundown.
- Form style from the form menu.
- Proof lead: photo-reviews, before-after strain stats, or spec authority — per product.
- Whether the ink-board interlude appears once or twice, and where sage lands.
- Section density: one frame may run 9 beats; a two-pair wardrobe 13.
Every client receives a new sibling — same shop, new fitting. Repeating a previous
hero + form + block order combination fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: optical white #FAF8F4 base, alternate #F4F1EA; ink-board sections #1C2B26 (one
  to two per build); card white #FEFDFB.
- Ink: #21302B headings, #435049 body, #7E8983 captions; board ink #EFEDE6.
- Tortoise: amber #9C5B2B base with spot texture #4A2C17 — used on frames photography,
  accent chips, the CTA (amber fill, spot-free), price numerals. Sage #7FA08C: checks,
  one underline per viewport, the "better with" tag; ≤8%.
- Display type: hero clamp(1.9rem, 7vw, 2.7rem), line-height 1.16; section titles
  clamp(1.4rem, 5.2vw, 1.9rem); body clamp(0.98rem, 4vw, 1.05rem), line-height 1.6 Latin /
  1.8 Arabic; mono values 0.9rem Space Mono.
- Radii: 12px cards, 999px on lens circles and the CTA pill, 10px fields.
- Borders: 1.5px #21302B on duo-frames (the acetate line); 1px #E3DFD4 on cards. Shadows
  banned; the chart and the frames carry the depth.
- EYE-CHART PYRAMIDS (tic): typographic blocks where successive lines SHRINK — line one at
  1.6em, then 1.3em, 1.05em, 0.85em, 0.7em — center-aligned, letter-spaced generously
  (Latin only), used for benefit lists, headline stacks, even the FAQ intro. The smallest
  line stays ≥12px. A thin baseline rule under each row, chart-style.
- SPECTACLE DUO-FRAMES (tic): two 1.5px-stroke circles joined by a small bridge arc —
  the world's pair-frame for image pairs (day/night lens, matte/gloss, avant/après strain
  stats): one image clipped in each lens circle, labels beneath each. Always two circles;
  never one, never three.
- FOCUS-PULL REVEALS (tic): the hero image begins at blur(8px) scale(1.02) and resolves to
  sharp once — 0.9s, power2.out — as if the phoropter clicked. ONE per page, hero only.
- Spacing rhythm: sections clamp(56px, 14vw, 88px); charts given clinical margins.

4. COLOR PHYSICS

Ground register: optical white #FAF8F4 to #F4F1EA — daylight through a shop vitrine,
never blue-white. Ink-board #1C2B26 carries one or two exam-room interludes (the offer, or
the spec moment). Ink register: #21302B / #435049 / #7E8983. Accent physics: tortoise is
the world's warmth — amber base always textured with spots when used as surface (a
two-tone mottle at 20% density), plain amber when used as type or CTA; it owns prices and
primary actions. Sage is the examiner's approval — checks, the "better with" verdict, one
rule. Form errors: warm brick #A8503C inline. Forbidden: black, blue-light blue (the irony
is banned — no cyan/azure anywhere), red urgency, gradients, chrome, purple, and any
lens-flare glints (an2000's).

5. TYPOGRAPHY

Latin stack. Display: DM Serif Display (400) — the chart's serif with charm; Libre Caslon
Text as the alternative for more bookish builds. Body: Inter (400/600). Mono: Space Mono
for values (UV400, 21g, TR90, 45% filtration). Pairing rule: ONE display + Inter + Space
Mono; display owns the hero, titles, chart pyramids and prices; mono owns every number
that measures.
Arabic stack. Display: Cairo (700). Body: Almarai (400/700). Pairing rule: Cairo + Almarai;
Arabic display ~8% smaller at the same clamp; chart pyramids in Arabic shrink by size only
— NEVER letter-spaced.
RTL law: logical properties throughout; no letter-spacing on Arabic (Latin chart rows
only); Arabic body line-height 1.8; digits Western, mono values and prices wrapped LTR
("260 MAD", "UV400" as units); duo-frame labels mirror; x-drift flips sign.

6. SIGNATURE ART AND COMPONENTS

The chart is the voice, the duo-frame is the eye, the focus-pull is the click of the
better lens. Supporting cast: acetate chips (12px rounded squares in tortoise mottle) for
colorway variants; the dioptre ledger (hairline rows, mono values right-aligned) for
specs; a folded-temple divider (a thin drawn glasses temple with its hinge dot) between
minor sections; the "better with / without" toggle pair styled as two lens buttons where
the chosen lens sharpens (its label crisp) and the other stays soft; review cards with a
duo-frame avatar slot (frames only, never faces); order-step markers as small lens circles
that fill sage on completion. Photography sits in 12px frames or inside lens circles.

Component measurements, for the builder's hand: duo-frames draw at 120-160px per lens on
mobile (72px in avatar slots), bridge arc 24-32px wide rising 8px, stroke 1.5px in #21302B,
labels 11px caps centered 10px beneath each lens; chart pyramids step through 1.6 / 1.3 /
1.05 / 0.85 / 0.7em with 0.14em tracking on Latin rows, 10px baseline rules at 20% ink and
14px row gaps; the acetate chip mottle is a two-tone pattern at 20% density with spots
3-6px; folded-temple dividers span 56px with a 3px hinge dot; lens-circle steps are 34px,
sage fill sweeping as a 0.2s arc; the dioptre ledger rows sit on 42px rhythm, values in
Space Mono 0.9rem right-aligned. Copy register: the optician's charm — questions as
headers ("mieux avec, ou sans?"), every claim escorted by its mono number, sentences
under twelve words, one wink per section maximum and never in the form; the exam's
second person (vos yeux, votre écran) throughout, and the doorstep line always literal:
you pay when you see them. Superlatives are refused; the chart's fourth line is proof
enough.

Imagery. Optical eyewear photography: tortoiseshell and acetate frames on optical white,
a Snellen chart softly blurred in the background, warm amber accents, trays and cloths of
the trade, macro on hinges, temples and acetate mottle; a worn shot crops to the
nose-to-brow band only. Banned in photos: full faces, lens flares, blue gel lighting,
gadget desks, medical coldness, mirrored sunglasses reflecting the photographer.

7. THE SPINE

Hook, convince, offer, order form — put them on, test them, price them, book the
delivery. Price placement: IN THE HERO — tortoise numerals beside the frame name, the
second-pair note in small sage beneath. Sticky CTA: an optical-white bar, hairline top,
frame name + price, tortoise pill button; appears after the hero, scrolls to the form.
Mobile-first at 390px. Desktop law: responsive expansion to max 1080px — duo-frames sit
side by side with room, the chart pyramid centers, specs go two-column.

8. BLOCKS TREATMENT

Supported blocks, dressed by Nadhara:
- announcement-bar: one line — delivery + pay-when-you-see-it ("تشوفها وتخلص" energy in
  the demo's language) — with a tiny lens-circle glyph.
- problem-solution: the screen-strain paragraph set as a small chart pyramid (the pain
  shrinking row by row) against the frame photo; verdict in sage.
- benefits-icons: 4 lines with folded-temple bullets — weight, filtration, material,
  fit — each carrying its mono number.
- spec-table: the dioptre ledger — TR90, 21g, UV400, filtration %, hinge type — hairline
  rows, mono values.
- before-after: strain-stat pair in a duo-frame — "avant: yeux secs à 18h / après: 8h
  d'écran sans fatigue" as the two lenses, stats not photos.
- variant-gallery: acetate chips with per-colorway frame photos; the chosen chip sharpens
  its label (a micro focus event, distinct from the hero's single pull). Feeds the form.
- photo-reviews: 3-5 cards with duo-frame slots holding the customer's FRAMES shot
  (faceless), name + city, sage stars, two sentences.
- guarantee-seal: the fitting promise — 7-day exchange, adjustment included, case and
  cloth in the box — sealed with a sage check in a lens circle.
- bundle-offers: the second-pair column — "la 2ème paire à -50%" as two duo-framed
  offers side by side; feeds the form.
- cross-sell: one line — "ajoutez l'étui rigide" — with an acetate chip thumbnail and a
  lens-circle checkbox.
- price-anchor: the verdict — frame name in display, tortoise price, second-pair note,
  payment-on-sight line; set on ink-board with chart-white type when the build wants its
  exam-room moment.
- order-steps: four lens circles — choose, leave name and phone, our confirmation call,
  pay when you see them — filling sage as scroll passes.
- faq: 4-6 questions opened by a small chart pyramid ("LES QUESTIONS / QUE TOUT / LE MONDE
  / POSE"), hairline rules between.
- trust-footer: ink-board — the shop name in display, phone + WhatsApp, exchange policy,
  a last tiny chart row.
Refused blocks: lottery-contest (no raffles at the optician), ingredients-infographic
(frames have specs, not recipes), delivery-map (the courier knows the way; the bar says
the delay).

9. HERO MENU

- The Fitting: frame large on optical white, chart blurred behind, title + price beside,
  focus-pull on the frame photo. The default.
- The Chart Opening: the headline itself as a chart pyramid filling the hero, frame photo
  beneath, price on the last legible row's baseline.
- The Duo Choice: two colorways in a duo-frame as the hero, "better with?" microcopy,
  price beneath the bridge.
- The Tray: overhead tray of frames with the hero frame lifted out (photographed apart),
  title band below, price in tortoise.
- The Board Room: ink-board hero, frame photographed on dark felt, chart-white title,
  price in amber; the page lightens after.
- The Worn Band: the nose-to-brow worn crop full-bleed, title low, price on a white card
  overlapping the photo edge.

10. FORM MENU

- The Fitting Slip: single card ruled like an exam slip — name, phone, city, colorway
  chips, second-pair toggle — lens-circle submit. The default.
- The Two Lenses: 2-step wizard — step one the frames (colorway, second pair), step two
  the coordinates; two lens circles track progress, sharpening as completed.
- The Quick Look: phone + city echo beside the hero price, full slip at the end.
- The Bar Booking: the sticky bar opens the slip with fields focused; single-frame builds.

11. MOTION IDENTITY

Focus. Entrances: opacity with 12px rise, 0.4s, power2.out, staggered 80ms; chart pyramids
land row by row top to bottom (90ms stagger, part of standard entrance, not a signature).
The ONE signature moment: the hero focus-pull — blur 8px to 0 with scale 1.02 to 1, 0.9s,
power2.out, once. Variant-chip label sharpening is a 0.15s micro-transition, permitted.
No loops, no parallax, no overshoot, no fog (telj's), no shine (rimel's). Reduced motion:
hero sharp from the start, everything visible. All motion gated on gsap + ScrollTrigger;
the page reads fully without JavaScript.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur (voltage's only), back.out overshoot (guimauve's). Neighbors banned by name:
scoop's circle insets (single labeled circles — Nadhara's circles come only in bridged
pairs); remede's dosage bars and green-cross punctuation; circuit's feature leader lines,
PCB traces and datasheet strip (the dioptre ledger is hairline rows, never a boxed
datasheet); rimel's shine sweep and lash-tick halos; telj's fog-clear wipe (the focus-pull
is a lens click, never breath on glass — and the wall stays explicit); hypertexte's web
furniture; velin's boxed drop caps; gabarit's dimension lines. Nadhara's own temptations,
banned: cyan "blue-light" glows, lens flares, a third circle, focus-pulls beyond the hero,
faces in photography, medical-white coldness. Refused blocks: lottery-contest,
ingredients-infographic, delivery-map.

13. EXAMPLE VARIATIONS

- "Écrans Tranquilles" — health & wellness (lunettes anti-lumière bleue). Fitting hero;
  blocks: announcement, problem-solution, spec-table, before-after (strain stats),
  photo-reviews, guarantee, bundle-offers (2ème paire), price-anchor, order-steps, faq,
  trust-footer; Fitting Slip form. Mood: the 8-hour screen day, survived.
- "La Quatrième Ligne" — fashion & apparel (monture tortoise iconique). Chart Opening
  hero; blocks: announcement, benefits, variant-gallery, photo-reviews, guarantee,
  cross-sell (étui), price-anchor, order-steps, trust-footer; Bar Booking form. Mood: the
  chart flirts.
- "Deux Teintes" — fashion & apparel (deux coloris d'acétate). Duo Choice hero; blocks:
  announcement, benefits, variant-gallery, spec-table, photo-reviews, guarantee,
  bundle-offers, price-anchor, order-steps, faq, trust-footer; Two Lenses wizard. Mood:
  better with, or with?
- "Soleil Mesuré" — fashion & apparel (solaires UV400). Tray hero; blocks: announcement,
  problem-solution, spec-table, variant-gallery, photo-reviews, guarantee, price-anchor,
  order-steps, faq, trust-footer; Quick Look echo + slip. Mood: summer, examined.
- "Lecture du Soir" — health & wellness (lunettes de lecture +1 à +3). Board Room hero;
  blocks: announcement, problem-solution, benefits, variant-gallery (dioptres as acetate
  chips), photo-reviews, guarantee, price-anchor, order-steps, faq, trust-footer; Fitting
  Slip form. Mood: the lamp and the last chapter.
- "Portées, Simplement" — electronics & gadgets adjacent (clip anti-lumière pour
  lunettes). Worn Band hero; blocks: announcement, problem-solution, spec-table,
  before-after, photo-reviews, guarantee, cross-sell, price-anchor, order-steps,
  trust-footer; Two Lenses wizard. Mood: the upgrade that clips on.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
