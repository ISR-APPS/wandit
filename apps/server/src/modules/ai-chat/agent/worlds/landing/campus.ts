import type { DesignWorld } from "../types";

/**
 * CAMPUS — the bright modern school.
 * Popular wave: the private-school / edtech genre every école privée and
 * centre de formation asks for — white ground, chunky color blocks, sunny
 * photography, big friendly type — executed as an institution that PUBLISHES
 * (timetable, fees, results) instead of one that promises. Values below were
 * measured on the Campus Numidia build (Oran, 4 filières, DZD).
 * fusesWith: clair (same friendly-competent register, opposite elevation law —
 * clair floats, campus never does), elan (civic optimism; campus counts places
 * and hours where elan counts donations), serment (institutional calm for a
 * school with a health or paramedical wing).
 */
export const campus: DesignWorld = {
	id: "campus",
	name: "Campus",
	family: "education-pop",
	tagline: "L'école qui affiche tout : la semaine, les frais, les résultats.",
	kind: "website",
	mood: ["bright", "sunny", "structured", "encouraging"],
	energy: "medium",
	priceFeel: "accessible",
	industries: [
		"private school",
		"language center",
		"training institute / formation",
		"university prep / tutoring",
		"driving school",
		"online courses / e-learning",
		"kindergarten / crèche",
		"coding bootcamp",
		"music school",
	],
	avoidFor: [
		"fine dining",
		"jewelry brand",
		"streetwear / drops",
		"DJ / entertainment",
		"festival",
		"construction",
	],
	fusesWith: ["clair", "elan", "serment"],
	preview: {
		ground: "#FFFFFF",
		ink: "#1B2559",
		accent: "#0284C7",
		fontFamily: "Outfit",
		sampleWord: "Campus",
	},
	doc: `# DESIGN WORLD: CAMPUS — the bright modern school

## Philosophy
This page is a WELL-LIT SCHOOL BUILDING ON THE FIRST MORNING OF TERM, and its central object is the printed timetable pinned in the hall: white walls, sunlight through big windows, colored blocks of information a fourteen-year-old and her mother can both read from three metres away. First structural fact: DEPTH COMES FROM COLOR, NEVER FROM ELEVATION — flat blocks at 14px radius, chips at 999px, and ZERO box-shadow anywhere (the focus ring is the one exception, drawn with outline). Second: the school PUBLISHES. Every section answers a parent's question with a countable fact — hours, days, room, DZD per year, the share of the last promotion working six months later. Third: the sun is in the photographs, not in a gradient — bright daylight, graded once, cropped with intent, never dimmed. Impossible failure modes: the moody dark hero, the luxury hush, the excellence brochure with no number in it, the icon-feature-card row. Self-audit before shipping (count them): at least 4 real numbers with units in the first two viewports; exactly 0 box-shadows; exactly 1 saturated navy band (the footer is chassis); at most 3 tinted grounds, never two adjacent (the sand date strip is chassis, uncounted); a fragment of the real timetable legible in the FIRST viewport; all three owned tics present and visible; every price in DZD with its period ("par an", "par mois").

## The variation contract (why two CAMPUS sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Pure white ground (#FFFFFF, never off-white, never cream), deep navy ink, ONE sky accent, exactly two support block colors used as section grounds and block fills only.
- The radius pair: 14px on blocks, cards, photos and sheets (12px on inputs only); chips, buttons, discs and meters consume var(--radius) directly (the 999px pill). Nothing sharp-cornered, arched or blobby.
- Zero elevation: no box-shadow, no blur panels, no floating cards. Separation is color, hairline (#DCE3EF) or white space.
- The three tics — timetable grid cards, enrollment stepper rail, chunky progress meters — all appear on every build.
- Photography is bright daylight, graded once, corners 14px, never overlaid with type, never dimmed.
- BLOCK POP motion only: 0.45s expo.out, scale 0.97→1; no overshoot, no bounce, no rotation.
- Every claim carries a number; every number carries its unit and its period.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact accent inside the sky register (#0284C7 / #0369A1 / #0B92D8) and the exact support pair inside the sand (#FDE68A / #FCD34D) and pale-sky (#DCEBF7 / #E4F0FA) registers.
- The display face within the register: Outfit or Gantari, one per site.
- The CONCEPT UNIT the school counts in — l'heure, la place, la semaine, le palier, la promotion. It names the hero claim, the showpiece and the meters: a driving school counts heures de conduite, a crèche places par section.
- The filières/cours offer, the timetable's real content, the rail's step names, the meters' metrics, the photo subjects, and the section order beyond the fixed opening and closing.
A CAMPUS page with no counting unit fails: name it FIRST; it then chooses the meters, the stepper labels and the stat rail.

## The vibe (voice)
Plain, warm, administratively honest French — a good secretary who tells you the truth on the first call. Short declaratives with a figure inside ("Un dossier incomplet est signalé sous 48 heures — jamais classé sans suite."). Name the constraint before the promise ("Le redoublement est autorisé une fois, à 50 % des frais."). Never "excellence" or "meilleure école"; no exclamation marks; no countdown or "places limitées" — an announced deadline is fact enough.

## Visual signatures (what makes it instantly recognizable)
- LA SEMAINE — timetable grid cards (OWNED TIC): a real weekly grid, columns \`58px repeat(5, minmax(124px,1fr))\`, rows \`minmax(82px,auto)\`, 8px gaps, laid on a WHITE sheet (14px radius, clamp(16px,2vw,26px) padding) with a 2px navy rule under its head line. Course cards are 14px blocks, 12px 13px padding, name in the display face 600 at .9375rem, room + duration below in .625rem caps at +0.11em and 68% opacity. Colour-code by course TYPE with a legend that RESOLVES inside the sheet: every chip names a fill present in the grid, every fill has its chip, a course keeps one colour all week, the pale-sky chip taking a #C4DCF0 hairline. Four fills maximum (sky, navy, sand, pale-sky) plus one outline card. Empty slots stay as bare 14px hairline cells labelled "Libre" on a week that resolves to a real calendar — the honesty of a published timetable is the point. Under 900px the sheet scrolls horizontally inside its own container at min-width 748px under a "Faites glisser →" hint sticky at top:69px; the page never scrolls sideways.
- LA VIGNETTE DU JOUR — the same tic at n=1, and the world's HERO FURNITURE: a white 14px sheet with a 1px #DCE3EF border carrying one named day ("Mardi 17 février — Licence 2") over a 2px navy rule, the display note opposite, then FOUR slots side by side — hour label above at .6875rem, course block below at 66px minimum, all four stretched to one height. Three coloured courses and one hairline "Libre"; never five, never a scroll. Four columns above 900px (name .875rem, .8125rem under 1210px), two below. Every cell must exist in the full week grid further down the page. This is what makes CAMPUS read as a timetable world in two seconds instead of a competent template.
- LE RAIL — enrollment stepper rail (OWNED TIC): 3–4 numbered steps on a 6px track that FILLS as the visitor scrolls. Discs 54px (50px under 900px), sand-filled with navy numerals at 1.3rem; the track sits at the disc centre (top:25px, left:27px), rgba(255,255,255,.16) on navy, #DCE3EF on white; the fill is the lifted sky (#4FB3E8 on navy, #0284C7 on white). The rail ENDS in a terminal flag: a 14px sand plate carrying the date it leads to ("Rentrée — lundi 14 septembre"). Under 900px it turns vertical (left:24px, 6px wide), discs beside their step.
- LES JAUGES — chunky progress meters (OWNED TIC): fat rounded bars, 34px tall (30px under 900px), radius 999px, track #FFFFFF on tinted grounds and #E9F1F8 on white, fill navy or sky. The % CAP is a white 999px chip inside the right end of the fill (5px 11px, display face 700 at .8125rem, tabular numerals). The label sits ABOVE the bar at 600/~1.05rem with a micro-context word far right ("148 inscrits", "obligatoire"). Meters carry percentages only; absolute figures live in white 14px fact plates beside them.
- Chips everywhere, one shape: 999px, 7px 15px, 600 at .75rem; the caps variant .6875rem at +0.13em. They carry durations, capacities, delays, addresses, captions. On a tinted ground the default chip flips to white so it never disappears into its section.
- Grounds alternate white → tinted → white with exactly ONE saturated navy band per page (the showpiece) and at most three tinted grounds; adjacent sections never share a ground (the sand date strip is chassis, uncounted).
- Numbers are furniture: a 3-cell stat rail under the hero on a 2px navy top rule, display face 700 at clamp(1.5rem,2.5vw,2.15rem), tabular numerals, cells split by 1px hairlines.

## Color physics
- GROUND: #FFFFFF, pure. Off-white and cream are other worlds' language; white is what makes the color blocks read as blocks.
- INK: deep institutional navy — the #1B2559 / #16204A / #22306B register. Body copy drops to #4A5578, micro-labels to #7A85A8. Never pure black.
- ACCENT SKY: the #0284C7 / #0369A1 / #0B92D8 register; hover deepens ~10% (#026C9F). On navy the accent LIFTS to #4FB3E8 so rails and links keep contrast — that lift is law, not taste.
- SUPPORT BLOCKS: sand (#FDE68A / #FCD34D) and pale sky (#DCEBF7 / #E4F0FA), SECTION GROUNDS and BLOCK FILLS only — never type color, never a border on white. Text on sand is navy; on sky and navy, white.
- HAIRLINE: #DCE3EF for rules and cell borders; #C9D4E6 for the stronger outline (ghost buttons, form fields, outline course cards).

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT SKY→--primary · GROUND→--primary-foreground · PALE SKY→--secondary · SAND→--accent · ink at 55%→--muted · ink at 13%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, tint or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Budget: at most two saturated blocks per card row; grounds and timetable fills are budgeted above.
- ZERO GRADIENTS — not in heroes, buttons, blocks, or as a "subtle" photo overlay; flat color is this world's entire physics.

## Typography system
- DISPLAY: Outfit or Gantari — geometric, friendly, wide-apertured — weights 600/700, tracking -0.022em on headings. One face per site.
- BODY: Assistant, 400/600, 1rem/1.62. Ledes at clamp(1.02rem,1.15vw,1.14rem)/1.62 capped at 56ch. Small copy .9375rem/1.6, notes .8125rem/1.6 in #7A85A8.
- Scale: h1 clamp(2.35rem,5.5vw,4.35rem)/1.04 capped at 17ch — well under the wave's 10vw ceiling: a school headline reads as a sentence, not a poster. h2 clamp(1.85rem,3.4vw,3rem)/1.06 at 20ch. h3 clamp(1.15rem,1.5vw,1.35rem) at 600.
- Labels: 600 at .6875rem, +0.15em, uppercase, in #7A85A8 — bare above a heading or inside a chip, never letterspaced over a photograph.
- Numerals: display face 700, \`font-variant-numeric: tabular-nums\` on every price, percentage, hour and count. Prices carry a non-breaking thin gap inside the thousands (285&nbsp;000 DA) and their period underneath in caps ("PAR AN, TROIS VERSEMENTS").
- Hard rules: never italic (emphasis is the accent color or a chip); never all-caps beyond four words; body never under 15px; NO monospace anywhere. One accent-colored word per headline maximum, and only in the hero.
- Arabic pairing: Cairo or Almarai at 400/700 replaces Assistant and Outfit together; keep the chip and label system, drop all letter-spacing, and mirror the timetable's day order.

## Signature art & components (photographic art direction and the parts)
- PHOTOGRAPHY LAW: bright modern campus photography — sunny daylight, blue sky, students at a distance, never in identifiable close-up, no text in frame. One grade for every image: \`filter: saturate(1.08) brightness(1.02)\`; no overlay, duotone or vignette. Corners 14px; a hero photo may bleed to one viewport edge keeping 14px inner corners. Crop with intent: choose the object-position that keeps desks, shelves or the walkway in frame and pushes signage out; scale inside the frame rather than accept an artifact.
- CAPTION LAW: captions are chips on the ground UNDER the photo, caps variant, one fact each ("Bibliothèque — 9 000 ouvrages"), two per image maximum. Never a caption plate overlapping the image.
- BUTTONS: 999px, 14px 24px, 600 at .9375rem. Primary = filled sky, white text, a 15×10 arrow glyph; ghost = transparent with a #C9D4E6 border turning sky on hover, allowed in the middle of the page and NEVER in the hero; sand = filled #FDE68A with navy text, reserved for the CTA on the navy band. Hover changes fill only, 160ms; :focus-visible draws a 2px sky outline at 3px offset.
- LINKS: sky-deep text over a 2px SAND underline 3px below the baseline; hover turns the text navy and the underline sky. The hero's secondary action is this link at .9375rem on the button's centre line, so the first screen never shows a filled-plus-outline pill pair.
- CARDS: 14px radius, hairline border on white or a flat block fill. No shadow, no lift — hover changes border or fill by one step, nothing moves more than 2px.
- FACT PLATES: white 14px plates on tinted grounds, 18px 20px, one big display numeral over one line of context.
- FORMS (the front desk): a white 14px plate on a tinted ground, fields in a 2-column grid collapsing to one under 560px. Labels above in .6875rem caps at +0.13em; inputs 12px radius, 13px 15px, 1px #C9D4E6 border turning sky on focus with a 2px outline ring; selects carry a drawn chevron; phone is \`type="tel" inputmode="tel"\` and comes before e-mail. One checkbox for the honest extra (a Saturday visit). On valid submit, dispatch the \`wandit:lead\` CustomEvent on \`document\` with the visitor's fields flat in \`detail\` (nom, telephone, email, filiere, situation, message, visite, source), then show a success plate repeating the phone number, the real delay and what to do if nobody calls. One off-canvas decoy input carries \`data-wandit-hp\`, untouched beyond the abort check.
- FAVICON: inline SVG data URI — a sky rounded square with two stacked rounded bars, sand and white: the timetable, one centimetre wide.

## Page chassis
- Container 1280px, gutters clamp(20px,4vw,56px), section rhythm clamp(58px,8vw,112px).
- HEADER: sticky white at 95% with an 8px blur and a hairline bottom, 68px minimum; wordmark (block glyph + name + caps locality), 5 nav links, the phone, one filled CTA chip. Links go under 1000px, the phone under 560px. Never a shadow, never a pill container.
- FIXED OPENING — the hero: a two-column split at 1.04fr/0.96fr aligned to the BOTTOM, the left column spanning two rows; text left (the rentrée NOTICE — a 14px sand block in the course-card geometry, its name in the display face over one caps line, NEVER a pill badge → h1 with one accent word → lede at 56ch → ONE filled button beside the sand-underlined text link → the 3-cell stat rail on its 2px navy rule). The right column stacks LA VIGNETTE DU JOUR over the photograph on a 14px row gap, both bleeding to the viewport edge with 14px inner corners only, caption chips under the photo. Under 900px the hero flattens to one 16px-gap column in this order — notice, h1, lede, actions, VIGNETTE full width (slots in two columns, 14px all corners), stat rail, photo at 250px: the whole vignette must sit inside the first 844px screen, ABOVE the numbers. Immediately below, a full-bleed SAND date strip — 3–4 facts (portes ouvertes, clôture, entretiens, rentrée), each a caps label plus a bold date — so the first viewport ends on a color block and a commitment.
- FIXED CLOSING — inscription: the form plate on a tinted ground, the left column carrying the numbered list of pieces, contact chips and one white plate for the walk-in option; then the navy footer, wordmark at clamp(2.35rem,7.4vw,5rem) closed by a sand period, four columns over a hairline, bottom bar.
- FREE MIDDLE (compose 4–5, never two adjacent alike): the filières damier · the timetable sheet on a tinted ground · the campus photo mosaic · the navy showpiece band · the meters on sand · the two-column FAQ (head row above, two independent accordion columns) · a fee table with three payment moments.
- The navy band appears ONCE and carries the showpiece: min-height 100vh above 900px, content vertically centred so the pinned frame is entirely navy.

## Motion identity — BLOCK POP
- Entrance grammar, everywhere: opacity 0→1, y 12→0, scale 0.97→1, 0.45s, expo.out, stagger 0.06s row-major inside a group. Hero bits run on a 0.1s-delayed timeline at 0.55s, the day-vignette joining at +0.10s over 0.6s and the photo at +0.22s over 0.7s — the timetable lands before the photograph.
- Timetable cells are the one faster beat: 0.4s, stagger 0.028s from the grid's start — the week fills in like blocks pinned to the board.
- Meters fill on entrance, not on scrub (unless the meters ARE the showpiece): width 0→target over 1.05s power2.out with the cap chip counting 0→N in the same tween.
- THE SHOWPIECE (one per page, scrubbed): the enrollment rail filling step by step. Pin the navy band above 900px (start "top top", end "+=112%", scrub 0.55); the fill scales from 7% (never 0) across 2.6 units of timeline, each step activating at 0.15 + i×0.8 (opacity 0.55→1, y→0, the disc going from a hollow rgba(255,255,255,.10) outline to solid sand with navy numerals), the flag pending at 0.35 and landing at 2.55. Under 900px the same timeline plays unpinned on the section's scroll range, the fill running vertically.
- Pending states are LEGIBLE: 0.55 opacity, not 0.15 — a visitor landing mid-band reads all three steps; the first frame is already a composition.
- Hover: 160ms color-only transitions, 2px translate maximum. No parallax, no rotation, no marquee, no counter that restarts on re-entry.
- Reduced motion and dead JS: every hidden state is set by \`gsap.set\`, never in CSS. With JS off the rail is full, the discs are sand, the meters stand at their real widths (the fill width lives in a \`--w\` custom property) and both timetables are complete — the reduced page is the composed final frame.

## Ban list (in addition to the global one)
- BAUPLAN's primary-color shape cast (circle/triangle/square as recurring characters), its thick baseline bars under type and its rotating circular text badge — by name.
- CLAIR's soft-shadow floating cards (16–20px radius on white), its duotone spot illustrations and its pill-tab feature switcher — by name. CAMPUS has zero elevation and photographs instead of drawings.
- CLAIR's HERO GRAMMAR, the closest neighbour risk: a badge pill above the headline plus a filled-blue and outline-pill CTA duo over a first screen of copy and a product still. CAMPUS breaks all three: the eyebrow is a course-card block, the second action is a sand-underlined text link, and timetable furniture is in the fold at every width.
- GUIMAUVE's puffy blob containers, its back.out(≥1.7) overshoot and its candy-stripe dividers — by name. Nothing in this world overshoots.
- TUTTI's Memphis confetti field, its colored offset shadows and its squiggle underlines — by name.
- ÉLAN's photo-through-type masthead (background-clip:text) and its thin labeled impact rails with a source note — by name; campus meters are FAT bars with % caps and no source line.
- FORME's WOD interval bar (coloured effort blocks with durations) and its rolling odometer counters — by name; a CAMPUS timeline is always the timetable grid.
- Gradients of any kind, including "subtle" ones and photo overlays; icon-font glyphs; illustrations of smiling students with books.
- Superlatives without a figure ("excellence", "leader"); any manufactured scarcity or countdown; prices behind "nous consulter", timetables "sur demande", results with no denominator.
- Monospace, telemetry captions and SKU-style references; testimonial carousels and sliders (exactly one static quote block per page).
- Rainbow palettes: never a third support color, never a colored border on white, never colored body text.

## LES GESTES (the moves menu)
- LE DAMIER DES FILIÈRES — 2–4 program blocks in a row, at most two saturated (sky, navy) against one sand and one hairline-white; each ends on a big price with its period and one text link. Structure, not decoration.
- LA SEMAINE — the timetable sheet: a white 14px sheet on a tinted ground with its headline row ("Semaine du 15 au 19 février — Licence 2"), its legend chips, the grid with its Libre cells, a note on cancellations. Its n=1 form, LA VIGNETTE DU JOUR, is the hero's furniture and is played on every build.
- LE RAIL D'ADMISSION — numbered steps on a filling track ending in the sand date flag; the page's one scrubbed showpiece when played.
- LES JAUGES — the meters block: heading and white fact plates left, fat bars with % caps right, on sand.
- LA MOSAÏQUE DE CAMPUS — a 12-column photo grid: one wide frame, one tall frame over two rows, one small frame, one navy quote block; caption chips beneath.
- LA PLAQUE DE FRAIS — one white plate per payment, what is included and what is not, and the line stating there are no file fees.
- LE MOT D'UN ANCIEN — one static quote in a navy 14px plate at clamp(1.08rem,1.42vw,1.34rem) over 4 of 12 columns (34–40 character measure), attributed to a name, a promotion year and a job — never a carousel, never a face.
- LE COMPTOIR D'INSCRIPTION — the form as a front desk: numbered list of pieces left, white form plate right, honest success state.
- LA FICHE PRATIQUE — a hairline table of practical facts (transport, cantine, horaires, assurance), one per row.
- LE PLAN EN BLOCS — a flat plan of the site in rounded 14px blocks with numbered rooms, when the buildings are the argument.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- **LA RENTRÉE** (école supérieure privée, 4 filières). Hero: bottom-aligned split — chip, four-line headline with one sky word, lede, filled button plus text link, a 3-cell stat rail on a navy rule; right, the day-vignette stacked over the campus photograph, both bleeding off the edge; the sand date strip closes the viewport. Showpiece: the admission rail filling across a pinned navy band, discs turning sand one by one, ending on the rentrée flag. Order: filières damier → timetable sheet → photo mosaic → rail → meters on sand → FAQ → inscription. Mood: an institution with nothing to hide.
- **LA GRILLE** (centre de langues, 6 niveaux). Hero: the timetable IS the first viewport — a full-width week grid, the headline in the top-left cell area, the CTA a course card in the Thursday slot. Showpiece: the week PLAYS, columns filling day by day on scrub while the chosen level brightens. Order: grid hero → levels as meters (A1→C1) → tarifs plates → photo strip → inscription. Mood: everything is a slot you can book.
- **LE PALIER** (coding bootcamp, 9 mois). Hero: three stacked full-width bands — sky with the claim, sand with three numbers, white with the CTA and one wide photograph. Showpiece: the meters race, six skill bars filling in sequence, the last landing on the hiring rate. Order: band hero → programme damier → meters race → alumni quote plate → rail → inscription. Mood: measurable, unsentimental, encouraging.
- **LA COUR** (crèche et préscolaire). Hero: a photo panel on the left 60%, a pale-sky plate on its inner edge carrying the headline, one lede line, the visit CTA. Showpiece: LA JOURNÉE — one day as a single week-grid column from 07:30 accueil to 17:00 départ, each hour card landing as it scrubs, nap and meal blocks in sand. Order: photo-plate hero → journée → sections by age → fiche pratique → meters (encadrement, places) → inscription. Mood: exact and reassuring at midnight.
- **LE TABLEAU** (préparation universitaire). Hero: numeral-led — a giant display figure ("94 %") right, over its caption rule, claim and lede left, no photograph above the fold. Showpiece: LE MUR DES ADMISSIONS — school-name chips filling in on scrub while one counter climbs. Order: numeral hero → matières damier → admissions wall → révision timetable → tarifs plates → FAQ → inscription. Mood: a scoreboard that respects the reader.
- **LA PASSERELLE** (formation continue). Hero: the enrollment desk — a pale-sky block left with the claim and the next-session plate, a white column right listing four sessions as hairline rows with dates, durations, prices. Showpiece: LE DOSSIER — application pieces stacking into a folder on scrub, the last stamped with the response delay. Order: desk hero → sessions rows → dossier → meters (financement, retour à l'emploi) → employer chips → inscription. Mood: an administration that decided to be easy.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or this world collapses into the school-template swamp. FIRST, THE PUBLISHED DATA: a real timetable with real rooms and real empty slots, real prices in DZD with their payment moments, real percentages with their denominators — figures a secretary could confirm on the phone. SECOND, THE BLOCK DISCIPLINE: flat 14px blocks, 999px chips, zero shadow, two support colors, one navy band; one soft shadow or one gradient and the page becomes every other education site. THIRD, THE TIMETABLE IN THE FOLD beside a headline at its floor scale, clamp(2.35rem,5.5vw,4.35rem) at -0.022em: the day-vignette against that wall of type IS the two-second signature. The cheap details cost nothing: the "Libre" cells left honest, the thin space inside 285 000 DA, the caps period under every price, the sand period after the footer wordmark, the line telling you what to do if nobody calls back.`,
};
