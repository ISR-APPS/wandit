import type { DesignWorld } from "./types";

/**
 * MONOGRAPHE — dark editorial monograph / quiet-luxury publication.
 * Distilled (values and all) from design/examples/real-estate.html, the
 * MERIDIAN quality bar: every number below was measured there, none is
 * invented. The doc is appended VERBATIM to the builder system prompt.
 */
export const monographe: DesignWorld = {
	avoidFor: ["kids", "street-food", "toys", "party"],
	doc: `# DESIGN WORLD: MONOGRAPHE — the architectural monograph

## Philosophy
This page is a PUBLICATION, not a website. Think a Phaidon or Lars Müller architecture monograph typeset for the screen: a cinematic dark field, hairline rules, plate captions, folio numbers, one warm metallic accent — the voice of a house that does not advertise, it introduces. Restraint IS the luxury: the page whispers with total confidence and lets scarcity do the selling. Zero SaaS energy: no gradients-as-decoration, no glassmorphism, no icon grids — ideally zero icons anywhere (the only vector art may be the favicon and a select chevron, both inline SVG data URIs).

## The vibe
Discretion, scarcity, calm authority. Copy is written by an insider who dislikes marketing: short assertions with terminal periods ("The rarest houses are never listed."), facts presented as a colophon, figures numbered like drawing plates. Even form errors speak in brand voice, in full sentences.

## Visual signatures (what makes it instantly recognizable)
- A near-black warm field with ivory hairline-weight serif display type at enormous sizes.
- ZERO cards, ZERO box-shadow, border-radius only on pill buttons (99px). Separation is 1px hairlines at 8-14% alpha and background tone steps of 2-5 RGB points — sections read as paper-stock changes, never as colored blocks.
- One warm accent (bronze-like, taken from the brief's palette) that lives in the TYPOGRAPHY — an italic word inside a headline, tick rules, numerals — never as a loud button color.
- Fixed full-viewport film grain: inline SVG feTurbulence fractalNoise baseFrequency 0.9, tiled ~300px, opacity .05-.06, inset:-50%, pointer-events:none, above content.
- Outline/stroked type moments: color:transparent with -webkit-text-stroke 1px rgba(accent,.4) — giant background folio numerals, an oversized hanging quote glyph.
- Everything numbered: sections 01/02/03, plates "Fig. 01 — North elevation", coordinates with prime marks (36°45′ N · 3°04′ E), Roman numerals for years (MMIX — MMXXVI).

## Color physics (instantiate with the brief's hexes — the physics is law, the hexes are the brief's)
- Ground: the palette's DARK pole, built as a tonal trio — three near-identical darks 2-5 RGB points apart (e.g. #12100E / #17140F / #1D1913) used as section tone shifts.
- Text: the palette's light pole (warm ivory territory), stepped through alpha: 1 / .8 / .6 / .42 for display / body / secondary / captions.
- Exactly ONE accent, used sparingly; one error-only warm tone for forms. No other hue exists.
- Declare color-scheme:dark on :root and a matching theme-color meta.

## Typography system
- Display: a variable serif with an optical-size axis (Fraunces territory; the Arabic pair when the page is Arabic). Body/UI: a neutral grotesk (Instrument Sans territory).
- The scale is violently contrasty, ~25:1, with a deliberately EMPTY middle: micro-labels at 10-11.5px uppercase with .16-.22em tracking; body 14-17px; then display jumps to 3.4-17rem. No mid-size headings.
- ALL display type is SUB-400 weight (250-340). Hairline serif at huge sizes reads expensive; bold display reads like a template. Drive the optical axis explicitly: font-variation-settings:"opsz" 144 on the h1.
- Display headings: line-height .95-1.05, letter-spacing -.01 to -.02em, max-width in em (9-12em) so line breaks are AUTHORED. End headlines with real punctuation, including periods.
- One italic accent-colored em per big headline, maximum. Body measures capped in ch (26-42ch).
- Section heads are RUNNING HEADS, never centered H2s: a baseline-aligned flex row of [serif-italic index] [uppercase micro-label] [flex:1 hairline rule] [right-aligned factual aside], with a border-bottom.
- tabular-nums on every stat and counter. Roman numerals for date ranges where the brand allows.

## Page chassis
Fixed nav, TRANSPARENT over the hero with a transparent bottom border that fades to a hairline. On scroll: .is-solid = rgba(ground,.82) + backdrop-filter blur(14px); hide on scroll-down past ~300px via translateY(-110%), show on scroll-up (ScrollTrigger self.direction), suppressed while the menu is open. Wordmark in letterspaced caps (.3em+) with a serif-italic accent period as the only ornament. Burger is TWO bars crossing into an X. Menu is a full-screen overlay with numbered serif links.

## Hero forms (pick the one the story calls for — never the marketplace split)
1. COVER PLATE (default): full-bleed media as the GROUND — position:absolute inset:0, copy layered on top at z-index:2, min-height:100svh, content FLOOR-ANCHORED (flex-direction:column; justify-content:flex-end) like a film title card, top ~55% pure image. NO CTA button in the hero — the only accent is one italic em inside the headline; the action lives in the nav pill. Below the headline, a hairline-divided MASTHEAD bar: editorial subline left (~34ch), factual dateline right (coordinates, current item, date — a colophon, not marketing). Scrim is a two-axis cinematographic grade: 4-stop vertical (.62 / .12 at 32% / .05 at 55% / .88 at 100%) plus a horizontal gradient weighting the text side — and the bottom stop EQUALS the page background so the photograph dissolves into the page with no seam. Image overscanned to 112%, object-position chosen consciously, entering at scale 1.16 -> 1.04 over 2.4s. Scroll cue = a 1px hairline with an accent segment falling through it on a keyframe, never a chevron.
2. COLD OPEN: a full-viewport typographic statement on the darkest ground — one enormous sub-320-weight serif sentence with a masked line rise, a micro-label colophon at the floor, and the first photograph only in scene two.
3. VITRINE: one object/property per viewport with a placard-style ruled caption (name, figure number, coordinates), the page opening directly on the strongest item.

## Section seams (the monograph's own vocabulary — every boundary uses one, never the same twice in a row)
- SCRIM-DISSOLVE: any full-bleed image ends in a gradient whose final stop is the next scene's ground. Images never "end".
- TONE STEP: ground shifts 2-5 RGB points with hairlines top and bottom — a full-bleed tonal band, not a colored stripe.
- AXIS CHANGE: one section converts vertical scroll to lateral travel (see motion) and releases it.
- PLATE OVERLAP: a quote or content block pulled UP onto a full-bleed image with negative top margin 3-7rem at z-index:3, and a stroked glyph hanging above that block's own top edge — double overlap.
- MARGIN-NOTE INTRO: an asymmetric 1fr/2.2fr grid where the narrow column holds ONLY a 44px accent tick rule and one micro-label; the wide column starts mid-thought with a serif lede at weight 300. No heading.

## Layout physics
- ONE gutter token: clamp(20px,4.5vw,84px) — used for page padding AND for absolutely-positioned off-grid elements (progress HUDs, giant numerals), so broken-grid absolutes still snap to the margin. Canvas is wide: max-width 1720px.
- Vertical rhythm in clamp(Xrem,Yvh,Zrem) — the middle term is vh, so spacing responds to viewport height.
- NEVER 50/50: grids are 1fr/2.2fr, 1fr/1.2fr, 1.05fr/1fr. A narrow column holding almost nothing is a complete column.
- Data is presented as RULED TABLES (grid with 1px internal dividers, hairlines top and bottom) — never feature cards.
- Images are PLATES: portrait 4/5 ratio, capped width (36vw / 520px), inside deliberate frames with figure captions. Overscan every parallaxed image 10-25% so motion never reveals an edge.
- The showpiece scene: a pinned horizontal gallery. Panels 92vw (never 100vw — the next panel must peek in), the lead panel a different width (58vw) to break the metronome, copy/media at 1.05fr/1fr, alternating reading order via an order-swapping flip modifier, giant stroked numerals as a background LAYER behind the copy (z-index 1 under z-index 2), and a live progress HUD (serif-italic 01 / 03 + a scaleX-driven 1px accent rule).
- The closing move: an edge-to-edge typographic wordmark, clamp up to ~17rem, nowrap, sub-300 weight, rising out of an overflow mask. The page's last gesture is typography, not a link farm.

## Motion identity (GSAP 3 + ScrollTrigger; native scroll — NO smooth-scroll library)
Global: gsap.defaults({ease:"power3.out", duration:1.1}). Durations live in 0.9-2.4s. Everything below degrades to visible content when JS or the CDN fails — nothing is opacity:0 in CSS; the JS bails early on !gsap || prefers-reduced-motion.
- Optional preloader, gated by an inline check for gsap + reduced-motion: wordmark centered, a 00->100 tabular counter tweened via a proxy object (1.35s power2.inOut), curtain lifts yPercent:-100 (.95s power4.inOut), and the hero entrance overlaps it at -=.75 so the page is already moving as the curtain rises.
- Hero: image settles scale 1.16 -> 1.04 over 2.4s power2.out; headline rises line-by-line (yPercent 112 -> 0, 1.35s power4.out, stagger .14) out of pre-authored overflow:hidden line pairs; eyebrow and masthead fade up at t=0.55; scrub parallax yPercent:10 on scroll.
- Every [data-split] display block: masked line rise 1.05s power4.out stagger .09, start "top 85%", once — split at REAL browser wrap points (compare offsetTop), preserve em/strong ancestry with a class, run on window.load so font metrics are final, set aria-label on the parent and aria-hidden on visual lines, then ScrollTrigger.refresh(). Descender-safe masks: padding-bottom:.06em; margin-bottom:-.06em.
- Image reveals: clip-path inset(14% 6% 14% 6%) -> inset(0) over 1.4s power3.inOut with the inner img counter-zooming 1.18 -> 1.06 over 1.8s — de-synced durations, once each.
- The pinned horizontal gallery: gsap.to(track,{x:-(scrollWidth-innerWidth)}) with pin:true, scrub:1, anticipatePin:1, invalidateOnRefresh:true, end computed from the track width. Inside it, EVERY reveal and parallax uses scrollTrigger containerAnimation so it fires on horizontal position; images drift xPercent -5 -> 5 against the travel. CSS default is the STACKED layout; horizontal is opt-in via a body class added inside gsap.matchMedia("(min-width:900px)") with a teardown — mobile gets soft vertical parallax on the same plates.
- Count-ups on stats via a tweened proxy (2.2s power3.out, toLocaleString thousands), once, start "top 88%".
- Staggered rises (autoAlpha 0, y 20-48, stagger .07-.15) on: section running heads, spec cells, the overlapping quote card, number cells, contact column, FORM FIELDS one by one, footer wordmark out of its mask (yPercent 104 -> 0, 1.5s power4.out).
- Hover micro-craft (CSS): underline grows FROM THE LEFT by transitioning right:100% -> 0 (.4s); accent-outline pills FILL with accent and invert text (.35s); image plates swell scale(1.015) over 1.6s on a WRAPPER (never the element GSAP transforms); a button whose gap expands .9rem -> 1.3rem so the arrow slides away; input rules and their labels turn accent together on :focus-within.

## Components
- Forms are RULED LINES: transparent background, border:0, border-bottom 1px hairline, border-radius:0, accent focus rule, phone-first inputs. Validation errors are brand-voice full sentences; the success state echoes the user's own input back with locale date formatting; if a date is involved, the minimum is computed from the copy's promise. The instant validation passes — as the success line is typeset — the page files the entry by dispatching the wandit:lead CustomEvent on document with the visitor's fields flat in detail (name, phone as typed, wilaya, commune, plus whatever else the form collects), and the form carries one off-canvas decoy input marked data-wandit-hp that the page's own script never reads.
- Buttons: pill outline in accent that fills on hover, or a ruled text-link with the sliding arrow. Never a solid colored rectangle.
- ::selection recolored to the accent; :focus-visible is a 1px accent outline at outline-offset:4px.

## Editorial furniture (REQUIRED — this is the monograph's voice)
Plate captions with figure numbers, geographic coordinates with prime marks, Roman-numeral years, running heads, a colophon-style footer ("by appointment" office lists), one founder/host quote set as the overlapping plate. All in the page's language. These invent no business fact — they are typesetting.

## Monographe ban list (in addition to the global one)
Box-shadows · rounded content containers · icon grids · bold display type · centered section headings · colored section backgrounds (tone steps only) · bouncing chevron scroll cues · marquees and tickers (this world is silent) · smooth-scroll libraries · more than ONE accent hue · a CTA button inside the hero cover plate.

## Intensity
This world lives or dies on nerve: hairline weights at huge sizes, near-empty columns, a hero with no button. Executed at 60% it looks broken; executed at 100% it looks like a house that has never needed to advertise. Push INTO the restraint, never back toward a template.`,
	energy: "quiet",
	id: "monographe",
	industries: [
		"real-estate",
		"architecture",
		"interior",
		"law",
		"finance",
		"medical",
		"consulting",
		"jewelry",
		"hotel",
		"photography",
		"wedding",
	],
	kind: "website",
	mood: ["hushed", "editorial", "cinematic", "exclusive"],
	name: "Monographe",
	priceFeel: "premium",
	tagline:
		"A dark architectural monograph: hairline serif type on near-black paper, plate captions and folio numbers, one bronze word glowing in each headline — the page of a house that introduces rather than advertises.",
};
