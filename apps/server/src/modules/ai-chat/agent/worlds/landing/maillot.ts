import type { DesignWorld } from "../types";

/**
 * MAILLOT — soir de match.
 * Deep navy night, kit-white type, one volt accent, every diagonal on the
 * page cut at ONE held angle. Giant jersey numerals, chant stacks, diagonal
 * launches. Fuses with bloc (the club opens its shop — sport retail) and
 * voltage (neon fight night — combat events).
 */
export const maillot: DesignWorld = {
	avoidFor: [
		"notary",
		"aesthetic clinic",
		"wedding services",
		"guesthouse / riad",
		"tea house",
	],
	doc: `# DESIGN WORLD: MAILLOT — soir de match

## Philosophy
This page is MATCH NIGHT, not a website. The tunnel before the walk-out: navy dark pressed flat, floodlights cutting hard geometry, the kit ironed, the crowd already chanting on the other side of the wall. Its defining structural facts: (1) ONE ANGLE governs every diagonal — the site picks 6, 7 or 8 degrees ONCE and then every section cut, every sliced corner, every skewed CTA, every launch vector and every floodlight wedge measures exactly that angle; a second angle anywhere is a counterfeit kit. (2) The page is NIGHT-DOMINANT: deep navy grounds carry the match, and kit-white "away" sections appear once or twice as the shirt turned inside out. (3) Numbers are heroes: giant jersey numerals in a condensed face mark sections and carry stats at 40%+ of the viewport's height, cropped by edges like a number on a back seen too close. (4) The crowd is typographic: the chant stack — one word repeated in rows, weight escalating row by row to a volt peak — is how this world roars without images. (5) Volt is rationed like a captain's armband. Impossible failure modes: pastel calm, rounded friendliness, gradient washes, glow of any kind, a page with no diagonal (no cut, no maillot), a timid numeral. Self-audit before shipping: (1) every diagonal on the page measures the SAME angle — audit every clip-path, transform and vector against the site constant; (2) count the volt moments — only numerals, the chant peak row, CTAs and one tick/rule per section may carry it; (3) at least two numerals taller than a third of the viewport, at least one cropped by an edge; (4) zero border-radius above 4px, zero box-shadow, zero blur, zero gradient; (5) exactly one chant stack on the page; (6) the page reads complete and composed with JavaScript dead.

## The variation contract (why two MAILLOT sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- The held angle: one value in 6–8°, applied to every diagonal without exception, cuts always rising toward the right (mirrored in RTL).
- The three-color kit: night navy register + kit white register + volt — no fourth hue, ever.
- Giant jersey numerals (solid fills, never stroked) and the chant stack (max one per page).
- Diagonal-launch motion: fast slides along the site angle, power4.out, nothing bounces, nothing glows, nothing floats.
- Flat everything: no gradients, no shadows, no blur, radius ≤4px.
- The volt budget: numerals, chant peak row, CTAs, one tick/rule per section.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact angle (6/7/8°) and the exact hexes inside the night and volt registers.
- The Anybody width cut (font-stretch 110–150%, one value per site) and weight ceiling (800 or 900).
- The CONCEPT NOUN that drives the page — le tunnel, le kop, la grille, le chrono, le vestiaire — it names the hero composition, the showpiece scene and the copy voice.
- The chant word, what each giant numeral truthfully counts (founding year, belts, matchday, lane length), which 1–2 sections wear the away kit, the drawn kit objects, and the section order beyond the fixed opening and closing.
A MAILLOT page whose numerals count nothing real is a failure: every giant number must be true and explained somewhere on the page.

## The vibe (voice)
Vestiaire French: the coach's voice, tutoiement, short frontal sentences, facts spoken as pride. Register examples: "Ici, on compte les rounds. Pas les excuses." · "Séance d'essai : 0 DA. Le cran, tu l'apportes." · "6 jours sur 7. Le septième, ton corps récupère." Honest concessions build the trust ("Le créneau du samedi est plein — on ouvre un deuxième en mars."). No marketing perfume, no fake urgency — the scoreboard only counts real things. Exclamation marks: one per page, maximum ("ALLEZ !").

## Visual signatures
- LA COUPE (owned tic — diagonal slice section transitions): every section boundary is a hard clip-path cut at the site angle. Formula for full-bleed sections: clip-path: polygon(0 var(--slice), 100% 0, 100% 100%, 0 100%); margin-top: calc(-1 * var(--slice)); padding-top: calc(var(--pad) + var(--slice)); where --slice = tan(angle) × 100vw → 6° = 10.5vw, 7° = 12.3vw, 8° = 14.1vw. The cut RISES toward the right, every time. Sections are position: relative so DOM order paints later sections over earlier ones; every section carries overflow-x: clip.
- LES NUMÉROS (owned tic — giant jersey numerals): Saira Condensed 700–800, line-height 0.78–0.8, in the clamp(11rem, 24vw, 21rem) — clamp(11rem, 26vw, 23rem) register (below 900px: clamp(8rem, 30vw, 13rem)), SOLID fills only — full-strength volt or kit white on navy, or a depth numeral at 8–12% kit white — never stroked or outlined (ghost stroked numerals are CINÉTIQUE's). They crop off viewport or section edges and always count something true, with a tracked-caps caption stating what.
- LE CHANT (owned tic — chant stack): one word repeated in 4–6 rows, Anybody uppercase, weight ladder ascending row by row (100→300→500→700→900, or 300/500/700/900 in four rows), line-height 0.92, tracking +0.01em. The PEAK (final, heaviest) row is volt; all others kit white (navy on away ground). ONE chant stack per page — hero, showpiece or footer, never two places.
- KIT HAIRLINES: all rules and borders are 1px — rgba(244,242,237,.16) on navy, rgba(16,33,74,.14) on white. Cards, tables, the header rule, form fields. Thick borders are BLOC's; this world's structure is the cut, not the frame.
- SLICED CORNERS: panels, cards and form blocks cut ONE corner (top-right canon) at the site angle — horizontal leg 90–140px, vertical leg = leg × tan(angle) ≈ 11–17px — a long shallow slice, not a 45° notch.
- LES PROJECTEURS (floodlight wedges): flat rectangles rotated −(site angle), kit white at 4–7% opacity, zero blur, max 2 per dark section — stadium light as flat geometry, never glow.
- SKEWED KIT CTAs: primary buttons are parallelograms — transform: skewX(-angle) on the block, inner label counter-skewed upright.
- VOLT TICKS: a 14×5px parallelogram at the site angle precedes every section label — this tick IS the section's one allowed volt rule.

## Color physics
- NIGHT (dominant ground): the #10214A / #0C1B3D register. The showpiece scene may deepen to the #0A142E / #081226 register — the darkest minute of the match, used once.
- PANEL NAVY: cards and form panels sit one step off their ground, the #14285A / #16295C register — a panel is a surface, never a hole.
- KIT WHITE (ink on night, and the away ground): #F4F2ED / #F1EFE8 — never pure #FFFFFF; the shirt has been washed a hundred times.
- VOLT: #DDF247 (register #D6EC3F–#E2F65A). Budget — giant numerals, the chant peak row, CTAs, one tick/rule per section. Nothing else: not links (kit white, underlined), not borders, not whole grounds, not body emphasis.

FIXED TOKEN MAP — NIGHT→--background · KIT WHITE→--foreground · VOLT→--primary · NIGHT→--primary-foreground · PANEL NAVY→--secondary · the darkest-minute navy→--accent · dimmed kit white→--muted · kit white at 16%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, wedge or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- CONTACT LAW: volt never sits directly on kit white. On away sections, CTAs flip to navy fill with volt label, and ticks/rules flip to navy. Volt text only ever on navy; navy text only ever on volt.
- Away-white sections: 1–2 per page, never adjacent, never the opening.
- Gradients exist NOWHERE — not in grounds, art, text or buttons. Depth is the deep-navy step and the flat wedge. box-shadow exists nowhere; elevation is the cut and the hairline.
- ::selection is volt ground with night text. :focus-visible is a 2px volt outline offset 3px (navy outline on away sections).

## Typography system
- DISPLAY: Anybody 700–900, UPPERCASE always, font-stretch at the site's width cut (110–150%, one value per site), tracking +0.005–0.02em, line-height 0.92–1.02. NEVER italic — the site angle is the only slant this world tolerates, and it lives in geometry, not glyphs. Display never below 1.4rem.
- NUMERALS: Saira Condensed 600–800 for every number that matters — stats, prices, hours, day marks and the giants. font-variant-numeric: tabular-nums in any table or timetable.
- BODY: Archivo 400–600, 1rem–1.0625rem, line-height 1.55–1.65, measure ≤64ch, always flush left. Long paragraphs never centered.
- SCALE: hero name clamp(3.1rem, 10.5vw, 9.2rem); section titles clamp(2.2rem, 5vw, 4.4rem); stat/slam rows clamp(1.3rem, 2.5vw, 2.2rem) held to ONE line each (white-space: nowrap above 900px); chant rows clamp(1.9rem, 3.8vw, 3.3rem); giant numerals per LES NUMÉROS above.
- LABELS: Archivo 600–700, uppercase, 11–12px, tracking +0.14–0.2em, ALWAYS preceded by the volt tick — never a floating letter-spaced whisper on bare ground.
- PRICES/STATS: Saira Condensed numeral with the unit ("DA", "/mois", "j/7") in Archivo 600 at 40–50% of the numeral size.
- Arabic pairing: display Cairo 800–900, body IBM Plex Sans Arabic 400/600; digits stay Saira Condensed; the slice mirrors (cuts rise toward the LEFT), skews flip sign, the chant stack works unchanged.

## Signature art / components
- KIT OBJECTS (imagery system): all imagery is flat drawn SVG kit — a maillot, gloves, a chrono, a whistle, a cone, a lane rope — built from 2–3 tones of the trio only, each object carrying ONE detail stripe at the site angle (a chest band, a sleeve cut). No outlines thicker than 1px, no shading, no 3D, no mascots, no photography ever. Informative scenes get role="img" + a real aria-label in the page's language; decorative repeats are aria-hidden.
- SCOREBOARD FURNITURE: stat blocks read like a stadium board — label above in tracked caps, Saira numeral, unit beside; blocks separated by kit hairlines, never boxed in thick frames.
- BUTTONS: primary = volt parallelogram (skewX(−angle)), night label in Archivo 700 uppercase 13–14px +0.08em, padding 16–18px block / 26–34px inline; buttons and form fields use min(var(--radius), 0px) — this kit's corners stay square, the slice is the only cut. Hover/focus: fill snaps to kit white and the block translates ~4px along the launch vector, 120–160ms. On away sections: navy fill, volt label, hover deepens to the darkest navy. Secondary = hairline ghost parallelogram, kit-white label, hover fills rgba(244,242,237,.06).
- CARDS: panel-navy ground, 1px kit hairline, top-right corner sliced at the angle, a jersey numeral heading the card, title in Anybody, meta line in Saira, body in Archivo.
- LA FEUILLE DE MATCH (timetable): rows separated by hairlines; the day cell in Saira 700 at 1.8–2.2rem; sessions inline with hairline separators; tabular-nums throughout.
- FORMS (la convocation): fields are hairline boxes on panel navy — 1px kit hairline, radius 0, padding 14–16px, kit-white text on rgba(244,242,237,.04); labels uppercase 11px above the field, never placeholder-as-label. Phone-first: input type="tel" placed first-class with a local placeholder; structured choices (discipline, créneau, wilaya) in a styled select. Invalid: 2px volt left border + a frank message ("Il manque ton numéro."). Success: an honest match-sheet block replacing the form, stating exactly what happens next, with the visitor's name if given. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, discipline, … }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads, fills or references.
- FAVICON: inline SVG data URI — night square, one volt parallelogram slice at the angle, a kit-white numeral.

## Page chassis
- Vertical rhythm: --pad: clamp(4.5rem, 10vh, 8rem). Cut sections use padding-top: calc(var(--slice) + var(--pad)*.55) and every section uses padding-bottom: calc(var(--pad)*.55 + var(--slice)) so content clears the incoming cut at the right edge without leaving a dead field at the left. Containers 1200–1360px; numerals, chants, wedges and the footer wordmark may bleed. overflow-x: clip on html, body and every section; scroll-margin-top ≈70px on sections for anchor jumps under the sticky header.
- HEADER: slim night bar, kit hairline bottom, wordmark in Anybody 900 with a small volt tick, nav links Archivo 600 uppercase 12px, ONE volt CTA. Sticky allowed, z-index above the cut sections, no transparency, no blur.
- FIXED OPENING (hero law): the first viewport must contain — the club name in Anybody caps, ONE giant jersey numeral, a facts row of 3–4 honest kick-off facts (fondé, jours, effectif, plateaux…), one volt CTA — and its bottom edge is the page's first cut. The COMPOSITION is client-owned (LE TUNNEL, LE KOP, LE TABLEAU… see gestes).
- FIXED CLOSING: LA CONVOCATION — a contact split (club facts column + sliced-corner form panel) — then the monument footer: the wordmark at clamp(3.4rem, 12.2vw, 11rem), white-space: nowrap, centered, cropped at its baseline by the volt rule (wrapper overflow: hidden, inner translateY(.16em)), small print below.
- FREE MIDDLE (compose 3–5 from this vocabulary, never two adjacent alike): l'échauffement (away-white statement section) · la composition (staggered discipline/squad cards) · the scrub showpiece (la montée family, below) · la feuille de match (timetable/fixture table) · le vestiaire (offers as kits) · le tifo (chant interlude — only if the page's chant is not already spent).

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs UMD)
THE GOVERNING LAW: every hidden state is set via gsap.set, NEVER in CSS. Gate the whole motion block on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Scripts dead → a complete, composed, fully readable page.
- The personality is DIAGONAL LAUNCHES: everything enters fast ALONG the site angle — from (−96px, +12px) or the mirrored (+96px, −12px), always dy = dx × tan(angle). power4.out, 0.45–0.7s, staggers 60–90ms. Nothing fades in place, nothing rises vertically, nothing drifts.
- Numerals SLAM: from (−140px, +17px) with scaleX 1.05→1, 0.55s power4.out, landing ~80ms before their section's rows.
- Counters are stepped like a scoreboard: numeric tweens snap to integers; in the showpiece they are scrub-bound, elsewhere they run once on entry (~0.9s).
- SCRUB SHOWPIECE TYPE — the pinned SLAM SCENE (la montée family): a 220–300% pinned deep-navy scene where rows launch sequentially on scrub, a giant numeral counts to a true number, and — if the page's chant lives here — the chant builds row by row to its volt peak. Exactly ONE per page. Below 900px: unpinned; the beats fire once on entry instead.
- HOVERS: instant kit reactions, 120–160ms — fills snap, the volt tick slides 6px along the angle, underlines appear whole. Never scale-ups, never glows, never lifts. Keyboard/touch parity mandatory: :focus-visible mirrors every hover; touch gets the resting state with all content reachable.
- BANNED MOTION: bounce/elastic/back overshoot, rotation (beyond the fixed static skews and wedge construction), parallax drift, fades longer than 0.8s, blur or filter transitions.
- Reduced motion: the final composed page — counters at final values, chant complete at full weight, every row placed. The cut geometry does the talking.

## Maillot ban list (adds to the global ban list)
1. Hazard-stripe 45° bands, stencil spray-edge caps, bolted steel plates — that is CHANTIER's language. Maillot's diagonal exists ONLY as cuts, corner slices, skews and wedges at the site angle — never as striped bands.
2. Hard black offset shadows, 3–4px ink borders, clashing rotated price-chips — that is BLOC's language. Maillot borders are 1px hairlines; prices sit in Saira, unboxed.
3. Fit-to-viewport headlines and poster-color section rotation — that is AFFICHE's language. Maillot owns exactly two grounds: night and away white.
4. Neon-tube glow, glowing electric beam lines, backdrop-blur glass panels — that is VOLTAGE's language. Volt NEVER glows: no text-shadow, no blur, no filter. Floodlights are flat wedges.
5. Outline/stroked display type, ghost stroked numerals, rotated crossing marquees, glyph-scramble links — that is CINÉTIQUE's language. Numerals are always solid; no marquee of any kind.
6. Any gradient, anywhere — grounds, text, buttons, art.
7. box-shadow anywhere; border-radius above 4px; pill shapes.
8. Italic glyphs (the held angle is the only slant).
9. A third hue — no red, no orange, no sky blue, no "choose your team color".
10. Photography: stock athletes, dark gym shots with overlays, sweat close-ups.
11. Fake urgency — countdowns to nothing, "3 places restantes". The board counts real things.
12. Curved or wavy section dividers — the cut is straight at the angle, or it does not exist.
13. Emoji, icon fonts, rounded mascots.
14. Letter-spaced labels floating on bare ground without their tick.

## LES GESTES (moves menu)
1. LE TUNNEL — split hero: the club name stacked in 2–3 rows on the left, a giant volt numeral cropped off the right edge, the facts row and CTAs beneath the name. The first cut slices the hero's bottom.
2. LE KOP — chant hero: the chant stack IS the hero, rows building down the viewport, kick-off facts and the CTA riding below the volt peak row. Spends the page's one chant.
3. LA MONTÉE — the seeded showpiece: pinned deep-navy palmarès scene; stat rows slam in along the angle one per beat, a giant jersey numeral counts up behind them, the chant builds row by row to full weight at the end.
4. LA FEUILLE DE MATCH — the timetable as fixture table: Saira day cells, hairline rows, sessions inline; one row may carry the section's volt tick as "today".
5. LE VESTIAIRE — offers as kits: 2–4 sliced-corner offer cards, price in Saira at 2.6–3.4rem, ONE featured card carrying a 4px volt top rule (the section's rule), a drawn maillot per offer.
6. LE PANNEAU — substitution-board counter: one key number flips stepped like the fourth official's board — a matchday advancing, a price toggling mensuel/saison — snap-to-integer, no easing softness.
7. LE COULOIR — single-file row: 3–5 cards enter along the angle with a 70ms stagger, the last one cropped by the section edge like a teammate still in the tunnel.
8. LE CAPITAINE — away-white quote section: one giant Anybody statement, a navy tick, a tiny Saira attribution. The page's breath between two navy halves.
9. LES PROJECTEURS — two flat wedges crossing behind a dark section's content at the angle, 4–7% kit white, holding a centered statement or a single stat.
10. LA GRILLE DE DÉPART — staggered grid: each card in a row sits one slice-step lower than its left neighbor (translateY = column-width × tan(angle)), the whole grid reading as a starting grid.
11. LE TABLEAU — scoreboard section or hero: a hairline panel of labeled Saira numerals (effectif, horaires, cap time), reading like a live board, nothing blinking.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. CLUB RIVAL — boxe & cross-training, Oran. Angle 7°, concept LE TUNNEL. Hero: name stacked in two rows on the left, volt "16" (fondé 2016) cropped off the right edge, facts row FONDÉ 2016 · 2 PLATEAUX · 6J/7. Showpiece LA MONTÉE full seed: palmarès rows slam, the numeral counts 0→9 (ceintures régionales), the chant "RIVAL" builds to its volt peak. Mood: tunnel-walk, coach's pride.
2. NAJMA ACADÉMIE — sports club / academy. Angle 6°, concept LE KOP. Hero: the chant "NAJMA" ×5 IS the hero, facts and CTA riding the bottom row — the chant is spent here. Showpiece LE CALENDRIER: a pinned fixture board where match rows stamp in one by one while a giant matchday numeral advances J01→J30 behind. Mood: crowd, belonging, Saturday morning buses.
3. OLYMPIA — swimming school. Angle 6°, concept LA LIGNE D'EAU. Hero: one wide Anybody line crossing the hero's cut edge, kit hairlines beneath it as swim lanes, a 10% white depth numeral "50" (le bassin) behind. Showpiece LES COULOIRS: pinned lanes scene — a volt timing bar sweeps along the angle while level names surface lane by lane, each with its Saira chrono time. Mood: chlorine, silence, then the buzzer.
4. DIX-HUIT — streetwear / drops. Angle 8°, concept LE MAILLOT TITULAIRE. Hero: a viewport-tall central volt "18" wearing the brand name small across its chest line, drop facts row beneath. Showpiece LE VESTIAIRE scrub: the rack slides across along the angle, each piece slamming its price and stock as it centers. Mood: drop night, shutters up at midnight.
5. BOX 9 — crossfit / functional. Angle 7°, concept LE TABLEAU. Hero: a scoreboard panel as hero — WOD du jour, cap time, the club name above it in Anybody. Showpiece LE CHRONO: a pinned clock counts 20:00→00:00 in Saira while the WOD's four movements launch in at each five-minute mark. Mood: chalk, timer beeps, shared suffering.
6. DÉPART — driving school. Angle 6°, concept LA GRILLE DE DÉPART. Hero: staggered offer cards as grid slots descending the angle, pole position holding the code+conduite pack, the school name across the top. Showpiece LES FEUX: five flat start lights fill one by one on scrub — lights out — and the success stats (taux de réussite, moniteurs, véhicules) launch together along the angle. Mood: cheeky precision, first-try pride.
7. KINÉ DU STADE — physiotherapy / kiné. Angle 7°, the quiet cut of the world. Hero: away-white opening inverted by exception — navy type on kit white, generous air, a small navy numeral "01 — BILAN", honest care facts row; volt appears only as CTA labels on navy fills. Showpiece LA PROGRESSION: a pinned recovery chart builds bar by bar along the angle, week numerals S1→S8 stamping in sequence. Mood: discipline in service of care.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: THE HELD ANGLE (one stray diagonal at another angle and the kit is a counterfeit — audit every clip-path, skew and vector against the site constant before shipping), THE NUMERALS AT TRUE SCALE (a numeral that doesn't crop an edge is a badge, not a jersey — go bigger), and THE VOLT BUDGET (volt everywhere is a highlighter accident; volt rationed is a floodlit stadium). The cheap details that separate it from a generated page: the volt tick before every label, tabular Saira in every table, the sliced corner on panels, the volt ::selection, the facts row of true numbers, one honest concession line in the copy. When in doubt: darker navy, bigger numeral, fewer volt moments.`,
	energy: "loud",
	family: "varsity",
	fusesWith: ["bloc", "voltage"],
	id: "maillot",
	industries: [
		"martial arts / combat sports",
		"gym / fitness club",
		"crossfit / functional",
		"personal trainer / coach",
		"sports club / academy",
		"swimming school",
		"streetwear / drops",
		"fast food",
		"physiotherapy / kiné",
		"dance studio",
		"driving school",
	],
	kind: "website",
	mood: ["proud", "kinetic", "tribal", "disciplined"],
	name: "Maillot",
	priceFeel: "accessible",
	tagline:
		"Soir de match : marine profond, blanc maillot, volt — l'entrée du tunnel.",
	preview: {
		accent: "#DDF247",
		fontFamily: "Anybody",
		ground: "#10214A",
		ink: "#F4F2ED",
		sampleWord: "ALLEZ !",
	},
};
