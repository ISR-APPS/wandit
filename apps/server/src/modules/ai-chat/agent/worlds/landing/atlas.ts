import type { DesignWorld } from "../types";

/**
 * ATLAS — the expedition atlas.
 * Parchment over faint topographic contours, sepia ink, a dotted teal route
 * that draws itself across the page connecting the sections like stops on a
 * journey, passport stamps and postmarks as badges, one compass rose.
 * Weathered, never measured; drawn, never photographed. Proof build:
 * CAP AZIMUT (Sahara tours & excursions, Djanet) in worlds/atlas/demo/.
 *
 * fusesWith bridges:
 * - promenade: the route reaches the coast — seaside travel.
 * - observatoire: land by day, sky by night — desert expeditions.
 */
export const atlas: DesignWorld = {
	avoidFor: [
		"aesthetic clinic",
		"SaaS product",
		"nails & lashes studio",
		"fine dining",
		"dev tool",
	],
	doc: `# DESIGN WORLD: ATLAS — the expedition atlas

## Philosophy
This page is a CHART PULLED FROM AN EXPEDITION ATLAS — a working map that has been folded, carried, annotated and stamped — not a website. Its defining structural facts: everything sits on parchment over faint topographic contour lines; a DOTTED ROUTE in teal ink draws itself across the page, connecting the sections like stops on a journey, and the reader travels it; every proof, price, badge and milestone is an inked PASSPORT STAMP or postmark; every image is drawn cartography — coastlines, dunes, hachured ridges, water lines, toponyms in tracked capitals — never a photograph. The governing temperament is WEATHERED, NOT MEASURED: lines waver, stamps sit crooked, ink pales where the paper aged; nothing here is drafted with a ruler, nothing is annotated with instruments (that precision belongs to GABARIT and is banned below). Structurally impossible failure modes: the stock dune-photo hero; the blue-globe travel-agency template; a page with no geography — ATLAS without real place names is a map of nowhere. Self-audit before shipping: zero raster img elements; one route that visibly connects at least 4 stops (double-circle nodes, never teardrop map-pins); at least 3 stamps, all indigo (parchment-inked only on the night band); contour grounds behind at least 2 sections; exactly ONE compass rose at size (the tiny rose glyph may repeat as a bullet); coordinates in mono at most once per section.

## The variation contract (why two ATLAS sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Parchment ground register, sepia ink, teal route, indigo stamps; contour-line grounds; drawn-map imagery, zero photography.
- The dotted route spine: one continuous journey the page's sections hang on, drawn on scroll.
- Stamps and postmarks as the badge system; they arrive with a thunk and stop dead — no bounce, ever.
- Route-travel motion: paths draw, a marker travels the line; everything else is unhurried.
- The weathered principle: hand-wavered strokes, crooked stamps, aged blotches; never dimension lines, never grids, never instrument precision.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside the registers below; the display face (IM Fell English or Libre Caslon Text, one per site).
- LE TERRITOIRE — each client is assigned its real geography (a Saharan circuit, a medina quarter, the Est-Ouest corridor, five capitals for a language school) and ONE ROUTE CONCEPT (the expedition loop, the walk to the door, the delivery corridor, the radiating spokes). The territory names the hero map, the showpiece, half the copy.
- The stamp vocabulary (what gets stamped: days, prices, languages, distances, "VISÉ"), the marker's shape (plain dot, compass needle, 4x4, truck, pen nib), section order beyond the fixed opening and closing, and which gestes play.
An ATLAS page with no named territory is a failure: name the real places FIRST — the route needs somewhere to go.

## The vibe (voice)
French in the register of a journal de bord — short factual sentences that smell of dawn and diesel, place names carried with respect, numbers stated plainly. Example lines: "Départ à l'aube. Le sable garde encore la fraîcheur de la nuit." · "Jour 3 — la guelta d'Essendilene. On remplit les gourdes, on se tait." · "Neuf guides, tous nés à Djanet. La carte, ils l'ont dans les mains." Vocabulary is exact and local — erg, reg, guelta, tassili, azimut, bivouac — never "destinations de rêve". Distances, seasons and prices are honest (42 km, octobre–avril, 62 000 DA); promises are modest (réponse sous 24 h). No superlatives, no exclamation marks, no emoji, never the machine-telemetry register — coordinates are geography, not telemetry.

## Visual signatures
- THE DOTTED ROUTE (owned tic): a 2–2.5px teal dashed path, round linecaps, dash pattern 0.1 9–12 (reads as dots), that draws itself across the page linking section stops. Each stop is a double-circle node (outer 7–9px ring 1.5px stroke, inner 3px filled dot) with its name in tracked caps. On desktop ≥1200px the route may run as a page spine in the left gutter; the showpiece map carries its richest run.
- STAMPS AND POSTMARKS (owned tic): rotated −8° to +6°, indigo #3D4E8C only, 2px borders (rounded-rect radius 4–6px, or double-ring circles with curved text on a path), uppercase 11–13px letters tracked +0.08em, ink imperfection via a soft radial mask that pales 10–25% of each stamp. Stamps carry FACTS: JOUR 2 · ESSENDILENE, 62 000 DA, VISÉ, DEPUIS 2012.
- CONTOUR GROUNDS + COMPASS ROSE (owned tic): 3–6 irregular closed contour loops per decorated section, sepia at 10–17% opacity, 1–1.5px stroke, occasionally labeled with an elevation (1 250 m, in mono 10px); ONE compass rose per page at 90–150px — an 8-point drawn rose, sepia line with the north point filled teal, letters N·S·E·O in the body face — plus an 8–12px rose glyph reusable as bullet.
- Weathered paper furniture: 2–4 age blotches per long section (radial gradients, sepia at 3–6%), a fixed edge vignette (sepia 8–10% at page corners), and fold creases on large maps (1px sepia 10–14% lines with a 1px lighter ghost beside them, two vertical + one horizontal). Aging is stains and folds — NEVER torn edges (FANZINE), never feTurbulence full-page grain (MATIÈRE).
- Drawn cartography as the only imagery: hachured ridges, stacked dune arcs, teal water with horizontal water lines, palm glyphs for oases, toponyms in tracked caps. Spec below.
- L'ÉCHELLE: a drawn scale bar (0 — 25 — 50 km, alternating filled/hollow segments, no arrowheads) used as a section divider or map furniture; it measures the JOURNEY, never the interface.
- Coordinates in Courier Prime, 10–11px, sepia at 60–75%: 24°33′N 9°29′E — at most one per section, always attached to a real place.

## Color physics
- GROUND: the parchment register #F0E6D0/#EBDFC4; PANELS and cards sit on the deeper aged register #E4D6B4/#E0D0AC. Sections may shift within the parchment register; the page never turns white or cool.
- INK: warm sepia, the #3B2F1E/#463623 register — never #000, never grey.
- ROUTE TEAL: the #16697A/#1A7488 register. Budget: the route and its nodes, water features, links, the primary CTA, at most one accent word per major headline. The teal is INK, not paint — it never fills large areas except water.
- POSTMARK INDIGO: the #3D4E8C register — STAMPS ONLY. Never text, never buttons, never rules. If it is not a stamp, it is not indigo. (Single exception: on the night band, stamps ink in parchment at 85% because indigo would drown.)
- NIGHT: one optional deep band per page, the #241A0F/#2A1D10 register, ink flipped to parchment; dune silhouettes one step lighter (#2C2013).
- Aging tones: contour sepia 10–17%, blotches 3–6%, creases 10–14%, vignette 8–10%.
- Gradients exist ONLY as aging (blotches, vignette) and as light inside drawn night scenes (a bivouac fire glow, a dusk sky) — never as section decoration, never behind type.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ROUTE TEAL→--primary · GROUND→--primary-foreground · deeper parchment→--secondary · POSTMARK INDIGO→--accent · ink at 65%→--muted · ink at 15%→--border · 3px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, aging tone or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: IM Fell English (400 + italic — its printing-press roughness IS the register; never fake-bold it) or Libre Caslon Text (400/700), one per site. Hero statement clamp(2.6rem,6.5vw,5.4rem), line-height 1.05–1.15, letter-spacing 0 to +0.01em. Section titles clamp(1.9rem,3.6vw,3.2rem). The scale is a chart-table scale (~6:1 hero-to-body) — confident, not billboard.
- ITALIC is a reserved organ: journal quotes, vernacular asides after a place name, one flavor line per section maximum. Never navigation, never labels, never a lone accent word inside a roman headline (that is VELIN's tic).
- BODY: Alegreya 400/500/700; line-height 1.6–1.75; measure ≤70ch; body size 1–1.0625rem.
- MAP LABELS: Alegreya 700, uppercase, 11–12px, letter-spacing +0.12–0.18em, sepia — the toponym style, also used for section labels beside their route node. Never floating letter-spaced whispers on bare ground without their node or rule (ÉCRIN's move).
- COORDINATES: Courier Prime 400, 10–11px — tiny, rare, warm; the only mono allowed, and it never sets prose.
- Numerals: prices in display 400 at 1.4–2rem inside stamps or beside dotted leaders, currency in 11px caps; day numbers J1–J5 in body 700.
- Arabic pairing rule: if the page serves Arabic, display duties go to Amiri (400/700 — it carries the old-book roughness), body to Noto Naskh Arabic (400/600); the route, stamps and coordinates survive translation unchanged.

## Signature art / components (the drawn cartography — the craft that carries the world)
HOW TO DRAW A MAP (the craft law):
- Strokes: sepia 1.2–2px, round linecaps, hand-waver every long line (2–4 gentle bends per 100px, never ruler-straight). A map that looks plotted has failed; a map that looks traced from memory has succeeded.
- RELIEF: ridges as hachures — rows of short 6–14px strokes falling away from a wavering ridge line, denser on the steep side; plateaus as closed contour loops nested 2–4 deep. DUNES: stacked crescent arcs, 3–5 per field, 1.5px, opening downwind. WATER: teal fill at 20–30% with 3–5 horizontal water lines hugging the shore inside it. OASES: palm glyphs (5–7 stroke fronds on a bent trunk, 14–20px). PISTES secondary to the route: sepia dashed 1px.
- TOPONYMS: map-label style, placed along the feature's axis; major places get their double-circle node; one elevation or coordinate per map maximum keeps the mono rare.
- Fold creases and a plain neatline (1.5px sepia border + inner 1px at 40%) finish any large map panel. No corner tick marks (CINÉTIQUE's registration ticks), no title-block table (GABARIT's cartouche) — the map's title is a stamp or a label, never an info table.
- Every drawn scene carries role="img" and a real aria-label in the page's language ("Carte dessinée du Tassili n'Ajjer avec l'itinéraire en pointillé").
COMPONENTS:
- BUTTONS: primary = teal fill, parchment text, corners consume var(--radius) directly (the 3px chamfer), padding 0.8em 1.5em, the tiny rose glyph or a bearing (CAP S-SE) at the left edge; active state PRESSES like a stamp: translateY(1px) + fill deepens, 150ms. Secondary = 1.5px sepia outline, ink text, hover fills the deeper parchment. No pill buttons, no shadows.
- CARDS (la fiche d'étape): deeper-parchment panel, 1px sepia-30% border, radius var(--radius), a drawn mini-map or symbol at top, facts as dotted-leader rows (term left, value right, leader of 2px dots between), the price or day as a stamp overlapping one corner by 8–14px. Hover/focus-within: lift −3px, border darkens, the stamp straightens 2–3°; 200ms, keyboard and touch parity always.
- FORMS (la demande de visa): fields on the deeper parchment register, 1px sepia-25% border, radius var(--radius), labels in map-label style above; phone-first (tel input leads, autocomplete on); a select for structured choices (circuit, période). Focus: 2px teal ring. Success is honest and stamped: the VISÉ stamp thunks in beside real next-step words ("Demande reçue. Un guide vous rappelle sous 24 h.") in an aria-live polite region. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, circuit, periode, message }); include one off-canvas decoy input carrying data-wandit-hp that the page's own script never reads, writes or references.
- ::selection: parchment text on teal. :focus-visible: 2px teal outline, offset 3px. Favicon: inline SVG data URI — the 4-point rose in teal on parchment.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem,10vh,7.5rem); the night band may compress to clamp(3.5rem,8vh,6rem). Content column 1140–1260px; maps may reach 1360px; only the showpiece bleeds full-width.
- HEADER: wordmark in display with the small rose glyph + 3–4 links + one stamp-outline CTA (téléphone or réserver). Parchment ground, 1px sepia-15% bottom hairline. No blur, no shadow.
- FIXED OPENING (hero law): the first viewport must contain the route's ORIGIN (the dotted line visibly departs toward the rest of the page), at least one stamp, contour ground, and the compass rose (at size or as glyph). The headline names the territory or the promise; one teal accent word maximum. NEVER a centered title–subtitle–CTA stack on bare ground. Allowed compositions: see the gestes — la table d'orientation, le départ en pleine carte, la salle des cartes as hero, le passeport, the strip-map band, the night opening.
- FIXED CLOSING: the contact form as the visa application (spec above) beside the practical facts (address, phone, season, hours as dotted-leader rows); then the footer as the atlas's back cover: the route's final segment arriving at a terminus node ("Fin de la feuille — début du voyage." register), the wordmark at clamp(2.4rem,7vw,5rem), one Courier coordinates line for the real address, small print at 12px.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: la salle des cartes (offer grid of map-fragment cards, offset columns) · l'itinéraire (the pinned showpiece) · la légende (services as a map-legend key: drawn symbol + dotted leader + term) · le journal de bord (dated log entries staggered along a route fragment) · la nuit au bivouac (the one deep band: stats as stamps, a display line, dune silhouettes) · le passeport (a two-panel spread where stamps accumulate: offers, milestones, partners).

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs; CDN dead → a complete, fully-drawn chart)
THE LAW: hidden states exist only via gsap.set — never in CSS. Gate every animation on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). The SVG markup always contains the FINISHED map — route drawn, stamps inked, marker at the terminus; JS winds it back, then travels it.
- PERSONALITY: ROUTE TRAVEL. Paths draw (a dashed route reveals through an SVG mask whose white path animates strokeDashoffset — never animate the dotted path's own offset, it would crawl the dots), and a MARKER travels the line: position via getPointAtLength on a 0→1 progress tween, rotated to the path's tangent. The pace is a steady walking pace: linear to sine.inOut for travel, power2.out for entrances.
- Durations 0.8–1.6s; staggers 100–160ms; text rises 24–32px. Route nodes ink in (scale 0.6→1, opacity, 0.35s) as the line reaches them.
- THE STAMP THUNK: the world's one fast move — from scale 1.35–1.45, opacity 0, rotation −6° extra, to rest in 0.25–0.32s with power3.in (accelerating INTO the paper) — then it stops DEAD. No bounce, no overshoot, no settle (back.out belongs to GUIMAUVE).
- THE SHOWPIECE (exactly one per page, scrubbed): l'itinéraire — a large drawn map pinned; on scrub the dotted route draws across it, the marker travels the line, and each stop STAMPS its postmark as the marker arrives (stamp beats at their arc-length fractions). Desktop ≥900px: pin + scrub 1, 220–300vh of scroll. Below 900px: no pin — the same timeline scrubs across the section's passage, stamps thunk on arrival.
- Route connector segments between sections (the spine's legs): each draws with scrub 1 as it crosses 94%→55% of the viewport, its stop node inking in (0.35s) when the leg completes.
- HOVERS: buttons press (1px down), cards lift −3px with the stamp straightening 2°, route nodes pulse one ring (scale 1→1.6, fade, 0.5s, once); links underline with a dotted teal line. 150–250ms; keyboard and touch parity always.
- REDUCED MOTION: the page is the finished chart — route fully drawn, marker resting at the terminus, every stamp inked. A composed still, not a blank.

## Ban list (the global ban list applies; in addition)
1. Dimension lines, arrowheads, mm/cm annotations, title-block cartouches, graph-paper grids, red-pencil markup — that is GABARIT's language; ATLAS is weathered, never measured. The échelle bar has no arrowheads and never measures UI.
2. Constellation maps (labeled star dots joined by hairlines), orbital ellipse diagrams, astronomical captions — that is OBSERVATOIRE's sky; ATLAS maps LAND, and its night band keeps stars as unlabeled specks, never connected.
3. Engraved arabesque ornament frames, eight-point star glyphs, illuminated openers — DIWAN's language.
4. Halftone-dot imagery, justified broadsheet columns, masthead furniture (datelines, edition numbers) — GAZETTE's language.
5. Default-web furniture: Times/system faces, blue underlined links, visible-border layout tables, visitor counters — HYPERTEXTE's language.
6. Machine-telemetry voice — SYS.STATUS, FILE 001, coordinate CAPTIONS on interface elements — CINÉTIQUE's language; corner registration ticks too. ATLAS coordinates are geographic, tiny, attached to real places.
7. Full-page feTurbulence grain (MATIÈRE's plaster) and arch-topped anything; aging here is blotches, folds and vignette only.
8. Handwritten annotation faces (the Caveat register), pins, polaroids, spiral bindings — CARNET's language; the journal de bord is TYPESET.
9. Torn-paper edges and tape — FANZINE's language; ATLAS paper folds and stains, never tears.
10. Gold sunburst/fan rays — FOLIES' crown; the compass rose is 8 fine sepia points with one teal north, never gold, never a ray field.
11. Photography of any kind, satellite imagery, embedded map tiles (Google/OSM), globe emoji or clip-art planes with dotted arcs — the default travel-agency kit. Every map is drawn by this world's pen.
12. The teardrop map-pin glyph (the UI pin) — stops are double-circle nodes and stamps, never pins.
13. Parchment kitsch: burnt scroll edges, pirate cursive, X-marks-the-treasure props, sepia photo filters.
14. Bounce, overshoot, elastic, squash — stamps stop dead; the route never springs.
15. Indigo anywhere outside a stamp; teal filling any area larger than a guelta.

## LES GESTES (moves menu)
1. LA TABLE D'ORIENTATION — hero split: headline column 50–55% left (title, journal line, CTA, one departure stamp), a drawn hero map panel right with the compass rose in its corner; the dotted route departs the panel's edge toward the next section. On load: title rises, map strokes draw back-to-front, stamp thunks last.
2. LE DÉPART EN PLEINE CARTE — hero variant: the first viewport IS the map, full-bleed; the client's name sits ON it as its largest toponym; the route origin pulses once; a corner stamp dates the edition. Scrub may pan the viewBox gently as the page starts.
3. LA SALLE DES CARTES — the offer grid: 2–4 map-fragment cards in OFFSET columns (vertical offsets 1.5–3.5rem, never a flush row), each a fiche d'étape with its own drawn mini-map and a price stamp overlapping a corner.
4. L'ITINÉRAIRE — the pinned showpiece (full spec in Motion identity): route draws, marker travels, postmarks stamp at arrival. The page's held breath.
5. LA LÉGENDE — services as a map key inside a neatline box: drawn symbol (14–40px) + dotted leader + term + one-line detail, 5–7 rows rising 100ms apart; the box shares its row with prose or a circular postmark.
6. LE JOURNAL DE BORD — 2–3 dated log entries staggered left/right (widths 50–60%, alternating margins), each: Courier dateline with coordinates, an italic display quote clamp(1.3rem,2.4vw,1.8rem), attribution; a faint route fragment crosses the section behind them.
7. LA NUIT AU BIVOUAC — the deep band: night ground, parchment ink, a display line of camp truth, 2–4 stats inked as parchment stamps, dune silhouettes along the bottom edge, one fire glow. Stars stay specks.
8. LE PASSEPORT — a two-panel spread (the open passport): left panel identity (name, promise), right panel accumulates 3–6 stamps on scroll — offers, languages, milestones — each thunking in 150ms apart.
9. LE CACHET QUI TOMBE — the micro-interaction: any stamp entering the viewport thunks (0.25–0.32s, power3.in, stops dead); on hover/focus it re-inks (opacity 0.85→1) and straightens 2°.
10. LA ROSE DES CAPS — the compass rose's needle eases toward the bearing of the next section as the reader scrolls (rotation scrub, ±40° range, sine) — a page-level wayfinder played at most once.
11. L'ÉCHELLE — the scale-bar divider: 0—25—50 km with alternating filled/hollow segments and the day's distance beneath ("Jour 3 — 42 km"); it draws left-to-right on entry.
12. LE MÉRIDIEN — the page-spine variant: a vertical dashed meridian in the left gutter (≥1200px) carrying each section's double-circle node and map-label; each segment draws with scrub as its section passes. Below 1200px the nodes dock beside the section titles.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. CAP AZIMUT — Sahara tours, Djanet. Territory: the Tassili n'Ajjer loop. Hero: la table d'orientation, the plateau hachured on the panel, a DÉPART DJANET stamp. Showpiece: l'itinéraire — the 5-day loop Djanet → Essendilene → Erg Admer → Tegharghart pinned, the marker a compass needle, day postmarks thunking at each stop. Middle: salle des cartes (3 circuits), légende, journal, nuit au bivouac. Mood: expédition sérieuse, thé sucré.
2. DAR AGHLAD — guesthouse, Ghardaïa. Territory: the ksar's alleys. Hero: le départ en pleine carte — a full-bleed drawn plan of the quarter, the house as its largest toponym. Showpiece: the WALK TO THE DOOR — on scrub the viewBox pans down the alleys while the route draws from the taxi node to the threshold, lantern glows lighting at 3 landmarks; no traveling marker — the reader IS the walker; the final beat stamps the house's key stamp at the door. Mood: seuil, hospitalité mozabite.
3. MÉRIDIEN DÉMÉNAGEMENTS — moving company, Alger. Territory: the Est-Ouest corridor. Hero: a horizontal STRIP-MAP band — headline above, a long ribbon map Alger→Oran below, the route departing rightward. Showpiece: le convoi — the strip-map pinned while a TRUCK marker crosses it left to right, city postmarks arriving (Blida, Chlef, Mostaganem, Oran) and a Courier km counter ticking beside the route. Middle plays le passeport for the service tiers. Mood: kilomètres honnêtes.
4. L'ESCALE GOURMANDE — grocery/gourmet, Oran. Territory: the terroirs. Hero: la salle des cartes AS hero — four product-region fragments (huile de Kabylie, dattes de Tolga, safran, câpres) under a compact title bar. Showpiece: la carte des terroirs — a country map where the four origin stamps thunk FIRST, then four routes draw INWARD and converge on the shop's node — the reverse choreography: goods travel to you. Mood: comptoir des terroirs.
5. INSTITUT BOUSSOLE — language center, Constantine. Territory: five capitals. Hero: le passeport — the first viewport is the open passport: identity page left (name, promise, one visa), CTA right where stamps accumulate. Showpiece: le tour des langues — one route threads London, Madrid, Berlin, Le Caire, Paris across a pinned world chart, a PEN NIB marker drawing it, each capital stamping its language visa (EN, ES, DE, AR, FR) as the nib arrives. Mood: départ imminent.
6. NORD-SUD LOCATION — car rental, Oran. Territory: the radiating day-trips. Hero: the compass rose DOMINANT — the rose at 260–320px left with the fleet listed as legend rows right; the route departs the rose's south point. Showpiece: les rayons — from the agency's node, 5 dotted routes draw OUTWARD simultaneously on scrub to Tlemcen, Mostaganem, Aïn Témouchent, Mascara, the beach — km stamps at each tip — while the rose's needle sweeps to each completed bearing. Mood: clés en main, plein cap.
7. CAMPEMENT TIN AMRAS — camping/glamping, Taghit. Territory: the camp itself. Hero: la nuit au bivouac AS the hero — the page OPENS dark: night panorama, dune silhouettes, the camp marked by a fire glow, parchment type; day parchment returns from section 2. Showpiece: le plan du campement — a pinned site plan where the walking loop draws tent to tent, labels hanging in as the path reaches them (khaïma 1–4, feu, guelta), and the scrub's final third ramps the plan from day to dusk as the fire glow blooms. Mood: silence, ciel ouvert.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the ROUTE (it must actually DRAW and actually CONNECT — a static dashed divider is not a journey; the reader must feel led from stop to stop), the STAMPS (rotated, imperfectly inked, arriving with the thunk — perfectly straight fully-opaque stamps are stickers, and stickers are another world), and the DRAWN MAPS (hand-wavered strokes, hachures, water lines, REAL toponyms — if the cartography reads as icon-set clipart the atlas collapses into a travel template; the photography budget is spent on paths). The cheap details that separate it from a generated page: the Courier coordinates attached to real places, an elevation label on one contour, fold creases on the big map, the scale bar with its honest kilometres, the rose glyph as a bullet, "réponse sous 24 h" instead of a promise, the VISÉ stamp on the form's success. When in doubt, add a place name, not a decoration — geography is this world's warmth.`,
	energy: "medium",
	family: "cartography",
	fusesWith: ["promenade", "observatoire"],
	id: "atlas",
	industries: [
		"tours & excursions",
		"travel agency",
		"vacation packages",
		"camping / glamping",
		"guesthouse / riad",
		"hotel",
		"airline / transport",
		"car rental",
		"moving company",
		"grocery / gourmet",
		"translation office",
		"language center",
		"vacation rentals",
	],
	kind: "website",
	mood: ["wanderlust", "archival", "weathered", "warm", "curious"],
	name: "Atlas",
	preview: {
		accent: "#16697A",
		fontFamily: "IM Fell English",
		ground: "#F0E6D0",
		ink: "#3B2F1E",
		sampleWord: "L'Atlas",
	},
	priceFeel: "accessible",
	tagline:
		"Cartes dessinées, cachets de passeport, une route pointillée qui voyage.",
};
