import type { DesignWorld } from "../types";

/**
 * PUPITRE — the lecture hall set in type.
 * Family: academia. Ivory paper, oxblood pigment, Oxford rules, a real
 * footnote apparatus and a drawn crest. Trust through erudition.
 * fusesWith rationale — diwan: the Andalusi library (heritage scholarship
 * — Oxford rules meet the illuminated opener on shared ivory);
 * gazette: the institute publishes its journal (the syllabus gains a
 * press room — footnotes feed the broadsheet).
 */
export const pupitre: DesignWorld = {
	avoidFor: [
		"streetwear / drops",
		"fast food",
		"car wash & detailing",
		"festival",
		"nails & lashes studio",
	],
	doc: `# DESIGN WORLD: PUPITRE — the lecture hall set in type

## Philosophy
This page is a BEAUTIFULLY SET SYLLABUS, not a website. It is the prospectus of a serious house — a lecture hall rendered as print: ivory paper, dark warm ink, one oxblood pigment used the way a bookbinder uses it, and rules engraved with the discipline of an Oxford university press. Its first structural fact: the OXFORD RULE — a thin-thick-thin triple line (1px / 3px / 1px with 3px gaps, 11px total) — is the ONLY heavy graphic device on the page; everything else is 1px hairline or nothing. Its second structural fact: the FOOTNOTE SYSTEM is the trust engine — claims carry superscript numerals and RESOLVE to real footnotes at the bottom of their section, above a short 96px rule; a PUPITRE page never asserts, it attests. Its third structural fact: ONE drawn crest medallion — the institution's seal — engraved in SVG strokes, never photographed, never gradient-filled, never spinning. The page prints in FLAT INKS: zero gradients, zero shadows, zero photography, zero blur. Impossible failure modes: the gradient-wash hero, the icon-card feature row, marketing hyperbole ("excellence", "passion" unfootnoted), and equally the dusty pastiche — this is a contemporary institution that sets type beautifully, not a themed antique. Self-audit before shipping: (1) at least 6 real footnotes on the page, every superscript resolving to one; (2) every heavy rule is thin-thick-thin — count them, no thick singles, no thin+thick pairs; (3) exactly ONE crest medallion drawn in strokes; (4) zero italic above 1.4rem; (5) slate blue appears ONLY on text links plus ONE rule on the whole page; (6) zero raster images, zero gradients, zero box-shadows.

## The variation contract (why two PUPITRE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- The Oxford thin-thick-thin rule as the only heavy device; 1px hairlines at 22–28% ink for everything else.
- The footnote apparatus: oxblood superscripts in running text, footnote blocks above a short rule at section bottoms, honest content in every note.
- One engraved SVG crest medallion with a circular small-caps inscription; static, stroke-drawn, on the page at least twice (hero or header, and colophon).
- Ivory paper ground register, warm near-black ink, oxblood as the single pigment, slate blue rationed to links + one rule.
- Scholarly serif register; emphasis is SMALL CAPS, never an italic display word, never color-highlighted body text.
- Chapter architecture: sections open as chapters with SPELLED-OUT ordinals ("Chapitre premier", "Chapitre deuxième") tied to a short Oxford rule.
- Page-settle motion: gentle vertical settles and long fades; nothing bounces, nothing snaps, nothing parallaxes.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- Exact hexes inside the registers (ivory #F5EFE2 vs #F0E9D8 lead; oxblood #5E1922 vs #6A1F29; ink #241C10 vs #2B2114).
- The display face within the register: EB Garamond, Libre Caslon Text, or Crimson Pro — one per site.
- The DRIVING DOCUMENT the page impersonates — le prospectus, le registre, la leçon inaugurale, l'ordre du jour, le grand livre — it names the hero, the showpiece scene and the copy voice.
- The crest's charges (book, lamp, quill, balance, laurel, columns…), the chapter names and middle-section order, the showpiece's subject, the footnote content.
A PUPITRE page that has not chosen its driving document is a failure: name it FIRST; it decides whether the hero is a title page, a frontispiece or an opening lecture.

## The vibe (voice)
French of the amphithéâtre: measured declaratives, exact numbers, and the humility to footnote its own claims. Institutional small caps for proper names; no exclamation marks, no superlatives, no urgency theater. The register: "L'exigence est une forme de respect.¹" · "Nous publions nos résultats chaque année — notes de bas de page comprises." · "Les effectifs sont limités à douze élèves par salle ; les registres ferment quand ils sont pleins." Honesty is the luxury: a footnote that admits a source is disputed, a statistic that names its denominator, a policy stated as fact. Where marketing would shout, PUPITRE cites.

## Visual signatures
- THE OXFORD RULE (owned tic): thin-thick-thin — 1px, 3px gap, 3px, 3px gap, 1px, 11px total, drawn in ink or oxblood via stacked linear-gradient backgrounds or three SVG lines. It frames the page under the header (full-bleed), sits as a 120px stub between a chapter ordinal and its title, crowns plates and tables, and closes the colophon. NEVER a thick single line, NEVER a thin+thick pair.
- THE FOOTNOTE SYSTEM (owned tic): superscripts set in the display face at 0.62em, oxblood, 600 weight, raised; each section's notes collect at its bottom in 0.9rem body serif with hanging numerals, above a 96px × 1px short ink rule. Notes contain REAL information: founding decrees, methodology, disputed attributions, opening hours. Diagram callouts use lowercase letters (a., b., c.) to stay distinct from page numerals.
- THE CREST MEDALLION (owned tic): a 160–300px SVG seal — thin-thick-thin concentric rings, a circular small-caps inscription on a text path (top arc and bottom arc), engraved charges inside (1.5–2px ink strokes; at most one small oxblood fill such as a flame). It is the institution's mark, present in the hero or header AND the colophon. It never rotates, never gets a photo texture.
- CHAPTER OPENERS: small-caps ordinal SPELLED OUT ("Chapitre troisième", 0.85rem, +0.18em tracking, oxblood) → 120px Oxford rule → display title clamp(2rem,4vw,3.1rem). A PUPITRE label is never naked on the ground: it is always tied to a rule above or below it.
- TINTED PLATES: cards are "plates" of the second ivory (#F0E9D8 register) with an Oxford top rule and a folio number top-right in the caption face (0.65rem, "Fiche n° 03") — no radius, no shadow, no border box.
- TYPESET MARGINALIA: a sticky margin column of side notes — "Nota" in small caps over 0.95rem serif — commenting the main text like a scholarly edition. Always typeset, never handwritten.
- OLDSTYLE NUMERALS everywhere numbers matter (font-feature-settings "onum"): prices, statistics, hours. Statistics earn display scale — clamp(4.5rem,10vw,8rem) — with their methodology footnoted.
- Slate-blue text links (#35507A), underlined, text-underline-offset 3px, thickness 1px growing to 2px on hover/focus.

## Color physics
- PAPER: the #F5EFE2 / #F0E9D8 ivory register. One leads as the page ground; the other exists ONLY as plate tint and table-row alternation — never a strict A/B section alternation (that rhythm belongs to another world).
- INK: warm near-black, never pure black — the #241C10 / #2B2114 register. Hairlines are ink at 22–28% alpha.
- OXBLOOD: the #5E1922 / #6A1F29 register — deep bookbinder's oxblood, kept well below any plum or wine (#7A3B52 territory is VÉLIN's) — the single pigment. Budget: footnote superscripts, chapter ordinals, the Oxford rules that matter (chapter stubs, header rule may stay ink), filled CTAs, the crest's one flame/gem, diagram waypoint seals. Never as a text highlight, never washing a whole section EXCEPT the one epigraph interlude.
- THE ONE INVERSION: at most ONE deep-oxblood band per page (the épigraphe) — ivory text on #5E1922, its own footnote set in ivory at 75% alpha, framed above and below by full-bleed Oxford rules in ivory. No other dark sections exist.
- SLATE BLUE #35507A: text links, plus EXACTLY ONE rule on the page — the "rule of attestation" under the page's most important statistic. That is its entire life; slate never fills, never tints, never buttons.
- GRADIENTS DO NOT EXIST in this world; neither do box-shadows or blurs. The page must survive flat-ink printing unchanged.

FIXED TOKEN MAP — PAPER→--background · INK→--foreground · OXBLOOD→--primary · PAPER→--primary-foreground · second ivory→--secondary · SLATE BLUE→--accent · softened ink→--muted · ink at 25%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, tint or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: EB Garamond / Libre Caslon Text / Crimson Pro — ONE per site, weights 500–600, never 700+. Hero statement clamp(2.6rem,6vw,4.9rem), line-height 1.08–1.14, tracking −0.005em. Chapter titles clamp(2rem,4vw,3.1rem), line-height 1.1.
- BODY: Crimson Pro or EB Garamond 400–500, 1.02–1.1rem, line-height 1.58–1.68, measure 58–70ch, never center-aligned beyond two lines.
- CAPTIONS (rare): IBM Plex Sans 400/500 for folio numbers, table headers, form labels and diagram letters only — 0.65–0.78rem, +0.08–0.14em tracking. IBM Plex Sans NEVER sets prose or headlines.
- SMALL CAPS are the emphasis system: real font-variant small-caps or uppercase at 0.72–0.9rem with +0.14–0.2em tracking, for ordinals, proper-noun labels, attributions, button text.
- ITALIC LAW: italics exist ONLY for citations, titles of works and Latin locutions at body size and below. NEVER in display sizes, never as a colored accent word inside a headline (that is VELIN's move).
- Numerals prefer oldstyle ("onum"); prices set the amount in the display face with the currency in small caps ("4 500 DA/mois" register).
- Arabic pairing (if the site serves Arabic pages): Amiri for display and body, Noto Naskh Arabic as fallback; the footnote apparatus mirrors RTL with superscripts before punctuation; keep European digits for prices; small-caps emphasis becomes +letter-spaced Naskh, never fake caps.

## Signature art / components
- IMAGERY IS ENGRAVED LINE ART: everything drawn is SVG stroke work in ink on ivory — 1.5–2px strokes, no fills except the rationed oxblood touch, flat elevation, no shading, no crosshatch heavier than 3 lines. Subjects: the crest's charges, a lamp of learning, an open book, a laurel sprig, a column capital, diagram spines. This is INK ON IVORY that sits still — gold strokes on black that draw themselves belong to ORFÈVRE. Drawn scenes carry role="img" and a real French aria-label.
- THE CREST (exact spec): concentric rings 1px / 3px / 1px; inscription on two text-path arcs (top: institution name; bottom: city · founding year in Roman numerals), EB Garamond 12–14px, +2–3px letter-spacing; inner ring 1px; charges centered (open book + lamp is the default lockup); optional laurel sprigs flanking. One oxblood fill maximum (the flame).
- BUTTONS: rectangular — corners consume min(var(--radius), 0px), zero radius always, the cut of set type. Primary: oxblood fill, ivory small-caps text, a 1px ivory inner rule inset 3px (box-shadow inset); hover/focus deepens to the darker oxblood. Ghost: transparent with 1px ink rules top and bottom only, small caps. Never pills, never shadows.
- FORMS: fields are WRITING LINES — no boxes: a small-caps IBM Plex label above, the input bare on a 1px ink bottom rule, :focus thickening to 2px oxblood. Phone-first: the tel input with inputmode="tel" sits immediately after the name. Selects styled the same with a drawn caret. On valid submit dispatch the "wandit:lead" CustomEvent on document with the visitor's fields FLAT in detail ({ name, phone, level, message }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads or writes. SUCCESS STATE is a registry entry: "Consigné au registre." over an Oxford rule, a dossier number (year-NNN), and the named person who will call, with real next steps — never a green toast.
- TABLES (le barème): an Oxford rule crowns the table; header row in IBM Plex small caps separated by a 1px full-ink line; body rows separated by hairlines; row alternation may tint with the second ivory; numerals oldstyle, right-aligned. This is finely SET DATA, not visible-border default-web layout tables.
- PLATES: see Visual signatures — Oxford top rule, folio number, tinted ground, no border box.

## Page chassis
- HEADER: wordmark in the display face (with the 26px mini-crest), nav links in slate small caps, telephone right; below it the full-bleed Oxford rule that opens the document. No sticky blur bars, no shadow on scroll.
- FIXED OPENING (the hero law): the page opens as its driving document's TITLE PAGE — a small-caps oxblood label with rule ("Prospectus — année 2026–2027" register), a display statement of 5–9 words carrying at least one live superscript, a supporting paragraph with real facts, primary CTA + slate text link, the crest present in the composition, AND the hero's own footnote block resolving in the first viewport. The reader must meet the apparatus before scrolling.
- FIXED CLOSING: the inscription form (as specified) beside a "secrétariat" column of real coordinates and house rules, then the COLOPHON footer: small crest, the wordmark at clamp(2.2rem,5vw,3.6rem), the address line, a full Oxford rule, and an "Achevé de composer à <ville>, <mois> <année>" line with the © in Roman numerals.
- FREE MIDDLE (compose 3–5, never two adjacent alike): le programme réglé (numbered syllabus list with hairline rows + sticky marginalia) · le cursus gravé (the pinned diagram showpiece) · l'épigraphe (the one oxblood inversion, cited and footnoted) · les fiches (offset grid of plates with framed initials) · l'attestation (display-scale statistics with methodology footnotes + the slate rule) · le barème (the finely set table with its bourse footnote).
- Vertical rhythm: section padding clamp(4.5rem,10vh,7.5rem) top and bottom; container max 1180px with clamp(1.25rem,4vw,3rem) side padding; text columns cap at 62–70ch.

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
PAGE-SETTLE: elements settle onto the paper like sheets laid down — gentle y (14–22px) and LONG fades. Gate every animation on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches); all hidden states set by gsap.set, NEVER in CSS — the dead-CDN page is complete and fully readable.
- Easings: power2.out for settles, power1.inOut for rule draws; durations 0.9–1.4s; staggers 90–140ms. NOTHING bounces, overshoots, scales up or parallaxes.
- Rules DRAW: scaleX 0→1 from the left (Oxford stubs 0.8–1.1s); the trunk of a diagram draws scaleY from the top.
- FOOTNOTES SETTLE LAST: each section's footnote block waits +0.25s after the section's main settle — the apparatus signs the page.
- THE SHOWPIECE (one per page, scrubbed): a PINNED ENGRAVING — an SVG/rule diagram that draws itself in strict reading order under scrub 0.5–0.7 across +=1800–2600px: spine first, then each branch → waypoint seal → label settle → lettered callout, in sequence. GHOST-TRACE LAW: the whole diagram pre-exists as a faint trace (rules and seals duplicated at 18% opacity, text set by JS to autoAlpha 0.10–0.13) and the scrub INKS it — the pinned viewport is never empty, and with JS dead the full-ink diagram covers its own trace. The cursus tree is the canonical scene; siblings may engrave a procedure line, a concordance, an ordre du jour. Mobile (<900px): never pinned — the same diagram reveals stage by stage on view, trace skeleton showing ahead.
- HOVERS: link underlines thicken 1px→2px (0.2s), buttons deepen fill (0.25s), plates lift NOTHING — no translate, no shadow. Keyboard and touch get identical states.
- REDUCED MOTION: everything composed and legible, the diagram fully engraved, zero movement.

## Ban list (the global ban list applies; in addition)
- The boxed drop cap with folio, the italic accent word in a headline, and thin+thick double-filet pairs — that is VELIN's language; PUPITRE rules are triple thin-thick-thin and its emphasis is small caps.
- Arabesque ornament frames, eight-point star glyphs, illuminated medallion-and-gilded-rule openers — DIWAN's language.
- Masthead furniture (datelines, edition numbers, jump lines), halftone-dot imagery, justified broadsheet columns — GAZETTE's language.
- Default-web furniture: Times/system fonts, default blue underlines, visible-border tables AS LAYOUT, visitor counters — HYPERTEXTE's language; PUPITRE's slate links and set tables are designed, not default.
- The centered drawing plumb line, bare Roman-numeral section markers (I · II · III), and floating micro-caps labels on bare ground — ÉCRIN's language; PUPITRE spells out its ordinals and ties every label to a rule.
- Gold hairline engravings on black that draw themselves — ORFÈVRE's; PUPITRE engraves ink on ivory and self-drawing lives only in the one showpiece.
- Handwritten annotations or arrows over type — CARNET's; marginalia here are typeset.
- Rotating circular text badges — BAUPLAN's; the crest inscription never spins.
- Arch-topped frames and drawn room miniatures — MATIÈRE's.
- Gradients, box-shadows, border-radius anywhere · photography or photoreal render · icon fonts · dark sections beyond the one épigraphe · thick single rules and thin+thick pairs · italic display type · unfootnoted statistics · countdowns or seat-counters (state capacity as policy, in prose, footnoted).

## LES GESTES (moves menu)
1. LA PAGE DE TITRE — hero as the document's title page: label + rule, the 5–9-word statement with a live superscript, crest right or above, footnote block resolving in-viewport. The canonical opening.
2. LE FRONTISPICE — hero variant: the crest large and centered between two full Oxford rules, statement beneath, credentials line in small caps. For houses whose seal IS the argument (notaires, cabinets).
3. LA LEÇON INAUGURALE — a hero or section as a 62ch single-column reading text with 3–4 superscripts and a rich footnote block; the page opens by TEACHING. Quietest possible opening.
4. LE PROGRAMME RÉGLÉ — the syllabus list: numbered hairline rows (number · matter in display serif · detail · hours · price in oldstyle), 6–8 rows, with a sticky marginalia column commenting.
5. LE CURSUS GRAVÉ — the pinned showpiece: over its faint ghost trace, a spine inks, branches alternate sides, waypoint seals stamp, labels settle, lettered callouts (a., b., c.) resolve in reading order.
6. L'ÉPIGRAPHE — the one oxblood inversion: a cited quotation at clamp(1.6rem,3.4vw,2.6rem), small-caps attribution, and the footnote that tells the truth about the source.
7. L'ATTESTATION — statistics at display scale (clamp(4.5rem,10vw,8rem), oldstyle), the slate rule of attestation under the leading figure, every number's methodology footnoted.
8. LES FICHES — an offset two-column grid of plates (second column pushed down 3–4rem): framed initials in a thin-thick-thin square, name, discipline small caps, credential with superscript.
9. LE BARÈME — the tuition/fee table set to the table law, with its honest footnote (what is included, the bourse policy, the deadline).
10. LE REGISTRE — the closing form as a registry entry: writing-line fields, the dossier-number success state, the named caller, the house rule beside it.
11. LA MARGINALIA — any long text gains a sticky margin note column ("Nota" small caps + serif note + superscript) like a critical edition.
12. LE COLOPHON — the footer as a printer's colophon: crest, monument wordmark, address, Oxford rule, "Achevé de composer" line, © in Roman numerals.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. INSTITUT AVERROÈS (prépa bac, Alger) — driving document: le prospectus. Hero: page de titre split 7/5, statement left with superscript, crest right. Middle: programme réglé with marginalia → cursus gravé (four-trimester tree) → épigraphe (a disputed Averroès attribution, footnoted honestly) → fiches → attestation → barème. Motion: settles + the tree scrub. Mood: rigorous, warm, proud without noise.
2. ÉTUDE BENKHALED, NOTAIRE (Oran) — driving document: l'acte. Hero: frontispice — the crest centered between two full Oxford rules, "Un acte est une phrase qui engage.¹" beneath. Showpiece: la procédure — a HORIZONTAL engraved line crossing a pinned viewport, five acts stamping left to right with article-number callouts citing the code. Middle order: leçon inaugurale on the notary's role → attestation (actes passés, années) → barème d'émoluments → registre. Motion: near-still, the line draws once. Mood: granite dignity.
3. BUREAU DE TRADUCTION AL-KALIMA (Tunis, FR/AR) — driving document: la concordance. Hero: a bilingual title page, French left, Amiri Arabic right, mirrored around a central Oxford rule. Showpiece: two parallel text columns whose connecting hairlines draw between matched lines on scrub, waypoint seals at certified passages. Fiches become language plates (paire de langues, délai, tarif au feuillet). Mood: precise, diplomatic.
4. CONSERVATOIRE RUE DIDOUCHE (école de musique, Alger) — driving document: la partition. Hero: the season's programme — statement right-aligned above three hairline rows announcing the year's auditions publiques (date, salle, œuvre), mini-crest above the label, no side column. Showpiece: le cycle — a pinned five-line staff on which course waypoints appear measure by measure, callouts naming examens de passage. Barème per instrument; épigraphe from Ziryab, sourced. Mood: disciplined lyricism.
5. CABINET LATTAFI, EXPERTISE COMPTABLE (Constantine) — driving document: le grand livre. Hero: a ledger spread — the statement "Un bilan est une phrase vraie.¹" full-width, then two facing columns (ce que nous tenons / ce que nous rendons) separated by a center hairline, the mini-crest sitting at the fold. Showpiece: le bilan gravé — an engraved column diagram whose rules rise to audited heights, each column footnoted with its source line. Middle: programme réglé of missions → attestation → registre. Motion: the slowest register, 1.2–1.4s fades. Mood: austere trust.
6. LES RENCONTRES D'ALGER (conference) — driving document: l'ordre du jour. Hero: the programme cover — a left-aligned stack of date, venue and statement with the crest small top-left like a cover imprint, and the day-one schedule set as the hero's own footnote block running full-width beneath. Showpiece: l'ordre du jour gravé — a pinned table of hours whose ROWS ink one by one (hour rule draws, session title settles, speaker + affiliation callout resolves), never a single timeline line. Fiches for keynotes; barème for registration tiers. Mood: assembly of minds.
7. CABINET DE PSYCHOLOGIE MME SELMANE (Alger) — driving document: le protocole. Hero: leçon inaugurale — a single 62ch reading column in the gentlest register ("On ne guérit pas d'être humain ; on apprend à l'être mieux.¹"), no crest in the hero (it waits in the colophon). Showpiece: le protocole — four numbered paragraphs, spineless and sealless: each stage's 96px rule draws, then its paragraph inks from ghost trace to full, one breath at a time with long pauses. No attestation geste — numbers whisper here; the épigraphe carries the page instead. Mood: confidential calm.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: the FOOTNOTE SYSTEM must be real — numbered, resolving, carrying honest information (one decorative or dead footnote and the page becomes a costume); the RULE DISCIPLINE — every heavy rule triple, every other line a 1px hairline, because the Oxford rule only reads as law if nothing contradicts it; and SCALE COURAGE — quiet is not timid: the hero statement and the attestation numerals must be set at full display scale, or the page collapses into a Word document. The cheap details that separate PUPITRE from a generated page: oldstyle numerals, oxblood superscripts, folio numbers on plates, spelled-out chapter ordinals, the disputed-source footnote, the dossier number in the form's success state, and the "Achevé de composer" line in the colophon. When in doubt, add a footnote — precision is this world's voltage.`,
	energy: "quiet",
	family: "academia",
	fusesWith: ["diwan", "gazette"],
	id: "pupitre",
	industries: [
		"university prep / tutoring",
		"private school",
		"language center",
		"training institute / formation",
		"music school",
		"lawyer / law firm",
		"notary",
		"translation office",
		"accountant",
		"financial advisor",
		"psychology / therapy",
		"writer / journalist",
		"online courses / e-learning",
		"conference / summit",
	],
	kind: "website",
	mood: ["scholarly", "dignified", "measured", "engraved"],
	name: "Pupitre",
	preview: {
		accent: "#5E1922",
		fontFamily: "EB Garamond",
		ground: "#F5EFE2",
		ink: "#241C10",
		sampleWord: "Chapitre I",
	},
	priceFeel: "premium",
	tagline: "Filets d'Oxford, notes de bas de page, sceau gravé : l'érudition.",
};
