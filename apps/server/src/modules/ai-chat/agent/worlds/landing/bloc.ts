import type { DesignWorld } from "../types";

/**
 * BLOC — market-stall neobrutalism.
 * Flat loud color blocks, 3–4px ink borders, hard black offset shadows,
 * big grotesk, honest prices said out loud. Fuses with maillot (the stall
 * goes to the match — sport retail) and affiche (the stall prints its own
 * posters — launches, events).
 */
export const bloc: DesignWorld = {
	avoidFor: [
		"lawyer / law firm",
		"notary",
		"aesthetic clinic",
		"fine dining",
		"jewelry brand",
		"psychology / therapy",
	],
	doc: `# DESIGN WORLD: BLOC — the market stall that shouts its prices

## Philosophy
This page is a MARKET STALL, not a website. Everything on it is a CRATE: a flat slab of loud color, a 3–4px ink border, a hard black shadow thrown on the ground with zero blur. The stall-keeper painted the signs himself, stacked the boxes himself, and shouts the price before you ask — that confidence IS the design. Defining structural facts: every element is a BLOCK (flat fill, ink border, offset shadow, border-radius 0); the PRICE is content, not fine print — it lives in an oversized rotated chip you can read from across the street; NOTHING is translucent, blurred, gradiented or gray — color is applied like poster paint, full strength or not at all. Impossible failure modes: a subtle gradient wash, whispering luxury, a hidden price, gray-on-gray timidity, an element that floats without a shadow to prove its weight. Joy through audacity, zero subtlety, extreme legibility. Self-audit before shipping: (1) zero blur radii anywhere in the stylesheet; (2) zero border-radius above 2px; (3) every interactive element carries the ink offset shadow; (4) at most 5 flat colors + ink on the whole page; (5) a real price or offer readable in the first viewport; (6) no tween longer than 0.25s except the ticker loop and stepped counters.

## The variation contract (why two BLOC sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- 3–4px solid ink borders on everything; every crate's corners consume var(--radius) directly — zero, this stall's blocks stay square (2px absolute ceiling, and only to kill anti-alias fringing).
- The hard offset shadow: ALWAYS ink-black, always zero blur, 6–10px. Never colored, never soft.
- Flat color only. No gradients anywhere — not in art, not in text, not in a hover. No alpha except native focus rings.
- Instant-snap motion: expo.out or steps(), every tween ≤0.25s. Nothing drifts, nothing floats, nothing bounces.
- A heavy grotesk at 700–800 for display; prices in the display face inside clashing chips.
- Honest commerce voice: real prices, real stock, real delays, said loudly.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside the registers (accent #2B5BFF/#2450E4/#3366FF; yellow #FFC700/#FFD21E/#F5B800; pink #FF6BA6/#FF5C93/#FF7DB0), and WHICH support dominates the slabs (a yellow-forward garage and a pink-forward streetwear shop are both BLOC).
- The display face within the register: Archivo Black or Bricolage Grotesque 700–800, one per site.
- The CONCEPT NOUN that drives the page — l'étal, le comptoir, le garage, la caisse, le vestiaire — it names the showpiece scene, the hero offer and the copy voice.
- The drawn objects (garments, burgers, wrenches, dumbbells), the rotation set (each site picks 3–4 angles from −8°…+8° and reuses ONLY those), the slab sequence, and the section order beyond the fixed opening and closing.
A BLOC page with no visible price in the first two viewports is a failure: the stall exists to sell, out loud.

## The vibe (voice)
Street-smart French, short and frontal, prices spoken like a vendor calls them. Zero marketing perfume, zero superlative inflation — the confidence comes from facts. Examples of register: "4 900 DA. Pas un centime caché." · "120 pièces. Après, c'est fini." · "On ne fait pas de promo. On fait des prix justes." One honest concession per page ("Le M part vite, on préfère te le dire.") builds more trust than ten adjectives. Exclamation marks: maximum one per page — the design already shouts.

## Visual signatures
- HARD BLACK OFFSET SHADOW (owned tic): box-shadow Xpx Xpx 0 0 #111111 with X ∈ 6–10px (8px is canon; 10–12px for hero blocks and the showpiece board), zero blur, zero spread, always ink. EVERY interactive element carries it. Hover/focus: translate(−2px,−2px) and the shadow grows +2px; active: translate(3px,3px) and the shadow collapses to 2px — the block physically presses into the page. 80–120ms transitions.
- 3–4PX BORDERS + MARKER HIGHLIGHTS (owned tic): 4px solid ink on cards, buttons, inputs, art frames and section slab edges; 3px on chips and small furniture. Key words in headlines get a marker highlight: a flat support-color band (mark element), padding 0.04em–0.14em, box-decoration-break: clone, no rounding — a highlighter swipe, never a pill.
- CLASHING PRICE-CHIPS (owned tic): prices and stock callouts set in the display face at 1.3–2.4rem inside a bordered chip rotated from the site's angle set (−8°…−3° or +3°…+8°), 3px border + 6–8px ink shadow. The chip color must CLASH with its ground: pink on blue, blue on yellow, yellow on paper — never tone-on-tone. Chips overlap their parent card's edge by 8–16px like a tag stapled on.
- FLAT COLOR SLABS: sections may be full-bleed support-color grounds (the yellow slab, the pink slab, the blue slab). 2–3 color slabs per page, never two adjacent, never the same color twice in a row, separated by paper sections. Exactly ONE ink slab per page (the footer, or one interlude), where borders flip to paper and shadows disappear (ink on ink is invisible — the ink slab is the only shadowless zone).
- DRAWN FLAT OBJECTS: all imagery is hand-built SVG in poster style — 4–6px ink strokes, flat fills from the palette (1–3 colors per object), boxy exaggerated proportions, resting rotation −3°…+3°. No shading, no gradients, no photoreal, no photography ever.
- THE TICKER: one single-direction marquee band, 4px ink borders top and bottom, support-color ground, display face, uppercase, separator "·", 20–30s linear loop. ONE per page maximum, horizontal, never rotated (rotated crossing marquees are CINÉTIQUE's).
- BLOCK-CREAM: blocks sitting on paper or on slabs use the block-cream register (#FFF6E9/#FFF3DF), one step lighter than the paper ground, so every crate reads as an object ON the stall, not a hole in it.

## Color physics
- GROUND: warm paper, the #FAEFDC/#F6E8CE register. Block-cream #FFF6E9/#FFF3DF for cards and form blocks. Never pure white, never gray.
- INK: #111111 exactly. All borders, all shadows, all body text. Never softened, never transparent.
- ACCENT: electric blue, the #2B5BFF/#2450E4/#3366FF register. Budget: primary CTAs, links, ONE slab, one chip color, art fills. Text on blue is paper, never white-white.
- SUPPORTS: flat yellow #FFC700/#FFD21E register and pink #FF6BA6/#FF5C93 register. They own the marker highlights, the chips, the slabs and art fills. Ink text on yellow and pink always.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · GROUND→--primary-foreground · BLOCK-CREAM→--secondary · dominant SUPPORT→--accent · ink at 62%→--muted · INK→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every register sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Slab rhythm IS the page rhythm: paper → color slab → paper → different color slab. The clash between a chip and its ground is a designed decision every time — audit every chip: if it doesn't clash, recolor it.
- Gradients exist NOWHERE. Not in backgrounds, not in art, not in text. Depth is the offset shadow; light is a lighter flat plane. Alpha exists nowhere except the browser's own focus ring if unstyled (style it anyway: 3px solid outline in the accent, offset 2px; on blue slabs the outline flips to yellow).

## Typography system
- DISPLAY: Archivo Black or Bricolage Grotesque (700–800), ONE per site. Always uppercase for headlines and prices. Tracking −0.01em to −0.025em. Display never below 1.2rem — small display text is a contradiction.
- BODY: Public Sans or Archivo, 400/600/800. 1rem–1.06rem, line-height 1.5–1.6, measure ≤62ch, always flush left.
- Hero statement: clamp(2.6rem, 7.4vw, 6.2rem), line-height 0.96–1.04. Section titles: clamp(1.9rem, 4.2vw, 3.6rem). The scale ratio hero:body lives around 6:1 — loud but readable from the street.
- LABELS: body face 700–800, uppercase, 11–13px, tracking +0.05–0.1em, ALWAYS inside a 3px-bordered chip — never floating letter-spaced whispers on bare ground (that is ÉCRIN's language).
- NUMERALS AND PRICES: display face, inside chips or stat blocks. Big numerals (step numbers, stats) may hit clamp(2.4rem, 5vw, 4rem) in a support color with the ink border discipline around them.
- NEVER italic — emphasis is the marker highlight or the accent color, nothing else. Never a weight under 400. Never a serif, never a mono.
- Arabic pairing: display Cairo 700–900, body IBM Plex Sans Arabic 400/700. Same borders, same shadows, same chips; mirror the rotation set and shadow direction in RTL (shadows fall left: −8px 8px).

## Signature art / components
- DRAWN OBJECTS: each product/service is ONE bold SVG object — a hoodie, a burger, a wrench, a moving box — built from simple shapes, 4–6px ink strokes, flat palette fills, no perspective, no shadows inside the drawing (the block's offset shadow does that job). Each drawn scene carries role="img" and a real aria-label in the page's language. Decorative repeats are aria-hidden.
- BUTTONS: bordered filled blocks, display or 800 body face, uppercase, 14–18px padding block / 20–28px inline, 6px shadow, the press interaction (hover lift / active press) mandatory with keyboard parity via :focus-visible.
- CARDS: 4px border, block-cream ground, an art zone with a support-color ground separated by a 4px internal border, name in display, one spec line in body, price-chip overlapping the card edge, 8px shadow.
- FORMS: fields are bordered blocks — 3px ink border, block-cream ground, 12–14px padding, font inherited at 1rem; labels are chips above the field, never placeholders-as-labels. Phone-first: input type="tel" with a local placeholder; structured choices (wilaya, service, taille) in a bordered select. Invalid: 3px pink border + a frank message ("Il manque ton numéro."). Success: an honest bordered block stating exactly what happens next, with the visitor's name if given. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, wilaya, … }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads, fills or references.
- THE LETTER-CRATE WORDMARK: on the ink footer slab, the brand name set one letter per bordered square tile, tiles cycling yellow/pink/blue/block-cream, ink letters (paper on blue) — the stall's crates stacked into a name. Footer only.
- FAVICON: inline SVG data URI — two offset bordered squares in yellow and blue on paper.

## Page chassis
- Vertical rhythm: section padding clamp(4rem, 9vh, 7rem). Containers 1200–1360px; slabs and the ticker bleed full width.
- Every section carries overflow-x: clip (the footer too): entrance and scrub offsets start off-stage, and the clip is what keeps them from widening the page at 390/768/1440. Never rely on html-level clipping alone.
- HEADER: chunky bar, paper ground, 4px ink bottom border, sticky allowed. Logo in a small bordered shadowed block; nav links as 3px chips; ONE shadowed accent CTA. The ticker may run directly above or below the header.
- FIXED OPENING (hero law): the offer and a price/date must be readable in the first viewport. Two hero families: the SPLIT STALL (headline + marker + CTA on one side; a stack of 2–3 overlapping art/offer blocks on the other) or the PILE (a central stacked composition of blocks with the headline as the biggest crate). Both include at least one clashing chip and two info chips of honest facts (payment, delay, exchange).
- FIXED CLOSING: the form-as-block section (split: shouted headline + honest promise on one side, the bordered form block on the other), then the ink footer: letter-crate wordmark, chip links (real hrefs — tel:, mailto:, social), one honest legal line. No shadows on the ink slab.
- FREE MIDDLE (compose 3–5, never two adjacent sections with the same layout): the showpiece assembly scrub · LA CAGETTE product/service grid · L'ESCALIER numbered steps · LA CRIÉE statement slab with stat blocks · LE TICKET DE CAISSE itemized price list · LE PORTE-VOIX question rows. Section labels are numbered chips ("01 — LE DROP").

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: instant snaps. Every hidden state set via gsap.set, never in CSS; gate everything on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). JS dead → the stall stands fully built, every block in place with its shadow.
- Easing identity: expo.out for movement, steps(1–4) for pops, power1.out only for the shadow beat. Durations 0.12–0.25s. NOTHING exceeds 0.25s except the ticker loop (20–30s linear) and stepped counters (steps(6–8) over 0.5–0.8s — a chain of instant jumps, not a glide).
- THE CLAC-CLAC (entrance law): a block snaps in from a 24–48px offset in 0.18–0.22s expo.out, then its shadow lands 0.08–0.12s later (boxShadow tweens from 0 0 0 to its resting offset) — two beats, like a crate hitting the stall then settling. Stagger 50–90ms between blocks. Opacity never animates alone; it rides the movement.
- SHOWPIECE TYPE — the ASSEMBLY SCRUB: one pinned scene per page where the offer builds itself block by block on scroll (scrub 0.4–0.6, end +=1400–1800px). Pieces fly in from alternating directions with a rotation overshoot of ±10–14° settling to the rest angle, each shadow landing a beat after its block. INTERLEAVE the order across the board (top piece, bottom piece, left, right — never all the top row first) so the scene fills evenly at every scrub depth and the hero chip of the offer slams LAST; a board that stays half-empty mid-scrub is a dead zone. Mobile (<768px): no pin — pieces clac-clac in on view, scene pre-composed in CSS.
- HOVER: the press interaction only (lift −2px / press +3px), 80–120ms, keyboard and touch parity. No color fades, no underline slides, no scale glides.
- Counters snap through values (snap: 1, stepped ease); the ticker is CSS, killed under prefers-reduced-motion.
- REDUCED MOTION: the composed page, ticker frozen, showpiece at its final assembled frame, counters at final values. A designed still, never a blank.

## Bloc ban list (in addition to the global one)
- The die-cut sticker halo and peel-corner hover — that is GOMMETTE's language.
- Colored offset shadows and Memphis confetti — that is TUTTI's language; BLOC's shadows are ink-black only.
- Fit-to-viewport headlines and poster-ground section rotation — that is AFFICHE's language.
- Torn-paper edges, misregistered print layers, tape and ransom letters — that is FANZINE's language.
- Rotated crossing marquee strips — that is CINÉTIQUE's language; BLOC's ticker is single, horizontal.
- Viewport-scale words as layout structure — that is MANIFESTE's language.
- back.out overshoot, squash-and-stretch, bounces — that is GUIMAUVE's language.
- Border-radius above 2px; pills of any kind.
- Gradients anywhere; box-shadow with blur; text-shadow; backdrop-filter.
- Photography or photoreal rendering.
- Italic characters; weights under 400; gray text or gray anything.
- Pastels or desaturated tones — every color at poster strength.
- Slow fades, parallax drifts, floating loops — nothing on a BLOC page hovers in the air.
- More than one ticker; more than one ink slab.

## LES GESTES (moves menu)
- L'ÉTAL — the assembly scrub showpiece: a big bordered board on a slab; product cards, price chips and stock tags slam in one by one as you scroll, shadows landing a beat late; ends fully stocked with the pack price as the last chip.
- LA PILE — hero as a stack of 2–3 overlapping rotated blocks (art crate, date crate, stock crate), each with its own ground color, reading order top-left to bottom-right.
- LE PANNEAU — hero as stacked hand-painted sign boards: headline split across 2–3 full-width bordered planks in alternating grounds, slight alternating rotation from the angle set.
- LA CAGETTE — the crate grid: products/services in an irregular 12-column grid (one cell spans double), each card with art zone, spec line and a clashing overlapping price-chip.
- L'ESCALIER — numbered steps as a staircase: 3–4 bordered blocks in a row, each offset 24–32px lower than the last, giant display numerals alternating accent/support.
- LA CRIÉE — the statement slab: one shouted 2–6 word sentence at clamp(2.4rem,5vw,4.2rem) with a marker highlight, beside a 2×2 grid of stat blocks whose numerals snap-count on view.
- LE TICKET DE CAISSE — an itemized honest price list in one tall bordered block: rows of service + dotted leader + price, a 4px rule, then the total in a rotated chip. Kills price-page boredom dead.
- LE COMPTEUR — stat numerals that snap through 6–8 stepped values on view (never glide), suffix chips (DA, H, %) bordered beside them.
- LE CLAC-CLAC — the two-beat entrance played as a visible rhythm on a key section: blocks land left-to-right in reading order, 70ms apart, shadows following like echoes.
- LE TICKER — the single bordered marquee band carrying the offer's facts (date · stock · payment · delivery), placed above the header or between two paper sections.
- LE PORTE-VOIX — questions as bordered accordion rows with display-face questions and a rotating plus glyph; one row open by default; frank two-sentence answers.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- PLATEFORME (streetwear drop, Algiers) — SPLIT STALL hero: headline "LE DROP N'ATTEND PERSONNE." left, a pile of hoodie-art + date + stock crates right. Showpiece: l'étal — the Friday stall assembles hoodie/tee/cap cards then the pack chip slams last. Blue slab étal, yellow rules staircase, pink criée. Mood: street-smart, impatient; clac-clac entrances everywhere.
- LE COMPTOIR (smash burger, Oran) — PILE hero: the burger itself drawn as stacked bordered blocks (bun/steak/cheddar crates), price chip planted on top. Showpiece: the burger assembles layer by layer on scrub, each layer a colored slab dropping in. Yellow-forward; TICKET DE CAISSE for the menu; ends on "Compte 12 minutes. C'est frais, c'est tout."
- GARAGE ZITOUNI (mechanic, Algiers) — PANNEAU hero: three painted sign planks "VIDANGE / FREINS / DIAGNOSTIC" with the forfait price chip on plank two. Showpiece: the workbench — oil can, filter, tools and the forfait chip assemble on a pegboard-style bordered board. Blue-forward, ESCALIER for the 3-step process, COMPTEUR stats (voitures/an, ans d'expérience).
- IRONBOX (crossfit, Bab Ezzouar) — SPLIT hero where the right block is one giant price crate ("3 500 DA/MOIS" as the art). Showpiece: the barbell loads — plates snap onto a drawn bar one by one, each plate a price tier chip. Pink clashing on blue slabs; CRIÉE: "PAS DE MIROIRS. PAS D'EXCUSES."; hover presses feel like racking weight.
- KILO & FRÈRES (moving company, Constantine) — CAGETTE hero: the first viewport IS a crate grid (truck art, price chip, wilaya chip, date chip) with the headline spanning two cells. Showpiece: boxes stack into a drawn truck silhouette on scrub, tetris-tight. Yellow slabs; TICKET DE CAISSE for the devis; voice: "On porte. Tu pointes du doigt."
- PRESSING TURBO (car wash, Oran) — TICKER-led hero: the band runs above a PILE of three wash-formula crates with clashing chips. Showpiece: the drawn car slides through three station blocks (mousse/rinçage/séchage) that stamp it clean on scrub. Blue-forward, PORTE-VOIX for the honest questions ("Ça raye ? Non. Voilà pourquoi.").
- CODE 19 (driving school, Sétif) — ESCALIER hero: the four steps to the permit ARE the hero, descending staircase with the price chip on step one. Showpiece: the checklist — exam items snap-check themselves one by one on scrub, ending on "97% du premier coup, et on t'explique les 3%." CRIÉE in pink; counters for hours and pass rate.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the SHADOW DISCIPLINE (every interactive element, ink-only, zero blur — one soft shadow and the whole stall collapses into a template), the SNAP TIMING (≤0.25s everywhere; one lazy 0.6s fade and the street confidence dies), and the LOUD HONEST PRICE (a clashing chip in the first viewport — a BLOC page that hides its price has no reason to exist). The cheap details that separate it from a generated page: the active press-down state, the shadow landing a beat after its block, the chip overlapping its card edge, the marker highlight cut exactly around the words, the one honest concession line in the copy. When in doubt, make it louder and truer — subtlety is the only thing this world cannot afford.`,
	energy: "loud",
	family: "neobrutalism",
	// maillot: the stall goes to the match — sport retail.
	// affiche: the stall prints its own posters — launches, events.
	fusesWith: ["maillot", "affiche"],
	id: "bloc",
	industries: [
		"sports club / academy",
		"rental (chairs, decor, sound)",
		"streetwear / drops",
		"multi-product shop",
		"barber",
		"fast food",
		"street food / food truck",
		"pizzeria",
		"food delivery brand",
		"gym / fitness club",
		"crossfit / functional",
		"electronics / gadgets",
		"spare parts",
		"car wash & detailing",
		"garage / mechanic",
		"moving company",
		"cleaning company",
		"driving school",
		"grocery / gourmet",
	],
	kind: "website",
	mood: ["loud", "honest", "street-smart", "joyful", "direct"],
	name: "Bloc",
	priceFeel: "accessible",
	preview: {
		accent: "#2B5BFF",
		fontFamily: "Archivo Black",
		ground: "#FAEFDC",
		ink: "#111111",
		sampleWord: "OUI.",
	},
	tagline:
		"L'étal néobrutaliste : blocs francs, ombres dures, prix criés haut.",
};
