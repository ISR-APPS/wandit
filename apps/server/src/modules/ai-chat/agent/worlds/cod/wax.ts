import type { DesignWorld } from "../types";

export const wax: DesignWorld = {
	id: "wax",
	name: "Wax",
	family: "wax-print",
	tagline: "Dakar wax-print pride: bold bands, bangles, cowries",
	kind: "cod",
	mood: ["vibrant", "proud", "patterned", "joyful"],
	energy: "loud",
	priceFeel: "accessible",
	industries: [
		"fashion & apparel",
		"jewelry & watches",
		"home & kitchen",
		"beauty & cosmetics",
	],
	avoidFor: ["electronics & gadgets", "car accessories"],
	fusesWith: ["caravane"],
	preview: {
		ground: "#FAF3E3",
		ink: "#201810",
		accent: "#E8641B",
		fontFamily: "Yeseva One",
		sampleWord: "NALA",
	},
	doc: `
WAX — THE TAILOR'S BOLT

1. PHILOSOPHY

Wax is the tailor's table in Dakar at noon: bolts of printed cotton stacked to the ceiling,
scissors singing, a client turning in front of the mirror while the whole street gives its
opinion. This world sells with PATTERN — the boldest visual voice in the library — and with
pride. Wax-print cloth is not decoration here; it is structure. Bands of printed motif frame
the page the way a tailor frames a neckline: deliberately, symmetrically, with joy. The ground
stays calabash-cream and calm so the pattern can shout; the ink is deep and warm; one pattern
duo (indigo, tangerine or forest, chosen per build) carries the whole page. Between the bands,
the selling is human and direct — proud of the maker, precise about the cloth, generous with
proof. Bangles stack up to count the steps. Cowries stand in for stars. Nothing digital-slick
is allowed to dilute the fabric: this page should feel cut, stitched and pressed, not rendered.
The voice is warm and confident — "cousu main, taillé pour toi" — never exoticizing, never
costume. Wax sells clothing first, then jewelry, décor and beauty, to buyers who already know
what a good print costs and want to see it respected.

Self-audit before shipping:
- Does ONE pattern duo govern every band on the page — no third pattern color sneaking in?
- Are the wax bands PRINTED motifs (fans, circles, combs) — never woven lozenges, never tiles?
- Do bangle stacks count something real (steps, sizes) rather than decorate at random?
- Are cowries used sparingly as markers/ratings — visible, never a texture wallpaper?
- Is the ground calm calabash so pattern zones pop — pattern under 35% of any viewport?
- Could a Dakar tailor read every line of copy aloud with pride?
- Is price early, sticky CTA reachable, form thumb-sized with COD reassurance beside it?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, then convince, then offer, then order form. Invisible and absolute.
- Palette registers: ground #FAF3E3; ink #201810; pattern duos — indigo #274B9F, tangerine
  #E8641B, forest #1F6E43 (ONE dominant duo per build); brass #C99432 for fine accents.
- Type stacks: Latin display Yeseva One or Fraunces (900); body Karla. Arabic display Cairo;
  body Almarai.
- The three owned tics: wax-print bands, bangle stacks, cowrie bullets.
- Motion identity "talking drum": 0.35s rhythmic two-beat staggers; the hero band prints
  across once.
- Desktop law: responsive expansion, max 1060px.
- Refused blocks: countdown, stock-urgency, spec-table.
- Imagery: vibrant textile-and-craft photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client, never copied:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER — a robe page and a bijoux page cut
  different silhouettes.
- Form style from the form menu.
- Proof lead: photo-reviews or whatsapp-proof or stats-band — pick what the client has.
- The pattern duo (indigo / tangerine / forest dominance) and which sections get full bands.
- Section rhythm: a lean 8-block fitting or a full 14-block ceremony.
Every client gets a new garment from the same bolt — same cloth, new cut. A clone is a
failed build.

3. VISUAL SIGNATURES

Measured values:
- Ground: #FAF3E3 everywhere; deep sections allowed in the dominant pattern color at 8-12%
  saturation lift (e.g. indigo section #22408A) — max two per page.
- Ink: #201810 headings and body; #5C4E3E secondary; on dark sections, cream #FAF3E3.
- Pattern duo: dominant + support from {#274B9F indigo, #E8641B tangerine, #1F6E43 forest};
  the support color appears only inside bands and small accents (≤10% of viewport).
- Brass #C99432: hairline rules, bangle edges, price underlines — never text blocks.
- Display type: clamp(30px, 8.5vw, 46px), Yeseva One 400, line-height 1.15; section titles
  clamp(22px, 6vw, 30px); body clamp(15px, 4vw, 16.5px)/1.65 Karla; Arabic body 1.8 Almarai.
- Radii: 10px cards, 999px chips/CTA; bands and photos square-cornered (cloth is cut straight).
- Borders: 2px ink borders on cards sitting on pattern; 1px #D9CDB4 on cream.
- Shadows: none — cloth lies flat; separation by tone and border.
- Spacing: sections clamp(56px, 14vw, 88px); band strips 28-44px tall; 16/24/40 inner scale.
- WAX-PRINT BANDS (tic): horizontal strips of repeating two-tone printed motifs — fan arcs,
  concentric circles, comb teeth, seed rows — built as SVG pattern fills, 28-44px tall, edging
  the hero, section heads and the offer. Motifs are PRINTED flat shapes with slight ink-bleed
  irregularity (1px feather), never woven textures, never glazed tiles.
- BANGLE STACKS (tic): step/bullet markers drawn as 3-5 stacked elliptical rings (brass +
  duo colors, 2px strokes, slight offsets). The active step's top bangle fills solid.
- COWRIE BULLETS (tic): small cowrie-shell glyphs (drawn SVG, 14-18px, cream shell + ink
  slit) as list markers and rating units — 4.8 rating = 5 cowries, last one half-toned.

4. COLOR PHYSICS

Ground register: #FAF3E3 → #F4EAD2 (sun-warmed cream, never white, never gray). Ink register:
#201810 → #5C4E3E. Pattern physics: choose the dominant (indigo, tangerine or forest) per
build; the second color of the duo lives INSIDE bands and chips only. Tangerine may serve as
CTA fill in indigo/forest builds; otherwise the dominant fills the CTA. Brass is jewelry —
hairlines and bangles, ≤3%. Dark pattern-color sections: max two, always separated by cream.
Forbidden: black, pastels, neon, gradients (all color is flat like printed cloth), a third
pattern color, and any gray. Errors in forms: #B3402A, form-internal only.

5. TYPOGRAPHY

Latin stack. Display: Yeseva One (400) — its ink-fat curves sit like hand-set letterpress on
cloth; Fraunces (900, soft) as alternate when the client needs rounder warmth. Body: Karla
(400/700). Pairing rule: ONE display + Karla per build; display for masthead, section titles,
prices; Karla for everything else including chips.
Arabic stack. Display: Cairo (800). Body: Almarai (400/700). Pairing rule: Cairo + Almarai
always.
Size clamps shared across scripts; Arabic display runs 8% smaller at the same clamp. Arabic
body line-height 1.75-1.9; NEVER letter-spacing on Arabic (Latin caps may take 0.04em).
Digits: Western Arabic numerals for prices and phones; prices formatted like locals write
them ("18 500 FCFA"); phone numbers wrapped in LTR spans under RTL. RTL mirroring: logical
properties throughout; bands mirror cleanly (patterns are symmetric); bangle stacks keep
their stacking order; x-motion flips sign.

6. SIGNATURE ART AND COMPONENTS

The wax band is the world's flag: place it under the hero headline, above the offer, and as
the crown of one proof section — three appearances minimum, five maximum. Bands never touch
each other and never sit on dark sections of the same hue family. Bangle stacks mark
how-it-works steps and order-steps; a lone bangle ring may badge a card corner. Cowries rate
reviews and bullet the benefit list of ONE section (not all). Supporting cast: cards with 2px
ink borders and 10px radii; chips as cream pills with 1px ink stroke; the CTA a full-width
pill in the dominant color with cream text and a brass hairline underline beneath it; dividers
are plain 1px #D9CDB4 rules when a band would be too loud.

Band placement obeys the tailor's eye: a band always sits flush against the edge of the block
it crowns, never floating in whitespace; two bands never stack within 200px of each other;
and the hero band is always the widest motif of the build (fans or circles), with smaller
motifs (seeds, combs) reserved for inner sections. The price plaque has a fixed anatomy:
band-fragment top edge (one motif repeat), cream body, price in display type, per-piece line
in Karla, brass hairline base. Chips never carry pattern — they stay cream so the bands keep
their monopoly on print. When a build sells jewelry, bangle stacks may double as the rating
device (3 of 5 bangles filled), replacing cowries entirely — never both systems in one build.

Imagery: vibrant African wax-print product photography. Calabash-cream seamless or raw cotton
backdrop; bolts of printed fabric (indigo/tangerine/forest families) stacked or fanned as
props; brass bangles and cowrie shells scattered sparingly; hard clear daylight, saturated
color, honest shadows; tailor's tools (scissors, chalk, tape) allowed at frame edges; hands
sewing or folding allowed, never faces. For non-apparel products the cloth remains the staging
ground — a beauty jar or teapot sits ON the bolts. Banned in photos: mannequins, glossy
studio black, neon gels, western-minimal white voids.

7. THE SPINE

Hook, convince, offer, order form — in that order, always, invisibly. Price placement: EARLY
IN THE HERO — the price sits under the headline inside a small band-edged plaque; the buyer
must never scroll to learn it. Sticky CTA: a bottom bar on cream with a 4px wax-band top edge,
product name + price at the start side, dominant-color pill button at the end side; appears
after the hero scrolls past and always scrolls to the form. Mobile-first at 390px; desktop is
RESPONSIVE EXPANSION to max 1060px — bands stretch full-width, content holds a 640px column,
proof grids go two-up.

8. BLOCKS TREATMENT

Supported blocks, dressed by Wax:
- announcement-bar: cream strip, ink text, one brass cowrie glyph at the start — delivery
  promise and COD, one line.
- problem-solution: "l'histoire du tissu" — the pain of fast fashion vs the pride of cut
  cloth; short paragraphs beside a fabric macro, one band underneath.
- benefits-icons: 4-6 chips with drawn line icons (needle, cloth, iron, heart); ONE section
  may swap chip bullets for cowries.
- variant-gallery: swatch squares cut from the actual print photos, 2px ink borders; selected
  swatch gets a brass corner fold. Feeds the form.
- size-guide: a tailor's table — S-XL rows with cm values in Karla, a "prends ta taille
  habituelle" note signed by the maker.
- photo-reviews: review cards with 2px borders, cowrie ratings, name + city; one customer
  photo per 2-3 reviews, square-cornered.
- whatsapp-proof: recreated chat threads inside a cream card, standard bubbles, real Dakar
  voice; timestamps, no emoji beyond what customers naturally write.
- stats-band: a dark dominant-color section — three numbers in display type (pièces cousues,
  villes livrées, note moyenne en cowries).
- guarantee-seal: a canvas-textured plaque with a bangle ring around a check, "échange sous
  7 jours, couture garantie" — never a wax stamp, never a rosette.
- bundle-offers: 1x / duo / famille cards, band-topped, per-unit price falling; "le duo" gets
  the dominant-color border.
- price-anchor: the plaque grows: old price struck in support color, new price in display
  type, savings line in Karla; one band above, brass rule below.
- order-steps: 4 bangle-stacked steps — tu commandes, on t'appelle, livraison, tu paies à la
  porte.
- faq: plain rules, ink questions, Karla answers — no decoration; the calm before the footer.
- trust-footer: dark dominant section, cream text, phone + WhatsApp huge, one final thin band.
Refused blocks: countdown (cloth doesn't panic), stock-urgency (a tailor never begs),
spec-table (fabric is felt, not specced — measurements live in size-guide).

9. HERO MENU

- La Vitrine: full-bleed hero photo (product on bolts), headline over cream card at the
  bottom, price plaque + CTA inside the card, one band under the card.
- Le Coupon: split hero — headline/price/CTA on cream left, tall product photo right edged
  by a vertical band; stacks on mobile with the band becoming horizontal.
- L'Atelier: story-hook hero — maker's line first ("cousu à Dakar, taillé pour toi"),
  product photo beneath, price and CTA riding a band-topped plaque.
- La Parure: for jewelry/beauty — centered product on cream, bangle stack as a side rail
  counting the set's pieces, price beneath, band above the CTA.
- Le Pagne Déplié: the hero IS a wide fabric photo with the product small and centered;
  headline in display type overlaps the photo's calm zone; price chip pinned to the fold.
- Le Marché: dense promo hero — two bands sandwich the headline, price plaque immediately,
  CTA and reassurance chips in the first viewport; for accessible price-fighters.

10. FORM MENU

- La Commande Cousue (single card): one cream card, 2px ink border, band-topped header
  ("طلبك / Ta commande"), stacked fields, dominant CTA; reassurance chips under the button.
- Les Mesures (two-step wizard): step 1 taille + couleur (swatches + tailor's note), step 2
  nom + téléphone + ville; bangle stack shows progress; summary restates the total.
- L'Écho du Marché: compact 2-field teaser (téléphone + ville) right under the hero for the
  decided, full form at the end; teaser submit scrolls to the full form.
- Le Comptoir: sticky-bar-driven — the bar's pill opens the form section with the first field
  focused; for short punchy builds.

11. MOTION IDENTITY

Talking drum: entrances slide 24px with 0.35s power2.out in a TWO-BEAT stagger (pairs land
together, 90ms between pairs). Bands: the hero band "prints" across once — a clip-path wipe
with a subtle 2-step rhythm (60% then 100%). Bangle stacks pop ring-by-ring (0.2s each) when
their step enters. Cowrie ratings tilt 4° and settle on reveal. NO loops, no parallax, no
overshoot easing, no pattern scrolling. The ONE signature moment is the hero band print-wipe.
prefers-reduced-motion: everything static, bands fully printed, page complete without JS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji-as-design, Poppins-everything,
lorem ipsum, fake trust walls, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur, back.out overshoot. Neighbor tics banned by name: caravane's kilim bands
(woven lozenges) and saddle stitches — Wax motifs are PRINTED, never woven; zellij's glazed
tile bands and tile chips; tutti's memphis confetti and colored offset shadows; folies'
sunburst fans and gold chevrons; herbier's pressed leaves and tied tags; dukkan's pompom
garlands and painted planks; gommette's sticker halos. Wax's own temptations, banned: pattern
as full-page wallpaper, a third pattern color, mannequin photography, "tribal" clichés in
copy, gold-gradient text. Refused blocks restated: countdown, stock-urgency, spec-table.

13. EXAMPLE VARIATIONS

- "Ensemble Nala" — fashion & apparel, fr-SN. La Vitrine hero; order: announcement, hero,
  problem-solution, variant-gallery, size-guide, photo-reviews, stats-band, guarantee-seal,
  price-anchor, order-form (La Commande Cousue), faq, trust-footer. Indigo dominant. Band
  print-wipe on the hero only. Mood: proud boutique.
- "Boucles Téranga" — jewelry & watches. La Parure hero; bangle rail counts the 3 pieces;
  order: announcement, hero, benefits-icons (cowrie bullets), photo-reviews, whatsapp-proof,
  bundle-offers, price-anchor, order-steps, order-form (Les Mesures), faq, trust-footer.
  Tangerine dominant. Mood: gift-day joy.
- "Nappe Kermel" — home & kitchen. Le Pagne Déplié hero; forest dominant; order:
  announcement, hero, problem-solution, benefits-icons, photo-reviews, guarantee-seal,
  bundle-offers (1/2/4 nappes), price-anchor, order-form (L'Écho du Marché), faq,
  trust-footer. Mood: Sunday table.
- "Karité Jappo" — beauty & cosmetics. L'Atelier hero (the cooperative's line first); order:
  announcement, hero, benefits-icons, whatsapp-proof, stats-band, guarantee-seal,
  price-anchor, order-steps, order-form (Le Comptoir), faq, trust-footer. Tangerine dominant,
  cowries rate the reviews. Mood: warm ritual.
- "Sac Médina" — fashion & apparel. Le Coupon hero; indigo dominant; order: announcement,
  hero, benefits-icons, variant-gallery (3 prints), photo-reviews, guarantee-seal,
  price-anchor, order-form (La Commande Cousue with swatches inline), faq, trust-footer.
  Mood: everyday pride.
- "Duo Dalal" — fashion & apparel, mother-daughter duo. Le Marché hero; forest dominant;
  order: announcement, hero, bundle-offers first (the duo IS the story), size-guide,
  photo-reviews, stats-band, guarantee-seal, price-anchor, order-form (Les Mesures), faq,
  trust-footer. Mood: family celebration.
- "Turban Ndar" — fashion & apparel, pre-tied headwraps. L'Atelier hero, tangerine dominant;
  order: announcement, hero, problem-solution (the morning rush vs the two-second turban),
  variant-gallery (four prints), whatsapp-proof, photo-reviews, guarantee-seal, price-anchor,
  order-steps, order-form (L'Écho du Marché), faq, trust-footer. Bangles count the four
  prints; cowries stay out of this build. Mood: crowned before coffee.
These show the range. NEVER copy one — remix their choices or invent a new variation in the
same spirit.
`,
};
