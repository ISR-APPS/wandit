import type { DesignWorld } from "../types";

/**
 * SERMENT — the calm clinical practice.
 * Popular wave: the "serious medicine" website every clinic recognises —
 * white, teal, ordered — executed with real typographic care. Values below
 * were measured on the shipped demo (Cabinet Médical Ibn Sina, Constantine).
 * Fuses with clair (same daylight trust, softer product logic), eclat (the
 * warm lifestyle clinic — aesthetic medicine), campus (institutional rigour).
 *
 * ASSET ROSTER — demo/assets, all four placed, none unused:
 *   couloir.jpg      1440x1920  hero plate, bled off the right edge, free height
 *   consultation.jpg 1433x1920  équipe, grid-locked beside the practitioner cards
 *   materiel.jpg     1433x1920  le serment, 1:1 under the engagement column's text
 *   accueil.jpg      1920x1071  rendez-vous, 16:11 topping the hours & accès column
 * One grade for all four: filter: saturate(.92) contrast(1.03) brightness(1.02).
 */
export const serment: DesignWorld = {
	id: "serment",
	name: "Serment",
	family: "medical-trust",
	tagline:
		"Blanc clinique, tracé ECG, tarifs écrits : la médecine qui rassure.",
	kind: "website",
	mood: ["calm", "clinical", "ordered", "reassuring", "precise"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"general practitioner / cabinet",
		"specialist (cardio, derma, ophtalmo…)",
		"dentist",
		"medical lab / analyses",
		"pharmacy",
		"physiotherapy / kiné",
		"optician",
		"veterinary",
		"psychology / therapy",
		"nutritionist",
		"home care / nursing",
		"aesthetic clinic",
	],
	avoidFor: [
		"venue / salle des fêtes",
		"DJ / entertainment",
		"festival",
		"street food / food truck",
		"streetwear / drops",
		"COD product landing (single product)",
		"music / band",
		"tattoo & piercing",
	],
	fusesWith: ["clair", "eclat", "campus"],
	preview: {
		ground: "#F7FAFB",
		ink: "#12303B",
		accent: "#1B8A93",
		fontFamily: "Source Serif 4",
		sampleWord: "Serment",
	},
	doc: `# DESIGN WORLD: SERMENT — the calm clinical practice

## Philosophy
This page is a WELL-RUN CONSULTATION, not a website: you are received on time, told the price before the examination, given the reason for every line on the prescription. Its first structural fact is THE VITALS LINE — one soft ECG trace, 1.5px, in the house teal, the page's spine: it closes the hero, divides the movements, and draws itself across the one deep band where the practice counts itself out loud. Its second is FLATNESS: every card, plate, field and photograph is a 1px hairline rectangle at a 2px radius and the stylesheet contains ZERO box-shadow — depth here is made of rules and space, never of blur. Its third is EVIDENCE: nothing is claimed without a number, a name, a duration or a price beside it — minutes, tariffs, registration numbers, consulting days. The failure mode "reassuring adjectives over a stock photo of a smiling patient" is structurally impossible: there is nowhere here for an unverifiable sentence to live. So is the cheap-clinic look — nothing glows, floats or bounces. Self-audit before shipping: zero box-shadow, zero border-radius above 3px, one drawn ECG trace per two sections, every service row carrying a duration and a price, exactly one deep-ground band, every photograph in \`demo/assets\` placed.

## The variation contract
WORLD LAW — never renegotiated by brief or builder:
- The vitals line as spine and divider; the flat hairline card with its teal corner tick; the slot-chip grid inside the booking form. All three visible on every build.
- Near-white ground family, ONE teal accent, ONE deep companion band. No gradient anywhere — SERMENT is the world with zero gradients.
- Flat geometry: 1px hairlines, every card, plate, chip, field and button consuming var(--radius) directly (the 2px chamfer), no shadow, no glass, no blur panels.
- Serif display + plain sans body + small-caps tracked labels. Never italic.
- Evidence discipline: durations, tariffs, registration numbers, dated figures.
- Every supplied photograph placed, graded alike, aligned to something.
- Calm-pulse motion: 0.6s fades, ~12px of travel, one scrubbed trace, one 6s pulse.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes inside each register (a colder #F5F9FB or warmer #F8FAF9 ground; a deeper #12707A or brighter #22929B teal).
- The display face: Source Serif 4, Petrona, Faustina — one per site.
- THE PROMISE that drives the page — le délai, l'explication, la proximité, la garde, le suivi. It names the hero sentence, the engagement section, the counted band and the voice. Without a named promise the page is a template: choose it first, then let it choose the words.
- Which specialty vocabulary furnishes the middle (registre des actes, parcours de soin, plateau technique, équipe, protocole, résultats), the section order beyond the fixed opening and closing, the rooms photographed, the facts counted.

## The vibe (voice)
Plain professional French, short declaratives, zero marketing lift. The practice explains itself the way a good doctor explains a diagnosis: one fact per sentence, no euphemism, no superlative, no exclamation mark. Numbers are given even when ordinary. From the shipped demo:
- « Le prix de l'acte est annoncé au téléphone, avant la consultation, et il est le même au moment de payer. »
- « Quand le diagnostic n'est pas certain, nous le disons, et nous vous orientons vers le confrère le mieux placé. »
- « Ces quatre chiffres sont extraits du registre du secrétariat, arrêtés au 31 décembre dernier. »
Forbidden register: "votre santé, notre priorité", "équipe à votre écoute", "technologie de pointe", any sentence that would survive being moved to another clinic's site unchanged.

## Visual signatures
- **THE VITALS LINE (OWNED TIC).** One SVG path, \`stroke 1.5px\`, \`vector-effect: non-scaling-stroke\`, round caps and joins, teal at 85% opacity (42% for the quiet variant), on a full-width \`viewBox="0 0 1440 48"\` with \`preserveAspectRatio="none"\` so it stretches edge to edge and the beat compresses on narrow screens. The repeatable segment, measured: \`h90 l10 -4 l10 4 h20 l6 4 l7 -19 l7 22 l6 -7 h24 l14 -7 l14 7 h32\` — flat, P wave, QRS, T wave, flat — repeated six times from \`M0 24\`. It draws itself with strokeDashoffset (1.5s power1.inOut) on first entry. Two to four per page, never more; one always closes the hero.
- **FLAT HAIRLINE CARDS WITH A TEAL CORNER TICK (OWNED TIC).** \`background #FFFFFF; border 1px solid #D7E3E7; border-radius 2px; padding clamp(20px,2.2vw,28px)\`, NO shadow ever. Two absolutely-positioned 2px teal bars at \`top:-1px; left:-1px\`, 16–18px long, form an L over the corner; on hover/focus-within they grow to 30px in 0.24s and the border warms to #B6D0D5. That growing tick is the world's entire hover vocabulary for cards.
- **RENDEZ-VOUS SLOT CHIPS (OWNED TIC).** A \`repeat(auto-fill, minmax(84px, 1fr))\` grid, 8px gap, of real radio inputs whose labels are 2px-radius hairline chips (11px vertical padding, 0.875rem tabular numerals). Checked = filled teal, white text. Full = \`border-style: dashed\`, muted ink, \`text-decoration: line-through\`, \`disabled\`. A page that only ever offers free slots is lying.
- **THE HAIRLINE REGISTER.** Services are a table, not cards: \`minmax(0,1.32fr) minmax(0,.52fr) minmax(190px,.36fr)\` — name + one-line description, practitioner, a right-aligned duration-and-tariff cluster. 1px row rules, a 1px ink rule on top, a small-caps footnote row underneath. On hover the row fills #FFFFFF and a 10px teal dash scales in from the left margin.
- **THE COUNTED BAND.** One full-bleed deep band (#0E2731) per page: the ECG trace at 2px in lifted teal, 3–5 counted facts in the display serif, separated by 1px rules at 22% ink-light. The page's only tonal event.
- **PHOTO PLATES, ONE BLED.** Photographs sit in hairline plates. Exactly ONE per page bleeds off a single viewport edge (\`margin-right: min(0px, calc((var(--wrap) - 100vw)/2 - var(--pad)))\`, border dropped on that side, radius \`2px 0 0 2px\`); the rest sit inside the grid, hairline meeting the hairline of whatever stands beside them. Never centred, never full-bleed both sides, never with type on top.
- **SMALL-CAPS FURNITURE.** Every label: body face 600, 11px, 0.14–0.15em tracking, uppercase, deep teal on light ground, lifted teal on the deep band; section labels sit on a flex row whose \`::after\` is a 1px rule running to the container's right edge.

## Color physics
- GROUND: the #F7FAFB / #F5F9FB / #F8FBFC register — white with a drop of cyan, never warm, never pure #FFF.
- PLATE: pure #FFFFFF, only for cards, forms and hovered register rows. Ground-to-plate contrast is deliberately tiny (5 RGB points); that near-invisible step is what makes the page feel clean rather than empty.
- QUIET: #EAF1F3 / #E7EFF1 — one or two full-width bands per page (the engagements, the FAQ). The page's only mid-tone.
- INK: #12303B, never black. Secondary text #4E6975, tertiary and captions #5F7B85 (never lighter — at 11px uppercase this is the contrast floor). Hairlines #D7E3E7, inner hairlines #E4EDEF.
- TEAL: one family per site from the #1B8A93 / #17797F / #22929B register, with a deep #146A72 and a LIFTED #4CB3BB used only on the deep band. Budget, strictly: CTAs, links, labels, corner ticks, the ECG trace, the checked chip, one accent word per hero headline, the engagement kickers. The bright teal fills and strokes; every 11px small-caps LABEL takes the deep #146A72 instead — tracked 11px at #1B8A93 falls under 4.5:1 on this ground, and the world does not ship unreadable furniture. Never a teal panel, never teal body text, never two teals side by side.
- DEEP: #0E2731 (or #12303B for softer) for exactly one counted band plus the footer. Ink inverts to #F1F7F8 with #9DB6BC support.
- ZERO GRADIENTS. No overlay washes, no tinted scrims, no glow. Light here comes from the photographs.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · TEAL→--primary · PLATE→--primary-foreground · QUIET→--secondary · DEEP→--accent · ink at 72%→--muted · ink at 12%→--border · 2px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: a text-weight transitional serif — **Source Serif 4** (default), Petrona, or Faustina; one per site, weights 400 and 600 only. NEVER italic: emphasis is the teal or nothing. h1 \`clamp(2.5rem,5.5vw,4.5rem)\`/1.04, tracking −0.022em, capped 15ch. h2 \`clamp(1.9rem,3.3vw,2.95rem)\`/1.1, −0.018em. Card and row names 1.15–1.45rem. The display face also sets prices and counted numbers — numerals are content here, so they get the good face and \`font-variant-numeric: tabular-nums\`.
- BODY: **Public Sans** (default), Be Vietnam Pro, or Instrument Sans. 400/500/600. Lede \`clamp(1rem,1.15vw,1.125rem)\`/1.7 capped 52ch; body 1rem/1.65; meta 0.875rem; captions 0.8125rem.
- LABELS: body face 600, 11px, uppercase, 0.14–0.15em tracking — the only uppercase on the page.
- h1 and h2 carry \`text-wrap: balance\` with a \`max-width\` in ch (15–19ch) as fallback, so no headline leaves an orphan word on its first line. Display type never exceeds 10vw. No mono anywhere — this world does not speak machine.
- ARABIC PAIRING (if the page serves AR): Noto Naskh Arabic for display and body, +6% size, line-height 1.9, tracking 0 (never letterspace Arabic); labels lose tracking and gain weight instead; the ECG mirrors with the layout, its beat still reading left-to-right.

## Signature art — the photography, and the drawn line
Drawn art and photography coexist here because the drawn part is STRUCTURE, not illustration: the ECG is furniture, the photographs are the only pictures.
- ART DIRECTION PHRASE, verbatim in every generation: "clean modern medical clinic photography, cool soft daylight, white and pale teal tones, calm, orderly, no people, no text". Rooms and details only: corridors, waiting rooms, consulting rooms, an instrument tray, a window. NO faces, NO signage.
- GRADE, applied to every photograph as law: \`filter: saturate(0.92) contrast(1.03) brightness(1.02)\`. Cool, lifted, undramatic.
- FRAME LAW: 1px #D7E3E7 hairline, 2px radius, corner tick, small-caps caption underneath naming a place and an hour ("SALLE D'EXAMEN 2 — AILE OUEST, 11H20"). Ratios: 3:4, 4:5, 1:1, 16:11, a free height (\`min(68vh, 660px)\`) when the plate bleeds off an edge, and GRID-LOCKED — the plate spans two card rows (\`grid-row: span 2\`, plate \`flex:1\`) so its foot rules with theirs. Forbidden: 21:9 letterbox, ovals, arches, circles, deep-rounded masks.
- Text NEVER sits on the photograph: beside it, or on a white plate over a quiet zone of it.
- THE ROSTER LAW: three to five photographs per page, and EVERY FILE IN \`demo/assets\` IS PLACED — an unused asset is a build error, not a taste decision. One per movement, never two in adjacent sections, never a second crop of the same room (that reads as a stock loop), a different ratio each time. The demo's four: the corridor bled in the hero (the image sized \`width:136%; max-width:none; object-position:50% 46%\` so the vanishing point carries the frame instead of a bare wall), the consulting room grid-locked among the practitioner cards, the instrument tray at 1:1 closing the engagement column, the waiting room at 16:11 topping the hours plate.
- A photograph earns its place by finishing a column: its foot, or its caption's, lands on the foot of the block beside it. A plate aligned to nothing is decoration.
- BUTTONS: filled teal, 2px radius, 13px/20px padding, 0.875rem/500 body face, hover #146A72. Ghost = transparent with a #D7E3E7 hairline turning teal on hover. No icons inside buttons, ever.
- FORMS: ground-filled #F7FAFB fields with a 1px hairline that turns teal and fills white on focus; small-caps labels above; the phone field \`type="tel" inputmode="tel"\` with a local placeholder; structured choices as \`<select>\`; the slot grid as centrepiece. One off-canvas decoy input carries \`data-wandit-hp\`, untouched by the page's own script. On valid submit, dispatch \`wandit:lead\` on \`document\` with the visitor's fields flat in \`detail\` (nom, telephone, specialite, jour, creneau, motif…), then replace the form with an HONEST success plate: who calls, on which number, by when, what to do if nobody calls.
- Beside the form, one column: the waiting-room plate, then a hairline info plate — opening-hours table (days left, hours right, tabular numerals), address, and a "what to bring" list whose bullets are 9px teal dashes.

## Page chassis
- Container 1240px, side padding \`clamp(20px,4vw,56px)\`, section rhythm \`clamp(3.75rem,7vw,6.25rem)\`.
- HEADER: sticky, 66px, ground at 94% with a 1px bottom hairline. Wordmark = a 26px ECG glyph + the practice name in the display serif + a small-caps descriptor; then thin nav links, the phone in tabular numerals, one filled teal CTA. Under 1080px the links go; the phone and the CTA never do.
- FIXED OPENING: an asymmetric hero, roughly 1.06fr / 0.94fr. Left: small-caps location line, the promise as an h1 with ONE teal word, a 2–3 sentence lede, two CTAs, a three-cell hairline meta strip (rules top AND bottom, \`margin-top:auto\`) pinned to the column's bottom. The text column carries \`padding-bottom: 26.5px\` — the caption block's exact height — so the strip's bottom rule lands ON the plate's foot, not near it. Right: the plate, bleeding off the right edge. Under the hero, the vitals line, full width.
- FIXED CLOSING: the booking section (form + photo + info plate), a compact FAQ, then a deep footer opened by a vitals line — wordmark at \`clamp(2.1rem,4vw,3.4rem)\`, four meta columns (adresse / contact / sections / mentions — agrément, ordre, non-smoking), a hairline bottom bar. Below 1080px the footer is the only navigation, so it is not optional.
- FREE MIDDLE — compose 3–5, never two adjacent alike: the hairline register of acts with durations and tariffs · the counted deep band (the scrubbed showpiece) · the practitioners as flat cards beside a sticky title column, one cell given to a photographic plate · THE ENGAGEMENTS — a quiet band, 4–6 rows pairing a small-caps kicker (Le délai · Le tarif · Le dossier · L'ordonnance · Le doute) with one 1.15–1.6rem serif sentence · a plateau-technique or protocol list · the FAQ, full width under a two-column head, native \`<details>\` in two columns with a hairline + / − mark.
- Sticky-title-column-beside-a-list is rationed: TWO per page maximum, never two in a row; a third runs full width under a two-column head.
- Every section opens with the same furniture: small-caps label, rule to the right edge, then the h2. That repetition is the world's calm.
- Below 900px a stacked title column becomes a two-column head — h2 left, paragraph right — never a half-empty band.

## Motion identity — CALM PULSE
- Gate everything on \`(window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches)\`. Hidden states exist ONLY in \`gsap.set()\`; with JS dead the page is complete and readable.
- Entrances: \`opacity 0 → 1, y 12–14 → 0, 0.6s power2.out\`, stagger 0.075s, \`start: "top 88%"\`, \`once: true\`. The hero runs one timeline with a 0.12s delay; its photograph fades over 0.85s from y+18. Nothing scales, slides sideways or overshoots — power and sine families only.
- The vitals lines draw on entry: strokeDasharray = path length, 1.5s power1.inOut.
- THE SHOWPIECE (one per page): the vitals line drawing across the counted band, \`scrub: 0.6\`, pinned above 900px for \`+=110%\` from \`start: "top 66px"\` — the sticky header's height; at \`top top\` the band's own label hides behind the header for the whole scrub. At each QRS complex a fact lands: the block lifts from 14% opacity to 1 and its number counts up from 0 (0.7s power1.out, thousands separated by a space) at \`0.35 + i × 0.92\` on a 4.5s timeline. Below 900px there is no pin and no pinned time to spend: \`start "top 82%", end "bottom 92%"\`, stagger COMPRESSED to \`0.3 + i × 0.5\` so the last figure is true by 56% of the range, before the band is fully on screen. The final numbers are in the HTML; the animation only replaces them while it runs.
- One 6s heartbeat, only one: a JS-created 1px teal ring in the hero CTA scales 1 → 1.09 while fading 0.55 → 0 over 1.4s, \`repeatDelay: 4.6\`. Nothing else loops.
- Hover: 0.18–0.24s. Card ticks grow, register rows fill white, chips take a teal border, links a teal underline. Every hover has a keyboard twin (\`:focus-within\`, \`:focus-visible\` at 2px teal with 3px offset).
- Reduced motion: no timeline runs; traces fully drawn, counted facts at full opacity with their real numbers, the page simply still. That still page must be publishable as-is.

## Ban list (in addition to the global ban list)
- CLAIR's soft-shadow floating cards, duotone spot illustrations and pill-tab feature switcher — SERMENT's cards are flat, hairlined and ticked.
- ECLAT's warm golden grade, photo-orbit statement, capsule glyph-badges and 28–48px deep-rounded photo masks.
- VERRE's frosted glass panes, prism orbs and ticker pills. No backdrop-blur surface except the 6px on the sticky header.
- GUIMAUVE's puffy blobs, squash-and-stretch and ≥1.7 overshoot; ONDE's steam veils, pebble-stack glyphs and ritual numerals in hairline circles; GABARIT's dimension lines and title-block cartouche; CAMPUS's enrollment stepper rail with a filling connector; MAISON's caption plinths; HORIZON's cross-crop horizon lock; GÉNÉRIQUE's 21:9 letterbox and Ken-Burns scrubs; MATIÈRE's arches and page grain; CINÉTIQUE's telemetry captions and difference chrome.
- Any box-shadow. Any gradient. Any border-radius above 3px. Any glow, blur or glass panel.
- Medical clip-art: green crosses, caducei, stethoscopes, heart-with-pulse logos, tooth and pill icons — and icon-feature-card rows of any kind.
- Stock humanity: smiling patients, white-coat handshakes, gloved hands holding a tablet, photography under a dimming overlay with centred white type.
- Italic anything. Uppercase running text. Centred paragraphs. Mono type.
- Unverifiable comfort ("votre santé, notre priorité"), fake scarcity ("plus que 2 créneaux"), any price hidden behind "sur devis" when the practice has a tariff.
- Leaving a supplied photograph unplaced and calling the gap a style decision.

## LES GESTES (moves menu)
**Le tracé.** The vitals line as furniture: closing the hero, opening a band, above the footer. Drawn once on entry, never looped; its beat compresses on narrow screens because the viewBox stretches — intended.
**La plinthe.** Align a rule of the layout to a rule of the picture, exactly — near-alignment reads as a miss, not a decision. The hero meta strip, pushed down with \`margin-top:auto\` and closed with a bottom hairline, lands its rule ON the plate's foot (the text column pays the caption's 26.5px as padding). Same move in the grid: a plate spanning two card rows ends its caption on the second card's foot.
**La plaque débordante.** One plate bleeds off a single viewport edge, hairline dropped on that side, height \`min(68vh, 660px)\` so the fold still shows the CTA and the meta strip.
**Le registre.** The tariff table, measured under Visual signatures; it replaces the "our services" card grid entirely.
**La bande grave.** The single deep band: counted facts and nothing else, hairline top rule, columns divided by 22%-opacity rules, a small-caps provenance line beneath ("registre du secrétariat — arrêté au 31 décembre").
**Les cartes à onglet.** Flat hairline cards whose corner tick grows on hover/focus — practitioners, protocols, equipment; never three-feature claims. Give one cell to a photographic plate spanning two rows.
**Les créneaux.** The slot-chip grid, two or three chips honestly marked full.
**Le serment.** Engagement rows: kicker in small-caps deep teal behind a 16px ECG glyph, one serif sentence per row on a quiet band, hairline-separated, signed at the foot of the title column.
**La colonne collante.** A sticky title column (\`top: 100px\`) beside a taller list; label, h2, one paragraph, a signature block — and a photographic plate when the list is long enough to leave the column short.
**Le repli.** The FAQ as native \`<details>\`, hairline-topped, a drawn + losing its bar when open, the first item of each column open on load. Run it FULL WIDTH under a two-column head once the page has spent its sticky columns.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**« Le couloir » — the polyclinic (the shipped demo).** Promise: the explanation. Hero: text left, meta strip on the column's foot, a corridor photograph bleeding off the right edge, the vitals line closing the viewport. Middle: the nine-act register; the counted band; practitioners in flat cards with an exam-room plate grid-locked among them; five engagements under an instrument-tray square; the booking form beside a waiting-room plate. Showpiece: the vitals line draws across the deep band while 12 400 / 18 / 9 / 4 500 land at each beat. Mood: institutional, unhurried, faintly proud.
**« L'ordonnance » — the dental practice.** Promise: the tariff. Hero: no photograph above the fold — a full-width headline over a three-column hairline table of what a first appointment costs, contains and lasts; the photograph arrives below as a bled plate. Showpiece: the treatment quote fills in, scrubbed — each line wipes left to right, the total counts up in the display serif, a note states what is not included. Mood: disarmingly transparent.
**« La garde » — the 24-hour pharmacy.** Promise: availability. Hero: a full-width 24-hour hairline rail across the top, current hour ticked in teal, headline below-left. Showpiece: the rail scrubs through the day — hour marks pass, services (comptoir, garde, livraison) lighting and dimming as their windows open and close. Mood: awake, practical, civic.
**« Le laboratoire » — the analysis lab.** Promise: the delay. Hero: a narrow centred column of pure type on white inside one hairline frame, no image in the first viewport; a quiet photographic band follows. Showpiece: a results sheet where reference-range bars draw left to right and each measured value lands inside its normal band with its unit. Mood: exact, cool, almost silent.
**« Le cabinet » — the single practitioner.** Promise: continuity. Hero: mirrored — a 4:5 portrait plate on the LEFT, text right, meta strip under the photograph. Showpiece: the consultation path — five hairline stops (accueil, examen, explication, ordonnance, suivi), one ECG spike travelling the rail, each stop's card arriving as it passes. Mood: personal, spare, senior.
**« Le plateau » — the multi-floor clinic.** Promise: proximity. Hero: the headline on a white plate overlapping the quiet upper-left zone of a wide waiting-room photograph, hairline meeting hairline. Showpiece: a vertical vitals line climbing a drawn floor directory — niveau 0, 1, 2 — lighting each floor's services as it rises. Mood: large, organised, calm under load.
**« Le suivi » — the physiotherapy practice.** Promise: progress. Hero: the headline set around a small square photographic inset dropped into the text block on the baseline grid, meta strip beneath. Showpiece: a recovery curve drawing week by week, milestone dots labelled semaine 1 → semaine 12, a note about individual variation. Mood: encouraging without one exclamation mark.
**« L'officine » — the neighbourhood practice.** Promise: the welcome. Hero: a twelve-column hairline grid — headline in columns 1–7, three flat cards (garde, ordonnance renouvelée, conseil) in 8–12, no photograph above the fold. Showpiece: the morning register empties — the day's twelve slot chips stacked in one narrow column, each filling teal then taking its strike-through as the scrub advances, a small-caps count climbing beside them on real figures (4 reçus à 10h00, 9 à midi, 14 à la fermeture). The owned chip becomes the scrub. Mood: neighbourly, exact, unglamorous.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or this world collapses into a template. FIRST, the FLATNESS: one stray box-shadow, one 12px radius, one gradient wash and the page becomes the free medical theme it exists to replace — grep the stylesheet before shipping. SECOND, the EVIDENCE: every service with a duration and a price, every practitioner with a registration number and consulting days, every counted fact with the date it was counted — and no counter still ramping when it can be read. A SERMENT page whose numbers were invented for decoration is a lie the visitor can feel. THIRD, the VITALS LINE: it must draw, divide, and carry the showpiece — without it the page is merely tidy.
The cheap details cost nothing: captions naming a place and an hour, two slot chips honestly marked full, the "what to bring" list, the footnote under the tariff table, the success message telling you what to do if nobody calls back, the corner tick growing 14px on focus. When in doubt, remove decoration and add a number.`,
};
