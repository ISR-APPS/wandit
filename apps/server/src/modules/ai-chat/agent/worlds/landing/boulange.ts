import type { DesignWorld } from "../types";

/**
 * BOULANGE — the warm morning boulangerie.
 * Popular wave: the artisan bakery/patisserie genre executed at the level a
 * merchant assumed cost 10 000 €. Everything on the page stands on a shelf
 * line; photography is the only picture; the page never darkens.
 * fusesWith: braise (same warm food family, opposite hour — night grill after
 * the morning bake), carnet (the paper/notation register for a shop journal),
 * eclat (warm-grade photography for a patisserie boutique moment).
 */
export const boulange: DesignWorld = {
	id: "boulange",
	name: "Boulange",
	family: "boulange",
	tagline: "6 h 30 au fournil : tout se pose sur une planche.",
	kind: "website",
	mood: ["warm", "morning", "artisan", "honest", "appetizing"],
	energy: "medium",
	priceFeel: "accessible",
	industries: [
		"patisserie / bakery",
		"café / coffee shop",
		"traiteur / catering",
		"gelato / desserts",
		"tea house",
		"grocery / gourmet",
	],
	avoidFor: [
		"tech-saas",
		"SaaS product",
		"fintech product",
		"AI product",
		"lawyer / law firm",
		"notary",
		"financial advisor",
		"electronics / gadgets",
	],
	fusesWith: ["braise", "carnet", "eclat"],
	preview: {
		ground: "#F7EFE1",
		ink: "#3A2A1A",
		accent: "#C08A3E",
		fontFamily: "Bree Serif",
		sampleWord: "Le Fournil",
	},
	doc: `# DESIGN WORLD: BOULANGE — the warm morning boulangerie

## Philosophy
This page is a BAKERY AT 6 H 40 — twenty minutes before the queue, shelves full, flour in the air. Not a restaurant site, not a food brand: a shop you walk into, priced in dinars.

Three structural facts define it and cannot be argued with.
1. EVERYTHING STANDS ON A LINE. Every product, price, photo, statistic and caption rests on a SHELF RULE — 2px ink-22% with a 1px rgba(255,255,255,.62) lip riding above it — and drops a soft contact ellipse beneath (radial-gradient at ink 17% fading to 0 at 72%, 14px tall, inset 11% each side; 16% inset and 12px tall below 620px). Items sit exactly 24px above the rule (20px on mobile) — that gap is the world's constant, --sit. The page reads as a wall of shelves at eye level: nothing floats, nothing is centered in a void.
2. PHOTOGRAPHY IS THE ONLY PICTURE. Crusts, crumb, floured hands, the oven mouth, a shelf wall, a table with coffee — all under one grade. Drawn art exists ONLY as line furniture: the shelf rules, ONE wheat stalk, ONE steam wisp, the bounded speckle in the board's corners. No illustrated baguettes, no wheat-field vector scenery, no chalkboard cartoons.
3. THE PAGE NEVER DARKENS. Cream → oat → floured board is the entire ladder; the darkest FIELD anywhere, footer included, is #E8D8BC. A photograph may carry its own shadow — a dark oven surround, a dim workshop — because it is a window, not a field. A dark section, footer or night mood is another world (braise bakes at night; boulange closes at noon).

Impossible failure modes: the moody dark grill page, the stock-hero with a dimming overlay and centered white type, the farmhouse-clipart bakery, cold minimal white space. Self-audit before shipping: (a) three or more shelf rules with items genuinely standing on them, ellipses included; (b) exactly ONE stalk design, reused; (c) exactly ONE loop; (d) zero fields darker than the board; (e) every photograph under the one grade, captioned UNDER its shelf line; (f) every price in the display face on its product's baseline.

## The variation contract (why two BOULANGE sites are siblings, not clones)
WORLD LAW — never renegotiated by brief or builder:
- Shelf-line composition: items stand on rules with contact ellipses; captions under the line.
- The cream → oat → board ladder, never dark, no exceptions for footers or interludes.
- Photography-only imagery under one warm grade; drawn art restricted to line furniture.
- The wheat stalk as the world's only ornament; the fournée board as the page's held breath.
- Chunky slab-serif display + humanist sans body; prices always in the display face.
- WARM RISE motion with exactly one looping element on the page.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes inside each register.
- The display face WITHIN the register: Bree Serif, Kurale, or Rokkitt — one per site.
- THE HOUR that drives the page: "6 h 30", "4 h du matin", "la dernière fournée", "le dimanche". The hour names the hero line, fills the board, sets the voice, decides which photograph opens.
- The products, the story told (levain, the wood oven, the mill), the scrubbed showpiece, and the section order beyond the fixed opening and closing.
A BOULANGE page with no hour is a failure: choose the hour first and the page assembles itself around it.

## The vibe (voice)
Plain warm French said by someone with flour on their forearms: short declaratives, real numbers, zero marketing. Craft vocabulary is exact — levain naturel, pousse lente, farine T65, four à sole, façonnage, khobz dar — never "des produits de qualité". Example lines:
- "On pétrit à 4 h. On vend jusqu'à ce qu'il n'y ait plus rien."
- "Le levain a douze ans. Il dort dans un pot en grès, près de la fenêtre du fournil."
Banned: superlatives ("le meilleur croissant d'Alger"), exclamation marks outside a genuine greeting, luxury-speak, manufactured scarcity. Scarcity here is honest fact: "on ferme quand il n'y a plus rien."

## Visual signatures (measured)
- SHELF LINE-UPS (owned tic). A shelf is a 2px rule in ink 22% with a 1px rgba(255,255,255,.62) lip above it, spanning the container or bleeding past a photo to the viewport edge. Items stand ON it: name in display, detail in body 13.5–14px ink-60%, price in display deep-wheat, each with its contact ellipse. Three to five items per shelf (four is the catalogue's rhythm); the shelf label sits at the left end in 11.5px uppercase deep-wheat, followed by a hairline and one provenance word ("Cuits au bois", "Beurre de Sétif"). Below 620px the row becomes a stack and EACH item takes its own 2px rule — the shelf never collapses into a plain list.
- THE FOURNÉE BOARD (owned tic). A floured-board panel: background #EBDCBE, radius 6px, 1px ink-12% edge, no shadow, and flour speckle STRICTLY in the corners — 13 dots at 1.5–2px, ink 10–15%, within ~60px of a corner, never spread across the field. It carries the day's baking times as rows separated by a printed 1px ink-13% hairline; the hour in board-wheat display, the product in ink display, and a 1px wheat rule at 55% opacity drawing over the hairline as each line writes.
- THE WHEAT STALK (owned tic). ONE hand-drawn SVG stalk, drawn once and reused at three sizes (34x96 as a divider, 52x150 in a band's margin, 28x78 at the footer rule's end). Its build: viewBox 0 0 48 132; a 1.6px stem from y130 to y32; nine grains as filled ellipses — an upright tip (rx 4.2, ry 10.2) at y30, then four pairs at y44/60/76/92 offset to x17.6 and x30.4, rx 4–4.2, ry 8.8–9.4, rotated -24° and +24°; two 1px beards curving from y22 out to y2. Grains are ellipses, never chevrons; the stalk is never labelled, captioned or used as a bullet twenty times.
- Photo frames: rectangles consuming var(--radius) directly (the 6px soft corner), 1px ink-14% edge, seated on a shelf rule. No deep rounding, arches, circles or plates over the image.
- Captions: 11.5px body 700 uppercase +0.14em in deep wheat, ON the shelf line under the photo, left aligned; an optional sentence-case line at 14px ink-60% follows.
- Hairlines ink 14% for lists; 2px ink-22% for shelves; the only shadows are contact ellipses.
- Numerals live large: hours, grams, dinars and years are display moments; a pull figure (18 h, 240 °C, 2013) at clamp(3rem,6vw,5rem) anchors any story section.

## Color physics
- GROUND A — cream: the #F7EFE1 / #F8F1E5 / #F6EDDD register. The page's default field.
- GROUND B — floured oat: the #F2E6D2 / #F0E3CC register, 5–9 RGB points down. Alternation between A and B IS the vertical rhythm; never three identical grounds in a row.
- BOARD — the #EBDCBE / #E8D8BC register, for the fournée board, the order slip and at most one more panel. It is the darkest field the world allows, and always sits on CREAM: board-on-oat is 5–6 RGB points and the panel dissolves — swap that section's ground rather than weaken the panel.
- INK — crust brown, never black: the #3A2A1A / #33251A / #40301F register. Body at full ink; secondary ink-70%; captions ink-60%; hairlines 12–14%.
- ACCENT — wheat: the #C08A3E / #CE9A4B / #B8802F register. The bright accent is for NON-TEXT only — rules, the CTA fill, the stalk, ticks, the line under a board row. Accent TYPE steps down the ladder for contrast: #A2702C for display-scale accent words (the hour in the h1), #875A1E for prices, labels and captions on cream or oat, #7A5119 for the same on the board. Budget: prices, hours, the stalk, the CTA fill, the active state, and at most ONE word per headline. The accent never becomes a background wider than a rule.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · ACCENT→--primary · INK→--primary-foreground · GROUND B→--secondary · BOARD→--accent · ink at 60%→--muted · ink at 14%→--border · 6px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every register sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Gradients exist in exactly three places: inside photographs, inside the contact ellipses, and in the steam wisp's two-stop white fade. No gradient decorates a section, none sets type; there is no second accent — a red, a green or a chalk-blue turns this into another genre.

## Typography system
- DISPLAY: a warm, chunky, low-contrast slab serif — Bree Serif (400), Kurale (400), or Rokkitt (600–700). One per site. NEVER italic; emphasis is the wheat or nothing. Display is used above ~1.2rem and for every price.
- BODY: a humanist sans — Livvic (300/400/600), Commissioner, or Assistant. 300 on cream, 400 on board panels.
- Sizes: h1 clamp(2.9rem,7.2vw,6rem)/1.0, tracking -0.015em, capped at 14ch. h2 is a four-step REGISTER, all at /1.04 on a 2rem floor: catalogue head clamp(2rem,4.2vw,3.5rem), orders 4vw/3.3rem, story 3.8vw/3.2rem, showpiece 3.6vw/3.1rem; a board panel's own title leaves the register at clamp(1.7rem,2.6vw,2.3rem) — a panel is not a section. h3 clamp(1.3rem,2vw,1.7rem)/1.15; body clamp(15.5px,1.02vw,17.5px)/1.62 at 300; lead clamp(16px,1.15vw,18.5px) at ink-70%; labels 11.5px/700 uppercase/+0.14em; prices clamp(1.15rem,1.4vw,1.4rem) display.
- Numbers never break across lines: hours, weights, temperatures and prices take non-breaking spaces (6&nbsp;h&nbsp;30, 250&nbsp;g, 240&nbsp;°C, 1 200&nbsp;DA). A price split over two lines is a bug in this world.
- Display never exceeds 10vw (wave law); prose caps at 56–62ch and is never centered.
- MONO NEVER APPEARS: no telemetry captions, ƒ-stop chips or coordinates. Italic is allowed once per page, in body, for a quote's attribution.
- Arabic pairing: Rubik or Noto Kufi Arabic at 1.04–1.08× the Latin size, shelf rules and board unchanged, layout mirrored — but NEVER duplicate or mirror the stalk.

## Signature art & components
PHOTOGRAPHY (the imagery system). One art-direction phrase governs every image: artisan bakery photography, warm morning light, flour dust in the air, golden crusts, rustic wood, no faces, no text. The GRADE IS LAW on every photograph: filter: sepia(.06) saturate(1.05); a dark original may add brightness up to 1.03, nothing else. THE ROSTER IS FIVE AND ALL FIVE ARE SEATED, close and honest, one job each: the shelf wall (hero), the oven mouth with fire (showpiece), hands working dough (story), a viennoiserie basket (catalogue), a table with coffee (orders). Never a sixth, never one left on the floor; a missing asset is replaced by a sibling re-crop, noted, never by an illustration. Crops are set by HEIGHT, not aspect, so a photo's bottom can meet its rule: hero panel clamp(340px,46vw,540px) bleeding into one gutter at radius 6px 0 0 6px; story portrait clamp(380px,44vw,560px); orders portrait clamp(360px,40vw,520px); supporting landscape clamp(200px,24vw,330px). The CATALOGUE CROP is the page's one aspect-set photo: 1/1 in a clamp(180px,20vw,260px) column (150–210px under 1040px), standing on the SAME shelf as its items, which drop to two columns; uncaptioned, since the shelf label names the rayon; full width on its own 2px rule below 620px. Never a 100vw wallpaper, never type over a photograph’s middle — text sits BESIDE the photo or under its shelf line.
BUTTONS: filled wheat with ink text, radius 4px, padding 15px 26px, body 700 uppercase 12.5px +0.1em. Hover/focus deepens the fill to #A2702C and DEEPENS THE CONTACT SHADOW instead of lifting — CTAs stand on shelves too. The resting ellipse sits at opacity .78 and goes to 1 with scaleY(1.35) — at full strength it cannot deepen, and the move reads as a stretch. Ghost variant: 1.5px ink-24% border, same radius. Pills are another world's furniture.
FORMS — LE BON DE COMMANDE: an order slip on a board panel. Fields are underlined lines, never boxes: label above at 11.5px uppercase deep wheat, input transparent with border-bottom 1.5px ink-24%, min-height 44px, focus turning the rule deep wheat #A2702C at 2px and the label #5F3F12. Phone first: type="tel" inputmode="tel"; selects for the pick-up day and hour; a textarea for the order. On valid submit, dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail, plus one off-canvas decoy input carrying data-wandit-hp (left:-9999px, tabindex -1, autocomplete off) that the page's script never reads. The success state is written, not celebratory: the slip is replaced by one wheat rule drawing across and a real sentence — "Commande notée. On vous rappelle avant 12 h pour confirmer le retrait." — with the shop's phone number beside it.
CARDS: BOULANGE has no cards. Groups are shelves and rows. Where a panel is unavoidable it is a board panel: 6px radius, 1px ink-12% edge, no shadow.
ACCESSIBILITY FLOOR: one h1, semantic landmarks, :focus-visible in DEEP wheat #A2702C at 2px offset 3px, ::selection wheat on ink, stalk and wisp aria-hidden, the board written as real text, keyboard and touch parity for every INTERACTIVE hover state, and a reduced-motion page that is fully composed. Below 900px the nav is REPLACED, not dropped: an anchor strip in the shelf language — section labels at 11.5px uppercase deep wheat standing on a 2px rule under the wordmark, wrapping rather than scrolling.

## Page chassis
Container caps at 1240px; gutter clamp(20px,5vw,64px); bleed = max(gutter,(100vw - 1240px)/2) so a photo can run to the viewport edge; html,body{overflow-x:clip} is the net. Section rhythm: padding-block clamp(4.5rem,9vh,8rem); the band tighter at clamp(3.5rem,7vh,6rem).
FIXED OPENING — the counter hero: an eyebrow label, a short declarative headline naming THE HOUR, two lines of sub, one photograph bleeding into a gutter and STANDING on its own shelf rule (the rule bleeds with it, to the viewport edge), and a second full-width shelf 30–52px below carrying three facts. The wisp curls above the photograph. Nothing is centered; the headline never sits on the photo. The two staggered rules make the first viewport read as a shelf wall.
FIXED CLOSING — the bon de commande board beside the practical column (adresse, horaires with the closed day struck through in ink-40%, accès, téléphone as a real tel: link), then the honest sentence standing ON its own 2px shelf rule at the column's foot — rule UNDER the sentence, spanning the whole column, contact ellipse included; a border-TOP there, or a rule clipped to the sentence's 20ch measure, inverts the world's first law. Then the monument footer: the shop's name in display at clamp(2.4rem,7vw,5.5rem) with the address at 14px ink-60% right-aligned beside it, a hairline running the full width with the stalk at its end, one legal line and the footer nav.
FREE MIDDLE — compose 3–5, never two adjacent alike: the fournée board showpiece · stacked shelves with DZD prices · the story split · the band carrying ONE static client quote · the orders row list · a wheat-divider breath.

## Motion identity — WARM RISE
Gate every animation on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state is set by gsap.set, never in CSS: with JS dead the page is fully readable, composed and lit.
- Easing identity: sine.out for rises (the signature — dough rises, it does not spring), power2.out for supporting moves, power1.inOut for crossfades. NO overshoot, bounce, snap or elastic (wave law).
- Entrances: y+16px, opacity 0→1, 1.0s (register 0.9–1.2s), stagger 80ms, triggered at top 88–90%; shelf items rise in reading order.
- THE ONE LOOP: a steam wisp above the hero photograph — two soft white 10px-stroke paths under an 8px CSS blur at ~62% group opacity, drifting y -11 to -14px with a 1.04–1.06 scaleX, 6.5s and 7.4s sine.inOut yoyos offset by 0.8s. Nothing else loops, ever: a LOOP above a photo, never a spine drawn on scroll.
- THE SHOWPIECE (one per page): THE FOURNÉE BOARD WRITES ITSELF. Pin the stage from "top top" for "+=85%" (register 80–95%) at scrub 0.6 with anticipatePin 1. Per row: the hour fades in (0.22s), the product name unclips left→right (clip-path inset(0 100% 0 0) → inset(0 0 0 0), 0.5s power1.inOut) starting 0.06 behind it, then the wheat rule scales from scaleX 0 (0.42s) starting 0.1 behind that; a 0.1 beat separates rows. The last beat fades the closing note up from y+10. Below 900px (or under 620px of viewport height) the pin is dropped and the same timeline runs on a short scrub from the board's top at 88% to its top at 22% — never a pin on a phone.
- Hover/focus: shelf items tighten their contact ellipse to scaleX .86 at 85% opacity while the price deepens to #6E4715; links draw a 1.5px wheat underline in 180ms; the CTA deepens its fill and scales its shadow 1.35 in y. Every hover state on an INTERACTIVE element has a :focus-visible twin; the shelf-item polish is the single decorative exception: a non-link catalogue item never gets tabindex to earn a focus ring.
- Reduced motion: board fully written, wisp a still curl, rises instant. The still page must look composed, not empty.

## Ban list (the global ban list applies; these are BOULANGE's own)
- MATIÈRE's 4% feTurbulence page grain and its arch-topped frames, pills and drawn room miniatures BY NAME — our speckle is bounded to the board's corners; our geometry is rectangular.
- BRAISE's ember underline gradient, charcoal slate menu plates and rising smoke path BY NAME — boulange is MORNING: our wisp is a loop above a photo, never a scrub spine. Dark sections, footers, night grounds, candlelight or ember warmth of any kind are out.
- HERBIER's labelled specimen plates and botanical tags BY NAME — the stalk is unlabelled and never becomes a herbarium.
- CARNET's spiral binding and handwriting draw-on BY NAME — no script, marker or handwriting face anywhere, not even for "du jour".
- GOMMETTE's die-cut stickers and peel-pops BY NAME. SAUCE's ingredient explode and irregular drip section edges BY NAME.
- ECLAT's 28–48px deep-rounded photo masks BY NAME; MAISON's raised caption plinths BY NAME (captions live under the shelf line); DOMAINE's photo-bottom meta strip and serif price plate BY NAME; CATALOGUE's SKU register captions and hard-shadow seamless-plinth product shots BY NAME (our shadows are soft ellipses under shelf items).
- Chalkboard textures, kraft paper, burlap, wood-plank backgrounds behind text, "artisan" script logotypes, wheat-field landscape photography, windmill / rolling-pin / baker's-hat icons and mascots.
- Mono or telemetry captions, italic display, pill buttons, box-shadow cards, glassmorphism, centered hero type over a photograph, second accents, fake urgency ("plus que 3 baguettes") — honest sold-out language only.

## LES GESTES (the moves menu)
1. LE COMPTOIR (hero) — headline block left, photograph bleeding into the right gutter on its own bleeding rule, a second full-width shelf below carrying three facts, wisp above the photo. Two staggered rules in the first viewport; the default opening.
2. LA VITRINE (hero alt) — no big photo: one long shelf at eye level across the full width carrying four 1/1 crops with prices under the rule; headline above, off-center left.
3. LA FOURNÉE (showpiece) — the floured board pinned, the day's hours writing themselves line by line on scrub while a small oven photograph stands on its own shelf opposite.
4. LE RAYON — the catalogue: three stacked shelves, each labelled at its left end, items standing along the rule with DZD prices in display. Dense horizontal rhythm, no cards. ONE shelf of the three — never more — seats a 1/1 catalogue crop at its left end, sharing the rule with items that drop to two columns: twelve identical typographic rows is where this world goes quiet.
5. LE PÉTRIN (story split) — portrait photo on one side, a vertical hairline time-rail with wheat ticks (04 h 00 pétrissage, 05 h 30 façonnage, 06 h 30 enfournement) on the other, one pull figure at display scale.
6. LA BANDE D'AVOINE — a full-bleed band with a hairline above and below, the stalk standing tall (52 x 150px) in the first column, ONE static client quote at clamp(1.6rem,3.3vw,2.75rem) capped at 32ch beside it, the attribution ending in a hairline that runs out to the container's edge.
7. LE BON DE COMMANDE — the order slip: board panel, underlined fields, day select, honest written success, beside the practical column.
8. LA DOUBLE ASSIETTE — two photographs of unequal width on ONE continuous shelf running the container's full width, captions under the line, no gap ornament between them.
9. L'ÉPI (divider) — the stalk centered between two hairlines with 40–60px of air; once or twice per page, never between every section.
10. LE MONUMENT — the footer wordmark at clamp(2.4rem,7vw,5.5rem) on one hairline with the stalk at the end of the rule.
11. LA MONTÉE — three crops rise onto one shelf 0.14s apart on scrub as a counter beside them reaches the day's real number.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. "6 h 30" — Le Fournil d'Hydra, Alger. Hero: headline left naming the hour, the shelf-wall photograph bleeding into the right gutter on its own rule, three facts on a second full-width shelf beneath. Showpiece: the board pinned, six hours writing themselves beside the oven photograph. Mood: neighbourhood premium, quiet pride, countable.
2. "La vitrine du dimanche" — a pâtisserie in Oran. Hero: no photograph, one long shelf at eye level carrying four square cake crops with prices under the rule, headline above and left. Showpiece: THE SHELF RESTOCKS — crops slide up onto the rule 0.14s apart as the Sunday count climbs. Mood: festive, family, sugar-lit.
3. "Le pain d'après-midi" — a café-boulangerie in Tizi Ouzou. Hero: a full-width duo, two photographs of unequal width on ONE continuous shelf, headline between them in the narrow middle column. Showpiece: THE CLOCK RAIL — a day-rail from 6 h to 19 h along which four product markers slide into their hour on scrub. Mood: calm, studious, afternoon.
4. "Farine T65" — a mill-to-shop bakery in Constantine. Hero: text only, headline in three stacked lines, the stalk down the left gutter, one 1/1 crop on the shelf beneath. Showpiece: THE GRAIN LADDER — a hairline ladder (blé, moulin, levain, four, comptoir) whose rungs draw one by one while the photograph beside it swaps at every rung. Mood: honest, technical, proud.
5. "Le levain de 2013" — a levain-only micro-bakery in Béjaïa. Hero: portrait photograph LEFT, bleeding into the left gutter, text right-aligned against it, the hour as a display figure. Showpiece: THE FEEDING CHART — four feeding times pinned as a crossfading pair, the photograph changing at each stop as the board's active row lights in wheat. Mood: intimate, nerdy, warm.
6. "Les fêtes" — an orders-forward shop in Blida. Hero: an order-slip composition, the first two fields of the bon de commande on a board panel, headline above, one crop on the slip's shelf. Showpiece: THE PLATEAU BUILDS — a top-down tray photograph with hairline callouts writing themselves around it while the total in DZD counts up. Mood: generous, occasion.
7. "Khobz dar" — a home-bread specialist in Sétif. Hero: a triptych, a photograph panel in the middle column flanked by two narrow text columns, one continuous shelf under all three. Showpiece: THE OVEN OPENS — the oven-mouth crop widens from 3/4 to 16/9 on scrub while a rail writes 240 °C, sole en pierre, 18 min. Mood: domestic, everyday bread taken seriously.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or the world collapses into a beige template. FIRST, the SHELF DISCIPLINE: if items float instead of standing on rules with contact ellipses, there is no boulange — walk the page and count the rules. SECOND, the PHOTOGRAPHY: one grade, tight honest crops, seated on shelves, captioned under the line; a lazy full-bleed wallpaper kills the world instantly. THIRD, the FOURNÉE BOARD actually writing itself — the page's held breath.
The cheap details that separate this from a generated page cost nothing: prices in the display face on the product's baseline, deep wheat for small type, the caption ON the shelf line, the closed day struck through, the bounded speckle, the single stalk, and the honest closing sentence — "on ferme quand il n'y a plus rien." When in doubt, add a real number: an hour, a weight, a year, a temperature. Precision is this world's warmth.`,
};
