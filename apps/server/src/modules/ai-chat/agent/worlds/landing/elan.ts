import type { DesignWorld } from "../types";

/**
 * ÉLAN — the warm nonprofit.
 * Popular wave: the modern NGO / association site every serious cause asks
 * for — warm white ground, bold humanist type, documentary photography,
 * impact numbers that carry their denominators and their source. Values below
 * were measured on the Élan build (association d'alphabétisation, Alger,
 * 4 centres, DZD, 5 documentary photographs).
 * fusesWith: campus (the same civic optimism — campus counts places and hours,
 * élan counts donations and people served), clair (a cause that ships a product
 * or a platform; clair floats, élan never does), gazette (an association whose
 * argument is its published record — the annual report as a front page).
 */
export const elan: DesignWorld = {
	id: "elan",
	name: "Élan",
	family: "humanist-cause",
	tagline:
		"La cause qui compte juste : la photo dans les mots, les chiffres avec leur source.",
	kind: "website",
	mood: ["earnest", "warm", "civic", "direct"],
	energy: "medium",
	priceFeel: "accessible",
	industries: [
		"private school",
		"language center",
		"training institute / formation",
		"university prep / tutoring",
		"kindergarten / crèche",
		"online courses / e-learning",
		"music school",
		"sports club / academy",
		"home care / nursing",
		"conference / summit",
	],
	avoidFor: [
		"fine dining",
		"jewelry brand",
		"streetwear / drops",
		"DJ / entertainment",
		"cosmetics brand",
		"car dealer",
	],
	fusesWith: ["campus", "clair", "gazette"],
	preview: {
		ground: "#FFF8F0",
		ink: "#26323C",
		accent: "#E4572E",
		fontFamily: "Epilogue",
		sampleWord: "Élan",
	},
	doc: `# DESIGN WORLD: ÉLAN — the warm nonprofit

## Philosophy
This page is a PUBLISHED RECORD, not a campaign. An association that does real work already has the content: a timetable, an address, a number of people served, a number it failed to reach, a document deposited somewhere you could go and read. ÉLAN sets that record at a scale a stranger cannot ignore, and puts the cause's photographs INSIDE its words.

Two structural facts. FIRST: the masthead is photographic — the largest display words are windows cut into a documentary photograph (background-clip:text), so the first thing seen is the work itself, through the language. The photo never sits behind the words dimmed, never collides with them; it lives inside the letterforms. SECOND: the page is built of RAILS AND RULES — every measurable claim rides a thin labelled meter with a denominator and a source, every photograph sits on a 3px accent baseline rule, every list sits between hairlines. Numbers are furniture here, not decoration.

Impossible failure modes: pity (no crying faces, no dimming overlays, no countdown, no percentage without its denominator) and the anonymous NGO template (three icon cards, a stock photo, a blue button). If a figure cannot be confirmed by phoning on Tuesday, it does not go on the page.

Self-audit, all countable: (1) exactly ONE photo-through-type masthead in the first viewport, at most one more in the footer; (2) every meter carries label, value, denominator and foot-note; (3) at least one published figure the client did NOT reach, in the same size as the ones they did; (4) one source line naming a document and a date; (5) zero shadows; (6) every photograph graded, ending on its accent baseline rule with a caption.

## The variation contract (why two ÉLAN sites never look identical)
WORLD LAW — never renegotiated:
- The photo-through-type masthead as the page's largest type, with the directional scrim.
- Honest impact meters: thin rails, label + value + denominator + foot-note, one visible source line per page.
- The pledge card as the closing form: amount chips, a signature rule, an honest success state.
- Warm-white ground, deep blue-grey ink, ONE red-orange accent. No second accent, no gradient but the two scrims and the photo veil.
- Flat construction: plates, buttons and photo frames consume var(--radius) directly (the 3px chamfer), 999px on chips only, zero box-shadow.
- HEARTBEAT COUNT motion; no overshoot easing anywhere.
CLIENT-OWNED — where siblings diverge:
- The exact hexes inside each register (cooler slate ink + deeper brick makes a legal-aid association; warmer sand + brighter orange makes a youth club).
- The display face within the register (Epilogue / Golos Text / Anek Latin — one per site).
- THE COUNTED NOUN driving the page: adultes, repas, dossiers, litres, licences, heures. It names the hero meter, the ladder, the showpiece and the voice.
- The photographs, what the masthead words are cut into, and the section order beyond the fixed opening and closing.
An ÉLAN page without a counted noun is a failure. Name it first; the numbers, the ladder and the showpiece follow.

## The vibe (voice)
Plain French, administrative honesty, zero pathos. Short declaratives. Never a superlative without a figure attached.
- "Élan accompagne 742 adultes vers la lecture et l'écriture dans quatre centres d'Alger. Deux soirs par semaine, gratuitement, depuis 2014."
- "Nous publions les objectifs que nous n'avons pas atteints avec la même taille de caractère que les autres."
- "Il manque sept encadrants pour ouvrir Kouba le jeudi."
The dignity rule is a copy rule: beneficiaries are described by what they do, not by what they lack — "elles travaillent, elles élèvent des enfants, elles tiennent un commerce" comes before what is missing. One line of honest procedure sits near every commitment ("Aucun prélèvement automatique n'est déclenché par ce formulaire.").

## Visual signatures
- PHOTO-THROUGH-TYPE MASTHEAD (owned tic): display caps at clamp(3.15rem, 9.2vw, 7.4rem), weight 800, line-height 0.865, tracking -0.045em, padding-top 0.1em so accented capitals keep their accent inside the background box. Stack: background-color ink (the fallback if the photograph 404s), a directional scrim, the photograph at background-size 190% auto (260% under 640px), with background-clip:text + color/-webkit-text-fill-color transparent, wrapped in an @supports fallback returning solid ink. ONE continuous image across all lines — the letters are windows, never per-line crops.
- THE ACCENT FULL STOP: the masthead's final period is the one glyph excluded from the clip and filled solid accent. Exactly once per page.
- HONEST IMPACT METERS (owned tic): track 6px standard, 4px hero micro-rail, 14px full-width objective rail; radius 999px; track rgba(38,50,60,.13) on light ground, rgba(246,238,228,.18) on ink; fill solid accent, origin left. Four parts in order: caps label (0.7rem, +0.13em), value in display with tabular numerals, rail, foot-note carrying the percentage AND the reason ("90 % — 14 séances annulées, grève des transports, décembre"). A meter with no denominator is a bug.
- PHOTO FRAME LAW: border-radius 3px 3px 0 0, a 3px solid accent rule flush under the image (the baseline rail), caption below at 0.68rem / +0.13em uppercase, place in ink and detail in muted ink. Never a rounded mask, never a four-sided border, never a shadow.
- LABELS ARE NEVER BARE: every micro-caps label carries a 7px accent square before it (gap 0.62em) or sits on a hairline. HAIRLINE ARCHITECTURE: 1px rgba(38,50,60,.14) between rows and at section tops; 1.5px solid ink to OPEN any list, table or rail — the first rule is always the heavier one; 1.4–1.6px borders on chips and buttons.
- THE MONUMENT FOOTER: the name at clamp(5rem, 9.6vw, 8.6rem), line-height 0.84, tracking -0.052em, padding-top 0.14em, clipped into a second photograph over the ink-deep ground with the light scrim.

## Color physics
- GROUND: warm white, the #FFF8F0 / #FFFCF6 register, carrying most sections.
- PLATE: #FFFDF9, one step brighter: the quote band and the pledge card, read as paper laid on the page.
- BAND: #F6EEE4 / #F3E9DD, warm cream, for exactly ONE full-width section (in the demo, the donation showpiece).
- INK: deep blue-grey, the #26323C / #22303B register — never black, never warm brown. Body 78–86% ink, muted metadata 62%.
- INK-DEEP: #1B242C — the single inverted band (the figures) and the footer. Exactly one inverted band before the footer; two would be a rhythm, and this world has an argument. The band inverts everything: cream #F6EEE4 text, hairlines rgba(246,238,228,.22), the lighter meter track; the accent does not change.
- ACCENT: red-orange, the #E4572E / #DC5228 / #E06136 register, hover #C9421C. Hard budget, roughly 6% of surface: meter fills, label squares, photo baseline rails, ladder amounts, ONE phrase inside a claim, CTA fills, the pledge seal, the masthead full stop. Never accent body text, never an accent ground.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · GROUND→--primary-foreground · PLATE→--secondary · INK-DEEP→--accent · ink at 62%→--muted · ink at 14%→--border · 3px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, veil or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- NO GRADIENTS except the two type scrims and the photo veil — the scrims live inside letterforms.

## Typography system
- DISPLAY: a bold humanist sans with personality in the caps — "Epilogue" (primary), "Golos Text", "Anek Latin". Weights 700/800 only. Uppercase for masthead and monument, sentence case for section titles. Never italic; emphasis is the accent or a heavier weight.
- BODY: "Manrope" (primary), "Public Sans", "Figtree". Weights 400/500/600/700.
- SCALE: masthead clamp(3.15rem, 9.2vw, 7.4rem), under the 10vw ceiling, never viewport-fitted. Titles clamp(1.85rem, 4.1vw, 3.3rem), lh 1.03, tracking -0.022em. Sub-heads clamp(1.18rem, 1.7vw, 1.5rem). Lede clamp(1.04rem, .5vw + .92rem, 1.26rem)/1.55, max 56ch. Body 0.955rem/1.6. Labels 0.685–0.7rem, +0.13/+0.14em. Captions 0.68rem, +0.13em.
- NUMERALS carry the page: every figure in display with font-variant-numeric: tabular-nums and tracking -0.03em, thousands separated by a NARROW NO-BREAK SPACE (U+202F) — "3 264 000 DA", never a comma.
- HARD RULES: no italic; no monospace (administration, not machine); body never centred; display never letter-spaced positive.
- ARABIC PAIRING: display "Noto Kufi Arabic" 700, body "IBM Plex Sans Arabic" 400/600. The clip works in Arabic only above 5rem, never letter-spaced. Meters mirror: label right, rail filling right-to-left, foot-note right.

## Signature art / components
PHOTOGRAPHY IS THE ONLY IMAGERY — no illustration, no icons, no drawn scenes. The art direction, verbatim in every generation prompt: "warm documentary photography, education in Algeria, natural window light, hopeful, dignity, people from behind or hands only, no identifiable faces, no text".
- THE GRADE (law): filter: saturate(1.02) contrast(1.02) on every image, plus a veil overlay linear-gradient(180deg, rgba(255,248,240,.09), rgba(228,87,46,.055)) so the set sits in one warm honest palette. Frames may take a BOUNDED join correction — saturate 0.82–1.06, contrast ≤1.04, brightness 0.98–1.14, never beyond (the demo: chalkboard saturate(.94) contrast(1.03) brightness(1.02); hero desk saturate(.82) contrast(1.04); underexposed book stack brightness(1.13) saturate(1.04)). A detail that must never appear is cropped OUT: lock that frame's ratio and zoom past it at every width.
- THE CLIP SCRIM (law): on light ground the masthead stack is linear-gradient(180deg, rgba(27,36,44,.34), rgba(27,36,44,.10)) over the photograph. On ink ground the footer monument inverts it — linear-gradient(180deg, rgba(255,248,240,.46), rgba(255,248,240,.20)), background-size 170% auto so a bright zone (paper, a light shaft, a wall) lands inside the letterforms. Choose the crop by brightness, not by subject.
- CAPTIONS: place in ink, detail in muted ink, uppercase micro ("CENTRE DE BELOUIZDAD · NIVEAU 2 · MARDI 18 H"), naming what the frame actually shows. An uncaptioned photograph is decoration.
- BUTTONS: radius 3px, padding 15px 26px, border 1.6px, weight 700, 0.95rem. Filled accent primary; ghost on a rgba(38,50,60,.26) border inverting to solid ink on hover.
- CHIPS: 999px, border 1.4px, padding 8px 15px, 0.775rem — the only round objects here, for facts (jours, horaires, effectifs) and donation amounts.
- THE PLEDGE CARD (owned tic, and the fixed closing form): a plate on a 1px ink-26% border, radius 3px, headed by a title, a one-line legal identity ("association agréée n° 0142 · Alger") and a drawn SVG seal roundel (two concentric accent circles, the year, the name), closed by a 3px accent rule across the card. The body is a real donation instrument: amount chips in display with aria-pressed synced to a free-amount number input; a frequency pair; THE SIGNATURE FIELD — the name input in display at 1.15rem over a 2px bottom rule and nothing else, labelled "Signature — nom et prénom"; a +213 prefix chip beside the tel input; an optional email; a receipt checkbox. On valid submit, dispatch wandit:lead on document with the fields flat in detail (montant, devise "DZD", frequence, nom, telephone, email, recu, source) and swap the form for an HONEST success state repeating amount, frequency, the number called, the delay, and what to do if nobody calls. One off-canvas decoy input carries data-wandit-hp, untouched by the page's script.
- FLOOR: one h1 (the masthead), semantic landmarks, :focus-visible 2.5px accent outline offset 3px, ::selection accent on ground, decorative SVG aria-hidden, real alt text, keyboard and touch parity on every hover. FAVICON: an inline SVG of three stacked rounded rails, the longest in accent — the impact meter.

## Page chassis
- Container 1320px; gutters clamp(20px, 4.4vw, 64px); section rhythm clamp(66px, 9vw, 132px); the inverted band runs padding-top clamp(58px, 8vw, 116px) / padding-bottom clamp(44px, 6vw, 86px) so it never ends on a pool of empty ink.
- HEADER: sticky, ground at 97% with a 7px blur and a 1px hairline bottom, min-height 68px; it inverts to ink-deep while an ink band or the footer is behind it. Wordmark = an 11×22px accent bar + the name in display. Four nav links, the phone, one filled CTA. Under 1000px the links become a second hairline row of micro-caps anchors; the phone goes under 620px. Never a shadow, never a pill container.
- FIXED OPENING — the masthead hero: a hairline agrément row (association line left with its accent square, agrément / founding / scale right), the photo-through-type block, the lede at 56ch, two buttons, the fact rail on its 1.5px ink rule. The first viewport must contain the clipped words, one photograph, one CTA and at least one measurable fact with its denominator.
- FIXED CLOSING — pledge card + monument footer: the donation section on the cream band (full-width objective meter, then the ladder beside the card), then the ink-deep footer.
- FREE MIDDLE — compose 3–5, never two adjacent alike: LE CONSTAT · LES NUMÉROS · LA BANDE DES CHIFFRES · LA VOIX · LE TROMBINOSCOPE SANS VISAGES · LE PROTOCOLE · LA BANDE PHOTO (a 3:1 documentary band with its baseline rule and caption).

## Motion identity — HEARTBEAT COUNT
GOVERNING LAW: every hidden state is set in JS via gsap.set, never in CSS. Gate the whole block on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). With the CDN dead or motion reduced the page is complete: meters at their real widths, counters at their real values, ladder amounts in accent, the pledge card fully assembled.
- ENTRANCE GRAMMAR, everywhere: opacity 0→1, y 18→0, 0.8s, power2.out, stagger 0.07 within a section, start "top 82%". Nothing else moves — no parallax, no rotation, no marquee, no loop. THE MASTHEAD lifts alone, a beat early: y 26→0, 1.05s, power3.out, delay 0.08 on load, untriggered.
- THE COUNT: every meter fills and counts on entrance (start "top 86%"): the fill tweens scaleX 0→1 over 1.05s power2.out from a left origin while a proxy ramps the numeral over the same 1.05s, reformatted with narrow no-break spaces on each update. At landing the numeral takes ONE pulse — scale 1→1.045 over 0.14s power2.out, back to 1 over 0.2s power2.inOut, origin left. That beat is the heartbeat: once per number, never repeated.
- HOVER: colour-only transitions at 0.16–0.18s. No lift, no scale.
- THE SHOWPIECE — one per page, scrubbed, NEVER pinned (these sections are taller than the viewport; pinning would hide the form): the pledge card ASSEMBLES while the year's meter fills to its real percentage. Start "top 88%", end "bottom 78%", scrub 0.55, on a 2.0-unit timeline. The objective rail scales 0→1 and the money counter ramps 0→target over the first 0.9 units, so the true figure stands for most of the scroll; ladder rows lift from opacity 0.44 to 1 with their amounts tweening from muted ink to accent at 0.30 + i × 0.16; the card's eleven pieces (title, identity line, seal, accent rule, amount fieldset, frequency, signature, contact row, consent, button, procedure note) arrive at 0.20 + i × 0.17, each 0.34s power2.out from opacity 0.36 / y 16. Pending states never fall below 0.36 — mid-scrub, the form must still read and work.
- FORBIDDEN: back.out and elastic at any strength; counters that restart; anything that loops.

## Ban list (in addition to the global one)
- SILHOUETTE's type-over-photo collision, her mixed-scale lockups and her one-crimson-word-per-viewport law — by name. ÉLAN's photograph lives INSIDE the letters: never overlapping, never behind them dimmed, and the accent is red-orange on meters, not a crimson word.
- CAMPUS's enrollment stepper rail, timetable grid cards and chunky rounded % skill bars — by name. Élan's meters are THIN rails with a denominator and a source; there is no numbered step path here.
- GAZETTE's halftone-dot imagery, masthead furniture (dateline, edition number, weather line, jump lines) and justified ruled broadsheet columns — by name.
- CARNET's handwritten annotations, spiral binding edge and pinned polaroids — by name. The signature line is a RULE with a text input over it; no handwriting face renders here.
- AFFICHE's poster-colour section rotation, fit-to-viewport headlines and punctuation-as-graphic — by name. One ground, one cream band, one ink band; display stays under 10vw.
- MATIÈRE's arch geometry, drawn room miniatures and 4% full-page grain; CLAIR's soft-shadow floating cards; ECLAT's 28–48px deep-rounded warm masks; GENERIQUE's letterbox bars with Ken-Burns — all by name.
- Manufactured urgency of any kind: countdowns, "plus que 3 jours", thermometers with no source, "X personnes viennent de donner". Any figure without its denominator; any percentage without the document and date it came from.
- Pity imagery: identifiable beneficiary faces, children looking at camera, hands reaching upward, before/after portraits, dimmed photographs with centred white type.
- Box-shadow anywhere; gradients on any ground; a second accent; coloured body text; monospace, telemetry captions, machine voice.
- Icon fonts, emoji, three-feature-cards-with-icons rows, testimonial carousels — ONE static quote, attributed to a real name with a year and a current role, is the only permitted social proof.

## LES GESTES (the moves menu)
1. LE BANDEAU-PHOTO — the masthead: one clipped display block over one continuous photograph, two or three lines, closed by the accent full stop.
2. LE RAIL DE FAITS — three micro-meters on a 1.5px ink rule closing the first viewport: label, value, 4px rail, foot-note.
3. LA JAUGE PLEINE LARGEUR — the objective meter at container width: counter in display at clamp(2.2rem, 5.6vw, 4.4rem) with its currency a 0.42em suffix on a 0.28em space, the target right-aligned over two lines, a 14px rail beneath, a foot row carrying the percentage left and the arrest date right.
4. LE CONSTAT — a photograph one side, stretched to the copy's height; opposite, a label, a title, one claim at clamp(1.5rem, 2.5vw, 2.15rem) holding a single accent phrase, two short paragraphs, a footnote on a 3px accent left rule saying what the figure is and is not.
5. LES NUMÉROS — programme rows: 01/02/03 in accent display beside a title, a paragraph and a chip row, hairline-separated, against a sticky title column carrying a fiche pratique so the left side is never empty.
6. LA BANDE DES CHIFFRES — the single ink-deep band: head row (title left, method right) over a hairline, a 2×2 grid of meters with denominators, closed by the source line whose asterisk is accent.
7. LA FICHE PRATIQUE — the hairline term/definition table: accent caps term at 0.7rem left, one sentence right, three to five rows.
8. LA VOIX — one static quote on a plate with a 3px accent top rule, in display 600 at clamp(1.35rem, 2.7vw, 2.35rem), the attribution in its own column on a 1.5px ink rule. Never two, never a carousel.
9. LE TROMBINOSCOPE SANS VISAGES — the team as four cells on 1.5px ink top rules: name in display, role in muted, "DEPUIS 2016" in accent micro-caps. No portraits, of staff either.
10. LE PROTOCOLE — the commitment table: what you must give, what you will be taught, what is required, what happens next. Written so a reader can honestly decide against you.
11. L'ÉCHELLE DES MONTANTS — the ladder: amount in accent display, tabular, beside one clause naming what it buys and for how long. Four rows on hairlines.
12. LE MONUMENT — the footer wordmark clipped into a second photograph over the ink ground, three fact columns (siège / contact / transparence), a bar crediting the photographs.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
No two share a hero composition or a showpiece choreography.
- **LA LIGNE** — alphabétisation, Alger. Hero: clipped masthead over two lines in the left column, a SLENDER vertical photograph in a 240–380px right column stretched to the copy's height, the three-up micro-meter rail closing the viewport full width. Showpiece: the pledge card assembles piece by piece beside the ladder while the objective rail fills to 68 % and the counter ramps in the first third of the scrub. Order: masthead → constat → numéros → chiffres → voix + trombinoscope → protocole → don. Mood: nothing to hide.
- **LE CARTABLE** — collecte de fournitures, Constantine. Hero: the masthead runs the FULL container width on one line with the lede tucked into a narrow column beside its tail, a 3:1 band directly beneath — no portrait, no meters above the fold. Showpiece: L'INVENTAIRE — a supply list checks off row by row while the stock rail DRAINS from 100 % to 12 %, the only backwards meter in this world, the last row landing on what is still missing. Order: masthead → bande photo → échelle → inventaire → protocole de dépôt → chiffres → don. Mood: a stockroom that publishes its shelves.
- **LE PUITS** — accès à l'eau, Ghardaïa. Hero: numeral-led — the objective counter and the 14px full-width rail ARE the page's first object, the masthead at half scale beneath, a thin 4:1 photograph closing the viewport. Showpiece: LE RELEVÉ — three village meters fill in relay, each handing off to the next, the source line stamping last with its deposit date. Order: jauge hero → trois villages → constat → voix → fiche technique → chiffres → don. Mood: an engineering report that decided to be warm.
- **LA MARAUDE** — aide alimentaire de nuit, Oran. Hero: three stacked full-width bands — clipped masthead on cream, a 4:1 night photograph, an hours strip in three columns. Showpiece: LES SEPT NUITS — one huge numeral counts up in seven visible STEPS while seven night rows light beneath it, its rail filling in seven increments rather than smoothly. Order: bands hero → les sept nuits → contenu d'un colis → protocole bénévole → voix → chiffres → don. Mood: nocturnal, exact.
- **LE DOSSIER** — permanence juridique, Alger. Hero: no photograph above the fold — the masthead alone at maximum scale on bare warm white, a four-row hairline fiche beneath (permanence, langues, gratuité, confidentialité), the CTA pair right-aligned under it. Showpiece: LE BANDEAU QUI SE DÉPLACE — the masthead itself is the scrubbed scene, the photograph inside the letters PANNING across on scroll while the fiche rows arrive one by one. Order: masthead + fiche → constat → protocole d'accueil → chiffres → voix anonymisée → don. Mood: discreet, procedural.
- **LA COUR** — association sportive de quartier, Béjaïa. Hero: three columns — clipped masthead in short stacked lines left, a tall photograph centre, three micro-meters stacked right. Showpiece: LE REGISTRE — twenty-four squares fill one by one while the "licences prises" figure counts UP to 18 sur 24 and its rail fills with them, the date d'arrêté du registre stamping last, jamais présenté comme une rareté. Order: three-column hero → le registre → horaires → échelle → trombinoscope → voix → don. Mood: a club that keeps its register in public.
- **LE RELAIS** — insertion professionnelle, Tizi Ouzou. Hero: the photograph bleeds off the LEFT viewport edge at half the container height, masthead and lede in the right column, one wide quotation on a hairline closing the viewport. Showpiece: AVANT / APRÈS — two columns assemble in PAIRS, each pair joined by a short accent rule that draws between them, ending on the placement meter with its landing pulse. Order: bleed hero → parcours en paires → chiffres → protocole entreprise → voix d'un employeur → don. Mood: a broker of second chances, in a clean shirt.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
THREE things at 100 % or this world collapses into the NGO-template swamp. FIRST, THE MASTHEAD CLIP: choose the photograph for BRIGHTNESS and TEXTURE, crop so a legible pattern (shelves, paper, a light shaft, hands on a desk) lands inside the letterforms, scrim until the words hold contrast. A muddy clip is worse than no clip — if the crop cannot be made to read, change the photograph, never the tic. SECOND, THE NUMBER DISCIPLINE: every figure carries its denominator, every percentage its reason, at least one published objective is one the client MISSED, one source line names a document and a date. Soften that and the page becomes a brochure. THIRD, THE FLATNESS: 3px corners, 999px only on chips, zero shadow, one accent, no gradient on any ground.
The cheap details: the narrow no-break space inside 3 264 000 DA, the 1.5px rule opening every list against the 1px rules inside it, the accent square before every label, the caption naming a room and an hour, the "il manque sept encadrants" left in the copy, the +213 chip, the success state naming who to ask for if nobody calls back. When the page feels thin, do not add a section — add one more countable fact and one more source. Honesty is this world's voltage.`,
};
