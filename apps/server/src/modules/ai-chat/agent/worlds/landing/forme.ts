import type { DesignWorld } from "../types";

/**
 * FORME — the black-and-red conditioning box.
 * Popular wave III. Values measured on the shipped demo (FORME/45, Hydra, Alger):
 * worlds/forme/demo/index.html + demo/shots.
 * fusesWith: maillot (the varsity club energy under FORME's chrono discipline),
 * allure (the dark spec-sheet showroom — shares the near-black ground, never the gauges).
 */
export const forme: DesignWorld = {
	id: "forme",
	name: "Forme",
	family: "fitness-impact",
	tagline:
		"Le noir et le rouge : un chrono, des blocs d'effort, des compteurs qui roulent.",
	kind: "website",
	mood: ["hard", "timed", "gritty", "disciplined"],
	energy: "loud",
	priceFeel: "premium",
	industries: [
		"gym / fitness club",
		"crossfit / functional",
		"personal trainer / coach",
		"martial arts / combat sports",
		"sports club / academy",
	],
	avoidFor: [
		"wedding services",
		"event planner",
		"aesthetic clinic",
		"spa / hammam",
		"jewelry brand",
		"notary",
		"lawyer / law firm",
		"kindergarten / crèche",
	],
	fusesWith: ["maillot", "allure"],
	preview: {
		ground: "#101010",
		ink: "#F2F2F0",
		accent: "#E63329",
		fontFamily: "Oswald",
		sampleWord: "FORME/45",
	},
	doc: `# DESIGN WORLD: FORME — the black-and-red conditioning box

## Philosophy
This page is a TIMED SESSION, not a website: it starts at 00:00, ends at 45:00, and the visitor scrolling it is doing the workout. FIRST: the page runs on a clock — a 3px chrono rule under the header fills red across the whole scroll, a tabular readout counting up beside it; the clock is furniture, not decoration. SECOND: the page has a TEMPO — two or three fast, dense, hard-cut sections, ONE slow wide breather at double weight, then fast again. THIRD: every claim is a countable number on rolling wheels — 2 400 séances, 620 kcal, 4,2 tonnes. Adjectives are what the competition sells.

The look is a conditioning box at six in the morning: near-black concrete, one signal red, condensed capitals, chalk dust in hard light. Nothing is soft: no rounded cards, no glow, no shadow, no gradient outside the grade. Impossible failure modes: a page that could pass for a spa; promises that are adjectives; red used as a background instead of a rationed signal.

Self-audit, all countable: (1) ONE red word per headline; (2) one odometer AND the interval strip fully visible in the first viewport AT 390 AS WELL AS AT 1440 — never scope this to desktop; (3) exactly ONE FULL interval bar, the scrubbed showpiece, plus its compact hero strip — never two full bars, and the two never share block heights; (4) zero border-radius above 2px, inputs included, and at most ONE full-red panel; (5) the duotone grade on every photograph; (6) every counted claim matches what the page shows — list all six coachs or print the remainder under the four-row table ("+ 2 — deux en rotation").

## The variation contract (why two FORME sites are siblings, not clones)
WORLD LAW — never renegotiated by brief or builder:
- Near-black ground, one signal red, rationed: never a large fill except the interval blocks, the primary button, the single red panel.
- Condensed uppercase display; tabular numerals; body in a plain neutral sans that never plays display.
- The red/black duotone photographic grade on every image.
- The odometer rep counters, the interval bar and the chrono: all three, every build. The bar shows itself TWICE — the compact hero strip, the full scrubbed bar downstairs.
- The second action is a BRACKET — two 2px red edge rules, no box — never an outlined ghost button.
- Tempo cuts: fast sections against exactly one breather.
- Hard entrances (0.3s power4.out): nothing bounces, nothing floats.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes inside each register (red #E63329 / #D32219 / #FF3B2E; ground #101010 / #0C0C0C / #121110).
- The display face within the condensed register (Oswald, Barlow Condensed, Archivo Narrow) — one per site.
- The DISCIPLINE NOUN driving the page: la séance, le round, la course, la charge, le cycle. It names the clock, the showpiece, the labels and the voice; no discipline noun means a template.
- The showpiece's SUBJECT (interval bar, round clock, plate loader, pace strip, week board), the section order beyond the fixed opening and closing, the photo count, the programme names, the price ladder.

## The vibe (voice)
Short, flat, physical French — a coach who counts your reps and sells you nothing: "Trois blocs, un chrono, douze athlètes par créneau." Facts before benefits, always with a unit. Say what was REMOVED, not added: "On a laissé dehors la musique d'ambiance, les miroirs et les machines : il reste le travail." Honesty about numbers is design: "Moyennes relevées sur les séances de janvier — on ne les arrondit pas vers le haut." No superlatives, no exclamation marks, no scarcity. One quote from one real member, printed once, never in a carousel.

## Visual signatures (measured — what makes it recognizable in two seconds)
- ODOMETER REP COUNTERS (owned tic): every important figure is digit wheels — a 1em clipped box per digit holding a 0–9 strip, translated on Y. Wheels SNAP to their digit and turn only during the carry (the last 12% of a digit's travel), so the figure stays readable at any scroll position. Hero-rail counters run once on entry (1.05s power4.out, 0.07s stagger); showpiece counters ride the scrub. With JS dead the plain number is the DOM text — the odometer is an enhancement, never the content. ACCESSIBILITY LAW: building the wheels DELETES that number, so the wrapper carries its own name — role="img" + aria-label with the printed figure ("2 400"), aria-hidden="true" on every digit box, or the rail announces "01234567890" per wheel.
- THE INTERVAL BAR (owned tic): 4–6 effort blocks, widths by minutes (CSS grid 8fr 15fr 12fr 6fr 4fr for an 8/15/12/6/4 session), heights by intensity (calc(26% + var(--int) * .74%) of a clamp(182px,21vw,252px) track), fill alpha by intensity (rgba(230,51,41, calc(.44 + var(--int) * .0056))). Each block carries its minute count in the display face and a note of two to seven words under a 2px rule, sized to hold ONE line at 1440 — the narrow 6fr and 4fr blocks take the shortest; a note that wraps alone is a bug. A white 2px playhead with a 10px square head travels the bar. Never gauges, never a ring — bars with time on the axis.
- THE HERO STRIP — the interval bar's compact form, and what stops the first viewport reading as any charcoal spec-sheet page: the same 8fr 15fr 12fr 6fr 4fr columns and the same intensity-alpha fills, ONE flat height of clamp(28px,3.6vh,36px) (26px at ≤560px), a 2px rgba(230,51,41,.55) rule under the whole track, minute values under each column at 11.5px, a 10.5px head line — session name left, total in red right. No playhead, no intensity heights, no phase labels — those belong to the full bar. Capped at 520px, under the hero actions.
- THE CHRONO, in three places: a 3px rule under the sticky header, red fill scaling from the left across the whole document scroll; a 12px tabular readout beside it (00:00 / 45:00); and THE TIMECODE STAMP opening every section eyebrow — the clock reading that block arrives on, then a 2px VERTICAL red rule, then the name ("13:00 │ BLOC 03 / 07 — LA SÉANCE"). Stamps ascend, read off the desktop chrono rounded to the minute, and end before 45:00; in-block sub-labels keep the rule and drop the time. A leading horizontal accent dash is forbidden: that rule turned 90°, carrying a number, is the separation.
- ONE RED WORD per headline, an inline accent span — the only colour inside display type.
- HARD EDGES: buttons, inputs, plates and photos take min(var(--radius), 0px) — this world's corners stay cut. Hairlines rgba(242,242,240,.14); emphasis rules 2–3px solid red on a plate's top or left edge. No shadow exists in this world.
- THE STAT RAIL: 3–4 hairline-divided cells, each an odometer over a 12.5px muted caption, closing the hero.

## Color physics
- GROUND: the #101010 register (#0C0C0C / #121110 acceptable). A second ground (#0A0A0A) marks alternate sections — felt, not seen.
- PANEL: #161616 / #1C1C1C for hovered rows and raised plates; never lighter than #1F1F1F.
- INK: #F2F2F0 warm-white, never #FFF. Muted #8E8E8B; meta #6A6A68 — three ink levels, no more.
- ACCENT RED: #E63329 (register #D32219–#FF3B2E). BUDGET per page: the key word in each headline, primary buttons, the bracket rules, interval blocks, counter units, active states, the 3px chrono, one 3px top rule per emphasised plate, ONE full-red panel. Above roughly 8% of any viewport, cut it.
- SHADOW RED #2A0705 / #3B0C08: only inside the grade, never as a surface colour.
- GRADIENTS: forbidden as decoration; the only one is the tonal ramp inside a graded photograph.
- On the red panel the ink INVERTS to #0A0A0A — black type on red, hairlines rgba(10,10,10,.35). Red is never a bed for white text.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT RED→--primary · second ground→--primary-foreground · PANEL→--secondary · SHADOW RED→--accent · muted ink→--muted · ink at 14%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, grade layer or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: a condensed grotesque in UPPERCASE — Oswald (default), Barlow Condensed, Archivo Narrow. One per site. Weights 500–700, letter-spacing -.005em to -.015em.
- LINE-HEIGHT — THE ACCENT LAW (measured on Oswald, not guessed): a capital É/È/Ê/À inks to 1.07em above its baseline, so any multi-line display block that can open a line on an accented capital takes 1.12 — .05em of clearance; .99 and 1.02 collide, 1.08 grazes. 1.12 is the floor for section titles, breather plates and the red-panel quote. .86 is reserved for the hero and holds ONLY while no accented capital sits under another line. Never italic, never lowercase in a heading.
- BODY: a plain neutral sans — Source Sans 3 (default), IBM Plex Sans, Public Sans. 400/600 only, clamp(15.5px,1.02vw,17px), line-height 1.62, max 56ch. The body face never sets a heading, never goes uppercase above 12px.
- NUMBERS: always the display face, always tabular-nums — prices, minutes, kilos, percentages, phone numbers. A number in the body face is a bug.
- Hero statement clamp(2.9rem,8.4vw,7.1rem) — under the wave's 10vw cap. Section titles clamp(2rem,4.9vw,4rem). Programme names clamp(1.5rem,3vw,2.5rem). Prices clamp(2.1rem,4.4vw,3.4rem).
- LABELS: display face 500, 10.5–11px, uppercase, +.14em to +.2em tracking, muted ink. Section eyebrows open on the timecode stamp (Visual signatures), inline in the head, never a fixed rail; the stamp itself is 600 weight at +.06em, tabular, on a 2px rgba(230,51,41,.55) right rule with 10px either side.
- ARABIC PAIRING: Almarai or Cairo at 600–700 display, Almarai 400 body; heading line-height 1.5, tracking to 0, uppercase-Latin labels stay Latin. The condensed-caps rhythm has no Arabic equivalent — compensate with weight and the red word, never by stretching glyphs.

## Signature art / components
PHOTOGRAPHY IS THE IMAGERY SYSTEM: no drawn illustration, no icons, no line art. Subjects: barbells and chalk dust, a rope mid-slam, a kettlebell rack in hard light.

THE GRADE (owned tic) — LAW, applied to every image, non-negotiable: container position:relative; isolation:isolate; overflow:hidden; background:#080808 · image filter: grayscale(1) contrast(1.3) brightness(.86) · ::before overlay #E63329, mix-blend-mode:multiply, opacity .1 (tints the midtones) · ::after overlay #2A0705, mix-blend-mode:lighten, opacity .72 (lifts every shadow to a red-black floor). Shadows glow oxide-red, highlights stay cool steel. Never sepia, never flat monochrome — the two-layer construction IS the tic.

FRAMING: hard rectangles, zero radius. Photos are composition members: a hero photo bleeding to the viewport's right edge from under the header down to the stat rail; programme rows at 38%, 54% or 60%; one full-bleed section-height photograph carrying a text plate. Captions are 10.5px tracked caps on a solid ground chip in a corner, hairlined on its two inner edges ("BARRE — 06:30, LUNDI"). Never type on the busy part of an image.

BUTTONS: filled red, #0A0A0A text, 13px display caps at +.14em, padding 13px 22px, zero radius; hover lightens to #FF4034 and lifts 2px in 160ms linear. THE SECOND ACTION IS A BRACKET, never an outlined box: no background, no top or bottom border, a 2px solid red rule on the LEFT and RIGHT edges only, padding 14px 18px, ink type clamped between them; hover and focus-visible fill #161616 and turn the type red. In the price ladder the recommended column keeps the solid red block, the others are bracketed; never an underline, never a chevron.
FORMS — the fiche d'inscription: a 1px-bordered sheet, header line (title + "Réf. E-2026 / 45") over a 2px rule; fields in a two-column grid, each label prefixed by a red two-digit number (01 NOM, 02 TÉLÉPHONE…); inputs on #141414, hairline border turning red on focus; type="tel" with inputmode="tel" first after the name. The note field is a 150px textarea; the fiche is start-aligned, sizes to content and never bottom-aligns with the column beside it. On valid submit: prevent default, dispatch the wandit:lead CustomEvent on document with the fields flat in detail (nom, telephone, programme, creneau, note, source), then swap the sheet for an honest success plate — red-bordered block, two-word title ("C'est noté."), the real next step, the motif. One off-canvas decoy input carrying data-wandit-hp sits in the form, untouched by the page's script.
ROWS AND PLATES: the roster is hairline-separated rows (name in display caps / speciality in red micro-caps / certification in body / a tabular reference figure right-aligned); on hover or keyboard focus the row lifts to #161616, gains an inset 3px red left edge and turns the reference figure red — every hover state has a focus-visible twin.

## Page chassis
- Container max-width 1360px; padding-inline clamp(18px,4.4vw,56px). Fast sections padding-block clamp(3.4rem,7.4vh,5.6rem). The breather takes ONE of two forms: DOUBLE-PADDED (clamp(6rem,13vh,10rem) on a normal ground) or SECTION-HEIGHT FULL-BLEED (min-height:min(84vh,720px), the graded photograph filling the section, a plate on a bottom corner, no padding-block declared). Either way it measures twice a fast section: that ratio IS the tempo.
- HEADER: 62px, solid ground, no blur, no shadow. Wordmark with the accent on its suffix (FORME/45), tracked-caps nav, tabular chrono readout, one small red CTA. The 3px chrono rule sits on its bottom edge.
- FIXED OPENING — the hero law: an off-balance split (54/46 measured, register 52/48 to 60/40, never 50/50). Type column: the stamped eyebrow, headline of 2–3 condensed lines with ONE red word, a 44ch sub, a filled button beside a bracketed one, then THE INTERVAL STRIP. Column padding clamp(30px,4.4vh,58px)/clamp(24px,3.6vh,46px), gap clamp(16px,2.1vh,24px) — measured so the strip AND the whole stat rail land inside 900px. Photo column: a graded photograph bleeding to the viewport edge with a corner caption. Closing it, full width: the stat rail of 3–4 odometers on hairlines. The first viewport must hold a red word, a photograph, a rolling number and the strip — ON THE PHONE TOO. At ≤560px it re-composes to fit all four above 844px: photo band min(24vh,240px), copy gap clamp(12px,1.8vh,18px), two full-width CTAs in one column (matched widths, never left-ragged), strip head at 9.5px over a 26px track, stat rail 2×2 at 13px padding.
- FIXED CLOSING: the essai/contact section (statement + info list + the fiche, 40/60), then the footer: the wordmark at clamp(3.4rem,15vw,10rem) across the container, the five-block motif under it, four hairline columns, one legal line.
- FREE MIDDLE — compose 3–5, never two adjacent alike: programme rows (ghost number, name, paragraph, meta line, photo panel; each row a DIFFERENT proportion and height) · the showpiece stage · the breather (section-height graded photograph, plate on a bottom corner with a 2×2 spec grid) · the roster table · the red panel (one member quote in display caps, black on red, motif beside it) · the price ladder (2–4 columns, the recommended one wider by 1.22fr with a 3px red top rule and a red tag, never a shadow or a scale-up).

## Motion identity — INTERVAL BURST
Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Hidden states come only from gsap.set — never opacity:0 in CSS.
- ENTRANCES, fast sections: opacity 0→1, y 26→0, 0.30s power4.out, stagger 0.055, trigger "top 82%", once. Hard cuts — the block is simply THERE.
- THE CHRONO READS RAW SCROLL: scrollY / (scrollHeight − innerHeight) on a passive scroll listener, never a body ScrollTrigger — a pinned showpiece discounts the pin distance from that trigger's cached end, the session hits 45:00 a fifth of the page early and every eyebrow stamp becomes a lie.
- ENTRANCES, breather: 0.95s power2.out, y 18, stagger 0.16. The contrast is the world's motion signature, gated on the breather ALONE — one selector, one section; red panel, roster and price ladder take the 0.30s cut.
- OVERSHOOT IS FORBIDDEN (wave law): no back.out, no elastic, no squash; power4, power3, power2, expo and sine only.
- PHOTOS: one scale 1.06→1 settle in 0.9s power3.out on entry. No parallax, no Ken-Burns.
- HOVER: 160ms linear only — colour change and a 2px lift. Nothing scales or blurs.
- THE SCRUBBED SHOWPIECE (exactly one per page): the interval bar filling block by block while the odometers roll and the clock counts. Desktop: pin the stage, not the section — start "top 96px", end "+=1700", scrub 0.35, invalidateOnRefresh; the head scrolls away first so the pinned frame holds only clock, bar and counters. Blocks fill in session order, duration proportional to minutes; each label fades 0.32→1 as its block starts; the playhead travels x. THE HOLD: the session completes at 1/1.08 of the scrub and the finished frame holds for the last 8% — clock 45:00, bar full, playhead parked, every wheel SNAPPED, or the scrub strands the odometers mid-carry. Mobile (≤760px): NO pin — same timeline on a non-pinned scrub between "top 74%" and "bottom 62%", the bar re-laid vertically (labels in a 92px column, bars growing in width), playhead travelling y. The vertical form MUST keep the minute value on every bar and the travelling playhead — that is what separates this tic from ALLURE's gauges.
- REDUCED MOTION / JS DEAD: the composed still is what the MARKUP ships — bar fully filled (no scaleX in CSS), counters as plain text, BOTH clocks on 45:00, playhead parked at the END of the bar (right:0 desktop / bottom:0 mobile), chrono full. The live path REWINDS it on init: clocks to 00:00, chrono and fills to scaleX 0, playhead pulled back by transform only (x: -(bar.offsetWidth - 2) / y: -(bar.offsetHeight - 2)), so a breakpoint flip cannot strand it mid-bar — never the reverse. The hero strip never scrubs — it ships filled and takes only the section entrance.

## Ban list (in addition to the global ban list)
- MAILLOT's diagonal slice transitions, giant jersey numerals on colour blocks, the chant stack (a word repeated with escalating weight) — the varsity world next door.
- CINÉTIQUE's entire language: mix-blend difference chrome, outlined/stroked display type, the sticky card-deck, machine-telemetry captions (SYS.STATUS, FILE 001), rotated crossing marquees, glyph-scramble links, ghost stroked numerals, corner registration ticks, generative canvas imagery. FORME's clock — header readout and eyebrow stamps — is a session timer, never a coordinate or a file number.
- ALLURE's spec gauge bars, the specular sweep across the hero photo, the monogram roundel badge — allure fills 0→max gauges, FORME rolls digits and fills time blocks. Banned with them, the charcoal hero being the crowded corner of the field: the filled-button-beside-four-sided-outlined-ghost pair (FORME brackets its second action), the accent-dash eyebrow (FORME stamps its eyebrows with the clock), and a hero whose only owned furniture is the photograph (FORME's carries the interval strip and the odometer rail).
- CHANTIER's stencil caps with spray edges, hazard-stripe bands, steel plates with corner bolts.
- AFFICHE's fit-to-viewport headline and poster-colour section rotation. VOLTAGE's neon glow, beams and dark glass. GUIMAUVE's overshoot and blobs. CLAIR's floating soft-shadow cards. GÉNÉRIQUE's letterbox bars and Ken-Burns scrubs. GOMMETTE's sticker halos.
- Also banned: border-radius above 2px · any BLURRED or OFFSET box-shadow — the only permitted box-shadow is a 0-blur 0-offset inset edge rule (inset 3px 0 0 var(--red)) · gradients outside the grade · light section grounds · display weights below 300 · red as a page background outside the one red panel · emoji, icon fonts, dumbbell clip-art · before/after body photography · Instagram grids.

## LES GESTES (the moves menu)
1. LE CHRONO — the 3px red rule under the header filling with document scroll, the tabular readout, and the timecode stamping every eyebrow: the whole page becomes one session. Always on; free to re-key (45:00, 60:00, 12 rounds).
2. LA BARRE D'INTERVALLES — effort blocks: widths by minutes, heights and alpha by intensity, a travelling playhead. Scrubbed as the showpiece, and printed once in the hero as the compact strip, so the first viewport carries the world's own furniture.
3. L'ODOMÈTRE — digit wheels for any figure that matters. Entry-triggered in rails, scrub-tied in the showpiece. Never more than four in one viewport.
4. LA COUPE DE TEMPO — two or three dense fast sections, one breather at double weight with a full-bleed photograph, then hard sections again. Compose the page as a workout, not a list.
5. LA BANDE PROGRAMME — full-width rows: ghost number, name, paragraph, meta line above a hairline, photo panel. Each row takes a DIFFERENT column ratio and min-height; three identical rows fail the geste.
6. LE MUR NOIR — a section-height graded photograph, a near-opaque plate on one bottom corner with a 3px red top rule and a 2×2 spec grid inside. The breather's default form.
7. LE BLOC ROUGE — one full-red panel, black ink, used exactly once: the member quote, a single price, or one line of promise. The page's loudest beat; a second kills both.
8. LE MOTIF CINQ BLOCS — the five-block silhouette as furniture: under the footer wordmark, beside the quote, inside the success plate. FIVE blocks at the session's own proportions (flex 8/15/12/6/4); a four-block reduction is a different object. On the red panel it is graded by HEIGHT ONLY, solid #0A0A0A — alpha ramps over #E63329 composite to muddy maroon. The world's only ornament.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**BOX 45 — "le chrono".** Hero: 54/46 split, type left, a chalk-and-barbell photograph off the right edge, the strip under the actions, a four-cell odometer rail closing the viewport. Showpiece: the 45-minute bar filling block by block on a pinned scrub while kcal, reps and tonnage roll. Mood: six in the morning, chalk dust.

**HYROX CLUB — "la course".** Hero: a full-bleed graded photograph across the top third, headline BELOW it in three flush-left lines, the strip vertical down the left margin. Showpiece: the race map — eight station chips advancing on scrub, each snapping in with its split as a total-time odometer climbs. Mood: competition day.

**RING — "la cloche".** Hero: five vertical bands, two of them narrow graded photo slivers, the headline on a black plate spanning bands one to three. Showpiece: the round clock — a 3-minute arc stroking around a square dial, rounds 1–12 snapping in below, a punch odometer rolling. Mood: a fight gym, low light.

**FEMMES 9H — "la ligne claire".** Hero: type only, a red vertical rule splitting the viewport at 38%, the headline flush against it; the first image arrives a section later as a full-bleed wall. Showpiece: the twelve-week ladder — weekly bars stacking upward on scrub, each week's charge printed as it lands. Mood: quiet, exact.

**HALTÉRO — "la charge".** Hero: a quadrant composition — photograph top-left, headline bottom-right, empty ground between, the stat rail vertical on the right edge. Showpiece: the plate loader — a barbell in flat CSS rectangles gaining plates pair by pair as the charge odometer climbs 60 → 180 kg. Mood: a platform, one lift.

**ENDURANCE — "le souffle".** Hero: one full-bleed graded photograph, a black plate on the LEFT edge running half off the image, headline inside it, a red split line crossing the photo. Showpiece: the pace strip — kilometre markers travelling under a fixed red needle while a pace odometer counts DOWN in min/km. Mood: a track at dusk.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or the world collapses into a generic dark gym template. FIRST, THE GRADE: the same two-layer duotone on every photograph makes stock gym pictures read as one commissioned shoot; one ungraded image and the page looks assembled. SECOND, THE NUMBERS: real, unrounded figures on rolling wheels — 2 400 séances, 4,2 tonnes, 182 kg épaulé-jeté — with a footnote saying where they came from. THIRD, THE TEMPO: a 0.30s power4.out section against a 0.95s power2.out breather at double the padding — one rhythm is no pulse.

The cheap details that separate this from a generated page: the chrono readout ticking in the header, the hero's interval strip, the bracketed second action, the timecoded block eyebrows, the red two-digit numerals before every form label, the corner caption chips, the five-block motif, the honest footnote under the statistics. None cost anything.`,
};
