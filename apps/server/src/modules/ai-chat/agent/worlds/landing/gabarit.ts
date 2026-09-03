import type { DesignWorld } from "../types";

/**
 * GABARIT — the working drawing.
 * The page as a plan d'exécution pinned to a drafting table: graph-paper
 * ground, blueprint-blue line work, SVG plans and elevations that draw
 * themselves in plotter order, dimension lines measuring real UI elements,
 * mono labels, a title-block cartouche, and a rationed red-pencil correction
 * layer. Precision as charm.
 * fusesWith rationale — chantier: the drawing meets the site (one construction
 * brand, two registers); grille: drafting precision meets layout precision
 * (engineering consultancies).
 */
export const gabarit: DesignWorld = {
	avoidFor: [
		"kids & baby shop",
		"gelato / desserts",
		"nails & lashes studio",
		"festival",
	],
	doc: `# DESIGN WORLD: GABARIT — the working drawing

## Philosophy
This page is a WORKING DRAWING, not a brochure — a plan d'exécution taped flat on a drafting table, photographed from directly above. Its defining structural facts: (1) the ground is drafting paper carrying a faint graph grid that is TEXTURE and never layout — content ignores the grid lines completely, because a visible grid the content snaps to belongs to another world; (2) every image is a line-drawn technical figure in blueprint ink — a plan, an elevation, a coupe, a schema — built in SVG with believable wall thicknesses, door swings and level marks, never a photograph, never a render, never shading; (3) the page MEASURES ITSELF: dimension lines with extension ticks and arrowheads annotate real UI elements — the width of the headline, the height of a portrait column, the gap between two sheets — with plausible values and honest units; (4) two voices only: a mono labeling voice (small, uppercase, tracked) and a confident grotesk titling voice — the drawing speaks in captions, the architect speaks in titles; (5) somewhere on the page sits a cartouche — the title-block table every real drawing carries — and somewhere a human has passed with a red pencil, at most three times. Impossible failure modes: a stock-photo hero (there is no photography), a vague ornament (every mark here is a notation with a meaning — if you cannot name what a decoration NOTATES, delete it), a soft rounded friendly card (the radius register is 0px), a gradient (working drawings are printed in flat ink). Self-audit before shipping: zero raster img elements; at least TWO fully drawn technical figures, one of them the showpiece; every dimension label carries a unit and a plausible value consistent with the stated scale; red appears in at most 3 moments and never as a button, link or ground; the cartouche exists and its DATE cell is the build's real month; no grid line ever doubles as a layout rule.

## The variation contract (why two GABARIT sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Drafting-paper ground with the faint two-tier graph grid at or under ~6% visibility; sheet panels in near-white lifting drawings off the grid.
- Blueprint-blue ink register for all structure and text; cyan support strokes; red-pencil rationed to at most 3 markup moments.
- Line-drawn orthographic SVG figures as the ONLY imagery; strokes flat, no fills except low-alpha cyan hatching (poché).
- The dimension-line annotation system, the mono labeling voice, the cartouche, radius 0 on every container, zero gradients anywhere.
- Plotter motion: strokes draw with linear ease, lines always before labels, nothing ever bounces.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- Exact hexes inside each register; display face Archivo OR Saira; the paper end (#F4F6F8 crisp vs #EFF3F6 softer).
- THE CLIENT'S DISCIPLINE SETS THE DRAWING VOCABULARY — this is the deepest divergence axis. Architect: plans, elevations, coupes. Electrician: one-line wiring diagrams, fuse schedules. HVAC: duct riser schemas, airflow plans. Carpenter or aluminum-and-glass: exploded joinery details at 1:5, profile sections. Plumber: riser diagrams, isometric-free pipe runs. Developer or real estate: site plans (plan de masse), floor plates, typology sheets. Same paper, entirely different drawings.
- The sheet fiction (what planche the site pretends to be: an execution drawing, a permit set, a detail carnet), the scale mentions, the showpiece subject, the section order beyond the fixed opening and closing, which 2–3 gestes are played.
A GABARIT page whose drawings do not match the client's actual trade is a failure: pick the discipline's real drawing types FIRST, then let them choose the showpiece, the nomenclature rows and the words.

## The vibe (voice)
The chef d'atelier who loves exact words. Short declaratives, technical vocabulary used correctly and with pleasure, numbers doing the bragging — never adjectives. French: "Chaque trait engage. Nous ne dessinons rien que le chantier ne puisse tenir." · "Le permis, c'est de l'architecture administrative. Nous la dessinons aussi." · "Un trait juste évite dix réunions de chantier." Typographic law of the voice: decimal commas in French (12,40 m), a non-breaking space before every unit, dates as MM.YYYY in mono contexts. No superlatives, no exclamation marks, no "passion". One line of dry warmth allowed near the contact ("L'étude d'esquisse est facturée ; le premier café ne l'est pas.").

## Visual signatures
- The graph-paper ground: two-tier CSS grid drawn with 1px lines — minor square 14px in the #D8E2EA register at ~50% alpha, major square 70px at full #D8E2EA — never exceeding ~6% visibility against the paper. It runs edge-to-edge behind everything and is never aligned to columns, gutters or sheet edges.
- DIMENSION LINES (owned tic): 1.25–1.5px ink lines with 8–10px extension ticks at both ends, 7×5px filled-triangle arrowheads, and a mono 10–11px label riding above the line at +0.06em tracking. They annotate REAL UI elements (headline width, figure height, gap between sheets) with plausible values; when JS is alive the label may honestly print the element's measured width. Budget: 2–5 dimension annotations per page beyond those inside the drawings themselves.
- THE CARTOUCHE (owned tic): the drawing-sheet title block — an outer 1.5px ink border, 1px inner cell rules, mono 10–11px uppercase cells reading PROJET / ÉCHELLE / DATE / DESSINÉ PAR / PLANCHE N° — deployed full-width as the page footer, and echoed as mini-cartouche strips (a single row of 4–5 cells) at the foot of project sheets.
- RED-PENCIL MARKUPS (owned tic): a human correction layer in #D64533 — freehand SVG ellipses and arrows at 2–2.5px stroke with visible wobble, short notes in mono 11px red ("à revoir — menuiserie alu", "voir détail 04", "BON POUR ÉTUDE — visa"), optionally boxed in a wobbly 1.5px red frame rotated −2 to −3°. At most 3 moments per page, never in two adjacent sections, never on buttons/links/grounds.
- Line-drawn figures: structure strokes 1.5–2px ink; secondary strokes (furniture, glazing, equipment) 1–1.25px cyan #7FA6C4; hatching as 45° cyan lines 3–4px apart at 35–50% alpha; dashed lines (0 4 / 6 4 registers) for hidden edges, axes and swings; flat orthographic projection ONLY — no isometry, no perspective, no shadows.
- Sheet panels: #FBFCFD ground, 1.5px solid ink border, radius 0, no shadow — drawings and forms live on sheets; sheets never bleed off the viewport.
- Drawing furniture as UI furniture: folio tabs (PL·01, PL·02) marking sections, level marks (a small ▽ triangle + "+0,00" register) as markers, section-cut flags, door-swing arcs — always drawn, always meaning something.

## Color physics
- PAPER: the #F4F6F8/#EFF3F6 register. Sections may alternate between two paper tones 2–4 RGB points apart — the alternation is felt, not seen. Sheet panels: the #FBFCFD/#FCFDFE register.
- GRID: the #D8E2EA register, alpha-tuned so total visibility stays at or under ~6% against the paper.
- INK: the blueprint register #1E3A5F–#274A73. Display and structural strokes at the dark end (#1E3A5F); body text may lift toward #2E4A70; mono labels at 60–75% ink for secondary, full ink for primary.
- CYAN SUPPORT: the #7FA6C4 register — secondary drawing strokes, hatching, active/hover stroke states, focus rings at 45% alpha fills. NEVER body text (its contrast on paper is decorative-grade); as a label color only at 12px+ and only for figure captions.
- RED PENCIL: #D64533. Budget law: at most 3 moments per page, markups only. Red is a PENCIL, not a paint: never a button fill, never a link color, never a ground, never a section title.
- GRADIENTS: none. Anywhere. A working drawing is printed in flat inks; even panel washes are forbidden. Depth comes from line weight and paper-vs-sheet contrast.
- ::selection is cyan at ~30% on paper with ink text; :focus-visible is a 2px ink outline offset 2–3px.

FIXED TOKEN MAP — PAPER→--background · INK→--foreground · INK→--primary · PAPER→--primary-foreground · sheet panel→--secondary · RED PENCIL→--accent · CYAN SUPPORT→--muted · ink at 35%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hatch or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Archivo or Saira (one per site, client-owned), weights 600–800, tracking −0.01 to −0.03em. Hero statement clamp(2.6rem, 6vw, 5rem); section titles clamp(1.9rem, 3.6vw, 3.2rem); line-height 1.02–1.12. Sentence case for statements; uppercase reserved for the wordmark and short labels.
- LABELS: IBM Plex Mono or Space Mono, 400–600, 10–12px, uppercase, +0.05 to +0.1em tracking. Mono owns: figure captions, dimension values, cartouche cells, folio tabs, table headers, meta strips, prices and all numerals inside drawings.
- BODY: IBM Plex Sans 400/500/600, 1rem–1.125rem, line-height 1.6–1.7, measure capped 58–68ch, ragged right.
- HARD RULES: mono NEVER sets prose paragraphs (captions and cells only — a mono page is another world's law); NO italic character anywhere (drawings have no italics — emphasis is weight or ink darkness); no script or handwriting face (red notes are set in mono, not in a hand); display faces never below 1.4rem.
- Arabic pairing: if the page serves Arabic, body and display switch to IBM Plex Sans Arabic (400/700), mono stays for numerals and latin technical labels, dimension values keep western digits with the unit after.

## Signature art / components (the drawing system)
- CONSTRUCTION LAW FOR A PLAN: exterior walls as 5–7px strokes (or parallel 1.5px pairs) with real gaps for openings; windows as double 1.5px lines crossing the gap; doors as a leaf line + quarter-circle swing arc (dashed 1.25px); furniture in cyan 1.25px simple silhouettes; dimension chains OUTSIDE the envelope with extension lines; room labels inside in mono with the area ("SÉJOUR — 38,2 m²"); a scale mention ("ÉCH. 1:100") and a level mark near the entrance. An elevation gets a ground line, level marks with values at each floor, glazing hatched cyan. Believability is the craft: wall thicknesses consistent, swings that could close, values that add up.
- Every figure carries role="img" and a real aria-label describing the drawing in the page's language; purely decorative fragments are aria-hidden.
- BUTTONS: rectangles whose corners consume min(var(--radius), 0px) — this world's corners stay drawn square — mono uppercase 12px label at +0.08em. Primary: ink fill, paper text; hover/focus deepens toward #16304F. Secondary: 1.5px ink border ghost; hover fills to ink. Never red, never rounded, never shadowed.
- LINKS: mono or body 500 with a 1px underline that draws in from the left (scaleX 0→1, 0.15–0.2s, linear) on hover AND :focus-visible; visited stays ink.
- FORMS: the form is a SHEET — fields on a #FBFCFD panel inside a 1.5px ink border with a mini-cartouche or folio tab. Field law: mono uppercase 10–11px labels above, 1.5px hairline ink-at-35% borders, radius 0, focus ring cyan at 45%+ink border; phone-first (type=tel, inputmode=tel, placed first or second, generous 48px+ hit target); selects for structured choices (commune, type de projet). Honest success state: the panel's content swaps to a drawn registered-note moment (a check drawn in one stroke + real next-step words with a real delay promise) — never a bare "Merci !". On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail, and keep one off-canvas decoy input with data-wandit-hp that the page's own script never reads or writes.
- TABLES (la nomenclature): full-width legend tables — mono header row, 1px ink-at-20% row rules, a drawn symbol cell (set square, swing arc, detail circle, level mark — each ~28px line art), designation in display 600, content in body, honoraires/valeurs in mono. Row hover: paper-2 ground + symbol strokes ink→cyan.
- Favicon: inline SVG data URI — a dimension line with arrowheads in ink on the paper hex.

## Page chassis
- HEADER: paper ground, 1.5px ink bottom rule. Wordmark in display 800 + a two-line mono meta (métier — ville); nav links mono uppercase 11–12px with the drawing underline; one primary button. No blur, no shadow, no shrink choreography.
- FIXED OPENING (hero law): a sheet-header meta strip first — one mono line between two hairlines carrying PLANCHE N° / ÉCHELLE / FORMAT / LIEU / DATE — then an asymmetric two-column composition (7/5 or 6/6): the statement side (h1 + one short paragraph + two CTAs + one dimension line honestly measuring the title column) facing one large drawn figure annotated with a vertical dimension and a mono FIG. caption. One red markup allowed here (circle one load-bearing word, tiny red note beside). Never a centered hero, never a full-bleed figure.
- FIXED CLOSING (contact + cartouche law): a contact section splitting info (address, phone, hours, one dry-warm line) from the form-as-sheet; then the page ENDS on the full cartouche — the title-block table edge-to-edge with the firm's name in the large cell, PROJET / ÉCH. / DATE / DESSINÉ PAR / PLANCHE N° cells filled with true values, contact micro-cells, © line. The cartouche IS the footer; nothing comes after it.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: la galerie de planches (project sheets with mini-cartouches in an asymmetric drafting-table mosaic — one tall, one narrow, one landscape) · la nomenclature (the legend table of services/products) · la chaîne de cotes (process or timeline as one long dimension chain, durations as measurements) · les chiffres cotés (stat row where each number wears a dimension bracket above, claim beside) · la coupe interlude (one full-width section drawing crossing the page between two sections) · le détail cerclé (a detail circle zooming a fragment to a larger scale with a leader line, "ÉCH. 1:5").
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 8rem); containers 1140–1320px; figures live inside sheets or sit directly on the paper — nothing bleeds except the cartouche and the hero meta strip's rules.

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs; gate on gsap && ScrollTrigger && !prefers-reduced-motion)
THE PLOTTER PERSONALITY: lines draw first, labels after — always in that order, always with LINEAR ease ("none") on every stroke draw. Text and blocks use power1.out, 0.35–0.5s, rises of 8–14px. NOTHING bounces, overshoots, elastics or snaps.
- Every hidden state via gsap.set, never CSS — JS dead leaves a complete, fully-drawn, readable page (dasharray only ever applied by script).
- Entrance grammar per section: the head rule draws across (scaleX 0→1, 0.4–0.6s linear) → folio + title rise (0.4s) → content staggers 60–90ms. Figures draw on first view: strokes in document order, 30–80ms stagger, 1.2–2.2s total, labels fade last.
- Stroke-draw craft law: keep every stroke invisible (autoAlpha 0 via gsap.set) until its OWN draw tween starts — a dashoffset-parked stroke with round or square linecaps prints a cap-dot at the path start, and one stray red dot on an undrawn markup breaks the plotter fiction.
- THE ONE SCRUBBED SHOWPIECE — "le plan": a pinned viewport (250–350vh of scroll, scrub 0.8–1) where the discipline's master drawing plots itself in strict plotter order — walls → openings → furniture/equipment → dimension chains → labels — with a phase rail lighting each stage in mono, a "TRACÉ — NN %" readout, and the payoff: ONE red markup drawing itself at 90–100%. Kin allowed instead: an elevation building floor-by-floor with level marks ticking, a wiring diagram energizing circuit-by-circuit, an exploded detail assembling along dashed leaders. Under 768px: no pin — the figure plots once on enter over 2–2.5s, phase rail becomes a static caption row.
- Hovers: 0.15–0.2s linear — underlines draw, borders darken to full ink, symbol strokes swap ink↔cyan, sheets lift their border weight (1.5→2px via inset box-shadow in ink, not a soft shadow). Keyboard/touch parity mandatory.
- Reduced motion: everything at final frame — plan fully drawn, readout at 100%, no pin, CSS transitions 0.01s.

## Ban list (in addition to the global ban list)
- Machine-telemetry voice — SYS.STATUS, FILE 001, coordinate captions — that is CINÉTIQUE's language; GABARIT's mono speaks drawing-French (planche, éch., fig., cote), never machine-English.
- Corner registration ticks and plus-marks on frames, ghost stroked numerals overflowing columns — CINÉTIQUE's tics.
- ASCII/box-drawing frames, prompt-line furniture and typed-text steps() reveals — PHOSPHORE's tics.
- Hazard stripes, stencil caps with spray texture, steel plates with corner bolts — CHANTIER's tics; GABARIT is the drawing, never the site.
- Exposed layout columns that content visibly snaps to — GRILLE's tic; the instant a grid line aligns with a layout edge, break the alignment.
- Weathered cartography, passport stamps and postmarks, compass roses, dotted travel routes — ATLAS's tics.
- Soft-shadow floating cards — CLAIR's tic; GABARIT depth is line weight only.
- Handwriting/script faces for annotations — CARNET's tic; red notes are mono.
- Photography, renders, isometric or 3D-shaded illustration; any gradient; border-radius above 0 on containers (circles and arcs exist only as drawing notation).
- Red as a button, link, ground or title color; more than 3 red moments; red in two adjacent sections.
- Dimension lines with implausible or unitless values — a fake cote kills the whole conceit.
- Dark/black sections or inverted heroes — paper is permanent; the deepest this world goes is ink on paper.
- Grid-paper ground visibly darker than ~6% — the grid is breath, not bars.

## LES GESTES (moves menu)
1. LA PLANCHE-TITRE — the hero as a drawing sheet's header: mono meta strip between hairlines (planche, échelle, format, lieu, date), statement facing a large annotated figure, one dimension line honestly measuring the title column. The opening geste, always on.
2. LE PLAN TRACÉ — the pinned showpiece: the master drawing plots itself in plotter order with a phase rail and TRACÉ readout, red markup payoff at the end. The page's held breath.
3. LA COTE QUI MESURE — a dimension line annotating a real UI element with its real measured width (JS reads offsetWidth, prints it as mm); fallback static plausible value. 2–5 per page; the cheapest deep-world signal.
4. LA CHAÎNE DE PHASES — the process as one long dimension chain: ticks and arrowheads dividing segments, durations as the measurements ("2 SEM." above each span), phase names and one-line descriptions hung below. Vertical rail variant under 768px.
5. LA NOMENCLATURE — services or products as a drawing legend: numbered rows, drawn symbol cell, designation, content, honoraires in mono. Reads as specification, not as pricing cards.
6. LE DÉTAIL CERCLÉ — a detail circle with a leader line lifting a fragment of a larger drawing to a bigger scale ("ÉCH. 1:5"), the zoomed detail drawn separately in a small sheet. For craft-heavy trades (carpentry, aluminum, plumbing).
7. LA GALERIE DE PLANCHES — projects as drawing sheets in an asymmetric mosaic (one tall 7-col, one 5-col, one landscape full-width), each with its figure, folio tab and mini-cartouche row of facts.
8. LE VISA ROUGE — the red-pencil payoff: a wobbly red frame rotated −2°, "BON POUR ÉTUDE / BON POUR EXÉCUTION — visa + initials + date" in mono red, placed near the conversion moment. Counts against the red budget.
9. LES NIVEAUX — level marks (▽ + value) as the page's section markers: +0,00 at the hero, climbing (or descending) values down the page, drawn in the margin. Quiet spine geste.
10. LA COUPE INTERLUDE — one full-width coupe (section drawing) crossing the page between two content sections, drawn on scroll entrance, hatched ground, no text but a FIG. caption. Air without emptiness.
11. LES CHIFFRES COTÉS — stats wearing dimension brackets: a thin bracket with side ticks above each number, mono qualifier below, numbers in display 800. Claim sentence beside, never centered alone.
12. LE CARTOUCHE VIVANT — the footer cartouche with TRUE values: this month in DATE, real initials in DESSINÉ PAR, PLANCHE 01/01. May echo as mini-strips on sheets. Always on, closing geste.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- ATELIER NORD-SUD (architecte, Alger) — La planche-titre with a south elevation annotated R+2; showpiece le plan tracé of a villa rez-de-chaussée (walls→openings→furniture→cotes→labels, red "à revoir — menuiserie alu" payoff); then galerie de planches, nomenclature of missions, chaîne de phases in weeks, chiffres cotés, visa rouge at the form. Mood: the calm authority of an execution set.
- VOLT & FIL (électricien, Oran) — hero statement typed over a one-line wiring diagram spanning the column behind it, breaker symbols coted; showpiece: the diagram draws then ENERGIZES circuit-by-circuit, cyan strokes switching to full ink with the phase rail reading TABLEAU / CIRCUITS / PROTECTIONS; nomenclature becomes the fuse schedule with real amperages; red circles one breaker "différentiel 30 mA — obligatoire". Motion: draws then crisp state-flips, no travel.
- MENUISERIE KESSAB (menuiserie bois, Tizi Ouzou) — hero: an exploded tenon-mortaise detail at ÉCH. 1:2 with cotes in mm facing the statement; showpiece: the assembly — parts slide home along dashed leader lines in a pinned scene, dimensions closing to zero as the joint seats; galerie du détail cerclé (three details at 1:5); chaîne de phases in days. Mood: precision joinery, the warmest GABARIT.
- LES TERRASSES (promoteur, Alger) — hero: plan de masse with lot polygons and a vertical dim on the tower; showpiece: the elevation builds FLOOR-BY-FLOOR, level marks ticking +3,06 each beat, TRACÉ readout counting étages; planches become typologies F2/F3/F4 with plan thumbs and prices in DA mono; red circles the last available lot on the masse. Section order: typologies before method.
- CLIMAZUR (HVAC, Constantine) — hero: duct riser schema beside the statement, CFM values coted; showpiece: the duct network plots, then rooms hatch cyan one-by-one as "zones traitées", phase rail reading RÉSEAU / DIFFUSION / ZONES; nomenclature of equipment with BTU values; chiffres cotés on consumption saved. Motion: strictly draws and hatch-fills, no movement of blocks.
- COUPE & CHANT (architecture d'intérieur, Tunis) — softer paper end #EFF3F6, Saira display; hero: a full-width apartment COUPE under a short statement (the only variation opening on a landscape figure); showpiece: le détail cerclé chain — three detail circles open in sequence in a pinned scene, each zooming a fragment to 1:5; galerie as before/after plan pairs (drawn, never photos). Mood: the domestic GABARIT.
- MÉRIDIENNE (immobilier d'entreprise, Casablanca) — hero: an office floor plate with leasable zones hatched, sqm coted; showpiece: the stacked coupe des étages — floor plates draw one above another, each labeled with surface and DH/m² in mono; nomenclature becomes the availability table; chiffres cotés on occupancy. The most tabular variation; red appears once, circling the best plate.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails. THE DRAWINGS: if the plan reads as clipart — walls of uniform hairline, no door swings, no dimension chains, furniture from an icon set — the page is a template with a blue filter; draw like someone who has seen a real drawing set, with line-weight hierarchy and values that add up. THE MEASURING: dimension lines must annotate real elements with plausible, unit-carrying, scale-consistent values — one decorative cote with a random number and the whole conceit collapses. THE PLOTTER DISCIPLINE: every stroke draws linear, lines before labels, and nothing in any corner of the page bounces — one back.out tween and the drawing hand starts shaking. The cheap details that separate GABARIT from a generated page: decimal commas and non-breaking spaces before units, the cartouche's DATE cell carrying the real month, folio tabs incrementing down the page, the honest JS-measured cote under the headline, the ▽ level marks, and the red pencil held back until it means something.`,
	energy: "medium",
	family: "blueprint-drafting",
	fusesWith: ["chantier", "grille"],
	id: "gabarit",
	industries: [
		"property management",
		"architect (firm)",
		"architecture portfolio",
		"general contractor",
		"renovation / remodeling",
		"property developer / promoteur",
		"interior design / home staging",
		"carpentry / woodwork",
		"aluminum & glass",
		"HVAC / climatisation",
		"electrician",
		"plumber",
		"commercial real estate",
		"real estate agency",
		"painting & finishing",
	],
	kind: "website",
	mood: ["precise", "technical", "measured", "confident"],
	name: "Gabarit",
	preview: {
		accent: "#D64533",
		fontFamily: "IBM Plex Mono",
		ground: "#F4F6F8",
		ink: "#1E3A5F",
		sampleWord: "Éch. 1:50",
	},
	priceFeel: "premium",
	tagline: "La page comme un plan d'exécution : traits, cotes, cartouche.",
};
