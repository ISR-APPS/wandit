import type { DesignWorld } from "../types";

/**
 * TUTTI — the Memphis Milano party.
 * Cream ground exploding with a confetti field of squiggles, crosses,
 * half-circles and zigzags carrying pattern fills; offset shadows in
 * CLASHING hues (never black); squiggle underlines and zigzag dividers.
 * 80s loud fun with design-history bones — chaos that is secretly composed.
 * Fuses with guimauve (the party serves dessert — kids' events) and
 * bauplan (memphis learns composition — creative schools).
 */
export const tutti: DesignWorld = {
	avoidFor: [
		"lawyer / law firm",
		"notary",
		"fine dining",
		"single property showcase",
		"aesthetic clinic",
	],
	doc: `# DESIGN WORLD: TUTTI — the Memphis Milano party

## Philosophy
This page is a PARTY THROWN BY A DESIGN STUDIO IN MILAN, 1981 — not a website. A cream room where confetti hangs mid-air: squiggles, crosses, half-circles, zigzags and rings, a third of them wearing PATTERN FILLS (polka dots, diagonal stripes, checks), every one of them throwing a shadow in the WRONG color on purpose. The chaos is a lie: every shape's center snaps to a ghost grid, every rotation comes from a fixed angle set, every clashing shadow follows one wheel. That is the whole thesis — TUTTI looks like an accident and is actually choreography, exactly like Memphis Milano itself: loud fun with design-history bones. Defining structural facts: the confetti field is the imagery system (zero photography, ever); depth is the colored offset shadow (never black, never blurred); emphasis is the squiggle underline; punctuation between sections is the zigzag divider. Impossible failure modes: minimalism, gray, a beige corporate page, a black shadow, pastel softness, chaos that ignores the grid. Self-audit before shipping: (1) at least 3 distinct pattern fills visible in the first two viewports; (2) ZERO black or ink box-shadows in the stylesheet — every shadow is one of the four hues; (3) exactly one squiggle underline in the hero headline; (4) count the hues: four plus ink plus cream, no fifth hue anywhere; (5) every confetti shape's rest rotation belongs to the site's declared angle set; (6) zero overshoot eases (no back.*, no elastic, no bounce).

## The variation contract (why two TUTTI sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- Cream ground register, warm near-black ink, and the FOUR-HUE BUDGET (teal / pink / purple / yellow) with roles: one hue LEADS per section, the others support.
- Pattern fills (dots, stripes, checks) on 30–60% of confetti shapes; all fills flat — gradients exist nowhere.
- Colored offset shadows on every raised element, hue chosen by the clash wheel, zero blur, NEVER black.
- Squiggle underlines on one accent word per major headline; zigzag dividers between sections.
- The ghost grid + angle-set discipline behind every scatter.
- Confetti scatter-in motion: random-order staggers, quick pops, NO overshoot.
- Display face from the Shrikhand / Lilita One register; body Rubik. Drawn CSS/SVG art only.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside each hue register, WHICH hue leads the site overall, and the section lead-rotation order (a teal-led swim school and a pink-led nail studio are both TUTTI).
- The display face (Shrikhand or Lilita One, one per site) and the angle set (pick 4 values from −14°…+14°).
- The CONCEPT NOUN that names the party — la boum, il totem, la piñata, la tombola — it drives the hero scene, the showpiece and the copy voice.
- The shapes drawn (which canon shapes dominate), the totems' subjects, the pattern trio emphasis (a dots-heavy site and a checks-heavy site are siblings), the section order beyond the fixed opening and closing, and the showpiece scene's subject.
A TUTTI page whose confetti is generic decoration is a failure: the shapes must BELONG to the business (a scoop is a half-circle, a lane rope is a squiggle, a beat is a zigzag) — name the concept first, then let it choose the shapes.

## The vibe (voice)
Party-host English (or the brief's language): short, warm, cheeky, second person, facts said with a grin. The host is confident enough to be honest. Register examples: "First class is free. Bring your bad moves." · "Seven styles, one floor, zero judgement." · "We start at 7 sharp — the shy leave confident." Exclamation marks: maximum 3 per page, the design is already shouting. One honest concession per page ("Salsa fills up first — book that one early.") is worth ten superlatives. Never corporate, never cute-babyish: the party is for everyone, tutti.

## Visual signatures
- THE MEMPHIS CONFETTI FIELD (owned tic): compositions of 8–20 shapes from the canon set — the squiggle (an S-path of 2.5–4 humps, 4–8px round-cap stroke), the cross (+), the half-circle (border-radius 999px 999px 0 0), the zigzag wedge (3–5 teeth, clip-path), the ring (8–12px hue border, hollow), the triangle wedge, the pill-dash. 30–60% of shapes carry a PATTERN FILL: polka dots (2–3px dots, 10–14px pitch), diagonal stripes (45°, 5–8px bands), or checks (10–16px squares). One pattern per shape, pattern colors only from the four hues + ink on cream or on a hue.
- THE GHOST GRID: every scattered shape's center sits on an invisible 8-column grid intersection, jittered ±12px max; rest rotations come ONLY from the site's angle set of 4 values in −14°…+14°. Density law: shapes cluster near the section's focal element and thin toward the edges — confetti frames content, never buries it.
- COLORED OFFSET SHADOWS (owned tic): box-shadow Xpx Xpx 0 0 with X ∈ 5–8px (8–10px for hero-scale pieces), zero blur, zero spread, in a CLASHING hue from the wheel teal → pink → purple → yellow → teal (an element's shadow is the NEXT hue on the wheel after its fill; cream/ink elements take the section lead's clash partner). A shadow may never be black, gray, or the element's own hue.
- SQUIGGLE UNDERLINES + ZIGZAG DIVIDERS (owned tic): ONE accent word per major headline carries an SVG squiggle underline — 4–6px stroke, 2.5–3.5 humps, round caps, clashing hue — that draws itself in 0.6–0.9s on first view. Hang it tight under the word (≈0.12em below the baseline box, ≈0.3em tall) so it never collides with the next text line. Between sections: zigzag dividers, either a 3–4px stroked polyline or a filled zigzag band 14–24px tall in the outgoing section's lead hue.
- FURNITURE GEOMETRY: outlines are 2px ink MAXIMUM (thick border systems are another world's law); chips and labels rest rotated ±2–4°; radius register: buttons and chips are capsules consuming var(--radius) directly (the 999px pill), 18–24px for cards with ONE scooped corner (56–72px) allowed per card; confetti may overlap a card's edge by 10–18px like it landed there.
- ONE DARK MOMENT: the page may kill the lights exactly once — an ink-ground showpiece or footer where the four hues fluoresce. Everything else lives on cream.

## Color physics
- GROUND: the cream register #FBF3E4/#F8EEDA; cards one step lighter, the #FFFBF2/#FFF8EC register. Never white, never gray.
- INK: warm near-black, the #201A1E/#241C21 register — never #000.
- THE FOUR-HUE BUDGET (roles, not decoration): teal #00B3A4/#00A392 · pink #FF4FA3/#FF3D98 · purple #7C4DFF/#6E3DF5 · yellow #FFCB2E/#FFC107. ONE HUE LEADS PER SECTION — it owns the biggest shape, the CTA or focal chip, and the divider handing off to the next section; the other three support as small confetti, pattern dots and shadows. Never the same lead twice in a row; the rotation order is client-owned.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · LEAD HUE→--primary · INK→--primary-foreground (GROUND when purple leads) · card cream→--secondary · the lead's clash partner→--accent · near-ink floor register→--muted · INK→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, pattern-fill or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- THE CLASH WHEEL is law: teal casts pink shadows, pink casts purple, purple casts yellow, yellow casts teal. Audit every shadow: if it doesn't clash, recolor it.
- Text on hues: ink on teal/pink/yellow; cream on purple and on ink. Body text is always ink on cream — hues never set paragraphs.
- SATURATION LAW: every hue at full poster strength, flat. No pastels, no tints, no desaturation, no alpha washes. Gradients exist NOWHERE — not in grounds, not in art, not in text; depth is the offset shadow, light is a lighter flat plane. ONE mechanical exemption: hard-stop pattern fills — the dots/stripes/checks are BUILT as radial/repeating gradients whose adjacent color stops share a position (0-width transitions), printing flat pattern, never a blend. Any gradient with a visible soft transition between colors stays absolutely banned.
- The ink slab appears at most twice (showpiece + footer) and hues on ink stay at full saturation — the dance floor at night, not a dimmed room.

## Typography system
- DISPLAY: Shrikhand (400) or Lilita One (400) — ONE per site. Shrikhand sets sentence case only, never uppercase, never letterspaced, line-height 1.08–1.2, and never below 1.6rem. Lilita One may set uppercase with tracking +0.01–0.02em. Display owns headlines, prices, big numerals — nothing else.
- BODY: Rubik 400/500/600 (700 for labels only). 1rem–1.0625rem, line-height 1.55–1.65, measure ≤ 60ch, flush left. Long paragraphs never center.
- Hero statement: clamp(2.7rem, 6.5vw, 5rem) for split/cluster heroes; up to clamp(2.8rem, 7.5vw, 5.8rem) when the headline stands alone (piñata, rideau). One accent word per headline in a hue, its squiggle underline in that hue's clash partner. Section titles: clamp(1.9rem, 4.4vw, 3.4rem).
- LABELS: Rubik 600–700, uppercase, 11–13px, tracking +0.06–0.1em, ALWAYS inside a rotated capsule chip (2px ink outline or hue fill + clashing shadow) — never floating bare on the ground (that is ÉCRIN's whisper, not a party's).
- NUMERALS & PRICES: display face, in a hue on cream or on a chip; currency affixes in Rubik 600 at 40–50% of the numeral size.
- Emphasis is the squiggle underline or a hue — NEVER italic, never bold-stacking, never a mono (this world has no machines).
- Arabic pairing: display Lalezar (its chunky joy matches Shrikhand), body Rubik (Arabic subset). Mirror in RTL: shadows fall left (−6px 6px), squiggles draw right-to-left, chip rotations flip sign.

## Signature art / components
- IMAGERY = THE CONFETTI FIELD + LES TOTEMS. Zero photography, zero photoreal. Each product/class/service is a TOTEM: 3–5 canon shapes stacked on a small base plinth (half-circle on cross on triangle register), at least one pattern fill per totem, 2px ink outlines, one clashing shadow on the whole stack. Totems are Memphis sculptures for the business: a scoop totem, a swimmer totem, a beat totem. Composed scenes (hero cluster, dance floor) are built the same way at larger scale. Every meaningful scene/totem carries role="img" + a real aria-label in the page's language; purely decorative confetti is aria-hidden.
- BUTTONS: capsule (999px), hue fill, 2px ink outline, ink text (cream on purple), 6px clashing shadow, resting rotation −2°/0°/+2° from the angle set. Hover/focus: translate(−2px,−2px), shadow grows +2px, rotation eases to 0° — the button stands at attention. Active: translate(2px,2px), shadow collapses to 2px. 150–220ms, keyboard and touch parity mandatory.
- CHIPS: the label spec above; info chips (address, age range, schedule facts) may carry a tiny canon shape as a prefix glyph instead of an icon font.
- CARDS: #FFFBF2 ground, 2px ink border, 20px radius + one scooped corner, 8px clashing shadow, totem art zone on a hue or patterned ground, one confetti shape overlapping an edge.
- FORMS: fields as 2px-ink-bordered blocks on cream, 14px radius, 12–16px padding, labels as chips above (never placeholder-as-label); focus ring = 3px outline in the section lead hue, offset 2px. Phone-first: input type="tel" with a local placeholder; structured choices in a bordered select. Invalid: 2px pink border + a frank line ("We need your number to save the spot."). Success: an honest block stating exactly what happens next, plus LE CANON — 8–12 confetti particles popping from the button (JS-gated). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, style, … }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads or references.
- ZIGZAG DIVIDER: an SVG polyline strip between sections, 3–4px stroke or filled band, in the outgoing lead hue; it draws in 0.5s when scrolled to.
- FAVICON: inline SVG data URI — teal squiggle, pink half-circle and yellow cross on cream.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 7.5rem); containers 1140–1320px; marquees, dividers and the showpiece bleed full width. Every section carries overflow-x: clip so scattered confetti and off-stage entrances never widen the page at 390/768/1440 — html-level clipping alone is not enough.
- HEADER: cream sticky bar, wordmark in the display face with a mini squiggle flourish, Rubik 600 nav links (hover: a short squiggle draws under the link), one capsule CTA; the header's bottom edge is a small zigzag strip, not a straight rule.
- FIXED OPENING (hero law): headline with its squiggle-underlined accent word + one honest offer line (a price, a free trial — this world sells accessibly) + capsule CTA + 2–3 info chips of real facts, composed with a confetti field of ≥10 shapes and ONE focal composition. Three hero families: LE CLUSTER (content one side, a large composed shape-cluster the other), LA PIÑATA (headline center, confetti radiating from one giant patterned shape behind it), LE RIDEAU (headline above or below a full-width band/scene of shapes). Density peaks around the focal piece.
- FIXED CLOSING: the RSVP — the form styled as a party invitation ("Save my spot" register) beside honest logistics (address, hours, a WhatsApp line), then the footer: ink slab, wordmark large in the display face with hue-colored words, a few confetti resting on the letters, capsule chip links with real hrefs (tel:, mailto:, wa.me, instagram), one honest legal line. No shadows die on ink — they stay, in hues.
- FREE MIDDLE (compose 3–5 from the gestes, never two adjacent sections with the same layout): the totem grid · la fanfare · la piste · le podium · la tombola · the mandatory scrubbed showpiece. Section labels are numbered rotated chips ("01 — The styles").

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: confetti scatter-in — random-order staggers from the grid. Every hidden state is set via gsap.set, NEVER in CSS; gate the whole block on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). JS dead → the party stands fully assembled, every shape at rest, squiggles drawn.
- Ease register: power3.out for entrances, power2.out for supporting moves, power1.inOut for wipes, steps(2–4) only for pattern-swap flickers. NO back.*, NO elastic, NO bounce — overshoot is GUIMAUVE's exclusive. Durations 0.45–0.7s; nothing exceeds 0.9s except the marquee loop (22–32s linear) and the scrub.
- THE SCATTER-IN (entrance law): confetti and cards pop from scale 0.4–0.6 with a random offset of ±20–40px and a rotation 18° off their rest angle, settling in 0.5–0.7s power3.out, stagger { each: 0.03–0.06, from: "random" } — the room fills like thrown confetti landing, never row by row. Text blocks rise 24–32px with 60–90ms staggers.
- Squiggle underlines draw via strokeDashoffset (0.6–0.9s power2.out) on first view; zigzag dividers draw in 0.5s.
- SHOWPIECE TYPE — LA BOUM (the pinned dance floor, one per page): a full-viewport ink scene, scrub 0.4–0.7, end += 1600–2200px, and the section clips BOTH axes so the rain never spills over neighboring sections. The empty floor is never blank: flat near-ink floor marks (the #3A2F38 register — dots on the ghost grid, or a thin tile-line grid) make the waiting dance floor a composed state. Phase 1: confetti shapes RAIN in from ~600–700px above in random stagger (starts spread over the first third of the scrub so the floor populates early), tumbling. Phase 2: the shapes SNAP into a composed dot-matrix pattern spelling the brand's initial — each shape travels to its own letter cell, rotation settling to the angle set. Phase 3 — the drop: pattern fills wipe across the assembled shapes (steps-flicker or background wipes) and 4–6 floor tiles flash hues once. The chaos-becomes-composition arc IS the world's thesis; the seed spells a letter, siblings may snap into a logo shape, a number, a totem — but the rain → snap → pattern-drop arc is law. Mobile <768px: no pin — the letter stands pre-composed and pops in on view.
- HOVER: lift −2px/−2px + shadow +2px + rotation to 0° (150–220ms); confetti near a hovered card wiggles ±4° once. Keyboard (:focus-visible) and touch parity for every hover behavior.
- REDUCED MOTION: the composed page — letter assembled, patterns applied, squiggles drawn, marquee frozen mid-phrase. A designed still, never a blank.

## Tutti ban list (in addition to the global one)
- BLACK offset shadows and 3–4px ink border systems — that is BLOC's language; TUTTI shadows always clash in a hue, outlines never exceed 2px.
- Pastel puffy blobs, soft inner-shadow inflation, candy-stripe divider bars — that is GUIMAUVE's language; TUTTI is saturated and FLAT, and its dividers are zigzags.
- back.out bounce entrances and squash-and-stretch hovers — GUIMAUVE's motion exclusive; TUTTI settles crisply, no overshoot ever.
- The die-cut sticker halo and peel-corner hover — that is GOMMETTE's language.
- The primary-color circle/triangle/square cast, thick baseline bars under type, rotating circular text badges — that is BAUPLAN's pedagogy; TUTTI's shapes are party confetti with pattern fills, never a disciplined cast of three.
- Pixel sprites, stepped pixel corners, HUD furniture — that is HUITBIT's language.
- Rotated crossing marquee strips — CINÉTIQUE's; TUTTI runs at most one band, one direction.
- Gradients of any kind, anywhere (the hard-stop pattern-fill exemption in Color physics aside). Blur of any kind (shadows, backdrops, filters).
- Pure black #000; gray anything; a fifth hue; alpha-faded tints of the four hues.
- Photography, photoreal rendering, emoji as decoration.
- Italic characters; letterspaced or uppercase Shrikhand; display type below 1.6rem.
- Confetti scattered without the ghost grid — unsystematic noise is the mark of a generated page.
- Fake urgency and countdown clocks — the party is confident, not desperate.

## LES GESTES (moves menu)
- LA PIÑATA — hero geste: one giant patterned shape (disc, half-circle, ring) behind the centered headline, confetti radiating outward along the ghost grid as if it just burst; the CTA hangs where the stick would be.
- LE CLUSTER — hero geste: content column one side; the other side a composed 5–8-shape sculpture (the party centerpiece) throwing one big clashing shadow, small confetti orbiting it.
- IL TOTEM — the card-art system: every class/product/service drawn as a stacked shape totem with one pattern fill, standing on a plinth in the card's art zone; totems differ but share construction.
- LA FANFARE — a full-width marquee band with zigzag top and bottom edges, display-face words separated by mini confetti shapes, one direction, 22–32s; lead hue ground.
- LA PISTE — the checkerboard: a schedule, program or catalog laid as a dance-floor grid; occupied tiles are hue-filled and slightly rotated, empty tiles stay cream with a 2px ink outline; tiles pop in random order.
- LE PODIUM — team/steps geste: people or steps stand on hue blocks of DIFFERENT heights (podium logic), shape-avatars or numerals on top, clashing shadows staggered.
- LA TOMBOLA — pricing as party tickets: rotated ticket cards with a perforated edge (notch circles + dashed rule), price in display face, one ticket flagged with a chip; tickets never align straight.
- LE JUKEBOX — interactive re-lead: chips (genres, flavors, moods) that swap the section's lead hue and pattern fills over 0.4s when pressed; aria-pressed synced, one honest caption naming the current selection.
- LES SERPENTINS — 2–3 long squiggle streamers that draw down a section's margins on scroll (strokeDashoffset scrub), threading between blocks without touching text.
- LA MOSAÏQUE — one display-face word or numeral per page set with a pattern fill inside the letterforms (background-clip: text over dots/stripes/checks) — the type itself joins the confetti.
- LE CANON — the micro-burst: on form success (or one key CTA), 8–12 tiny canon shapes pop from the element and fall, 0.6s, then vanish; JS-only, never on hover spam.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- GROOVE ROOM (dance studio, Dubai, English/AED) — LE CLUSTER hero: "Dance like everyone's watching." left, a big teal half-circle + patterned cross centerpiece right. Showpiece: la boum — confetti rains onto an ink dance floor and snaps into a dot-matrix G, patterns wiping in at the drop. Totem grid for 7 styles, tombola tickets for passes. Mood: Friday-night cheeky, teal-led.
- FRULLO (gelato / desserts, Marseille, French/EUR) — hero: a giant drawn CONE center-page, scoops as pattern-filled half-circles, the headline split around it. Showpiece: the cone stacks scoop by scoop on scrub, each scoop's pattern wiping in, a yellow zigzag wafer landing last. La piste as the flavor board. Mood: sunny, greedy, yellow-led.
- PICCOLO MONDO (kindergarten / crèche, Casablanca, French/MAD) — hero: LE RIDEAU — a garland band of shapes strung on a squiggle across the top, headline beneath, honest chips (ages, hours, tarif). Showpiece: the day unfolds — schedule tiles flip on one by one as a small sun totem crosses the pinned scene from 8h to 17h. Podium for the three educators. Mood: tender but loud, purple-led.
- SOUND CANDY (DJ / entertainment, Beirut, English/USD) — hero: the name stacked as TWO rotated hue slabs (SOUND on pink, CANDY on purple) with confetti caught mid-air between them. Showpiece: the equalizer — a row of hue bars pulses taller on scrub until the drop, where bars snap to a skyline and every pattern flickers once (steps(3)). Fanfare band of past venues. Mood: night party, pink-led.
- SPLASH ACADEMY (swimming school, Dubai, English/AED) — hero: headline above a full-width teal wave band where three swimmer totems float among rings. Showpiece: la traversée — a pinned pool crossed by a squiggle lane-line drawing itself while a swimmer totem advances checkpoint to checkpoint, confetti splashing at each stop. Piste as the level grid. Mood: fresh, encouraging, teal-led.
- POLISH PARTY (nails & lashes studio, Dubai, English/AED) — hero: one giant drawn hand, each nail a different pattern fill, headline set small at top-left with the squiggle word; confetti falls from the fingertips. Showpiece: la roulette — a big swatch wheel turns on scrub, each stop wiping a new pattern across an oversized thumbnail beside it; jukebox chips let visitors swap the palette live. Mood: flat-glam, pink-led.
- TUTTI MARKET (kids & baby shop, Algiers, French/DZD) — hero: the shelf — headline over three drawn shelf rows where product totems stand in a row, price chips rotated on the shelf edge. Showpiece: la boîte à jouets — a drawn toy box opens on scrub and totems LEAP OUT one by one, arcing up and landing on their shelf spots. Tombola for the packs. Mood: generous, warm-loud, yellow-led.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the PATTERN FILLS (confetti without dots/stripes/checks is generic geometric decor — the patterns are the design-history signature, spend the effort there), the CLASH WHEEL (one black shadow and TUTTI collapses into a neobrutalist template; audit every box-shadow), and the SHOWPIECE SNAP (the rain → composition arc is the thesis — a page without the chaos-becomes-choreography moment is just decorated). The cheap details that separate it from a generated page: the squiggle drawing itself under the accent word, chips resting at 2–4° with their clashing shadows, one confetti shape overlapping a card edge, the canon burst on form success, the rest-angle discipline that makes the scatter feel composed. When in doubt, do NOT add more shapes — add more system: snap it to the grid, clash the shadow, pattern the fill. Composed chaos is the only chaos allowed here.`,
	energy: "loud",
	family: "memphis",
	// guimauve: the party serves dessert — kids' events.
	// bauplan: memphis learns composition — creative schools.
	fusesWith: ["guimauve", "bauplan"],
	id: "tutti",
	industries: [
		"sports club / academy",
		"dance studio",
		"DJ / entertainment",
		"event planner",
		"festival",
		"kids & baby shop",
		"kindergarten / crèche",
		"music school",
		"swimming school",
		"nails & lashes studio",
		"hair salon",
		"makeup artist",
		"gelato / desserts",
		"fast food",
		"street food / food truck",
		"gym / fitness club",
		"multi-product shop",
	],
	kind: "website",
	mood: ["loud", "playful", "retro", "joyful", "composed-chaos"],
	name: "Tutti",
	priceFeel: "accessible",
	preview: {
		accent: "#00B3A4",
		fontFamily: "Shrikhand",
		ground: "#FBF3E4",
		ink: "#201A1E",
		sampleWord: "Tutti !",
	},
	tagline:
		"La fête Memphis : confettis à motifs, ombres qui clashent, chaos composé.",
};
