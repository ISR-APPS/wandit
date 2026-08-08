import type { DesignWorld } from "../types";

/**
 * CAPITALE — the navy boardroom authority.
 * Popular wave: the strategy-consulting / asset-management site (McKinsey, KKR,
 * Lazard register) done at the level a merchant assumed cost 10 000 EUR.
 * White paper ground, deep navy ink, serif gravitas, giant pull-figures,
 * navy-duotone photography plates, a numbered index spine down the left edge.
 * fusesWith rationale: cabinet (the law-office sibling — same institutional
 * gravity, different furniture), pupitre (the academic/notarial register that
 * shares the hairline discipline), grille (the Swiss grid that sharpens
 * capitale's ledgers without lending its red circle).
 *
 * DEMO ASSET ROSTER (worlds/capitale/demo/assets/) — three navy-duotone plates,
 * all placed: lobby.jpg (hero, 4:5, bleeding right), reunion.jpg (dossier, 3:4),
 * tour.jpg (le siège, 16:10 planche on a label rail, between the governance
 * ledger and the contact section). skyline.jpg — the fourth file listed in the
 * batch-8 spec — was never delivered to the assets folder: the exclusion is
 * recorded here and in an HTML comment at the top of demo/index.html, the page
 * is composed on three plates, and no typographic substitute plate was needed.
 */
export const capitale: DesignWorld = {
	id: "capitale",
	name: "Capitale",
	family: "corporate-authority",
	tagline:
		"L'autorité en papier blanc et bleu nuit : chiffres graves, photographie duotone.",
	kind: "website",
	mood: ["institutional", "sober", "authoritative", "numerate"],
	energy: "medium",
	priceFeel: "premium",
	industries: [
		"business consultant",
		"financial advisor",
		"accountant",
		"insurance agency",
		"lawyer / law firm",
		"notary",
		"recruitment / HR",
		"commercial real estate",
	],
	avoidFor: [
		"street food / food truck",
		"kids & baby shop",
		"kindergarten / crèche",
		"gelato / desserts",
		"DJ / entertainment",
		"festival",
		"tattoo & piercing",
	],
	fusesWith: ["cabinet", "pupitre", "grille"],
	preview: {
		ground: "#F8F8F6",
		ink: "#101C33",
		accent: "#17335F",
		fontFamily: "Newsreader",
		sampleWord: "Capitale",
	},
	doc: `# DESIGN WORLD: CAPITALE — the navy boardroom authority

## Philosophy
This page is an ANNUAL REPORT that learned to scroll — the printed dossier a firm hands across a boardroom table, not a website about a firm. Three structural facts define it. FIRST: the page runs on a NUMBERED SPINE — not "sections" but five movements, 01 to 05, with the spine as visible furniture down the left edge, filling as the reader advances. SECOND: every claim resolves into a FIGURE. Capitale does not say "une expérience solide", it sets 4,2 Mds DA in serif at 100–140px on a hairline base rule and lets the number carry the sentence; a section with no number in it has not finished being written. THIRD: photography exists only as NAVY-DUOTONE PLATES — square-cornered blocks graded into one navy ink, placed BESIDE type and never behind it. White paper, deep navy, one copper hairline of warmth, nothing else.

Impossible failure modes: the gradient-wash "AI startup" hero (no gradients exist here); the rounded-card feature grid (radius is 0 page-wide); dark-luxury gold; SaaS bright blue (banned by name). Self-audit, all countable: (1) exactly one h1; (2) at least two pull-figures at 100px or larger, each on its own base rule; (3) the spine reaches 05, every entry has filled by the footer, and all five numerals stay legible on every ground the rail crosses — paper and deep band alike; (4) copper appears at most twice outside functional states; (5) zero raw-colour photographs; (6) zero border-radius above 2px and zero box-shadows.

## The variation contract (why two CAPITALE sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- White paper ground + deep navy ink + one navy accent + copper rationed to two uses per page.
- Navy-duotone photography, square corners, plates beside type — never a photo behind a headline, never a dimming overlay.
- The numbered index spine (01 to 05) as persistent furniture, filling with scroll.
- Giant serif pull-figures on hairline base rules as the page's structural anchors.
- Hairline ledgers and full-bleed bands instead of cards; radius 0; no shadows.
- Boardroom cadence motion: 0.7s power3.out, y-24, sequenced counters, exactly one scrubbed showpiece. No overshoot easings anywhere.
CLIENT-OWNED — where siblings legitimately diverge:
- The exact hexes inside the register: ground #F8F8F6 / #FAFAF8 / #F4F5F2; ink #101C33 / #0E1A2E; navy #17335F / #1E3F73 / #122C52; copper #A65B2A / #9E5325.
- The display face WITHIN the register: Newsreader, Frank Ruhl Libre, Petrona, Source Serif 4 — one per site, never two.
- The DRIVING NOUN that organises the page: la durée, le mandat, la prudence, l'indépendance, la transmission. It names the hero claim, decides which figures anchor the page, sets the voice. A CAPITALE page without one becomes a stock consulting template — choose it before writing a line.
- Which figures are chosen (montant sous conseil, mandats clos, années, taux de reconduction), how many movements the middle holds, the photo subjects, and the section order beyond the fixed opening and closing.

## The vibe (voice)
Institutional French, "nous", short declaratives with verbs of engagement (conseiller, accompagner, structurer, arbitrer). Numbers are typeset the French way: comma decimal, thin space, unit after the space — "4,2 Mds DA", "94 %". No superlatives, no "leader", no exclamation marks, zero adjectives that cannot be audited. Honesty is the register's luxury: state limits out loud. Example lines:
- "Nous conseillons les décisions qui engagent dix ans."
- "Indépendants : nous ne distribuons aucun produit financier et ne percevons aucune rétrocession."
- "Premier entretien sans engagement, réponse sous 48 heures ouvrées."
Section labels are nouns, not slogans: LA MAISON, MÉTIERS, CHIFFRES, RÉFÉRENCES, CONTACT.

## Visual signatures (measured — these are the recognitions)
- NAVY-DUOTONE PLATES (owned tic). Every photograph is a two-ink block. Recipe, exactly: plate container background #0B1730 with isolation:isolate; the img gets filter: grayscale(1) contrast(1.14) brightness(1.08) and mix-blend-mode: screen; an ::after layer of #B7C9E4 with mix-blend-mode: multiply lands the highlights in pale steel; a ::before layer at z-index 3 carries box-shadow: inset 0 0 0 1px rgba(16,28,51,.16) so the frame hairline never blends. Exposure is normalised PER ASSET before the shared duotone — brightness 1.05–1.35 on the img only, so a dark interior and a bright facade land on the same two inks. Frames are 3:4 or 4:5 portrait, 16:10 for a band; on viewports ≥900px a band frame may drop its ratio and be held to a clamp(360px, 52vh, 520px) height so one plate never eats a whole screen. Corners are square; no mask, no rounding, no vignette. Never flat black-and-white, never halftone dots.
- GIANT SERIF PULL-FIGURE WITH HAIRLINE BASE RULE (owned tic). Display serif 300–400, tracking -0.025em, line-height 0.94, sitting 0.65rem above a 1px rule in rgba(255,255,255,.28) on navy (rgba(16,28,51,.18) on paper) that runs the FULL container width, not just the figure's column. Under the rule a foot row: 10.5px caps label at +0.14em on the left, a source/period micro-line on the right. Size register: clamp(4rem, 9vw, 8.75rem) when one figure owns the section; clamp(3.6rem, 7vw, 6.75rem) — 58px floor, 108px at 1440 — when three figures share one pinned frame. The ACTIVE figure (the one the scrub has just landed) upgrades its base rule to 2px copper — one of the page's two copper appearances.
- INDEX SPINE (owned tic). Fixed rail at left:32px, vertically centred, visible at viewports ≥1180px: five entries, each a 2-digit numeral (11px body 600, +0.1em) above a 1px vertical track 44px tall in rgba(16,28,51,.18); as its section's top crosses 45% of the viewport the track fills with navy over 0.5s power2.out and the numeral goes to full ink; the current numeral takes copper. THE RAIL INVERTS OVER A DEEP BAND — mandatory: while the spine's own bounding box overlaps a #101C33 band, unreached numerals go #9FB2CE, reached numerals #EFF2F7, the track rgba(255,255,255,.18), the fill a paler #9FB2CE; copper stays copper; all four cross in 0.25s linear. Skip it and the rail vanishes over the page's flagship section — #101C33 on #101C33 — leaving one copper numeral floating like debris. Below 1180px the spine collapses into a header counter ("03 / 05") plus a 2px navy progress hairline pinned under the header — the spine never disappears, it changes format. Derive the state from measured scroll position on every frame, never from the order of scroll-trigger callbacks: after a pinned section, callback order lies and the counter drifts one movement ahead. The small-screen progress hairline is written by that SAME handler — scaleX = scrollY / (scrollHeight − innerHeight), set directly — never by its own scrubbed tween, which outruns the counter after a pin and reads full-width while the counter still says 02 / 05.
- HAIRLINE LEDGER ROWS. Content that would be cards elsewhere is a full-width table here: rows separated by 1px rgba(16,28,51,.12) rules, grid 3.5rem numeral / 1fr title+prose / 15rem right meta column with tabular numerals right-aligned. Hover or focus tints the row to #F1F3F6 and slides the meta column 4px. Under 900px the meta column moves BELOW the prose and turns into a horizontal wrap of chips — it must never be left in the numeral column, where it shreds into one word per line.
- LABELS ON A DASH. Every small-caps label (11–12px, body 600, +0.14em, navy) is preceded by a 24px 1px navy dash, baseline-aligned. Labels never float alone on bare ground.
- DEEP BANDS. One or two full-bleed #101C33 panels per page — the figures showpiece is always one. Inside a band, ink flips to #EFF2F7, hairlines to rgba(255,255,255,.18), labels to #9FB2CE. Anything FIXED that floats over a band — the spine, a sticky counter — flips with it; audit every fixed element against the band before shipping.
- MEASURE. Prose is capped at 62ch, never centred, always on a hard left axis inside the 1240px container.
- RADIUS ZERO. Buttons, inputs, plates, bands, tags all use min(var(--radius), 0px) — square, this world's corners stay cut. The fastest recognition in the world, and absolute.

## Color physics
- GROUND: the #F8F8F6 / #FAFAF8 register — warm-neutral paper, never pure #FFFFFF (that reads as a template). A second quiet ground, pale steel #EDEFF3 / #F1F2F0, may carry one or two calm bands (the quote, the governance ledger).
- INK: #101C33 — a navy so deep it reads as black in body copy and as blue in mass. Secondary text is ink at 62%; rules at 12–18%; disabled/meta at 45%.
- NAVY ACCENT: #17335F / #1E3F73 for labels, filled buttons, spine fills, active rules. NEVER bright blue: #2F6BFF belongs to clair, #2B5BFF to bloc, and either one instantly turns this world into a SaaS landing page.
- COPPER #A65B2A: at most TWO appearances per page. Canonical uses: the base rule of the active pull-figure, and the current numeral of the index spine. A third use must replace one of the two — the success plate's reference line and every other label stay navy. Functional states (focus rings, form error text) are exempt from the budget.
- GRADIENTS: none. The only blend on the page is the duotone stack inside a plate. No glow, no blur, no shadow. Because every image is graded to the same two inks, a page may carry four photographs and still read as two colours — that is the point.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · NAVY ACCENT→--primary · GROUND→--primary-foreground · pale steel→--secondary · COPPER→--accent · ink at 62%→--muted · ink at 16%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY (register, one per site): Newsreader, Frank Ruhl Libre, Petrona, Source Serif 4. Weights 300–500 only — a bold serif headline is a newspaper, not a boardroom. Tracking -0.015em on large sizes.
- BODY (register): Figtree, Manrope, Be Vietnam Pro. 400/500/600, 17–19px, line-height 1.62. Inter, Roboto and Open Sans are never a display face here (global ban).
- SCALE: h1 clamp(2.6rem, 6.2vw, 5.4rem), line-height 1.04. Section titles clamp(1.9rem, 3.4vw, 3.1rem), line-height 1.1. Lead paragraph clamp(1.15rem, 1.7vw, 1.45rem). Pull-figures clamp(4rem, 9vw, 8.75rem). Display type never exceeds 10vw — fit-to-viewport headlines are AFFICHE's, words-as-structure are MANIFESTE's.
- LABELS: body 600, uppercase, 11–12px, +0.14em, navy, always on a dash.
- NUMERALS: pull-figures in the display serif; every table, price, date and meta column in the body face with font-variant-numeric: tabular-nums and right alignment. Never a mono face — machine voice belongs to CINÉTIQUE.
- ITALIC: never in display, never in labels. Body italic only for foreign terms or a legal citation.
- ARABIC PAIRING (if the client serves Arabic): prose in "Noto Naskh Arabic", labels and figures in "IBM Plex Sans Arabic" 600; mirror the layout with dir="rtl", spine to the right edge; never stretch the Latin serif over Arabic glyphs.

## Signature art & components
PHOTOGRAPHY (the imagery system — this world has NO illustration). One art-direction phrase governs every generation, reused verbatim: "corporate architectural photography, glass office towers, dusk blue tones, distant silhouettes, no close faces, no text". Subjects: towers at dusk, lobbies with distant walking silhouettes, meeting rooms shot wide with the city behind. People are always distant and anonymous — no portraits, no handshakes, no laptop close-ups. Assets are local (assets/*.jpg), never hotlinked, and every one carries the duotone grade above.
CAPTION LAW: the caption sits OUTSIDE the plate, below it, left-aligned — a 40px 1px navy rule, an 11px caps line (place and year), then one sentence-case context line at 14px ink-62%. Nothing is ever pinned onto a photo's bottom edge (DOMAINE's meta strip) and no plate carries text over it (SILHOUETTE's collision).
PLATE COUNT AND PLACEMENT: two plates is the floor, three or four the register — hero, dossier, and one 16:10 PLANCHE dropped into the longest photo-less run (usually the case-study-to-contact stretch, where the page otherwise becomes four consecutive hairline ledgers). Every generated asset is either placed or its exclusion is written into the page source: an unused file in assets/ is a defect, not a spare.
WHERE A PHOTO IS MISSING: use a NAVY TYPOGRAPHIC PLATE in the same frame — a solid #101C33 block carrying one pull-figure, one date or a single serif line, with the same caption ledger under it. Never an illustration, an icon or a stock vector: this world draws nothing.
BUTTONS: rectangles, radius 0, padding 0.95rem 1.7rem, 14px body 600 +0.06em. Primary = navy fill #17335F, paper text, hover fills to #101C33 and the label shifts 1px right. Ghost = 1px rgba(16,28,51,.28) border, hover border goes full ink. No icons inside buttons.
FORMS: baseline fields — a caps label above, then an input with NO box, only a 1px bottom rule in rgba(16,28,51,.25), 46px tall, 16px text; focus raises the rule to 2px navy and turns the label navy. Phone-first: type="tel" inputmode="tel" placed second, right after the name; a select carries structured choices (objet du mandat). One off-canvas decoy input carries data-wandit-hp, tabindex="-1", autocomplete="off", untouched by the page's script. On valid submit, dispatch the CustomEvent "wandit:lead" on document with the fields flat in detail (nom, societe, telephone, email, objet, message). SUCCESS is honest and in-world: the form is replaced in place by a 1px-bordered plate carrying "Demande enregistrée", a navy reference line (RÉF. K-2026-0148 register) and the real next step ("Un associé vous rappelle sous 48 heures ouvrées.").
TAGS: square 1px-bordered chips, 11px caps, navy on paper — sectors and mandate types, never decoration.
NO CARDS. Capitale has rows, plates, bands and rules. The floating rounded card with a soft shadow is CLAIR's, and one of them ruins the page.

## Page chassis
- HEADER: 64px (mobile) / 68px (desktop) slim bar, paper ground, 1px bottom hairline; serif wordmark left; nav of 4–5 movement names in 11.5px caps; right side holds the index counter ("02 / 05") and a bordered tel link. Sticky with a SOLID paper background — never a blurred glass bar.
- FIXED OPENING (hero law): a STATEMENT hero. The claim is a serif sentence of 6–14 words at clamp(2.6rem, 6.2vw, 5.4rem) on a hard left axis, with a labelled eyebrow above it and a 62ch subline below. It is accompanied by EITHER one duotone plate bleeding to a viewport edge OR a figures table — never a centred block, never type over a photo. The hero always closes with a hairline row of three mini-figures — clamp(1.45rem, 3.4vw, 2.5rem) serif, the unit set as a separate 0.46em navy span so it wraps cleanly on a 390px screen, a 9.5–10.5px caps label under each, vertical hairlines between them — that pre-announce the page's numbers.
- FIXED CLOSING: the contact ledger (coordinates as hairline rows on the left, baseline form on the right), then the MONUMENT FOOTER — the wordmark set at clamp(2.4rem, 7vw, 6rem) above a 1px navy rule, with the legal line in 12px caps under it.
- FREE MIDDLE (compose 4–6, never two adjacent alike): the DOCTRINE SPREAD (a 12rem left rail holding the caps label AND one small anchor figure — a founding year over a hairline — then two prose columns and a three-item principle ledger); the MATRICE (4–6 ledger rows); the FIGURES BAND (deep navy, the scrubbed showpiece, always present); the DOSSIER (plate beside three numbered beats with a result figure and a closing meta row); the PLANCHE (a 12rem label rail carrying the caps label and two sentences, beside a 16:10 duotone band with its caption ledger under it — the move that keeps a long paper run from going photo-less); the CITATION (pale steel band, one static quote); the CONSEIL (governance ledger with serif monogram squares); the VOLET (a short navy interlude carrying one sentence).
- RHYTHM: section padding clamp(4rem, 9vh, 7.5rem) top and bottom; container max 1240px with 24px (mobile) / 40px (desktop) gutters; deep bands go edge to edge; a 1px hairline or a ground change separates every movement from the next. The hero is the one section that drops its right gutter so its plate can bleed: padding-left: max(gutter, (100% − 1240px)/2), padding-right: 0.

## Motion identity — BOARDROOM CADENCE
Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Hidden states are set only by gsap.set — never in CSS. With JS dead the page is complete and readable.
- ENTRANCES: y:24 → 0 with opacity, 0.7s power3.out, fired at "top 90%" (groups at "top 88%" with a 0.08s stagger). Nothing scales, nothing rotates, nothing overshoots (overshoot easings are banned wave-wide).
- RULES: hairlines draw with scaleX 0 → 1 from the left, 0.6–0.9s power2.out, ~0.12s after their text.
- COUNTERS: figures ramp from 0 to their value with the tween's progress, re-formatted French-style on every update (comma decimal, thin space, unit appended); the ramp is sequenced, never simultaneous.
- THE ONE SCRUBBED SHOWPIECE: the FIGURES BAND. Pin the navy band for +=135% of viewport height, scrub:0.6, at ≥900px; below that the same timeline runs unpinned between "top 82%" and "bottom 70%". Beats sit every 0.62 timeline units so all three rows land by ~55% of the pin, then a 1.1-unit hold keeps the COMPOSED state on screen for the last third — a pinned frame that spends half its scroll half-empty reads as a bug, not as choreography. Each row: y-24 + fade (0.45s), counter ramp (0.8s), base rule scaleX (0.6s), foot + note fade (0.4s); the third rule tweens to 2px copper at +0.55. The spine fills in parallel. One scrub per page.
- HOVER: 180ms linear tints and 4px slides, with a keyboard equivalent (:focus-within on the row, same tint). Nothing is ever hidden behind a hover.
- REDUCED MOTION AND DEAD JS: no pin, no scrub, no tween. Counters print their final values, base rules are drawn (including the copper one — it is the CSS default state and the scrub merely animates INTO it), the spine reads filled, plates are in place. The still page must look composed, never blank.
- FORBIDDEN MOTION: parallax on photographs, Ken-Burns zooms, marquees, letter-by-letter reveals, odometer digit rolls (that is FORME's), specular sweeps (ALLURE's), any bounce.

## Ban list (in addition to the global ban list)
- PUPITRE's footnote system (superscript numerals + footnotes over a short rule), its thin-thick-thin Oxford frames, its wax-seal crest.
- GRILLE's exposed page-wide column rules, its oversized red circle, its extreme flush-left-with-vast-right-void axis.
- GAZETTE's justified broadsheet columns with rules, its halftone-dot imagery, its masthead furniture (dateline, edition number, jump lines).
- ECRIN's centred plumb line, its roman-numeral markers, its floating micro-caps on bare ground (capitale's labels always sit on a dash).
- CINÉTIQUE's telemetry voice (SYS.STATUS, FILE 001, coordinate captions), its difference-blend chrome, its marquees, its stroked ghost numerals.
- CABINET's dossier tabs, its clause furniture (Art. 1 — Art. 7) and its brass nameplate with screw heads.
- DOMAINE's property meta strip pinned to a photo's bottom edge and its serif price plate overlapping a photo corner.
- GÉNÉRIQUE's letterbox bars and Ken-Burns; SILHOUETTE's type-over-photo collision; ELAN's photo-through-type; ECLAT's deep-rounded warm masks.
- CLAIR's soft-shadow cards and pill tabs; VERRE's and VOLTAGE's glass panels; any blur or glow.
- Bright blue (#2F6BFF, #2B5BFF), gold/champagne coding, dark-luxury grounds, teal-on-navy tech palettes.
- Rounded corners above 2px, box-shadows, icon-feature rows, carousels, stock-photo hero with a dimming overlay and centred white type.
- Emoji, icon fonts, floating decorative shapes, and any number presented without its unit.

## LES GESTES (the moves menu)
1. LE MANIFESTE — hero A. 7/5 split: claim, subline and mini-figure row left; one 3:4 plate right, bleeding past the container to the viewport edge, from under the header down to ~78vh.
2. LA PAGE DE GARDE — hero B. No photo above the fold: the claim runs the full container width over a 1px navy rule, eyebrow and date on the same baseline at opposite ends, a 16:10 band arriving under the fold with its caption ledger.
3. LE RELEVÉ — hero C. The hero IS a figures table: claim in three lines left, a four-row hairline table right (figure 40px serif, label, year), no image until the second movement.
4. LA BANDE DE CHIFFRES — showpiece A. Pinned navy band; three pull-figure rows arrive in sequence on scrub, counters ramping, base rules drawing left to right, copper landing on the last.
5. L'ÉCHELLE — showpiece B. One figure counting 0 → value while a 1px vertical rule descends the full band height and five year-ticks light one after another beside it.
6. LE DOSSIER — case study. A 3:4 plate on one side; three numbered beats (Contexte / Intervention / Résultat) on hairlines opposite, a result figure closing the column, then a three-cell hairline meta row under it (durée / équipe / honoraires, 10px caps over 14px ink-62%, vertical hairlines between the cells) so the text column ends level with the plate's caption instead of leaving a void in the section's bottom corner.
7. LA MATRICE — ledger rows. Four to six full-width rows: numeral, serif title at 1.6–2rem, one line of prose, right meta column with tabular numerals; hover tints the row and slides the meta 4px.
8. LE CONSEIL — governance ledger. Names in a hairline table, each with a 44px square 1px-bordered serif monogram; role, spécialité and année in the meta columns.
9. LA CITATION — the one permitted social proof. Pale steel band, one client quote in serif at clamp(1.6rem, 2.6vw, 2.2rem) capped at 34ch, attribution in caps on a dash, a three-row mandate ledger at the right edge. Never two, never a carousel.
10. LE VOLET / LA PLANCHE — the interlude, in one of its two forms. VOLET: a short full-bleed navy band carrying one serif sentence at 2.4rem and nothing else. PLANCHE: a 12rem label rail (label on its dash, two sentences of place-writing) beside a 16:10 duotone band held to 360–520px, caption ledger under the plate with an optional right-edge micro-line (SIÈGE DEPUIS 2009). Either way it is the page's held breath — and the PLANCHE is how a run of three consecutive ledgers gets its photograph back.
11. LA COLONNE QUI SE REMPLIT — the spine as choreography. Each entry's 44px track fills as its movement crosses 45% of the viewport; on small screens the header counter increments instead.
12. LA FICHE DE CONTACT — closing. Coordinates as hairline rows left (adresse, téléphone, horaires, honoraires) plus a short accès note, baseline form right, success plate replacing the form in place.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
« LA DURÉE » — cabinet de conseil en stratégie. Hero: LE MANIFESTE, claim left over a dusk-lobby plate bleeding to the right edge, three mini-figures on a hairline. Showpiece: LA BANDE DE CHIFFRES — montant, mandats, taux de reconduction sequenced on a pinned navy band. Middle: doctrine spread → matrice of four métiers → figures band → dossier → citation. Mood: patient, institutional, almost silent.

« LE MANDAT » — société de gestion d'actifs. Hero: LE RELEVÉ — the claim in three serif lines beside a four-row table of encours, no photograph until the second movement, where a 16:10 plate of a business district lands full-bleed. Showpiece: L'ÉCHELLE — one figure counting 0 → 12,8 Mds DA while a vertical rule descends and five year-ticks (2019 → 2026) light in turn. Mood: numerical, dry. The middle is an allocation ledger, not prose.

« LA PLACE » — cabinet d'expertise comptable. Hero: LA PAGE DE GARDE — full-width claim over a navy rule, eyebrow and date on the same baseline, plate under the fold. Showpiece invented in spirit: LE CALENDRIER — twelve month ticks scrubbing under a fixed cursor while four obligations fiscales light as their month passes. Mood: precise, calendar-driven; the matrice becomes a table of échéances.

« LE PACTE » — cabinet d'avocats d'affaires. Hero: type only — the claim broken into three lines, each on its own hairline row, with a small navy typographic plate carrying the year of founding. Showpiece: LA CHAÎNE DE DÉCISION — five transaction stages (mandat, due diligence, valorisation, négociation, closing) sliding in from x-32 as a vertical rule descends past them on scrub. Mood: procedural; photography appears once, late, beside the contact ledger.

« L'INVENTAIRE » — société de gestion d'actifs immobiliers. Hero: inverse geometry — a plate occupying the left 58% and bleeding to the left edge, the claim in a right-hand column on paper with a single 100px pull-figure under it instead of a mini-figure row. Showpiece: LE RELEVÉ D'ACTIFS — a pinned band where six asset rows stack one per scrub beat while a running total counts at the top. Mood: dense, factual.

« LA PRUDENCE » — courtier en assurance d'entreprise. Hero: three columns — type, a narrow 4:5 plate 320px wide standing between them, then the mini-figures column — the only hero where the plate is interior to the composition. Showpiece: LA MATRICE DE RISQUE — a 4×4 hairline grid drawing itself cell by cell on scrub, one cell filling navy, axis labels last. Mood: methodical; the citation is replaced by a claims-handling ledger.

« LA RELÈVE » — conseil en transmission d'entreprise familiale. Hero: inverted — a full-bleed navy band carries the claim in paper-white serif at the top of the page, with the paper ground beginning below it and holding the mini-figures on pale steel. Showpiece: GÉNÉRATIONS — three date columns (1978, 2004, 2026) with a horizontal rule travelling left to right on scrub, each column's figure counting as the rule reaches it and the last date taking copper. Mood: patrimonial, long-horizon; the dossier becomes a family-history spread with two plates.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
THREE things must be at 100% or CAPITALE collapses into "another blue consulting site". FIRST, THE FIGURES: genuinely large (100px minimum at 1440, up to 140px when one figure owns the section) and genuinely specific (4,2 Mds DA, 94 %, 37 mandats — never "des centaines de clients"). A timid 40px number is the difference between an annual report and a template. SECOND, THE DUOTONE DISCIPLINE: every image carries the same two inks; one raw-colour photograph breaks the world instantly. THIRD, THE HAIRLINE CRAFT: 1px rules at 12–18% ink, never 2px except the copper base rule; rules that align across columns; tabular right-aligned numerals in every table.

The cheap details that separate this from a generated page cost nothing: French number spacing; the header counter incrementing as you scroll; the caption ledger under each plate with a place and a year; the reference number in the success state; the honest line about fees near the contact; meta columns that line up down the whole ledger. When in doubt, remove a sentence and set a number in its place — this world speaks in figures.`,
};
