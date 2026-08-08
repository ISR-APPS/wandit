import type { DesignWorld } from "../types";

/**
 * ZELLIJ — the tiled courtyard.
 * Family: zellige. White plaster carrying bands and panels of TRUE
 * star-and-polygon tessellation in three glazes (cobalt, emerald, honey),
 * per-tile hue jitter, grout gaps, tile-chip navigation. Geometry as
 * celebration; craft heritage said in pattern, never in ornament. Proven
 * against the Hammam El Bahdja demo (spa / hammam, Algiers, DZD, French);
 * every value in the doc was shipped there.
 * fusesWith rationale — diwan: the frame meets the tile, the full riad
 * language; promenade: glazed tiles meet the sea — Mediterranean hospitality.
 */
export const zellij: DesignWorld = {
	avoidFor: [
		"dev tool",
		"car dealer",
		"SaaS product",
		"crossfit / functional",
		"security company",
	],
	doc: `# DESIGN WORLD: ZELLIJ — the tiled courtyard

## Philosophy
This page is A COURTYARD WALL IN WHITE PLASTER carrying bands and panels of glazed tessellation the way a riad's patio carries its zellige: rationed, load-bearing, joyful. The pattern is never wallpaper — it is TILEWORK, laid tile by tile, and the page's only imagery. First structural fact: GEOMETRY LIVES ONLY INSIDE TESSELLATION — the eight-point star exists solely locked into its star-and-cross lattice; a star may NEVER float alone as glyph, bullet, badge or favicon. Second: PLASTER MAJORITY — tessellation occupies at most 40% of any viewport; the white ground breathes, the bands sing. Third: the THREE-GLAZE LAW — cobalt, emerald, honey, nothing else; every band commits to ONE lead glaze. Fourth: EVERY TILE IS HAND-CUT — per-tile hue jitter, visible grout, a ±1° wobble; two identical tiles betray the machine. Fifth: zero photography, zero drawn scenes — the glaze does the visual work. Structurally impossible failure modes: pattern behind running text; an arch anywhere (MATIÈRE); an engraved frame or standalone star seal (DIWAN); a gradient-washed section. Self-audit before shipping: zero stars outside a tessellated field; tessellation under 40% of every viewport; exactly three glaze hues page-wide (plus their steps); every band names one lead glaze; grout visible between every pair of tiles; border-radius nowhere above 6px.

## The variation contract (why two ZELLIJ sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- The three tics: tessellated tile bands that assemble tile-by-tile, glazed-tile cards, tile-chip navigation.
- True tessellation geometry (the construction in Signature art), grout law, jitter law, plaster majority.
- The three-glaze physics and the registers below; text only on the deep step of a glaze; honey never sets text.
- Display El Messiri or Alexandria + body Cairo; never italic; radius register 2–4px; no blur shadows, no backdrop blur.
- Tile-by-tile grid assembly as the motion personality; one pinned showpiece maximum.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- Exact hexes inside each glaze register (a dustier cobalt, a deeper emerald, an amber honey) and which glaze LEADS the site (CTAs, links, the hero band).
- The display face within the register (El Messiri OR Alexandria, one per site).
- The COURTYARD CONCEPT that names the page — la cour, le bain, la terrasse — choosing the hero geste, the showpiece variant, the sections' names and the voice's temperature.
- Which pattern family each band plays, where the bands sit, the section order beyond the fixed opening and closing, which 2–3 gestes are played, the language (French, Arabic, English).
A ZELLIJ page without its courtyard concept is a failure: name it FIRST, then let it place the bands and choose the words.

## The vibe (voice)
Warm, concrete, unhurried — a house open sixty years. Short declaratives; craft vocabulary said exactly (le tesson, la glaçure, le gant de kessa, le savon noir, le maâlem); numbers plain (600 DZD, 90 min, depuis 1962). Register lines:
- "Depuis 1962, la ville descend se baigner sous nos carreaux."
- "1 244 tessons émaillés, posés un à un. Pas deux pareils."
- "On ne vous presse pas et on ne vous perd pas : la maison a un ordre, le voici."
No superlatives, no "luxe", no exclamation marks, no urgency. Prices are facts: "affichés en salle, les mêmes pour tous". Arabic and English builds keep the temperature.

## Visual signatures
- TESSELLATED TILE BANDS (owned tic), three formats — LA COLONNE: a vertical band clamp(180px, 21vw, 270px) wide holding a hero's edge (viewBox 240 units wide, tile radius R=40, absolutely positioned to fill its column, min-height 560px); LE PANNEAU: the showpiece wall (12×7 periods at R=45, ~1080×630 viewBox, framed); LA FRISE: a one-period strip, full star row centered, cross halves clipped top and bottom (R=36, rendered clamp(40px, 6vw, 64px) tall, full-bleed, preserveAspectRatio slice). Every band assembles tile-by-tile on entrance or scrub.
- GLAZED-TILE CARDS (owned tic): content cards AS single large glazed tiles — deep-step glaze ground (#185E99 / #175E49 / #154C77, or honey #D9A13B with ink text), 3px grout-line border (#DCD2B8) plus 1px ink-16% outline, radius 4px, ONE diagonal glaze sheen per card (linear-gradient 135°, white 20–24% fading out by 45%), a small tag chip in white-18% (ink-14% on honey), display-face title, price in display 1.9rem with the currency in 0.72rem caps.
- TILE-CHIP NAVIGATION (owned tic): nav links ARE square glazed chips — padding 0.42em 0.85em 0.5em, corners consuming var(--radius) directly (the register's 3px cut), 0.78rem/700 caps +0.08em, deep-glaze grounds rotating cobalt/emerald/honey through the row (honey carries ink text), inset 1px white-22% rim as the glaze lip; hover/focus deepens one step. A ghost chip (2px grout-line inset ring) holds the phone.
- THE GROUT LAW: tiles shrink to 94% of their cell around their own center (damier squares 90%), leaving 4–7px optical joints; each tile rotates ±0.9°; grout is never pure white — #E9E1CE on plaster, #123F63 under honey friezes on deep glaze, #0E2530 on ink. Butt-joined tiles read as vector clipart — forbidden.
- THE JITTER LAW: every fill jittered from its base — hue ±3°, saturation ±4, lightness ±5–6. Crosses always bone (#F4EDDC jittered), stars carry the glaze; 8–12% of stars swap to the first minority glaze, 5–6% to the second; 24–26% carry a specular sheen (the card gradient at opacity 0.09–0.17).
- THE CHALK GRID: 1px ink lines on the half-period lattice inside panels — the maâlem's layout lines. Rest opacity 0.12; rising to 0.55 during assembly, settling back to 0.12.
- Labels anchored on a chip: 0.68–0.78rem/700 caps, +0.12–0.16em tracking, preceded by a 12px glazed square (radius 2px) in the section's lead glaze; labels never float unanchored.
- Hairlines: 1px ink at 16% for outlines and header rules; 2px grout-line (#DCD2B8) for structural rules (fact rows, fold borders).

## Color physics
- GROUND: the white plaster register — #FAF6EF with #F4EDDD as its softer companion (for the showpiece and form sections). Bone #F4EDDC exists only as cross-tile fill. Never more than two plaster tones; ZELLIJ never alternates two warm grounds crowned by a dark interlude — that chassis is MATIÈRE's.
- INK: deep petrol #17323B (register #17323B/#142B33), soft ink at 72% for prose; never black.
- THE THREE GLAZES (the law): COBALT #1F6FB2, deep step #185E99, night step #154C77 · EMERALD #1E7A5F, deep step #175E49 · HONEY #D9A13B, deep step #C08A2D, light step #E8BE63. Each band, card, chip and section commits to ONE lead glaze; the other two appear only as minority tiles inside its tessellation, per the jitter law.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · the lead glaze→--primary · GROUND→--primary-foreground · the softer plaster companion→--secondary · the second glaze→--accent · ink at 72%→--muted · ink at 16%→--border · 3px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, glaze step or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- TEXT-ON-GLAZE LAW: plaster text sits only on the DEEP step of cobalt or emerald (≥4.5:1); honey carries ink text, always; light honey #E8BE63 is reserved for prices and numerals on deep grounds. Honey NEVER sets prose or labels on plaster.
- THE SITE'S LEAD GLAZE (client-owned) colors CTAs, links, the hero band and ::selection. The shipped demo leads cobalt.
- ONE full-bleed deep-glaze section maximum (le bassin) — night-step ground, plaster text, its foot closed by a frise in a second glaze. The footer sits on INK, never on a glaze.
- Gradients exist ONLY as the glaze sheen (white ≤24% fading by 45–50%) inside tiles, cards and button lips — never on grounds, never behind text. Box-shadows and blur do not exist; relief is inset zero-blur rims and the grout itself.

## Typography system
- DISPLAY: El Messiri (500/600/700) OR Alexandria (600–800) — one per site; both Arabic-capable. Masthead clamp(2.7rem, 7vw, 5.8rem)/700, line-height 1.06, letter-spacing −0.01em; section titles clamp(1.9rem, 4.2vw, 3.3rem)/600, line-height 1.12; cartouche and card lines 1.3–2.3rem. NEVER italic — emphasis is a glaze word or nothing.
- BODY: Cairo 400/600/700, 1rem–1.2rem, line-height 1.7, measure ≤58ch, ragged right. Centered paragraphs only inside cartouches and success states, ≤3 lines.
- LABELS: Cairo 700 caps per the anchored-chip law. Buttons: Cairo 700 caps 0.85rem +0.1em on glazed tiles (padding 0.85em 1.7em, radius 3px, inset white-25% top lip).
- NUMERALS & PRICES: the display face, currency in Cairo 0.68–0.72rem caps beside it. No tabular mono anywhere.
- ARABIC / RTL LAW: El Messiri sets display, Cairo sets body (both native Arabic); html dir="rtl"; letter-spacing 0 on Arabic script always; caps treatments become weight + glaze shifts; offset layouts and band positions mirror; the lattice is bidirectional; body line-height 1.8.
- HARD RULES: no serif, no monospace (style form controls with Cairo explicitly), Inter/Roboto/Open Sans never.

## Signature art / components (the tessellation construction — reproduce exactly)
- THE STAR: a 16-gon — union of two squares, one rotated 45°; vertices at angles k·22.5°, even k at radius R, odd k at 0.7654·R. THE CROSS: the 16-vertex polygon filling the star lattice — in units of R from its center: (0,−1), (0.29,−0.71), (0.29,−0.29), (0.71,−0.29), (1,0), mirrored around. Stars at every (2iR, 2jR), crosses at every ((2i+1)R, (2j+1)R); tips touch along the axes. LA FRISE shifts the lattice so one full star row sits centered, cross halves clipped at the edges.
- THE LAYING: each tile is an SVG group translated to its cell, path scaled to 94% (grout), rotated ±0.9°, filled with its jittered hex, carrying a data order attribute — reading order for bands (y then x; x then y for friezes), ring order for panels (ring = rounded distance from center in periods; order = ring×8 + random×5 so rings overlap slightly), diagonal order for damiers (i+j). Generate the SVG at build time with a seeded random — tiles are STATIC MARKUP, fully visible with scripts dead; only gsap.set may hide them.
- PATTERN FAMILIES (client picks per band): L'ÉTOILE-ET-CROIX — the master pattern, for colonnes, panneaux and frises; LE DAMIER — a checker of cut squares (cell 44–52px, 90% shrink, radius 2px, lead-glaze alternating with bone, ~8% of lead cells swapping to a minority glaze); LA FRISE — the star-row strip for rails, section feet and page edges.
- PANELS & FRAMES: 2px grout-line border + 1px ink-16% outline, radius 4px, overflow hidden, grout ground, chalk grid beneath the tiles. A framed showpiece carries role="img" and a real aria-label in the page's language ("Le panneau d'origine de la salle chaude — zellige étoile-et-croix, glaçure émeraude"); decorative frises are aria-hidden.
- LE CARTOUCHE: the plaster plate over or under an assembled panel — plaster ground, 2px grout border + 1px ink outline, radius 4px, centered: anchored label, a display line clamp(1.55rem, 3vw, 2.3rem), one soft-ink sentence. Centered via inset 0/margin auto — no transform, GSAP owns transforms.
- BUTTONS: glazed rectangular tiles; primary in the site's lead glaze deep step, ghost as a 2px grout-line inset ring with ink text; hover/focus deepens one step, 0.22s. Keyboard parity via :focus-visible (2px lead-glaze outline, offset 3px).
- FORMS — LE CARNET: the form is a GROUT GRID — container in grout-line #DCD2B8–#E2D8BE, padding 3px, grid gap 3px, radius 4px; each field is a plaster CELL (padding 0.9rem 1.1rem), caps label above a borderless transparent input; focus-within draws an inset 2px lead-glaze ring on the cell. Phone-first: type=tel, inputmode=tel, autocomplete=tel, right after the name; one select for the structured choice; one textarea; the submit is a full-width glazed tile row. SUCCESS (honest): hide the form ([hidden]{display:none!important} so author display rules cannot defeat it) and swap in, inside the aria-live="polite" wrapper, a small frise that assembles (6 periods, R=30) over "C'est noté." plus one concrete next step and the phone repeated. On valid submit dispatch on document the CustomEvent "wandit:lead" with the visitor's fields FLAT in detail ({ nom, telephone, soin, message }). Include ONE off-canvas decoy input with data-wandit-hp (absolute, left −9999px, tabindex −1, aria-hidden) that the page's own script never reads and never blocks on.
- FAVICON: inline SVG data URI — a tessellation CROP: one lead-glaze star centered with four bone cross fragments clipped at the corners, on grout. Never a lone star on empty ground.
- ::selection is the lead glaze with plaster text; one h1; semantic landmarks; every hover has a touch/keyboard equivalent.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 8rem); the showpiece takes a full pinned viewport. Container max 1200px, padding-inline clamp(1.25rem, 4vw, 3rem); frises and the deep section bleed full-width; prose ≤58ch.
- HEADER: slim, in-flow (never sticky-blurred) — display wordmark left over a 0.62rem caps place line, tile-chip nav right, 1px ink-16% hairline below. Under 640px keep three chips and hide the rest.
- FIXED OPENING — plaster-dominant hero with ONE tessellated element: LA COLONNE (band on one edge; text column: anchored label, the masthead h1, a lede ≤52ch in soft ink, a two-tile CTA row — primary + ghost phone chip — and at the fold a facts row on a 2px grout rule, each fact preceded by a 10px glaze chip in glaze rotation) or LE SEUIL. ≥1024px the hero grid holds min-height 74vh; below, content decides. On mobile the colonne lies down: a 64px frise between CTAs and facts.
- FIXED CLOSING: LE CARNET (copy column with the phone in display 1.7rem as a tel link + the grout-grid form), then LA SIGNATURE: ink ground, the wordmark at clamp(3.4rem, 14vw, 10.5rem) with ONE word in light honey, three caps columns (adresse, téléphone, heures), a hairline closing row ("Carrelé main. Chauffé au bois. Depuis 1962."), and a full-width frise flush at the page's bottom edge — the site signs off in tile.
- FREE MIDDLE: compose from the gestes; no two adjacent sections share a layout skeleton; at most ONE deep-glaze full-bleed; every label anchored on its chip.

## Motion identity (GSAP 3.12 + ScrollTrigger, cdnjs UMD)
THE GOVERNING LAW: hidden states are set ONLY by gsap.set in JS, never in CSS — scripts dead, the page is a finished, fully-tiled wall. Gate everything on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion).
- Personality: TILE-BY-TILE GRID ASSEMBLY. Everything arrives the way a maâlem lays tiles: one at a time, in a stated order, no bounce. Per-tile: scale 0.3–0.35→1 + autoAlpha, transformOrigin 50% 50%, 0.4–0.5s, power2.out (power3.out for markers and cards). NOTHING overshoots, ever.
- Stagger registers (the fingerprint): bands and frises each 0.006–0.012 in reading order; the hero colonne each 0.011 top-down behind the text timeline; damiers each 0.04–0.05 in diagonal waves; the panel scrub each 0.02 in ring order — always sorted by the data order attribute.
- Text: label → title → prose → facts, autoAlpha + y 24–44→0, 0.6–0.9s, staggers 0.06–0.12; header chips drop in y −10, stagger 0.06.
- THE SHOWPIECE — LE PANNEAU (one per page): pinned viewport, end +=260%, scrub 0.6, anticipatePin 1. Beat 1: the chalk grid rises 0.4→0.55. Beat 2 (from 12% in): tiles snap in ring by ring from the center star outward, minority-glaze tiles landing inside the sequence like accents. Beat 3: the grid settles to 0.12 as the wall completes. Beat 4: the cartouche rises (y 30→0, 0.55) with the section's promise. Held closing beat ~20% of the scrub. Mobile ≤767px: NEVER pin — the same assembly plays once on entry (each 0.007, ~1.8s) and the panel crops to height min(100vw, 430px) via slice so tiles stay big.
- Variants playable INSTEAD (same grammar, one per page): LA MARÉE (rows assemble bottom-up), LE DAMIER TOURNANT (diagonal waves across a pinned checker), LA FRISE QUI COURT (a pinned frise lays left→right, stops appearing at marked tiles), LES TROIS GLAÇURES (the assembled panel re-leads its glaze per beat via fill crossfades) — or ONE invented variant in the tile-by-tile grammar.
- Hovers 0.22s: glazes deepen one step, sheens strengthen or fade, ghost rings turn lead-glaze. Never transform hovers on GSAP-owned elements; touch gets resting states; :focus-visible mirrors every hover.
- FORBIDDEN MOTION: back/elastic/bounce overshoot (GUIMAUVE), strokeDashoffset self-tracing (ORFÈVRE), steps()/typed text (PHOSPHORE), parallax drift, marquees, letter-by-letter reveals.
- Reduced motion: everything at rest, panels fully tiled, grid at 0.12, cartouche legible — a composed still, never a blank.

## Ban list (world-specific, beyond the global list)
1. Arch geometry — arch frames, arch pills, arch buttons — plus drawn room miniatures with glowing openings, the material-swatch cabinet, the warm double-ground alternation with ONE deep inverted interlude, and full-page grain: MATIÈRE's language. ZELLIJ's corners are square-cut, its plaster clean white.
2. Engraved arabesque mirror FRAMES, the eight-point star as a standalone glyph (bullet, knot, seal), illuminated section openers: DIWAN's language. ZELLIJ's stars exist only interlocked in tessellation; the curated fusion is the only door.
3. The primary-color circle/triangle/square cast, thick baseline bars, rotating circular text badges: BAUPLAN's language — ZELLIJ's squares are tiles in a lattice, never free characters.
4. Memphis confetti fields, colored offset shadows, squiggle underlines, zigzag dividers: TUTTI's language.
5. Gold sunburst/fan crowns, stepped ziggurat frames, chevron dividers with a center gem, any metallic-gradient gold: FOLIES' language. ZELLIJ's honey is opaque glaze, never gold leaf.
6. Pattern as wallpaper — any motif repeating BEHIND running text or across a whole section ground. Tilework is a band, a panel, a frise or a card; as background, the world dies.
7. A star outside tessellation — including the favicon, bullets and empty-state art.
8. Photography, raster images, drawn scenes or illustration systems.
9. Border-radius above 6px, pills, circles; blurred box-shadows; backdrop-filter and glassmorphism.
10. Gradient grounds or washes; glaze sheens above 24% white or outside tiles/cards/buttons.
11. A fourth hue — the three glazes plus ink and plaster are the entire palette.
12. Monospace, telemetry captions, coordinates (CINÉTIQUE's voice); serif faces; italic anywhere.
13. Two pinned scenes, or a pinned showpiece on mobile.
14. Butt-joined tessellation — tiles touching with no grout.
15. Dark hero grounds (the one named inverted-hero sibling excepted; plaster majority must return immediately).

## LES GESTES (moves menu)
1. LA COLONNE — the canonical hero: a vertical band holding one edge (RTL-mirrored on Arabic), absolutely positioned so the text column owns the height; assembles top-down on load behind the masthead's rise.
2. LE SEUIL — the threshold hero: a full-width frise under the header, crowning the masthead alone on plaster; for names strong enough to stand bare.
3. LA FONTAINE — the courtyard plan: a centered square panel with four content cells around it on a 3×3 grid; the panel assembles ring-first, the cells rise after.
4. LES CARREAUX — the glazed-tile card row: 3–4 cards in glaze rotation, even cards dropped 2.6rem (≥1024px); intro seated beside the title in a two-column head.
5. LE PANNEAU — the default pinned showpiece: chalk grid, ring-by-ring assembly, cartouche promise (spec in Motion identity).
6. LA MARÉE — showpiece variant: the panel fills row by row from the bottom, water rising in a basin.
7. LA FRISE PORTEUSE — the carrying rail: a full-bleed frise crosses the section mid-height; 54px glazed number tiles sit on it, texts alternating above and below on a 4-column grid; on mobile the rail folds away and steps stack on a 3px grout left border, the numeral tile pinned to a 54px left column regardless of DOM order.
8. LE BASSIN — the ONE deep-glaze section: night-step ground, plaster text, tariff rows or the signature offer, prices in light honey display, a honey frise closing its foot.
9. LE DAMIER — the museum piece: a bordered 6×6 checker presented as a collection item with a 3px honey-bordered caption ("Damier de la salle froide — glaçure miel, posé main, 1962"); assembles in diagonal waves.
10. LE COMPTOIR — the tariff column: rows on plaster-25% hairlines — name 600, duration small caps, price right-aligned in display; the honest board "affiché en salle".
11. LE CARNET — the fixed-closing grout-grid form beside the copy column with the display-size phone.
12. LA SIGNATURE — the fixed footer: ink ground, giant wordmark with one light-honey word, caps columns, closing hairline row, bottom-edge frise.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
No two share a hero composition or a showpiece choreography.
- "HAMMAM EL BAHDJA" — spa / hammam, Algiers (the shipped proof). Hero LA COLONNE, cobalt lead, facts on the grout rule at the fold. Les carreaux for four soins in glaze rotation, then LE PANNEAU played straight: emerald wall, chalk grid, rings from the center star, cartouche "La chaleur d'abord. Le monde ensuite." La frise porteuse carries the four salles, le bassin holds the tariffs under a honey frise foot, le damier signs the maison. El Messiri. Mood: steam over cut glaze.
- "DAR EL AÏN" — guesthouse / riad, Tlemcen. Hero LA FONTAINE: the masthead above a centered square panel, four cells around it holding chambres, table, patio, saison. Showpiece LA MARÉE: a deep cobalt panel fills bottom-up like the patio basin at dawn, room prices surfacing row by row. Le comptoir for the nights. Alexandria, slower staggers (0.012). Mood: water heard before seen.
- "PÂTISSERIE EL WARDA" — patisserie / bakery, Oran. Hero LE SEUIL: a honey frise crowns the masthead alone on plaster — the shop's threshold. Showpiece LE DAMIER TOURNANT: a pinned honey/bone checker assembles in diagonal waves, each wave landing one season's carte (kalb el louz au Ramadan, la tarte aux figues en septembre). Les carreaux for the boxes, le carnet with a pickup-hour select. Mood: syrup, semolina, patience.
- "ATLAS & OASIS VOYAGES" — travel agency, Algiers. Hero split: masthead left, a horizontal frise running OFF the right edge — the road. Showpiece LA FRISE QUI COURT: a pinned frise lays itself left to right; at every eighth tile a plaster cartouche names the stop (Alger — Ghardaïa — Timimoun — Djanet), nights and prices beneath. La fontaine holds the formules. Quickest tile stagger (0.006). Mood: the corridor of departures.
- "MAISON KHEIRA, TRAITEUR" — traiteur / catering, Constantine. Hero LES CARREAUX D'ABORD: compact masthead, the three formules already at the fold as glazed cards (cobalt noces, emerald réceptions, honey aïd). Showpiece LES TROIS GLAÇURES: one pinned panel assembles once, then re-leads its glaze per beat — cobalt, emerald, honey — each naming its formule and per-person price in the cartouche. Le comptoir for the extras. Mood: abundance, measured.
- "STUDIO NOUR, COIFFURE" — hair salon, Casablanca (MAD). Hero LE BASSIN INVERSÉ: the one sibling whose first viewport is deep — night-cobalt hero, plaster masthead, an emerald frise at its foot; every following section returns to plaster majority. Showpiece LA POSE DU MAÂLEM: a pinned emerald panel laid in the maâlem's true order — border tiles FIRST, all four edges, then the field closes inward until the last tile, the centre star in honey, lands alone; the cartouche promises "le prix dit avant le peigne". Alexandria. Mood: precise hands, evening light.
- "LALLA MERIEM, NÉGAFA" — wedding services, Alger. Hero LA FRISE PORTE LE NOM: a full-width honey frise crosses the first viewport, a plaster cartouche seated at its center carrying the masthead — the name held by the tile. Showpiece LE TESSON RETOURNÉ: an assembled cobalt panel where, beat by beat, marked tiles FLIP (rotateY swap) to their honey face while the cartouche names the day's étapes (le henné, la kessoua, la dokhla). La frise porteuse becomes the day's hours; le carnet asks the date. Softest staggers. Mood: a day held like a panel.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
ZELLIJ lives or dies on THREE things at 100%: TESSELLATION TRUTH (the real 16-gon star and its cross, tips touching on the axes, grout between every tile — CSS squares pretending to be stars and the page becomes a bathroom-showroom template), the RATION (plaster majority per viewport; pattern behind text and the courtyard becomes wallpaper), and the ASSEMBLY (tiles genuinely arriving one by one in a stated order — reading, ring, diagonal — because the laying IS the brand's story). The cheap details that separate it from a generated page: hue jitter and the ±1° wobble, grout never pure white, minority-glaze tiles hiding in every band, the chalk grid under the showpiece, honey carrying ink while the other glazes carry plaster, the chip anchoring every label, the frise closing the page's last row. When in doubt, remove a band and let the plaster breathe — the tile sings loudest against white.`,
	energy: "medium",
	family: "zellige",
	fusesWith: ["diwan", "promenade"],
	id: "zellij",
	industries: [
		"spa / hammam",
		"hair salon",
		"nails & lashes studio",
		"skincare / esthetician",
		"guesthouse / riad",
		"hotel",
		"restaurant (classic)",
		"tea house",
		"patisserie / bakery",
		"traiteur / catering",
		"travel agency",
		"tours & excursions",
		"home & decor shop",
		"multi-product shop",
		"wedding services",
		"venue / salle des fêtes",
		"interior design / home staging",
		"painting & finishing",
	],
	kind: "website",
	mood: ["heritage", "maghrebi", "glazed", "geometric", "joyful"],
	name: "Zellij",
	preview: {
		accent: "#1F6FB2",
		fontFamily: "El Messiri",
		ground: "#FAF6EF",
		ink: "#17323B",
		sampleWord: "Zellij",
	},
	priceFeel: "accessible",
	tagline:
		"La cour carrelée : étoiles en tesselle, trois glaçures, plâtre blanc.",
};
