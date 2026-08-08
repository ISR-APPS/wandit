import type { DesignWorld } from "../types";

/**
 * BRAISE — the charcoal grill house.
 * Popular wave: the dark premium restaurant site every restaurateur asks for
 * (warm brown-black ground, fire-lit food photography, ember accents, chalk
 * prices on charcoal slates) — executed at the level they assumed cost 10 000 €.
 * Every value below is measured off the shipped demo (Braise, El Biar, Alger).
 *
 * fusesWith rationale:
 *  - generique: the other dark hospitality world. Generique brings cinematic
 *    letterbox restraint to braise's fire warmth when a client wants "grand
 *    restaurant" over "grill house". Braise stays the one with heat in it.
 *  - boulange: the other fire-and-flour trade. Boulange's daylight bakery warmth
 *    is braise's inverse; fused, they cover a maison that bakes AND grills.
 */
export const braise: DesignWorld = {
	id: "braise",
	name: "Braise",
	family: "braise",
	tagline: "Le noir chaud des braises : ardoises craie, fumée qui monte.",
	kind: "website",
	mood: ["fire-lit", "warm-dark", "appetizing", "grounded", "hospitable"],
	energy: "medium",
	priceFeel: "premium",
	industries: [
		"restaurant (classic)",
		"fine dining",
		"pizzeria",
		"traiteur / catering",
		"venue / salle des fêtes",
	],
	avoidFor: [
		"medical",
		"tech-saas",
		"aesthetic clinic",
		"pharmacy",
		"kindergarten / crèche",
		"kids & baby shop",
		"business consultant",
		"insurance agency",
	],
	fusesWith: ["generique", "boulange"],
	preview: {
		ground: "#191210",
		ink: "#F2E7DA",
		accent: "#D96B2C",
		fontFamily: "Bricolage Grotesque",
		sampleWord: "BRAISE",
	},
	doc: `# DESIGN WORLD: BRAISE — the charcoal grill house

## Philosophy
This page is a ROOM LIT BY A FIRE, not a website. One light source, orange, low, at the far end of the room; everything else is warm brown-black and reads by reflection. First structural fact: the ground is never neutral black — it is #191210/#1E1613, the colour of a wall that has stood near a grill for ten years. Second: the menu is not a list, it is a set of MATTE CHARCOAL SLATES with chalk-white prices and 2px corners — physical boards, hung on the page. Third: exactly one gradient exists here, the EMBER UNDERLINE, always orange-to-nothing, left to right, like heat leaving a bar of steel. Two failure modes are structurally impossible: "a stock food photo does all the work" (every photograph is framed, hairlined, captioned in chalk, and answers a headline that already made the argument) and "dark = cold" (the whole palette sits on the warm side of every hue). Self-audit before shipping, all countable: exactly ONE rising smoke path on the page · exactly ONE colour gradient family (the ember underline) · every price in the display face, chalk-white, tabular · every PLATE photograph in a 3px frame with a caption BELOW it (exempt: the hero seam image and the full-width band — architecture, not plates, so no frame and no caption), text on none of them · zero pure black (#000) and zero cool grey anywhere · at least three charcoal slates.

## The variation contract (why two BRAISE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Warm brown-black grounds (the #191210/#1E1613/#171110 register), chalk ink, ONE ember accent. Never neutral or blue-black.
- Charcoal slate plates as the menu/price object: matte #100D0B boards, 2px radius, 1px chalk hairline at 12%, chalk-white prices, dotted leaders.
- The ember underline as the only colour gradient on the page.
- Exactly one rising smoke path, and it is the scroll-scrubbed showpiece's spine.
- Photography is fire-lit, graded \`filter: sepia(.08) contrast(1.05)\`, framed at 3px, captioned below. No drawn illustration, ever.
- Motion is warm and slow: 1.2s fades, no bounce, no snap, no overshoot.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact ember hex inside the register (#D96B2C fire / #C85A22 deeper oxide / #E07C33 brighter flame) and the exact ground pair.
- The display face WITHIN the register: Bricolage Grotesque (default) or Unbounded (used sparingly, headline-only).
- THE FIRE NOUN that drives the page — la braise, le foyer, la cendre, la maturation, la fumée. It names the hero claim, the showpiece, the section numbering and the voice.
- Which photographs exist, the number of slates (3–5), the register's columns, the section order beyond the fixed opening and closing.
A BRAISE page with no fire noun is a failure: choose it first, then let it pick the headline, the showpiece and the vocabulary.

## The vibe (voice)
Plain French with a grill-master's precision and no salesmanship. Short declaratives that state a constraint and let it flatter the house. Fire vocabulary is exact — chêne vert, olivier, saisie, cendre, maturation, arrivage — never "des produits de qualité". State limits proudly: covers, services, hours, what you refuse to do. Zero superlatives, zero exclamation marks, zero urgency. Three lines in register:
- « Le feu fait la cuisine. »
- « Le chêne brûle une heure pleine avant qu'on cuise quoi que ce soit. Tant qu'il y a de la flamme, il n'y a pas de cuisson. »
- « Une demande, pas une confirmation : on vous rappelle avant 18h pour caler le service. »

## Visual signatures (what makes it instantly recognizable)
- **THE EMBER UNDERLINE (owned tic).** A 2px rule (3px at section scale) running \`linear-gradient(90deg, #D96B2C 0%, rgba(217,107,44,.5) 40–46%, rgba(217,107,44,0) 100%)\`, width clamp(120px,17vw,232px), or min(100%,560px) at 3px tall for the section-scale variant, or 100% of its container above the footer wordmark. It sits under section titles, under one word inside the h1 (height .07em, bottom −.055em), under every slate header, and under each timeline numeral. It always draws from the left.
- **CHARCOAL SLATE PLATES (owned tic).** Matte #100D0B boards, 2px radius, 1px hairline rgba(242,231,218,.12), padding clamp(18px,1.9vw,26px) clamp(18px,2vw,28px) clamp(20px,2.2vw,30px) — a touch more foot than head. Header row = dish family (display 600, clamp(1.15rem,1.6vw,1.5rem)) left + a micro-meta right (11px, uppercase, +0.14em, ink at 52%). Then the ember underline. Then dish rows: name (body 300, ink 72%) · a dotted leader (1px dotted at 24%, translateY −4px) · price (display 600, tabular, chalk). Each slate carries a \`.slate__heat\`: \`radial-gradient(75% 120% at 0% 100%, rgba(217,107,44,.20), transparent 70%)\` on its lower-left. A WIDE slate (photo ~41% left, type right) leaves no dead board: prose and price lockup share one \`justify-content:space-between; align-items:flex-end\` row, so the big figure lands flush with the board's inner right edge, on the micro-meta's axis. Stacks left-aligned below 860px.
- **THE RISING SMOKE PATH (owned tic).** One thin SVG line, viewBox 0 0 120 1000, stroke #D96B2C at 1.5px and 92% opacity, a slow S-curve plume, masked upward (\`mask-image: linear-gradient(to top,#000 0,#000 42%,rgba(0,0,0,.25) 88%,transparent 100%)\`) so the top thins, then dissolves. Base: a 38×5px ember bar with an 86×44px radial halo. Drawn end: a 3.4px #E9873B tip and a 15px blurred ember halo. ONCE per page, inside the showpiece.
- Eyebrows are never bare: body face 700, 10–11.5px, uppercase, +0.17em tracking, ink 52%, always preceded by a 6px solid ember square.
- Captions live BELOW the frame, flush-left, 11–12.5px at 52%, prefixed by a 5px ember square.
- Numerals are display-face and tabular everywhere: prices, hours, °C, maturation days, weights. A ledger figure (clamp(2.1rem,4.2vw,3.3rem), −0.04em) carries its unit as a 0.44em ember superscript.
- Corners are hard: slates, buttons and chips consume var(--radius) directly (the 2px chamfer); 3px on photo frames; 0 elsewhere. No card shadows.

## Color physics
- GROUND A #191210 and GROUND B #1E1613 — warm brown-black, 5/4/3 RGB points apart. Sections alternate A/B; the alternation IS the rhythm. Registers: #191210–#171110 for A, #1E1613–#221A16 for B.
- ASH #2A1E18 — one warmer panel, EXACTLY ONE section per page (the demo spends it on le service). The only lift in the page.
- SLATE #100D0B — darker than both grounds; menu plates, the form panel, the footer. Slates read as objects sitting ON the ground, never as the ground.
- INK #F2E7DA chalk. Working alphas: 72% for body prose, 52% for captions/labels, 34% for footer fine print, 12% for hairlines, 22% for strong hairlines (table heads, input rules).
- EMBER #D96B2C. Hot #E9873B (hover fills, the smoke tip, the base bar). Deep #8F3A16 (pressed states only). Budget per viewport: one filled CTA, the eyebrow squares, one to three ember underlines, the ledger units, the smoke line. If a viewport has more than four ember incidents, remove one.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · EMBER→--primary · GROUND→--primary-foreground · SLATE→--secondary · ASH→--accent · ink at 52%→--muted · ink at 12%→--border · 2px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, heat or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Never #000, never a cool grey, never a second accent hue. Green/red only inside the photographs.
- Gradients: the ember underline is the only COLOUR gradient. Two non-colour exceptions — ground, not decoration: the hero seam (\`linear-gradient(90deg, ground 0%, rgba(ground,.62) 16%, transparent 46%)\`) and the band edge (ground → transparent → ground, top and bottom of a full-width photo band). One ember radial halo (118px, 45% → 0) may sit behind a pulsing dot or a primary CTA.

## Typography system
- DISPLAY: **Bricolage Grotesque** 500/600/700/800 (ALT: **Unbounded**, headline-only and one weight). Mixed case for all statements; UPPERCASE only for the wordmark and the footer monument. Tracking −0.02em on titles, −0.035em on the h1, −0.045em on big numerals. Never italic — emphasis is the ember underline or nothing.
- BODY: **Nunito Sans** 300/400/600/700. Base clamp(15.5px,1.02vw,17.5px), line-height 1.62, weight 300 for prose (it holds up on near-black), measure 50–64ch. Leads at clamp(16px,1.22vw,19px); the hero lead alone runs one notch up at clamp(16px,1.24vw,19.5px).
- Scale: h1 clamp(2.9rem,6.4vw,5.6rem)/0.96 — never above 10vw, this world is a room not a billboard. The cap binds the FOOTER MONUMENT too: min(9.5vw,150px), min(10vw,92px) below 860px. 15–25vw words-as-structure are MANIFESTE's. Section titles clamp(2rem,4.3vw,3.5rem)/1.02, one may go to clamp(2.05rem,4.6vw,3.7rem). Pull statement (display 500) clamp(1.35rem,2.5vw,2.05rem)/1.16, max 19ch. Prices clamp(13.5px,1vw,15.5px) at 600.
- Labels: body 700, 10–11.5px, uppercase, +0.15–0.17em, ALWAYS with the ember square. Bare letter-spaced micro-caps floating on ground are ECRIN's tic and are banned.
- **No monospace anywhere.** Prices, references and hours are display-face with \`font-variant-numeric: tabular-nums\`.
- Arabic pairing: **Almarai** 400/700 for both roles, sized 1.06× the Latin, tracking 0, line-height 1.7. In RTL the ember underline flips to \`linear-gradient(270deg,…)\` so heat still leaves the word from its start.

## Signature art / components
**PHOTOGRAPHY IS THE ONLY IMAGERY — never drawn art, never mixed.** Direction phrase, reused in every generation: *dark moody food photography, charcoal grill embers, warm side light on rustic wood table, deep shadows, appetizing, no text.* Grade, on every image without exception: \`filter: sepia(.08) contrast(1.05)\`. Frames are 3px radius with \`box-shadow: inset 0 0 0 1px rgba(242,231,218,.12)\` on a #0C0908 backing. A photograph may bleed off one viewport edge, and it must reach the GLASS: declare \`--bleed: max(var(--gutter), calc((100vw - var(--maxw))/2))\` on \`:root\`, then \`margin-inline-start|end: calc(-1 * var(--bleed))\` under \`html,body{overflow-x:clip}\`; it squares to 0 radius on the bled side. One gutter of negative margin is NOT enough above 1368px — it leaves ground beside a squared corner. Aspects: 3/4 and 4/5 tall, 4/3–16/10 inside slates, clamp(230px,39vh,420px) for a band. Crop with intent: the fire, the hands, the grate, the plate. Every image gets a real French \`alt\`; every plate photograph gets a caption BELOW it. Text NEVER sits on a photograph — it sits beside it, or on a slate overlapping its corner.
- Buttons: filled ember, ink #150F0D, body 700 at clamp(13px,.92vw,14.5px), +0.04em, 15px × 26px, radius 2px; hover/focus fills #E9873B. Ghost = transparent, 1px hairline at 22%, hover to ember. No shadows, no scaling.
- Links: the ember underline as a hover mechanism — \`background-image\` set to the ember gradient, \`background-size: 0 2px\` growing to \`100% 2px\` in 0.24s. \`:hover\` and \`:focus-visible\` share one rule — never a hover state without keyboard parity.
- Forms are written ON slate: transparent inputs, no boxes, 1px bottom rule at 22% turning ember on focus, radius 0, labels above at 10.5px uppercase +0.16em. Phone is \`type="tel" inputmode="tel"\`; structured choices (service, couverts) are \`select\`. Textarea min-height 104px. On valid submit, dispatch \`wandit:lead\` on \`document\` with the visitor's fields flat in \`detail\`; keep one off-canvas decoy input carrying \`data-wandit-hp\`, never touched by the script. The success state replaces the fields with an honest next step ("On vous rappelle avant 18h pour confirmer le service"), moves focus to it, and lives in a polite \`aria-live\` region.
- The register table: hairline only (th 10.5px uppercase +0.15em over a 22% rule; td 12.5–15px over 12% rules; first column display 600 chalk; numbers tabular, last column right-aligned). The butcher's board made typographic.
- Favicon: inline SVG data URI — an ember flame in #D96B2C with a chalk core on the #191210 ground.

## Page chassis
- Container max 1240px, gutters clamp(20px,5vw,64px). Full-bleed elements are section children at width 100%; nothing is ever SIZED at 100vw — it appears only as MEASUREMENT, in \`--bleed\` and in the hero panel's left inset \`max(var(--gutter), calc((100vw - var(--maxw))/2 + var(--gutter)))\`. Section rhythm padding-block clamp(4.5rem,9vh,8rem). \`[id]{scroll-margin-top:96px}\`.
- Header: sticky, solid ground, 1px bottom hairline, no blur. Display wordmark at clamp(17px,1.5vw,21px), +0.12em uppercase, preceded by a 9px ember dot with a pulsing halo. Nav links collapse below 860px, leaving the ember CTA.
- FIXED OPENING — the hero is a hard vertical seam: a solid ground text panel (0.94fr) against a full-bleed fire photograph (1.06fr) that runs to the viewport edge, min-height clamp(600px,86vh,880px). The h1 carries the ember underline on ONE word. A charcoal slate ("ce soir": état du feu, premier service, dernier service) sits at the foot of the text column and overflows right by clamp(30px,9vw,170px) so it straddles the seam. Below 860px the hero stacks in this order and no other: type, then photo at clamp(240px,38vh,360px), then the slate — the fire photograph must land INSIDE the first fold (y≈447→789 at 390×844). A fire-dining hero with no fire in the fold has surrendered the genre. Build text panel and slate as two children of one \`.hero__col\` flex column, it goes \`display:contents\` below 860px so \`order\` can put the photograph between them.
- FIXED CLOSING — réservation: one static in-world guest quote plus the coordinates ledger on the left, the slate form on the right; then the monument footer — three hairline columns, a full-width ember underline, and the wordmark at min(9.5vw,150px)/0.82 in chalk at 19%, centred, \`overflow:hidden\` (min(10vw,92px) below 860px). The closing rule carries its border on an INNER element, never on the \`.wrap\`, so the hairline sits on the footer columns' axis.
- FREE MIDDLE — compose 3–5, never two adjacent alike: **the foyer split** (tall photo bleeding off one edge against a large claim, closed by a three-cell hairline ledger) · **the slate carte** (the showpiece, below) · **the hand** (headline over a hairline eyerow, then photo bleeding off the OPPOSITE edge with a pull statement, prose and a facts list) · **the band + register** (full-width photo band, then intro left / register table right) · **the staggered evening** (three moments on a 3-col grid at top offsets 0 / clamp(26px,6vh,74px) / clamp(52px,12vh,148px), each with a hairline top, a big time numeral, an ember underline, 30ch of prose) · **the pull break** (one display 500 statement, max 19ch, on ash ground).

## Motion identity — EMBER GLOW
GOVERNING LAW: every hidden state is set in JS via \`gsap.set\`/\`gsap.from\`, NEVER in CSS. Gate the whole block on \`(gsap && ScrollTrigger && !prefers-reduced-motion)\`. With JS dead the page must be fully lit: all slates warm, all prices chalk, the smoke path fully drawn.
- Entrances: opacity 0 → 1 with y 14–16px, **1.2s power2.out**, stagger 0.09s, trigger "top 86–88%". Nothing else moves. No scale on photographs — Ken-Burns and bloom-scale are other worlds'.
- The ember underline draws: scaleX 0 → 1, 1.1s power2.out, transform-origin left, trigger "top 92%".
- Photographs arrive THROUGH FIRE: a \`radial-gradient(120% 90% at 50% 70%, rgba(217,107,44,.34), rgba(25,18,16,.86) 72%)\` scrim over the frame goes 1 → 0 in 1.5s sine.out. The scrim is BUILT by the script and appended to each \`[data-scrim]\` host — never declared hidden in CSS — so with JS dead it does not exist and every photograph sits lit.
- The only loop: an ember glow-pulse on decor dots and the primary CTA halo — opacity .4 → .85, scale 1 → 1.16, 1.5s sine.inOut yoyo (a 3s cycle), staggered 0.35s. Content NEVER loops.
- THE SHOWPIECE — *the smoke rises through the carte.* A 96px rail column holds the plume in a sticky inner box (\`top:14vh; height:60vh; min-height:340px\`); the slates scroll past it in the second column. One timeline, \`scrub:0.7\`, \`start:"top 55%"\`, \`end:"bottom 82%"\`: a proxy tween of duration 5 drives \`strokeDashoffset\` from full length to 0 so the line grows UPWARD from its ember base, while \`getPointAtLength\` carries the tip and its halo along the drawn end. Slate *i* lights at \`0.32 + i*0.74\`: ember underline scaleX 0→1 over 0.75, heat radial 0→1 over 0.9, prices from rgba(242,231,218,.55) to #F2E7DA over 0.8 with a 0.06 stagger. The 55% start and the .55 price floor are LAW: any later or fainter and the section's first screenful renders as dim grey body text. Because the rail is sticky, smoke rises for the whole section while the page descends — that counter-motion IS the effect. Below 860px the rail leaves the grid: the carte becomes one column so head and slates share one left axis at the gutter, and the plume goes absolute in the left margin (34px wide, offset −2px, sticky inner \`top:12vh; height:38vh\`, ember base 22×4px, halo 48×26px) so it glows beside the boards, never across them.
- Hover: 0.18–0.24s ease on colour and border only. Never lift, never scale, never glow a border.
- Reduced motion: the composed still — everything at its final frame. Never a blank.

## Ban list (in addition to the global list)
- **GENERIQUE's letterbox 21:9 crops with black bars, champagne foil small-caps, and Ken-Burns scrubs** — braise never animates a photograph's scale and never bars a crop.
- **VOLTAGE's neon-tube type, beam lines and glowing 1px borders** — the ember is a flat fill, a flat rule, or a soft radial behind a small dot; never a glow on type or a lit border.
- **CHANTIER's hazard-stripe bands, stencil caps with spray edge, and bolted steel plates.**
- **ORFEVRE's gold hairline engravings, filigree corners and gold-leaf page edge** — braise has no metal.
- **MATIÈRE's full-page feTurbulence grain and arch-only geometry** — braise's corners are 2px, its surfaces clean.
- **BOULANGE's shelf line-ups, wheat-stalk divider and flour-dust speckle**, and **SAUCE's ingredient explode and dripping section edges** (this wave).
- **ONDE's steam veils** (this wave) — braise's smoke is ONE thin orange line, in ONE section.
- **SERMENT's vitals line as a page-wide spine and divider** (this wave) — braise's path is vertical, ember, once.
- **ALLURE's spec gauge bars** and **FORME's odometer counters** (this wave) — braise's numbers are typeset, never bars or rolling digits.
- **BLOC's hard offset shadows and rotated price chips**, **SILHOUETTE's huge-type-over-photo collision** — prices live on slates, type beside photographs.
- **ECLAT's 28–48px deep-rounded masks** and **DOMAINE's meta hairline strip pinned to a photo's bottom edge** — braise's frames are 3px, its captions below.
- Also banned outright: any monospace, any italic, card shadows, blurred glass panels, and text over a dimmed photograph.

## LES GESTES (the moves menu)
1. **LA COUTURE** — the hero seam: solid ground panel against a full-bleed fire photo, a "ce soir" slate straddling the join. The seam is softened only by a ground-coloured scrim, never by dimming the image.
2. **L'ARDOISE** — a charcoal slate as any content object: menu family, formule, hours, a single price. Header + ember underline + rows with dotted leaders. Three to five per page.
3. **LA VOLUTE** — the rising smoke path in a sticky rail beside a scrolling column. Once per page. Its base always glows; its top always dissolves into the mask.
4. **LE REGISTRE** — the hairline table (pièce · origine · maturation · poids). Tabular facts, hairlines only.
5. **LE RELEVÉ** — a three-cell hairline ledger closing a section: big display numeral, ember unit superscript, 26ch of explanation under each.
6. **LA MARCHE** — the staggered evening: three or four moments on one row at increasing top offsets, each with a hairline, a time numeral and an ember underline.
7. **LE DÉBORD** — a photograph bleeding off one viewport edge, squared on that side, caption below. It must touch the glass: \`margin-inline-start|end: calc(-1 * var(--bleed))\`, never one gutter. Alternate the side between sections; never bleed the same edge twice running.
8. **LA BANDE** — a full-width photo band (clamp(230px,39vh,420px)) with ground-coloured edges top and bottom, opening a section before any type.
9. **LA MAIN COURANTE** — a hairline eyerow: section eyebrow left, right-aligned meta at 34% ink, one rule under both. The right-hand label keeps its 6px ember square — bare tracked micro-caps are ECRIN's, banned even here. Use it once, on the people section.
10. **LE POINT DE BRAISE** — a 9px ember dot with a pulsing 118px halo marking live state: fire lit, service open. Maximum two per page.
11. **LE MONUMENT** — the wordmark at min(9.5vw,150px) (min(10vw,92px) below 860px) in chalk at 19% under a full-width ember underline, clipped by \`overflow:hidden\`. A signature at the foot of a letter, not a billboard: the 10vw cap is absolute here.
12. **LA DEMANDE** — the form written on slate: no field boxes, chalk rules turning ember on focus, a success line promising a call-back, not a confirmation.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**1 — LE FOYER OUVERT** (grill house, Alger). Hero: the hard vertical seam — ink panel left, ember underline on *feu*, fire photo full-bleed right, the "ce soir" slate straddling the join. Showpiece: the plume rises in a sticky left rail while a 2×2 slate grid lights in reading order, the wide formule last. Mood: confident, domestic, hot.

**2 — CENDRE** (rôtisserie & traiteur, Oran). Hero: a full-width photo band across the top, the claim BELOW it on bare ground under one band-width ember underline — no split. Showpiece: the plume rises through a single tall "fournée du soir" column while the day's five pieces write themselves in from the bottom up, one price at a time. Mood: workmanlike, generous, early-evening.

**3 — LE BANC DE CHÊNE** (méchoui house, Constantine). Hero: no photograph in the first viewport — a narrow centred lockup (wordmark, 4-line claim, ember underline, hours), the first image arriving as a full-width band straight after. Showpiece: the plume rises while a column of six chalk lines (06h00 → 13h00) writes itself one line at a time, each ember tick igniting as it lands. Mood: patient, ritual, communal.

**4 — LA CÔTE** (butcher-restaurant, Sétif). Hero: the DATA is the hero — no photograph, no split. A hairline eyerow, one flush-left headline, then the maturation register at FULL container width under it; the first photograph arrives a section later as LE DÉBORD. Showpiece: the plume rises beside the register while each row's maturation cell is revealed by a chalk wipe (clip-path inset from the left). Mood: technical, proud, butcher's.

**5 — FEU DOUX** (café-braise & brunch, Béjaïa, accessible). Hero: a three-band stack — slim ember rule, one short display line, then a 3-up photo strip of equal thirds at the foot of the viewport. Showpiece: the plume rises BETWEEN two sticky columns (left: the fire's temperature moments; right: what comes off it), each pair lighting as the tip passes. Mood: lighter, daytime, welcoming.

**6 — LA SALLE DU HAUT** (private dining & events, Alger). Hero: one full-bleed photograph with the type in a narrow 320px ink strip pinned to the left viewport edge — a column, not a half-split, no photo behind the strip. Showpiece: the plume rises the full height of one full-bleed photograph while four service lines at its foot take their ember underlines in turn. Mood: quiet, private, expensive.

**7 — BRAISE & MER** (grilled fish house, Aïn Témouchent). Hero: an offset two-row composition — headline in the top-left seven columns, a tall portrait photograph dropping from the top edge in the right four past the fold, the "ce soir" slate under the headline. Showpiece: the plume rises next to ONE long slate whose dish list scrolls past a fixed ember reading-line — the line stays, the list moves, each dish lights as it crosses. Mood: salt, smoke, evening.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or the world collapses into "a dark restaurant template". **The PHOTOGRAPHY GRADE and framing** — one filter value on every image, 3px frames, captions below, never a word printed on a picture; the moment one photo runs ungraded or takes an overlay with centred white type, the page becomes the thing we are replacing. **The SLATES** — chalk-white tabular prices with dotted leaders on matte boards; a braise page whose prices are dim grey body text has thrown away its whole genre advantage, and that includes the un-lit frames of the scrub. **The ONE LIGHT SOURCE discipline** — a single ember hue, budgeted to four incidents per viewport, plus exactly one gradient; two accents or a second gradient and the fire stops reading as fire. The cheap details cost almost nothing: the 6px ember square before every label, the tabular numerals, the heat radial in each slate's lower-left corner, the honest constraint sentences, and the smoke path that keeps rising while the reader descends. When in doubt, take an ember incident away and make a photograph larger — this world's voltage is warmth, not quantity.`,
};
