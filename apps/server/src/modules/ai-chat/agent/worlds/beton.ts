import type { DesignWorld } from "./types";

/**
 * BÉTON — neo-brutalist punk poster wall.
 * The anti-subtle world: cream paper, 3-5px ink borders on everything, hard
 * 0-blur offset shadows, sticker rotations, outline-stroke display type, two
 * hyper-saturated accents used as color-blocking fields, marquee strips, and
 * mechanical 100-200ms motion. Explicitly overrides several global builder
 * rules (shadows, timing bands, alpha text, smooth scroll) — each override is
 * declared inside the doc. The doc is appended VERBATIM to the builder prompt.
 */
export const beton: DesignWorld = {
	avoidFor: [
		"law",
		"medical",
		"clinic",
		"luxury-real-estate",
		"wedding",
		"finance",
		"insurance",
		"funeral",
		"spa",
	],
	doc: `# DESIGN WORLD: BÉTON — the flyposted wall

## Philosophy
This page is a WALL, not a website: a concrete pillar with three generations of gig posters pasted over each other, a photocopied fanzine, a risograph run that lost its second ink, the side art of an arcade cabinet. Every single thing here is a PHYSICAL PRINTED OBJECT — a rectangle of paper, cut, outlined in ink, slapped on slightly crooked, casting a hard shadow because it sits six millimetres off the surface.

Two laws generate the world; everything else follows.

LAW ONE — IF IT HAS NO BORDER, IT DOES NOT EXIST. Every plate, chip, button, input, select, image frame, table cell, badge, nav bar, marquee band and form field carries a SOLID ink border of 3px, 4px or 5px. No hairlines, no borderless cards, no separation-by-whitespace. Exactly three things may be borderless and they are named later: pattern layers, tape strips, cut-out photography.

LAW TWO — DEPTH IS OFFSET, NEVER BLUR. A plate is raised because a solid ink rectangle sits behind it, shifted down-and-right by an exact number of pixels. Elements do not glide in, they SLAM. Buttons do not lighten on click, they PRESS DOWN and cover their own shadow. Cards do not fade on hover, they LIFT. One light source, one direction, no softness anywhere.

This world DELIBERATELY OVERRIDES five global builder rules — declare each one before writing CSS:
- Overrides the global shadow discipline: box-shadow is MANDATORY here, but only as a zero-blur, zero-spread, solid-ink offset. Any blur radius above 0 is a correctness bug.
- Overrides the global timing bands: entrances are 260-420ms, not 900-1400ms; feedback is 90-140ms; nothing but the marquees and one closing move exceeds 420ms.
- Overrides the global "secondary text and borders are alpha steps of the ink" rule: text is FULL ink or FULL paper, never 70 percent of anything.
- Overrides the global editorial-italic accent: no italics exist. Emphasis is a color FIELD, a BOX or an outline STROKE — devices that work identically in Arabic, which is why this world mirrors to RTL better than any editorial one.
- Bans smooth-scroll libraries outright (Lenis included): smoothing the scroll softens the one thing this page may not soften.

## The vibe
Loud, blunt, funny, completely unembarrassed — the shop that writes its prices on the window in marker pen and means it. Confidence without polish, energy without chaos: the rotations are authored, the grid is real, the borders are consistent. Punk that can spell.

Copy rules, non-negotiable, they carry 40 percent of this design:
- HEADLINES ARE 2-5 WORDS, uppercase, verb-first, no subordinate clauses: "ON LIVRE. TU PAIES APRÈS." / "TOUT EST EN STOCK." / "COUPE À 15H, PROPRE À 15H30." The full stop is part of the design.
- EXACTLY ONE line of every headline wears a highlight box (specified in Typography). Never two.
- NUMBERS ARE THE ARGUMENT — write them huge and bare: 48H · 2 ANS · 100% · 24/7 · N. 01. A claim with a number beats a sentence, always.
- EXCLAMATION MARKS ARE RATIONED: maximum three on the whole page. Loud typography means the punctuation need not shout too.
- MICRO-COPY IS STENCILLED, not written: mono uppercase fragments — SEC. 03 / LIVRAISON, STOCK LIMITÉ, PAIEMENT À LA LIVRAISON, GARANTIE 12 MOIS. Stamps, not sentences.
- Validation errors are blunt and human: "Numéro incomplet. 10 chiffres." / "Il manque ton nom." Never a red paragraph of apology.
- Banned words: solutions, seamless, elevate, experience, transform, revolutionary, premium, plus their French and Arabic equivalents — and in this world specifically "n'hésitez pas", "notre équipe est à votre écoute", "bienvenue sur notre site".
- Write it in the brief's language; Arabic follows the RTL section below.

## Visual signatures (what makes it instantly recognizable)
- A cream photocopy-paper ground — never white — under a faint engineering GRAPH GRID or a HALFTONE dot field, so the page reads as printed stock, not as a screen.
- Every element outlined in solid ink at 3, 4 or 5px. Zero radius. Zero hairlines.
- Hard offset shadows in exactly three sizes — 3px 3px 0, 6px 6px 0, 10px 10px 0 — solid ink, zero blur, always down-and-right. One element per page may take an accent-colored offset instead.
- STICKER ROTATIONS at -3, -2, -1.5, 1, 2 or 3 degrees. Never a value outside that set, never more than four rotated elements per viewport.
- Display type at 800-900 weight, uppercase, negatively tracked, PLUS an outline-stroke variant (transparent fill, 2-4px ink stroke) for giant numerals and the closing wordmark.
- TWO hyper-saturated accents used as FULL FIELDS — whole sections, whole plates, whole bands — never as small decorative touches.
- Full-bleed MARQUEE STRIPS of mono uppercase text on ink, bordered top and bottom, travelling at a constant linear speed.
- Buttons that visibly travel 6px down-right when pressed, landing flush on the paper.
- Print-shop furniture: registration crosses, a drawn barcode rule, figure bands welded under photographs, a bordered starburst seal hanging off a corner.

## Color physics (instantiate with the brief's hexes — the physics is law, the hexes are the brief's)
Build eight tokens and never introduce a ninth hue.
- PAPER (the ground): the palette's lightest pole pushed toward photocopy cream — the #F5F1E6 / #F2EFE4 register. Never #FFFFFF, never a cool gray; if the brief's lightest hex is pure white, warm it by 4-8 RGB points first.
- PAPER-2: a second ground 3-6 RGB points darker (the #EAE5D6 relationship), used ONLY for section alternation and input interiors.
- INK: a near-black carrying the palette's temperature, the #121110 / #16130F register. INK draws every border, every shadow, every rule, every icon stroke and all body text at FULL opacity. No #333, no #666, no gray exists in this world.
- ACCENT-A (the shout) and ACCENT-B (the counter): two hyper-saturated hues from the brief, minimum 80 percent saturation. They are FIELDS, not touches. If the brief hands you pastels, push saturation and keep hue — a muted BÉTON is a dead BÉTON.
- On an accent field text is ALWAYS ink, never white, so every accent must clear 4.5:1 against INK, not against paper. An accent too dark for ink text becomes a ground for PAPER text and stops being a field for copy. Text on INK chapters is PAPER, never #FFF.
- ALARM: one signal hue for validation only (the #E4341F register if neither accent already owns red), appearing in exactly two places — error text and the error field's offset shadow.
- ALPHA IS A LAYER PROPERTY, NEVER A TEXT PROPERTY. Text, borders, shadows, rules and icon strokes are FULL ink or FULL paper at every size — the single exception on the page is the input placeholder at ink .45. Any other rgba text or border color is a Pass-1 correctness bug, and a #333 or #666 anywhere is a bug in every case.
- Alpha exists on exactly five LAYERS and nowhere else: pattern strokes (ink .08-.20), the flat scrim over full-bleed photography (ink .28), the risograph multiply layer (accent .45), the hazard stripe (.9), and tape (accent .92). Five layers, one placeholder, nothing more.

FIELD COVERAGE IS MEASURED: accent fields plus ink chapters must cover 30-45 percent of the finished page's vertical run — an accent hero plate, a full accent section, two ink marquees, an ink chapter, an ink footer. A page whose accents appear only on buttons and links has failed this world completely, however correct the hexes are.

GROUND SEQUENCE — the page alternates in HARD CUTS, never whispers. A twelve-section page runs: paper+grid, ACCENT-A field, paper, INK marquee, paper+halftone, INK chapter, paper-2, ACCENT-B field, paper, INK marquee, paper, INK footer. Never two identical grounds in a row, never more than two paper sections between two colored ones.

Declare color-scheme light on :root and a theme-color meta matching PAPER. ::selection is ACCENT-A with INK text.

## Typography system
THREE families, three jobs, zero overlap. Load only the weights you use.
- DISPLAY (800/900 only): every headline, the wordmark, prices, giant numerals, button labels. Territory: a heavy grotesk with tight caps — Archivo Black, Anton, Bebas Neue, Oswald 700, Familjen Grotesk 800, Chivo 900. Condensed reads more punk, wide reads more American-poster; pick one register and never mix.
- BODY (400/700): paragraphs and longer copy. Territory: a workhorse grotesk with a mechanical skeleton — Chivo, Public Sans, Archivo, Space Grotesk. (Inter, Roboto and Open Sans are globally banned.)
- MONO (400/500/700): the LABEL VOICE, doing a third of the work here. Every micro-label, chapter stencil, figure number, marquee item, form label, badge, table header, price sub-line and caption is mono uppercase. Territory: Space Mono, DM Mono, JetBrains Mono, Martian Mono. Without a mono label voice the page reads as generic bold, not as BÉTON.

SCALE — all clamp, all committed:
- Hero h1: clamp(3.2rem, 11vw, 9.5rem) / line-height .84 / letter-spacing -.03em / weight 900 / uppercase.
- Section h2: clamp(2.3rem, 6.4vw, 5rem) / .88 / -.025em / 900 / uppercase.
- Sub-head h3: clamp(1.3rem, 2.6vw, 2.1rem) / 1.0 / -.012em / 800 / uppercase.
- Body: 1.0625rem / 1.5 / weight 400. (1.5, not 1.6 — this world is denser and blunter than an editorial one.)
- Lede: clamp(1.05rem, 1.5vw, 1.25rem) / 1.45 / weight 700, capped at 32em.
- Mono micro-label: .72-.82rem / uppercase / letter-spacing +.16em / weight 700.
- Price: clamp(2.6rem, 5.6vw, 4.4rem) / weight 900 / -.02em / tabular-nums.
- Giant numeral (outline): clamp(3.5rem, 9vw, 7rem) / weight 900 / stroke, sitting behind content.
- Closing wordmark: clamp(3rem, 17vw, 15rem) / line-height .78 / letter-spacing -.02em / weight 900.

TRACKING IS A FUNCTION OF SIZE: -.03em above 100px, -.025em at 50-100px, -.012em at 30px, 0 at body, +.16 to +.22em at mono micro-labels. Target a display-to-micro ratio of at least 10:1 — this world is MORE contrasty than a calm one, not less.

THE OUTLINE-STROKE VARIANT — one utility class, five applications: color transparent with -webkit-text-stroke Npx INK, where N is 2px below 6rem, 3px from 6rem to 12rem, 4px above 12rem. Use it on the giant step numerals, one repeated word in the hero wordmark stack, a ghost word behind a section, the closing footer wordmark (stroked in PAPER on the ink footer), and one word inside a headline. MANDATORY FALLBACK: wrap it in an @supports (-webkit-text-stroke: 1px #000) block and outside that block set the same element to color INK at opacity .12, so unsupported browsers get a ghost word instead of nothing.

THE HIGHLIGHT BOX — the device replacing the editorial italic. An inline-block span inside a headline: background ACCENT-A, color INK, padding .02em .16em, border 3px solid INK, box-shadow 4px 4px 0 INK, and on exactly one instance per page rotate(-1deg). Add margin-block .06em so boxes do not collide inside line-height .84.

THE TEXT OFFSET: exactly ONE headline per page may carry text-shadow 4px 4px 0 ACCENT-B, zero blur. Any text-shadow with a blur radius is banned.

NEVER LET A DISPLAY HEADLINE AUTO-WRAP. Break every h1 and h2 into explicit block-level line spans so the rag is AUTHORED, and reuse those spans as the animation stagger targets. Underlines are text-decoration-thickness 4px at text-underline-offset 6px in ACCENT-A.

PROMOTE NUMERALS: in any spec row wrap the number in the display face at 1.4rem weight 900 inside a .95rem body line, tabular-nums. "LIVRAISON — 48H" with a display 48 inside a body sentence is the whole mechanic.

## Page chassis
- ANNOUNCE MARQUEE (required — the world's opening gesture): a full-bleed strip above the nav, height 34px mobile / 38px above 768px, INK ground, PAPER mono at .74rem / +.14em uppercase, border-bottom 4px INK. Two duplicated chunks in a width max-content track animated translateX(-50%) over 24s linear infinite, items separated by a 6px ACCENT-A square glyph (aria-hidden), never a bullet dot.
- NAV: sticky, top 0, z-index 200 — a PLATE, not a transparent bar: PAPER ground, border-bottom 4px INK, height 66px mobile / 76px desktop, padding-inline the gutter token. Past 40px of scroll it does not blur or fade, it SNAPS: a scrolled class swaps the background to ACCENT-A and the border to 5px over 120ms linear — a hard state change, visible in one frame.
- WORDMARK IS A STICKER: the name in DISPLAY 900 at 1.15-1.35rem uppercase inside a PAPER plate, 3px INK border, box-shadow 4px 4px 0 INK, padding .3em .6em, rotate(-2deg), straightening to 0deg on hover over 120ms. A mono sub-label at .62rem / +.2em may sit beside it, outside the plate.
- NAV LINKS: mono uppercase .78rem weight 700, with a 3px INK bar drawn by ::after at bottom -6px going scaleX(0) to scaleX(1) from transform-origin left over 130ms. The current section's bar stays filled in ACCENT-B.
- NAV CTA: a small button plate, ACCENT-A field, 3px border, 3px 3px 0 shadow.
- BURGER: a 46px SQUARE plate, 3px INK border, 3px 3px 0 shadow, three 3px INK bars at 6px gaps. On tap it presses (translate(3px,3px), shadow 0) and the bars snap to an X over 140ms — top rotate 45deg translateY(9px), middle scaleX(0), bottom rotate -45deg translateY(-9px).
- MOBILE MENU: a full-screen PAPER takeover carrying the graph grid at z-index 300, links as full-width bordered plates stacked at -3px margins so borders collapse into single rules. Each link is DISPLAY 900 at clamp(2rem,9vw,3.2rem) uppercase; every second plate takes an ACCENT-A field. They slam in from y -24 at .26s power4.out with a .06 stagger.
- THE COORDINATED OFFSET — derive all three from the measured strip+nav stack, never guess: hero min-height calc(100svh - 7rem), sticky column top 7.5rem, scroll-margin-top 6rem on every anchored section.
- GLOBAL BASE: html, body overflow-x clip (required — this world rotates, bleeds and overlaps constantly). No scroll-behavior smooth beyond native anchor jumps. :focus-visible is outline 3px solid INK at outline-offset 3px, switching to PAPER on ink chapters. A skip link snaps from top -5rem to top 1rem in 120ms into a bordered ACCENT-A plate.

## Hero forms (pick the one the shop calls for — every one of them is LOUD)
1. STICKER COLLAGE POSTER (default). A full-viewport PAPER field under the graph grid holding 6-8 bordered plates at authored positions and rotations. Above 1024px lay it on a 12-column / 8-row grid, gap 0, min-height calc(100svh - 7rem), position plates by grid-area and let them overlap on purpose.
- PLATE A, the headline: column 1/8, row 2/6, PAPER, border 5px INK, shadow 10px 10px 0 INK, rotate(-2deg), padding clamp(1.4rem,3vw,2.6rem). Three authored h1 lines, line 2 wearing the highlight box, plus a 32ch lede in the body face at weight 700.
- PLATE B, the photograph: column 7/13, row 1/7, border 5px INK, shadow 10px 10px 0, rotate(3deg), overflow hidden, aspect-ratio 4/5, with a welded caption band on its bottom edge (INK strip, margin-bottom -3px so borders collapse, mono PAPER .7rem uppercase, figure number on the end side).
- PLATE C, the offer chip: a small ACCENT-B plate, border 4px, shadow 6px 6px 0, rotate(-3deg), z-index above A and B, straddling their seam, carrying the price or the single loudest fact in DISPLAY 900.
- PLATE D, the actions: a wrapping flex row at gap 1rem holding the primary and secondary buttons, sitting on the paper OUTSIDE any plate at row 6/7, column 1/7.
- PLATE E, the seal: an inline-SVG 12-point starburst, 116px (86px below 768px), ACCENT-B fill, 3px INK stroke with miter joins, absolutely offset -24px from Plate A's top-left corner, rotate(8deg), holding two lines of 9px mono uppercase.
- TAPE: exactly two strips, 96x28px, ACCENT-A at opacity .92, rotate(12deg) and rotate(-8deg), crossing two different plate corners. Tape is borderless by exception — do not outline it.
- The hero TERMINATES IN A MARQUEE, never in whitespace: the first mid-page strip welds to its bottom edge.
- Between 900px and 1024px the collage keeps its overlaps but drops to a 6-column / auto-row grid: the headline plate spans columns 1/7 at row 1, the photo plate columns 3/7 at row 2 pulled up by margin-block-start -2.5rem so it still overlaps, the offer chip and the seal keep their offsets, rotations halve to -1deg / 1.5deg, and shadows drop one step. Never leave this band to auto-placement — an unspecified 960px viewport is where collage heroes fall apart.
- Below 900px it collapses to one column in DOM order: headline plate (rotate 0), photo plate (rotate 0), offer chip (keeps -2deg), full-width buttons. Rotation goes first on small screens because it costs horizontal room.
2. GIANT OUTLINE WORDMARK. The business name set THREE times as stacked full-bleed rows at clamp(2.6rem,15vw,13rem), line-height .78, weight 900, uppercase, nowrap, clipped: row 1 outline-stroked 3px INK on paper, row 2 FILLED INK inside a full-bleed ACCENT-A band with 5px INK borders top and bottom, row 3 stroked again. Over the stack, one PAPER plate at rotate(-1.5deg) with a 5px border and a 10px 10px 0 shadow carries the offer and the CTA. Beneath it a mono SPEC BAR: four collapsed-border cells, each a label above a display numeral. Best when the NAME is the product — barbershop, gaming café, streetwear label.
3. THE SPLIT SLAB (gadgets, single hero products). A hard vertical color-block cut with no gutter: left 58 percent ACCENT-A, right 42 percent INK, divided by a 5px INK rule, min-height calc(100svh - 7rem). Copy sits on the accent side in INK; a mono spec list sits on the ink side in PAPER with ACCENT-A numerals. The product is a CUT-OUT straddling the seam with no plate around it, carrying filter drop-shadow(8px 8px 0 INK) so it keeps the offset language without a frame — the second borderless exception. Below 900px the fields stack and the seam becomes horizontal.

## Section seams (BÉTON's own vocabulary — every boundary uses one, never the same twice in a row, at least five per page)
- HARD CUT: the ground changes to a full accent or ink field, announced by a 5px INK border-top. No gradient, no fade, no whitespace buffer. The default seam — at least three per page.
- MARQUEE STRIP: a full-bleed INK band 52-64px tall, border-block 4px INK, mono PAPER uppercase at .82rem / +.14em travelling translateX(-50%) over 24-30s linear. Adjacent strips run in OPPOSITE directions. Two or three per page, one of them the scrub-driven strip from Motion.
- STICKER CROSS: a rotated bordered plate straddling the boundary — margin-block-start -3.5rem, z-index 5, rotate -2deg, shadow 10px 10px 0. It belongs to neither section, which is the point. Once or twice per page.
- STENCIL RULE: a full-bleed 3px INK rule with a mono chapter label sitting ON it inside a small PAPER plate (3px border, 3px 3px 0 shadow), inset from the start edge by the gutter token — the title block of a technical drawing.
- SAWTOOTH: a 22px full-bleed strip whose top edge zigzags, drawn with two repeating-linear-gradients at 135deg and 45deg on a 44px repeat so the two fields interlock like a torn edge. Once, between the two accent fields.
- TAPE SEAM: two 110x30px tape strips at +11deg and -9deg crossing the boundary, one in each accent. Twice per page maximum.
- COLLAPSED RAIL: a full-bleed row of 3-5 bordered mono cells welded to the boundary, each pulled margin-inline-start -3px so shared edges are ONE 3px border. It holds real facts — delivery, hours, guarantee, payment — never adjectives.

## Layout physics
- ONE gutter token: clamp(1rem, 4vw, 3.25rem) — page padding AND the inset for absolutely positioned off-grid elements, so rotated stickers still land on the margin. Container max-width 88rem, but at least four sections are FULL BLEED with no container at all: marquees, accent fields, the collapsed rail, the pinned rail, the footer.
- Section block padding clamp(3.25rem, 7.5vh, 6rem). THIS WORLD IS 25 PERCENT DENSER THAN A CALM ONE — the air lives in the color fields, not the margins. A BÉTON page with 9rem of nothing between sections has misunderstood itself.
- BORDER SCALE, three steps and no others: 3px for cells, chips, inputs, buttons, small plates and rules · 4px for medium plates, the nav, marquee bands and tables · 5px for hero plates, the order card, boundary rules and the showpiece. Never 1px, never 2px (pattern strokes and tape excepted).
- SHADOW SCALE, three steps and no others: 3px 3px 0 INK on chips, badges, small controls and focused inputs · 6px 6px 0 INK on buttons, cards and standard plates · 10px 10px 0 INK on hero plates, the order card and the showpiece. Always solid, zero blur, positive and equal on x and y. Exactly ONE element per page may take an accent offset (6px 6px 0 ACCENT-B) — pick the thing you most want looked at.
- BORDERS COLLAPSE: in any row or grid of bordered cells pull each cell margin-inline-start -3px (and margin-block-start -3px when it wraps) so a shared edge renders as ONE 3px rule. Doubled 6px edges are the commonest tell of a lazy brutalist page.
- ROTATION BUDGET: -3, -2, -1.5, 1, 2, 3 degrees, full stop. Maximum FOUR rotated elements per viewport. Below 600px only badges and the seal stay rotated, at ±2deg.
- CHAMFER, the alternative silhouette: cut corners, never round them — clip-path polygon with an 18px chamfer on two opposite corners. CRITICAL: clip-path erases box-shadow, so a chamfered plate draws its offset with the SAME two-layer structure as the landing shadow — a position:relative wrapper holding a shadow layer (absolute, inset 0, background INK, translate(6px,6px), z-index 0, the identical clip-path) and a face layer (position relative, z-index 1, opaque ground, the same clip-path). Positive z-index on both, never z-index:-1: a rotated or GSAP-transformed plate is its own stacking context and a negative-z pseudo would paint on top of the face. Three chamfered elements per page maximum.
- RADIUS IS 0 EVERYWHERE. Two exceptions on the whole page: the circular seal and a maximum of TWO 999px stamp pills. This world answers the global "rows of same-size border-radius cards" ban by deleting radius from the vocabulary entirely.
- CARDS ARE PLATES and they are legal here: 0 radius, 3-4px INK border, 6px 6px 0 INK shadow, PAPER or PAPER-2 ground, ONE IN FOUR filled with an accent field — and never all the same size. In a grid of six, one plate spans two columns and carries the accent.
- GRIDS ARE NEVER 50/50: 1.25fr/.75fr copy-led, .82fr/1.18fr media-led, 7/5 for the transactional chapter. Column gaps clamp(1.5rem, 3.5vw, 3rem); collapsed-border rows use gap 0 instead.
- PATTERNS, the third borderless exception, all CSS or inline-SVG data URIs, never image files:
  - GRAPH GRID: two repeating-linear-gradients of 1px INK lines at .10 alpha on a 28px cell, plus a second pair of 2px lines at .16 alpha every 140px. Engineering paper — hero plus one other paper section.
  - HALFTONE: an inline-SVG data URI, a 4px circle on a 12px tile at INK .14; a denser variant (3px circle, 8px tile, .20) for use ON accent fields, where it reads as a risograph screen.
  - HAZARD STRIPES: repeating-linear-gradient(45deg, INK 0 8px, transparent 8px 18px) at .9 opacity — disabled states, the pending button, one warning band.
  - BARCODE: a repeating-linear-gradient of 6 hand-chosen stops giving bars of 2/3/5/8px at 3px gaps, 34px tall, INK on PAPER, aria-hidden — divider, price underline, footer ornament.
- IMAGERY: every photograph sits inside a bordered plate or is a cut-out with a drop-shadow offset. Exactly two or three get the RISOGRAPH treatment — filter grayscale(1) contrast(1.3) with an ACCENT-A layer above at mix-blend-mode multiply, opacity .45 — the rest stay untreated so the treated ones read as deliberate. Type over a photograph always gets a FLAT INK scrim at .28, never a gradient.
- OVERLAP IS STRUCTURAL: at least five elements break their container on purpose — the seal at -24px, the offer chip across the hero seam, the sticker-cross plate at -3.5rem, a giant outline numeral bleeding past its column, one marquee row starting before the viewport edge. Safe only because overflow-x is clipped on html and body and overflow clip sits on any piercing section.
- ONE sticky column per page at top 7.5rem, holding the order card or the hero product plate while three plates scroll past.
- RESPONSIVE COLLAPSE below 900px: multi-column grids become 1fr, rotations zero out, shadows drop one step (10 to 6, 6 to 4, 3 stays), 5px plate borders drop to 4px, the pinned rail becomes a native snap rail.

## Motion identity (GSAP 3 + ScrollTrigger from a CDN; native scroll — smooth-scroll libraries are BANNED in this world)
THE SAFETY CONTRACT COMES FIRST. Compute one flag: reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, hasGsap = typeof window.gsap !== "undefined", animate = hasGsap && !reduced. EVERY hidden initial state is set with gsap.set INSIDE that branch — never author opacity 0 or visibility hidden in CSS on an animated element. If the CDN fails the page is a complete, fully visible, fully functional poster. The prefers-reduced-motion block also sets marquee tracks to animation none and width auto, stops any seal spin, and removes the press translate while keeping the shadow.

TIMING BANDS — this world overrides the global bands; every duration belongs to one of these: 90-140ms interaction feedback (press, hover, bar draw, X snap) · 140-220ms state change (nav swap, accordion, focus shadow, tabs) · 260-420ms entrances, slams, reveals, the stamp pop · 700ms for the ONE long move (the closing wordmark) · 18-30s linear for marquees.

EASES — a short, hard list. GSAP: power4.out for slams and reveals · back.out(1.7) for the ONE stamp pop · steps(24) for the mechanical counter · none for every scrub and marquee. CSS: one token, cubic-bezier(.2,.9,.15,1), for hovers and presses, plus linear for hard color swaps. BANNED: ease, ease-in-out, sine, power1, power2, elastic, bounce (that single back.out is the entire exception). If a curve makes something feel like it eases to a gentle stop, it is wrong here.

THE MANDATORY MOTION SET:
1. HERO SLAM CASCADE. Read each plate's authored tilt from a data-rot attribute so JS never invents rotations: gsap.set(plates, {autoAlpha:0, y:-26, rotate:0, scale:1.03}), then tl.to(plates, {autoAlpha:1, y:0, rotate: (i, el) => el.dataset.rot, scale:1, duration:.34, ease:"power4.out", stagger:.07}), overlapping the h1 line rise at .12 and the buttons and seal at .34. Arrival completes near 750ms. Plates come from ABOVE (negative y) — posters being slapped onto a wall.
2. MASKED LINE RISE on every display heading, overriding the global rise timing: each authored line in an overflow hidden wrapper, yPercent 105 to 0, duration .3, stagger .06, power4.out, with padding-bottom .06em and margin-bottom -.06em so descenders survive. start "top 86%", once:true.
3. SNAP-IN REVEALS on roughly fifteen elements: gsap.set({autoAlpha:0, y:22, scale:.98}) then to({autoAlpha:1, y:0, scale:1, duration:.28, ease:"power4.out", stagger:.05}), start "top 88%", once:true. Fade-only reveals are banned — everything that appears must also travel.
4. THE LANDING SHADOW, the world's signature reveal. Do NOT tween box-shadow strings. Build the plate as TWO POSITIVE-Z LAYERS inside one position:relative wrapper — a SHADOW layer (position absolute, inset 0, background INK, z-index 0) and a FACE layer (position relative, z-index 1, the opaque PAPER or accent ground, the 3-5px INK border, and all the content). Set the shadow layer to translate(0,0) and tween it to translate(6px,6px) — 10px on hero plates — over .18s power4.out at delay .12 behind the plate's own reveal. The plate arrives, then its shadow snaps out from under it: the object visibly lands on the wall.
   NEVER draw this offset with a z-index:-1 pseudo-element. GSAP puts a transform on every plate (the slam cascade, and the authored rotation that never clears), a transform creates a stacking context, and inside that context a negative-z pseudo paints AFTER the element's own background — the ink block would cover the plate's face instead of sitting behind it. Two positive-z layers are immune to that, which is why every offset layer in this world (here, the chamfer, the step numerals) uses the same z-index 0 / z-index 1 pattern.
5. MARQUEES: announce and mid-page strips are pure CSS keyframes on a width max-content track of TWO duplicated chunks, translateX(-50%), 24s and 30s, linear, infinite, adjacent strips running in opposite directions.
6. THE SCRUB-DRIVEN MARQUEE, one per page and the world's cleverest move: build the strip as a GSAP tween (gsap.to(track, {xPercent:-50, duration:26, ease:"none", repeat:-1})), then a page-wide ScrollTrigger whose onUpdate reads v = self.getVelocity(), computes speed = Math.min(5, 1 + Math.abs(v) / 900) and runs gsap.to(tween, {timeScale: (v < 0 ? -speed : speed), duration:.18, overwrite:true}), plus a debounced 180ms idle reset back to timeScale 1 over .4s. Scroll fast and the wall shouts; scroll back and the text runs backwards.
7. THE SHOWPIECE — pick ONE, 3x the ambition of any other scene:
  a. PINNED STICKER RAIL: gsap.to(track, {x: -(track.scrollWidth - innerWidth), ease:"none"}) with pin:true, scrub:.35 (low scrub keeps it mechanical), anticipatePin:1, invalidateOnRefresh:true. Plates 78vw on the lead and 62vw after, alternating rotate -2 / 2 / -1.5, one plate 1.4x wider to break the metronome, inner reveals on containerAnimation. Wrap in gsap.matchMedia("(min-width: 900px)") with a teardown; the CSS default below is a native rail — overflow-x auto, scroll-snap-type x mandatory, scroll-snap-align start, scroll-padding-inline the gutter.
  b. COLOR-BLOCK WIPE: pin a section and scrub an ACCENT-A field across it via clip-path inset(0 100% 0 0) to inset(0 0 0 0), while a duplicated headline layered above at identical position (INK on the accent, clipped by the same inset) replaces the paper-side one as the field passes.
8. COUNT-UPS: a proxy tweened over .8s with ease "steps(24)" so the number CLICKS rather than glides, tabular-nums, toLocaleString with a thin space for thousands, once at "top 90%", plus a 4000ms setTimeout fallback painting the final value if the trigger never fires.
9. THE ONE POP: the seal, gsap.fromTo({scale:.6, rotate:-18, autoAlpha:0}, {scale:1, rotate:8, autoAlpha:1, duration:.42, ease:"back.out(1.7)"}). One per page.
10. THE CLOSING MOVE: the footer wordmark rises out of an overflow-hidden mask, yPercent 104 to 0, .7s power4.out — the only slow thing on the page, and it earns that by being last.

MICRO-INTERACTION KIT (all CSS, all inside the bands):
- PRESS, for anything you click to ACT (buttons, nav CTA, chips, steppers, burger, radio cards): rest box-shadow 6px 6px 0 INK · hover translate(-1px,-1px) with shadow 7px 7px 0 over 110ms · active translate(6px,6px) with box-shadow 0 0 0 0 over 90ms linear, so the control covers its own shadow and sits flush on the paper. The travel distance ALWAYS equals the shadow offset.
- LIFT, for anything you BROWSE (plates, cards, gallery items): hover translate(-3px,-3px) with shadow 9px 9px 0 over 140ms. Cards never press, controls never lift — keeping that distinction is what makes the page feel like a machine.
- Arrow glyphs are drawn SVG (3px stroke, square caps, miter joins) translating X 4px on hover in a SEPARATE 110ms transition from the button's own — two transitions, not one.
- Inputs on focus: the border stays INK while the box-shadow snaps to 4px 4px 0 ACCENT-A over 120ms. No glow, no ring, no color fade.
- Accordions: grid-template-rows 0fr to 1fr over 180ms with an overflow hidden inner; the icon is a plus of two 3px INK bars whose vertical bar goes scaleY(1) to scaleY(0) over 140ms.
- No hover on this page changes opacity alone. Every hover changes POSITION or FIELD.

## Components
- BUTTONS: rectangles, radius 0, DISPLAY 800 uppercase at .06em tracking, padding .95em 1.6em, border 3px INK, shadow 6px 6px 0 INK, inline-flex with gap .6em holding the drawn arrow. PRIMARY is an ACCENT-A field with INK text · SECONDARY PAPER with INK text · TERTIARY INK with PAPER text. Large 1.05rem / 1.05em 1.9em; small .82rem / .7em 1.15em with a 3px 3px 0 shadow. DISABLED does not fade, it is MARKED: hazard-stripe background, shadow 0, translate(3px,3px) so it reads as already pressed, cursor not-allowed. Opacity never communicates state in this world.
- BODY LINKS: INK text with a 3px ACCENT-A border-bottom, becoming a full ACCENT-A field with .1em horizontal padding on hover over 120ms.
- INPUTS: PAPER-2 ground, border 3px INK, radius 0, padding .85em 1rem, body face 1rem, INK text. Placeholder is INK at .45 — an alpha exception allowed only here. Labels sit ABOVE in mono uppercase .74rem / +.16em weight 700, margin-bottom .5rem.
- SELECT: the identical box, appearance none, padding-inline-end 2.6rem, with a drawn chevron as an inline-SVG data-URI background (3px stroke, square caps) 1rem from the end edge.
- CHECKBOX and RADIO: a 26px SQUARE — radios are square too, this world has no circles except the seal — 3px INK border on PAPER. Checked draws a tick with an ::after of width 8px, height 15px, border-right and border-bottom 3px INK, rotate(45deg), popping scale(0) to scale(1) over 130ms; the enclosing card responds via :has(input:checked) by taking the ACCENT-A field and stepping its shadow to 6px 6px 0.
- SPEC TABLE (the data component, and it REPLACES feature cards): a real table, border-collapse collapse, outer border 4px INK, cell borders 3px INK, header row an ACCENT-B field in mono uppercase .76rem, body cells in the body face with display-face numerals, zebra rows in PAPER-2. On mobile it scrolls inside its own overflow-x auto wrapper — the page never scrolls sideways.
- STEP PLATES: the giant OUTLINE numeral (clamp(3.5rem,9vw,7rem), 3px INK stroke) sits at z-index 0 behind the plate content at z-index 1, bleeding -18px past the plate's top-left corner.
- TABS / FILTERS: a collapsed-border row of mono uppercase buttons; the active one takes the ACCENT-A field and stays permanently pressed (translate(3px,3px), shadow 0), so selection is physical, not chromatic alone.
- FOOTER: an INK chapter — a collapsed-border grid of contact cells in mono PAPER, a barcode rule, then the MONUMENT: the wordmark at clamp(3rem,17vw,15rem), line-height .78, weight 900, uppercase, color transparent with -webkit-text-stroke 4px PAPER (plus the @supports fallback), user-select none, aria-hidden, rising out of its mask. A final row of mono micro-copy at .72rem.
- ICONS ARE DRAWN BY YOU: inline SVG, 24x24 viewBox, stroke 3px, stroke-linecap square, stroke-linejoin miter, fill none, currentColor. No icon fonts, no libraries, no emoji. Square caps are non-negotiable — round caps belong to a softer world.
- CRAFT SIGNALS: explicit width and height on every image; fetchpriority high on the LCP image, loading lazy below the fold; descriptive alt on content images and empty alt plus aria-hidden on tape, seals, registration marks and the barcode; aria-live polite on error and status text; semantic landmarks with exactly one h1; an inline-SVG data-URI favicon (a bordered square with its own offset block) and a theme-color meta matching PAPER.

## Conversion objects (this world SELLS, and the market is cash-on-delivery)
- THE PRICE BLOCK: an ACCENT-A plate with a 4px border and 6px 6px 0 shadow holding the price in DISPLAY 900 at clamp(2.6rem,5.6vw,4.4rem), tabular-nums, thin-space thousands (3 500 DZD — a real U+2009 thin space, never a comma), the currency as a mono suffix at .38em after a .3em gap, a struck was-price beside it in mono at 1rem with text-decoration-thickness 3px INK, and a mono stamp underneath stating the payment terms. A barcode rule runs beneath the block.
- THE ORDER FORM IS A DESIGNED OBJECT and the loudest plate on the page: a PAPER-2 plate, 5px INK border, 10px 10px 0 shadow, sitting ON an accent field so it reads as pinned there. Head: a mono stencil label plus a display 900 title. Fields in this order: full name (autocomplete name) · phone (type tel, inputmode tel, autocomplete tel, a real pattern for a 10-digit local number and a mono hint stating the format) · wilaya (a styled select carrying the 58 wilayas, populated from the brief, never invented) · address (a 3-row textarea in the same box) · quantity as a STEPPER (square 44px press-buttons flanking an output element at min-width 3rem in the display face). Delivery choice is two RADIO CARDS via :has(input:checked), taking the ACCENT-A field and the deeper shadow when selected.
- STEP NUMBERING: each field group carries a mono N. 01 / N. 02 / N. 03 in the start gutter in ACCENT-B. The form reads like a printed order slip because it is one.
- VALIDATION IS BLUR-GATED: keep a touched map so an error appears only after a field's first blur, never mid-typing. Errors are short brand-voice sentences in the ALARM hue with min-height 1.3em reserved so nothing reflows, and the offending field's shadow snaps to 4px 4px 0 ALARM.
- SUBMIT: a full-width primary button with a deliberate 700ms pending state during which its label becomes a present-tense sentence and its background becomes the hazard stripe. Then the form CROSS-SWAPS, never cross-fades: the form plate goes display none and a SUCCESS plate slams into the same box from y -20 over .3s power4.out, carrying a large mono order number, the buyer's own name and wilaya echoed back, and the next concrete step. Persist it in localStorage and show the success plate instantly on return so nobody orders twice. The instant validation passes — as the success plate slams in — the page flyposts the order to the wandit runtime by dispatching the wandit:lead CustomEvent on document with the buyer's fields flat in detail (name, phone as typed, wilaya, commune, plus quantity and delivery choice), while the slip carries one off-canvas decoy input marked data-wandit-hp that the page's own script never touches.
- WHATSAPP CTA, styled to BÉTON and never a default green blob: a bordered plate button in ACCENT-B (or the brief's green only if that green is already in the palette), 3px INK border, 6px 6px 0 shadow, a drawn 22px inline-SVG glyph in currentColor beside mono uppercase text, pressing like every other control. Its href is a real wa.me URL built from the brief's number with a pre-filled text parameter in the page's language, naming the shop and the item — it works with JavaScript completely disabled, as does every tel: link on the page. It appears exactly twice: the hero action row and the sticky bar.
- STICKY MOBILE ORDER BAR: below 768px, once the hero is passed, a fixed bottom bar at z-index 250 slams up from translateY(100%) to 0 in .22s power4.out — PAPER ground, border-top 4px INK, padding .7rem the gutter, price in display 900 at 1.5rem with tabular-nums on the start side, primary CTA plus the WhatsApp square on the end side. Add padding-bottom env(safe-area-inset-bottom) and a matching page bottom padding so it never covers the footer's last row; it hides again over the footer.
- TRUST STRIP: a collapsed-border row of four cells, each with a DRAWN 26px inline-SVG icon (3px stroke, square caps — a truck, a hand holding a coin, a return arrow, a shield), a mono uppercase label and a display numeral where one exists. Facts only, all from the brief: delivery time, cash on delivery, return window, guarantee. On mobile it becomes a 2x2 grid with the same collapsed borders.
- SCARCITY IS A FACT, never a clock: a mono stamp carrying the brief's real stock line, rotated -2deg. Countdown timers are banned.

## Print-shop furniture (REQUIRED — this is BÉTON's voice)
- STENCIL CHAPTER LABELS: mono uppercase, form "SEC. 03 / LIVRAISON", inside a small bordered plate sitting on the stencil rule.
- STAMPS: rotated mono chips carrying one hard fact each — STOCK LIMITÉ · PAIEMENT À LA LIVRAISON · GARANTIE 12 MOIS · OUVERT 7J/7. Three to five across the page, never two adjacent.
- FIGURE BANDS: an INK strip welded to the bottom edge of every framed photograph (margin-bottom -3px so borders collapse), mono PAPER at .7rem uppercase, description on the start side and FIG. 04 on the end side.
- REGISTRATION MARKS: printer's crop crosses, 22px, drawn with two 2px INK lines, placed at the four corners of exactly ONE full-bleed section, aria-hidden. Nobody will name it; everybody will feel it.
- THE BARCODE RULE: the CSS-drawn barcode strip, used three times — under the price block, as a divider before the order form, and in the footer.
- GIANT OUTLINE NUMERALS behind step plates.
- THE SEAL: the bordered starburst with two lines of 9px mono uppercase inside, naming the shop and one fact.
- MARQUEE COPY: five to eight short shouted items separated by drawn square glyphs, repeated twice in the track. Real facts and real offers from the brief, never lorem, never adjectives alone.
- None of this furniture invents a business fact. It is TYPESETTING. Fill it from the brief.

## Arabic and RTL adaptation (this market is bilingual — get this right)
- Set dir rtl on html and build the whole chassis with logical properties: padding-inline, margin-inline-start, border-inline-start, inset-inline.
- ARABIC HAS NO UPPERCASE, so the world's ALL-CAPS device is replaced by WEIGHT AND SIZE: display headings go to the heaviest available Arabic weight (800-900 in the Almarai / Cairo / IBM Plex Sans Arabic / Rubik territory), sized 8-12 percent larger than the Latin equivalent, with letter-spacing 0 or +.01em — NEVER negative tracking on Arabic, it breaks the joins.
- The mono LABEL VOICE has no natural Arabic equivalent either: labels become the body Arabic face at weight 700 with +.02em tracking and a slightly smaller size, still inside their bordered plates. Keep Latin mono only for numerals, codes and figure numbers, which stay LTR inside an inline bdi element.
- THE SHADOW DIRECTION FLIPS. In RTL the offset becomes -6px 6px 0 (down-and-LEFT), consistently across every shadow on the page, including the -3px 3px 0 and -10px 10px 0 steps, and the press translate becomes translate(-6px,6px). The light source follows the reading direction. Getting this wrong is instantly visible.
- ROTATION SIGNS FLIP TOO: a plate authored at -2deg becomes +2deg in RTL so the collage leans with the text.
- Arabic needs more leading: display line-height .84 becomes .95, body 1.5 becomes 1.75, and highlight-box padding grows to .1em .2em so diacritics are not clipped by the border.
- Marquee direction: the CSS keyframes stay the same, but author the item order so the strip reads naturally as it travels; the scrub-driven strip's velocity sign inverts.

## BÉTON ban list (in addition to the global one)
Any box-shadow, text-shadow or drop-shadow with a blur radius above 0 · border-radius above 0 except the seal and two stamp pills · gradients as decoration (the CSS-drawn grid, halftone, hazard stripes and barcode are the only gradients that exist) · backdrop-filter and glassmorphism of any kind · pastel, muted or desaturated accents · pure #FFFFFF anywhere, including text on ink · rgba text colors (placeholders and the flat photo scrim are the only exceptions) · gray of any kind · italics · any font weight below 400, and any display weight below 800 · hairline 1px borders · ease, ease-in-out, sine, power1, power2, elastic, bounce (one back.out(1.7) excepted) · any duration above 420ms except marquees and the closing wordmark · Lenis and every smooth-scroll library · fade-only reveals · icon fonts, icon libraries, emoji, and round stroke caps · uniform card grids where every plate is the same size · a hero with no rotated plate · a page where the accents appear only on buttons · more than four rotated elements per viewport · rotations outside the -3 to 3 degree set · countdown timers and fake urgency · centered body paragraphs (only the seal, the stamps and the closing wordmark may be centered) · opacity used to communicate a disabled state.

## Intensity
This world fails in exactly one direction: TIMIDITY. A 1px border instead of 3px. A 12px radius that crept in from muscle memory. A soft shadow because a hard one felt aggressive. One small accent chip instead of a full accent field. A hover that fades instead of a button that travels six pixels and lands. Executed at 60 percent, BÉTON is a bootstrap page with borders drawn on it, and it is worse than doing nothing. Executed at 100 percent — cream paper under a graph grid, every object outlined and casting a hard block, two saturated fields cutting the page into chapters, a marquee that speeds up when you scroll, a seal hanging off a corner at 8 degrees, and buttons that PRESS — it looks like a wall you would stop in the street to photograph. Push INTO the loudness. Every number above is load-bearing, and the borders are the whole world.`,
	energy: "loud",
	id: "beton",
	industries: [
		"gadgets",
		"tech",
		"fashion",
		"streetwear",
		"sneakers",
		"gaming",
		"esports",
		"barber",
		"events",
		"nightlife",
		"cafe",
		"street-food",
		"gym",
		"tattoo",
	],
	kind: "website",
	mood: ["loud", "punk", "playful", "graphic", "defiant"],
	name: "Béton",
	priceFeel: "accessible",
	tagline:
		"Cream paper plastered with bordered stickers, two screaming colors, text marquees running edge to edge and buttons that physically press into the page — a shop window that shouts, and gets photographed.",
};
