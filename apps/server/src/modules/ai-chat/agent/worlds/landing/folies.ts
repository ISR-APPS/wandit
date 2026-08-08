import type { DesignWorld } from "../types";

/**
 * FOLIES — the gilded night of 1925.
 * Art-deco glamour on deep emerald: gold as pure GEOMETRY (sunburst fans,
 * ziggurat setbacks, chevrons with a center gem), champagne text, strict
 * bilateral symmetry, fan-unfold motion. Gold is never engraving (that is
 * ORFEVRE, on black) and never sits on ivory (that is DIWAN).
 * fusesWith generique — bridge: the gilded night photographed; FOLIES draws
 * the room, GENERIQUE films it — one luxury-hospitality brand, two registers.
 */
export const folies: DesignWorld = {
	avoidFor: [
		"dev tool",
		"crossfit / functional",
		"plumber",
		"kids & baby shop",
		"pharmacy",
	],
	doc: `# DESIGN WORLD: FOLIES — the gilded night of 1925

## Philosophy
This page is A NIGHT AT A 1925 REVUE — an emerald proscenium crowned in gold geometry, doors closed, band tuning, every guest already dressed. Its defining structural facts. One: STRICT BILATERAL SYMMETRY — every major composition sits on the page's vertical center axis or exists as a mirrored pair across it; asymmetry appears only as a deliberate counterweighted exception, never as default. Two: GOLD IS GEOMETRY, NEVER MATERIAL — rays, steps, chevrons and gems, drawn as flat fills or strokes of 1.5px and thicker; never engraved hairlines, never foil texture, never a gradient pretending to be metal. Three: THE GROUND IS ALWAYS DEEP — the emerald register with champagne text; the page IS the nightclub with the lights down; there is no daylight mode. Four: ZERO PHOTOGRAPHY — imagery is flat geometric deco illustration (coupes, chandeliers, fans, stepped skylines, marquee panels) built from the same ray/step/chevron vocabulary as the ornament. Impossible failure modes: an ivory or pastel ground anywhere; a curlicue, floral or feather; gold that shines (specular, chrome, bloom); a grunge or off-axis layout. Self-audit before shipping: (1) drop a vertical center line through every viewport — each section either sits on it or mirrors across it; (2) census the ornament species — rays, steps, chevrons, gems ONLY; any curve beyond a circle segment fails the page; (3) zero img elements, zero photographs; (4) at most ONE full-size sunburst per viewport; (5) every display setting is uppercase with at least 0.12em tracking; (6) grounds are the two emeralds plus at most two noir planes — nothing lighter ever carries a section.

## The variation contract
WORLD LAW — never renegotiated by brief or builder:
- Deep emerald double-ground + champagne ink + geometric gold, budgeted as written in Color physics.
- Strict symmetry as described above; containers 1080–1240px on a centered axis.
- The three owned tics: sunburst/fan crowns, ziggurat frames, chevron + gem dividers.
- Uppercase tracked display type; never italic anywhere.
- Fan-unfold motion (rotational openings from a shared pivot); exactly one scrubbed showpiece.
- Zero photography; drawn deco geometry is the only imagery.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact emeralds inside the register (#0E2620/#123129 shipped; bottle #0C2B1F/#11362A, viridian #0D2E2B/#123832, forest-noir #0F241C/#142E24 are in-register siblings) and the gold pair within #CBA135–#B98F2F warmth.
- The display face WITHIN the register: Poiret One or Limelight, one per site.
- The CONCEPT NOUN that drives the page — le programme, le bal, la coupe, minuit, la porte verte — it names the hero scene, the showpiece and the copy voice.
- The gem glyph: rotated square, lozenge or octagon — pick one per site and repeat it everywhere.
- Whether the fan showpiece carries a programme, a menu, a collection or an itinerary; the scenes drawn; section order beyond the fixed opening and closing; which 2–3 gestes play.
A FOLIES page without its concept noun is a failure: name it first, then let it choose the hero scene, the showpiece and the words.

## The vibe (voice)
Velvet-rope confidence, in the client's language. Short declarative invitations; time-of-night vocabulary (doors, sets, last call); understatement instead of superlatives; one dry wink allowed per page. Example lines in the demo register: "Dinner at nine. The band at ten. The night decides the rest." / "Behind the green door, the twenties never ended." / "Jackets encouraged. Phones discouraged. Champagne inevitable." Never "luxury experience", never "exclusive offer", never an exclamation mark, never fake urgency.

## Visual signatures
- SUNBURST / FAN CROWNS (owned tic): 9–17 tapered gold rays fanning 150–180° from a low pivot, crowning the hero and section titles. Full-size crown: 480–760px wide, ray strokes 2–3px, alternating long/short rays (radius ratio ~1.5:1), tiny gem beads on every fourth ray tip. Title crests are the miniature: 120–150px wide, 7–9 rays, 2px strokes. Exactly one full-size sunburst per viewport; crests do not count.
- ZIGGURAT FRAMES (owned tic): double-wall rectangular frames — outer 1px gold at 35–45% opacity, inner wall inset 6–10px at 20–28% — with a stepped crest tab centered on the top edge (2–3 setbacks, steps 8–14px wide, 4–7px tall) and small stepped corner marks. Filled panels may instead clip their top corners with the same two-step setback. Buttons cut their corners with a 2-step 8px+4px setback.
- CHEVRON + GEM DIVIDERS (owned tic): a 1px gold rule broken at center by the site's gem glyph (8–12px, rotated 45°) flanked by two 45° chevrons per side (1.5px strokes, 10–14px tall, 6–8px gaps); total height 10–16px. Used under section titles, between menu courses, and once in the footer.
- THE CENTER AXIS: heroes, titles, dividers and showpieces centered; split sections mirror their ornaments across the axis; nav links flank a centered wordmark in equal pairs.
- GOLD DISCIPLINE: gold never floods an area larger than a fan blade or a button face; body text is never gold; gold type is reserved for labels, times, prices and one accent word per major headline at most.
- DEPTH PLANES: deep noir #0A1512 full-bleed planes, maximum two per page — one interlude and the footer.
- Champagne secondary text at 60–72% opacity; hairline rules in gold at 20–30%.

## Color physics
- GROUND A / GROUND B: two emeralds 3–7 RGB points apart — the #0E2620 / #123129 register. Sections alternate between them; the alternation is the section rhythm.
- NOIR: #0A1512 — the depth plane under the interlude and the footer, never a third time.
- INK: champagne #EFE6D0, never pure white; secondary text rgba(239,230,208,0.65); disabled/whisper 0.4.
- GOLD: #CBA135 primary, #B98F2F shade. Budget: micro-labels, times, prices, rays/steps/chevrons/gems, button outlines and fills, the focus ring, ::selection, and at most one accent word per major headline.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · GOLD→--primary · GROUND A→--primary-foreground · GROUND B→--secondary · NOIR→--accent · ink at 65%→--muted · gold at 25%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, shade or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- THE ONLY ALLOWED GRADIENT: a vertical two-stop gold #CBA135 → #B98F2F on FILLED fan blades and button faces — flat duotone, no highlight stop. Never radial, never on text, never on grounds, never as a glow.
- Gold on ivory is DIWAN's territory; a light ground anywhere breaks the night. If the brief begs for daylight, refuse: FOLIES trades only after seven.

## Typography system
- DISPLAY: Poiret One or Limelight (Google Fonts), one per site, weight 400 (their only cut). ALWAYS uppercase. Tracking 0.12em minimum, up to 0.3em on short titles. Hero wordmark clamp(2.6rem,7vw,5.25rem), up to clamp(2.6rem,7.5vw,5.75rem) for short names, line-height 1.08–1.18; section titles clamp(1.8rem,3.4vw,2.6rem); the monument footer wordmark clamp(2.2rem,7.5vw,6.2rem), up to clamp(2.6rem,8.5vw,7rem) for short names.
- BODY: Jost or Montserrat, weights 300–500 only, 15–17px, line-height 1.65–1.8, sentence case, measure 34–62ch. Never bolder than 500 — weight contrast is not this world's tool; tracking and gold are.
- LABELS: body face 500, uppercase, 10–11px, 0.28–0.35em tracking, gold.
- NUMERALS (prices, times, capacities): body face 500 in gold; font-variant-numeric: tabular-nums inside lists and menus.
- HARD RULES: never italic, anywhere, for any reason. Never gradient-fill text — metallic champagne-foil caps are GENERIQUE's. Display face never below 1.1rem; labels always use the body face.
- ARABIC PAIRING: display El Messiri 500, body Cairo 300–500; letter-spacing 0 on Arabic script (the tracking law is Latin-only); symmetry, ornament and color laws unchanged.

## Signature art / components
- IMAGERY SYSTEM: flat geometric deco illustration drawn in CSS/SVG from the world's own vocabulary — rays, steps, chevrons, circle segments, lozenges. Subjects: champagne coupes with rising gold bead-bubbles, tiered chandeliers hung with gem drops on 1.5px lines, hand fans, stepped skylines, marquee panels, a green door. Construction: 2–4 flat tones per scene (champagne, the two golds, ground B) on the emerald ground; fills or strokes 1.5px and thicker; no hairline outline-only engraving (ORFEVRE), no shading, no texture, no perspective beyond flat elevation. Scenes sit inside ziggurat frames and carry role="img" plus a real aria-label in the page's language.
- BUTTONS: rectangles with 2-step corner cuts, rounding held at min(var(--radius), 0px) — this world's corners are cut by setback, never rounded — built as a gold skin wrapping an emerald face (reads as a 1.5px outline). PRIMARY: on hover/focus the face fills gold bottom-to-top in 200ms and the text flips emerald. GHOST: a text link with a center-out gold underline (scaleX 0→1 from center) and a gem that rotates 45°. :focus-visible replays the hover state plus a 2px gold outline offset 3–4px on the unclipped outer element. Keyboard/touch parity is mandatory everywhere.
- CARDS: ground-B panels inside ziggurat frames (double wall + crest tab), padding 2–2.5rem, title in the display face, one gold fact line with a gem bullet, body in champagne-65.
- FORMS: underline fields — transparent inputs over a 1px champagne-30% bottom border that turns gold on focus; labels as gold micro-caps above the field; phone-first (the tel input directly after the name, correct inputmode/autocomplete); selects for structured choices (party size, occasion) with a gold chevron caret; textarea for the note. Honest success state: the form is replaced by a composed "your request is in the book" panel that states the real next step (a telephone confirmation) — no confetti, no fireworks. On valid submit dispatch on document: new CustomEvent("wandit:lead", { detail: { name, phone, date, party, occasion, note } }) — the visitor's fields flat in detail. Include exactly one off-canvas decoy input with data-wandit-hp, tabindex="-1", aria-hidden="true", autocomplete="off", positioned off-canvas, and never read or written by the page's own script.
- ::selection: gold ground, emerald text. Favicon: inline SVG data URI — gold fan rays on the emerald ground.

## Page chassis
- Vertical rhythm: section padding clamp(5rem,10vh,8rem); containers 1080–1240px; prose and menus at 34–62ch.
- HEADER: slim (64–76px), ground A over a 1px gold-25% rule; the wordmark centered in the display face; links flanking it in mirrored pairs (two left, two right) — the symmetric marquee. Mobile: wordmark + the reserve link only.
- FIXED OPENING — the proscenium hero: a centered ceremony on ground A inside a grand ziggurat frame: micro-label (city · est.) → the page's ONE full-size sunburst crown fanning open → the wordmark → a one-sentence promise → primary CTA with a ghost link beside it → an hours line with gem separators. Anchor CTAs point at real section ids.
- FIXED CLOSING — the book, then the monument: the reservation form (per Forms law) beside the venue's facts (address, hours, telephone as tel:, mail as mailto:), then the monument footer on the noir plane: the wordmark at clamp(2.2rem,7.5vw,6.2rem) over one chevron + gem divider and a single facts line.
- FREE MIDDLE (compose 3–5, never two adjacent alike): the mirrored split (prose + a framed drawn scene, ornaments mirrored across the axis) · the fan showpiece (pinned scrub — see Motion) · the bill of fare (two columns of items on a center gold spine with gems; name + detail + tabular gold price) · the loges row (three ziggurat cards) · the noir interlude (one grand line under a half-sunburst on the noir plane) · the hour spine (a centered vertical gold rule with time gems, moments alternating left/right).

## Motion identity
The verb of this world is UNFOLD-BY-ROTATION: things open like a fan, rotating from a shared pivot into place. Nothing bounces, nothing flickers, nothing drifts sideways.
- Easings: power2.out for entrances (0.7–1.0s); power1.inOut for scrub segments; CSS transitions 160–240ms ease.
- Entrances: rises of 28–36px with 70–110ms staggers; every section-title crest fans its rays open (rotation from 0 to each ray's angle around the pivot, 50–70ms stagger); dividers scale center-out (scaleX 0→1, transform-origin center); framed scenes rise as one object.
- THE SHOWPIECE (exactly one per page, scrubbed): THE FAN — a pinned viewport where a giant fan of 5–9 blades (blade length 260–340px desktop, spread ±54–66°, stepped ziggurat blade tips, alternating gold-duotone and outlined-emerald fills) opens blade by blade on scrub. Blades start stacked closed at one side and sweep chronologically into place; each blade carries a time or name at its tip and reveals one programme/menu item in a swap-caption at the pivot. Pin length 1600–2200px, scrub 0.5–0.8, one blade per beat, captions crossfading 0.3–0.4s. Alternative scrub scenes (pick ONE per page, never two): the curtain (mirrored panels rotate apart center-out revealing depth planes) · the staircase (content descends stepped setbacks one beat per step) · the hour spine (the rule draws down while time gems light in order) · the chandelier (tiers and gem drops assemble top-down).
- BELOW 768px: never pin — the showpiece renders composed (fan fully open) with a one-shot rotational entrance, and its items read as a vertical gem-bulleted list.
- HOVERS: gem rotates 45°, underline grows center-out, button faces fill bottom-to-top — 160–240ms, with keyboard/touch parity.
- REDUCED MOTION: every scene at its most-open composed state; no pin, no scrub, instant reveals. JS dead: the page is fully open and readable — every hidden state is set via gsap.set, never in CSS.

## Ban list (in addition to the global one)
- Gold hairline engravings that draw themselves on scroll, filigree corner flourishes, the gilded page-edge line — that is ORFEVRE's language (1px gold on black); FOLIES gold is flat geometry on emerald, strokes 1.5px+, and never strokeDashoffset draw-ons.
- Arabesque ornament frames, eight-point star glyphs, illuminated medallion openers, ivory grounds — that is DIWAN's language.
- Photography of any kind; letterboxed 21:9 crops, Ken-Burns scrubs, metallic champagne-foil small caps — that is GENERIQUE's language.
- Chrome/metal text, specular bevels, glossy orbs — that is AN2000's language.
- Tessellated star-and-polygon tile bands, glazed-tile cards — that is ZELLIJ's language.
- Ivory, cream or pastel section grounds anywhere; white text (champagne only).
- Italic; script or calligraphic faces; gradient-fill text.
- Radial gold glows, lens flares, bloom, backdrop-blur/glassmorphism.
- Curlicues, florals, feathers, lace — any ornament not built from rays, steps, chevrons or gems.
- More than one full-size sunburst per viewport; sunbursts tiled as wallpaper.
- Asymmetric compositions without a mirrored counterweight; rotated or tilted section grounds (poster-ground rotation is AFFICHE's).
- Overshoot and bounce easings (back.out is GUIMAUVE's); flicker-in and glow ramps (VOLTAGE's); typed-text reveals (PHOSPHORE's).
- Black-and-gold-only pages: lose the emerald and the world collapses into generic deco.

## LES GESTES (moves menu)
1. LE PROSCENIUM — the hero as a stage: grand ziggurat frame, the one full-size sunburst fanning open above the wordmark, promise and CTA beneath, hours line with gem separators. The curtain-up of the page.
2. L'ÉVENTAIL — the pinned fan scrub: blades sweep open chronologically, a programme, menu or collection revealed item by item at the pivot caption. The world's signature showpiece.
3. LE RIDEAU — a center-out reveal: two mirrored panels rotate/slide apart from the axis to expose a scene or a claim; also the entrance verb for dividers (scaleX from center).
4. LA MARQUISE — the noir interlude: one grand uppercase line (one gold accent word allowed) over a half-sunburst rising from the plane's bottom edge. The page's held breath.
5. LA CARTE — the bill of fare: two columns of dishes/services on a center gold spine with gems; names champagne, details champagne-65, prices tabular gold; a chevron + gem divider between courses.
6. LES LOGES — three ziggurat cards in a row (rooms, offers, packages), each with a crest tab, a gold fact line and a gem bullet; stack composed on mobile.
7. LE MIROIR — the mirrored split: prose on one side, a framed drawn scene on the other, ornaments mirrored across the axis; flip the sides at the next occurrence.
8. L'ESCALIER — stepped setbacks as layout: numbers, stats or floors descending/ascending a ziggurat profile, one item per step; as a scrub scene, one beat per step.
9. LE LUSTRE — a drawn chandelier assembling: tiers rise into place top-down, gem drops settle last with a sway no larger than 2°.
10. LA REVUE DES HEURES — the hour spine: a centered vertical gold rule with time gems; moments alternate left/right of the axis; as a scrub, gems light in order as the rule draws down.
11. LE FOX-TROT — the hover verb: gems rotate 45°, underlines grow center-out, button faces fill bottom-to-top; touch and keyboard replay it exactly.
12. LE VESTIAIRE — the reservation ceremony: the form as a numbered ticket in a ziggurat frame, phone-first, honest "your request is in the book" success panel stating the telephone confirmation.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. LE BAL — a wedding venue. Hero: a full-height mirrored staircase composition, the couple's monogram set in a single oversized gem at the axis, wings of steps descending both sides. Showpiece: la revue des heures — the wedding day drawn down a gold spine, time gems lighting from vows to last dance. Middle: les loges for the three salons, la carte for the menus, le miroir for the story. Mood: grand, tender, unhurried.
2. LA PORTE VERTE — a cocktail bar with resident DJs. Hero: a drawn pair of green double doors center-stage under a gold marquee panel, handles as gems. Showpiece: le rideau — the doors swing open on scrub, revealing the residency programme in receding depth planes. Middle: la carte of cocktails, la marquise ("the door is a rumor"), le vestiaire. Mood: secretive, loud at heart.
3. BIJOU — a jewelry brand. Hero: one oversized gem glyph rotating 45° above the wordmark, mirrored stepped wing ornaments flanking. Showpiece: l'escalier — the collections descend stepped setbacks, one piece per beat, prices in tabular gold. Middle: le miroir for the atelier, les loges for the three lines. Mood: precise, precious, quiet.
4. SALON DORÉ — a barber and hair salon. Hero: le miroir played as the hero — a drawn deco vanity mirror on one side, the promise on the other, ornaments mirrored. Showpiece: le lustre — the chandelier assembles while each gem drop reveals a service and price. Middle: la carte of rituals, la marquise with the house rule. Mood: groomed, wry, confident.
5. GRAND HÔTEL ÉMERAUDE — a hotel. Hero: a stepped skyline silhouette running the hero's base, the wordmark riding above it on the axis. Showpiece: the tower — an invented escalier variant where the skyline's windows light floor by floor on scrub, each floor a room type with its rate. Middle: les loges for suites, la carte for the bar, le vestiaire as "the concierge's book". Mood: stately, worldly.
6. LA THÉIÈRE DE JADE — a tea house. Hero: a drawn teapot pouring an arc of gold beads beneath a small crown, hours line under it. Showpiece: l'éventail — a five-blade fan of blends, one origin at each tip, the pivot caption naming the pot and its price. Middle: le miroir for the room, la carte of pastries. Mood: hushed glamour, deco by daylight rules still refused — the room stays emerald.
7. LA REVUE — an event planner. Hero: a playbill card in a grand ziggurat frame center-stage, season dates flanking it in mirrored columns. Showpiece: the wings — an invented éventail variant where two half-fans open from the page edges toward the axis, meeting at the season's finale act. Middle: l'escalier of past productions, la marquise, le vestiaire. Mood: theatrical, brisk.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails. THE SYMMETRY: the center axis is the spine of every viewport — one accidentally off-axis section and the glamour reads as a mistake, not a choice. THE GOLD-GEOMETRY DISCIPLINE: rays, steps, chevrons, gems, nothing else — a single curlicue turns the page into a wedding template. THE DEEP GROUND: emerald held everywhere, champagne never bleached to white, not one light section — the night must never end mid-page. The cheap details that separate this from a generated page: gem bullets instead of dots, the 2-step corner cuts on buttons, tabular gold prices, the crest fanning open above every title, the tracking discipline, the hours line with gem separators, the honest telephone-confirmation success state. When in doubt, remove an ornament and widen the tracking — restraint reads as wealth here.`,
	energy: "medium",
	family: "art-deco",
	fusesWith: ["generique"],
	id: "folies",
	industries: [
		"fine dining",
		"restaurant (classic)",
		"venue / salle des fêtes",
		"event planner",
		"wedding services",
		"DJ / entertainment",
		"hotel",
		"hair salon",
		"barber",
		"makeup artist",
		"jewelry brand",
		"fashion boutique",
		"photographer (events)",
		"tea house",
	],
	kind: "website",
	mood: ["gilded", "nocturnal", "symmetric", "glamorous", "confident"],
	name: "Folies",
	preview: {
		accent: "#CBA135",
		fontFamily: "Poiret One",
		ground: "#0E2620",
		ink: "#EFE6D0",
		sampleWord: "Les Folies",
	},
	priceFeel: "premium",
	tagline: "Le glamour 1925 : or géométrique sur émeraude, symétrie de gala.",
};
