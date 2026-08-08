import type { DesignWorld } from "../types";

/**
 * GAZETTE — the ink-and-paper broadsheet.
 * Family: newsprint. The client's news told like news: masthead with dateline
 * and edition number, justified columns with 1px rules, halftone-dot plates,
 * jump lines, a clip-out coupon for the contact form. Proven against the
 * Le Kiosque demo (café, Lyon); every value in the doc was shipped there.
 * fusesWith rationale — carnet: the notebook meets the paper (artisan food
 * brands annotate their own gazette); affiche: the paper prints a poster
 * (announcements and events get a full-page placard inside the edition).
 */
export const gazette: DesignWorld = {
	avoidFor: [
		"aesthetic clinic",
		"jewelry brand",
		"SaaS product",
		"spa / hammam",
		"dentist",
	],
	doc: `# DESIGN WORLD: GAZETTE — the ink-and-paper broadsheet

## Philosophy
This page is TODAY'S EDITION OF A SMALL NEWSPAPER, not a website — a broadsheet set in hot metal, printed in one black ink plus one brick spot color on cheap cream newsprint. The client's business is REPORTED, never marketed: the new product is a front-page story with a dateline, the menu is the classified ads, the team is the newsroom, the history is the archive of past front pages, the contact form is a clip-out coupon in the courrier des lecteurs. First structural fact: NEWSPAPER FURNITURE IS REAL AND DENSE — a masthead carrying a dateline, an edition number and a weather line; rubric slugs; bylines; jump lines that cite actual pages ("suite p. 4"); an ours (the printer's block) closing the paper. The furniture is navigation the reader can trust, never pastiche sprinkled on a landing page. Second structural fact: body text lives in JUSTIFIED MULTI-COLUMN BLOCKS WITH VISIBLE 1px COLUMN RULES — the broadsheet column is the default paragraph, not an effect. Third structural fact: imagery is B/W HALFTONE-DOT PLATES drawn in SVG — ink outlines filled with a three-density dot screen, captioned and credited like press photos; no photography, no color illustration, ever. Fourth: the tempo is NEWSY — brisk press-roll entrances, stamps, columns rising in strict sequence; VÉLIN is the literary revue, GAZETTE is the daily that went to press at 5 a.m. Structurally impossible failure modes: a gradient hero; rounded cards floating on shadows; a photography hero with overlay; a page that whispers. Self-audit before shipping (count them): the masthead carries at least THREE pieces of furniture (dateline, edition number, weather or price line); every article lede opens with a bold caps dateline slug and ZERO drop caps exist page-wide; at least TWO justified multi-column blocks show real 1px column rules; every plate is halftone dots plus ink line with a caption and a credit; border-radius is 0 and box-shadow is 0 everywhere; brick never fills an area larger than a button.

## The variation contract (why two GAZETTE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- The newsprint double ground, near-black ink and rationed brick, all inside the registers below. No other hues, no gradients, no shadows, radius 0 page-wide.
- Masthead furniture (dateline, edition number, weather line, rubric nav, jump lines, dateline slugs) present and honest.
- Justified multi-column body text with 1px column rules as the default long-form setting.
- Halftone-dot drawn plates as the ONLY imagery; plates are strictly black-and-white.
- Press-roll motion: sequential column rises, rule wipes, stamps; the halftone develop reserved for the showpiece.
- At most ONE ink-ground stop-press band per page; rules are single-weight, never thin+thick pairs.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- Exact hexes inside the registers (a warmer or greyer newsprint, a deeper brick — see Color physics).
- THE MASTHEAD FACE: Playfair Display roman (the sober daily) OR UnifrakturMaguntia blackletter (the old-house weekly) — one per site, the paper's whole personality flips with it. Blackletter lives at masthead scale ONLY.
- THE EDITION CONCEPT that names the paper — l'édition du matin, le quotidien du fournil, la feuille du barbier, l'hebdo du marché. It names the rubrics, dates the dateline, numbers the edition and tunes every headline.
- Which plates are drawn, the rubric names and order beyond the fixed opening (la une) and closing (courrier + l'ours), the showpiece variant (l'édition du jour OR la rotative), which 2–3 gestes are played, the day's weather line.
A GAZETTE page without its edition concept is a failure: name the paper, date it and NUMBER it first ("Édition n° 142 — quatrième année"), then let the edition choose its rubrics, stories and plates.

## The vibe (voice)
Newsroom French — factual, brisk, dated. Headlines are declarative present tense in caps; ledes answer who-what-when in two sentences; numbers, dates and prices appear constantly and precisely; zero luxury adjectives, zero exclamation marks outside the ONE allowed stop-press band. The business's smallest events are treated as news with a straight face — that deadpan is the charm. Register lines:
- "LE KIVU ARRIVE AU COMPTOIR — débarqué mardi par le fret de Marseille, torréfié jeudi, servi vendredi. Détails p. 2."
- "Édition n° 142, quatrième année. Le café est à 2 euros. Il n'augmentera pas cette saison."
- "DERNIÈRE HEURE — Le pain perdu revient samedi, dès 9 h. Les habitués sont prévenus."
English or Arabic builds keep the same wire-service temperature.

## Visual signatures
- MASTHEAD FURNITURE (owned tic): the page opens as a front page. A 1px hairline, then la ligne de tête — three caps slots in the caption face (0.72–0.78rem, +0.08em): city + full date left; "N° 142 — Quatrième année" center; a weather line + honest price right ("Grand soleil sur la Presqu'île, 31° · Le café : 2 €"). Under it the masthead wordmark at clamp(3.2rem, 9.5vw, 7.6rem), weight 900, line-height 0.95, then a HEAVY BAR (4px solid ink) and a rubric nav row — caps links separated by 1px hairlines, each citing its page ("LA CARTE — p. 3"). Jump lines in brick caps ("SUITE P. 4 →", 0.72rem) close feature blocks; every article lede opens with a bold caps DATELINE SLUG run-in ("LYON, 2e arr. —"). Weather line, edition number and jump pages are real and consistent page-wide.
- BROADSHEET COLUMNS (owned tic): long-form text is set in CSS columns — column-width 17–19rem, gap clamp(1.6rem, 3vw, 2.6rem), column-rule 1px solid ink at 22–28% — justified, hyphens on, lang attribute set so hyphenation works. Multi-column text is ALWAYS justified and ALWAYS ruled; single columns may be ragged. Never center-align a paragraph.
- HALFTONE PLATES (owned tic): every image is a drawn SVG plate — ink outlines 1.5–2.5px filled from a bank of three dot-screen densities (6px cell; dot radii 0.9 / 1.5 / 2.05; screen angle 15°, dots always ink, never brick). Portraits sit on a dense-dot block like a press photo. Each plate carries a hairline-topped caption in the caption face with a deadpan credit ("Photo : la rédaction") and role="img" with a real aria-label. Plates are strictly B/W — the color budget lives in type, never in images.
- RULES, ONE WEIGHT AT A TIME: heavy 3–4px solid ink bars open sections and the footer; quiet 1px hairlines at 20–30% do everything else (column rules, item separators, caption tops). NEVER pair a thin rule with a thick one — the double filet is VÉLIN's.
- RUBRIC SLUGS: a 9–10px brick square + caps label in the caption face (700, 0.7–0.78rem, +0.12em) marks every brief, rubric and category. Exactly ONE brick kicker may sit above the lead headline per viewport.
- LA DERNIÈRE HEURE: at most one full-width ink-ground band (paper text, a brick tag reading DERNIÈRE HEURE, one factual line, one stamp entrance). It is the page's only inversion — never repeated, never a section.
- THE COUPON: the contact form is a clip-out coupon — 2px dashed ink border at 55%, a small drawn scissors glyph riding the top edge, coupon number in the corner ("BON N° 142").

## Color physics
- GROUND A: the #F6F1E5 / #F3EEE0 newsprint register. GROUND B: the #F1EBDC / #EDE5D2 register, 5–10 RGB points deeper — used as the stock change for classifieds, archive cards, the coupon interior and the footer; alternation follows content (a denser page of the paper), never a strict metronome.
- INK: near-black warm ink, the #191510 / #211B14 register — never pure #000. Body text may sit at ink 90–100%; hairlines are ink at 20–30%.
- BRICK: the #A63325 / #993122 / #B03A28 register — ONE value per site. Budget: rubric slugs, ONE headline kicker per viewport, jump lines, the dernière-heure tag, the CTA fill, link hover, ::selection, focus rings. Brick never grounds a section, never fills an area larger than a button, never appears inside a plate.
- THE INK BAND: ground flips to ink for the single dernière-heure strip only; text there is Ground A, the tag is brick.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · BRICK→--primary · GROUND A→--primary-foreground · GROUND B→--secondary · the ink band→--accent · ink at 55%→--muted · ink at 25%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Gradients DO NOT EXIST — a press prints flat. No box-shadows, no blurs, no grain overlays, no photography. Depth is hairlines, ground shifts, density and scale.

## Typography system
- MASTHEAD / DISPLAY: Playfair Display 700–900 (default) or UnifrakturMaguntia (client-owned option, masthead ONLY — never headlines, never body). Masthead clamp(3.2rem, 9.5vw, 7.6rem); headlines clamp(1.9rem, 4.6vw, 3.6rem), weight 800–900, line-height 1.02–1.1, letter-spacing 0 to −0.01em. Mid heads clamp(1.35rem, 2.6vw, 2rem).
- BODY: PT Serif 400/700, 0.98–1.05rem, line-height 1.55–1.65; justified with hyphens inside columns, ragged in single-column intros. Decks (the line under a headline) are PT Serif italic 1.05–1.25rem — a full italic line is legal here; the single italic ACCENT word is VÉLIN's and forbidden.
- CAPTIONS / FURNITURE: Archivo Narrow 400–700 — captions 0.78–0.85rem; labels, slugs, bylines, nav and buttons in caps 0.7–0.8rem, +0.08 to +0.14em. Archivo Narrow NEVER sets a prose paragraph.
- HARD RULES: no drop caps of any kind (the boxed drop cap is VÉLIN's; GAZETTE opens articles with the caps dateline slug instead); blackletter never below masthead scale; PT Serif is never letter-spaced in caps (labels are Archivo's job); numerals are lining, prices bold PT Serif with a non-breaking space before €.
- Arabic pairing: masthead + headlines Amiri 700, body Noto Naskh Arabic 400/700, furniture and captions Noto Kufi Arabic; letter-spacing rules drop (no tracking on Arabic script); the blackletter option is void; columns stay justified and ruled; dateline slugs keep their em dash, mirrored for RTL.

## Signature art / components (the press plates)
- PLATE CONSTRUCTION: outline the subject in ink 1.5–2.5px strokes → fill volumes from the three-density dot bank (light for paper-adjacent tones, mid for greys, dense for shadows and backgrounds) → leave the ground as paper → portraits get a dense-dot rectangle behind the bust, press-photo style. Flat elevation or a plain three-quarter view; never isometric, never 3D shading, never filled color. Subjects per business: the storefront, the machine, the cup or loaf or chair, a portrait of the maker, the delivery bicycle.
- CAPTIONS: every plate ends with a 1px hairline then "Le comptoir, mardi matin. Photo : la rédaction" in the caption face. Credit lines are deadpan and consistent.
- BUTTONS: caps in the caption face (700, +0.1em) inside a 2px solid ink border, corners min(var(--radius), 0px) — the press cuts square, padding 0.8em 1.6em; hover/focus fills ink with paper text over 0.25s; the ONE primary CTA per page fills brick with paper text and darkens on hover. No pills, no shadows.
- LINKS: ink text underlined 1px; hover/focus turns text and underline brick over 0.2s. Visited stays ink.
- FORMS — LE COURRIER DES LECTEURS: the coupon (dashed border spec above) on Ground B. Labels caps above the field; fields 1px solid ink at 35%, radius 0, paper ground, focus swaps to a 2px brick border; phone-first (type=tel, inputmode=tel, autocomplete=tel, immediately after the name); one select for the structured choice (objet du courrier); one textarea ("votre courrier"). Submit per the CTA law ("ENVOYER AU JOURNAL"). SUCCESS STATE is honest print: the coupon is replaced by a stamped note — "REÇU AU MARBRE — Votre courrier est à la rédaction. On vous rappelle avant la prochaine édition, du mardi au dimanche." — same dashed furniture, announced via aria-live=polite. On valid submit dispatch on document the CustomEvent "wandit:lead" with the visitor's fields FLAT in detail ({ nom, telephone, objet, message }). Include ONE off-canvas decoy input with attribute data-wandit-hp (position:absolute; left:-9999px; tabindex=-1; aria-hidden=true) that the page's own script never reads and never blocks on.
- ::selection is brick ground with paper text; :focus-visible is a 2px brick outline offset 2px. Favicon: inline SVG data URI — a brick square with a paper halftone dot trio, or the masthead initial in ink on newsprint.

## Page chassis
- Vertical rhythm: section padding clamp(4rem, 9vh, 7rem); the front page (hero) may run tighter. Container: max 1360px (a broadsheet is wide), padding-inline clamp(1.1rem, 4vw, 3rem); justified prose columns cap via column-width, never a full-width single justified column.
- FIXED OPENING — LA UNE: hairline, ligne de tête, masthead (the one h1), heavy bar, rubric nav, then the front-page grid: a brick kicker + lead headline + italic deck + justified 2–3 column lede with a dateline slug and a jump line on one side; the lead plate with caption plus a boxed "au comptoir aujourd'hui" service box (1px border, Ground B) on the other. The fold shows real news density, not a slogan.
- FIXED CLOSING: le courrier des lecteurs (intro column + the coupon form), then L'OURS — the footer as printer's block: 4px ink bar, 3 caps columns (adresse, horaires, contact), a one-paragraph ours naming real roles ("directrice de la publication", "torréfactrice en chef"), and a final hairline with the edition line ("Composé en Playfair & PT Serif — imprimé sur place, Presqu'île de Lyon"). Never a giant footer wordmark.
- FREE MIDDLE — compose 3–5 from the gestes vocabulary (le grand format, en bref, les petites annonces, la dernière heure, les unes précédentes, la rédaction) with the showpiece placed second or third; no two adjacent sections may share a layout skeleton, and a wide multi-column block must neighbor a narrow or gridded one.

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
THE GOVERNING LAW: hidden states are set ONLY by gsap.set in JS, never in CSS — script dead, the page is a complete printed edition. Gate everything on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion).
- Personality: THE PRESS ROLL. Blocks rise y 32–44px with autoAlpha, power2.out (power3.out for the masthead), 0.55–0.9s; groups stagger 110–160ms in STRICT READING ORDER — left column first, then the next, never random, never from-center. Rules set the table: heavy bars and hairlines wipe scaleX 0→1 from the left (0.5–0.7s, power2.out) just before their content rises. STAMPS: kickers, jump lines, the dernière-heure tag and the coupon scissors arrive scale 1.06→1 + autoAlpha over 0.4–0.45s — brisk, not bouncy.
- THE SHOWPIECE (one per page): L'ÉDITION DU JOUR — a framed mini front page (max 880px) composes itself, pinned for +=240–300%, scrub 0.6. At rest the sheet is not blank: its dateline row is pre-printed and a diagonal PROOF STAMP sits centered ("ÉPREUVE — N° 143": caption-face caps, +0.22em, rotated −12°, brick at 12–16% opacity inside a 3px border of the same tint). Then, on scrub: the mini masthead stamps in (scale 1.12→1), the heavy bar wipes, the kicker stamps, the headline rolls up, the mini columns rise IN SEQUENCE, the halftone plate DEVELOPS — its dot radii tween 0→final (attr r on the pattern circles) like a photo appearing in the bath — a brick "SUITE P. 4" stamp rotates in (−20°→−8°), and the proof stamp fades out last: the épreuve becomes the printed page. VARIANT — LA ROTATIVE: one full-width plate develops its dots across the scrub while the day's headline settles over it; use INSTEAD of l'édition du jour, never both. The halftone develop is RESERVED for the showpiece. Mobile ≤767px: never pin; the same timeline plays once on enter at 1.3–1.4× speed.
- Hovers: 0.2–0.3s — links ink→brick, buttons fill, classified rows warm to Ground B, archive cards lift their headline to brick. Keyboard parity via :focus-visible always; touch gets the resting state.
- FORBIDDEN MOTION: bounce/elastic/back easing, random or from-center staggers, letter-by-letter typing, marquee/ticker loops, parallax drift, rotation beyond the stamp's ±18°, scale-from-zero. Reduced motion: everything printed at rest, dots at full radius, the showpiece un-pinned at its most composed frame — the proof stamp stays printed over it, a deliberate épreuve, never a blank.

## Ban list (world-specific, beyond the global list)
- Boxed drop caps with folio numbers — and ANY drop cap — plus the single italic accent-colored headline word and thin+thick double-filet rules: that is VÉLIN's revue language. GAZETTE opens with dateline slugs and rules one weight at a time.
- Literary tempo and book furniture: 1.2s mask reveals, sommaires, chapters, folios, colophons with fleurons — VÉLIN again. GAZETTE's furniture is dateline, edition, jump line, ours.
- Toner grain, photocopy noise, torn-paper edges, misregistered two-color ghost layers, tape strips and ransom-note letters — that is FANZINE's language. GAZETTE's print is CLEAN; its dots are an ordered screen, never grunge.
- Footnote systems (superscript numerals + footnotes above a rule), Oxford thin-thick-thin engraved frames, wax-seal crest medallions — that is PUPITRE's language.
- Default-web furniture: Times/system fonts, blue underlined links, visible-border layout tables, visitor counters, "last updated" lines — that is HYPERTEXTE's language. GAZETTE is typeset, not un-designed.
- Words-as-layout at 15–25vw and alternating black/white section inversion flips — that is MANIFESTE's language; hence the single dernière-heure band and never a second ink section.
- Rotated crossing marquee strips and any infinite ticker loop — that is CINÉTIQUE's language; the stop-press band stands still.
- Photography, raster images, colored or filled illustration; a plate with brick dots.
- Gradients, box-shadows, backdrop blur, border-radius above 0, rounded pills.
- A second accent hue; brick grounds; brick areas larger than a button.
- Blackletter anywhere below the masthead; Archivo Narrow as a prose face.
- Center-aligned paragraphs; multi-column text that is unjustified or unruled.

## LES GESTES (moves menu)
1. LA UNE CLASSIQUE — the canonical front page: kicker + lead headline + deck + ruled justified lede + jump line against the lead plate and a service box. Vary the split side and the column count; the fold must show a real story.
2. LA UNE CINQ COLONNES — the typographic front page: no plate above the fold; one headline stretched across the full container over a 4-column ruled lede. For clients whose news IS the image.
3. L'ÉDITION DU JOUR — the pinned mini-front-page scrub (spec in Motion identity). The default showpiece; its story is tomorrow's edition composing under the reader's eyes.
4. LA ROTATIVE — the develop showpiece: one full-width plate whose halftone dots grow from 0 across the scrub while the headline settles. Use instead of l'édition du jour.
5. LE GRAND FORMAT — the inside feature: brick slug, big head, italic deck, 2–3 justified ruled columns with an inset plate breaking one column edge, closed by a jump line.
6. EN BREF — the briefs rail: a narrow column of 3–5 hairline-separated brief items, each with a brick slug and a dated one-liner, set against a wide neighbor. The density move.
7. LES PETITES ANNONCES — the menu/pricing move: offers set as classified ads in 3 ruled columns — caps lead-in, one factual sentence, bold price — grouped under slugged categories on Ground B.
8. LA DERNIÈRE HEURE — the single ink stop-press band: brick tag, one urgent factual line, one stamp entrance. Once per page or not at all.
9. LES UNES PRÉCÉDENTES — the archive strip: 3–5 mini front-page cards (mini masthead, date, N°, one headline) telling the history as editions, its intro paired with a bordered CHIFFRES box (3 Playfair numerals over caps labels: éditions parues, lots torréfiés) so the row never sits half-empty.
10. LA RÉDACTION — the newsroom: 2–4 halftone portrait cards with caps bylines and an italic one-line chronique each; offset the middle card on desktop.
11. LE COURRIER DES LECTEURS — the fixed closing coupon form (spec in Signature art): dashed border, scissors, stamped success; the intro column may close with LA LETTRE DE LA SEMAINE, a bordered Ground-B box quoting one reader's letter with a deadpan provenance line.
12. LA MÉTÉO DU COMPTOIR — the repurposed weather line: the masthead's weather slot reports the client's day ("Aujourd'hui : Kivu lot 07, notes d'abricot — 31° en terrasse"). Cheap, memorable, always honest.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
No two variations share a une composition or a showpiece staging.
- "L'ÉDITION DU MATIN" — café, Lyon. The only LA UNE CLASSIQUE: lede left, kiosk plate + service box right. Then en bref against le grand format, L'ÉDITION DU JOUR canonical (masthead stamps, bar wipes, columns rise left to right, plate develops, proof stamp fades last), dernière heure, petites annonces as the carte, archives, rédaction, coupon. Press rolls 0.75s, 130ms staggers. Mood: morning-paper brisk.
- "LE QUOTIDIEN DU FOURNIL" — patisserie / bakery. LA UNE CINQ COLONNES: "LE LEVAIN A DOUZE ANS" across five ruled columns, no plate above the fold. Petites annonces early with bread prices; mid-page LA ROTATIVE DU FOURNIL — the loaf plate develops shadow-first (dense, then mids, then lights), the headline settling once the crust darkens; archives as fournées. Quickest register, 0.55s rises, heavier stamps. Mood: flour-dust urgency.
- "LA FEUILLE DU BARBIER" — barber. Blackletter masthead over LA UNE AU PORTRAIT: the portrait plate fills the fold's left half, headline and one RAGGED intro column stacked right — no ruled lede. Showpiece L'ÉDITION DES TARIFS: the pinned mini une composes a plateless tarif page — mini masthead first, classified rows stamping in one by one, bold prices last, proof stamp "ÉPREUVE — TARIFS". Dernière heure announces "SAMEDI SANS RENDEZ-VOUS"; stamps land a beat late. Mood: old-house weekly, dry wit.
- "LE COURRIER DE LA PLUME" — writer / journalist. LA UNE CHRONIQUE: a text-only fold, no kicker, no plate — a full-width italic deck, then ONE wide justified ruled column that IS the week's chronique, against a narrow en-bref rail. Showpiece LA ROTATIVE AU PORTRAIT: the paper's single plate develops lights-first while the bibliography rises beside it entry by entry. Petites annonces as parutions, years for prices. Brick nearly absent. Mood: wire-service sober; slowest register, 0.9s.
- "LA GAZETTE DU MARCHÉ" — grocery / gourmet. LA UNE MOSAÏQUE: no lead story — four slugged briefs gridded around a central market-stall plate, météo du comptoir per arrivage. Petites annonces as the week's arrivals in FOUR ruled columns; archives as seasons. Showpiece L'ÉDITION À L'ENVERS: Saturday's mini une composes in inverted order — plate develops FIRST, columns rise around it, masthead stamps LAST. Mood: crowded, cheerful density; densest staggers.
- "L'HEBDO DE LA TRADUCTION" — translation office. LA UNE MIROIR: masthead centered, the SAME lede set twice, French left, English right, mirrored around one center hairline; rubric nav in both tongues. Showpiece L'ÉDITION BILINGUE: the mini une composes column by column, each French column followed by its English twin, the kicker stamping once per tongue. Mood: precise, near-silent brick; columns rise in strict pairs.
- "LE SOIR SPÉCIALE FOURS" — pizzeria. LA UNE DERNIÈRE-HEURE: the ink stop-press band sits directly UNDER the masthead announcing tonight's pizza; the oven plate runs full-width beneath, headline over its top edge. Showpiece LA ROTATIVE AU FEU: the wood-fire plate develops left to right like the web through the press, jump-line stamps punching in along the way. Petites annonces as the pizzas; archives as the ovens' history. Mood: hot-metal evening rush; stamps everywhere the budget allows.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
GAZETTE lives or dies on THREE things at 100%: the MASTHEAD FURNITURE (a dateline, edition number, weather line, rubric pages and jump lines that are real, dense and mutually consistent — one fake or missing piece and the paper becomes a theme), the RULED JUSTIFIED COLUMNS (multi-column text with true 1px rules and working hyphenation is the body of the broadsheet; unjustified or unruled columns collapse the world into a generic layout), and the HALFTONE PLATES (drawn dot-screen art is the photography budget spent in SVG — a GAZETTE with weak or missing plates is a text template). The cheap details that separate it from a generated page: the weather line repurposed for the client's day, jump lines that cite pages which exist in the rubric nav, dateline slugs opening every lede, the coupon's dashed edge and scissors, the edition number advancing per issue, the deadpan photo credits, prices in bold lining figures. When in doubt, add one more line of furniture — this world's truth is in its small print.`,
	energy: "medium",
	family: "newsprint",
	fusesWith: ["carnet", "affiche"],
	id: "gazette",
	industries: [
		"café / coffee shop",
		"restaurant (classic)",
		"street food / food truck",
		"tea house",
		"patisserie / bakery",
		"barber",
		"writer / journalist",
		"marketing services",
		"translation office",
		"grocery / gourmet",
		"multi-product shop",
		"pizzeria",
	],
	kind: "website",
	mood: ["newsy", "inky", "honest", "artisanal"],
	name: "Gazette",
	preview: {
		accent: "#A63325",
		fontFamily: "Playfair Display",
		ground: "#F6F1E5",
		ink: "#191510",
		sampleWord: "Édition N°1",
	},
	priceFeel: "accessible",
	tagline: "Le journal du client : ses nouvelles composées comme une une.",
};
