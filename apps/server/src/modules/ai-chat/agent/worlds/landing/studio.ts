import type { DesignWorld } from "../types";

/**
 * STUDIO — the project index as the home page.
 * The contemporary creative-studio portfolio done at the disciplined end:
 * near-white ground, lowercase wordmark with a trailing period, the HERO IS
 * THE PROJECT LIST, a floating typographic cover follows the cursor, and every
 * project carries a hairline ledger (année / rôle / portée). Zero photography —
 * covers are CSS typographic plates in three fixed two-color pairs.
 * fusesWith rationale: grille (the ledger meets the visible Swiss grid — a
 * studio that sells rigour), manifeste (the index gets one shouting statement
 * page — a studio that sells conviction), photographe (the index becomes the
 * caption system for a real photographic archive).
 */
export const studio: DesignWorld = {
	id: "studio",
	name: "Studio",
	family: "portfolio-index",
	tagline:
		"L'index comme page d'accueil : la liste des projets fait le design.",
	kind: "website",
	mood: ["editorial", "lowercase", "precise", "sober"],
	energy: "medium",
	priceFeel: "premium",
	industries: [
		"design studio",
		"marketing / branding agency",
		"freelancer portfolio",
		"architecture portfolio",
		"artist / illustrator",
		"videographer / production",
		"photographer",
		"writer / journalist",
		"music / band",
		"marketing services",
	],
	avoidFor: [
		"medical",
		"lawyer / law firm",
		"notary",
		"insurance agency",
		"general contractor",
		"HVAC / climatisation",
		"kindergarten / crèche",
	],
	fusesWith: ["grille", "manifeste", "photographe"],
	preview: {
		ground: "#FAFAF6",
		ink: "#131313",
		accent: "#3524E0",
		fontFamily: "Familjen Grotesk",
		sampleWord: "studio sable.",
	},
	doc: `# DESIGN WORLD: STUDIO — l'index comme page d'accueil

## Philosophy
This page is a STUDIO'S ORDER BOOK left open on the table, not a website. The visitor meets no claim and no photograph first: he meets the LIST OF WORK — six to nine project rows, each with its year, role and scope, ruled by hairlines like an accountant's ledger, set in lowercase type big enough to read across the room. The studio does not describe itself; it shows what it shipped. Everything else — statement, services, people, form — is furniture around that index.

Two structural facts make it unmistakable. FIRST: the hero IS the list — a STUDIO page whose first viewport holds no project rows has failed. SECOND: zero photography, zero illustration. Covers are typographic PLATES drawn in CSS — a flat two-color rectangle with the project's name as its own logotype — and one floats beside the cursor as the reader hovers the index. The awarded-studio genre with a bookkeeper's discipline: near-white paper, one ultramarine, one ink, hairlines, no ornament but a single blue period.

Impossible failure modes: a stock-photo hero; a "we are passionate about design" page (the index answers before the sentence does); a rounded, shadowed card page (radius zero everywhere, shadow banned). The one risk to beat is timidity — near-white minimalism drifting into a blank Notion page. Beat it with SCALE (index rows at clamp(1.45rem, 3.1vw, 2.55rem), not 16px), one saturated ultramarine field, and the ledger's density.

Self-audit before shipping — count these: (1) at 1440×900, three project rows minimum in the first viewport; (2) zero \`border-radius\` above 0 and zero \`box-shadow\` in the stylesheet; (3) every project carries at least three ledger values (année, rôle, portée) in the mono at 11–13px; (4) the lowercase wordmark with its trailing period appears at least three times, AT LEAST ONE of them a section mark inside the free middle — masthead plus monument alone fails; (5) zero raster \`<img>\` elements; (6) every hover behaviour has a \`:focus-visible\` twin, including the floating preview.

## The variation contract (why two STUDIO sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- The index-as-hero: the project list opens the page, ruled by hairlines, with the floating cover preview and its docked keyboard/touch twin.
- The lowercase wordmark with an accent trailing period, used as recurring furniture (masthead, section marks, footer monument).
- The meta ledger: année / rôle / portée as mono columns on every project, plus one full ledger block elsewhere on the page.
- Near-white single ground; radius 0; no shadows; hairlines the only rules; typographic plates the only imagery.
- Index-cascade motion: 0.5s power2.out, x-8px, 0.06s row stagger, one scrubbed inline expansion. Nothing bounces or overshoots or blurs.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes: ground #FAFAF6/#F7F6F0, ink #131313/#171716, ultramarine #3524E0/#2A1BC8/#3D2FEA, third plate tone sand #E8E4D8/#EDE6DA.
- The display face within the register: Familjen Grotesk (default), Instrument Sans (tighter, more neutral), General Sans (rounder). One per site. The mono is Fragment Mono, or Red Hat Mono for a wider figure.
- The COLUMN SET — année / rôle / portée is the minimum; a brief may add secteur, équipe, durée, lieu, statut (max six columns on desktop, two on mobile).
- The plate recipes chosen, the number of projects (6–9), the section order beyond the fixed opening and closing, which geste carries the showpiece, and whether the saturated field is the footer or a cover.
A STUDIO page without a decided column set is a blog: fix the columns FIRST, then write the projects into them.

## The vibe (voice)
Lowercase, exact, unhurried — a studio that counts. Short factual sentences; the ledger's figures do the boasting. Never "passionné", never "sur-mesure", never an exclamation mark. Prices and delays are stated plainly: a studio that hides them looks unsure.
Example lines (demo language, French):
- "nous mettons les marques en ordre."
- "chaque projet commence par un inventaire : ce qui existe, ce qui sert, ce qui doit disparaître."
- "identité complète — à partir de 480 000 DA, onze semaines."
Titles and wordmarks lowercase, prose sentence case, UPPERCASE only in the mono. One accent word per statement.

## Visual signatures (measured)
- **INDEX ROWS (owned tic).** Full-bleed rows split by 1px \`rgba(19,19,19,0.14)\` hairlines. Desktop grid: \`56px minmax(0,1.35fr) minmax(0,1fr) 84px minmax(0,1.1fr) minmax(0,0.9fr) 28px\` (n° · nom · secteur · année · rôle · portée · arrow), gap 24px, min-height 92px, centered. Name at clamp(1.45rem, 3.1vw, 2.55rem), lowercase, weight 500, tracking -0.02em. Hover/focus: name and arrow to accent, arrow +6px, hairline to 1px accent, background stays paper (never a grey fill).
- **FLOATING COVER PREVIEW (owned tic).** A 264×176 (3:2) typographic plate lerping after the cursor (factor 0.14, offset +26/+20, clamped 12px inside the viewport) while a row is hovered; \`pointer-events:none\`, translate3d only, built in JS so a script-dead page never misses it. Under it a mono caption bar (10.5px, uppercase, ≤32 characters: \`kalima — collection · 2024\`). Keyboard focus shows the SAME plate DOCKED 28px from the bottom-right (under 860px, a full-width strip with the caption beside the plate). Touch: first tap docks, second tap opens.
- **LOWERCASE WORDMARK WITH TRAILING PERIOD (owned tic).** \`nom.\` set in the display face, weight 500, tracking -0.03em; the period is always accent-colored and always present — in the masthead at 17–19px, as a SECTION MARK at clamp(22px, 2.1vw, 28px) with line-height 1 and 14px of air under it, and once as the footer monument at clamp(3.5rem, 13vw, 11rem). The section mark is the load-bearing one: it heads a free-middle column, directly over that column's ledger or title, and must appear at least once (twice reads better) or the tic is a logo, not furniture.
- **META LEDGER COLUMNS (owned tic).** Mono, 11–13px, uppercase headers (+0.08em, ink 55%), sentence case or figures for values (ink 80%), columns split by nothing but alignment, rows by 1px hairlines. Every ledger has a header row preceded by a hairline that draws left→right on entrance.
- **TYPOGRAPHIC PLATES.** The only imagery. Flat two-color rectangles, radius 0, no shadow, no border unless paper-on-paper (then 1px ink-14%). Aspects: 3:2 preview, 4:3 mosaic, 16:10 case cover.
- **THE BLUE PERIOD.** The accent square/period is the page's ONLY ornament: it ends the wordmark and the h1, marks the active row, bullets service lists (a 7px square, never a disc or glyph), and closes the colophon row. On the ink footer field the square inverts to paper — accent at 7px on near-black is unreadable; the inversion is law.
- **HAIRLINE DISCIPLINE.** Rules are 1px \`rgba(19,19,19,0.14)\`; the accent rule (1px #3524E0) appears at most three times per page. No rule exceeds 1px except the 2px focus underline and the 3px active-tab mark.
- **DENSITY CONTRAST.** Each section pairs one large lowercase mass (title, statement, name) with one dense mono block (ledger, list, prices). A section with neither is cut.

## Color physics
- GROUND: one near-white paper — the #FAFAF6 / #F7F6F0 register. The ground NEVER alternates between sections; rhythm comes from hairlines and plates, not ground flips (another world's move).
- INK: #131313 / #171716 register — near-black, never pure #000000. Secondary states: 80% for ledger values, 55% for headers and captions, 30% for row numerals.
- ACCENT: ULTRAMARINE, the #3524E0 / #2A1BC8 / #3D2FEA register. Budget: links (accent by default, ink on hover), hovered/focused rows, the trailing period, the open row's rule, service numerals, the 7px bullets — plus saturated ultramarine PLATES: max two per viewport, max three per page. Text on ultramarine is the paper tone, never white-white. The one deep field is the INK footer.
- THIRD TONE: sand — #E8E4D8 / #EDE6DA — lives only inside plates and, at most once, as a full-width band behind a ledger. Never the page ground.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · GROUND→--primary-foreground · SAND→--secondary · INK→--accent · ink at 55%→--muted · ink at 14%→--border · zero→--radius · DISPLAY/UI→--font-heading · DISPLAY/UI→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Plate pairs are FIXED (three): ultramarine + paper type · ink + paper type · sand + ink type. A fourth "silent" pair (paper ground, ink type, 1px ink-14% frame) is allowed once per page.
- Gradients: NONE. Not in plates, not in overlays, not behind type, not as select chrome. A plate needing depth gets a hairline.

## Typography system
- DISPLAY / UI: **Familjen Grotesk** (default), ALT **Instrument Sans**, ALT2 **General Sans**. Weights 400/500/600 only. Titles and wordmarks LOWERCASE — a law, not a style choice.
- META / LEDGER: **Fragment Mono** (ALT **Red Hat Mono**), 400 only. It sets numbers, labels, captions, prices, form labels, nav meta — and NEVER prose longer than two lines.
- Sizes: h1 clamp(2.4rem, 5.6vw, 4.6rem)/1.02, tracking -0.035em. Section titles clamp(1.75rem, 3.2vw, 2.8rem). Index rows clamp(1.45rem, 3.1vw, 2.55rem). Statement clamp(1.5rem, 2.6vw, 2.3rem)/1.16. Body 16.5–17.5px/1.62, measure 58–68 characters. Mono meta 11–13px, +0.08em uppercase.
- Display never exceeds 10vw except the footer monument (13vw), the page's last object.
- NEVER italic, in any face. Emphasis is the accent color, the mono, or a new line.
- Figures are tabular (\`font-variant-numeric: tabular-nums\`) in every ledger so years align.
- Arabic pairing: **IBM Plex Sans Arabic** for both roles (500 display, 400 ledger); the lowercase law suspends (Arabic is caseless) but the trailing period stays, tracking goes to 0, and ledger columns mirror to RTL keeping the same hairlines.

## Signature art (the typographic plates) & components
Every cover uses ONE of four recipes, sized relative to the plate's own width (W) so the same plate works at 264px and at 900px:
1. **NOM PLEIN** — the name lowercase at 0.19W, inset 0.05W left/right, at 14% from the bottom; one hairline in the type color at 26% height, edge to edge; a mono code top-left at 0.031W (\`RÉF 04 · 2025\`).
2. **LETTRE SEULE** — the initial at 0.72W, bleeding 8–14% past the bottom-left edge, mono code bottom-right, nothing else.
3. **GRILLE DE MOTS** — the name repeated 4 times at 0.135W, line-height 0.86, top-aligned below the code (top inset 0.15W), the last repetition in the plate's ground color so the stack fades out.
4. **POINT** — the name small (0.084W, line-height 1) at the optical center with the trailing period enlarged to a 0.16W square (≈3× cap height) beside it; the period is the accent when the plate is paper or sand. LAW: the square SITS ON THE TYPE BASELINE and rises from it (\`align-items: baseline\` on the lockup row, that row centered in the plate) — centered against the x-height it reads as a floating block, not a period.
No plate mixes recipes; three recipes minimum per page — six identical constructions read as a template.
- **Buttons.** Corners use min(var(--radius), 0px) — this world's corners stay square. Primary: ink fill, paper type, mono uppercase 12px +0.08em, height 52px, padding 0 24px, arrow "→" moving +6px on hover/focus; hover fills accent. Ghost: 1px ink-24% frame, same metrics. No pills.
- **Forms.** Fields are RULED, not boxed: mono label above (11px, uppercase, ink-55%), input transparent with a 1px ink-24% bottom rule, 44px tall, 17px type; focus turns the rule 2px accent and the label ink-100%. Phone-first: \`type="tel" inputmode="tel"\`, \`<select>\` for structured choices, its chevron a SOLID SVG triangle data URI (10×6, ink) — never CSS gradients, which contradict this world's gradient ban. One off-canvas decoy input carries \`data-wandit-hp\`, untouched by the page's script. On valid submit, dispatch \`wandit:lead\` on \`document\` with the visitor's fields flat in \`detail\`. The success state is a LEDGER RECEIPT, not a smiley: the form hides and three mono rows replace it ("01 accusé de réception sous 24 h · 02 appel de cadrage · 03 proposition sous 5 jours") — ship \`[hidden]{display:none !important}\` or the grid form ignores the attribute.
- **Cards: there are none.** Plates, rows and ledgers only — anything like a rounded shadowed card is out of law.
- **Labels.** Mono uppercase on bare paper, optionally preceded by a 7px accent square. Never a pill or chip.
- \`::selection\` is accent with paper type. \`:focus-visible\` is a 2px accent outline, 3px offset, plus the docked preview for index rows. Decorative SVG is \`aria-hidden\`; meaningful plates get \`role="img"\` and a real \`aria-label\`.
- Favicon: inline SVG data URI — a paper square, ink lowercase bars, the ultramarine period.

## Page chassis
- Container: max-width 1560px, gutter clamp(18px, 4.6vw, 72px). Section rhythm: padding-block clamp(3.5rem, 7vh, 6.5rem), and clamp(2.6rem, 5vh, 4.2rem) for the tight band carrying the showpiece; the hero is tighter still at the top. Never looser: a ledger world reads slack the moment two sections are parted by more than ~150px of bare paper at a 900px viewport.
- ARMATURE LAW: no two consecutive sections share a column ratio — 4fr/8fr · full-bleed case band · 4-column offers · 12-column mur · 5fr/7fr · rail + 4fr/8fr is a legal run. If two neighbours must both be narrow-left/wide-right, change the ratio or push one ledger out into a full-width rail.
- Masthead: wordmark left, 4–5 lowercase nav links right, one mono meta line (ville · disponibilité). Height 64–72px, one hairline under it, no blur, never sticky-glass.
- FIXED OPENING — the index hero: a mono eyebrow row (métier — ville / sélection années), one lowercase h1 of 3–9 words ending in an accent period, a 2–3 line lede or right-column note, then the ledger header row and the project rows. At 1440×900 three rows minimum above the fold.
- FIXED CLOSING — the brief section opens on a FULL-WIDTH LEDGER RAIL: 4 mono cells (réponse / budget minimum / prochaine ouverture / téléphone) under a 1px ink rule, split by hairlines, an 11px uppercase label over a 13.5px value, 2×2 below 1023px. Then the form (ruled fields, honest delays, a starting price), its legal footnote pushed to the FOOT of its column (\`margin-top:auto\`), level with the submit row. Then the footer monument: the wordmark at clamp(3.5rem, 13vw, 11rem) on the ink field, a mono contact row closed by the 7px paper square, a colophon naming the two faces.
- FREE MIDDLE — compose 3–5, never two adjacent alike: the statement split (a narrow column headed by the wordmark section mark, carrying the studio ledger and one mono note, against a wide column holding the statement over a two-column body) · the services ledger (3–4 columns, big accent numerals, deliverables, a starting price) · the case-study band (the scrubbed expansion) · the mur (asymmetric mosaic of 4–6 plates at three sizes, mono captions) · the atelier split (sticky heading + people ledger + ONE static client quote) · the year rail.
- Social proof is ONE static quote in the display face at clamp(1.3rem, 2.2vw, 1.9rem), lowercase, attributed in mono. No carousel.
- Mobile: rows collapse to two lines (name + année, then rôle · portée in mono), min-height 76px, hairlines intact. No ledger becomes labelled paragraphs.

## Motion identity — INDEX CASCADE (GSAP 3 + ScrollTrigger, CDN)
Governing law: every hidden state is set by \`gsap.set()\`, NEVER in CSS. Gate the block on \`(window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches)\`. With JS dead the page is complete: rows visible, case band expanded, preview absent.
- Entrances: index rows arrive \`x:-8, autoAlpha:0 → 0/1\`, 0.5s power2.out, stagger 0.06s, top→bottom. Blocks (titles, ledgers, plates) use the same 0.5s power2.out with y ≤ 10px and stagger 0.08s. Hairlines draw \`scaleX 0→1\`, transform-origin left, 0.6s power2.out.
- Hover/focus transitions: 160ms \`cubic-bezier(0.2, 0.6, 0.2, 1)\`. The floating preview follows the cursor by linear interpolation at 0.14 per frame — it must lag visibly; instant tracking kills the tic.
- THE SHOWPIECE — inline row expansion (one per page). The section holds a MINI-INDEX: the open row on top, the remaining projects beneath as compact 72px ghost rows, so the expansion reads in context. On scrub: the arrow rotates 180°, the band grows 0 → its measured height, the ghosts fade with y+16 (0.05s stagger), the cover wipes in from x:-5% with \`clip-path: inset(0 100% 0 0) → inset(0)\`, then copy and ledger rows cascade (0.06s). Pinned on \`min-width:1200px\`, \`end:"+=110%"\`, \`scrub: 0.8\`. LAW: freeze the pinned stage in JS at its OPEN height (measured on \`refreshInit\`) with \`overflow:hidden\` — a stage that grows during the scrub tears the pin spacer and the next section slides under it. Below 1200px the band is simply expanded on entry — never pinned, ghosts dropped.
- Loops: none. No marquee, no drift, no pulse. The only continuous motion is the preview lerping while the cursor moves.
- Banned motion: overshoot/back easings of any strength, bounce, blur transitions, parallax on type, scale entrances above 1.02, fade-up-from-20px as the only entrance.
- Reduced motion: case band expanded, all rows visible, hairlines drawn; the preview still appears but DOCKS instantly (no lerp, no follow). The reduced page is a composed still, not a blank.

## Ban list (in addition to the global ban list)
- MANIFESTE's words-as-layout at 15–25vw, its black/white inversion flips, its 8–16px underline slabs — STUDIO's inversions stay inside plates.
- GRILLE's exposed page-wide column rules, its one oversized red circle, its extreme flush-left axis with vast right whitespace.
- CINÉTIQUE's marquee strips, glyph-scramble decoder, difference-blend chrome and telemetry voice (SYS.STATUS, FILE 001) — our mono speaks bookkeeping, not machinery.
- SILHOUETTE's huge-type-over-photography collisions — and photography itself: no photos, no video, no illustration.
- PHOTOGRAPHE's contact-sheet strips and EXIF chips; CATALOGUE's SKU captions and its one-time FLIP grid resort.
- HYPERTEXTE's ironic default-web furniture (visitor counters, "last updated", joke blue underlined links).
- CALDERA's 800px pill-nav container and any pill chrome; ÉCLAT's deep-rounded masks — this geometry is square.
- Any \`border-radius\` above 0 (focus rings excepted) and any \`box-shadow\`, including the "subtle" 0 1px 2px kind.
- Grey hover fills, grey card backgrounds, "surface" tones between ground and ink.
- Italic type; letter-spaced whisper labels in the DISPLAY face (labels are mono or they do not exist).
- Centered layouts: one left axis for prose, one right axis for figures; nothing long is centered.
- Projects without a ledger — no année/rôle/portée, no row.

## LES GESTES (moves menu)
1. **L'INDEX PLEIN CADRE** — the list opens the page under a 3–9 word lowercase h1, six to nine rows, hairlines edge to edge, three rows above the fold. The ruthless version drops the h1 and starts the rows at 18vh.
2. **LA VIGNETTE FLOTTANTE** — the 264×176 plate lerping after the cursor over the index, swapping per row, docking on keyboard focus and first touch. Never two at once.
3. **LE SOMMAIRE SCINDÉ** — hero split in two: a numbered mono table of contents left, one large plate right that CHANGES per hovered or focused line. The preview becomes architecture.
4. **LE DÉPLIEMENT DE LIGNE** — the showpiece: inside a mini-index (open row + ghost rows), one row expands inline into a case band on scrub while the ghosts fade, cover wiping in, ledger filling. Once per page.
5. **LE MUR** — an asymmetric mosaic of 4–6 plates at three sizes (one at 2 columns, the rest at 1), mono captions, deliberately unequal row heights.
6. **LE REGISTRE OUVERT** — a ledger block as a section in its own right: services, prices, delays or years — mono headers, hairlines, tabular figures. Its horizontal form is the RAIL: 4 cells across the full width.
7. **LA COLONNE DE CHIFFRES** — 3–4 columns, each with an accent numeral at clamp(2.2rem, 4vw, 3.4rem), a lowercase title, a mono deliverable list bulleted with 7px accent squares, a starting price at the foot.
8. **LA SIGNATURE BASSE** — the footer monument: the wordmark at clamp(3.5rem, 13vw, 11rem) with the accent period, on a hairline over a mono contact row.
9. **LE POINT BLEU** — the accent period/square doing all the ornament work: end of h1, active row, list bullet, success mark.
10. **LA FICHE ATELIER** — the studio's own ledger: fondé / effectif / ville / langues, plus ONE static client quote in lowercase display, mono attribution.
11. **LE DEVIS HONNÊTE** — a price ledger with starting prices and durations in plain figures ("à partir de 480 000 DA · 11 semaines"), one line per offer, never "sur devis" throughout.
12. **LE RAIL DES ANNÉES** — a horizontal strip of years with project counts beneath, the current year marked by the accent square; may scrub sideways as an alternative showpiece.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**sable — l'index nu.** A branding studio in Alger. Hero: mono eyebrow, a one-line lowercase h1 ending in a blue period, a two-line lede right, then six index rows filling the viewport with the floating preview. Showpiece: LE DÉPLIEMENT DE LIGNE — the Mellah row expands inline into a case band, its ultramarine plate wiping in from the left while the ledger fills. Middle: statement split, services columns, the mur. Mood: exact, quiet, expensive.

**sommaire — le studio d'édition.** A studio that designs books. Hero: split — a numbered mono table of contents (01–08) left, one large 4:3 plate right changing per hovered line (GRILLE DE MOTS, sand plates). Showpiece: the plate wall re-stacking — six mur plates sliding from a mosaic into one centered column on scrub, captions collapsing into a ledger. Mood: bibliographic, warm-neutral, patient.

**bureau des noms.** A brand consultancy. Hero: no rows at first — the client names run as one continuous lowercase display paragraph, comma-separated, over two-thirds of the viewport; hovering a name lights it accent and docks its plate. The index sits below. Showpiece: LE RAIL DES ANNÉES scrubbing sideways 2016 → 2026, counts ticking, the accent square travelling. Mood: dense, confident, verbal.

**atelier d'abord.** A four-person studio that sells its people. Hero: two-column intro — the studio ledger (fondé, effectif, ville, langues) in mono left, a lowercase statement and one static client quote right, plates absent; the index arrives as section two, full width. Showpiece: the services ledger WRITING ITSELF — hairlines drawing left→right line by line, prices counting up on scrub. Mood: human, plain, credible.

**trois colonnes.** A motion and identity studio. Hero: three narrow columns of small type — services / clients / distinctions — the lowercase wordmark spanning the viewport's bottom edge at 13vw, the index compressed to a two-column list underneath. Showpiece: a pinned single plate CUTTING through the six covers with hard cuts (no crossfade), its caption ledger updating on each cut. Mood: graphic, editorial, brisk.

**carnet de commandes.** A studio taking two projects a year. Hero: a mono availability line ("disponible à partir de mars 2026"), then only THREE index rows at 5rem, the preview docked permanently right instead of floating. Showpiece: a pinned two-pane case study — the left ledger stays fixed while the right pane advances through three plates. Mood: scarce, calm, senior.

**fiche technique.** An architecture-and-signage studio. Hero: one full-width claim across two lines with the accent period, the index beneath in a compact two-column arrangement (names left, mono ledger right). Showpiece: the case ledger filling COLUMN BY COLUMN — année, rôle, portée, équipe — vertical hairlines drawing downward between them on scrub. Mood: technical, dry, precise.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or this world collapses into a blank page. FIRST, the INDEX: large type, exact hairlines, columns aligned to the pixel, a hover that feels electric (accent name, travelling arrow, plate lagging behind the cursor). SECOND, the PLATES: three recipes minimum, real two-color pairs, no gradients, no photos — the whole imagery budget spent in type. THIRD, LEDGER HONESTY: real years, roles, scopes and starting prices in local currency; a ledger of vague words is worse than none.

Cheap details that separate this from a generated page: the blue period closing the wordmark and the h1; tabular figures so years align; the 7px square instead of a bullet glyph; the mono caption under every plate; the docked preview on keyboard focus (nobody does it, everybody notices); the receipt as three numbered steps. When a STUDIO page feels flat, do not add color — add ROWS, add ledger columns, take the index type one step larger.`,
};
