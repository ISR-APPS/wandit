import type { DesignWorld } from "../types";

/**
 * GRILLE — the visible order.
 * The LIGHT swiss: International Style on white paper. A strict VISIBLE grid
 * the content demonstrably snaps to, one grotesk family at every size,
 * red/black/white, an extreme flush-left axis, and one oversized red circle
 * as the page's only ornament. Mathematical calm sold at a premium.
 * (CINÉTIQUE is the dark swiss — this world keeps maximal distance from it.)
 */
export const grille: DesignWorld = {
	avoidFor: [
		"kids & baby shop",
		"gelato / desserts",
		"tattoo & piercing",
		"festival",
		"guesthouse / riad",
	],
	doc: `# DESIGN WORLD: GRILLE — the visible order

## Philosophy
This page is a TYPOGRAPHIC SCORE PRINTED ON WHITE PAPER — Basel, 1962, a poster for a client who pays for rigor. The grid is not scaffolding to be hidden; the grid IS the subject. Defining structural facts: (1) the layout grid is VISIBLE — 1px column rules run the full height of the page and every block of content demonstrably lands on them; (2) ONE grotesk family sets every character on the page, at every size, from the 0.72rem label to the 8.75rem hero; (3) the palette is white, near-black and one signal red, plus a single working grey — nothing else, ever; (4) all type hangs on a hard flush-left axis, ragged right, with vast deliberate whitespace to the right; (5) exactly ONE oversized red circle exists on the page — the only ornament, the only curve, the page's compositional anchor. Failure modes this world makes structurally impossible: the gradient wash (gradients do not exist here), decorative sprawl (nothing may exist without a column address), the centered template hero (centering is banned), the dark techy landing (CINÉTIQUE's territory — GRILLE is the light swiss and stays in daylight). Self-audit before shipping: exactly 1 circle in the DOM; red appears only as the circle + at most 2 rules + text links/focus/selection + ONE display word; computed font-family count = 1; centered text blocks of any kind = 0; border-radius values other than the circle's 50% = 0; at 390, 768 and 1440 the column rules are visible and at least five elements per viewport sit exactly on a rule.

## The variation contract
WORLD LAW — never renegotiated by brief or builder:
- The exposed grid: page-wide 1px column rules content visibly snaps to. 12 columns desktop (10 permitted for narrow briefs), 4 on mobile.
- ONE grotesk family for everything; hierarchy by size and weight only.
- White ground, near-black ink, ONE signal red under strict budget, one grey. No other hue may enter, no gradient anywhere.
- Extreme flush-left: every text block ragged-right on a hard left axis; no centered type, no right-aligned type (meta columns are flush-left on their OWN column).
- Exactly one red circle, oversized, flat-filled — the page's single ornament and single curve. Everything else is square-cornered.
- Motion is axis-locked: entrances slide on x only, expo.out. The circle is the one element licensed to leave the x-axis, and only while entering or leaving its dock in the showpiece.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact red inside the register (#E22219 / #D91E15 / #EA2C1F) and the grey (#8C8C8C / #6F6F6F).
- The grotesk within the register: Archivo OR Hanken Grotesk (one per site, weights 400–800).
- The CONCEPT NOUN that drives the build — le raster, la mesure, l'axe, la cadence, le registre — it names the showpiece scene, the voice and the one red word.
- The circle's size, placement and narrative role (poster anchor, decimal point, clock, seal, period).
- Column count (10 or 12), the section order between the fixed opening and closing, which raster-type showpiece plays, and the page's language.
Two GRILLE sites share the skeleton and the discipline; they must never share the circle's role, the hero composition or the showpiece scene.

## The vibe (voice)
Terse, declarative, numerate. Sentences that could survive a board meeting: subject, verb, figure, full stop. Numbers are spoken precisely ("CHF 11.2M annual run-rate saving", never "significant savings"). No adjectives of enthusiasm, no exclamation marks, no "solutions". Example lines in register: "Order is the advantage." · "Three scenarios. One recommendation. The dissent documented." · "State your question in one paragraph. A partner replies within two business days."

## Visual signatures
- THE EXPOSED GRID (owned tic): a fixed full-height layer of 1px column rules in ink at 6–8% opacity (rgba(10,10,10,.06–.08)), 12 columns desktop / 4 mobile, sharing the exact container geometry of the content (max-width 1360px, padding-inline clamp(20px,4vw,56px), gap 0). Content grids use the identical template so left edges of type land ON the rules — the snap must be demonstrable in a screenshot.
- THE SINGLE RED CIRCLE (owned tic): one flat-filled circle in the signal red, diameter register min(44vw, 620px) on desktop / min(56vw, 300px) on mobile, placed asymmetrically (upper-right third of the hero is the default), allowed to bleed off the page edge. It is the only curve, the only ornament, and it may travel during the showpiece. Never outlined, never gradient-filled, never duplicated.
- EXTREME FLUSH-LEFT AXIS (owned tic): headlines, body, labels, meta — everything ragged right on one hard left axis per block; the hero keeps ≥25% of its width empty on the right. Justified text and centered text are structural crimes here.
- Rule hierarchy, three strengths only: section-opening rules 1px solid ink at 100%; inner dividers 1px ink at 12–15%; the grid layer at 6–8%. Red rules: maximum 2 per page, 2px tall.
- Labels sit ON rules, never float: index + uppercase, 0.72–0.78rem, +0.14–0.16em tracking, weight 600, placed directly under a full-strength section rule ("01 — The practice" register).
- Square-corner law: every box, button, field, card and cell uses min(var(--radius), 0px) — this world's corners stay square. The circle holds the entire curve budget.
- Ink cells: at most 2 blocks per page may fill solid ink with white type (a stat cell, a CTA) — punctuation marks, not a dark mode.
- Numerals do the decorating: font-variant-numeric tabular-nums on every figure row; prices, years and durations aligned in their own columns.

## Color physics
- GROUND: the #FFFFFF/#FAFAFA register. White is the material of the page; a #FAFAFA panel may seat the form, nothing darker.
- INK: the #0A0A0A/#111111 register — near-black, never pure #000, never brown or blue-black.
- SIGNAL RED: the #E22219 register (#D91E15–#EA2C1F). BUDGET, absolute: the circle · at most 2 rules (2px) · text links, :focus-visible ring and ::selection · ONE display word per page. Nothing else. A second red word is a failure; a red background section is a catastrophe.
- GREY: #8C8C8C/#6F6F6F for secondary text and captions only — never headlines, never rules (rules are ink at reduced opacity).

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · SIGNAL RED→--primary · GROUND→--primary-foreground · GROUND's soft panel→--secondary · INK→--accent · GREY→--muted · ink at 12%→--border · zero→--radius · the ONE grotesk→--font-heading · the same grotesk→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, rule or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Gradients exist NOWHERE — not in the circle, not in hovers, not in overlays. Shadows exist nowhere either: depth is a lie this page refuses to tell.
- Ink fills: the ≤2 ink cells are the only inversions. No full dark sections — that flip is MANIFESTE's move and the dark ground is CINÉTIQUE's home.

## Typography system
- ONE family for every glyph on the page: Archivo or Hanken Grotesk (Google Fonts), weights 400/500/600/700/800. Never a serif, never a mono, never italic. Hierarchy is built from size, weight, the grey, and the one red word — nothing else.
- Hero statement: clamp(3.4rem, 9.5vw, 8.75rem), weight 800, line-height 0.92, letter-spacing −0.04em, ≤8 words.
- Section titles: clamp(2rem, 4.2vw, 3.6rem), weight 700, letter-spacing −0.02em, line-height 1.02.
- Lead paragraphs: clamp(1.35rem, 2.4vw, 2.1rem), weight 500, line-height 1.3.
- Body: 1–1.0625rem, weight 400, line-height 1.55–1.65, max-width 36em. Zero letter-spacing on body.
- Labels/nav: 0.72–0.82rem, weight 600, uppercase, +0.14em tracking — the only uppercase allowed.
- Figures: weight 700–800, tabular-nums, clamp(1.6rem, 3vw, 2.6rem) in fact stacks; the hero-scale figure register clamp(2.6rem, 5.5vw, 5rem) when a number is the section's subject.
- Arabic pages: the same laws with the axis mirrored (hard flush-RIGHT, ragged left). Family register: IBM Plex Sans Arabic or Noto Kufi Arabic — one family, geometric, never a naskh serif. Sizes and weights unchanged.

## Signature art / components
- IMAGERY: there is none. No photography, no illustration, no icons. Typography, rules, figures and the one red circle ARE the imagery. Where a competitor puts a stock photo, GRILLE puts a fact set on the grid. Data is the art direction: fact columns, index rows, tabular results with years and CHF figures.
- Buttons: square, solid ink fill with white label, or 1px ink outline ghost; padding 0.9rem 1.6rem; label 0.82rem uppercase +0.14em; an "→" glyph that slides +4px on hover/focus (0.18s). No radius, no shadow, no gradient.
- Cards (mandates, facts): 1px solid ink border, white fill (they visibly cover the grid layer), padding 22–26px, square. Titles weight 700; the year/meta in grey on its own line. Never CLAIR's soft-shadow float.
- Forms: fields are rule-objects — border 0, border-bottom 1px solid ink, transparent fill, square; label above in the label style; focus turns the bottom rule red plus the global red focus ring. Phone-first: the tel input sits directly after the name, type="tel", inputmode="tel". Submit is the ink button. Honest success state: the form swaps for a composed confirmation block (a full-strength rule, "Received.", the real next step and a real phone number) inside an aria-live="polite" region. On valid submit dispatch the "wandit:lead" CustomEvent on document with the visitor's fields flat in detail ({ name, phone, email, company, message }), and keep one off-canvas decoy input with data-wandit-hp that the page's own script never touches.
- ::selection — red ground, white text. :focus-visible — 2px solid red outline, offset 3px. Grid layer and circle carry aria-hidden="true"; one h1; header/nav/main/footer landmarks.
- Favicon: inline SVG data URI — red circle offset right on white with one ink column rule at the left.

## Page chassis
- Container: max-width 1360px, padding-inline clamp(20px,4vw,56px). Section vertical rhythm: clamp(4rem,9vh,6.5rem) desktop, clamp(3rem,6vh,4rem) under 900px (mobile dead zones are the fastest way to lose the premium read). Content grid: repeat(12,1fr) gap 0 desktop, repeat(4,1fr) mobile; blocks address columns explicitly (a block that spans 1/-1 by default is a failure of nerve).
- FIXED OPENING — the poster hero: label + one 2px red rule (this may spend one of the two red rules), the ≤8-word statement flush-left spanning ≤9 columns with the ONE red word inside it, a sub ≤60 words on columns 1–5, a meta strip whose 3 items each start exactly on a column rule, and the red circle in the upper-right third, bleeding the edge. Min-height 88–100vh. The hero itself carries overflow-x: clip — the bleeding circle must never widen scrollWidth (html/body clip alone does not shrink it); on mobile every text block returns to columns 1/-1 on the hard left axis, numbers stacked above their titles, never a floating mid-axis. The wordmark header above it: brand on columns 1–4, nav flush right, one full-strength bottom rule.
- FIXED CLOSING — contact + monument footer: the form seated on the grid (copy columns 1–5, fields columns 6–12), then the footer: the second red rule full-width at 2px, a giant flush-left wordmark clamp(2.6rem,9vw,8.5rem) with the second word in grey, and meta columns (address / contact / legal) each on their own rule.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: the asymmetric lead (lead paragraph columns 1–7, fact stack columns 9–12) · index rows (numbered full-width rows: n° col 1, title cols 2–5, description cols 6–9, tabular meta cols 10–12, hairlines between) · the staggered case grid (two card columns, the right column dropped by 5–7rem — l'escalier) · the method quartet (4 columns of 3, each opening with its own full-strength rule) · the figure column (a stack of hero-scale numbers with grey captions) · THE RASTER SHOWPIECE (below — mandatory, one per page).

## Motion identity
- Personality: AXIS-LOCKED SLIDES — x only, expo.out. Nothing ever enters from above or below; nothing floats, drifts, parallaxes, rotates or bounces. The page moves like a compositor sliding type into a chase.
- Entrances: from x −24 to −48px with autoAlpha, duration 0.55–0.8s, expo.out, staggers 60–90ms within a group. The hero plays once on load; everything else on enter at 88% viewport, once.
- Hovers: 0.18s x-indents (+4 to +8px) and rule-darkening; always with :focus-visible parity. No scale, no shadow, no color inventions.
- THE SHOWPIECE — "le raster" (scroll-scrubbed, pinned on desktop): an empty region of the grid assembles. First the region's own rules draw in (verticals scaleY from 0, transform-origin top; horizontals scaleX from 0, origin left; ease none), then content blocks snap into cells one at a time (x from −70, autoAlpha, expo.out, sequenced ~0.25 apart on the scrub), and finally the page's single red circle travels into its reserved empty cell and docks, scaled to ~0.8 of the cell — the composition's full stop. Scrub 1, pin length +=1800–2000px. Kin variants (client-owned): the agenda assembling into a time grid, figures sliding into a totals column, a 12-column layout re-snapping to 6 then 3, the circle traveling a top rule as a clock. All are "content snapping to a visible grid"; anything else is another world's showpiece.
- Mobile: no pinning; the raster stacks and each cell slides in on enter (x −24, once); the circle stays absolute in the hero.
- Reduced motion / JS dead: the full page is a composed still — CSS never hides anything (only gsap.set/fromTo may), the raster renders fully assembled, the circle rests at its hero position.

## Ban list (adds to the global ban list)
- Dark grounds, machine-telemetry voice (SYS.STATUS, FILE 001, coordinate captions), outline/stroked display type, mix-blend-mode difference chrome, ghost numerals overflowing columns, rotated crossing marquees, parenthesized chapter numbers — all of that is CINÉTIQUE's language, the dark swiss; GRILLE never touches it.
- Graph-paper/drafting-paper grounds, dimension lines with arrowheads, title-block cartouches, red-pencil markups — GABARIT's drawing board. GRILLE's lines are LAYOUT rules, never paper texture and never measurement.
- Viewport-scale words-as-layout (15–25vw titles), black/white section inversion flips, thick underline slabs — MANIFESTE's moves.
- The primary triad and the circle/triangle/square character cast, baseline color bars under type, rotating circular text badges — BAUPLAN's kindergarten Bauhaus. GRILLE has one shape, one red, zero yellow, zero blue.
- Justified multi-column broadsheet text and halftone-dot imagery — GAZETTE's press room.
- Soft-shadow floating cards — CLAIR owns the only license; GRILLE's cards are flat 1px ink boxes.
- Floating letter-spaced micro-caps on bare ground — ÉCRIN's whisper; GRILLE's labels always sit on a rule.
- Any second accent hue, any gradient, any shadow, any border-radius off the circle, any italic, any serif or mono glyph, any icon set (arrows are typographic glyphs).
- Centered type of ANY kind — heroes, prose, labels, captions, figures (the variation contract's "no centered type" is absolute, no centered moment exists); right-aligned columns; y-axis entrances or parallax of any kind.
- Photography or illustration of any kind — the moment an image appears, the world has died.

## LES GESTES (moves menu)
1. L'AFFICHE — the poster hero: statement lower-left at full clamp scale, circle upper-right bleeding the edge, meta strip pinned to the hero's foot with each item starting on a rule. The default opening; vary the statement's column span (5–9) and the circle's tangency.
2. LA COLONNE DE FAITS — a fact stack on columns 9–12 riding beside a lead paragraph on 1–7: each fact opens with a 12% hairline, figure at weight 800, grey caption under. The asymmetry IS the design.
3. LES LIGNES D'INDEX — services or programs as full-width numbered rows (n°, title, description, tabular meta — each on its own column start), hairlines between; on hover/focus the row indents +6px on x.
4. LE RASTER — the showpiece: rules draw, blocks snap, the circle docks (spec in Motion identity). Its content must be REAL — a mandate's twelve weeks, an agenda, a totals column — never abstract demo blocks.
5. L'ESCALIER — the staggered case grid: two columns of bordered cards, the right column dropped 5–7rem so the eye descends a staircase; years and results in tabular figures.
6. LE QUATUOR — four method columns of 3 each with its own full-strength opening rule and small grey ordinal; reads as one ruled band across the page.
7. LA COLONNE DE CHIFFRES — a vertical stack of 3–4 hero-scale figures (clamp(2.6rem,5.5vw,5rem), tabular) with one-line grey captions; the page's loudest section with zero decoration.
8. LE MOT ROUGE — the single red display word, placed in the hero statement or one section title; it should carry the concept noun's weight ("Order", "Mesure", "Cadence").
9. LA RÈGLE VIVANTE — one of the two red rules drawn in by scaleX (origin left, 0.6s expo.out) as its section enters — the only red allowed to move outside the circle.
10. LE DUO NOIR — the ≤2 solid ink cells with white type used as punctuation: one mid-page stat cell, one closing CTA. Never adjacent, never more.
11. LA MARGE HABITÉE — one tiny grey caption placed far right in the hero's emptiness, at the circle's tangent, flush-left on its own late column ("Geneva · Rue du Rhône 14" register: city, address, founding year — plain print meta, never coordinates or telemetry) — the whitespace made deliberate.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. LA CADENCE — management consultancy (the demo's kin). L'affiche hero, "Order is the advantage." with Order in red; the raster assembles a twelve-week mandate into a 4×3 cell plan while the circle slides from its hero bleed to dock in the reserved cell. Middle order: asymmetric lead → index rows → raster → escalier → quatuor. Mood: severe calm, expensive.
2. LE SOMMAIRE — law firm. The hero IS a numbered table of contents: six practice areas listed flush-left at lead scale, the circle sitting behind the list like a press seal; no statement line. Showpiece: the contents rows un-stack and re-snap into a 3×2 practice grid as you scrub, each row sliding x into its cell. Closing adds a la marge habitée bar-admission line. Mood: institutional, precise.
3. LE RAPPORT — accountant / financial advisor. Hero: one hero-scale figure ("CHF 4.2M recovered — FY 2025") with the circle as the DECIMAL POINT inside the number; le mot rouge is spent on "recovered". Showpiece: la colonne de chiffres scrubbed — figures slide in one by one and a final rule draws under the total. Middle order: quatuor first, then index rows, then the figure column. Mood: audited, airtight.
4. L'ORDRE DU JOUR — conference / summit. Hero: date and venue as the statement ("Geneva. 14–15 March."), circle top-right as the sun of the poster; the schedule is the page. Showpiece: agenda blocks snap into a two-day time grid, and the circle travels along the top rule from 09:00 to 18:00 as a clock hand's dot. Sections: speakers as l'escalier, venue as la colonne de faits. Mood: civic, typographic.
5. LE REGISTRE — recruitment / HR firm. Hero: l'affiche with the statement on only 5 columns and a la marge habitée caption; circle small-large tension (circle bleeding the RIGHT edge at 44vw). Showpiece: a candidate pipeline raster — five stage columns draw, candidate-count cells snap left to right, the circle docks on "Placed". Le duo noir spent on the placement-rate cell. Mood: procedural, human numbers.
6. LA VERSION — IT services / SaaS. Hero: product claim on 7 columns, circle tangent to the claim's last line; one red word "ships". Showpiece: the re-snap — a 12-column feature layout re-flows to 6 then to 3 columns under scrub, blocks sliding x into each new address, proving the system in theater. Middle: figure column of uptime/latency numbers, then index rows of services. Mood: engineered, lucid.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: THE VISIBLE SNAP (the grid layer must be seen AND obeyed — one block floating off the rules breaks the entire premise; screenshot-audit the alignment), THE RED DISCIPLINE (one circle, two rules, one word — the instant red multiplies, GRILLE becomes a template with a color scheme), and THE FLUSH-LEFT NERVE (the vast right emptiness is the luxury; a builder who fills it has bought nothing). The cheap details that separate it from a generated page: tabular-nums on every figure, labels seated on their rules, the +6px x-indent hover, square corners held everywhere, the ::selection in red, and the circle bleeding the edge instead of sitting politely inside it. When in doubt, remove the element — order is this world's voltage.`,
	energy: "medium",
	family: "swiss-grid",
	// gabarit: drafting precision meets layout precision — engineering consultancies.
	// clair: the grid learns to smile — product companies needing rigor + warmth.
	fusesWith: ["gabarit", "clair"],
	id: "grille",
	industries: [
		"medical lab / analyses",
		"property management",
		"business consultant",
		"accountant",
		"financial advisor",
		"insurance agency",
		"lawyer / law firm",
		"recruitment / HR",
		"translation office",
		"IT services / agency",
		"SaaS product",
		"startup (pre-launch / waitlist)",
		"marketing / branding agency",
		"design studio",
		"architect (firm)",
		"real estate agency",
		"commercial real estate",
		"conference / summit",
		"training institute / formation",
	],
	kind: "website",
	mood: ["mathematical", "calm", "precise", "modernist", "confident"],
	name: "Grille",
	preview: {
		accent: "#E22219",
		fontFamily: "Archivo",
		ground: "#FFFFFF",
		ink: "#0A0A0A",
		sampleWord: "Raster",
	},
	priceFeel: "premium",
	tagline: "La grille visible : rouge, noir, blanc — l'ordre comme luxe.",
};
