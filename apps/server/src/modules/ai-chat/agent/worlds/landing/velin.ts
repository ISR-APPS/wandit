import type { DesignWorld } from "../types";

/**
 * VÉLIN — the cream literary revue.
 * Family: creamy-editorial. The page as a beautifully set magazine issue:
 * serif-only, cream vellum grounds, espresso ink, fig-plum accent, engraved
 * SVG plates, chapters and folios. Proven against the Maison Vermeil demo
 * (pâtisserie fine, Paris); every value in the doc was shipped there.
 * fusesWith rationale — aquarelle: watercolor florals enter the revue
 * (weddings/beauty); herbier: botanical plates in an editorial frame (wellness).
 */
export const velin: DesignWorld = {
	avoidFor: [
		"fast food",
		"spare parts",
		"crossfit / functional",
		"dev tool",
		"car wash & detailing",
	],
	doc: `# DESIGN WORLD: VÉLIN — the cream literary revue

## Philosophy
This page is an ISSUE OF A LITERARY REVUE, not a website — a beautifully set magazine spread printed in flat inks on cream vellum. The client's business is EDITED, never marketed: offers become chapters, prices sit in a carte behind dot leaders, the story is a chronicle with dates in the margin, the contact form is correspondence, the footer is a colophon. Its first structural fact: SERIF-ONLY. This world sets not one sans-serif and not one monospace glyph anywhere — not in labels, not in numerals, not in form fields, not in the smallest legal line. Hierarchy is carried entirely by size, weight, small caps, ONE italic word, and the three owned tics. Its second structural fact: BOOK FURNITURE, used honestly — chapter numbers, folio page numbers, a sommaire, plate captions, a colophon — real navigation the reader can trust, not decoration. Its third structural fact: imagery is ENGRAVED-PLATE LINE ART drawn in SVG — espresso hairline strokes on the cream ground, cross-hatched shading, exactly one fig-plum spot per plate — captioned like plates in an old edition ("Planche 1 — Le Vermeil, entremets de la maison"). Structurally impossible failure modes: a gradient hero, a sans-serif UI shell wrapped around serif content, photography with a dimming overlay, cold grey minimalism, anything that bounces. Self-audit before shipping (count them): zero sans/mono glyphs page-wide; no headline holds more than ONE italic word; every section label sits between double filets; at least TWO boxed drop caps, each carrying its tiny folio number; zero gradients and zero box-shadows (flat inks only); the accent never fills an area larger than a button, except the giant sommaire folio numeral at ≤14% opacity.

## The variation contract (why two VÉLIN sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Serif-only typography, with italic as a precision instrument: at most one italic word per headline; elsewhere italic exists only in one-line captions and attributions, never a full paragraph.
- Cream vellum double ground, espresso ink, fig-plum accent — all inside their registers below. NO gold, NO terracotta.
- The three tics: the boxed drop cap with folio, the italic accent word, double-filet rules.
- Book furniture: chapters with folios, a sommaire (or an equivalent index), a colophon closing.
- Engraved-plate SVG line art as the ONLY imagery.
- Unhurried editorial mask-reveals (power2.out, 0.9–1.2s). Nothing snaps, nothing bounces, nothing draws itself stroke-by-stroke.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- Exact hexes inside the registers (a warmer cream, a darker plum, a rosier plum — see Color physics).
- The display face WITHIN the register: Fraunces OR Newsreader (one per site). Body: Source Serif 4 OR Lora.
- The ISSUE CONCEPT that names the page — le cahier d'automne, la revue des chambres, le numéro des noces, le carnet de la table — it names the chapters, chooses the plates, seeds the showpiece and tunes the voice.
- Chapter count, names and order beyond the fixed cover and the fixed correspondence + colophon; which subjects are engraved; the showpiece variant (le sommaire filé OR la tourne); which 2–3 gestes are played.
A VÉLIN page without its issue concept is a failure: name the number FIRST ("Cahier d'automne", "Numéro des noces"), then let it choose chapters, plates and words.

## The vibe (voice)
Literary French with a maker's restraint — measured, sensuous, precise. Short sentences that taste their words; concrete nouns (le feuilletage, la petite cuillère, l'encre, la vitrine); numbers written with care (douze places, 24 h, à partir de 480 €). Register lines:
- "Sept pièces par saison. Pas une de plus, chacune à l'heure juste."
- "Une pâtisserie se lit deux fois : des yeux, puis à la petite cuillère."
- "On n'ouvre pas une boîte — on tourne une page."
No exclamation marks, no superlatives, no "excellence" or "passion", no urgency. The reader is addressed as someone literate and unhurried. English or Arabic builds keep the same temperature.

## Visual signatures
- THE BOXED DROP CAP (owned tic): the first paragraph of a chapter opens with an oversized display-serif initial (3.6–4.6rem, weight 500) inside a hairline box (1px, ink at 35%; padding 0.18em 0.28em; no radius), floated left with 0.9rem gutter; inside the box, bottom-right, a tiny folio number in the accent ("p. 04", 0.62rem, small caps, +0.08em tracking). Two per page minimum, one per chapter maximum.
- THE ITALIC ACCENT WORD (owned tic): exactly ONE word per display headline set in the display face's TRUE italic and colored fig-plum; every other glyph of the headline stays roman ink. The chosen word is the sentence's hinge, never the first word.
- DOUBLE-FILET RULES (owned tic): paired horizontal rules — 3px thick + 1px thin with a 3px air gap — thick-over-thin ABOVE a label, thin-over-thick BELOW it. They frame every section label, the sommaire block and the carte header. Horizontal only, never a four-sided frame; boxes on this page are single 1px hairlines.
- Folio furniture: chapter heads read "Chapitre 01 · p. 04" in small caps; the sommaire pairs each entry with its folio behind dot leaders; the drop-cap box repeats the folio. Numerals are arabic (01, 04, 12) — never roman section markers.
- Engraved plates: SVG line art, stroke espresso 1.4–2px, hatching at 1px, fill none or flat cream; ONE plum spot per plate (a fig, a glaze cap, a door). Every plate carries a caption line: "Planche 2 — Le Mille-Feuille 1987" in italic 0.85rem, and role="img" with a real aria-label.
- Hairlines, two registers: QUIET 1px rules in ink at 12–18% (table rows, sommaire entries, teaser strips, label anchors) and STRUCTURAL 1px rules in ink at 30–38% (figure tops, the drop-cap box, offer boxes, form field rules). Dot leaders: 1px dotted ink at 45%, baseline-aligned, between any name and its price or folio.
- Small caps everywhere labels live: uppercase serif at 0.7–0.8rem, +0.14 to +0.2em tracking, weight 600 — always anchored to furniture (between filets, on a hairline, in a box), never floating on bare ground.

## Color physics
- GROUND A: the #F7F1E6/#F3ECDD cream register. GROUND B: the #EFE6D2/#EAE0C8 register, 6–12 RGB points deeper. Sections may alternate grounds SOFTLY, as paper stock changes — two or three B-bands per page, never a strict A/B/A metronome and never exactly-one-inverted-dark-interlude (that is MATIÈRE's law). There is NO dark section in VÉLIN.
- INK: warm espresso, the #2B2118/#31261B register — never pure black. Body text may sit at ink 92%.
- ACCENT: fig-plum, the #7A3B52/#6E3B4F/#8A4260 register — ONE value per site. Budget: the italic accent word, folio numbers, links and their ink-in underlines, the CTA fill, one spot per engraved plate, ::selection. It never grounds a section; its only large appearance is the sommaire's giant folio numeral at 8–14% opacity.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · ACCENT→--primary · GROUND A→--primary-foreground · GROUND B→--secondary · INK→--accent · ink at 45%→--muted · ink at 16%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- FORBIDDEN: gold, brass, terracotta, and any metallic coding (other worlds' territory); pure #000 and #FFF; grey.
- Gradients DO NOT EXIST here — a revue is printed in flat inks. No box-shadows, no blurs, no grain overlays. Depth is made with hairlines, ground shifts and scale only.

## Typography system
- DISPLAY: Fraunces (opsz 9–144) or Newsreader (opsz 6–72) — one per site, weights 400–600, TRUE ITALICS MANDATORY in the loaded axis. Display sizes: masthead clamp(3.2rem, 9vw, 7.5rem), line-height 0.95–1.05, letter-spacing −0.01 to −0.02em; chapter headlines clamp(2.1rem, 4.6vw, 4rem); exergue clamp(1.9rem, 4.2vw, 3.4rem) at line-height 1.12–1.2.
- BODY: Source Serif 4 or Lora, 400/600, 1rem–1.1rem, line-height 1.65–1.75, measure 58–66ch, ragged right (justified single columns allowed for carte notes ≤3 lines; NEVER multi-column justified broadsheet text).
- SMALL CAPS: the body face uppercase at 0.7–0.8rem, +0.14 to +0.2em tracking, weight 600 — labels, nav, buttons, table heads, form labels.
- Italic law: one word per headline (the tic); captions and attributions may be italic if ≤1 line; body prose is never italic, links are never italic.
- HARD RULES: never a sans-serif, never a monospace, never Inter/Roboto/system-ui even in form controls (style inputs with the body serif explicitly). Numerals use the default proportional figures — no tabular telemetry.
- Arabic pairing: display Amiri (its true italic does not exist — the accent-word tic becomes a roman plum word), body Noto Naskh Arabic; the serif-only law holds (naskh, never a geometric kufi-sans); tracking rules drop (no letter-spacing on Arabic script), small caps become size + plum.

## Signature art / components (the engraved edition)
- PLATES: each subject is drawn as a copperplate-style SVG — outline in espresso 1.6–2px, form shading as 4–8 short parallel hatch lines at 1px, ground contact as a single flat ellipse or line, one plum accent element per plate. Elevation view or a gentle three-quarter; never isometric, never 3D-shaded, never filled-color illustration. Subjects per business: dishes on stands, a storefront elevation, a teapot, a room, a jewel, a bouquet. 3–6 plates per page, each DIFFERENT, all in the identical stroke language.
- ORNAMENTS: one small fleuron (a drawn leaf flourish, 40–60px) may close a chapter or the colophon — the cul-de-lampe. No other decorative shapes exist.
- BUTTONS: typographic objects — small caps inside a 1px ink hairline box (padding 0.85em 1.6em; corners min(var(--radius), 0px) — a printed page stays square); hover/focus fills fig-plum with cream text over 0.3s ease; no radius, no shadow, ever.
- LINKS: ink text with a plum underline that inks in left-to-right on hover/focus-visible (background-size 0→100%, 0.35s ease); visited stays ink.
- FORMS (la correspondance): fields as hairline BOTTOM RULES only (1px ink at 35%; focus swaps to 2px plum), labels in small caps above, phone-first (type=tel, inputmode=tel, autocomplete=tel, placed first or immediately after the name), a select for the structured choice (occasion, chambre, service), one textarea ("votre lettre"). Submit button per the button law. SUCCESS STATE is honest print: the form is replaced by a short letter-back — "Bien reçue. On vous rappelle sous 24 h ouvrées, du mardi au samedi." — with a fleuron, inside the same hairline furniture, announced via aria-live=polite. On valid submit dispatch on document the CustomEvent "wandit:lead" with the visitor's fields FLAT in detail ({ nom, telephone, occasion, message }). Include ONE off-canvas decoy input with attribute data-wandit-hp (position:absolute; left:-9999px; tabindex=-1; aria-hidden=true) that the page's own script never reads and never blocks on.
- ::selection is plum ground with cream text; :focus-visible is a 2px plum outline offset 3px. Favicon: inline SVG data URI — a plum fleuron or initial on the cream ground.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 8rem); chapter heads get an extra clamp(1.5rem, 4vh, 3rem) above. Container: max 1240px, padding-inline clamp(1.25rem, 4vw, 3rem); prose columns cap at 66ch; the carte caps at 720px.
- HEADER: a slim in-flow bar — wordmark left, 3–4 small-caps anchor links + phone right, a 1px hairline below. Never sticky-blurred, never shadowed. ≤640px the nav drops to its own full-width row (one line, 0.6–0.65rem caps, +0.1em tracking, space-between) under wordmark + phone — never a three-line wrap.
- FIXED OPENING — LA COUVERTURE: the page opens as the issue's cover. An issue line in small caps between double filets ("Cahier d'automne — Paris", never a newspaper dateline/edition-number row), the masthead (the client's name) at clamp(3.2rem, 9vw, 7.5rem), then the cover composition: statement with its one italic plum word + sub-paragraph + one CTA on one side, the cover plate engraving on the other; at the fold, a teaser strip of 3–4 sommaire entries with folios. The one h1 is the masthead.
- FIXED CLOSING: la correspondance (intro column + the letter form), then LE COLOPHON: double filet, 2–3 small-caps columns (adresse, horaires, contact), and a centered closing line in italic ("Cahier composé en Fraunces & Source Serif, achevé d'imprimer à Paris, octobre 2026.") under a fleuron. No giant footer wordmark.
- FREE MIDDLE — compose 2–4 chapters from the gestes vocabulary (la double page, les planches, la carte, l'exergue, la marge), never two adjacent sections with the same layout skeleton, each chapter opening with its double-filet label "Chapitre NN · p. FF".

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
THE GOVERNING LAW: hidden states are set ONLY by gsap.set in JS, never in CSS — script dead, the page is a complete printed issue. Gate everything on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion).
- Personality: UNHURRIED EDITORIAL MASK-REVEALS. Headlines and statements rise from behind an overflow-hidden line-mask (yPercent 115→0), power2.out, 0.9–1.2s; body blocks fade-rise 24–28px over 1.0s; groups stagger 90–140ms. Filets set the table first: scaleX 0→1 from the left, 0.8–1.0s, power2.out, just before their label rises.
- THE SHOWPIECE (one per page): LE SOMMAIRE FILÉ — the table of contents pinned for +=220–280%, scrub 0.5–0.7: entries sit at 40–45% opacity and ink; each beat brings one entry to full ink with its folio turning plum and a 12–16px x-shift, while a giant folio numeral (clamp(11rem, 24vw, 20rem), plum at 8–14% opacity — the crossfade tweens INTO that ghosted value, never to full strength) crossfades behind/beside the list (y ±70px, opacity handoff). VARIANT — LA TOURNE: the hero spread wipes upward behind a clip-path page-mask to reveal the first chapter, one slow scrubbed turn. Mobile ≤767px: never pin; the same content reveals with the standard masks.
- Hovers: 0.3–0.35s ease — link underlines ink in, buttons fill plum, table rows warm to Ground B. Keyboard parity via :focus-visible always; touch gets the resting state, nothing hidden behind hover.
- FORBIDDEN MOTION: bounce/elastic/back easing, parallax drift, letter-by-letter typing, strokeDashoffset self-drawing lines, rotation, scale-from-zero. Reduced motion: everything visible at rest, the sommaire un-pinned with its first numeral printed — a composed still, not a blank.

## Ban list (world-specific, beyond the global list)
- Arch geometry, arch pills, drawn room miniatures with glowing openings, plaster grain overlays, the material-swatch cabinet — that is MATIÈRE's language.
- The footnote system (superscript numerals + footnotes above a short rule), Oxford thin-thick-thin engraved double-rule FRAMES, wax-seal crest medallions, oxblood inks — that is PUPITRE's language. VÉLIN's filets are paired thin+thick horizontal rules only.
- Justified broadsheet multi-column text with column rules, halftone-dot image treatment, masthead dateline/edition-number/weather furniture and "suite p. 4" jump lines — that is GAZETTE's language. VÉLIN's folios live in the sommaire and chapter heads only.
- Floating letter-spaced micro-caps on bare ground, the centered plumb line, tiny centered roman-numeral section markers (I · II · III) — that is ÉCRIN's language. VÉLIN's labels are always anchored to filets or hairlines, and its numerals are arabic.
- Watercolor wash grounds, pigment-bloom image masks, brush-stroke underpainting — that is AQUARELLE's language (available only through the curated fusion).
- Gold hairline engravings that draw themselves on scroll, filigree corners, gilded page edges — that is ORFÈVRE's language; VÉLIN's plates are espresso on cream and never self-draw.
- Photography of any kind; raster images; illustration with filled color beyond the one plum spot.
- Sans-serif or monospace glyphs anywhere, including form controls and numerals.
- Gradients, box-shadows, backdrop blurs, dark sections, pure black or pure white.
- More than one italic word in a headline; italic body paragraphs.
- Roman-numeral chapter markers; countdowns; icon rows; emoji.
- Border-radius anywhere (a printed page has no rounded corners) except the fleuron's drawn curves.

## LES GESTES (moves menu)
1. LA COUVERTURE — the canonical cover: issue line between filets, huge masthead, statement + cover plate split 55/45, sommaire teaser at the fold. The default opening; vary the split side and the teaser count.
2. LA COUVERTURE NUE — typographic cover: no plate; the masthead and a 3-line statement at clamp(2.6rem, 6vw, 5rem) carry the viewport alone, with only filets and the issue line as furniture. For clients whose name IS the image.
3. LE SOMMAIRE FILÉ — the pinned table-of-contents scrub (spec in Motion identity). The default showpiece; entries may be chapters, rooms, protocols, hours of a day.
4. LA TOURNE — the page-turn showpiece: one slow scrubbed clip-path wipe where the cover gives way to chapter one. Use INSTEAD of the sommaire filé, never both.
5. LA DOUBLE PAGE — an asymmetric chapter spread: a narrow margin column (dates, small-caps notes, a folio) against a wide prose column opened by the boxed drop cap. The chronicle move.
6. LES PLANCHES — the engraved plate gallery: 3–5 plates in an offset grid (alternate items pushed down 2–4rem), each with hairline top, caption and dot-leader price. The catalogue move.
7. LA CARTE — the tariff table: a ≤720px column under a double-filet header, rows of name……price with dot leaders, an honest hours line at the foot, small margin engravings flanking on desktop. The menu/pricing move.
8. L'EXERGUE — a full-width pull quote at clamp(1.9rem, 4.2vw, 3.4rem) with its one italic plum word and a small-caps attribution on a hairline. The breathing move between chapters.
9. LA MARGE — side notes in 0.78rem small caps hung in the outer margin, aligned to their paragraphs by hairlines — never superscripts, never footnotes at the bottom.
10. LE FEUILLETON — a sticky running head: the chapter's "Chapitre 02 · p. 12" pinned in the margin while its content scrolls past, swapping at each chapter boundary.
11. LA CORRESPONDANCE — the fixed closing form played as a letter (spec in Signature art): intro column, hairline-rule fields, the letter-back success.
12. LE CUL-DE-LAMPE — a chapter's last paragraph set narrower and centered, closed by the fleuron — the typographic end-piece. Once or twice per page at most.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- "CAHIER D'AUTOMNE" — pâtisserie fine. Cover: masthead over a 55/45 statement + entremets plate split, teaser strip at the fold. Showpiece: le sommaire filé over five chapters (signatures, maison, salon, commandes, correspondance). Middle: les planches for the collection, la carte for the salon. Mood: warm, exact, buttery calm; masks at 1.0s, staggered plates.
- "LA REVUE DES CHAMBRES" — boutique hotel. Cover: la double page as the opening itself — masthead left column, a full-height facade engraving right. Showpiece: la tourne, the facade turning into chambre one. Chapters ordered by floor, le feuilleton running head tracking "Étage 1 · p. 08". Mood: hushed corridor; slower masks (1.2s), almost no stagger.
- "LE NUMÉRO DES NOCES" — wedding services. Cover: la couverture nue — the couple's-name masthead and a three-line vow-like statement, filets only. Showpiece: le sommaire filé reading as the day's hours (15 h — la cérémonie… folios as times). Middle: l'exergue between every chapter, plates of table settings. Mood: white-glove tenderness; longest holds, 140ms staggers.
- "L'OBJET" — jewelry brand. Cover: off-axis — masthead small and high-left, one large jewel engraving low-right, vast cream between. Showpiece: la tourne as a vitrine page-turn, each turn one piece with its carte line. La marge carries stone and carat notes. Mood: precise, nearly silent; micro x-shifts, 0.9s masks.
- "LA PEAU" — aesthetic clinic / skincare. Cover: statement-first on Ground B band, masthead beneath it, no plate above the fold. Showpiece: le sommaire filé of protocols with folio prices (04 — Le soin signature … 120 €). Middle: la double page for the method chronicle, la carte for tariffs. Mood: clinical warmth; filets lead every reveal.
- "LE FEUILLETON" — writer / journalist. Cover: masthead then the text simply BEGINS — boxed drop cap in the first viewport, the page as chapter one of a serialized issue. Showpiece: la tourne between three text chapters. La carte becomes "parutions" (publications with dot-leader years). Mood: ink and patience; body-first scale, rare plum.
- "LA TABLE D'HÔTE" — fine dining. Cover: the carte IS the cover — a double-filet menu block centered under the masthead, prices showing above the fold. Showpiece: le sommaire filé of services (déjeuner, goûter, dîner as chapters). Plates engrave the dishes; le cul-de-lampe closes each service. Mood: candle-quiet authority; table rows warming on hover as the only play.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
VÉLIN lives or dies on THREE things at 100%: the SERIF-ONLY DISCIPLINE (one sans label or system-font input and the spell is broken — audit every control), the BOOK FURNITURE working honestly (real folios that match the sommaire, chapters that announce themselves, a colophon that closes the issue — furniture is the world's plot), and the ENGRAVED PLATES (weak or missing line art turns this into a beige text template; the plates are the photography budget spent in strokes). The cheap details that separate it from a generated page: the tiny folio inside the drop-cap box, the thick-thin/thin-thick order of the filets, dot leaders that actually align on the baseline, the one italic word chosen well, the letter-back success state, the fleuron before the colophon. When in doubt, remove a block and let the cream breathe — emptiness is this world's luxury.`,
	energy: "quiet",
	family: "creamy-editorial",
	fusesWith: ["aquarelle", "herbier"],
	id: "velin",
	industries: [
		"patisserie / bakery",
		"fine dining",
		"tea house",
		"restaurant (classic)",
		"hotel",
		"guesthouse / riad",
		"wedding services",
		"event planner",
		"interior design / home staging",
		"aesthetic clinic",
		"skincare / esthetician",
		"cosmetics brand",
		"jewelry brand",
		"makeup artist",
		"writer / journalist",
		"grocery / gourmet",
		"single property showcase",
	],
	kind: "website",
	mood: ["editorial", "warm", "literary", "hushed", "refined"],
	name: "Vélin",
	preview: {
		accent: "#7A3B52",
		fontFamily: "Fraunces",
		ground: "#F7F1E6",
		ink: "#2B2118",
		sampleWord: "La Revue",
	},
	priceFeel: "premium",
	tagline: "La revue crème : chaque page composée comme un beau numéro.",
};
