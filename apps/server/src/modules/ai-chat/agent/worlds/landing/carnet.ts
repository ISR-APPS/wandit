import type { DesignWorld } from "../types";

/**
 * CARNET — the maker's notebook.
 * Kraft paper, a spiral binding running down the page, two voices (the
 * typed slab and the handwritten ballpoint that answers it), pinned
 * polaroids and sticky notes fastened with pins, staples and paperclips —
 * never tape. Warm, personal, hand-assembled with care. Fuses with
 * gazette (the notebook meets the paper — artisan food) and herbier
 * (the gardener's notebook — landscaping, gardens).
 */
export const carnet: DesignWorld = {
	avoidFor: [
		"lawyer / law firm",
		"financial advisor",
		"SaaS product",
		"aesthetic clinic",
		"security company",
	],
	doc: `# DESIGN WORLD: CARNET — the maker's notebook

## Philosophy
This page is an OPEN NOTEBOOK on a maker's workbench, not a website — the kraft-covered carnet where a cook, a carpenter or a florist writes recipes, measures, prices and thank-yous, and pins the proof beside the words. Its first structural fact: THE BINDING IS ALWAYS THERE — a spiral (or stitched) binding edge runs the full height of the page along one side; the layout breathes away from it like paper from its coil. Its second structural fact: TWO VOICES IN DIALOGUE — the typed voice (a warm slab serif: what the business states) and the handwritten voice (ballpoint script: what the maker really thinks). The hand annotates the type: it circles a price, strikes a word and writes a better one above, draws an arrow to the thing worth tasting. Handwriting NEVER sets body text; type never pretends to be casual. Its third: everything added to the page is FASTENED — pinned, stapled or paper-clipped, at its small angle — never taped (tape is FANZINE's), never floating unexplained. Its fourth: imagery is DRAWN — ballpoint-and-pencil sketches made in this very notebook; never photography, never paint. Impossible failure modes: cold minimalism; corporate gloss; anger or rawness (this notebook is kept with CARE — fury is FANZINE's); a stock-photo hero; a sterile untouched grid. Self-audit before shipping: (1) the binding edge is visible at every scroll depth, both breakpoints; (2) at least 3 handwritten annotations exist, at least one with an arrow, and ZERO handwriting in body text or nav; (3) every fastened paper carries a visible pin, staple or clip — count fasteners, minimum 6 per page; (4) zero tape strips, zero torn edges, zero photographs; (5) at least 3 drawn sketches; (6) one typed word somewhere is struck through and corrected by hand above.

## The variation contract (why two CARNET sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- The binding edge (spiral or stitched, one per site), full height, one side, mirrored to the right for RTL.
- Two-voice typography: one typed slab (Zilla Slab or Bitter) for display AND body; one handwriting face (Caveat or Kalam) for annotations, captions and the signature only.
- The kraft ground register + walnut ink + ballpoint-blue accent budget + pencil-grey support; papers (sheet-white, butter sticky) are SURFACES, never inks.
- Fastener physics: every placed paper has a fastener and an angle from the site's angle set (four values inside −3.5°…+3.5°); the fastener pops a beat AFTER its paper lands.
- Scribble-on motion: ink draws, paper flips and settles; no overshoot, no jitter, no gravity.
- Drawn sketch imagery in the carnet style (spec below); zero photography.
- One dark cover interlude maximum; the footer may reprise it as the back cover.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact kraft hexes and butter-sticky hue within their registers.
- The typed face (Zilla Slab OR Bitter) and the hand (Caveat OR Kalam) — one of each per site.
- THE KEEPER — the person whose hand writes in the notebook (the chef, the carpenter, the planner, the illustrator). The keeper names the annotation voice, the sketch subjects, the signature and the showpiece spread's content. A CARNET page with no keeper is a template with a script font: name the keeper FIRST.
- The dominant fastener (pins, staples or clips lead; the others support), the angle set's four values, section order beyond the fixed opening and closing, and which typed word gets the strike-and-correct.

## The vibe (voice)
Warm-plain French in the typed voice — short hospitable declaratives, precise about the craft and honest about prices ("Couscous, rechta, pastilla — cuisinés chez nous, servis chez vous." / "Acompte de 30 % à la réservation. Annulation libre jusqu'à 7 jours avant."). The handwritten voice is the private aside made public — 3–6 per page, never more: "goûtez ça →", "recette de ma mère", "le préféré des mariées". No luxury-speak, no urgency theatre, no exclamation stacking (the hand may allow itself one). Numbers are said plainly, in local currency, with the honest condition attached.

## Visual signatures
- SPIRAL/STITCHED BINDING EDGE (owned tic): a fixed rail 44–52px wide on desktop, 24–30px under 768px, running the full page height on the reading side. Spiral version: punched holes r 6–7px every 42–48px in a darker kraft (#D2BF99 register on #DCCBA6 rail), with a pencil-grey wire coil (3px stroke + 1px lighter highlight) crossing from page edge through each hole at a consistent diagonal. Stitched version: one 2px walnut thread zig running hole to hole. A soft page-curl shading band 12–18px wide, walnut at ≤8%, sits just right of the rail. Content clears the rail via body padding; nothing but the rail lives in that column.
- HANDWRITTEN ANNOTATIONS (owned tic): Caveat/Kalam 1.15–1.9rem in ballpoint blue #2C4A9A (pencil grey #8A8378 for the shy ones), rotated −4°…+3°, always TIED to the typed thing they comment: a hand-drawn ellipse (2.5px stroke, slightly overlapping start/end) circling a price; a 2–2.5px strike at −2° through a typed word with its correction written above; a curved ballpoint arrow (quadratic path, open two-stroke arrowhead) pointing at a CTA, dish or step. 3–6 annotations per page. Never body, never nav, never decoration without a target.
- PINNED POLAROIDS & STICKY NOTES (owned tic): polaroid = sheet-white frame, padding 10px 10px 44–50px, a drawn sketch inside on a tinted paper ground, handwritten caption in the chin; sticky note = butter square (#F1E4A6 register) with a subtle bottom-corner lift. Fasteners: pin (9–12px head, blue or walnut, 2px highlight arc, tiny cast dot), staple (two 12×3px pencil-grey bars), paperclip (drawn 2.5px pencil path hooked over the top edge). NEVER tape (FANZINE's), never string-tied tags (HERBIER's). Every fastened paper takes an angle from the site's angle set; cast shadows under fastened paper only, walnut at 12–16%, blur ≤4px.
- LINED SHEETS: #FAF6EC paper ruled every 30–34px with rgba(44,74,154,.16) 1px lines plus ONE vertical margin hairline rgba(192,91,74,.55) at 48–64px from the left — the page’s only red, never carrying text.
- KRAFT FLECKS: a repeating recycled-paper fleck tile (6–10 short 1.5px dashes per 160px, walnut at 5–7% opacity) on the kraft grounds — discrete fibre flecks, never fractal grain (plaster grain is MATIÈRE's).
- HAND-RULED UNDERLINES: near-straight SVG strokes, 3–3.5px blue, 1–2px of human waver over their length, drawn in under one key word per major heading — never a wave or zigzag (squiggle underlines are TUTTI's).
- HAND-DRAWN CHECKBOXES: 20–24px wobbly walnut squares (2px stroke) whose blue check strokes draw themselves on scroll — the notebook's list discipline.
- PAGE-CORNER NOTES: a small handwritten "p. 2 — la carte" register in pencil grey at each section's top corner — notebook pagination, never a masthead dateline (GAZETTE's).

## Color physics
- GROUND: the kraft register — #E8D9BE (ground A) / #E2D2B2 (ground B), sections alternating; the alternation is quiet, 6–12 RGB points apart.
- PAPERS: sheet-white #FAF6EC and butter sticky #EFE09C–#F4E7B0 register. Papers are surfaces things are written ON — never text colors, never buttons.
- INK: walnut #3A2E20, never black — all typed text, sketch strokes, some pin heads.
- BALLPOINT BLUE #2C4A9A: the annotation ink and the page's accent. Budget: annotations, arrows, circles, checks, hand-ruled underlines, the primary CTA fill, at most one accent word per major headline, one circled price per page. Blue is never a section ground and never a paper.
- PENCIL GREY #8A8378: secondary annotations, wire coils, staples, clips, hatch shading, meta lines.
- COVER DARK #2E241A: the notebook's cardboard cover — ONE full-bleed interlude maximum, where type flips to kraft #E8D9BE and the hand may write in butter; an elastic-band detail is allowed (an 8–12px vertical near-black band with one blue stitch). The footer may reprise the cover as the back cover — those two dark moments only.
- MARGIN RED rgba(192,91,74,.5–.6): ONLY the vertical margin hairline of lined sheets. Never text, never fill, never a rule anywhere else.
- Gradients exist only as paper shading — the rail's curl band, a sticky note's corner lift, a cast shadow — all ≤8% opacity. Never as decoration, never in sketches.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · BALLPOINT BLUE→--primary · sheet-white PAPER→--primary-foreground · GROUND B→--secondary · BUTTER STICKY→--accent · PENCIL GREY→--muted · walnut at 16%→--border · 8px→--radius · TYPED slab→--font-heading · TYPED slab→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, paper tone or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- TYPED: Zilla Slab or Bitter (ONE per site) does display AND body. Display 500–600: hero statement clamp(2.5rem, 5.5vw, 4.4rem), line-height 1.05–1.12; section titles clamp(1.9rem, 3.4vw, 3.1rem). Body 400 (700 for strong), 1–1.08rem, line-height 1.55–1.65, measure ≤62ch, flush left ragged right.
- HANDWRITING: Caveat or Kalam (ONE per site) — annotations 1.15–1.9rem, polaroid captions, page-corner notes, the success state's first word, and ONE signature wordmark in the footer at clamp(3.2rem, 9vw, 7rem). NEVER body, never nav, never under 1.1rem, never letter-spaced.
- LABELS/CHITS: typed face 600–700, 11–12px, +0.06–0.1em tracking, uppercase, always ON a paper tab (sheet ground, small rotation, staple or pin) — never floating letter-spaced micro-caps on bare ground (ÉCRIN's).
- NEVER ITALIC — when the type wants to lean, the hand takes over. Emphasis is blue ink, 700 weight, or the strike-and-correct move.
- Numerals and prices: typed face 600, the honest condition attached in 400 ("1 200 DA / pers. — service compris"); one price per page may be circled by hand.
- Arabic pairing: typed voice → Alexandria 400–700; handwriting → Aref Ruqaa. The binding rail mirrors to the right, angles flip sign, arrows flip direction. Papers, fasteners and sketches unchanged.

## Signature art / components
- CARNET SKETCHES (the imagery system): every drawn object — a couscous bowl, a steaming pot, a dovetail joint, a peony — is drawn in a 2.25–2.75px walnut ballpoint stroke with deliberate waver (2–3px amplitude, wobbly ellipses, corners that almost meet), flat fills ONLY from the paper tones (sheet, butter, kraft A/B), shading as 1.5px pencil-grey hatching at ONE angle per object, and at most one blue detail per sketch. Sketches sit inside polaroids, on index cards, or directly on the page held by a pin. Steam, crumbs and motion are drawn as 2–3 pencil curls or dots. Every meaningful sketch carries role="img" and a real aria-label in the page's language; decorative repeats are aria-hidden. No specimen captions (HERBIER's), no rooms (MATIÈRE's), no halftone (GAZETTE's), no watercolor (AQUARELLE's).
- BUTTONS: primary = the ballpoint stamp — blue #2C4A9A fill, paper text, corners consuming var(--radius) directly (the 8px stamp rounding), rotated −1°, hover/focus-visible straightens to 0° and deepens to #23407F over 0.2s; active presses flat (translateY 1px). Secondary = a typed link whose hand-ruled underline scales in from the left, 0.25s. One sticky-note CTA per page maximum: a butter note with a handwritten imperative and an arrow at the button or form.
- FORMS — LE BON DE COMMANDE: the order sheet on lined paper. Typed labels 700, 11px, tracking +0.08em above each field; fields transparent with a 2px walnut bottom rule sitting ON a ruled line; phone-first (input type="tel", local placeholder); a select for the structured choice (occasion, type de projet); focus flips the rule blue with a 2px blue outline offset 2px; invalid states say it frankly in type ("Il nous faut un numéro pour vous rappeler."). Success replaces the sheet with the handwritten "C'est noté !" plus a typed line stating exactly what happens next. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, date, … }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads, fills or references.
- FAVICON: inline SVG data URI — a blue pin head with a walnut needle on the kraft ground.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 7.5rem); containers 1140–1280px plus the binding offset; large sheets may reach 1360px. html/body carry overflow-x: clip, and rotated clusters keep their overhang inside the container — fix causes, not symptoms.
- HEADER: a kraft strip with a 1px hand-ruled bottom line; typed wordmark 700 with a tiny handwritten identity aside ("traiteur à Tlemcen" register); nav = typed anchors whose hand-ruled underline scales in on hover/focus; ONE primary CTA. Sticky allowed, solid ground, no blur.
- FIXED OPENING — LA PAGE DE GARDE: the hero must contain (a) the typed statement with ONE handwritten intervention — the strike-and-correct, a circled word, or an arrow; (b) at least two fastened papers; (c) 2–3 honest fact chits on paper tabs (depuis, count, halal/local register). The COMPOSITION is client-owned within that law: L'ÉTABLI (statement beside the fastened cluster) and LA DOUBLE PAGE (a full-width lined spread, statement typed across the rules) are the proven families; siblings may instead open on the dark cover, one giant polaroid, the sommaire sheet or a pinboard — (a), (b) and (c) always in the first viewport.
- FIXED CLOSING — LE BON DE COMMANDE: the order form on its lined sheet beside an honest promise and contact chits (tel, address, hours as paper tabs); then the footer — the keeper's SIGNATURE huge in the handwriting face over one hand-ruled line, typed chit links with real hrefs (tel:, mailto:, maps, socials), one modest legal line.
- FREE MIDDLE (compose 3–5 from this vocabulary, never two adjacent sections with the same layout): LA CARTE ÉPINGLÉE pinned card grid · LA RECETTE spread scrub (the showpiece, one per page) · LA COUVERTURE dark cover interlude · LA FICHE price sheet with margin annotations · LES ÉTAPES COCHÉES checklist walk · LE LIVRE D'OR pinned notes board.

## Motion identity — SCRIBBLE-ON (GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: things are WRITTEN and PLACED. Ink draws itself; paper flips down and settles; the fastener pops a beat AFTER its paper — never before. Every hidden state is set via gsap.set, never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). JS dead → the notebook lies fully written, every check ticked, every paper pinned at its rest angle.
- Easing identity: power2.out for placements, power1.inOut for ink; durations 0.5–0.9s; staggers 100–140ms in reading order. NO overshoot ever (back/elastic is GUIMAUVE's), no gravity drops (CHANTIER's), no steps() jitter (FANZINE's), nothing faster than 0.2s except the pin pop.
- INK DRAW: strokeDashoffset on arrows, circles, strikes, underlines and checks — 0.6–0.9s each, power1.inOut. Handwritten TEXT reveals via a clip-path inset wipe following the writing direction, 0.7–1s.
- PAPER FLIP (the entrance law): a placed element arrives at rotationX −14° → 0 (transformPerspective 800, origin top), y 22 → 0, autoAlpha 0 → 1, 0.65–0.8s power2.out; its fastener pops scale 0.4 → 1 in 0.25–0.3s, 0.12–0.18s after the paper lands. Animate a wrapper; the rest angle lives on the inner element so hover can straighten it; on boards, absolute coordinates live on the WRAPPER — a transformed wrapper becomes its paper's containing block.
- SHOWPIECE TYPE — LA RECETTE (the spread scrub): ONE pinned scene per page — a lined recipe/process spread assembles on scroll (scrub 0.45–0.6, end +=1600–2000px): the handwritten title wipes on → the hand-drawn checks tick the typed steps one by one (each step brightening 52% → full ink as it's ticked) → the polaroids pin on one by one → the margin secret annotation draws LAST. Mobile <768px: no pin — the spread reveals in the same order on view, pre-composed.
- HOVER: fastened papers straighten to 0° and lift 2–3px (0.2s ease); handwritten links draw their underline; buttons straighten and deepen. :focus-visible mirrors every hover; @media (hover:hover) discipline; touch gets :active parity.
- REDUCED MOTION: the fully-written page — spread at its final frame, checks ticked, annotations present. A designed still, never a blank.

## Carnet ban list (in addition to the global one)
- Tape strips, torn-paper edges, misregistration ghosts, ransom-note letters — that is FANZINE's language; carnet fastens with pins, staples, clips, and cuts its paper clean.
- Watercolor washes, pigment-bloom masks, brush underpainting — that is AQUARELLE's language; carnet's ink is ballpoint and pencil.
- Botanical specimen plates, Latin plate captions, string-tied specimen tags — that is HERBIER's language, even for a garden client.
- Drawn architectural room miniatures and arch-only geometry — that is MATIÈRE's language.
- Halftone-dot imagery, broadsheet justified columns, masthead datelines and jump lines — that is GAZETTE's language; carnet's pagination is a pencil corner note.
- Squiggle underlines and zigzag dividers — that is TUTTI's language; a hand-ruled line is near-straight.
- back.out / elastic overshoot entrances — that is GUIMAUVE's motion; carnet settles, it never bounces.
- Heavy gravity drops (CHANTIER's) and steps() jitter cuts (FANZINE's).
- Photography, photoreal rendering, paper-texture photo backgrounds, photoreal corkboard or wood-desk grounds — the notebook page itself is the only surface.
- Handwriting as body text, nav, or any run of more than 12 words.
- More than 6 annotations per page — clutter is the death of care.
- Pure black #000 ink or pure white #FFF paper — everything lives in the warm register.
- A perfect 0° grid of fastened things — fastened paper always carries its small angle; only large sheets and the typed table sit near-straight (≤1°).
- Glassmorphism, blur panels, neon, decorative gradients, big soft floating card shadows (CLAIR's).

## LES GESTES (moves menu)
- LA CORRECTION — the hero's key typed word struck through in blue and corrected in handwriting above ("avec soin" → "avec amour" register); the cheapest statement of the two-voice law in the first second.
- L'ÉTABLI — the split hero: typed statement and CTAs on one side, the fastened cluster (2 polaroids + 1 sticky) on the other, one arrow annotation crossing the gap.
- LA DOUBLE PAGE — the other hero: a full-width lined spread, the statement typed across the rules like a title line, the cluster pinned along the bottom edge, chits in the margin.
- LA CARTE ÉPINGLÉE — the offer as 3–6 index cards on an UNEVEN grid (varying column spans, vertical offsets 12–48px), each with a sketch, typed name, honest price, and its fastener; one sticky-note guest ("nouveau !") and one hand-circled price.
- LA RECETTE — the showpiece spread scrub: title wipes on, checks tick the steps, polaroids pin on, the margin secret draws last (spec in Motion identity).
- LA COUVERTURE — the dark interlude: walnut cover ground, one big handwritten line wiping on ("On cuisine comme on reçoit : généreusement." register), 2–3 plain typed numbers with handwritten units, the elastic band at the edge.
- LA FICHE — the price sheet: one lined sheet, typed rows name — dotted leader — price, 2–3 margin annotations pointing at rows, deposit and cancellation said plainly at the bottom, a staple or two pins holding the corner.
- LES ÉTAPES COCHÉES — the process as a checklist walk: 3–5 typed steps with hand-drawn checkboxes ticking in sequence, big handwritten numerals, ballpoint arrows carrying the eye step to step.
- LE LIVRE D'OR — the guestbook board: 3–4 short real-sounding notes on mixed papers (sticky, index card, sheet scrap) at scattered angles with names and towns; hover straightens one at a time.
- LE POST-IT — the single sticky-note CTA: a butter note with a handwritten imperative and an arrow aimed at the button or the form; one per page, placed where hesitation happens.
- LA SIGNATURE — the footer close: the keeper's name huge in the handwriting face, wiped on once, above one hand-ruled line and the typed contact chits.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- CHEZ NAÏMA (traiteur / catering, Tlemcen) — hero L'ÉTABLI: statement column with LA CORRECTION ("soin" struck, "amour" above), two dish polaroids and a butter sticky clustered at right, one arrow crossing the gap. Order: carte épinglée → recette → couverture → fiche → étapes → livre d'or. Showpiece LA RECETTE DE LA RECHTA: title wipes on, checks tick the typed steps in reading order, three polaroids pin on one by one, the margin secret draws last. Familial, generous; blue rationed hard.
- ATELIER CHÊNE (carpentry / woodwork, Oran) — hero LA DOUBLE PAGE: a full-width lined spread, statement typed across the rules, dovetail and plane sketches pinned along the bottom edge, chits in the margin. Pencil grey leads; blue appears three times. Showpiece LA COTE DU BANC: a workbench sketch DRAWS ITSELF stroke by stroke while pencil measures write in around it — "l. 180 cm", "frêne, séché 2 ans" — the delivery date circling last; no checks, no pins in the scene. Fiche of essences; étapes walk; no livre d'or. Patient, precise.
- LA MIE DORÉE (patisserie / bakery, Constantine) — hero LE BANDEAU: the statement centered full-width, "des gâteaux" struck for "du bonheur", over one stapled row of three index cards — no side cluster. Staples dominate. Showpiece LE FEUILLETAGE: the lamination as pure paper choreography — five numbered fold-diagram cards flip down in sequence across a lined spread, the butter layer drawn inside each; no checkboxes in the scene. Cover interlude quotes the grandmother in Kalam. Buttery, early-morning.
- SARAH & CO (event planner, Algiers) — hero LE SOMMAIRE: the notebook's table of contents — typed rows naming the sections, handwritten page numbers, "commencez ici" arrowed at the CTA, one clipped polaroid at the corner. Clips dominate; cool and organized. Showpiece LE PLAN DE TABLE: a hand-drawn hall plan on a pinned sheet — table circles pin on one by one, a ballpoint path draws the guests' flow from entrée to buffet, the table d'honneur circles last. Livre d'or of couples; fiche with "coordination jour J" circled.
- GRIBOUILLE (kindergarten / crèche, Tunis) — hero LE TABLEAU D'ÉPINGLES: a full-width pinboard of six mixed papers — child sketches still obeying the 2.5px walnut law — the statement small on one index card among them. Kalam hand, brighter butter, angles at the wide end. Showpiece LA JOURNÉE TYPE: a vertical blue line draws DOWN a lined sheet from accueil to sieste, hours ticking off as it passes, a tiny blanket polaroid pinning at nap time. Steps walk for inscription. Tender, sunny.
- NADIR DESSINE (artist / illustrator, Casablanca) — the quiet sibling. Hero LE POLAROID GÉANT: one flagship polaroid filling half the viewport, pinned at −2°, beside a short typed name-and-manifesto; pencil grey leads, blue twice per page. Showpiece LA COMMANDE: the same drawing in three states — pencil ghost, ink pass, finished plate — crossfading left to right as each phase is struck off in the margin; no checks, no pins in the scene. Fiche of commission rates; livre d'or of one-liners.
- LE COIN GOURMAND (café / coffee shop, Béjaïa) — dense and cheerful. Hero LA COUVERTURE D'ABORD: the page opens on the dark cover itself — the name in butter handwriting, the elastic band at the edge — and the first lined page slides up as you scroll (its one dark moment spent here; the footer stays kraft). Showpiece LE CARNET DU BARISTA: over one large V60-and-cup sketch, the pour draws as a SINGLE long ballpoint spiral while grams and seconds write into the margin — "15 g", "0:45", "l'eau à 92°, pas plus" — the crema is the scene's one blue stroke. Carte épinglée of drinks with one circled price.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the TWO-VOICE DIALOGUE (the type states, the hand answers — a page where handwriting merely decorates instead of commenting is a template with a script font), the FASTENER PHYSICS (every paper pinned, stapled or clipped, at its angle, with the pop a beat after the paper — one unfastened card and the notebook becomes a mockup), and the BINDING EDGE (always present, always cleared — remove it and this is any warm page). The cheap details that separate it from a generated page: the pin popping late, the one circled price, the struck word corrected above, the checks ticking in reading order, the margin secret drawn last, the page-corner "p. 4" in pencil. When in doubt, let the hand answer the type — care is this world's voltage.`,
	energy: "medium",
	family: "hand-craft",
	// gazette: the notebook meets the paper — artisan food.
	// herbier: the gardener's notebook — landscaping, gardens.
	fusesWith: ["gazette", "herbier"],
	id: "carnet",
	industries: [
		"landscaping / gardens",
		"traiteur / catering",
		"patisserie / bakery",
		"street food / food truck",
		"café / coffee shop",
		"restaurant (classic)",
		"grocery / gourmet",
		"home & decor shop",
		"artist / illustrator",
		"freelancer portfolio",
		"carpentry / woodwork",
		"event planner",
		"wedding services",
		"kindergarten / crèche",
		"gelato / desserts",
	],
	kind: "website",
	mood: ["warm", "personal", "hand-assembled", "caring", "honest"],
	name: "Carnet",
	priceFeel: "accessible",
	preview: {
		accent: "#2C4A9A",
		fontFamily: "Caveat",
		ground: "#E8D9BE",
		ink: "#3A2E20",
		sampleWord: "le carnet",
	},
	tagline:
		"Le carnet du maker : kraft, spirale, annotations au stylo, polaroids épinglés.",
};
