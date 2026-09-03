import type { DesignWorld } from "../types";

/**
 * AFFICHE — the print-shop poster wall.
 * Family: poster-type. Display caps optically fitted to 100% of the viewport
 * width, flat poster grounds rotating cream/cobalt/vermilion/mustard section
 * by section, giant punctuation glyphs as the only art, zero borders and zero
 * shadows anywhere. Proven against the FESTIVAL SIROCO demo (music festival,
 * Marseille); every value in the doc shipped there. fusesWith rationale —
 * manifeste: the manifesto takes color for event campaigns; bloc: the poster
 * opens a shop — drops and launches.
 */
export const affiche: DesignWorld = {
	avoidFor: [
		"aesthetic clinic",
		"notary",
		"jewelry brand",
		"psychology / therapy",
		"guesthouse / riad",
	],
	doc: `# DESIGN WORLD: AFFICHE — the print-shop poster wall

## Philosophy
This page is a WALL OF FRESHLY PASTED POSTERS, not a website — the flank of a print shop the morning the new run went up, read from across the street in two seconds. Its first structural fact: the headline is CUT TO THE SHEET — display capitals optically fitted to fill exactly 100% of the viewport width, edge to edge, the way a compositor locks type into a chase. Not big: FITTED — the line touches both edges at 1440 and again at 390. Its second structural fact: no two sections share a ground — each is a flat sheet of poster color rotating through the cream/cobalt/vermilion/mustard register, hard-cut at the seams; the rotation is the pagination and the only divider the page owns. Its third structural fact: FLAT INK. Zero borders, zero shadows, zero gradients, zero border-radius, zero outlined boxes — fields of color, filled type and 2px typographic rules are the entire visual system, exactly what one silkscreen pass can print. Where another world would spend on imagery, this one enlarges PUNCTUATION: one giant !, ?, * or → per section, set in the sheet's ink at half the viewport's height, always MEANING something. Impossible failure modes: a timid hero, a grey page, a card with a soft shadow, a bordered box, a photograph. Self-audit before shipping (count them): at least ONE line optically fitted to the full viewport width AND one full-strength poster color (a colored ground or the colored selvedge band) inside the first viewport at 1440×900; at least THREE different poster grounds before the footer with no two adjacent sections sharing one; ZERO border-radius, box-shadow, gradient or outlined box page-wide; every colored sheet holding exactly two inks (ground + text, page-ink furniture aside); TWO to FOUR giant punctuation glyphs page-wide, each with a stated job; the footer monument wordmark cropped by the page's bottom edge.

## The variation contract (why two AFFICHE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- The fitted-headline law: 1–2 fitted lines in the hero, 2–5 page-wide, each a single line filled to 100% of its container's width by the fit script (spec in Typography); a fitted line never wraps.
- The rotation law: at least three poster grounds before the footer, no two adjacent sections alike, cream returning every 2–3 sheets as the paper breath; grounds FLAT, seams hard-cut.
- The flat-ink law: radius 0, shadow 0, gradient 0, no outlined boxes anywhere; rules exist only at 2px.
- Two inks per sheet (plus the page-ink furniture license, spec in Color physics); giant punctuation rationed to one per section, 2–4 per page, each with a job.
- Display caps from the Anton / Passion One register; slab-slide motion; exactly ONE showpiece from the rotative family.
- Fixed opening (la une, with color at the fold — law in Page chassis) and fixed closing (la réservation + the ink-ground monument footer).
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes inside each register: cobalt anywhere in #1F49C7–#173FB4, vermilion #D93A2B–#C42F1F, mustard #E3A81C–#D69A10, cream #F1E3C8–#EFE0BE, ink #1A1714–#201B15.
- The ROTATION ORDER — which ground opens the page, where cream breathes, which sheet carries the form.
- The display face WITHIN the register: Anton OR Passion One — one per site, never both.
- LE CRI — the one shouted phrase that drives the page (« Trois jours face à la mer », « La pâte a levé cette nuit », « Le code en trois semaines »). It chooses the fitted lines, the glyphs, the voice and the section order.
- Which glyphs are enlarged and what each one means on THIS page.
- The showpiece variant inside the rotative family, the 2–3 gestes played, and the order of the free middle.
An AFFICHE page without its cri is a failure: write the shout FIRST, then size it to the sheet.

## The vibe (voice)
Street-crier French: short, sonorous, said out loud once and remembered. The one world where the exclamation mark is a legal material — rationed like any ink (≤3 in running copy, giant glyphs aside). The page ANNOUNCES: dates, places, prices, names, said flat and proud. Register lines:
- « Trois jours. Deux scènes. Le vent fait le reste. »
- « Collée ce matin, sèche à midi, complète ce soir. »
- « 39 €. Venez tôt, repartez tard. »
Numbers stay honest (39 €, 24 groupes, 12 food-trucks) — the poster's bravado lives in scale, never in fake urgency. The reader is « vous », a passer-by whose bus leaves in one minute.

## Visual signatures
- THE FITTED HEADLINE (owned tic): a single line of display caps, white-space nowrap, optically fitted to 100% of its container's width. The fit script multiplies font-size by (container width ÷ measured line width) in two passes — on load, on fonts-ready and on resize (debounced 150ms) — with a 0.998 safety factor; the CSS fallback sets each fitted line in vw within ±10% of its true fit so the page reads full-bleed even script-dead. line-height 0.82–0.92, tracking 0–0.02em.
- POSTER-GROUND SECTION ROTATION (owned tic): each section a full-bleed flat sheet from the four-ground register; seams are hard horizontal cuts with no separator, no gradient, no shadow — the color change IS the seam.
- PUNCTUATION AS GRAPHIC (owned tic): one glyph per section maximum, 2–4 per page, set in the display face. Full-bodied glyphs (!, ?) show 40–75vh of visible glyph, em clamp(17rem, 56–60vh, 34rem); sparse glyphs (*) run em clamp(28rem, 80vh, 50rem) and sit near-whole (30–55vh of star), their sheet adding up to 30vh of bottom padding so the glyph owns clear ground off the content columns. Filled, full-strength in the sheet's text ink, allowed to crop at the sheet's edges, always aria-hidden, and always meaning something: ! carries the claim, ? fronts the questions, * points to the honest fine print (which must exist), → aims at something real, « » flank one shouted quote. When the display face lacks a glyph (→ in Anton), draw it as a flat filled SVG in the same ink — never outlined, never rotated.
- The selvedge band: a full-width strip 6–9vh tall in a DIFFERENT ground carrying exactly one line (dates, the lineup, an announcement) — the page's smallest poster, and the rotative's pasted edge.
- Rules at 2px only, in the sheet's text ink at 100% or 30% — between rows, under labels, atop meta strips. 1px is too shy, 3–4px is BLOC's border language: 2px, always.
- Labels: Archivo 700, uppercase, 0.78–0.9rem, +0.06–0.1em tracking, anchored by a 56×2px rule stub or a 2px rule above — never floating free on bare ground.
- L'affichette: the card replacement — a mini poster with its own flat ground, no box, no radius, a display-caps title and one meta line; walls of affichettes butt edge to edge at gap 0, adjacent cells never sharing a ground.

## Color physics
- THE FOUR GROUNDS (registers — the client picks the exact hex, the physics is law): cream #F1E3C8–#EFE0BE (the paper: base and breath), cobalt #1F49C7–#173FB4, vermilion #D93A2B–#C42F1F, mustard #E3A81C–#D69A10. INK #1A1714–#201B15 is the page ink.

FIXED TOKEN MAP — CREAM→--background · INK→--foreground · COBALT→--primary · CREAM→--primary-foreground · MUSTARD→--secondary · VERMILION→--accent · ink at 55%→--muted · ink at 30%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, register pick or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Text law per ground: cobalt and vermilion sheets set ALL text in cream; cream and mustard sheets set all text in ink. No mid-tones, no opacity steps below 30%, no third text color on a colored sheet.
- TWO INKS PER SHEET: a colored sheet prints its ground + its text color, nothing else — with ONE standing license: the page ink #1A1714 may appear on any sheet as small furniture and hover fills (≤10% of the sheet's area). Cream sheets carry a second license: ONE accent word or glyph per sheet may take cobalt or vermilion.
- The footer is the only INK-ground sheet on the page (le dos de l'affiche); body sections never go ink.
- Body prose on vermilion or cobalt stays short (≤4 lines per block); long reading happens on cream and mustard.
- Gradients exist NOWHERE — not as texture, not as "paper warmth", not inside buttons. A sheet is one flat value or the press is broken.

## Typography system
- DISPLAY: Anton (400) OR Passion One (700/900) — one per site. Display type is CAPS ONLY at and above 2rem; lowercase display is a failure. Never italic, never outlined, never tracked beyond +0.02em.
- BODY: Archivo 400–600 (700 reserved for labels and buttons); 1–1.2rem, line-height 1.5–1.6, measure ≤36em, flush left, ragged right. Long paragraphs never center.
- Scale registers: fitted lines obey the fit law (expect 12–34vw equivalents); sub-display clamp(2.2rem, 6vw, 5.6rem); prices, dates and hours in the display face at clamp(2.6rem, 8vw, 7rem) with currency and affixes at 35–45% of the numeral size; labels 0.78–0.9rem as spec'd above.
- Numerals sit in the DISPLAY face wherever they are the point (prices, dates, stats); Archivo carries them inside prose.
- Emphasis is size, the cream-sheet accent ink, or a glyph — never underline slabs (MANIFESTE's), never marker highlights (BLOC's).
- Mobile law (≤820px): the fit law is responsive by definition — fitted lines refit and still touch both edges at 390; sub-display re-clamps to ≥9vw of the small viewport.
- ARABIC PAIRING: an Arabic build sets display in Cairo 900 or Changa 800 (tracking 0; the fit law unchanged), body in Cairo 400–600; RTL mirrors the arrows (→ becomes ←), the label rule stubs and the crop side of edge-cropped glyphs. Rotation law and flat-ink law unchanged.

## Signature art / components (the press is the artist)
There is no photography and no illustration — ever. The imagery budget is spent on grounds, fitted type and giant punctuation; every scene is real DOM text (screen readers hear the poster).
- The glyph system: each glyph is a decision, declared by placement beside the claim, questions, footnote, CTA or quote it serves; glyphs crop at most two edges and never loop-animate.
- Buttons: flat rectangles at min(var(--radius), 0px) — this press cuts every corner square — no border; fill = the sheet's text ink, label = the sheet's ground, Archivo 700 uppercase 0.85–0.95rem, padding 1–1.15em × 1.9–2.4em. Hover and :focus-visible swap the fill in ≤120ms: to vermilion on cream sheets (the accent license), to the page ink elsewhere. Nothing lifts, glows or casts.
- Links: 2px underline in currentColor; hover/focus fill the link with the text ink and flip its color to the ground, same ≤120ms hardness. Touch and keyboard receive identical states.
- Forms: fields transparent with a 2px bottom rule in the sheet's text ink at 55% (full strength and 3px on focus); labels above in the label style; phone-first (type=tel before email; tel is the only required channel); select is flat (appearance:none, a real ▾ glyph, radius 0). Submit is a flat button. The success state is an honest spoken line in a role="status" region (« C'est noté ! On vous rappelle avant ce soir. ») plus the real next step. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields FLAT in detail (name, phone, email, plus the brief's fields); one decoy input with attribute data-wandit-hp sits off-canvas (position:absolute; left:-4000px; tabindex="-1"; aria-hidden="true") and is never read, validated or styled by the page's own script.
- Favicon: inline SVG data URI — a cream square carrying one display-weight glyph (the brand's initial or !) in vermilion or cobalt.

## Page chassis
- Containers: prose ≤36em; content grids cap 1240–1360px; fitted lines and selvedge bands run 100vw by law; section padding clamp(4.5rem, 10vh, 8rem) vertical, clamp(1.25rem, 4vw, 4rem) horizontal.
- Header: absolute over the first sheet, never fixed, never blurred — wordmark (display face, 1.1–1.4rem) left; one real tel link and one CTA anchor right.
- FIXED OPENING — LA UNE: the poster pasted this morning. One or two fitted lines carry the name and the essential fact (dates, city, the cri); a lede of ≤2 sentences; one CTA anchored to the closing form; the fold closed by a selvedge band or a 2px-ruled meta row of real facts (place — dates — price floor). Cream is the default hero paper; any ground may open. COLOR AT THE FOLD (law): at 1440×900 the first viewport must already show one full-strength poster color — either la une opens on a colored ground, or its colored selvedge band sits FULLY inside the fold; on a cream hero the closer is therefore the selvedge, and the hero's vertical spends are budgeted so the band lands above the fold edge. A fold that is only paper-and-ink reads as MANIFESTE, not AFFICHE.
- FIXED CLOSING — LA RÉSERVATION, then LE DOS DE L'AFFICHE: the form per the spec above on a colored sheet, one glyph aimed at it; then the footer on the page's only ink ground — a colophon of real links (tel, mailto, address), one honest mention line, and the monument: a fitted wordmark cropped 20–35% by the page's bottom edge.
- FREE MIDDLE — compose 3–5 from the gestes vocabulary (le placard, la grille horaire, le tarif sec, le mur d'affichettes, le bandeau, la question, la citation criée), no two adjacent sections sharing a layout scheme OR a ground. The rotative showpiece lands between 30% and 60% of scroll.

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
Registry personality: SLAB SLIDES — whole color blocks push in. Nothing fades politely, nothing bounces: content arrives as a poster is pasted — one mass, decisively.
- Gate every animation on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state is set with gsap.set — NEVER in CSS. Script-dead, the page is a complete pasted wall and the rotative rests fully pasted with all its edges showing.
- Easing register: expo.out for every entrance (0.55–0.9s); power2.out inside the rotative's paste beats; instant swaps (≤120ms) for hovers. back/elastic/bounce never; rotation never; scale only for 2px rules drawing in (scaleX 0→1, 0.4s, transform-origin on the text's axis).
- Entrances: a section's content slides as ONE slab from y 48–72px; fitted hero lines slide up 80–100px with a 120–140ms stagger; glyphs slide in laterally from their nearest edge (x ±120–160px); row collections stagger 70–110ms; rules draw after their content lands.
- THE SHOWPIECE — LA ROTATIVE (mandatory, one per page, pinned + scrubbed): posters paste over each other like a billsticker working the wall. Pin 100vh, end +=220–280% (mobile +=180%), scrub 0.5–0.8. Three to five full-viewport posters: poster k slides from y:104vh to its pasted rest, each leaving the previous poster's top selvedge (6–9vh) visible — the final frame is a readable INDEX of pasted edges plus the last poster in full. Variants inside the family (each build picks ONE): the bottom-up paste (above) · the side paste (posters push in from alternating left/right edges, vertical selvedges remaining) · the squeegee pass (a full-height ink slab sweeps across, the new sheet revealed behind it via clip-path inset) · the wall fill (a gapless affichette grid pastes cell by cell in reading order) · the column roll (one narrow pinned column where posters roll vertically while the copy column stands still).
- Hover: flat ink swaps ≤120ms (buttons and links per Components; affichettes trade ground and text ink whole); arrows translate x 0.35em toward their target; keyboard and touch parity always.
- Reduced motion: none — the composed wall IS the design; the fit script still runs (layout, not motion).

## Ban list (in addition to the global list)
- Black/white-only pages, live black↔white inversion flips, words-AS-layout structure — MANIFESTE's language. AFFICHE rotates COLORS and keeps normal section structure beneath the fitted line.
- 3–4px solid borders, hard black offset shadows, rotated clashing price-chips, marker-highlight underlines — BLOC's language. AFFICHE is flat: a price is a giant flat numeral.
- Rotated crossing marquee strips, outline/stroked display type, ghost stroked numerals, difference chrome, telemetry captions — CINÉTIQUE's language. Nothing rotates and every glyph is filled.
- Torn-paper edges, tape strips, misregistered 2-color ghost layers, toner grunge — FANZINE's language. These sheets print with sharp edges and perfect registration.
- Diagonal slice transitions and the chant stack (one word escalating in rows) — MAILLOT's language. AFFICHE seams are horizontal; no word repeats downward.
- Colored offset shadows and memphis confetti — TUTTI's. Die-cut sticker halos and peel corners — GOMMETTE's. Soft-shadow floating cards — CLAIR's. Halftone-dot imagery and masthead furniture — GAZETTE's. Letter-spaced whisper labels on bare ground — ÉCRIN's.
- Photography, illustration, icon fonts or emoji anywhere — the ground, the type and the glyph are the only images.
- Any border-radius, box-shadow, gradient or blur anywhere — including form fields, buttons and section transitions.
- More than one giant glyph per section, or a glyph with no stated job.
- A fitted line that wraps, or a "fitted" line that stops short of the edges — 90% of the viewport is a big font, not a fit.
- Grey or desaturated section grounds — every sheet is a full-strength poster color or cream.
- A monochrome first viewport — cream-and-ink alone above the fold; the color-at-the-fold law (Page chassis) applies.
- Fake urgency furniture: countdowns, "dernières places", pulsing badges — the poster announces.

## LES GESTES (moves menu)
1. LA UNE — the opening paste (full law in Page chassis). Entrance: lines slide up staggered, the band arrives last.
2. LE PLACARD — the claim sheet: one giant glyph (usually !) at 40–75vh, whole or cropping one edge, a sub-display claim and short copy in the remaining column, a fact row of display numerals under a 2px rule.
3. LA ROTATIVE — the showpiece paste-up (full spec in Motion identity). The page's only pin.
4. LE MUR D'AFFICHETTES — a gap-0 grid of mini posters (2 columns at 390, 3–4 at 1440), each cell its own ground, no two neighbors alike; hover/focus trades a cell's ground and ink flat. One cell may be the CTA sheet.
5. LA GRILLE HORAIRE — the program: the day or stage in display caps left (clamp(2.6rem, 7vw, 6rem)), acts and facts in Archivo right, 2px rules between rows, alternating row indents so the column never reads as a plain list.
6. LE TARIF SEC — prices as display numerals (clamp(2.6rem, 8vw, 7rem)) with the currency at 35–45%, the offer name above, 2–3 honest inclusions below, columns split by 2px vertical rules — no chips, no boxes, no "populaire" badge. The * license: one giant asterisk pointing to one real footnote line.
7. LA QUESTION — infos pratiques: a giant ? fronting 3–5 question/answer pairs split by 2px rules; questions in display caps, answers in body prose.
8. LA FLÈCHE — a giant → doing real wayfinding: crossing the seam toward the next sheet or aimed at the form (the flat-SVG and hover-nudge laws above apply).
9. LE BANDEAU — two to four stacked selvedge bands, each its own ground, each carrying one line (announcements, dates, the lineup).
10. LA CITATION CRIÉE — one shouted quote flanked by giant « » in the sheet's ink; attribution in the label style beneath a 2px rule. One per page maximum.
11. LE COLLAGE DÉCALÉ — one block pasted across a seam: a selvedge, affichette or CTA overlapping the next sheet by 3–5rem, proof the wall is layered. Once per page.
12. LA SIGNATURE MONUMENT — the closing ritual (full law in Page chassis): the form sheet with its glyph, then the ink footer's cropped monument.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. FESTIVAL SIROCO — music festival, Marseille (the shipped proof). Cri: « Trois jours face à la mer ». Hero la une on cream: SIROCO fitted huge above a second fitted line « 21–23 AOÛT, MARSEILLE », lede + CTA, a cobalt selvedge of the lineup closing the fold. Middle: le placard (! on vermilion) → la rotative as the lineup (four artist posters pasting bottom-up, the day index building on top) → la grille horaire on cobalt → le tarif sec on mustard with the * footnote → la question on cream. Closing: form on vermilion with a flat SVG →, ink monument « SIROCO 2026 ». Mood: sea wind on hot paper.
2. POMODORO — pizzeria, Lyon. Cri: « La pâte a levé cette nuit ». Hero: fitted POMODORO, a giant vermilion ! filling the right third, cropped by the fold. Showpiece: the squeegee pass — an ink slab sweeps the pinned menu sheet, each pass printing a pizza name and price. Middle: le tarif sec of the four pizzas, a bandeau of hours, la citation criée from a regular. Mood: oven-hot vermilion on cream.
3. SOMMET PAPIER — design conference, Brussels. Cri: « Deux jours, quarante affiches ». Hero: le mur d'affichettes AS la une — a gap-0 grid of speaker affichettes, the conference name fitted across its bottom edge. Showpiece: the wall fill — the same grid pastes cell by cell on scrub until full, the final cell the ticket sheet. Middle: la grille horaire of talks, la question for the venue. Mood: print biennale, cobalt-led.
4. KLAXON — driving school, Casablanca. Cri: « Le code en trois semaines ». Hero: fitted KLAXON locked to the TOP edge of a mustard sheet, a giant → beneath aiming at a three-fact meta column (prix, durée, taux de réussite). Showpiece: the side paste — three steps (code, conduite, examen) push in from alternating edges, vertical selvedges stacking like tabs. Middle: le tarif sec of the forfaits, la question. Mood: pop civic yellow.
5. LA CRIÉE — venue / salle des fêtes, Algiers. Cri: « La salle rouvre en septembre ». Hero: le bandeau as la une — three stacked full-width strips (cobalt/cream/vermilion), each carrying one fitted line: name, reopening date, city. Showpiece: the strip cascade — the season's program prints as selvedge bands appearing top-to-bottom in hard beats, one event per strip. Middle: le placard (!), la citation criée from the mayor, form on cobalt. Mood: municipal theatre in flat inks.
6. CHICHE — street food truck, Paris. Cri: « Chiche ! ». Hero: la citation criée as la une — giant « » flanking the name at 20vw on vermilion, one meta line beneath (« mardi–samedi, quartier par quartier »). Showpiece: the column roll — a pinned narrow poster column rolls the week's five locations while the copy column stands still. Middle: le tarif sec (three formules), le mur d'affichettes of the menu. Mood: red, fast, funny.
7. TONUS — gym, Marseille. Cri: « Ouvert de 6h à minuit ». Hero: a giant * at 70vh as hero art on mustard, fitted TONUS along the bottom edge cropped 15%, the honest footnote beside it: « * sans engagement, vraiment ». Showpiece: the column paste — the seven day-columns of the weekly planning paste downward across the pinned grid. Middle: le tarif sec, le placard (!), la question. Mood: early-morning mustard energy.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: THE FIT (at 90% of the viewport width it is a big font; at 100% it is a poster — the line touches both edges at every width), THE ROTATION (grounds full-strength, flat and hard-cut; one soft gradient or one grey sheet and the wall becomes a website), and FLATNESS (one border, one shadow, one rounded corner, and the sheet becomes a card UI — the press prints none of these). The cheap details that separate it from a generated page: the selvedge bands, glyphs that visibly mean something, the two-inks-per-sheet discipline, gap-0 affichette walls, prices set in the display face, 2px rules where a lesser page would draw boxes, and hover states that swap inks flat instead of lifting. When in doubt, print louder: make the line touch the edges, give the glyph its full height, let the seam cut hard. Paper is cheap; timidity is expensive.`,
	energy: "loud",
	family: "poster-type",
	fusesWith: ["manifeste", "bloc"],
	id: "affiche",
	industries: [
		"festival",
		"conference / summit",
		"venue / salle des fêtes",
		"DJ / entertainment",
		"event planner",
		"music / band",
		"design studio",
		"marketing / branding agency",
		"fast food",
		"street food / food truck",
		"pizzeria",
		"food delivery brand",
		"driving school",
		"gym / fitness club",
	],
	kind: "website",
	mood: ["loud", "printed", "flat", "street", "festive"],
	name: "Affiche",
	preview: {
		accent: "#1F49C7",
		fontFamily: "Anton",
		ground: "#F1E3C8",
		ink: "#1A1714",
		sampleWord: "AFFICHE",
	},
	priceFeel: "accessible",
	tagline:
		"L'affiche criée : capitales pleine largeur, quatre encres plates qui tournent.",
};
