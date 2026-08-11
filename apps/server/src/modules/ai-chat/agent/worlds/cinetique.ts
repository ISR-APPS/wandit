import type { DesignWorld } from "./types";

/**
 * CINÉTIQUE — Swiss-brutalist techno-editorial poster with a motor.
 * Distilled (values and all) from design/examples/agency.html: every number
 * below was measured there, none is invented. This is the "one strong idea"
 * world — a single concept verb drives type, layout, imagery AND motion at
 * once. The doc is appended VERBATIM to the builder system prompt.
 */
export const cinetique: DesignWorld = {
	avoidFor: [
		"law",
		"medical",
		"clinic",
		"pharmacy",
		"insurance",
		"funeral",
		"notary",
		"banking",
	],
	doc: `# DESIGN WORLD: CINÉTIQUE — the kinetic poster

## Philosophy
This page is a POSTER THAT RUNS, not a website. International Typographic Style grid discipline — hairline rules, monospaced micro-labels, numbered chapters, registration marks — pushed through a creative-development studio filter and lit by one hyper-saturated accent on a near-black field. Neue Brutalism supplies the structure (raw material, no ornament-by-container); rave-flyer graphics supply the voltage; data-brutalism supplies the voice (interface chrome used as decoration). The discipline is inverted from most dark pages: the MATERIALS are austere — four colors, three typefaces, zero shadows, zero radii, one single linear-gradient in the entire stylesheet — while the SCALE and the MOTION are violent. Nothing is soft, nothing is padded, nothing is rounded, and nothing sits still.
Its defining structural fact: there are NO PHOTOGRAPHS. Every pixel of imagery is computed at runtime by hand-written Canvas2D systems. The failure mode "a big photo on the right does all the visual work" is not merely discouraged here, it is structurally impossible. Target the same negative space: zero image elements, zero stock-photo URLs, zero box-shadow, zero backdrop-filter, exactly two border-radius declarations in the whole file (both 50%, both on the custom cursor), exactly one linear-gradient (the hero dissolve). Treat those five counts as a self-audit before shipping.

## The single idea (do this FIRST — it is what makes the world work)
Before writing one line of markup, name ONE VERB from the brief — bend, burn, cut, fold, mirror, orbit, overclock, dissolve, sharpen, accelerate. That verb is the engine, and it must drive FOUR CHANNELS SIMULTANEOUSLY:
- TYPE: which words are outlined and which are filled, where the scale explodes, which single word takes the accent.
- LAYOUT: which grid gets broken, which element overflows its column, which strip is rotated off the page edges.
- IMAGERY: what the generative surfaces actually draw — the hero field and every Canvas2D system are illustrations of the verb, not decoration.
- MOTION: what scroll DOES to matter — what recedes, what freezes, what covers what.
A concept that only appears in the copy has failed. The test: a stranger scrolling with the sound off, in a language they cannot read, must be able to name the verb. Every generative panel, every hover inversion and every scroll seam is one more sentence about that verb. This is a one-idea world — a second idea is a bug.

## The vibe
Machine telemetry and internal memo. The page narrates its own construction: coordinates with degree signs and a place/scope pair, a bracketed SYS.STATUS whose present participle IS the concept verb, EST. year beside a live render status, FILE 001 indices, technique captions on every generated panel, a punning rights line in the footer. Sentences are short, declarative and faintly aggressive; there are no adjectives doing sales work. Confidence comes from the instrumentation, not the claims. The copywriting and the typography are the same decision.

## Visual signatures (what makes it instantly recognizable)
- A warm- or cool-shifted near-black field, one warm off-white, one dim companion tone, and ONE hyper-saturated accent. Four roles, no more, plus per-item colour derived from mixes of the fixed --primary and --accent tokens.
- Zero photographs. A live full-bleed generative surface behind the hero; one bespoke generative panel per showcase item, each thematically matched to its subject.
- Outline type as a structural material: color transparent plus -webkit-text-stroke at four calibrated weights for four different jobs — 1px behind content (ghost numerals), 1px on an outlined marquee, 1.5px on a section title, 2px on the closing headline.
- mix-blend-mode difference on the nav, on the hero wordmark and on the cursor: chrome INVERTS against whatever scrolls beneath it instead of sitting on a bar. Foreground and background are one system.
- Registration and trim marks as a design language: 14px corner ticks built from partial borders on every media frame, and a plus sign pinned top-right of every ledger cell.
- Fixed full-viewport grain: inline SVG feTurbulence fractalNoise, baseFrequency 0.8, numOctaves 2, stitchTiles stitch, tiled 160x160, inset:-40px, z-index:60, opacity .07, pointer-events:none — above content, below the cursor. The cheapest expensive move in the file.
- Chapter numbers set in parentheses — ( 01 ) through ( 05 ) — in the accent, each label ending in a hairline that eats the remaining width.
- Full-bleed strips rotated -1.6deg and +1.2deg, scrolling in opposite directions at different speeds, crossing each other and running off both page edges.
- A custom two-part cursor and a glyph-scramble decoder on links: the interface itself is part of the artwork.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — GROUND→--background · FOREGROUND→--foreground · ACCENT→--primary · GROUND→--primary-foreground · reserve void→--secondary · second chromatic pole→--accent · dim foreground→--muted · foreground at 14%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, glow or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
- GROUND: the palette's dark pole, never pure black — shift it 2 points toward blue or amber (the #08080A / #0D0D11 register). Declare a second near-identical void 5 RGB points up and hold it IN RESERVE; it exists for at most one inverted moment.
- FOREGROUND: the palette's light pole, never pure white — a warm off-white (the #E9E4DA register), plus a dim companion at roughly 60% of its luminance (the #8F8B80 register) used for ALL micro-type, and one intermediate tone (the #BEB9AC register) used for descriptive paragraphs. Those are real tones, not opacity steps.
- HAIRLINE TOKEN: foreground at 14% alpha. This single token draws every structural line in the page — section borders, ledger grid, media frames, label rules. Structure is built from 1px lines and nothing else.
- ACCENT: exactly ONE global hue, hyper-saturated, taken from the brief. Its entire budget: chapter numbers, the metric in a meta row, stat affixes and plus marks, the scroll-cue bar, the nav underline, ::selection, :focus-visible, hover states, one italic word in the hero caption, the keyword highlights in the statement paragraph, and the accordion inversion panel. It is never body-text color and never a large fill except that inversion panel and one marquee slab.
- SECOND PALETTE LAYER — the chromatic narrative: each showcase item selects one of FOUR authored color-mix steps between var(--primary) and var(--accent), with its glow derived from the same expression at 10-12% against transparent; do not inject item-specific color custom properties. Repeat that expression through FIVE sub-elements — the full-bleed radial glow at 90% 70% at 80% 20% (opacity .5), the ghost numeral's 1px stroke at opacity .14, the index marker, the metric, and the media frame's corner ticks. The page's color temperature therefore CHANGES AS YOU SCROLL while the fixed system stays intact. That is a narrative, not a theme.
- Gradients are rationed: exactly ONE linear-gradient exists (the hero's dissolve scrim). Radial gradients are permitted only for the per-item glow and the hero's CSS fallback. No gradient is ever decoration.
- Declare color-scheme:dark on :root and a theme-color meta matching the ground.

## Typography system
- THREE families, THREE SEALED ROLES, never crossed. DISPLAY: a heavy condensed display grotesque at weight 400 only (Tanker register) — used ONLY above about 2.2rem, for the wordmark, section titles, item names, accordion names, marquee text and the closing headline. BODY: a neutral grotesk with a true italic axis (General Sans register, 400/500/600) — used ONLY for prose. MONO: a technical monospace (JetBrains Mono register, 400/500/700) — used ONLY for labels, chapter numbers, captions, telemetry, nav links and ALL STAT NUMERALS. Body face never goes above 4rem; display face never goes below 2.2rem; mono never sets prose. For an Arabic page, pair each role with an Arabic-capable face, keep the roles sealed, set dir="rtl" and keep numerals and telemetry LTR.
- The scale ratio is about 28:1 and THE MIDDLE IS EMPTY ON PURPOSE. Smallest: .70-.72rem mono at .08-.14em tracking. Largest: clamp(4.6rem, 21vw, 20rem). Do not generate 1.5rem / 2rem / 2.5rem intermediate steps — they are what makes a page look automated.
- Base body 1.0625rem / 1.6.
- LINE-HEIGHT TIGHTENS AS SIZE GROWS: 1.6 body, 1.22 large statement paragraph at clamp(1.7rem, 4.4vw, 4rem), .95 item name, .92 hero wordmark, .88 closing headline.
- LETTER-SPACING INVERTS WITH SIZE: micro-type opens (+.08em utility mono, +.12em nav, +.14em on strip type), display closes (.005-.02em), huge mono numerals go NEGATIVE (-.03em), the statement paragraph sits at -.01em.
- Outline type is a material, used at least twice per page: 1px for ghost numerals and outlined marquee text, 1.5px for a section title, 2px for the closing headline. MIX OUTLINE AND FILL INSIDE ONE HEADLINE — the heading is stroked, one inner span is solid, so a two-word title reads half-drawn, half-printed.
- A superscript registered/trade mark in the accent at .32em, vertical-align:super, letter-spacing 0, repeated at nav scale on the wordmark.
- Emphasis has two modes: an inline ITALIC accent phrase in the hero caption, and a NON-ITALIC keyword class that deliberately overrides the italic on emphasis elements inside the statement paragraph so the emphasis there is purely CHROMATIC.
- Chapter labels: mono, uppercase, prefixed with a parenthesized number in the accent, and ending in a pseudo-element rule of flex:1, min-width:2rem, height:1px in the hairline token — the label physically consumes the rest of the line. Interstitial strips are deliberately left UNNUMBERED.
- Stat values: mono at weight 700, clamp(2.4rem, 5.5vw, 4.6rem), line-height 1, letter-spacing -.03em, display:flex with align-items:baseline so accent prefix/suffix spans at .55em sit on the numeral baseline.
- MEASURE IS ALWAYS IN ch, NEVER px: about 26ch for the hero caption, 44ch for an item description, 60ch for body copy, about 1200px only for the one oversized statement paragraph.

## Page chassis
- ONE horizontal gutter token: clamp(1.25rem, 4vw, 4.5rem). It is the page padding and the anchor for every absolutely-positioned ornament. Set overflow-x:clip on html and body — mandatory, because the rotated strips and the negative-inset grain both overflow. scroll-behavior:smooth with scroll-padding-top:5rem for the fixed nav.
- THE NAV IS NOT A BAR. position:fixed; inset:0 0 auto 0; z-index:100; flex with space-between; padding 1.1rem var(--pad); mix-blend-mode:difference. Zero background, zero blur, zero border, zero pill, no scrolled state, no hide-on-scroll. It inverts against the hero field, against an accent slab, against everything. Links are mono .7rem uppercase at .12em with a 1px accent underline that scales X from 0 to 1 over .35s cubic-bezier(.65,0,.35,1), the transform-origin FLIPPING from right at rest to left on hover so it wipes in from one side and out the other. The wordmark is display type with a superscript accent mark.
- The spine is FIVE NUMBERED CHAPTERS plus TWO UNNUMBERED INTERSTITIAL STRIPS. The unnumbered strips are connective tissue that deliberately breaks the chapter rhythm — do not number them, do not pad them like sections.
- Vertical rhythm is ALWAYS a clamp whose middle term is vh, so pacing holds on a laptop and on a 4K panel: clamp(5rem,12vh,8rem) for a statement, clamp(4.5rem,10vh,6rem) for a sticky card, clamp(5rem,14vh,10rem) for standard chapters, clamp(6rem,16vh,12rem) for the closing chapter, clamp(4rem,10vh,7rem) for an interstitial.
- Inner grids cap at 1400px with margin-inline:auto; sections themselves are always full-bleed.
- Two fixed overlay layers: grain at z-index 60, cursor at z-index 200.

## Hero forms (pick one — never the split hero)
1. LIVE FIELD (default). FIVE LAYERS STACKED IN ONE position:relative BOX, min-height:100vh declared first then min-height:100svh, overflow:hidden, flex column with justify-content:flex-end so the poster reads bottom-weighted:
   (a) an animated CSS fallback — three overlapping radial gradients over the ground, drifting on a 14s ease-in-out infinite alternate keyframe that runs filter hue-rotate 0 to 40deg plus brightness 1 to 1.25. Even the fallback moves.
   (b) the generative canvas, position:absolute; inset:0; width/height 100%.
   (c) an ::after scrim: an 18vh linear-gradient from transparent to the ground, pinned to the bottom. THE HERO HAS NO BOTTOM EDGE — it dissolves into the next scene instead of ending.
   (d) the UI layer at z-index:2 — flex column, justify-content:space-between, min-height:100svh, padding 5.5rem var(--pad) 2rem.
   (e) grain and cursor above everything.
   THE UI LAYER IS A FRAME, NOT A GRID. Telemetry hugs the top edge, the wordmark sits in the optical middle inside a flex:1 centered block, and the scroll cue plus a build-status line hug the bottom edge. There is no left column and no right column: the corners of the viewport are the layout.
   THE HEADLINE IS A WORDMARK, NOT A VALUE PROPOSITION. One word — the business name — at clamp(4.2rem, 16.5vw, 15.5rem), line-height .92, letter-spacing .005em, mix-blend-mode:difference, overflow:hidden, white-space:nowrap, spanning the viewport edge to edge. The proposition is DEMOTED to a caption underneath at clamp(1.05rem, 1.9vw, 1.5rem), max-width 26ch, line-height 1.35, carrying exactly ONE italic accent phrase. Inverting the normal headline/subhead hierarchy is the core move. The caption may carry a text-shadow (0 2px 28px and 0 0 6px in the ground color) for legibility over live imagery — that is the only shadow this world allows, and it is on TEXT, never on a box.
   THERE IS NO CTA BUTTON. The only affordance is the word SCROLL beside a 56px 1px hairline with an accent bar wiping through it on a 2.2s cubic-bezier(.65,0,.35,1) infinite loop whose keyframes are translateX -100% at 0%, 0 at 55%, 100% at 100% — asymmetric, so it lingers mid-travel before exiting. The real contact CTA is withheld until the final chapter.
2. TYPE-STORM. No canvas at all. The closing-headline treatment is brought forward to fill the viewport: two or three lines of outlined display at clamp(4.6rem, 21vw, 20rem), line-height .88, -webkit-text-stroke 2px foreground, each line indented further than the last by margin-left clamp(2rem,14vw,14rem), over the bare ground, with one rotated marquee slab at -1.6deg crossing slowly behind them. Same frame telemetry, same scroll cue, still no CTA. Use when the brief has a short, punchable name or slogan, or when pure type carries the verb better than a field.
3. INVERTED SLAB. The hero is a full-bleed ACCENT slab carrying ground-colored display type — the nav's difference blend does the inverting for free — with a single generative strip at height min(38vh, 340px) framed by a hairline and corner ticks, anchored to the floor of the viewport, and the telemetry set in the ground color. Use when the brief's accent is saturated enough to carry a whole viewport and the business is genuinely loud (events, nightlife, streetwear, sound).

## Section seams (this world's vocabulary — every boundary uses one, never the same twice in a row)
- DISSOLVE: any full-bleed generative surface ends in an 18vh ::after gradient from transparent to the NEXT scene's ground. Surfaces never end at an edge next to a differently-toned block.
- HARD STOP: one chapter FREEZES — pinned with scrubbed content — so the page holds still while you read. Placed immediately before or after the busiest section, because a hard stop is the maximum available contrast.
- STICKY OVERLAP (the centerpiece): repeated blocks are position:sticky; top:0; min-height:100svh, each with its OWN opaque ground background and a 1px hairline border-top. Block N pins and block N+1 slides up over it. Cards physically overlap: no gaps, no scroll-past, no margins between them.
- HAIRLINE CONTINUITY: two adjacent chapters share the same 1px hairline, so the boundary is a ruled line rather than a color change.
- ROTATED SLAB: a full-bleed strip rotated 1-2deg that runs off both page edges and cuts across the padded rhythm. If there are two, rotate them in OPPOSITE directions and scroll them in opposite directions at different speeds so they cross.
- LEDGER RULING: a section drawn entirely from 1px borders, reading as a continuation of the previous section's hairlines.
- ABSOLUTE OVERLAP: an ornament — a spinning accent star, a giant stroked numeral — absolutely positioned so it sits ON TOP of the next block's column, with a companion note positioned by calc() derived from the ornament's own clamp values.
- STRIP OUTSIDE MAIN: a marquee living between the end of main and the footer, hairline-bordered top and bottom, as connective tissue bridging out of the page.

## Layout physics
- NEVER 1fr 1fr. The signature ratio is 1.05fr .95fr — a 5% asymmetry, invisible as a number and decisive as a feeling. Alternate reading order with an even-index order:2 rule so the media and the copy swap sides down the stack.
- The sticky stack in detail: each block is display:flex; align-items:center; padding clamp(4.5rem,10vh,6rem) var(--pad); background = the ground (opaque, non-negotiable); border-top 1px hairline; overflow:hidden. The inner grid is max-width 1400px, margin-inline auto, gap clamp(2rem,5vw,5rem), align-items:center, will-change:transform.
- GHOST NUMERAL (broken-grid layering): position:absolute; z-index:-1; right:-1rem; top:-1.2em; display face at clamp(8rem,16vw,15rem); line-height 1; color transparent; -webkit-text-stroke 1px in the item's own accent; opacity .14; pointer-events:none; user-select:none. It MUST overflow its column and be clipped by the block's overflow:hidden. Content sitting on top of content is the point.
- MEDIA PANELS ARE FRAMES, NOT PHOTOS: a 1px hairline border, height min(66vh, 600px) — viewport-relative, never aspect-locked — with the generative canvas absolutely filling it, 14px corner ticks built from partial borders (top-left tick with right and bottom borders removed, bottom-right the inverse, both offset -1px so they sit ON the frame line), and a mono spec caption at bottom .8rem / left .9rem naming the technique.
- The meta row under an item name is mono micro-type with flex-wrap and gap .6rem 1.6rem; exactly one entry — the metric — takes the item's accent color. The index line above the name ends in an 80px 1px hairline pseudo-element.
- SERVICES ARE AN ACCORDION, NOT CARDS: rows separated only by border-top 1px hairline with a closing border-bottom on the last. The head is a grid of auto 1fr auto with align-items:BASELINE, so a .8rem mono index, a clamp(2.2rem,6.5vw,5rem) display name and an arrow all lock to one baseline across wildly different sizes. Padding clamp(1.4rem,3vh,2.2rem) 0. Auto-height via the grid-template-rows 0fr to 1fr transition, never a max-height hack.
- STATS ARE A LEDGER, NOT A CARD ROW: grid repeat(4,1fr) with border-left on the container and border-right plus border-top on each cell — the grid is drawn ENTIRELY out of 1px borders, no fills, no gaps, no radius. Cell padding clamp(1.4rem,3vw,2.5rem) clamp(1rem,2vw,2rem) clamp(2rem,4vw,3rem). Each cell gets a plus registration mark via ::after at top .5rem / right .7rem in mono .8rem accent at opacity .7.
- THE CLOSING MOVE IS A STAIRCASE, NOT A STACK: two lines of outlined display at clamp(4.6rem,21vw,20rem), line-height .88, letter-spacing .005em, -webkit-text-stroke 2px foreground, with the second line indented margin-left clamp(2rem,14vw,14rem). The whole thing is one anchor with width:fit-content, and hovering it fills the outline with the accent while killing the stroke color, both over .4s.
- ORNAMENT WITH CALC'D COMPANION: a slowly spinning accent SVG star, position:absolute at top clamp(12rem,28vh,19rem) / right clamp(2rem,9vw,9rem), sized clamp(90px,13vw,170px), overlapping the closing headline's column; and a right-aligned mono note positioned at top: calc(clamp(12rem,28vh,19rem) + clamp(90px,13vw,170px) + 1.6rem) with the same right value. Both display:none below 960px.
- The footer is four flex-wrapped mono spans with gap 1rem 3rem and space-between — no logo repeat, no column grid, no newsletter box.
- RESPONSIVE IS PROGRESSIVE DISCLOSURE OF DECORATIVE MICRO-COPY, NOT REFLOW. Under 640px: hide supplementary label fragments, the hero's secondary status line, the footer telemetry span, and drop the first nav link. Under 960px: remove the star and its note entirely. Structural changes are surgical and limited to: item grid to 1 column with the media panel forced above via order:-1 and alternation disabled, panel height to min(48vh,420px), sticky blocks switching to align-items:flex-start with padding-top 5.5rem, and the ledger to 2 columns.

## Motion identity (GSAP 3 + ScrollTrigger via CDN; native scroll — NO smooth-scroll library; ALL imagery is hand-written Canvas2D — WebGL libraries like three.js are unavailable in this runtime and must never be loaded)
THE GOVERNING LAW, non-negotiable: EVERY hidden state is set in JS via gsap.set, NEVER in CSS. No stylesheet in this world may contain opacity:0 or a translate on content. The entire animation block is gated on GSAP being present AND ScrollTrigger being defined AND prefers-reduced-motion being unset. If the CDN dies, the page is a complete, readable, correctly composed static poster.
Shared easing identity: cubic-bezier(.65,0,.35,1) for every CSS transition in the file; power4.out for type entrances; power3.out for chrome and rows; ease "none" for anything scrubbed.

HERO ENTRANCE
- The wordmark is split into per-letter spans inside a container with overflow:hidden and white-space:nowrap. gsap.set the letters to yPercent 112, then tween to 0 at duration 1.1, stagger .055, ease power4.out. The type ARRIVES AS A MECHANISM — letters sliding up out of a mask — never a fade from translateY 20px.
- Chrome cascades at ABSOLUTE TIMELINE POSITIONS, not sequential appends: nav at 0.1, top telemetry at 0.75, caption at 0.85, bottom row at 0.95 — each opacity 0 to 1 with y 18 to 0 over .7s.

THE GENERATIVE HERO SURFACE (hand-written Canvas2D — the primary imagery of this world; NO WebGL, NO three.js, no graphics library of any kind. The world also works without it via hero form 2)
- The hero field is the largest Canvas2D system on the page, built on the same shared harness as the showcase panels: a DPR-aware backing store using setTransform(dpr,0,0,dpr,0,0), simulation state REBUILT on resize, every color drawn from the fixed tokens.
- The drawing: a 200-260 particle FLOW FIELD over the whole viewport — angle = 2.6*sin(x*.008 + t*.4) + 2.6*cos(y*.011 - t*.3) — with EVERY stroke drawn twice, mirrored across the center axis, so the field paints symmetrically. Per-frame trail fade by filling the frame with the ground color at about .045 alpha so trails run LONG; globalCompositeOperation "lighter" for additive glow. Then the move that matters: a LARGE-SCALE COVERAGE MASK — skip any particle where sin(x*.0009 + seed) * cos(y*.0011 - seed) falls below about .15 — which keeps MOST OF THE FRAME BLACK; that is what stops it from reading as a generic particle demo. The accent appears only at the brightest crossings; one roving accent scanline at (t*0.14 modulo 1) times the width smears through the fade; a vignette drawn once per frame as a radial gradient from transparent to the ground so nothing is crushed to a hard edge. Time scale slow — the field breathes, it does not swarm.
- INTERACTION: pointer normalized to -1..1 and lerped into a domain offset at 0.045 per frame, shifting the field by about 24px. Heavy inertia: the field drifts toward the cursor rather than tracking it. The hero is a surface, not a still.
- FALLBACK CONTRACT — three designed tiers, all mandatory: (1) if getContext("2d") returns null or the setup throws, return early and leave the animated CSS gradient fallback visible; only add the body class that hides the fallback AFTER the first frame actually draws. (2) Under reduced motion, run about 240 SIMULATED FRAMES once and stop — a composed frozen still, not a blank box. (3) The CSS fallback itself animates. A missing canvas must never leave a dead rectangle.
- PERF GATING: device pixel ratio capped at min(devicePixelRatio, 1.5); delta time clamped to 0.05; the loop paused on document visibilitychange; the loop paused by an IntersectionObserver on the hero at threshold 0.

THE CANVAS2D SYSTEMS (one per showcase item)
- Each item gets a DIFFERENT bespoke system, thematically matched to that item's subject — never four instances of one particle demo. That thematic match IS the concept verb applied to imagery.
- Shared harness, identical for all of them: a DPR-aware backing store using setTransform(dpr,0,0,dpr,0,0); simulation state REBUILT on resize; the loop gated by an IntersectionObserver at threshold 0.05; and a reduced-motion path that runs about 240 SIMULATED FRAMES and stops, leaving a composed still image rather than an empty canvas.
- Vocabulary to draw from, mixed per subject: per-frame trail fade by filling the frame with the ground color at .32-.35 alpha (drop to about .045 for very long trails); globalCompositeOperation "lighter" for additive glow; a radial core gradient; a rotating fan of about 72 rays at t*0.12 with a per-index pseudo-random pulse, pow(abs(sin(i*12.9898 + t*0.55)), 3), driving both length AND color; 3 dashed orbital rings with lineDashOffset animated in ALTERNATING directions; a small accent satellite orbiting at t*0.5; 15 stacked oscilloscope rows whose amplitude, alpha and line-width are all weighted by a center bias raised to 2.2 so the middle rows swell, with the waveform being a PRODUCT of three sines at different spatial frequencies and time rates; a roving accent scanline at (t*0.14 modulo 1) times the width, smearing through the per-frame fade; a 180-particle flow field with angle = 2.6*sin(x*.008 + t*.4) + 2.6*cos(y*.011 - t*.3) where EVERY stroke is drawn twice, mirrored across the center axis, so the field paints symmetrically; quadratic Bezier routes drawn twice — a faint 3px solid underlay plus a bright dashed overlay with lineDashOffset = -t*26 - i*11 — with a marker whose rotation comes from the CURVE TANGENT via a 0.02 lookahead and atan2; a bowed dotted grid where each row's sag is sin((row/8) * PI) * height * 0.05; crosshair reticles, tick-marked axes and small accent endpoint squares as furniture.
- Every canvas carries role="img" and a real aria-label describing what the artwork depicts.

SCROLL CHOREOGRAPHY (ScrollTrigger)
- THE PINNED STATEMENT: a recursive DOM walker splits the statement paragraph's text nodes into word spans WHILE PRESERVING the inline emphasis elements inside it. gsap.set the spans to opacity 0.13, then tween to opacity 1 with ease "none", stagger 0.6, and scrollTrigger start "top top", end "+=140%", scrub 0.4, pin true, anticipatePin 1. Pin plus scrub plus stagger: the page holds still and YOU READ BY SCROLLING. At least one section per page must do this.
- THE STICKY RECEDE: for every sticky block except the last, scrub its inner wrapper to scale 0.93 and opacity 0.4 with ease "none" — and THE TRIGGER IS THE NEXT BLOCK, not the animated one (trigger = block i+1, start "top bottom", end "top top", scrub true). That inversion is precisely what turns a sticky list into a DECK OF CARDS receding in Z while the next one covers it. Do not get this backwards.
- Section title: y 60 to 0 with opacity, .9s power3.out, start "top 78%", once.
- Chapter labels: opacity 0 and x -24 into place, .8s power3.out, start "top 85%", once, applied across all labels at once.
- Accordion rows: opacity 0 and y 36 into place, .7s power3.out, with delay index*0.06 — an index-based stagger across INDIVIDUALLY triggered tweens, start "top 88%", once.
- The closing staircase lines: x -60 and opacity 0 into place, 1s power4.out, stagger .12, start "top 70%", once.
- ALWAYS call ScrollTrigger.refresh() inside document.fonts.ready.then() so the webfont swap does not desync trigger positions.

CSS MOTION
- THREE marquees at THREE speeds in TWO directions: 32s left, 38s right, 26s left, all linear infinite, translateX 0 to -50% (or -50% to 0) on a duplicated track with width:max-content. Two of them are the rotated crossing slabs; the third is the strip outside main.
- The star spins 360deg over 16s linear infinite.
- ACCORDION INVERSION — five properties choreographed on one shared .45s cubic-bezier(.65,0,.35,1): a ::before accent panel scaling Y from 0 to 1 with transform-origin top; the body's grid-template-rows going 0fr to 1fr over .5s; the name translating X by clamp(.5rem,2vw,1.5rem) and changing color over .3s; the arrow rotating 45deg; and the index, paragraph and tags shifting to the ground color at 72% alpha. The ROW INVERTS to ground-on-accent. Interactive rows invert; they never merely tint.
- HOVER PARITY IS MANDATORY: every :hover rule lives inside @media (hover:hover), and an .open class achieves full parity, toggled by click plus Enter and Space keydown, with aria-expanded kept in sync.
- THE CUSTOM CURSOR, only when (pointer:fine): a 6px dot tracking the pointer 1:1 on pointermove, plus a 34px ring lerping at 0.16 in its own animation loop so it trails behind. Both position:fixed, both mix-blend-mode:difference so they invert over any background, both border-radius:50% — the only two radii in the entire file. The ring transitions width, height and margin over .25s and scales to 1.9 with a 12% foreground fill on pointerover of links, buttons and anything marked interactive. The native cursor is hidden ONLY after the JS-applied class lands on the html element, so touch and no-JS users keep a real cursor.
- THE DECODER SCRAMBLE on nav and footer links: on mouseenter, a 28ms interval progressively locks characters in from the left (character i resolves once i is below frame/3) while unresolved characters cycle through a pool of bracket, slash and block glyphs; spaces are preserved; the original text is restored on mouseleave; a running guard prevents overlapping runs; skipped entirely under reduced motion.
- COUNT-UPS: IntersectionObserver at threshold 0.5, unobserve on fire, then an animation loop over 1400ms with ease-out-cubic (p = 1 - (1-p)^3). The real final numbers are HARD-CODED IN THE HTML so a no-JS visitor sees truth, not zeros.
- GLOBAL REDUCED-MOTION BLOCK: animation-duration .01ms !important, animation-iteration-count 1 !important, transition-duration .01ms !important, plus scroll-behavior auto. This sits alongside the designed reduced-motion stills, not instead of them.
- PERF HYGIENE: will-change:transform on AT MOST THREE elements (the cursor ring, the sticky inner wrapper, the marquee track). Every pointer listener registered with passive true. Every animation loop gated by IntersectionObserver or visibility.

## Components
- BUTTONS BARELY EXIST. The affordances are: the accordion row itself; a text link with a 1px accent border-bottom and padding-bottom .2em that turns accent on hover; and the giant staircase headline acting as one anchor. If the brief genuinely needs a hard action (call, order, WhatsApp), it is a rectangular accent slab with border-radius: var(--radius) (:root sets --radius: 0) and a ground-colored mono uppercase label at .12em tracking, which INVERTS on hover via a scaling panel rather than darkening — and it appears exactly once, in the final chapter. Never in the hero.
- FORMS follow the same brutalism: transparent field, border 0, border-bottom 1px hairline, border-radius min(var(--radius), 0px), mono uppercase label above the field, accent focus rule, phone-first input types. Validation errors are set in mono and formatted like system output (an error code, an em dash, one plain sentence in the page's language). The success state reports back like a log line — and on that same tick, the instant validation passes, the page emits its one system event by dispatching the wandit:lead CustomEvent on document with the visitor's fields flat in detail (name, phone as typed, wilaya, commune, plus whatever else the form collects), while one off-canvas decoy input marked data-wandit-hp sits in the form untouched by the page's own script.
- ::selection is accent on ground. :focus-visible is a 2px accent outline at outline-offset 4px. Both are non-optional finishing details.
- Everything decorative carries aria-hidden; the split wordmark carries an aria-label with the real word; a visually-hidden utility class exists for screen-reader-only text.
- Favicon is an inline SVG data URI: the ground as a filled square with one accent stroke drawn as the concept verb (a slash, a fold, an arc). No raster icons anywhere, no icon fonts, no icon grids.

## Telemetry furniture (REQUIRED — this is the world's voice)
Every page ships: a coordinate line with degree signs plus a place/scope pair; a bracketed SYS.STATUS whose word is the present participle of the concept verb; an EST. year beside a live render status naming the technique that is actually running; FILE indices (001, 002, ...) above item names; a technique caption on every generated panel; one accent-colored metric per item; a parenthesized chapter number on every numbered section; an announcement or hiring strip in mono micro-type at .72rem / .14em outside main; and a footer whose rights line puns on the concept verb. These captions DESCRIBE THE PAGE'S OWN MACHINERY. None of them invents a business fact — they are instrumentation, written in the page's language (French, Arabic or English as briefed).

## Cinétique ban list (in addition to the global one)
The split hero — text column left, photo column right — in any form · photographs carrying the hero (if the brief supplies photos they live INSIDE hairline frames with corner ticks and mono captions, never as the background of the hero) · box-shadow on any box · backdrop-filter · border-radius on content · card containers with a background and padding · a nav with a bar, a blur, a pill or a scrolled solid state · more than ONE global accent · pure white or pure black · gradients as decoration (exactly one linear-gradient may exist) · 1fr 1fr grids · mid-scale type between about 1.5rem and 2.2rem · body face above 4rem, display face below 2.2rem, mono set as prose · fade-up-from-20px as the only entrance · hover-only interactions without keyboard and touch parity · opacity:0 declared in CSS · icon fonts, icon grids, emoji · a CTA button anywhere in the hero · testimonial carousels · four copies of one particle demo · a static dark page with no generated surface at all.

## Intensity
This world is a poster with a motor, and it has no half setting. Executed at 60% it reads as a broken template: a dark page with a big word, hairlines but no ledger, motion but no idea. THREE things must be at 100% or the world should not be chosen at all — the RUNTIME IMAGERY (hand-drawn canvas systems; a dark page with no generated surface is a failure state), the STICKY OVERLAP (sections must physically cover each other, not stack with gaps), and the CONCEPT DISCIPLINE (one verb, four channels). Everything else — the grain, the corner ticks, the telemetry, the plus marks, the cursor, the decoder scramble — costs almost nothing and is exactly what separates this from a generated page. Push INTO the voltage, never back toward safe.`,
	energy: "loud",
	family: "cinetique",
	id: "cinetique",
	industries: [
		"agency",
		"design-studio",
		"web-studio",
		"portfolio",
		"photography",
		"video-production",
		"music",
		"nightlife",
		"events",
		"fashion",
		"streetwear",
		"tech",
		"startup",
		"gaming",
		"marketing",
	],
	kind: "website",
	mood: ["kinetic", "brutalist", "electric", "technical", "nocturnal"],
	name: "Cinétique",
	preview: {
		ground: "#0D0D11",
		ink: "#E9E4DA",
		accent: "#C8FF16",
		fontFamily: "Bebas Neue",
		sampleWord: "EN MARCHE",
	},
	priceFeel: "premium",
	tagline:
		"A night-black poster that runs: your name at the size of the whole screen over a living, cursor-following field, machine captions and acid hairlines, and sections that slide over each other like cards being dealt — a page that behaves like a title sequence.",
};
