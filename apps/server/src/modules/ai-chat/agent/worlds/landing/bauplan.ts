import type { DesignWorld } from "../types";

/**
 * BAUPLAN — the bauhaus teaching workshop.
 * Off-white ground on which a red circle, a blue triangle and a yellow
 * square recur as CHARACTERS with assigned roles; thick baseline bars as
 * structure; one rotating circular text badge. Playful rigor — geometry
 * that teaches. Proven by the École Module demo (coding bootcamp,
 * Casablanca); every measured value below matches that build.
 * fusesWith grille: the workshop meets the grid — modernist pair.
 * fusesWith tutti: bauhaus lets its hair down — kids' programs, festivals.
 */
export const bauplan: DesignWorld = {
	avoidFor: [
		"fine dining",
		"jewelry brand",
		"notary",
		"spa / hammam",
		"guesthouse / riad",
	],
	doc: `# DESIGN WORLD: BAUPLAN — the bauhaus teaching workshop

## Philosophy
This page is a TEACHING POSTER PINNED TO THE WORKSHOP WALL — Dessau, 1926, redrawn for a client who sells learning, method or craft. Its defining structural fact: the red circle, the blue triangle and the yellow square are a CAST OF CHARACTERS, not decoration. Each shape holds ONE assigned role for the entire page — a program, a value, a step family, a nav territory — declared in a visible legend and honored in every appearance. Shapes carry meaning the way letters carry sound; a shape with no role is a typo. Second structural fact: thick baseline bars in the cast colors sit under key words, under prices, under form fields — they are STRUCTURE (they say "this is load-bearing"), never mood. Third: one rotating circular text badge — the workshop's seal — spins slowly somewhere on the page, exactly once. The ground is a single warm off-white that never changes; headlines are lowercase (the bauhaus habit — herr bayer removed the capitals and this page agrees); motion is geometric choreography, parts translating and rotating INTO PLACE like an assembly on a drafting table. Failure modes made structurally impossible: the gradient wash (gradients do not exist here), the shape-soup hero (no shape without a role), the dark techy landing (the ground is daylight), decorative sprawl (every mark answers "which character, doing what?"). Self-audit before shipping: (1) every shape instance on the page maps to a role in the legend — coverage 100%; (2) no element wears more than ONE primary; (3) all display lines lowercase (proper nouns excepted), zero ALL-CAPS; (4) count the baseline bars: 8–18 per page, every one welded to a text baseline — the showpiece's trio lineup is the ONE sanctioned free-bar moment; (5) exactly one rotating badge, spinning at 24–32s per turn; (6) zero gradients, zero shadows, zero borders thicker than 2px.

## The variation contract (why two BAUPLAN sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- The primary-shape cast: circle #D5271D-register, triangle #1D56A5-register, square #F2B300-register, each with ONE declared role, recurring through nav, markers, bars, art and footer.
- Thick baseline bars as structure; the rotating circular text badge, once.
- One ground (#F4F1EA register) page-wide; at most ONE full-bleed ink interlude.
- Lowercase-preferred display; Jost/Chivo geometric register; flat fills only — no gradient, no shadow, no stroke around a filled shape.
- Geometric choreography: translate + rotate into place, rotations landing on 45°/90° multiples, no overshoot ever.
- The trio appears TOGETHER as equals only in three sanctioned places: the legend, the showpiece, the footer lineup. Everywhere else, one shape per element.
CLIENT-OWNED — where siblings diverge, decided per brief:
- THE ROLE MAP: which shape means what (circle = practice / play / community; triangle = direction / progress / risk; square = structure / foundation / product — any mapping, but it is written down and obeyed).
- THE LEAD SHAPE: one character carries 55–65% of shape-and-bar appearances, the second 25–35%, the third 10–15%. Lead choice retints the page's temperament (blue lead = studious, red lead = energetic, yellow lead = sunny).
- Display face within the register (Jost OR Chivo, one leads per site), the CONCEPT NOUN (le module, la leçon, le virage, la portée, le chantier des formes), the emblem the showpiece assembles, the badge's ring text, the ink interlude's presence, the section order between fixed opening and closing, the language.
Two BAUPLAN sites share the cast and the bars; they must never share the role map, the hero composition or the assembled emblem.

## The vibe (voice)
Pedagogical warmth with geometric precision — a teacher who respects you, lowercase confidence, short sentences that teach one thing each. Concrete figures beat adjectives; promises come with numbers and dates. No hype, no exclamation marks, no "excellence". Example lines in register: "le code prend forme." · "24 étudiants, 12 semaines, un métier." · "aucun prérequis, sauf l'envie de construire."

## Visual signatures
- THE PRIMARY-SHAPE CAST (owned tic): three size registers — hero-composition shapes 180–420px, section markers 28–44px, inline glyphs 0.6–1em sitting on the text baseline before labels and list items. Every instance is flat-filled in its role color; rotation only in 45° steps; the triangle is equilateral or right-isosceles (clip-path polygon(50% 0, 100% 100%, 0 100%) register), the square is a true square, the circle a perfect 50%. No fourth shape ever enters — no hexagon, no star, no blob, no arch.
- THICK BASELINE BARS (owned tic): height clamp(10px, 1.1vw, 16px), running under the word(s) they support, starting 0.08em before the first glyph and extending 0.35em past the last, top edge 0.02–0.06em below the baseline so descenders overlap the bar. One bar color per lockup. They underline the claim's key word, sit under prices and stats, form the form fields, and ride under CTAs — 8–18 per page, never as free ornament; the only bars allowed off a baseline are the showpiece's trio of equal bars, once.
- THE ROTATING CIRCULAR TEXT BADGE (owned tic): diameter clamp(110px, 13vw, 170px), lowercase ring text on an SVG textPath (0.62–0.72rem, tracking +0.16–0.2em, ink), the lead shape at the hub, one full rotation every 24–32s, linear, endless. ONE per page, placed to overlap a seam (hero art edge, section corner) — never centered as a medallion, never a CTA.
- Rules: section-opening rule 2px solid ink full-strength with the section's role glyph sitting on it; inner hairlines 1px ink at 12–15% opacity. No boxes — separation is space and hairlines.
- Geometry discipline: every rectangle consumes min(var(--radius), 0px) — this world's corners stay square at radius 0; circles at 50%; nothing between. Flat fills only; the shapes never wear outlines, gradients or shadows.
- Figures set tabular-nums everywhere (prices, dates, stats); numbers are the page's jewelry.

## Color physics
- GROUND: the #F4F1EA register (#F2EFE7–#F6F3EC). ONE ground for the whole page; sections are separated by rules and rhythm, never by ground changes.
- INK: #14140F register — warm near-black, never pure #000. All body text is ink; ink at 55–65% for secondary lines.
- THE CAST: red #D5271D (register #C9241B–#DB3A2C) · blue #1D56A5 (register #1A4C93–#2A66BC) · yellow #F2B300 (register #E8AC00–#F7BE1E). Role budget is law: lead 55–65% of shape/bar instances, second 25–35%, third 10–15%. Never two primaries on one element; the trio as equals only in legend, showpiece, footer lineup.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · LEAD CAST COLOR→--primary · INK→--primary-foreground · L'ARDOISE→--secondary · SECOND CAST COLOR→--accent · ink at 60%→--muted · ink at 14%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every register sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Yellow never sets type and never sits under body text; text over a yellow plane is ink, and only display-size. Red and blue may each color at most ONE short display word per page.
- L'ARDOISE (the ink interlude): zero or one full-bleed #14140F section — the workshop chalkboard — where text flips to #F4F1EA and the cast glows at full saturation. Never two; alternating flips are another world's language.
- Gradients exist NOWHERE — not in shapes, not in hovers, not in overlays. Shadows exist nowhere. Depth is expressed by overlap order and size, like paper cutouts.

## Typography system
- DISPLAY: Jost or Chivo (Google Fonts), ONE leads per site, weights 500–700. Geometric, warm, never condensed. LOWERCASE-PREFERRED: display lines begin lowercase and stay lowercase; proper nouns keep their capital; ALL-CAPS is banned everywhere including labels.
- BODY: the other face of the pair (or the same), 400/700, 1–1.06rem, line-height 1.55–1.65.
- Hero statement: clamp(2.9rem, 7.5vw, 6.5rem), line-height 1.02–1.1, tracking −0.01em. Section titles clamp(1.9rem, 4.2vw, 3.6rem). Never italic — emphasis is a baseline bar or a role-colored word, nothing else.
- Labels: 0.78–0.85rem, weight 600, tracking +0.04–0.08em, lowercase, ALWAYS preceded by their role glyph on the baseline — a label without its shape is a floating whisper and belongs to another world.
- Prices and stats: display face 600, tabular-nums, with a role-colored baseline bar; affixes (MAD, %, semaines) at 0.45–0.55em weight 500.
- Arabic pages: pair with IBM Plex Sans Arabic or Cairo (geometric humanist register); drop letter-spacing entirely on Arabic script; the bars, glyphs and role system translate unchanged.

## Signature art / components (the imagery system)
- IMAGERY = GEOMETRIC CONSTRUCTION, drawn in CSS/SVG. Every "image" is a composition of cast shapes plus 2–3px ink strokes and arcs that assembles a MEANINGFUL diagram: the client's emblem, a route with 90° turns, a balance, a staircase of steps. Zero photography, zero mascots, zero 3D, zero shading — flat planes overlapping like cut paper.
- GEOMETRIC HEADS (for people): each person is one large role shape as the face plus 2–4 small features (ink arc smile, shape eye, shape hat), 140–180px, every head unique, the face color = the person's role in the map. Charming, never childish: features are sparse and precisely placed.
- Buttons: lowercase display 600 ink text riding a baseline bar in the role color; hover/focus the bar thickens (scaleY 1→1.35, transform-origin bottom, 0.25s) and the leading glyph rotates 90°. Secondary action: ink text on a 2px ink underline. No pills, no boxes, no shadows.
- Forms: NO boxes — each field is a lowercase glyph-prefixed label above a bare input sitting on a 2px ink baseline that thickens into a 10px role-color bar on focus. Phone-first: the tel input directly after the name, type="tel", local placeholder. Select for structured choices. Success state is honest: a named human, a real delay, a real channel ("Karim vous rappelle sous 48h ouvrées."), plus the mini-emblem assembled. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail; include one off-canvas decoy input with data-wandit-hp that the page's own script never reads or writes.
- Favicon: inline SVG data URI — the three shapes on the ground tone.

## Page chassis
- Container 1200–1320px; padding-inline clamp(20px, 4.5vw, 64px); section rhythm clamp(4.5rem, 10vh, 8rem). Header: lowercase wordmark with a micro-lineup of the trio, nav links each prefixed by the glyph of the territory they lead to, one CTA on its bar. 1px hairline under the header, no blur, no shadow.
- FIXED OPENING (hero law): asymmetric two-part hero — claim side (glyph label, lowercase h1 with exactly ONE barred word, sub with figures, CTA pair, one meta line of dated facts) facing a CONSTRUCTION side (a 320–520px composition where each cast shape wears its role caption), the rotating badge overlapping the seam between them. Never centered-symmetric, never full-bleed color, never an image.
- FIXED CLOSING: the form as described, then the monument footer — wordmark at clamp(3.2rem, 9vw, 7.5rem), the trio lineup with role captions, coordinates and hours, one 2px ink rule.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: la distribution (the staggered cast legend: shape + role name + doctrine line, each row indented further) · les rangées (offer/program rows on hairlines, indent stepping 0/6/12%, price bars in role colors) · l'ardoise (the single ink interlude, stats at display scale) · les têtes (geometric-head gallery, offset grid) · l'escalier (a 3-step diagonal staircase of cards linked by a 2px ink stair line) · la frise (a figure band: 3–4 big tabular numbers, each on its role bar).

## Motion identity
GEOMETRIC CHOREOGRAPHY — parts translate and rotate INTO PLACE, an assembly on a drafting table. Order of arrival is law: shape docks first, bar slides second (scaleX 0→1 from left, 0.5–0.7s), words rise last. GSAP 3 + ScrollTrigger via CDN; every hidden state set by gsap.set, never in CSS; gate everything on (gsap && ScrollTrigger && !prefers-reduced-motion); with JS dead the page stands fully assembled.
- Easings: power3.out for entrances, power2.inOut for docking and rotations. Durations 0.55–0.9s; staggers 80–140ms. Rotations always land on 45°/90° multiples. NOTHING bounces, nothing overshoots, nothing squashes.
- The badge turns 360° per 24–32s, linear, infinite — the page's clock.
- THE SHOWPIECE — LA COMPOSITION: one pinned stage (220–320vh of scroll) where the cast travels and rotates across the viewport and ASSEMBLES the client's emblem — monogram, year numeral, product diagram — while the claim and its baseline bars slide in beneath during the final 40–50% of the scrub (never later — the words must already be arriving while the last shape lands). The assembled state IS the CSS resting state; the scrub decomposes backward from it. One per page, always meaningful, never abstract ballet.
- Hovers: bar thickens + glyph rotates 90°, 0.25–0.35s power2.inOut, with keyboard and touch parity (:focus-visible mirrors every hover). Reduced motion: everything pre-assembled, badge parked, pins released — a composed poster, not a blank.

## Ban list (world-specific, atop the global ban list)
- Exposed page-wide grid column rules — that is GRILLE's exposed grid.
- ONE oversized lone circle as the page's single compositional anchor — GRILLE's red circle. BAUPLAN's circle is one character among three and never appears without its castmates' system.
- The extreme flush-left axis with vast right whitespace as law — GRILLE again; BAUPLAN composes asymmetrically in ANY direction.
- Memphis confetti fields, squiggles, zigzag dividers — TUTTI's language.
- Colored offset shadows — TUTTI's; black offset shadows and 3–4px borders — BLOC's. BAUPLAN has no shadows and no borders past 2px.
- Poster-ground rotation (each section a new flat ground) — AFFICHE's move; the BAUPLAN ground never rotates.
- Kandinsky clutter: free-floating shape soup, shapes as sprinkles with no role — the structural crime this world exists to forbid.
- Thick BLACK underline slabs as the only decoration — MANIFESTE's; BAUPLAN bars are role-colored and semantic.
- back.out bounce entrances, squash-and-stretch — GUIMAUVE's physics.
- Arch geometry of any kind — MATIÈRE's; star glyphs as bullets or seals — DIWAN's.
- Gradients or shadows inside shapes; outlined (stroked) shapes; ALL-CAPS display; more than one badge; the badge as button.
- Photography, mascot illustration, emoji-as-icon — imagery is geometric construction only.

## LES GESTES (moves menu)
1. LA CONSTRUCTION D'ANGLE — hero geste: the shape composition anchors the top-right (or left) corner, shapes overlapping in strict paper-cutout order, each wearing a small role caption; the badge overlaps its lowest edge.
2. LE MONOGRAMME — showpiece geste: the cast assembles the client's initial or emblem on the pinned stage; final frame = the brand mark used in the footer.
3. LA BASCULE — a marker shape at a fixed page position rotates 90° as each section passes, a progress dial made of geometry (map its rotation to section index, 0.5s power2.inOut per step).
4. LES RANGÉES INDENTÉES — offers as rows on hairlines, each row indented one step further (0/6/12%), markers on the left, price bars on the right; hover rotates the marker.
5. L'ARDOISE — the single ink interlude: chalkboard ground, stats at clamp(3rem, 8vw, 6rem) tabular, cast at full saturation, one wry lowercase line at the bottom.
6. LES TÊTES GÉOMÉTRIQUES — the team as geometric heads in an offset grid, one large role shape per face, features from the cast; hover/focus rotates one feature 90°.
7. L'ESCALIER — three steps descending a diagonal, cards offset 0/18/36% with a 2px ink stair line drawn between them on entrance; step numbers in display size.
8. LA PORTÉE — baseline bars multiply into 3–5 parallel staff lines carrying words or milestones like notes; the lead shape marks the active beat.
9. LE TRI PAR FORME — interactive geste: the three shapes become filter buttons; picking one dims every element outside its role (0.3s), teaching the role map by touch; aria-pressed synced.
10. LE COMPAS — an ink arc (2px, SVG) draws from a circle's center to connect steps or dates, strokeDashoffset on entrance; the circle character holds the pivot.
11. LA LÉGENDE VIVANTE — la distribution as interaction: hovering/focusing a cast row briefly raises every on-page element sharing that role (a 0.3s lift), proving the system live.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- ÉCOLE MODULE (the shipped demo) — coding bootcamp, Casablanca. Blue triangle leads (la direction), yellow square = les fondations, red circle = la répétition. Hero: la construction d'angle right, claim "le code prend forme." with one blue bar. Showpiece: le monogramme — square docks, triangle crowns it, circle lands as the terminal point; three equal bars slide under "apprendre, c'est assembler." Mood: studious, bright, exact.
- LES TROIS FORMES — a crèche in Rabat. Red circle leads (le jeu), yellow = le goûter et la sieste, blue = les petites victoires. Hero: three geometric child-heads peek over the h1's extra-long yellow baseline bar as over a garden wall — no corner composition, the claim IS the art. Showpiece: LE MOBILE — the cast hangs from drawn 2px ink threads and swings into a balanced Calder-style mobile as you scrub, settling level only on the last beat. Sections: escalier for the day's rhythm, têtes géométriques for the educators. Mood: tender, primary, calm-playful.
- AUTO-ÉCOLE AXE — driving school, Oran. Blue triangle leads hard (la direction, 65%). Hero: a full-width lowercase claim with a convoy of three small triangles crossing under it on entrance; no side composition. Showpiece: LE COMPAS — a triangle travels a drawn route of 90° turns and arcs, assembling a roundabout emblem at journey's end. Rangées indentées for permits and prices in DZD. Mood: confident, kinetic, precise.
- STUDIO KLAR — design studio, Tunis. Yellow square leads but the page runs near-monochrome: ink and ground everywhere, the cast rationed to three loud moments (hero corner, showpiece, footer lineup). Hero: text-only claim over three stacked bars like a flag hoisted at half-width. Showpiece: LE TRI PAR FORME — the portfolio grid resorts itself as each shape-filter is scrubbed past. Mood: severe, gallery-calm, expensive restraint.
- LA PORTÉE — music school, Casablanca. Yellow leads (la structure du solfège), circle = les notes, triangle = la mesure. Hero: five staff-bars cross the viewport, circles sitting on them as a real melody; the h1 sits below like a title on sheet music. Showpiece: LA MÉLODIE — the circles travel their fixed staff lines at different speeds as you scrub, the triangle-metronome ticking each measure, and stack into the year-end chord on the final barline. Ardoise: the recital calendar. Mood: musical, orderly, warm.
- FORUM FORME 2027 — a design conference, Marrakech. Red leads (la parole). Hero: the badge grows to 220px and anchors the composition as the summit's seal, dates in tabular display beside it. Showpiece: LE PLAN DU FORUM — a 2px ink floor plan draws itself (strokeDashoffset), then each shape scales down and settles onto its hall (square = la grande halle, triangle = l'auditorium, circle = le forum rond), captions pinning on last. La frise carries speakers count, hours, workshops; escalier for the three days. Mood: civic, festive-rigorous.
- LINGUA — language center, Agadir. Each shape IS a language (blue = français, red = english, yellow = العربية) — the role map as curriculum. Hero: la distribution promoted to hero position, three staggered rows, no side art. Showpiece: LA BASCULE at page scale — one shape rotates and morphs position per level A1→B2 on a pinned dial. Tri par forme filters courses by language. Mood: welcoming, clear, multilingual.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: (1) ROLE DISCIPLINE — the legend covers every shape on the page; the moment shapes become sprinkles this is tutti with extra steps and the spell is dead. (2) THE ASSEMBLY — the showpiece must assemble something that MEANS (the mark, the year, the diagram), resolve completely, and rest in the exact state the CSS ships; an abstract shape ballet is failure. (3) BAR-BASELINE GLUE — bars welded to type baselines with descenders overlapping; a bar floating mid-air reads as a minimal template, not a bauplan. The cheap details that separate this from a generated page: the badge turning, glyphs on every label, the lowercase discipline held even on the submit button, tabular figures, the 90° hover rotations, the honest success state with a named human. When in doubt, DELETE a shape and give the survivors more meaning — this world's voltage is semantics, not quantity.`,
	energy: "medium",
	family: "bauhaus",
	fusesWith: ["grille", "tutti"],
	id: "bauplan",
	industries: [
		"coding bootcamp",
		"training institute / formation",
		"language center",
		"private school",
		"kindergarten / crèche",
		"music school",
		"online courses / e-learning",
		"design studio",
		"artist / illustrator",
		"marketing / branding agency",
		"driving school",
		"conference / summit",
	],
	kind: "website",
	mood: ["playful", "rigorous", "geometric", "pedagogical"],
	name: "Bauplan",
	preview: {
		accent: "#1D56A5",
		fontFamily: "Jost",
		ground: "#F4F1EA",
		ink: "#14140F",
		sampleWord: "Cercle",
	},
	priceFeel: "accessible",
	tagline: "L'atelier bauhaus : cercle, triangle et carré enseignent la page.",
};
