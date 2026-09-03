import type { DesignWorld } from "../types";

/**
 * PROMENADE — the seaside promenade.
 * Family: promenade. Cream ground, marine-blue serif elegance, awning-stripe
 * canopies crowning sections, painted-ceramic street plaques naming
 * everything, citrus and parasols rationed like jewelry. Holiday light with
 * linen manners. Proven against the Hôtel Les Sirènes demo (hotel, Béjaïa,
 * DZD, French); every value in the doc was shipped there.
 * fusesWith rationale — zellij: glazed tiles meet the sea — Mediterranean
 * hospitality; atlas: the route reaches the coast — seaside travel.
 */
export const promenade: DesignWorld = {
	avoidFor: [
		"dev tool",
		"garage / mechanic",
		"security company",
		"lawyer / law firm",
		"crossfit / functional",
	],
	doc: `# DESIGN WORLD: PROMENADE — the seaside promenade

## Philosophy
This page is A SEASIDE PROMENADE AT ELEVEN IN THE MORNING — cream stone underfoot, a marine-blue serif that speaks like good hotel stationery, striped awnings shading the shopfronts, enamel street plaques naming every door. Not a beach party, not nautical kitsch: the elegant seafront of a small Mediterranean town, where joy wears linen. First structural fact: AWNING-STRIPE CANOPIES ARE ARCHITECTURE — vertical azure/cream stripes hung from a rail and finished in a scalloped hem, crowning 2–4 sections per page like shop awnings crown façades. Every stripe on a PROMENADE page is vertical, railed and scalloped; a stripe used any other way (diagonal divider, texture fill, angled band) is a foreign accent and a failure. Second: PAINTED-CERAMIC STREET PLAQUES are the labeling system — every label, badge, section number and name tag is an enamel tile with a marine border and four corner screws, as if unscrewed from a wall on the corniche. Third: imagery is DRAWN SEASIDE SCENES — flat layered CSS/SVG bands of sky, sea, sand, parasols, cabines and gulls; zero photography, zero 3D. Fourth: CITRUS AND PARASOLS ARE JEWELRY — lemon appears at most three times per page, parasols only inside scenes or as a small wordmark glyph; abundance would turn the promenade into a placemat. Structurally impossible failure modes: the candy-colored kids page (marine ink and the lemon budget forbid it); the anchor-and-rope fish-restaurant template (banned outright); the gradient-washed startup hero (gradients live only inside drawn scenes). Self-audit before shipping: lemon moments ≤ 3; every stripe on the page vertical + railed + scallop-hemmed; 2–4 section canopies exactly; every plaque carries its 2px border and 4 corner screws; zero raster photographs; no idle sway exceeds 2°.

## The variation contract (why two PROMENADE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- The three tics: awning-stripe canopies crowning sections, ceramic street-plaque labels, the citrus + parasol ration.
- Cream ground / marine ink color physics, the ONE deep-marine interlude where cream and marine swap, the ≤3 lemon budget.
- The serif register (DM Serif Display / Prata), the single italic welcome line, Figtree body, never more than one italic moment per page.
- Drawn flat seaside imagery; scallops belong only to canopy hems and sea-wave rows.
- Breeze-sway motion personality (gentle rotate/translate loops, nothing bounces, nothing snaps) and ONE promenade-family scrubbed showpiece.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- Exact hexes inside the registers (a paler azure, a deeper marine, a warmer cream) and where the three lemon moments are spent.
- The display face within the register: DM Serif Display OR Prata, one per site.
- The HOUR that drives the page — le matin, la sieste, l'heure dorée, la saison — naming the hero scene's light, the copy temperature and the showpiece's sky.
- The coast drawn: lighthouse or port, calanque or corniche, which cabines, which town's plaques; the section order beyond the fixed opening and closing; which 2–3 gestes are played; the showpiece variant within the promenade family; the language (French, Arabic, English).
A PROMENADE page without its hour is a failure: name it FIRST, then let it choose the light, the scenes and the words.

## The vibe (voice)
French holiday-elegant: short declaratives with linen manners, concrete hospitality, zero exclamation marks, zero superlatives ("le meilleur" is banned — say what is true instead). Examples of the register: "L'été a une adresse." · "Chambres côté mer, petit-déjeuner sous l'auvent." · "120 mètres de sable, transats et parasols compris." The ONE italic line is the welcome, warm and human: "Bienvenue aux Sirènes — la mer fait le reste." Prices and facts are stated plainly on plaques; the sea is never described with adjectives it does not need.

## Visual signatures (what makes it instantly recognizable)
- THE CANOPY (owned tic): a full-width awning crowning a section — height clamp(40px, 5vw, 64px); vertical stripes alternating azure #1F6098 and paper #FDFCF7, stripe width clamp(22px, 3vw, 40px); a 4–5px solid marine rail bar along the top edge; the bottom hem is a row of half-circle scallops whose radius equals half the stripe width, so every stripe ends in exactly one scallop. Built as inline SVG (pattern fill + arc path) for crisp hems. 2–4 per page; the deep interlude's canopy inverts to marine #0F2E52 / cream stripes.
- THE PLAQUE (owned tic): an enamel street tile — ground #FDFCF7, 2px solid #143A66 border, radius 10–14px, an enamel sheen as inset 0 1px 0 rgba(255,255,255,.8), and FOUR corner screws: 3px marine dots at 45–60% opacity, inset 7px from each corner. Name plaques set in the display serif at 1–1.4rem; label plaques in Figtree 600 uppercase 11–12px, +0.08em tracking. The majolica variant (marine ground, cream text) marks numbers and lives in deep sections. Plaques never tile into fields — one plaque names one thing.
- CITRUS + PARASOL (owned tic): the lemon slice — flesh #F2D14E, rind ring #D9B93A at 8% of the diameter, eight cream pith lines at 2px, diameter register 22–64px — at most THREE per page, placed like jewelry (beside the italic welcome, marking one menu line, sealing the form's success). The parasol — six gores alternating azure/paper, scalloped hem, 2px marine pole, finial dot, planted at a 4–10° tilt — lives inside drawn scenes and may appear once as a wordmark glyph.
- Marine serif headlines on cream, with exactly ONE italic welcome line per page in the display's true italic.
- Hairline system: 1px rules in rgba(20,58,102,.16); dotted leaders (2px dots, 6px gaps, 35% opacity) tie names to prices in menus and fact tables.
- Scallop discipline: the scallop exists in exactly two places — canopy hems and drawn sea-wave rows. Never as a generic section divider, never on cards.
- Drawn scene bands: flat layered horizons (sky gradient → sea → sand) with parasols, cabines, gulls, one landmark; single flat darker-tone shadow ellipses, no blurs, horizon always level.
- Gulls: two joined arc strokes, marine, 2px, 18–36px wide, opacity .55–.8, at most a handful per scene, drifting slowly.

## Color physics (instantiate with the brief's hexes — the physics is law)
- GROUND: the cream register #FBF8F1 / #F7F2E6. Plaques and stripe whites sit slightly brighter at #FDFCF7 so enamel reads against stone.
- INK: marine, never black — the #143A66 register, deepening to #0F2E52 for the interlude ground and canopy inversion.
- AZURE: #1F6098 / #2E7CC2 — the sea, the stripes, links, active states, secondary buttons. Azure is water: it may fill scenes generously but never grounds a text section.
- LEMON #F2D14E: at most THREE moments per page, always as a drawn citrus element or a ≤4px accent seam — never a ground, never a text color, never a button fill. The lemon budget is countable in the self-audit.
- FOAM: #EAF2F8 / #CFE3F2 — sky tints and scene washes only; never a card background.
- SAND: #F3E9D2 / #EFE3C8 — beach bands inside scenes and the occasional table-row tint.
- ONE deep-marine interlude per page: ground flips to #143A66/#0F2E52, text to cream, plaques to the majolica variant. Exactly one; the page returns to daylight after it.
- Gradients exist ONLY inside drawn scenes as sky or sea (vertical, 2-stop, within the foam/azure registers) — never on sections, cards, buttons or type. The sun in a scene is pale straw #F5E8C6, never lemon (the sun is not a citrus moment).

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · INK→--primary · GROUND→--primary-foreground · FOAM→--secondary · AZURE→--accent · ink at 82%→--muted · ink at 16%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, wash or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: DM Serif Display OR Prata (Google Fonts), one per site, weight 400 only. Marine ink on cream, cream on marine. Display only above ~1.6rem.
- THE ITALIC LAW: exactly ONE line per page in true italic — the welcome — set in DM Serif Display Italic (Prata has no italic; the welcome borrows DM Serif Display Italic even on a Prata site), clamp(1.15rem, 2vw, 1.5rem), marine. Never an italic word inside a roman headline, never italic prices, never a second italic moment.
- BODY: Figtree 300–600. Body text 1rem–1.0625rem, line-height 1.6–1.7, marine at 100% (long paragraphs may drop to 82% opacity). Paragraph measure 58–68ch, always left-aligned.
- Hero statement: clamp(2.7rem, 6.5vw, 5.6rem) when the headline owns the full width; in a split hero (LE BALCON) drop to clamp(2.7rem, 4.8vw, 4.4rem) so two lines fit the portside column. Line-height 1.02–1.08, tracking -0.01em. Section titles clamp(1.9rem, 3.8vw, 3.3rem). Big numerals (stats, prices) get the display face at clamp(2.2rem, 4vw, 3.6rem).
- Labels: Figtree 600, uppercase, 11–12px, +0.08em tracking, ALWAYS inside a plaque — never floating letter-spaced whispers on bare ground.
- Prices: display serif numerals + Figtree currency ("18 500 DA"), joined to their names by dotted leaders.
- ARABIC PAIRING: Arabic pages set display in Amiri 700, body in Cairo 300–600; the italic welcome becomes an Amiri line with the azure accent instead (Arabic has no italic). Plaque and canopy laws unchanged.

## Signature art / components
- SCENES are layered flat construction, back to front: sky (2-stop vertical gradient in the foam register, optional straw sun disc) → sea (azure band with 2–3 rows of scalloped wave strokes in cream at 25–45% opacity) → sand (#F3E9D2) → balustrade or promenade line → objects: parasols, cabines (striped boxes with pitched or awning roofs and plaque numbers), a landmark (lighthouse, jetty, kiosk), boats as hull + triangle sail, beach furniture (transats as an azure canvas polyline over marine legs, solid towels, café tables with two wire chairs, a beach ball) → gulls. Keep the sky lean — in a wide promenade scene the sky band takes ~200 of 620 viewBox units, never half the frame; the band below the horizon is where the drawing budget is spent. Flat elevation only; shadows are single flatter-tone ellipses. Every scene carries role="img" and a real aria-label in the page's language.
- CABINE CARDS: offer/room cards built as beach cabins — paper ground, 1.5px marine border, radius 12px 12px 4px 4px, crowned by a mini-canopy (6–8 scallops, same construction as section canopies), a name plaque, detail lines, price with dotted leader. One card in a row may sit offset 2–2.5rem lower on desktop.
- BUTTONS: filled marine pill — buttons, chips and pills consume var(--radius) directly — cream text, Figtree 600; hover deepens to #0F2E52 and lifts 2px. Secondary: 1.5px marine outline pill, marine text, hover fills foam. Links: azure, underline offset 3px; hover shifts to marine.
- FORMS — LE KIOSQUE: the form dresses as a beach kiosk under its own canopy. Fields on paper inside 1.5px marine-bordered boxes (radius 10px), labels as small plaques or Figtree 600 caps, azure focus ring. Phone-first: tel input leads, correct inputmode; the kiosk intro column carries the hotel's phone as a plaque link so the number is one tap away from the form. Success state is honest and drawn — the third lemon moment may seal it ("Votre demande est bien arrivée — nous vous rappelons avant ce soir."). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail; include one off-canvas decoy input with data-wandit-hp that the page's own script never reads or writes.
- ::selection azure ground / cream text; :focus-visible 2px azure outline offset 3px. Decorative SVG aria-hidden. Favicon: inline SVG data URI — a striped parasol on cream.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 8rem). Content grids cap at 1200px; scene bands and canopies bleed full width. Zero horizontal overflow at 390/768/1440.
- HEADER: cream, 1px hairline below; serif wordmark with an optional small parasol glyph; nav in Figtree 500; the phone number as a small plaque.
- FIXED OPENING (hero law): the hero wears a canopy OR opens on a drawn scene (at least one of the two), contains the page's ONE italic welcome line, one plaque (address or label), and a real CTA. Never a centered stock-photo hero; never a gradient wash.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: the facts band (display numerals + plaque labels between hairlines) · the promenade showpiece (scrubbed, spec below) · a cabine-card row · the deep-marine interlude (menu, evening offer, or manifesto with majolica plaques) · a scene band with overlapping staggered plaques · a menu/tariff table with dotted leaders.
- FIXED CLOSING: le kiosque form under its canopy, then a marine footer: horizon hairline in cream at 30%, one drifting gull, address/hours plaques, plain-text phone. No giant footer wordmark — the promenade ends quietly, at dusk.

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs; gate on gsap && ScrollTrigger && !prefers-reduced-motion)
THE GOVERNING LAW: every hidden state is set via gsap.set, never in CSS — JS dead leaves a complete sunlit page. PROMENADE's personality is the BREEZE: gentle rotate/translate loops, as if everything hangs in light wind. Nothing bounces, nothing snaps, no overshoot ease anywhere.
- Idle sways: parasols rotate ±1.2–1.8° (transform-origin bottom center), 4–7s, sine.inOut, yoyo, desynced by 0–2s random delays. Gulls drift x ±24–40px over 9–14s. Canopies breathe at skewX ±0.5°, origin top, 6–8s. NOTHING sways more than 2°.
- Entrances: rise 24–30px with a -0.6°→0 rotation settle, power2.out, 0.8–1.0s, staggers 90–130ms. Scene layers arrive back-to-front (sky → sea → sand → objects) over ~1.2s.
- THE SHOWPIECE — LA PROMENADE (one per page, scrubbed): a drawn seafront pans HORIZONTALLY as the visitor scrubs, pausing at ceramic plaques that introduce each offer like stops on the boardwalk. The scene is 260–320vw wide (floor it near 2400px on small screens so the drawn objects keep their proportions); the pinned stage stands min(76svh, 700px) tall — min(62svh, 540px) under 820px — and pins center-center so the leftover cream splits evenly above and below; the pin runs 200–260% of viewport; the timeline holds a ~12% plateau at each stop while the stop's plaque activates (lift + azure ring + majolica number). EVERY STOP IS FURNISHED: the stop's own architecture stands 45–55% of the scene height (a kiosk with its scalloped awning and sign, a cabine group, the lighthouse on its headland) and at least three supporting objects populate the stop's visible window — café tables and chairs under the awning, a jetty with a moored boat, transats and towels beside the parasols, sailboats on the sea; a plateau that frames empty sky, bare sea and blank sand is a failed frame and fails the audit. Place each stop so its plaque sits fully inside the visible window at its plateau at EVERY width — recompute the stop percentages for the narrow track — and on desktop offset the plaque BESIDE the stop's architecture (it may cover the facade only under 820px, where the plaque is the content). Offer content ALSO lives in normal flow so a dead-JS page reads completely. Variants within the family: the pan with stops, the day-cycle on one fixed scene, sequential departures, doors opening in sequence, a rising tide, a towed banner — one per page, always linear-scrubbed, never auto-playing.
- Hovers: 200–280ms ease; plaques lift 3px and tilt -0.8°; cards raise their mini-canopy scallops 1px; buttons deepen. Keyboard/touch parity for every hover.
- Reduced motion: all loops off, entrances instant, the showpiece rests at its most composed frame with every stop's content readable.

## Promenade ban list (in addition to the global one)
- Tessellated tile patterns, glazed-tile grids, tile-chip navigation — that is ZELLIJ's language; PROMENADE ceramics are single PLAQUES, never pattern fields.
- Candy-stripe diagonal divider bars, puffy blob containers, back.out bounce entrances — that is GUIMAUVE's language; PROMENADE stripes are vertical awning architecture and nothing ever bounces.
- Boxed drop caps, double-filet rules, the single italic accent word inside a roman headline — that is VELIN's language; PROMENADE's only italic is the full welcome line.
- Passport stamps, postmarks, dotted self-drawing travel routes, contour-line backgrounds, compass roses — that is ATLAS's language.
- Chrome/metal text, glossy orbs, specular bevels, lens flares — that is AN2000's language; enamel shines with one 1px inset line, never gloss.
- Arch-topped frames, arch pills, arch buttons — that is MATIÈRE's geometry.
- Soft-shadow floating cards (CLAIR's) and hard offset shadows (BLOC's) — PROMENADE casts almost no shadows: hairlines and flat shadow ellipses inside scenes only.
- Photography, stock imagery, photoreal render — the coast is drawn or it is not shown.
- Nautical kitsch: anchors, ropes, life buoys, ship wheels, fishing nets.
- Stripes at any angle other than vertical; stripes as texture fills behind text.
- Lemon beyond the three-moment budget; lemon grounds; lemon text.
- Backdrop-blur and glass panels (VOLTAGE's); marquee ticker strips (CINÉTIQUE's) — the promenade moves by scrub only.
- Auto-playing carousels; parallax deeper than the scene's own layered pan.
- More than one deep-marine section; a page that ends without returning past daylight cream.

## LES GESTES (moves menu)
1. LE BALCON — split hero: text column portside (headline, italic welcome, plaque, CTA), a tall drawn seafront starboard, bleeding to the viewport edge. The canopy crowns the whole section width.
2. LA DEVANTURE — shopfront hero: a full-width canopy crowns a centered serif wordmark and welcome, with a wide scene band below the fold line, like standing across the street from the shop.
3. LE FRONT DE MER — the classic showpiece: the 260–320vw promenade pans on scrub past parasols, cabines and the landmark, holding at 3 plaque stops that introduce offers.
4. LA JOURNÉE — showpiece variant: ONE fixed scene scrubbed through the day — sky and sea retint from morning foam to golden hour, parasols open, gulls cross — each hour introducing one offer.
5. LES CABINES — a row of 3–5 cabin cards, one offset lower; mini-canopy roofs, plaque names, dotted-leader prices. On hover/tap a cabin's doors part 8px to show its interior tint.
6. LA MARÉE — the deep-marine interlude: cream serif on marine, majolica plaques, the inverted canopy; optionally scrubbed as a tide line rising to reveal rows one by one.
7. LA BANDEROLE — showpiece variant: a small drawn plane or boat crosses the sky/sea towing a text banner that carries the offer names past the visitor on scrub.
8. LE PONTON — steps/process on a horizontal boardwalk line: plank hairline, plaques at each pillar, content alternating above/below the line.
9. LE KIOSQUE — the closing form as a beach kiosk under its own canopy: bordered fields, plaque labels, phone-first, the honest success line sealed by a citrus slice.
10. LA TABLE DU MIDI — a menu/tariff composition: names joined to DZD/EUR prices by dotted leaders, one citrus marker on one line, service-hours plaque in a corner.
11. LES MOUETTES — ambient move: 2–4 gulls drift across ONE section only, 9–14s loops; on reduced motion they rest on the balustrade line.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. GRAND HÔTEL DU GOLFE (hotel, "le matin") — LE BALCON hero: headline and italic welcome portside, tall morning seafront starboard. Showpiece: LE FRONT DE MER — the promenade pans past cabines to the lighthouse, holding at plaques for Chambres, Table, Plage. Middle: facts band, cabine-card rooms, LA MARÉE dinner interlude. Mood: pressed linen, first coffee, flat morning sea.
2. LIMONE GELATO (gelato / desserts, "la sieste") — LA DEVANTURE hero: full-width canopy over the centered wordmark, the parlor's scene band below. Showpiece: LA JOURNÉE — one fixed kiosk scene scrubbed noon to evening, each hour of light introducing a flavor family on a plaque. Two lemon moments spent on the signature sorbet, one on the form. Mood: siesta heat, cold spoons, azure shade.
3. COMPAGNIE DES CALANQUES (tours & excursions, "l'heure dorée") — full-bleed panoramic hero: the headline set INTO the sky band of a harbor scene, nav plaques floating on the cream margin. Showpiece: LE PHARE — dusk harbor pinned; a flat cone of lamplight sweeps on scrub, each sweep illuminating one excursion's majolica plaque. Mood: golden hour, engines idling, salt on rope-free decks.
4. VILLA SIRENA (single property showcase, "la saison") — poster hero: the villa's name at clamp-maximum across the full width, a low horizon scene strip beneath it, plaque with the address between. Showpiece: LES CABINES OUVRENT — five cabin doors pinned, each swinging open in sequence on scrub to reveal a drawn room and its plaque (surfaces, orientation, étage). Mood: keys in hand, shutters opening, a season not a stay.
5. PISCINE LES FLOTS (swimming school, "le matin") — waterline hero: the headline sits half-submerged, its baseline on the sea band's surface, letters above in marine, reflection hinted below at 20% — the only hero where type touches water. Showpiece: LA MARÉE RISING — a scrubbed tide climbs a schedule wall, each water level revealing one course group (Têtards, Dauphins, Espadons) on its plaque. Mood: chlorine and sunlight, whistles, laned calm.
6. DOMAINE DE L'ESCALE (wedding venue, "l'heure dorée") — hero-object composition: one large majolica plaque carries the couple's names and date at center, the seafront scene wrapping around it on all sides. Showpiece: LA RÉGATE — sails tack across the sea on scrub, each sail carrying one word of the programme (Cérémonie, Dîner, Bal), gathering at the jetty by the CTA. Mood: golden hour again but formal — linen pressed twice.
7. TRAVERSÉES AZUR (airline / transport — coastal ferries, "la saison") — reversed split hero: the port scene portside, text starboard with a stacked departures board of plaques (Béjaïa–Marseille, horaires, DA). Showpiece: LA BANDEROLE — a small drawn plane tows a banner listing the season's routes across a full-bleed sky band on scrub. Mood: timetables and sea spray, holiday logistics with manners.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
PROMENADE lives or dies on THREE things at 100%: the CANOPY-AND-PLAQUE CREDIBILITY (a rail bar, true scallop hems sized to the stripes, the four corner screws — lose them and the page becomes a generic striped template), the DRAWN SEAFRONT (the scene is the photography budget spent in code; a PROMENADE page with a weak or missing scene is a cream brochure), and the RATION (three lemons, one italic line, one deep interlude, sways under 2° — the discipline IS the elegance; break the budgets and the promenade becomes a souvenir shop). The cheap details that separate it from a generated page: the corner screws, the enamel 1px sheen, the dotted leaders reaching prices, the desynced parasol sways, the gull resting on the balustrade in reduced motion, the sun in straw never lemon. When in doubt, remove a decoration and straighten the horizon — the sea does the charm; the page only needs manners.`,
	energy: "medium",
	family: "promenade",
	fusesWith: ["zellij", "atlas"],
	id: "promenade",
	industries: [
		"hotel",
		"vacation rentals",
		"vacation packages",
		"travel agency",
		"tours & excursions",
		"camping / glamping",
		"restaurant (classic)",
		"gelato / desserts",
		"café / coffee shop",
		"swimming school",
		"wedding services",
		"venue / salle des fêtes",
		"real estate agency",
		"airline / transport",
		"single property showcase",
	],
	kind: "website",
	mood: ["sunlit", "linen", "seaside", "elegant", "joyful"],
	name: "Promenade",
	preview: {
		accent: "#1F6098",
		fontFamily: "DM Serif Display",
		ground: "#FBF8F1",
		ink: "#143A66",
		sampleWord: "La Plage",
	},
	priceFeel: "premium",
	tagline:
		"La promenade balnéaire : auvents rayés, plaques émaillées, élégance marine ensoleillée.",
};
