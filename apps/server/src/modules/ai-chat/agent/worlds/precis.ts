import type { DesignWorld } from "./types";

/**
 * PRÉCIS — engineering-grade clarity: a technical drawing that sells.
 * Faint graph paper, a mono utility face against a sub-450 grotesk, ONE signal
 * accent, and a dimension-annotation layer that measures real page elements
 * like a draughtsman's callouts. The doc is appended VERBATIM to the builder
 * system prompt.
 */
export const precis: DesignWorld = {
	avoidFor: [
		"kids",
		"party",
		"wedding",
		"food-artisan",
		"bakery",
		"street-food",
		"toys",
	],
	doc: `# DESIGN WORLD: PRÉCIS — the annotated technical sheet

## Philosophy
This page is a DRAWING, not a brochure. A mechanical drawing sheet crossed with a Swiss data report: faint graph paper, a mono utility face carrying every label and number, an underweight grotesk display face, ONE signal accent, and hairline callouts annotating the page's own elements the way a draughtsman annotates a part. The promise is not "we are creative" — it is "we are exact, and we will show our work."

PRECISION IS THE PERSUASION. Every soft affordance is removed — shadows, blur, rounded corners, gradients, bounce — and replaced with a drawn one: rules, ticks, brackets, arrows, tables, units, tolerances. Depth comes from hairline and grid, never blur; emphasis from one accent stroke, never weight. Quiet is not empty: a page here is DENSE with real information, and if a section could be deleted without the reader losing a fact, it does not belong.

## The vibe
An engineer who writes well. Copy carries 40 percent of this design, and it is short, declarative and quantified: a number beats an adjective, a unit beats a promise. Copy rules, non-negotiable:
- HEADLINES STATE CAPABILITY, NOT ASPIRATION, in one clause, and where possible they contain a figure: "Nous mesurons ce que les autres estiment." / "Réponse sous 4 heures ouvrées." / "58 wilayas, un seul interlocuteur." Never a benefit statement, never a two-clause turn — this world has no editorial flourish.
- THE SUBSTITUTION TEST, applied to every sentence before it ships: if the sentence survives swapping the company name for a competitor's, delete it. It is filler wearing a serious face, and filler is fatal in a world whose entire promise is rigour.
- EVERY CLAIM CARRIES ITS UNIT AND ITS SCOPE: not "livraison rapide" but "14 jours ouvrés, ± 2 j, hors zones sud." Not "grande couverture" but "58 wilayas, 12 depuis 2011." A qualified number reads as competence; an unqualified one reads as marketing.
- SUB-COPY is two or three concrete sentences, 34em maximum, ending in a full stop. No sentence begins with "Nous sommes" or "Notre équipe".
- LABELS READ LIKE FIELD NAMES, always mono, always uppercase in Latin: PORTÉE / DÉLAI / COUVERTURE / RÉVISION / TOLÉRANCE / ÉCHELLE. A label is a field name, never a headline in disguise.
- SYSTEM MESSAGES ARE PLAIN AND UNAPOLOGETIC, one sentence, stating the fact and the fix: "Numéro à 10 chiffres, commençant par 05, 06 ou 07." / "Sélectionnez une wilaya pour calculer le délai." Never an apology, never an exclamation mark, never a red paragraph.
- Nothing is exclamatory. Banned words: solutions, innovant, révolutionnaire, passionné, expérience unique, sur-mesure (as self-description), leader, and their English and Arabic equivalents.
- Write in the brief's language. Every figure that appears in copy must also exist in the brief; the substitution test and the honesty rule below are the two things this world will not bend on.

## The single idea — THE ANNOTATION LAYER (build this FIRST)
The signature is DIMENSION ANNOTATION: hairline callouts with arrowheads and mono labels drawn over REAL page elements — an arrow spanning the hero headline's exact width, a bracket embracing a stat block, a leader from a note to a photograph's corner. They are bound to elements that exist, and they survive a resize.
- MARKUP: data-dim on the target, plus data-dim-kind (width, height, bracket, leader), data-dim-label, data-dim-side (top, bottom, start, end), data-dim-gap (px, default 26). OVERLAY: one svg per annotated section — absolute, inset 0, 100% by 100%, overflow visible, pointer-events none, aria-hidden true, z-index 4; the section is position relative.
- MEASURE after window load (fonts settled), then in a ResizeObserver plus a 120ms-debounced resize: getBoundingClientRect on the target minus the section's rect gives local coordinates, written into path elements. Never hard-code coordinates.
- WIDTH CALLOUT: two 1px extension lines from 6px inside the target's edges to 12px past the dimension line; the dimension line between them at the requested gap; arrowheads as filled triangles 7px by 5px pointing OUTWARD (the engineering convention). The label sits centred on the line in mono .6875rem uppercase .12em with 8px of ground-coloured padding each side, so the rule passes BEHIND the text.
- BRACKET: three segments (8px return, span, 8px return) at 1px, label at the midpoint on a 12px leader. LEADER: a 45-degree diagonal to a landing point, then a 16px shoulder ending in a 3px filled dot ON the target's corner.
- STROKE: 1px, vector-effect non-scaling-stroke, accent at .55, linecap butt (never round); arrowheads and dots filled accent at .85.
- BUDGET: 4 minimum, 7 maximum, never two in one viewport. A scalpel, not a texture. Below 720px draw only 2 — the hero measure and one bracket.
- HONESTY RULE, absolute: a callout states a fact the brief supplied with its unit (58 WILAYAS, 14 JOURS, 2011) or a true measurement of the page itself (38 EM, COL 1-8, GRID 24 PX, 1:1). It NEVER invents a business figure. When the brief is thin, annotate the page, not the business.
- FALLBACK CONTRACT: annotations are pure enhancement. If JS or the CDN fails, or motion is reduced, the svg is never populated and nothing else changes — no layout depends on it.

## Visual signatures (what makes it instantly recognizable)
- FAINT GRAPH PAPER under the whole page — 24px cell, a heavier line every 5 cells, ink at 3-6% alpha. Present everywhere, legible nowhere.
- Hairline DIMENSION CALLOUTS measuring real elements, with arrowheads and mono labels.
- A mono utility face doing all labels, data, captions and buttons against a grotesk that never exceeds weight 430.
- ZERO shadows, blur or gradients; radius capped at 2px — every separation is a 1px rule.
- Tables that look like tables, and bento cells that SHARE hairline borders instead of floating with gaps — a drawn sheet, not a card deck.
- Enormous tabular numbers with small mono units beside them, counting up once.
- One inline-SVG schematic of the real process, drawn stroke by stroke as you scroll, pinned.
- Exactly ONE inverted section: the DARK CHAMBER, where paper becomes ink and the grid inverts with it.
- A footer that is a real TITLE BLOCK: a ruled table of facts, the wordmark, and a callout measuring the wordmark.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — PAPER→--background · INK→--foreground · ACCENT→--primary · PAPER→--primary-foreground · CHAMBER ground→--secondary · ERROR→--accent · ink at 56%→--muted · ink at 18%→--border · 2px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, grid or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
Nine tonal roles from the fixed tokens, never a tenth hue.
- PAPER: the palette's light pole, warm-neutral off-white in the #F6F4EF / #F2F1EC register. Never #FFF, never a cool #FAFAFA. If the brief's poles are inverted, swap PAPER and INK wholesale — identical physics, and the DARK CHAMBER becomes a LIGHT CHAMBER.
- INK: the dark pole, near-black with a faintly COOL cast, B sitting 2-6 points above R (the #14171C relationship). Engineering ink is cooler than editorial ink. Never #000, never #333.
- THE INK ALPHA LADDER — what makes the page read as drawn rather than as UI: display 1 · body .78 · secondary and captions .56 · disabled .38 · structural hairlines .18 · table rows .10 · grid majors .055 · grid minors .032. No independent gray hex exists here.
- ACCENT: exactly ONE signal hue, saturated and unmixed — no lighter sibling, no darker sibling, no accent gradient; its hover state is the same hue at 88% alpha, or the ink. ACCENT-WASH (accent at .06) has two uses only: the hovered table row and the selected radio cell.
- CHAMBER tokens for the single inverted section: ground the ink pole; text the paper pole at .92 (white is never used for text anywhere); hairlines paper .16; grid paper .05 major and .028 minor.
- ERROR: one desaturated signal red in the #B0402E register, only in validation text and the invalid input border. The only hue outside the accent.

THE ACCENT'S TWELVE JOBS — use at least eight and count them: annotation strokes and arrowheads · the schematic's active path · section index numerals · the unit beside a benchmark figure · the progress rail · the ONE filled button · the focus ring · ::selection · the sticky-split tick · the table's active-row edge · the trust icons' stroke · the origin crosshair. Coverage stays near 3% of painted area; if the accent is on three things in one viewport, remove one. Declare color-scheme light (dark for an inverted brief) and a theme-color meta matching PAPER.

## The graph paper (exact recipe — the world's ground)
- One div, class sheet-grid: fixed, inset 0, pointer-events none, z-index 0. Body background PAPER; every section position relative, z-index 1, background transparent, so the page reads as lying on a drafting table.
- background-image: four linear-gradients — to right and to bottom at rgba(ink,.055) for majors, to right and to bottom at rgba(ink,.032) for minors, each a hard stop (colour 0 to 1px, transparent 1px to 100%). background-size 120px 120px and 24px 24px, background-position 0 0, so majors land on every fifth minor.
- Below 640px raise the minor cell to 32px and drop the majors — a 24px grid on a 390px screen is noise.
- The DARK CHAMBER paints its OWN grid on a ::before with the chamber alphas over an opaque ground, occluding the fixed layer. The only second grid on the page.
- ORIGIN CROSSHAIR: top inline-start margin, 22px under the bar, a 14px cross of two 1px accent rules plus a mono 0,0 at .625rem, ink .5. Hidden below 900px; in RTL it moves to the inline-end.

## Typography system
TWO families, two non-overlapping jobs. A third is forbidden.
- DISPLAY / TEXT: a neutral-to-technical grotesk with a large x-height and tight caps — the Suisse Intl, Neue Haas Grotesk, Söhne, Archivo or Geist territory, at 300, 400 and 430-500 only. NOTHING exceeds 500 and display never exceeds 430; a bold headline converts this world into a corporate template.
- MONO UTILITY: a drafting-grade monospace — the JetBrains Mono, IBM Plex Mono, Space Mono or Geist Mono territory — at 400 and 500 only, carrying every label, caption, figure number, unit, table header, button label, form label and annotation, never prose longer than one line. The global display-font ban holds; a mono is a utility face, so it is legal.

THE SCALE (all clamp, ratio near 10:1, deliberately thin in the middle): h1 clamp(2.7rem,6.2vw,5.4rem) / 380 / 1.02 / -.022em / 15em with AUTHORED breaks · h2 clamp(1.9rem,3.6vw,3rem) / 400 / 1.08 / -.015em / 17em · h3 clamp(1.1rem,1.6vw,1.4rem) / 450 / 1.25 / -.005em · lede clamp(1.0625rem,1.3vw,1.2rem) / 1.55 / ink .78 / 34em · body 1.0625rem / 1.62 / 32em · MONO LABEL .6875rem uppercase .13em / 500 / ink .56, the most repeated object on the page · MONO DATA .8125rem / tabular-nums / ink .78 · BENCHMARK FIGURE clamp(3.4rem,7.4vw,7rem) / 300 / .92 / -.03em / tabular-nums · footer wordmark clamp(3rem,12vw,9rem) / 300 / .9 / -.025em.

TRACKING IS A FUNCTION OF SIZE — the difference between a drawing and a slide deck: -.03em above 90px, -.022em at 55-90px, -.015em at 30-54px, -.005em at 18-29px, 0 at body, +.13em on mono labels, +.2em on the two or three widest micro-labels. Line-height: .92 figures, 1.02-1.08 display, 1.25 subheads, 1.62 body, 1.4 mono rows.

MANDATORY: no display headline auto-wraps — break every h1 and h2 into explicit line spans and reuse them as motion targets · text-wrap balance on headings, pretty on body · tabular-nums on every number in a column, counter, price or table · ONE word per headline may take the accent, colour only, in at most two headlines page-wide · mono labels sit ABOVE their content with 10px of space · NOTHING is centred except a dimension label and the revision strip.

## The number system (numbers are the heroes)
Numbers are this world's photography: where another world places an image, Précis places a figure.
- A BENCHMARK FIGURE is three parts: the numeral at benchmark size in weight 300 with tabular-nums; a UNIT in mono at .28em of the numeral, uppercase, ink .56, on the baseline with an 8px gap (percent and currency identical); a mono LABEL above at .6875rem .13em. Optional fourth: a TOLERANCE at .6875rem ink .38 stating a real variance (± 2 J), only when the brief supplies it.
- Thousands use a THIN SPACE (U+2009), never a comma, never a period: 12 400 · 58 000 · 1 250 000. Correct French typography and correct for DZD.
- Counters animate ONCE via a proxy object, re-formatted with the thin space on every update, plus a 4000ms setTimeout painting the final value if the trigger never fires on a deep-linked load.
- FIGURE ROWS: 3 or 4 benchmarks in a ruled row with 1px vertical hairlines between cells (border-inline-start on every cell after the first, gap 0), padding-inline 28px. Never a card grid.
- INLINE MICRO-DATA: every real number inside body copy wrapped in a span switching to mono at .92em, tabular-nums, ink 1, so a paragraph visibly carries data.
- SPARK RULES instead of charts: a 1px accent polyline in a 120x28 inline SVG, no axes, no fill, no labels; no real series means no line. Never round a number the brief gave you.

## Page chassis
- THE TITLE BLOCK BAR replaces the nav: fixed, top 0, height 56px desktop and 52px mobile, z-index 50, transparent over the hero, border-bottom 1px ink .14, DIVIDED INTO CELLS by vertical hairlines like a drawing sheet's title block — each cell padding-inline 20px, border-inline-start 1px ink .12, full height. Cell 1: the wordmark in display 430 at 1.05rem over a mono sub-label at .625rem .18em ink .5 (discipline, city or founding year — a real fact). Cell 2, flexible: the CURRENT SECTION INDICATOR in mono .6875rem .2em, written by per-section ScrollTrigger onEnter and onEnterBack, reading 03 / MÉTHODE, swapping old label to autoAlpha 0 at y -6 over .18s then the new one in from y 6 over .22s (no scramble, no typewriter), hidden below 900px. Middle cells: links in mono .6875rem .13em, ink .56 to 1 over .2s. End cell: the accent action — a squared button at border-radius var(--radius), accent fill, paper text, mono .6875rem .12em, padding 11px 18px.
- SCROLL STATE: past 24px the bar goes fully OPAQUE PAPER with border-bottom ink .2. No blur, no translucency, no shadow — this world overrides the fashionable glass nav, because glass has no place on a drawing sheet.
- PROGRESS RAIL: a 1px accent rule on the bar's bottom border, scaleX 0 to 1, origin left (right in RTL), scrubbed against document progress with ease none — the only animated element in the chassis.
- MOBILE MENU: the links collapse into one cell holding a mono MENU and a 12px plus of two 1px rules. The overlay is a full-screen PAPER SHEET with its own 32px grid, opening clip-path inset(0 0 100% 0) to inset(0) over .5s power3.inOut, holding a ruled ledger of 64px rows — mono index, link in display 400 at 1.6rem, mono target label on the end side, border-bottom 1px ink .12.
- BASE: overflow-x clip on html and body · ::selection accent with paper text · :focus-visible outline 1px accent at offset 3px, radius min(var(--radius), 0px) · a skip link sliding from top -3rem to 12px · scroll-margin-top 80px on anchored sections.

## Hero forms (pick what the business calls for — never a centred headline over two buttons)
1. THE SHEET HEAD (default). Full width, min-height calc(100svh - 56px), on the real 12-column grid, content anchored to the BOTTOM THIRD (align-content end) with 120px of graph paper above it — the emptiness is the point and the grid keeps it from reading as a mistake. The h1 spans columns 1-8 in 2 or 3 authored lines, and THE SIGNATURE ANNOTATION LIVES HERE: a width callout 26px above its first line, spanning the exact rendered width. Below, a lede at columns 1-6 and a RULED FACT ROW across columns 1-12 — four cells divided by vertical hairlines, each a mono label plus a value (founded, coverage, response time, speciality). Columns 9-12 carry three right-aligned mono data rows at border-bottom 1px ink .12. NO photograph is required; a strong one takes columns 9-12 in a hairline frame with corner ticks and a mono FIG. 01 caption.
2. THE SCHEMATIC OPEN (tech, logistics, fintech). A 78vh statement — h1 at columns 1-7, one lede, one text link — sitting on top of the showpiece diagram, whose first two paths are already drawn at rest and whose remainder draws as the visitor scrolls. The hero does not end; it becomes the diagram.
3. THE DATASHEET (finance, insurance, consulting with real numbers). A two-column ruled table IS the hero: a claim in display 380 across three authored lines on the start side; four benchmark figures in ruled rows on the end side, each with unit, label and tolerance. A bracket annotation embraces the stack, labelled with the real source period (EXERCICE 2024). No image at all.

In every form the hero terminates on a LEDGER CUT, never in whitespace, and carries at most ONE button (the bar already holds the action); a second action is a mono text link with a leading drawn arrow.

## Section seams (this world's own vocabulary — every boundary uses one, never the same twice in a row; at least five per page)
- LEDGER CUT (the default): a double hairline — border-top 1px ink .2 plus a ::before at top 3px, height 1px, full width, ink .09. Two rules 3px apart read as a ruled ledger break.
- DATUM LINE: a full-bleed 1px rule at ink .18 with a mono label astride it — on the rule, 12px of paper padding each side, at 24% of the width, never centred — plus 6px ticks descending at 8% and 92%. Opens a chapter with no heading.
- REVISION STRIP: a 36px full-bleed band, border-block 1px ink .16, holding 4 to 6 mono micro-cells divided by vertical hairlines, real facts only (RÉV. 04 · MAJ 2026 · ÉCH. 1:1 · 58 WILAYAS). Static — this world never scrolls text.
- GRID SHIFT: the seam where the graph paper changes density (24px to 8px, majors dropped) for exactly one section, announced by a single hairline.
- CHAMBER DROP: the ground inverts into the DARK CHAMBER on a HARD edge — no gradient, no fade. Paper stops on a 1px accent rule and ink begins. Exactly ONE chamber per page, holding the most important argument (the method, the guarantee, the flagship case).
- CALLOUT BRIDGE: an annotation leader starting in one section and landing on an element in the NEXT; overflow visible on both, z-index 5. Once per page maximum.
- BLEED PLATE: the one full-bleed image or diagram, top and bottom hairlines, no radius, no scrim, with a mono caption row beneath (figure number start side, description end side).

## Layout physics
- THE GRID IS REAL AND IT IS THE GRAPH PAPER'S: 12 columns, column-gap 24px (one cell), padding-inline clamp(20px,3.6vw,56px), max-width 1440px. Every block declares its span; nothing sits 3px off.
- ALL VERTICAL SPACING IS A MULTIPLE OF 24: only 12 (inside components), 24, 48, 72, 96, 120, 168. Section block-padding clamp(72px,9vh,144px), both ends on the ladder. The mobile minimum is 72px — this world overrides the global 48px floor.
- NO 50/50 GRID EVER: 8/4, 7/5, 5/7, 4/8, and .78fr / 1.22fr for the sticky split. At least one grid must invert expectation — the heading column narrower than the list it introduces.
- THE BENTO WITH ONE OVERSIZED CELL: a 12-column grid at gap 0 whose cells SHARE HAIRLINES — each cell border-inline-start and border-block-start 1px ink .14, the grid border-inline-end and border-block-end — so it reads as one drawn table, not floating cards. ONE cell is oversized at span 7 by 2 rows, holding the showpiece figure or a diagram; the rest span 3 to 5 columns with a mono label, a title and two lines. Cell padding clamp(24px,2.6vw,40px); no background, radius or shadow. On hover a cell's border-inline-start and mono index turn accent over .22s; nothing lifts or scales. Below 900px one column, oversized first. THIS OVERRIDES the global gap rule: the shared border IS the gap.
- STICKY SPLIT PROCESS: .78fr / 1.22fr. The start column is sticky at top 80px with the section head, a lede and a live STEP COUNTER (mono, 02 / 05, tabular). The end column stacks numbered ruled rows: border-top 1px ink .14, padding-block 40px, grid auto / 1fr with the index in the gutter. As a row crosses 55% of the viewport its index turns accent and a 2px accent tick appears on its inline-start edge (scaleY 0 to 1 over .3s, origin top) while the counter updates. Below 900px sticky goes static, ticks remain.
- RULED LEDGER TABLES for anything comparative — pricing, coverage, delivery, tiers. A real table, border-collapse collapse. th: mono .6875rem .13em, ink .56, text-align start, padding-block 14px, border-bottom 1px ink .26. td: .9375rem, tabular-nums, padding-block 18px, border-bottom 1px ink .1. Row hover: accent-wash plus a 2px accent inline-start edge. Below 720px an overflow-x auto wrapper with a mono hint — no gradient fade masks here.
- IMAGES ARE PLATES WITH TICKS: a 1px ink .18 frame at radius min(var(--radius), 0px), aspect-ratio 3/2 or 4/5, object-fit cover, and FOUR CORNER TICKS — 8px L-shaped pairs of 1px accent rules at -1px outside each corner. Beneath, a caption row with border-top 1px ink .12: mono figure number start side, description end side. No visible radius, no shadow, no scrim.
- OVERFLOW IS ONLY FOR ANNOTATIONS: only a callout, a bracket and the footer wordmark may break their container. BELOW 900px every multi-column grid becomes 1fr, sticky goes static, the fact row becomes a 2x2 ruled grid, figures drop one size step, the annotation budget falls to 2.

## Drawn matter (diagram-as-art — the showpiece)
Every page contains ONE scroll-scrubbed inline SVG schematic, and it is what people remember. It diagrams something TRUE: first call to delivery, the architecture of the service, a route across wilayas, the stages of a case. Never abstract decoration.
- THE SVG: viewBox 0 0 1200 680, width 100%, height auto, overflow visible, aria-hidden true — with the same process written out in a visually-hidden paragraph, because a picture of information must also exist as text.
- CONSTRUCTION: 5 to 8 PATHS at 1.25px, ink .5, linecap butt, linejoin miter; 4 to 6 NODES (14px squares or r7 circles) at 1.25px with paper fill; 4 to 6 LABELS in mono 11px .12em ink .56 with 6px of paper-filled backing where a line passes behind. Corners are SQUARE or a single 45-degree diagonal — never a bezier. This world has no curves.
- DRAW IT: every path gets pathLength 1, stroke-dasharray 1, stroke-dashoffset 1; a GSAP timeline tweens each to 0 over one unit with ease none, nodes popping from scale .6 / autoAlpha 0 as their incoming path completes (transform-box fill-box, origin center), labels fading in .15 later over .3.
- SCRUB IT: ScrollTrigger on the wrapper, start "top top+=80", end "+=180%", pin true, anticipatePin 1, scrub 1.1, invalidateOnRefresh true — pin the wrapper, not the SVG. The drawing path takes accent at 1.5px; completed paths settle back to ink .5 at 1.25px over .4s. Pinned alongside: a mono STEP READOUT (01 / 05 plus one line) swapping as each path completes, and a LEGEND of three ruled rows, each a 22px specimen rule plus a mono label.
- MOBILE AND FALLBACK CONTRACT: pin and scrub live inside gsap.matchMedia("(min-width: 900px)") only; below 900px the timeline plays once over 1.8s at "top 78%". The CSS default shows the diagram FULLY DRAWN (dashoffset 0 in CSS; JS sets it to 1 only inside the animate branch), so a visitor with JS off still sees a finished drawing.
- NO CANVAS in this world — SVG and CSS only, because a drawing must stay crisp at any zoom and survive with JS off. Secondary drawn matter (brackets grouping a list, a 1px arrow between ruled rows, a spark rule, the trust icons) shares 1.25px, butt caps, miter joins and a 24-unit viewBox, so it reads as one drawn set.

## Motion identity (GSAP 3 + ScrollTrigger via CDN; Lenis optional and gated)
THE SAFETY CONTRACT COMES FIRST. Compute once: reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; hasGsap = typeof window.gsap !== "undefined"; animate = hasGsap && !reduced. EVERY hidden initial state is set with gsap.set INSIDE the animate branch — nothing is opacity 0, visibility hidden or clipped in CSS. If the CDN fails, the page is complete, drawn and readable. The reduced-motion CSS block, beyond the .01ms blanket, removes the rail's transform and leaves the schematic fully drawn.

GLOBAL FEEL: gsap.defaults({ ease: "power3.out", duration: .8 }). Reveals live in 0.6-1.0s, data and drawing in 1.2-1.6s. THIS WORLD HAS NO BOUNCE: back, elastic and bounce eases are banned outright, as is any overshoot, yoyo or infinite loop. ONE shared CSS easing token, cubic-bezier(.2,.6,.2,1), on every transition; GSAP uses power3.out for entrances, power2.out for counters, power3.inOut for wipes and the menu, none for scrubs. TRAVEL IS TINY: y of 10, 14 and 22 only; x of 12 for mono labels arriving along a rule; scales of .96, .98, 1, and .6-to-1 on diagram nodes.

THE ENTRANCE VOCABULARY IS DRAW, NOT FADE-UP — four verbs, and every reveal uses one. RULE DRAW: any hairline arrives scaleX 0 to 1 from the inline-start over .7s power3.out. WIPE: images, bento cells and chamber contents arrive clip-path inset(0 100% 0 0) to inset(0) over .9s power3.inOut at "top 86%", once, the inner image counter-translating x 14 to 0 over 1.1s so the wipe carries parallax. LINE RISE: headings rise from y 22 with autoAlpha over .85s, stagger .07, out of the authored line spans at "top 84%"; mono labels from y 10 at stagger .04. STROKE DRAW: every SVG path draws via stroke-dashoffset.

THE MANDATORY SET:
- HERO at load, no preloader: fact-row dividers RULE-DRAW at .1, the h1 LINE RISEs at .2, the lede at .55, the data rows at .7 stagger .06, THE ANNOTATION last at 1.15 (path .7s power2.out, label autoAlpha .35s at +=.2). About 2.1s — the annotation arriving last is what makes visitors realise the page is measuring itself.
- ANNOTATIONS elsewhere: own trigger at "top 76%", once, paths at stagger .12 then the label; never two at once.
- COUNTERS: proxy tween 1.6s power2.out, thin-space formatting, "top 88%", once, plus the 4000ms fallback.
- THE PINNED SCHEMATIC — the page's ONLY pin and its only scrub besides the progress rail.
- STICKY SPLIT: per-row triggers toggling the accent tick and index, counter updated in onEnter and onEnterBack.
- CHAMBER ENTRY at 65% of the viewport: content WIPEs in, its accent rule draws from the inline-start; the ground never fades.
- once true on everything non-scrubbed; nothing re-animates on scroll-up.

MICRO-INTERACTIONS (all CSS, .18-.3s, on the shared token): the primary button goes accent to ink with no lift and no scale; text links draw a 1px accent underline from the inline-start via background-size 0% 1px to 100% 1px.

LENIS IS OPTIONAL AND GATED: duration 1.05, exponential-out easing, disabled when reduced is true or on touch; wire lenis.on("scroll", ScrollTrigger.update), drive lenis.raf from gsap.ticker, lagSmoothing 0. If it fails to load, native scroll continues.

## Components
- BUTTONS: border-radius: var(--radius) (:root sets --radius: 2px), two variants. PRIMARY — accent fill, paper text, mono .6875rem .12em uppercase weight 500, padding 14px 22px, min-height 48px on mobile. SECONDARY — transparent, 1px ink border, ink text, same metrics. A third form is a mono TEXT LINK with a leading 10px drawn SVG arrow (never an icon-font character) translating x 4px on hover. No pills, no full-width solid rectangles except the mobile sticky action, no icon-only buttons.
- INPUTS: height 52px, radius min(var(--radius), 2px), background ink .02, border 1px ink .18, padding-inline 14px, 1rem. Label ABOVE in mono .6875rem .13em ink .56 with 8px below; hint beneath in mono .6875rem ink .38. Focus sets border-color accent AND box-shadow 0 0 0 1px accent (a doubled rule, never a glow) while the label turns accent in the same beat. Invalid: error border and message at .8125rem with min-height 1.2em reserved so nothing reflows. Selects match exactly, with a 10px chevron of two 1px rules instead of the native arrow.
- ACCORDION: ruled rows like the ledger table, question in display 450 at 1.15rem, the plus drawn from two 1px rules whose vertical stroke scaleY 1 to 0 over .3s, single-open, aria-expanded maintained, panels with role region and aria-labelledby.
- FOOTER — THE TITLE BLOCK, required. A ruled full-width table of 5 or 6 cells divided by vertical hairlines, each a mono label with a real value: company, city, founding year, phone, hours, the page's revision date. Beneath it the WORDMARK at clamp(3rem,12vw,9rem) weight 300, -.025em, and THE PAGE'S LAST GESTURE — a width callout measuring the wordmark, labelled with the founding year or the coverage. Then a hairline row with the legal line in mono .625rem ink .38.
- CRAFT: width and height on every image · fetchpriority high on the LCP element, lazy elsewhere · descriptive alt, aria-hidden on drawn ornaments · aria-live polite on validation text · an inline-SVG data-URI favicon built from the origin crosshair · a theme-color meta matching PAPER.

## Conversion instruments (the Algeria layer — quiet does not mean passive)
- THE CONTACT INSTRUMENT is a ruled block, not a card: border-block 1px ink .2, grid 5/7 — the start column the section head plus three mono data rows (phone, hours, city), the end column the form. Field order is PHONE FIRST, then name, then wilaya (a select of the real 58), then the request (a select of the merchant's real services), then optional notes. Phone is type tel with inputmode tel and a local hint (05 / 06 / 07). No account, no password. An email field is permitted ONLY for genuinely B2B businesses, never first and never required; a page selling a product to a consumer keeps the global no-email rule.
- VALIDATION IS BLUR-GATED: an error appears only after a field's first blur, never while someone is typing — one plain sentence in the page's language, in the error hue, space reserved.
- SUBMIT has a deliberate 700ms pending state (the mono label becomes a present-tense sentence), then cross-fades in place into a success panel in the same box over .55s: a mono confirmation number, the visitor's wilaya echoed back, the next step stated as fact — only if the brief promised it. At the instant validation passes — as the panel cross-fades in — the page files the record by dispatching the wandit:lead CustomEvent on document with the visitor's fields flat in detail (name, phone as typed, wilaya, commune, plus the request), and the instrument carries one off-canvas decoy input marked data-wandit-hp that the page's own script never reads.
- STICKY MOBILE BAR (below 900px, after the hero, translateY 100% to 0 over .45s power3.out, no bounce): height 60px plus env(safe-area-inset-bottom), paper background, border-top a LEDGER CUT, split by ONE vertical hairline into two cells — a mono label above a figure (price, response time or phone) on the start side, the accent squared action at full cell height on the end side. It hides (autoAlpha 0 over .3s) while the contact instrument is in view.
- PRICE TYPOGRAPHY when the page sells: display 300 at clamp(2rem,3.8vw,3rem), tabular-nums, thousands in a THIN SPACE, the currency in mono at .34em uppercase ink .56 on the baseline 8px after the numeral — 12 900 DZD / 12 900 دج. A struck previous price beneath at .9375rem ink .56, text-decoration-color accent at 1px. Delivery fee and time sit in a ruled two-cell row beside the action, never buried in an FAQ.
- WHATSAPP CTA STYLED TO THIS WORLD — never green, never a floating round bubble: a ruled cell with a 1px ink border holding a 20px inline-SVG WhatsApp glyph drawn STROKE ONLY at 1.25px in the accent, plus a mono label; on hover the cell fills ink and the glyph turns paper over .22s, with a mono line beneath stating the real hours. On mobile it may take the sticky bar's secondary cell.
- TRUST STRIP WITH DRAWN SVG ICONS: a full-width ruled row of 4 cells divided by vertical hairlines, gap 0, padding 24px, each a 22px inline SVG plus a mono .6875rem .12em label and one line of ink .56 detail. Icons are STROKE-ONLY primitives on a shared 24-unit viewBox at 1.25px, butt caps, miter joins — a square with a diagonal, a circle with a radius line, two nested squares, an arrow crossing a rule. Labels state only what the brief promised.
- DRAWN SVG IS NARROWED, NOT WIDENED, HERE: global permits drawn inline-SVG art broadly; this world admits exactly three drawn registers — schematic line work, dimension callouts, and the four-icon stroke set — all sharing 1.25px, butt caps, miter joins and a 24-unit viewBox. Illustration, duotone SVG art, mascots, doodles and any drawn LOGO are banned, because a drawing sheet has no decoration on it.

## Arabic and RTL adaptation
- html dir rtl lang ar, and the layout genuinely mirrors: padding-inline, margin-inline, border-inline-start and end, inset-inline everywhere. No physical left or right properties anywhere in the stylesheet.
- The graph paper is symmetric and unchanged. The ORIGIN CROSSHAIR moves to the top inline-end; the progress rail's origin becomes right; RULE DRAW origins become inline-end; the link underline grows from bottom right. Dimension callouts mirror as geometry (only the side tokens flip); labels read right-to-left and arrowheads still point outward.
- NEVER letter-space Arabic — tracking breaks the joins. The mono label's role is carried by the Arabic body family at weight 500, .8125rem, tracking 0, ink .56, preceded by an 18px 1px accent rule with 10px of space; Arabic has no uppercase, so the rule plus weight IS the label signal.
- Keep the mono face for Latin numerals, units, figure numbers, revision codes and table data, so the data texture survives. Choose ONE numeral system (Western or Eastern Arabic) and use it everywhere, including inside annotations.
- Arabic body: line-height 1.85, size +1px, every measure cap loosened by 2em, Arabic-capable families only — the IBM Plex Sans Arabic, Almarai, Rubik or Cairo territory; the 430 display ceiling holds. Author the schematic to flow RIGHT to LEFT rather than mirroring it with scaleX, which would reverse the labels. French runs about 15% longer than English: drop the body cap to 30em and allow one more headline line.

## Annotation furniture (REQUIRED — the world's voice)
- SHEET HEADS instead of centred H2s: a baseline-aligned flex row — mono index 01, a 24px 1px accent rule, a mono section label at .6875rem .2em, a flex-1 hairline at ink .16, a right-aligned mono aside, gap 16px. The flex rule IS the border.
- FIGURE NUMBERS on every image, diagram and table: FIG. 03 — Flux de commande, 58 wilayas. Sequential, never repeated.
- UNITS ON EVERYTHING measurable, in mono at .72em and ink .5: j, h, %, km, DZD, wilayas. A number without a unit looks unfinished here.
- THE REVISION BLOCK in the footer's title block (RÉV. · MAJ · ÉCH. · FEUILLE), the LEGEND beside the schematic, and TOLERANCES where true: ± 2 J under a delivery figure, MIN. 3 under a team size.
- All of this is TYPESETTING, not invention. Every value comes from the brief; where the brief is silent the furniture measures the page or is omitted. Fabricating one figure to fill a callout is the single unforgivable failure in this world.

## Explicit overrides of the global builder rules
1. Global: gap between every row of siblings. HERE: the bento, fact row, trust strip, title block and ledger tables use gap 0 with SHARED HAIRLINES; gaps apply everywhere else.
2. Global: drawn inline-SVG art is broadly encouraged (duotone illustration, pattern accents, line icons). HERE it NARROWS to three registers — schematic line work, dimension callouts and the four-icon stroke set, on one shared stroke spec — and illustration, mascots and drawn logos are banned outright.
3. Global: the blurred translucent sticky nav. HERE: backdrop-filter is banned outright; the bar goes fully opaque with a hairline.
4. Global: mobile section padding at least 48px. HERE: at least 72px, snapped to the 24px ladder.
5. Global: Arabic-first for mass-market COD. HERE: these businesses are usually French-first B2B, so the brief decides; both are specified above.
6. Global: rounded cards and 12-16px radii. HERE: radius capped at 2px page-wide, shadows banned entirely.

## Précis ban list (in addition to the global one)
Box-shadow of any kind · backdrop-filter, glass, translucency · border-radius above 2px · gradients as fills, scrims or masks · any weight above 500, display above 430 · italic type · serif type · centred heroes, section heads or body copy · icon-and-two-lines card grids · pills and full-width solid buttons (except the mobile sticky action) · bounce, elastic and back eases, and any overshoot · infinite loops, marquees, tickers, countdown timers · more than ONE accent hue · more than ONE dark chamber · more than ONE pin, and more than TWO scrubs (the pinned schematic and the progress rail — nothing else on the page may scrub) · canvas · bezier flow lines in the schematic · parallaxed hero photography as the page's identity · emoji and icon fonts · a floating round WhatsApp bubble · fake measurements, invented benchmarks, or a callout pointing at something that is not really there · a schematic that diagrams nothing real · a page carrying fewer than four real numbers.

## Intensity
This world fails by softening: every wrong decision is a comfortable default — a 12px radius instead of 2, a shadow instead of a hairline, a bold headline instead of 380, a fade-up instead of a rule draw, a card grid instead of a shared-border bento, an adjective instead of a number. At 60% it is a gray corporate template with a faint texture behind it, which is worse than nothing: it promises rigour and delivers wallpaper. At 100% — graph paper you have to hunt for, one accent doing eight jobs, a headline measured by its own callout, five ruled seams, a process drawn line by line as you scroll, a title-block footer signing the sheet — it looks like a page made by people who measure things for a living, which is exactly what its visitors are buying. Push INTO the precision. Every number above is load-bearing.`,
	energy: "quiet",
	family: "precis",
	id: "precis",
	industries: [
		"tech",
		"saas",
		"startup",
		"consulting",
		"finance",
		"law",
		"insurance",
		"accounting",
		"agency",
		"engineering",
		"logistics",
		"education",
		"medical",
		"services",
	],
	kind: "website",
	mood: ["precise", "technical", "rigorous", "authoritative", "calm"],
	name: "Précis",
	preview: {
		ground: "#F6F4EF",
		ink: "#14171C",
		accent: "#B0402E",
		fontFamily: "Archivo",
		sampleWord: "Précis",
	},
	priceFeel: "premium",
	tagline:
		"A technical drawing that sells: faint graph paper, one signal colour, enormous exact numbers, and hairline callouts that measure your own headline like a draughtsman — the page of a firm where nothing is approximate.",
};
