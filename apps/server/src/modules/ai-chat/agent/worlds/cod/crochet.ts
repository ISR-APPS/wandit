import type { DesignWorld } from "../types";

export const crochet: DesignWorld = {
	id: "crochet",
	name: "Crochet",
	family: "handmade-craft",
	tagline: "Grand-mère's hook: yarn loops and granny squares",
	kind: "cod",
	mood: ["handmade", "cozy", "tender", "woolen"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["kids & baby", "home & kitchen", "fashion & apparel", "pets"],
	avoidFor: ["electronics & gadgets", "car accessories", "fitness equipment"],
	fusesWith: ["dar", "warqa"],
	preview: {
		ground: "#F8F2E7",
		ink: "#3D332C",
		accent: "#D98E9C",
		fontFamily: "Grandstander",
		sampleWord: "Fait main",
	},
	doc: `
CROCHET — GRAND-MÈRE'S HOOK

1. PHILOSOPHY

Crochet is the armchair by the window where someone loved you enough to count stitches. This
world sells the handmade — blankets, bonnets, baskets, anything born from a hook and patient
hours — and its argument is time itself: you are not buying an object, you are buying
afternoons. So the page moves slowly and warmly. Wool-cream grounds, one soft yarn color
leading, loops edging the sections like the border row of a blanket. Nothing is machined:
markers are wool balls, badges are granny squares, corners are rounded the way worn things
are. But softness is not vagueness — the funnel stays honest and complete: real materials
named, real dimensions given, real maker credited, price early, form easy for a tired parent
holding a baby in one arm. The voice is a warm maker's voice: "chaque maille est comptée",
"lavable, câlinable, transmissible." It never babytalks and never discounts its own hours
with panic mechanics. Crochet is the library's tenderest premium — heirloom energy at
COD-form simplicity.

Self-audit before shipping:
- Do yarn-loop borders read as CHAINS of loops (drawn stitches), never as generic scallops?
- Are granny squares textured (visible stitch rows) — never flat colored tiles?
- Do wool-ball markers stand alone — no trailing threads connecting anything?
- Is ONE yarn color dominant, with the others whispering at ≤10%?
- Does the copy name materials, dimensions and care honestly (coton bio, 90×90, lavage 30°)?
- Does the page feel patient — zero countdowns, zero stock panic anywhere?
- Price early, sticky CTA reachable, fields ≥52px, COD reassurance beside the form?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — counted like rows, never reordered.
- Palette registers: grounds wool cream #F8F2E7 / sage #DDE7D9; ink #3D332C; yarn rose
  #D98E9C, mustard #D9A93E, deep sage #7C9782 (ONE dominant); kraft tag #CBB392.
- Type stacks: Latin display Bree Serif or Fraunces; body Mulish. Arabic display Baloo
  Bhaijaan 2; body Almarai.
- The three owned tics: yarn-loop borders, yarn-ball markers, granny-square patches.
- Motion identity "hand-made": soft 0.5s sine pops; the yarn border knits across once.
- Desktop law: centered mobile shell (~455px) on wool cream.
- Refused blocks: countdown, stock-urgency, spec-table, comparison-table.
- Imagery style: cozy handmade photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER — a baby blanket and a market bag
  tell different stories.
- Form style from the form menu.
- Proof lead: photo-reviews or whatsapp-proof (parents' voice) — choose per product.
- Yarn dominance (rose / mustard / sage) and where granny squares appear.
- Section rhythm: a spare 8-block lullaby or a full 13-block trousseau.
Every client receives a new piece from the same hands — same stitch, new pattern. A clone
unravels the contract.

3. VISUAL SIGNATURES

Measured values:
- Grounds: #F8F2E7 primary; #DDE7D9 sage relief sections (max two per page); cards #FFFDF8.
- Ink: #3D332C headings/body; #6E6156 secondary; never black.
- Yarn colors: rose #D98E9C / mustard #D9A93E / sage #7C9782 — dominant owns CTA, loops,
  active states; others ≤10% inside granny squares and tiny accents. Kraft #CBB392 for tags.
- Display type: clamp(28px, 8vw, 42px) Bree Serif 400, line-height 1.2; section titles
  clamp(20px, 5.5vw, 28px); body clamp(15px, 4vw, 16.5px)/1.7 Mulish; Arabic body 1.85.
- Radii: 16px cards (worn-soft), 999px chips and CTA; photos 12px.
- Borders: none hard — cards separate by tone plus their yarn-loop edge when featured;
  hairline #E5DACB rules elsewhere.
- Shadows: none; wool doesn't float.
- Spacing: sections clamp(60px, 15vw, 92px); generous 20/28/44 inner scale — air is part of
  the tenderness.
- YARN-LOOP BORDERS (tic): chain-stitch rows drawn as connected loops (SVG path of repeated
  e-shaped loops, 10-14px tall, 2px stroke in the dominant yarn color) edging the hero card,
  the offer and ONE proof section — the blanket's border row. Loops are open chains, never
  closed scallop arcs.
- YARN-BALL MARKERS (tic): step/bullet markers as wool balls (drawn sphere with 3-4 curved
  wrap lines + a 6px tail stub, NO trailing connector). Active step's ball in dominant color,
  others kraft-toned.
- GRANNY-SQUARE PATCHES (tic): 44-72px crochet squares with visible concentric stitch rows
  (3 rounds, dominant + one other yarn + cream) used as badges, list accents and ONE quilt
  strip (a row of 3-5 squares). Always textured with stitch dashes — never flat tiles.

4. COLOR PHYSICS

Ground register: #F8F2E7 → #F1E8D8 warmth; sage relief #DDE7D9 → #D3E0CE. Ink register:
#3D332C → #6E6156. Yarn physics: ONE dominant per build carries CTA, loop borders, active
balls; the two others live only inside granny squares (their natural home) and at most two
small accents. Kraft is paper: tags, care labels. Forbidden: black, white grounds, neon,
gradients, cool grays, more than three yarn colors, red urgency anywhere. Form errors use
clay #B96A55, form-internal only.

5. TYPOGRAPHY

Latin stack. Display: Bree Serif (400) — round-serifed warmth, like letters sewn on felt;
Fraunces (600, soft) as alternate for more heirloom flavor. Body: Mulish (400/700). Pairing
rule: ONE display + Mulish; display for masthead, section titles, prices and the maker's
name; Mulish for everything else. Small-caps kraft labels at 11-12px, letter-spacing 0.14em
Latin only ("FAIT MAIN", "COTON BIO").
Arabic stack. Display: Baloo Bhaijaan 2 (600). Body: Almarai (400/700). Pairing rule fixed.
Clamps shared; Arabic display 92%; Arabic body line-height 1.8-1.9; NEVER letter-spacing on
Arabic. Digits: Western Arabic numerals; dimensions always with units ("90 × 90 cm"); phones
in LTR spans under RTL; logical properties everywhere; loop borders mirror cleanly.

6. SIGNATURE ART AND COMPONENTS

The yarn-loop border is the world's signature line — it edges the hero card like the first
row grand-mère taught you. The knit-wipe (its one animation) draws the chain across once.
Granny squares badge what deserves pride: "fait main" chip, the guarantee, the quilt strip
above reviews. Wool balls count steps and bullets. Supporting cast: kraft swing-tags drawn
flat (no strings — herbier owns tied tags) carrying care icons; soft photo cards at 12px
radius; a crochet-hook divider (a thin hook silhouette lying horizontal) used at most twice;
the CTA a full-width rounded pill in dominant yarn with cream text.

Component discipline keeps the tenderness structural: the loop border appears at most three
times per page (hero card, offer, one proof section) — a fourth appearance turns blanket
into wallpaper. Granny squares never tile edge-to-edge; each patch keeps at least its own
width of cream air around it, like squares waiting to be joined. The quilt strip (3-5
squares in a row) is the only place squares touch, and it appears once. Wool balls size to
their duty: 20px as bullets, 32px as step markers, 44px as the variant swatches. The kraft
tag is always slightly imperfect — one corner radius larger than the others — because
grand-mère cuts by eye, not by die. Care icons are drawn line glyphs (tub, flat-dry, no
bleach) at 2px stroke, never emoji, never solid dingbats.

Imagery: cozy handmade photography. Wool-cream backdrop or pale linen; chunky yarn textures
filling macro frames; granny squares and hooks as props; soft window light from one side,
gentle shadows; the piece draped on a crib, chair or shoulder (no faces — hands and holding
allowed); a kraft tag visible on the folded stack. Color story follows the build's yarn
dominance. Banned in photos: plastic props, studio black, flatlays with hard grids, filters
that cool the wool.

Copy voice, measured: sentences short enough to say while rocking a pram; verbs of care
(compter, laver, transmettre) over verbs of commerce; the maker named once by first name and
never turned into a logo. Numbers appear as facts a parent needs — dimensions, washing
temperature, days of confection — each stated once, plainly. Superlatives are banned; "doux"
may appear twice per page at most, because softness shown in macro photography does not need
repeating in adjectives.

7. THE SPINE

Hook, convince, offer, order form — counted in that order like rows on the hook, invisible
to the buyer. Price placement: EARLY IN THE HERO — the price sits on a kraft tag chip right
under the headline; handmade prices are stated proudly, never hidden. Sticky CTA: a soft
bottom bar on cream with a hairline top rule — product name + price at the start side,
dominant-yarn pill at the end side; appears after the hero, always scrolls to the form.
Mobile-first at 390px; desktop is a CENTERED MOBILE SHELL (~455px) resting on wool cream
#F3ECDD with a single yarn-loop chain running down one margin.

8. BLOCKS TREATMENT

Supported blocks, dressed by Crochet:
- announcement-bar: cream strip, ink text, one small wool-ball glyph — "fait main · livraison
  58 wilayas · paiement à la livraison."
- problem-solution: the maker's story — machine-made sameness vs counted stitches; short
  tender paragraphs beside a stitch macro; loop border beneath.
- benefits-icons: 4-5 chips with drawn line icons (hook, heart, washing tub, leaf); one
  section may pin a granny square beside its title instead.
- ingredients-infographic: "les matières" — coton bio %, hypoallergénique, lavage 30°, each
  on a kraft tag row; honest and short.
- how-it-works-steps: care ritual in 3 wool-ball steps — laver doux, sécher à plat, aimer
  longtemps.
- variant-gallery: yarn-color choices as wool-ball swatches with names ("rose ancien",
  "moutarde", "sauge"); selected ball gets a loop ring; feeds the form.
- photo-reviews: soft cards, parents' words, name + city, a small granny square replacing
  the star row (filled rounds = rating).
- whatsapp-proof: recreated chats in a cream card — the "elle a pleuré en l'ouvrant"
  messages this market runs on; warm, real, no emoji spam.
- guarantee-seal: a granny-square badge beside two lines — "cousu pour durer · échange 7
  jours"; never a stamp, never a rosette.
- price-anchor: the kraft tag grows: price large in display type, "des heures de travail,
  un prix juste" line beneath; loop border above.
- unboxing-gallery: "dans le paquet" — folded piece, kraft tag, care card, lavender sachet;
  one photo + a short list with wool-ball bullets.
- order-steps: 4 wool-ball steps — commande, appel de confirmation, livraison douce,
  paiement à la porte.
- faq: hairline accordions, tender answers (entretien, taille, délais de confection).
- trust-footer: sage relief ground, maker's signature line, phone + WhatsApp large, "tricoté
  avec amour depuis 2018."
Refused blocks: countdown and stock-urgency (handmade time refuses panic), spec-table (a
blanket is held, not specced — dimensions live in copy and tags), comparison-table (nothing
here competes; it inherits).

9. HERO MENU

- Le Berceau: full warm photo (piece draped on crib/chair), cream hero card overlapping the
  bottom with loop-border top edge, name + kraft price tag + CTA inside.
- La Pelote: centered product on cream, a yarn-ball rail counting the set's pieces beneath,
  price tag and CTA; for sets and kits.
- L'Ouvrage: story-hook hero — the maker's line first ("340 mailles. Trois après-midis. Un
  seul bébé."), photo beneath, tag price + CTA.
- Le Carré: the hero framed by ONE large granny-square border (the square blown up as a
  frame), product photo inside; boldest composition, use sparingly.
- La Layette: split hero — photo left, headline/materials/price stack right; stacks at 390
  with the loop border between.
- Le Cadeau: offer-card hero — the piece + gift wrapping presented as a bundle card with a
  kraft "pour offrir" tab; price prominent; for gifting seasons.

10. FORM MENU

- La Commande Douce (single card): one cream card, loop-border header, stacked soft fields,
  dominant pill submit, COD line beneath — the default lullaby.
- Le Fil (two-step wizard): step 1 couleur + taille (wool-ball swatches), step 2 nom +
  téléphone + wilaya; progress shown as a chain adding loops; summary restates total.
- L'Écho Tendre: compact 2-field echo (téléphone + wilaya) under the hero for decided
  parents, full form at the end.
- Le Panier du Marché: sticky-bar-driven — the bar's pill opens the form focused; for short
  builds.

11. MOTION IDENTITY

Hand-made: motion here is the patience of handwork made visible — nothing snaps, nothing
bounces, nothing repeats; each element arrives once, settles, and stays, the way a finished
row stays on the hook. Entrances rise 16px with 0.5s sine.out, gentle 80ms staggers. The ONE signature
moment: the yarn-loop border KNITS across the offer card once (clip-path wipe left-to-right,
1.1s, sine.inOut — reads as loops appearing). Wool balls pop in with a 3° roll settle.
Granny squares fade with a tiny scale from 0.97. NO loops, no bounce, no overshoot, no
parallax; under prefers-reduced-motion everything is static and complete. gsap.set only —
the page reads perfectly without JS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji-as-design, Poppins-everything,
lorem ipsum, fake trust walls, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur, back.out overshoot. Neighbor tics banned by name: caravane's saddle stitches,
rivets and kilim bands; zellij's glazed tile grids (granny squares are YARN with stitch
texture, never ceramic); dar's gingham hems and daylight beam; doudou's cloud scallops and
balloon numerals; herbier's pressed leaves and TIED tags (crochet tags are flat, stringless);
atlas's connecting routes (wool balls never trail threads); dukkan's pompoms; warqa's paper
layers; gommette's stickers. Crochet's own temptations, banned: pastel overload (one yarn
leads), fake "vintage" filters, cursive script fonts, heart icons scattered as decoration,
any urgency mechanic. Refused blocks restated: countdown, stock-urgency, spec-table,
comparison-table.

13. EXAMPLE VARIATIONS

- "Couverture Nuage" — kids & baby, fr-DZ. Le Berceau hero, rose dominant; order:
  announcement, hero, problem-solution, ingredients-infographic, photo-reviews,
  whatsapp-proof, guarantee-seal, price-anchor, order-steps, order-form (La Commande Douce),
  faq, trust-footer. Knit-wipe on the offer. Mood: nursery hush.
- "Panier Boule" — home & kitchen, storage baskets. La Pelote hero, mustard dominant; order:
  announcement, hero, benefits-icons, variant-gallery, photo-reviews, price-anchor,
  unboxing-gallery, order-form (Le Fil), faq, trust-footer. Mood: tidy warmth.
- "Bonnet Prématuré" — kids & baby. L'Ouvrage hero, sage dominant; order: announcement,
  hero, problem-solution, ingredients-infographic, whatsapp-proof, guarantee-seal,
  price-anchor, order-form (L'Écho Tendre), faq, trust-footer. Mood: fierce tenderness.
- "Gilet Grand-Mère" — fashion & apparel. La Layette hero, mustard dominant; order:
  announcement, hero, benefits-icons, variant-gallery, photo-reviews, guarantee-seal,
  price-anchor, order-steps, order-form (Le Fil), faq, trust-footer. Mood: heirloom worn
  daily.
- "Couffin Chat" — pets. Le Carré hero, rose dominant; order: announcement, hero,
  benefits-icons, photo-reviews (chats dedans — proof photos), guarantee-seal, price-anchor,
  order-form (Le Panier du Marché), faq, trust-footer. Mood: spoiled cat, proud human.
- "Coffret Naissance" — kids & baby gifting. Le Cadeau hero, sage dominant; order:
  announcement, hero, unboxing-gallery first (the box IS the story), ingredients-infographic,
  photo-reviews, guarantee-seal, price-anchor, order-form (La Commande Douce), faq,
  trust-footer. Mood: the gift that outlives the party.
- "Châle d'Hiver" — fashion & apparel, chunky shawl. La Layette hero, rose dominant; order:
  announcement, hero, problem-solution (fast-fashion cold vs wool that remembers you),
  ingredients-infographic, variant-gallery (three yarns), photo-reviews, whatsapp-proof,
  guarantee-seal, price-anchor, order-form (Le Fil), faq, trust-footer. The quilt strip
  crowns the reviews; the knit-wipe runs on the hero card instead of the offer. Mood:
  wrapped against December.
These show the range. NEVER copy one — remix their choices or invent a new variation in the
same spirit.
`,
};
