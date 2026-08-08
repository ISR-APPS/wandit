import type { DesignWorld } from "../types";

/**
 * HORIZON — the airy travel window.
 * Popular wave III. The premium travel-agency genre: white air, vast
 * destination photography, sun-gold accents. ATLAS is the DRAWN cartography
 * world; HORIZON is the PHOTOGRAPHIC window — no maps, no routes, no stamps.
 * Fuses with atlas (drawn geography under photographic destinations),
 * promenade (coastal season energy) and onde (calm water register).
 */
export const horizon: DesignWorld = {
	id: "horizon",
	name: "Horizon",
	family: "wanderlust",
	tagline: "Une ligne d'horizon traverse la page ; le pays défile dessus.",
	kind: "website",
	mood: ["airy", "sunlit", "wanderlust", "spacious", "factual"],
	energy: "medium",
	priceFeel: "premium",
	industries: [
		"travel agency",
		"tours & excursions",
		"vacation packages",
		"hotel",
		"guesthouse / riad",
		"camping / glamping",
		"airline / transport",
		"vacation rentals",
	],
	avoidFor: [
		"lawyer / law firm",
		"notary",
		"accountant",
		"medical lab / analyses",
		"general practitioner / cabinet",
		"aesthetic clinic",
		"general contractor",
		"electrician",
		"security company",
		"fintech product",
	],
	// atlas: the drawn map under the photographed country · promenade: the coast in
	// season · onde: the same calm water, held still.
	fusesWith: ["atlas", "promenade", "onde"],
	preview: {
		ground: "#FBFAF7",
		ink: "#1C2B3A",
		accent: "#E8A23C",
		fontFamily: "Ovo",
		sampleWord: "Horizon",
	},
	doc: `# DESIGN WORLD: HORIZON — the airy travel window

## Philosophy
This page is a WINDOW HELD OPEN ON A COUNTRY, not a website. You stand indoors in white air; the wall before you is cut away in clean rectangles onto a place genuinely far and genuinely reachable. Two facts define it. FIRST: one horizontal line — the horizon — governs the page. Every photograph is cropped so its dominant horizontal (sea line, dune crest, parapet, roof line, bridge deck) sits at the SAME height inside its frame, and a sun-gold rule extends that line out of the photographs, across the ground, through the type and through the footer wordmark. The page has a skyline. SECOND: imagery is 100% photographic, 0% drawn — no maps, routes, contours, compasses, illustrated icons. Every crop is a SQUARE or a wide panorama at 0 radius: the world's geometry is the window frame.
Impossible failure modes: the dark cinematic travel page (white air here; ONE deep band, carrying data); the scrapbook (nothing rotated, taped, stamped or torn); the brochure (no dimming overlay, no centred white type); the shrug (every number true — hours, degrees, months, kilometres, dinars).
Self-audit, all countable: (1) zero rounded media; (2) the rule appears in three places and one photo pair visibly shares it; (3) two sections open on a top third of empty ground; (4) every destination head carries three factual climate chips; (5) one scrubbed showpiece; (6) zero maps, routes, pins or compasses.

## The variation contract (why two HORIZON sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- Photographic imagery only, square-cornered, one shared grade; the horizon-line lock; the sun-gold rule as the only continuous ornament.
- Warm-paper grounds with vast white air; deep slate-blue ink; ONE rationed sun accent; at most one deep band.
- Climate chips on every destination head; the perforated boarding-strip CTA as the primary action.
- Glide-over motion: 1.4s power1.out lifts, one horizontal scrub, no bounce, no Ken-Burns.
- Every price in local currency, every duration in real hours, every season named by month.
CLIENT-OWNED — where siblings diverge:
- The exact hexes in each register (paper cooler #FBFAF7 or sandier #F7F2E9; accent sun #E8A23C, apricot #E0954A or hot noon #EFB13F).
- The display face within the register (Ovo / Fahkwang / Lustria-class low-contrast serif — ONE per site).
- The DRIVING GEOGRAPHY — le Sud, la côte, les hauts plateaux, l'archipel, la route — it chooses the photographs, the section order, the chip vocabulary and the voice.
- The lock height (20–38% — pick ONE and hold it), the strip's panel count, the section order beyond the fixed hero and contact close, and which geste carries the showpiece.
A page without a named geography is a stock template: name the country or coast FIRST, then let it choose crops and words.

## The vibe (voice)
Factual wanderlust in French. The agency knows the roads; it sells hours and seasons, not dreams. Short declaratives with a real number inside ("Djanet est à 2 h 10 de vol. Le reste, on le fait en 4×4."). Places named exactly — Grand Erg Occidental, Gourara, corniche jijelienne, Tadrart — never "des paysages à couper le souffle". Prices state what they include. One honest limit per page, as a promise not a boast ("huit voyageurs par départ, pas neuf"). No exclamation marks, no "évasion", no "expérience inoubliable".

## Visual signatures
- THE HORIZON-LINE LOCK (owned tic): a photo strip whose horizon continues across the crops. Each photograph sits so its dominant horizontal lands on the lock — 34% of the frame in the demo, 22% in the desktop hero, 30% in the mobile band — and a 2px accent rule (#E8A23C, box-shadow 0 1px 0 rgba(28,43,58,.16) so it reads on pale skies) runs the full strip width over the seams and out onto bare ground both sides. Seams: 3px of paper, never a gap. Second application: a destination GRID shares one line — give each card a different frame height (470 / 350 / 410px) and offset each column by calc(line - 0.34 * itsFrameHeight).
- THE LOCK ON A PHONE (law, not an omission): under 900px one shared line across a grid is impossible, so the shared rule is dropped and EVERY stacked frame draws its own 2px rule, same box-shadow, at its own lock — top:34% in the stacked grid, top:30% in the hero band. A phone showing a photograph with no rule on it, or a rule that only divides the headline, has lost the world.
- CLIMATE META CHIPS (owned tic): exactly three per destination head — température, saison, durée d'accès (26 °C · OCT–AVRIL · 1 H 45 DE VOL). 11px / +0.13em / caps / 600, 5px 9px padding, 1px hairline rgba(28,43,58,.13), radius 2px — RECTANGLES, never capsules. Only the first carries a 6px SQUARE sun dot. Data, never badges.
- PERFORATED BOARDING-STRIP CTA (owned tic): the primary button is a ticket — accent fill, ink text, 0 radius, a 14px notch in ground colour centred on each vertical edge, a 1px dashed tear rule before a 2-letter code at the trailing end. Ghost variant: transparent, hairline border, same notches.
- THE SKY QUOTA: two sections begin on a genuinely empty top third — ground, nothing else. Air is a component; even vertical density is failure.
- SQUARE-CORNERED EVERYTHING: photos, cards, deep band, form and the boarding strip consume var(--radius) directly — zero, the window frame stays cut. Chips alone take 2px; nothing else rounds.
- HAIRLINE DATA ROWS: durations, distances and prices in hairline rows (1px rgba(28,43,58,.13) tops), label left in tracked caps, value right in the display serif. Tables are real tables.
- THE WORDMARK ON THE LINE: the footer sets the name at clamp(3rem, 9.5vw, 8rem) with the accent rule crossing it at 60% of its height — the page ends on the horizon it opened with.

## Color physics
- GROUND A (paper): the #FBFAF7 / #FAF8F3 register — warm white, never pure #FFF, never grey.
- GROUND B (sable): 5–9 RGB points warmer and darker — #F2EDE4 / #F1EBDF. The ground must CHANGE at least every two sections — never three consecutive sections on one paper, and never two adjacent sections that share both a ground and a skeleton. That quiet alternation IS the rhythm; the demo runs paper · paper · sable · paper · deep · sable · paper. The contact section takes GROUND A so its boarding-pass card can be sable. No gradients on grounds, ever.
- INK: deep slate blue — #1C2B3A / #17273A. Body 100%, secondary #41566B, meta at 62%, hairlines 12–16%.
- ACCENT SUN: #E8A23C / #E0954A. Budget per viewport: the horizon rule, ONE filled CTA, chip dots, one active state. Never a fill larger than a button, never a wash, never on a photograph.
- DEEP BAND: exactly ONE per page, #16232F / #14212C, holding DATA (a season matrix, a fares table, a distance ledger) and never a photograph. Type flips to #F3F1EC, hairlines to rgba(243,241,236,.14–.18), the accent stays sun. Three-state cells: filled 26×13px accent block (idéal) · 1px accent-62% outline (possible) · 1px rgba(243,241,236,.22) line (hors saison), plus a real legend.
- Gradients exist in one place only: inside the photographs, where the sky already made them.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · ACCENT SUN→--primary · INK→--primary-foreground · GROUND B→--secondary · DEEP BAND→--accent · ink at 62%→--muted · ink at 13%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: a warm, low-contrast, small-serif face — Ovo / Fahkwang / Lustria / Faustina register, ONE per site, regular weight only. Hero clamp(2.55rem, 5.4vw, 4.9rem) / 1.045 / -0.012em; section titles clamp(1.85rem, 3.4vw, 3rem) / 1.12. Never above 10vw (fit-to-viewport headlines are another world's), never italic, never uppercase above 2rem.
- BODY: a humanist geometric sans — Be Vietnam Pro / Public Sans / Hanken Grotesk register, 300–600. Leads clamp(1.02rem, 1.2vw, 1.16rem) / 1.62, measure 56–58ch. Body 15.5–16.5px / 1.68.
- META CAPS: body face 600, 10.5–11.5px, +0.13–0.16em, uppercase, #41566B — eyebrows, chips, captions, table heads, nav. Never a decorative whisper on bare ground: every caps line labels a real thing. Section notes stay sentence case; three lines of tracked caps are unreadable.
- NUMERALS: prices, temperatures and durations in the DISPLAY face; the currency word (DZD) in the body face at 0.6em, tracked, ink 62%.
- Arabic pairing: Noto Naskh Arabic (Almarai for UI) at 1.06em of the Latin size; rule and chips identical, grid mirrored, Latin numerals kept.

## Signature art / components (the photographic system)
- SUBJECT LAW: vast landscape scale at golden hour — dunes, coast, ksour, gorges, palm groves, rooftops. No close faces, no text in-frame. One shared art-direction phrase generates every image so the set sits in one light: "cinematic travel photography of <country>, golden hour light, vast landscape scale, natural color, no people close-up, no text".
- GRADE LAW: every photo carries filter: saturate(1.06) and nothing else — no duotone (navy and red are other worlds'), no B/W, no dimming layer, no blur. Photos brighten to brightness(1.03) on hover/focus only.
- CROP LAW: SQUARE (1:1, punctuation beside type or in grids) and PANORAMA (fixed-height band, 240–520px, any width) are the two geometries; 3:4 portraits are allowed in destination grids and as full-bleed panels leaving the page on one edge. Radius 0 always.
- POSITIONING (the arithmetic — object-fit alone cannot lock a horizon): frame = position:relative, overflow:hidden, definite height. Image = position:absolute; left:50%; top:0; width:auto; max-width:none; height:calc(var(--k) * 100%); transform:translate(calc(-50% + var(--tx,0%)), var(--ty)). With f = the horizon's fraction of the source and L = the lock: --k >= max(L/f, (1-L)/(1-f), frameW / (frameH * imageAspect)), --ty = 100 * (L/--k - f) percent. --tx (a % of the image width) crops SIDEWAYS when the chosen horizontal runs across only part of the source: raise --k until the window is narrower than that run, then centre it with --tx. A rule floating over flat wall for half a panel kills the tic faster than a missed pixel — the demo's ksar takes its LOWER parapet (f 0.66 → k 3.4 / -56% / tx 12%) for exactly that reason. One source serves several locks: dunes (f 0.227) gives k 1.15 / -3.6% at L 0.22, k 1.5 / -2.73% at 0.30, k 1.75 / -3.4% at 0.34. Verify on a screenshot: eyeballed crops drift 10–15px.
- SEAM LAW: judge every JOIN, not every panel. Neighbours must meet on the line AND agree in light — a saturated cyan sky beside a hazy beige one reads as two photographs, not one country. Re-crop or reorder until each seam is one landscape.
- CAPTION LAW: every photo standing alone is captioned ON THE GROUND under it, 11px tracked caps at ink 62%, em-dash first, 11px clear — place + one true fact ("— GRAND ERG OCCIDENTAL · 17 H 40"). Never a plate over the image (those are MAISON's); in a travelling strip the captions form a rail moving with the panels, and a photo inside a titled card is captioned by that title and its chips.
- BUTTONS: the boarding strip for primary; text links extend a 1px accent underline from the left on hover AND focus-visible over 220ms.
- FORMS: the form IS a boarding pass — a card filled with the OTHER ground than its section (sable on a paper section, paper on sable) under a hairline border, notches punched in the SECTION's ground (16px) at 42% of its height on both edges, a 56px stub column (44px under 900px) behind a dashed rule carrying two holes and one line of rotated tracked caps, and a dashed tear rule above the submit. That stub code is the ONLY vertical type on the page — vertical labels on hairlines are WABI's. Fields are underlined, not boxed: 1px bottom hairline, meta-caps label above, 44px+ hit height, type="tel" with inputmode="tel", selects for destination and période. On valid submit dispatch wandit:lead on document with the fields flat in detail, plus one off-canvas decoy carrying data-wandit-hp the script never touches. Success replaces the card body with a reference code and the real delay ("réponse sous 24 h").
- CARDS: no shadowed cards exist. A "card" is a photo + a hairline + type on ground.
- Favicon: inline SVG data URI — paper square, sun-gold rule at 34%, a small accent square above it, a faint ink hairline at 72%.

## Page chassis
- Container 1240px, gutters clamp(20px, 5vw, 64px); panoramas bleed full width. Section padding clamp(5rem, 9.5vh, 8.5rem) top and bottom; hero and deep band set their own.
- HEADER: paper, not fixed, no blur, no shadow — display-serif wordmark, a hairline under the bar, nav in meta caps, a tel chip. It scrolls away and does not come back. Under 900px the nav does NOT become a burger or move to the footer: it becomes a second hairline row under the bar, one horizontally scrollable rail of the same meta caps (10.5px / +0.16em, 22px gaps, accent underline on hover and focus, a 26px mask fade at the trailing edge so the rail reads as continuing).
- FIXED OPENING (hero law): the page opens on a WINDOW — a SKY ZONE and a LAND ZONE divided by the accent rule at the lock height; the type lives in the land zone, the photograph holds its horizon on the same line. Demo geometry: hero box clamp(560px,84vh,760px), rule at 22% of it, type column max 620px against a photo bleeding off the right edge, a 3-item hairline fact row below. On mobile: type → photo band (clamp(260px,58vw,320px)) → facts, the band carrying its own redrawn rule under the phone-lock law. Which side the photo takes is client-owned; the rule crossing the composition is law. The hero always states place, promise and one number.
- FIXED CLOSING (contact law): the boarding-pass form beside a practical column (adresse, téléphone, agrément, horaires) and one photo; then the wordmark footer crossed by the accent rule.
- FREE MIDDLE — compose 3–5, never two adjacent alike in ground OR skeleton: (1) the DESTINATION GRID (geste LES TROIS DÉPARTS); (2) the SHOWPIECE strip or rail; (3) the DEEP DATA BAND; (4) the STEPS PANEL (geste LE VOLET); (5) the PROOF ROW — one static quote in the display serif with a square photo and three hairline numbers, the only social proof on the page; (6) the AIR BREAK (geste LA MARGE HAUTE).

## Motion identity (GSAP 3 + ScrollTrigger, CDN; gate everything)
GLIDE-OVER is the personality: long, level, unhurried movement, like watching a coast pass a window. Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state is set by gsap.set — never opacity:0 in CSS.
- Easings: power1.out for entrances (the long glide), power2.out for small furniture, sine.inOut for crossfades. 1.2–1.5s lifts, 0.5–0.7s chips and rows, 0.22s CSS hovers. Overshoot is banned wave-wide; nothing bounces, nothing snaps.
- Entrances: y +28 → 0 with opacity, 1.4s, stagger 0.09. Headline lines rise from a 100% offset inside an overflow-hidden mask. EVERY accent rule — hero, mobile band, footer cross — enters by scaleX 0 → 1 from transformOrigin left over 1.1s power2.out: the line always draws BEFORE the content it divides.
- Photo entrances: a clip-path WIPE — inset(0 0 100% 0) → inset(0 0 0% 0) over 1.4s power1.out (the window opening). NEVER a scale, NEVER a pan: Ken-Burns is another world's.
- THE ONE SCRUB: a horizontal travel. The showpiece section is min-height 100vh (the pin covers the viewport and never reveals the next section under it), pins at "top top", and the strip translates on x from 0 to -(track.scrollWidth - wrap.clientWidth), scrub 0.7, end "+=" that distance plus half a viewport, invalidateOnRefresh, with a 2px accent progress rule on the same trigger's onUpdate. The horizon rule never moves — the land moves under it. Panels: clamp(300px,58vw,680px) wide, clamp(240px,42vh,440px) tall. Below 900px the pin is dropped and the strip is a native scroll-snap panorama (overflow-x:auto is the CSS default; the script sets overflow:hidden only when it takes over), rule still locked, with a "faites glisser" hint — the designed mobile state, and what dead JS gets.
- Micro: chips stagger 0.06; data-matrix cells fade in on a left-to-right grid sweep of 0.012 per column (the year passing) — a fade, never a filling meter; the photo-brighten and underline-extend hovers of Signature art always carry keyboard parity.
- Reduced motion: everything at its final composed state, the strip hand-scrollable — still, not blank.

## Ban list (in addition to the global ban list)
- ATLAS's dotted travel route drawing itself, inked passport stamps and postmarks, topographic contours, compass rose — and beyond the tics: NO MAP OF ANY KIND, drawn, dotted or photographed from above with pins. Any rail HORIZON draws is a RULER, never a route: straight, horizontal, stop ticks and numbers only — no drawn path, no curve, no pins, no marker travelling along it. The moment a line acquires a destination it belongs to ATLAS.
- PROMENADE's awning-stripe canopies, ceramic street plaques, citrus-slice and parasol motifs.
- GENERIQUE's letterboxed 21:9 crops with hard black bars, Ken-Burns scrub, champagne foil small caps.
- WABI's sumi-e stroke, vertical writing-mode labels on hairlines, off-centre ma emptiness as the compositional idea (HORIZON's air is level and framed, not asymmetric void).
- ONDE's steam-veil transitions, pebble-stack glyphs, ritual numerals in hairline circles.
- DOMAINE's property meta strip pinned to a photo's bottom edge, its serif price plate on a photo corner, its dusk-grade law (HORIZON's chips are CLIMATE data in rectangles on the TYPE side, never a strip on the image).
- ECLAT's photo-orbit, capsule glyph-badges, deep-rounded warm-grade masks.
- MAISON's caption plinths and room-index sync; CAMPUS's timetable cards and stepper rail (the season band is a TABLE OF STATES, it never fills like a meter); STUDIO's per-item meta ledger.
- SILHOUETTE's type-over-photo collision; ELAN's photo-through-type; CAPITALE's navy duotone; FORME's red duotone.
- Rounded photo corners · parallax or scale on any photograph · glass panels · dark grounds beyond the one data band · logo marquees · drawn icons of any kind · display type above 10vw.

## LES GESTES (the moves menu)
1. LA FENÊTRE — the hero as a cut window: above the rule, only an eyebrow and a coordinate; below it the h1, lead, CTA and a hairline fact row; the photo panel bleeds off one edge with its horizon on the same rule.
2. LE PANORAMIQUE — the horizon-lock strip: 3–5 panels at one fixed height, 3px paper seams, one accent rule over all of them, a caption rail underneath; it travels on scrub or scroll-snaps by hand.
3. LA BANDE-SAISON — the deep data band: destinations down the left (a real table, th scope="row"), twelve months across (3-letter caps on desktop, single letters under 900px, first column clamp(96px,17vw,236px)), three honest cell states and a legend. The page's only dark moment, and it fits one 900px-tall frame.
4. LES TROIS DÉPARTS — the destination grid: 3–4 entries at staggered offsets and different crop shapes, each with three chips, a hairline duration-and-price row and a real link.
5. LE BILLET — the boarding strip at three scales: inline button, hero CTA, full-size contact card.
6. LE VOLET — a full-bleed portrait photograph leaving the page on one edge, 3–4 numbered steps beside it in the display serif on hairlines.
7. LA MARGE HAUTE — an air break: a section whose top 60% is empty ground with one sentence sitting ON the accent rule.
8. LE CARRÉ — a 1:1 crop as punctuation: beside a quote, in a grid cell, under a number; never captionless, the caption aligned to the crop's left edge.
9. LA COLONNE D'HEURES — a hairline table of real logistics: vol, route, altitude, permis — label caps left, display-serif value right, ONCE per page.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
LE GRAND SUD — a Saharan tour operator. Hero: type column left, tall photo panel right bleeding off the edge, the rule crossing the type and meeting the dune crest exactly. Showpiece: the four-panel horizon strip travelling on scrub while one rule holds still over erg, rooftops, cove and ksar. Mood: ochre air, long silences, hours and degrees.
LA CÔTE — a seaside hotel group. Hero: a full-width panorama band across the top, horizon locked at 32%, the h1 flush-left on paper BELOW it, booking chips right. Showpiece: the season matrix pinned and swept column by column, each month lighting its ideal cells as the year passes. Mood: salt light, blue-white, plainly seasonal.
LES HAUTS PLATEAUX — a guesthouse network. Hero: no photograph above the fold — a huge statement on empty ground, the rule at 62%, four square crops sitting ON the line like objects on a shelf. Showpiece: those four squares open one after another into full-bleed panoramas, chained clip-path wipes on a pinned scrub. Mood: high, dry, ceremonial.
LE VOL — a regional charter airline. Hero: portrait photograph LEFT, type RIGHT, the rule running right-to-left out of frame. Showpiece: the DEPARTURES BOARD — eighteen pinned hairline rows (ville, heure, appareil, état) writing themselves downward on scrub one whole row at a time, each row's état chip switching from a dash to EMBARQUEMENT as it lands; nothing travels sideways, no digit rolls (those are FORME's). Mood: crisp, punctual, sunlit tarmac.
L'OASIS — a desert camp. Hero: a narrow centred column of type flanked by two square crops hung at different heights, the rule passing through all three. Showpiece: three full-bleed panels sliding up one over another while the rule stays welded in place, scrubbed. Mood: green shade in a red country, water as the promise.
LA TRAVERSÉE — self-drive road journeys. Hero: words first — h1, lead and a hairline étape ledger (étape, km, heures) on bare paper, then a single panorama ENTERING from the bottom of the first screen and running past the fold, horizon on the rule; the visitor reads a distance before seeing a landscape. Showpiece: a kilometre rail — one hairline with stop ticks, photographs hung alternately above and below it, the rail travelling on scrub — a RULER under the ban list's clause, never a route. Mood: engine-warm, practical, distance as pleasure.
LES ÎLES — vacation packages. Hero: a 2×2 grid of square crops with the type in the empty top-left cell, one rule crossing all four at the shared horizon. Showpiece: a single pinned frame that WIDENS on scrub — clip-path opening from both sides to full bleed, horizon locked, chips sliding in. Mood: bright, plural, holiday-plain.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or the world collapses. THE LOCK: the horizons must actually meet — measure the fraction, do the arithmetic, check every seam at 390px as well as 1440px; horizons 20px apart look like a slideshow. THE AIR: the sky quota is what makes photographs read as windows instead of wallpaper; even density is a brochure. THE TRUTH IN THE NUMBERS: 2 h 10 de vol, 24 °C, novembre–mars, 96 000 DZD, huit voyageurs — every chip, table and price defensible, because here specificity IS luxury.
The cheap details that separate it from a generated page: the 3px paper seams, the square sun dot on the first chip only, notches falling exactly on the ground colour (set --notch per section so they never show the wrong paper), the caption naming a place and a real hour, the dashed tear rule above the submit, the reference code in the success state, and the footer wordmark cut in half by the line that opened the page. When in doubt, remove a paragraph and let the sky have it.`,
};
