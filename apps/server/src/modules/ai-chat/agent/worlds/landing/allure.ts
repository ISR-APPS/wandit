import type { DesignWorld } from "../types";

/**
 * ALLURE — the dark showroom.
 * The automotive-performance world: cool blue-black ground, studio photography
 * with rim light, wide-tracked Space Grotesk caps, flat electric blue, and
 * spec numbers that live in BARS, never in rolling digits. Photography is LAW.
 * fusesWith rationale: forme (the same measured-body discipline moved from a
 * car to an athlete — allure lends the studio, forme lends the effort), grille
 * (the swiss axis under the showroom: allure's plates snapping to grille's
 * exposed columns is the editorial version of a dealership page).
 */
export const allure: DesignWorld = {
	avoidFor: [
		"dentist",
		"aesthetic clinic",
		"spa / hammam",
		"veterinary",
		"wedding services",
		"kindergarten / crèche",
		"patisserie / bakery",
		"artist / illustrator",
	],
	doc: `# DESIGN WORLD: ALLURE — the dark showroom

## Philosophy
This page is a LIT STUDIO WITH THE DOORS CLOSED, not a website: one object on a seamless backdrop, one raking light finding the shoulder line, and around it a wall of instruments stating what the object DOES. The room is cool blue-black. First fact: PHOTOGRAPHY IS LAW, always studio — dark seamless ground, rim light on a hard edge, deep reflections, no street, no sky, no people, no badge, no text in frame. Second: EVERY CLAIM IS A NUMBER AND EVERY NUMBER IS A BAR — puissance, couple, délai, correction are horizontal gauges with printed end-scales, so the visitor reads a measurement, not an adjective. Third: the page NEVER GLOWS. The blue is flat ink — no text-shadow, no bloom, no beam, no bevel. Light lives inside the photographs and in one moving highlight (the specular sweep); everywhere else, matte.
Impossible failure modes: a warm cosy page; an atmospheric page with no figures; a neon night-club; a page carried by illustration.
Self-audit before shipping — count them: (1) at least three gauge bars with printed 0-to-max scales, their fills at visibly different lengths; (2) zero glow, text-shadow, gradient text or chrome; (3) every photograph graded saturate(.95) contrast(1.08) brightness(.98) inside a chamfered plate, all reading as ONE car unless the copy names a second; (4) every photograph carries EITHER a badge lockup OR a hairline caption; (5) the specular sweep crosses exactly one photograph on scrub; (6) at least six prices, delays or measurements in tabular numerals, DZD where money shows.

## The variation contract (why two ALLURE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Cool blue-black ground, flat electric-blue accent, matte everything.
- Studio photography only, graded and plated as specified; no drawn illustration, no street stock, no render dressed as a photo.
- The three owned tics: spec gauge bars, the specular sweep, the model badge lockup.
- Wide-tracked grotesque caps for display; tabular numerals for every figure.
- Square geometry: every control consumes var(--radius) directly (the 2px square corner), ONE 20–26px chamfer cut at the bottom-right of every plate and panel. No pills, no soft cards, no shadows.
- 0.5s expo.out entrances; nothing bounces, loops or flickers.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The exact hexes inside the register (ground #0C0F14 / #0A0E13 / #101620; accent #3D7BFF / #2F6BF0 / #4C8BFF).
- The display face WITHIN the register: Space Grotesk, Geologica, Chivo — one per site, always in caps.
- The DRIVING NOUN — l'allure, la ligne, la préparation, la piste, le silence — it names the hero statement, chooses which measurements become gauges, and sets the voice.
- The archetype (concession, detailing, location, garage, auto-école, pièces) and therefore what the gauges measure, what the showpiece scrubs, the section order beyond the fixed opening and closing.
- The COMPOSITION of that opening and closing — which plate geometry the hero carries, where the photograph sits, how the type column divides. The invariants below are law; the container is the client's.
An ALLURE page whose gauges measure nothing real is a failure: choose the measurements FIRST, then build the page around them.

## The vibe (voice)
Technical French, short, verifiable, zero superlatives — a workshop report that happens to be beautiful: a figure, a unit, a condition. Numbers are never rounded up to sound better, and every promise carries its limit.
- "Trois baies climatisées, un banc de polissage, un contrôle à la lampe rasante."
- "Chiffres relevés par notre atelier sur banc, pneus été, plein fait — pas de communiqué constructeur."
Never: "l'excellence automobile", "une expérience unique", exclamation marks, countdowns. One honest limit beats three promises.

## Visual signatures (measured — reproduce exactly)
- SPEC GAUGE BARS (owned tic): a 3px rail in rgba(233,236,241,.14) with a 1px × 11px end tick at 0% and 100%; the fill is flat accent, width from a --to ratio, transform-origin left. Above it a head row: name at .66rem / +.20em caps in ink-55 left, value at clamp(1.5rem,2.4vw,2.15rem) 700 tabular right, unit at .5em in ink-55. Under it the printed scale at .6rem / +.16em ink-38 ("0" … "600", "12 s" … "3 s"). The mini variant (2px rail, .9–1.2rem value, 8px ticks) lives in cards and the hero column. Gauges NEVER roll digits, never animate the number. CHOOSE THE END SCALES BEFORE THE VALUES: four bars all landing between 80% and 90% read as one length and the panel stops carrying information. Pick honest round maxima that spread the fills — a healthy rail reads .66 / .755 / .85 / .90.
- SPECULAR SWEEP (owned tic): a band 44% of the plate wide, skewX(-12deg), background linear-gradient(96deg, transparent, rgba(233,236,241,.06) 34%, rgba(233,236,241,.32) 50%, rgba(233,236,241,.06) 66%, transparent), a single 1px rgba(61,123,255,.38) line at its centre. Below .30 the band dies on a near-black plate and only the blue line survives. It parks at left:-52% (outside the plate, invisible with JS dead) and travels xPercent 0 → 400. One photograph per page gets it on SCRUB; the hero may take one pass on entrance.
- MODEL BADGE LOCKUP (owned tic): a 46px circle, 1px border, transparent inside, holding a 2-letter monogram at .72rem/700 — beside it a two-line block: model code at .8rem/700/+.14em, spec line at .7rem/+.20em. That spec line sits at ink-38 on the page ground and MUST rise to ink-55 on a photograph — ink-38 is a caption-on-ground value and disappears over a graded image. Accent-bordered on the hero photograph, ink-bordered elsewhere. Flat: no bevel, no gradient, no shine.
- THE CHAMFERED PLATE: every photograph sits in a plate of 1px rgba(233,236,241,.26) padding, clip-path cutting 26px off the bottom-right corner (20px on cards, panels and the form) — the world's geometry signature; nothing else is rounded beyond 2px.
- THE LABEL WITH A LEAD RULE: section labels at .68rem / +.24em caps in ink-55 preceded by a 22px × 1px accent rule (flex, gap .6rem). Never a pill, never centred.
- HAIRLINE SPEC TABLES: label left (.63rem / +.18em, ink-38) — value right (.85rem/500, tabular, full ink), split by 1px rgba(233,236,241,.13) top borders, .7rem padding. This is how ALLURE lists anything.
- THE FIGURE BAND: a lifted #131922 panel between hairlines, four figures at clamp(2.1rem,5.2vw,4.2rem)/700 tabular split by vertical rules, each with a .63rem/+.20em caption beneath and an optional accent unit at .34em superscript.

## Color physics
- GROUND: the cool blue-black register — #0C0F14 / #0A0E13 / #101620. BLUE-black: braise's brown-black and generique's neutral black are other worlds.
- LIFT: two lifted tones — #131922 (bands, cards) and #1A212C (featured card, hover). Flat fills, never gradients.
- INK: #E9ECF1 at 100% for headlines, values and prices; .72 body; .55 labels; .38 captions and scales. Hairlines ink .13, frames .26.
- ACCENT: flat electric blue, the #3D7BFF register. Budget per page: one accent word in the hero headline, primary buttons, gauge fills, label lead rules, the featured card's border and code, ONE accent band, nothing else. The accent NEVER glows, never gradients, never sets body copy.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · GROUND→--primary-foreground · LIFT→--secondary · deep LIFT→--accent · ink at 55%→--muted · ink at 13%→--border · 2px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- THE ACCENT BAND: one per page — a full-bleed #3D7BFF field, #0A0D12 ink, hairlines at rgba(10,13,18,.28), carrying the single client quote or the offer. The page's only bright beat; it never opens the page and never touches the hero.
- GRADIENTS exist in exactly three places: the photographic vignette, the photographic bottom scrim, and the specular sweep. Nowhere else — no gradient text, no gradient border, no gradient section; even the select's caret is a clip-path triangle, never a two-gradient corner.

## Typography system
- DISPLAY: a wide-set grotesque in CAPS — Space Grotesk (default), Geologica or Chivo. Weight 700, +.035em, line-height .96. h1 clamp(2.55rem, 8.6vw, 6rem) — never above 10vw, a ceiling other worlds own. h2 clamp(1.85rem, 3.6vw, 3.15rem). h3 clamp(1.05rem, 1.5vw, 1.28rem) at +.06em. Never italic, never lowercase display, never a serif.
- BODY: Wix Madefor Text (alternates: Onest, Public Sans), 400/500, clamp(.96rem, .92rem + .18vw, 1.06rem), line-height 1.62, ink-72, measure 46ch for the lede, 60ch for footnotes.
- NUMERALS: always the display face, font-variant-numeric: tabular-nums, +.01em. Prices, delays, powers, references, phone numbers — all tabular, so columns align down the page. Money reads "48 000 DZD", unit at .44em in ink-55.
- LABELS AND CAPTIONS: display face, uppercase, .60–.68rem, +.16em to +.24em. Captions under photographs use the same register in ink-38 — sentence content, caps setting.
- ARABIC PAIRING (if the page serves Arabic): IBM Plex Sans Arabic or Almarai for display and body, 500/700, tracking reset to 0 (never letterspace Arabic), line-height 1.7; gauges, scales and tabular figures stay in the Latin display face, mirrored right with dir="rtl".

## Signature art: the photography, and the components
PHOTOGRAPHY IS THE WORLD'S ONLY IMAGERY. Art direction phrase, reused verbatim in every generation: "automotive studio photography, dramatic rim lighting on dark seamless background, deep reflections, no badges, no text". FOUR ROLES. THE FACE — the whole car three-quarter, high angle, on seamless with its floor reflection: 16/9 native, plated 3/2 in the hero column or 16/9 in a band. The money frame: first viewport, and the model it shows is the model the spec sheet sells. THE MACRO — optique, jante, épaule de tôle: portrait 3/4 source, cropped 4/4.5 to 1/1 beside a statement or in a section head, or letterboxed to 16/6 as the showpiece band. THE PROFILE — the whole car side-on, 16/9, uncropped; for a SECOND vehicle (a client's car, the fleet), never to restate the featured one. THE INTERIOR — dash and instruments, cropped near 9/10 so the frame holds the wheel and cluster, nothing else.
- ONE VEHICLE LAW: every photograph must read as the SAME car unless the copy names a second — that car then gets its own section, captions and dates. A page selling "V6 biturbo 2026" over three visibly different cars has broken the world.
- USE EVERY SUPPLIED FRAME: re-crop it at another aspect, give it a section, or write one line saying why it was dropped. If a role is missing, never substitute a drawing — build the section from gauges and hairline tables.
- THE GRADE (law): filter: saturate(.95) contrast(1.08) brightness(.98) on every image, plus a radial vignette radial-gradient(115% 85% at 50% 42%, transparent 34%, rgba(12,15,20,.5) 78%, rgba(12,15,20,.9) 100%) dissolving the backdrop into the page ground. Where type or a lockup sits on the image, add a bottom scrim of 52% height to rgba(12,15,20,.86). Text NEVER sits on the lit part of the car. CROP THE WARMTH OUT — wood trim, brass, tan leather, amber dials: a warm object in frame is the only door warmth has into this world.
- CAPTION LAW: every photograph carries the badge lockup in its lower-left (16–26px inset) or a hairline caption beneath — never both, never neither.
- BUTTONS: 50px high (small 40px), padding-inline 1.6rem, radius 2px, display face .74rem / +.16em caps. Primary = accent fill, #0A0D12 ink, hover #5A8DFF. Ghost = transparent, rgba(233,236,241,.26) border; hover turns border AND text accent. No shadow, no underline, no icon fonts — an 18×8px hairline arrow SVG is the only glyph.
- CARDS: 1px hairline border on #131922, 20px bottom-right chamfer, padding clamp(1.5rem,2.2vw,2rem); order code → title → description → price → spec list → mini gauge → arrow link. Hover AND focus-within raise the border to rgba(233,236,241,.3), the fill to #1A212C, over .22s. One per row may be FEATURED: #1A212C, rgba(61,123,255,.42) border, accent code, accent tag chip.
- FORMS (the instrument panel): fields on the ground colour in 1px hairline boxes, radius 2px, .82rem padding, label above at .63rem/+.20em ink-55; focus turns the border accent, no glow; the select's caret is a 9×6px clip-path triangle. Phone is type="tel" with inputmode and a real local placeholder ("0555 00 00 00"); structured choices are selects (objet, créneau); one date input. On valid submit dispatch "wandit:lead" on document with the fields flat in detail (nom, telephone, modele, date, creneau, message), then replace the form with an honest success block: a badge-ring "OK", a title, a sentence naming the real delay and the number called. One off-canvas decoy input carries data-wandit-hp, read only on submit.
- ACCESSIBILITY FLOOR: one h1; semantic landmarks; :focus-visible 2px accent outline offset 3px; ::selection accent on ink; decorative overlays aria-hidden; every gauge role="img" with an aria-label spelling the measurement in words ("Puissance : 510 chevaux, sur une échelle de 0 à 600"); every hover has a focus twin. FAVICON: an inline SVG accent circle with an ink diagonal slash.

## Page chassis
- Container: min(1240px, 100% - clamp(2rem, 7vw, 6rem)). Rhythm: padding-block clamp(4.5rem, 9vh, 8.5rem); the section after a pinned showpiece drops to clamp(3rem, 6vh, 5rem) so the release is not a hole.
- Header: sticky, 66px, solid rgba(12,15,20,.92) — NEVER blurred glass — wordmark left (caps, +.20em, second word ink-38), nav links .72rem/+.16em with a hairline growing on hover and focus, one small primary button. Under 900px only the button stays.
- FIXED OPENING (hero law) — the INVARIANTS, true of every ALLURE page whatever its composition: a FICHE HEAD at the top of the type column (label with lead rule + one hairline-bordered line of hard facts — commune, année, capacité); the STATEMENT STACK at its foot (h1 of two to four caps lines carrying EXACTLY ONE accent word, lede at 46ch, two buttons); at least one chamfered photographic plate AND one pair of gauge bars with printed scales inside the first viewport, so the two loudest tics are read before any scroll; a hairline META STRIP of three items (adresse / horaires / téléphone) in tabular caps beneath the grid. The hero never centres, never dims a photograph to put white type on it, never fills the viewport with one word.
- THE DEFAULT INSTANCE (build this unless the brief argues otherwise): an asymmetric split, 1.06fr / .94fr, stretched. Type column left, justified space-between; right column the same, holding the FACE plate at 3/2 with the badge lockup lower-left, a two-row hairline fiche under it, two mini gauges at its foot. On mobile the plate moves first, the statement follows, fiche and gauges after. Other containers are legal — a full-bleed panorama with the statement on a chamfered plate at its corner, a strip of vertical crops, a bleeding right column, a code grid with one small macro in it. The variations below change the CONTAINER; none changes an invariant.
- FIXED CLOSING: the essai/devis section — a .85fr / 1.15fr split, argument, hairline contact table and badge-ring seal note left, chamfered form panel right — then the monument footer: the business name in display caps at clamp(1.75rem, 9.2vw, 7.6rem) edge to edge, a hairline, four meta columns, a legal line with the RC/NIF.
- FREE MIDDLE (compose 3–5, never two adjacent alike): the FIGURE BAND (lifted panel, two-column head + four tabular figures) · the SHOWPIECE (below) · the STAGGERED OFFER ROW (three cards at 0 / +48 / +96px offsets, one featured, its section head carrying a macro plate + caption) · the OVERLAP PANEL (a 7/12 photograph, a 5/12 chamfered text panel pulled 1.4–2.6rem over its quiet EDGE — never over the car — caption beneath, optionally a second smaller detail plate stepped in below; a panel floating vertically centred against a taller photo stack makes air, not a hole) · the ACCENT BAND (quote + measured fiche) · the SPEC LEDGER (a full-width hairline table of eight to twelve rows, for a client with more figures than photographs).

## Motion identity — LAUNCH SWEEP
Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state comes from gsap.set; CSS hides nothing. With JS dead the page is fully composed: gauges full, values visible, photographs uncovered.
- Entrances: opacity 0 → 1, y 28 → 0, 0.5s expo.out, stagger 0.07 per section (hero 0.55s / 0.075 / delay 0.12). Nothing else moves. No overshoot easings — expo, power2/3 and sine only.
- THE GARAGE-DOOR WIPE: each plate is revealed by a ground-coloured shade scaling scaleX 1 → 0 from transform-origin right, 0.85s power3.inOut, once at "top 88%".
- THE SHOWPIECE (one per page, scrubbed, pinned): the stage pins at "top top" for +=1600px, scrub 0.65. On a timeline of ≈1.6: the sweep crosses the photograph (xPercent 0 → 400, linear, 0 → 1.0), putting the band mid-plate a third of the way through the pin; at 0.255 the gauge FILLS run scaleX 0 → 1 (0.4 each, 0.16 apart); a 0.47 tail holds the completed panel. NAMES, VALUES and printed scales show from the FIRST frame — only the fills animate, so an anchor link landing mid-pin finds a working instrument panel, never four empty rails. Under 901px the pin is dropped: the sequence plays once on enter at "top 62%".
- Supporting motion: the hero's gauge pair fills 0.9s power3.out, 0.12 apart, 0.6s after load; card mini gauges 0.8s power3.out on entry; the footer wordmark rises 0.6s; hovers 0.2s on colour and border only.
- Reduced motion: no timeline — the page stands at its most composed frame, gauges full, sweep parked outside its plate.

## ALLURE ban list (in addition to the global list)
- VOLTAGE's neon-tube type, electric beams and glowing dark-glass panels — by name. ALLURE's blue is flat; one text-shadow breaks the world.
- AN2000's chrome bevelled type, glossy aqua orbs, orbit rings with lens flares — by name. The badge roundel is a 1px stroke, forever.
- MAILLOT's diagonal slice transitions, giant jersey numerals, the chant stack — by name. The chamfer is a 26px corner cut, never a section-wide slant.
- CINÉTIQUE's mix-blend-mode difference chrome, machine-telemetry voice (SYS.STATUS, FILE 001, coordinate captions), rotated crossing marquees, glyph-scramble links, corner registration ticks — by name. ALLURE speaks the spec sheet (réf., empattement, couple), never the machine log.
- FORME's odometer rolling-digit counters and red/black duotone grade — by name. ALLURE's numbers are printed and its bars fill; digits never roll.
- GÉNÉRIQUE's 21:9 hard-bar letterbox and Ken-Burns photo scrubs; the showpiece photograph never scales or pans.
- SILHOUETTE's huge-type-over-photo collision and ELAN's photo-through-type masthead: type sits BESIDE the photograph or on a plate over its dark zone.
- ELAN's honest impact meters: an ALLURE gauge always prints end ticks, a 0-to-max scale and a giant tabular value.
- ECLAT's 28–48px deep-rounded warm masks and photo-orbit; POUDRE's oval masks; MATIÈRE's arches. One chamfered rectangle is the only mask geometry.
- Any warm hue (amber, ember, brass, gold), any pastel, any second accent; soft shadows, blurred glass, backdrop-filter, radius above 2px (the chamfer excepted), pill nav containers.
- Stock photography of streets, showroom staff, handshakes, keys on a desk; car illustrations, vector cars, car icons.
- Rounded friendly sans, serif display, italic anything, centred long paragraphs, emoji; fake urgency, starbursts, visitor counters, any figure the client cannot prove.

## LES GESTES (the moves menu)
1. LA PLAQUE — the chamfered plate: 1px frame, 26px cut bottom-right, vignette, optional scrim. Every photograph is one; changing the aspect (3/2, 16/6, 1/1, 9/10) is how sections differ.
2. LE BALAYAGE — the specular sweep crossing a plate: once per page on scrub as the showpiece's spine, optionally once on the hero at entrance. Never looped, never on two plates at once.
3. LE TABLEAU DE BORD — a rail of two to four gauges on one baseline, values right-aligned above them. Under a photograph, in the hero column, beside a form, or alone as a band.
4. LA PASTILLE — the badge lockup in a photograph's lower-left, a quote's attribution, or beside the form's promise. Three per page maximum.
5. LA FICHE — the hairline spec table, for anything with a name and a value: specs, honoraires, dates, the proof block in the accent band.
6. LE BANDEAU CHIFFRES — the four-figure lifted band with vertical rules.
7. LES TROIS BAIES — the staggered offer row, cards offset 0 / +48 / +96px, one featured; under 900px each becomes a two-column spec card, never a stretched banner.
8. LE PANNEAU EN SURPLOMB — a text panel pulled over the quiet edge of a photograph, its chamfer showing, the caption beneath the image on the other side.
9. LA BANDE ÉLECTRIQUE — the accent band: quote left at clamp(1.4rem,3.2vw,2.65rem) over 24ch, measured fiche right, attribution beneath a hairline.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**LE PLATEAU — concession de coupés d'occasion, Alger.** Hero: a full-bleed 16/6 panorama, statement on a chamfered plate at its lower-left corner, nav floating above the image. Showpiece: the sweep travels the panorama while a twelve-row spec ledger writes itself beside it and a VERTICAL stack of three gauges fills bottom-up. Mood: a dealer who photographs like a museum.

**BAIE 2 — detailing et protection céramique, Oran.** Hero: type RIGHT, a square 1/1 macro plate (paint under raking light) LEFT, three mini gauges under the headline. Showpiece: the protocol — one photograph pinned while a single "épaisseur de vernis" gauge climbs through four labelled stages, the sweep marking each boundary. Mood: a laboratory that polishes cars.

**LOCATION 24H — location de véhicules premium, Alger centre.** Hero: a strip of three narrow vertical crops above a one-line headline and a price line. Showpiece: the fleet ladder — three model rows stacked, each sliding in on x as its disponibilité gauge fills, the sweep crossing only the active row. Mood: a counter that answers in seconds.

**CODE MOTEUR — pièces et préparation moteur, Blida.** Hero: a full-width grid of model codes in display caps with one accent word, a 1/1 macro plate where a code would sit, the gauge pair along its foot. Showpiece: the exploded spec — a pinned interior photograph, four hairline callouts drawing outward to four gauge bars filling as each line lands. Mood: a parts counter run by engineers.

**NUIT BLANCHE — lavage et detailing express, Constantine.** Hero: a half-height plate, statement above it, the CTA row on the accent band directly beneath. Showpiece: the comparator — two columns of gauges (formule rapide / formule complète) filling at deliberately different rates so the difference is felt, not argued. Mood: fast, cheap to say, expensive to look at.

**PISTE — stage de conduite et circuit, Zéralda.** Hero: the statement stacked hard left between two full-width hairline rules, a wide panorama plate to its right, meta chips (durée, places, niveau) below in one tabular row closed by two gauges. Showpiece: the lap — one gauge split into three sector segments filling in order while the sweep travels as the car, sector times printing as they land. Mood: a chronograph with a school attached.

**ATELIER 7 — garage mécanique et diagnostic, Sétif.** Hero: fiche head top, statement bottom LEFT, a tall narrow photographic column bleeding off the right edge. Showpiece: the intake sheet — a hairline checklist ticking item by item while one "état général" gauge climbs, the sweep passing once as the verdict lands. Mood: a workshop that reports before it invoices.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or ALLURE collapses into a generic dark template. FIRST, the PHOTOGRAPHY: studio, rim-lit, graded, plated, one car — a flat daylight snapshot in a car park destroys the world faster than any typographic mistake. SECOND, the GAUGES: real, provable measurements with printed end-scales spread across the rail, filling in sequence on the showpiece; a page with decorative bars is a page that lied. THIRD, the MATTE DISCIPLINE: flat blue, no glow, 2px radius, one chamfer, no shadow — the restraint is the luxury.
The cheap details that separate this from a generated page: tabular numerals so columns align; the accent lead rule before every label; the printed scale under every bar; the lockup's exact 46px circle; the caption naming what was done to the car; the accent band arriving late, after the numbers have convinced. When in doubt, delete a sentence and print a figure.`,
	energy: "medium",
	family: "auto-showroom",
	fusesWith: ["forme", "grille"],
	id: "allure",
	industries: [
		"car dealer",
		"car rental",
		"garage / mechanic",
		"car wash & detailing",
		"spare parts",
		"motorcycle shop",
		"driving school",
	],
	kind: "website",
	mood: ["dark", "engineered", "precise", "showroom", "fast"],
	name: "Allure",
	preview: {
		accent: "#3D7BFF",
		fontFamily: "Space Grotesk",
		ground: "#0C0F14",
		ink: "#E9ECF1",
		sampleWord: "ALLURE GT",
	},
	priceFeel: "premium",
	tagline:
		"Le showroom noir : photo studio, chiffres tabulaires, jauges qui se remplissent.",
};
