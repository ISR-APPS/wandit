import type { DesignWorld } from "./types";

/**
 * ATELIER — warm-neutral craft-commerce editorial.
 * Distilled (values and all) from the ecommerce quality bar: tinted-paper
 * ground, one metallic accent doing fifteen jobs, an object photographed on a
 * five-layer stage, ledger rows instead of cards, and a real transactional
 * chapter. Every number below was measured there, none is invented. The doc is
 * appended VERBATIM to the builder system prompt.
 */
export const atelier: DesignWorld = {
	avoidFor: ["nightclub", "gaming", "crypto", "hard-discount", "kids-party"],
	doc: `# DESIGN WORLD: ATELIER — the workshop catalogue

## Philosophy
This page is a WORKSHOP CATALOGUE that happens to take orders. Think Nordic and Iberian craft commerce crossed with a printed object-review magazine and a museum didactic panel: warm bone-white paper, one metallic accent, the product photographed as sculpture, an edition number, a wall label, and a purchase form written by the person who actually made the thing.

Structurally this world is an ordinary split hero plus a vertical section stack. That is deliberate and it is fine. There is no pinning, no horizontal scroll, no section that scrolls over another. The distance between this and a generic template is NOT animation budget — it is about forty load-bearing decisions layered onto that skeleton: state, layering, overflow, shape, diegetic motion, real commerce content, and copy with a voice. A split hero is legal in this world, but a split hero must be LOADED or it is dead. If you output headline plus paragraph plus one button plus a photo in the right column, you have failed this world even if every colour is correct.

## The vibe
Made by hand, sold by a person. Warm, tactile, unhurried, quietly expensive. The merchant is proud of the material and slightly allergic to marketing. Copy rules, non-negotiable, they carry 40 percent of the design:
- EVERY headline is two clauses with a turn, the second clause set in the serif italic accent: "Made slowly, on purpose." / "After dark, warmer." / "Asked, answered." / "First light, first to know."
- EVERY constraint is given a reason: not "max 2 per order" but "Two per household, so the edition travels far."
- Validation errors speak in brand voice, in full sentences: "Please add your name — it goes on the label." / "A little more of your name, if you would."
- One unexplained pull-quote in serif italic, floating over a photograph with no heading and no CTA around it.
- Banned words everywhere on the page: solutions, seamless, elevate, experience, transform, revolutionary, premium (as an adjective about itself).
- Write it in the brief's language. In Arabic, the same rules hold; since Arabic has no italic, the "turn" clause is carried by the accent COLOUR plus a lighter display weight instead, and the whole chassis mirrors to RTL (logical properties, padding-inline, border-inline-start).

## Visual signatures (what makes it instantly recognizable)
- A tinted warm-paper ground — never pure white, never a neutral gray anywhere on the page. Every border and every secondary text colour is the ink colour at reduced alpha.
- Exactly ONE accent hue, deployed in fifteen distinct semantic roles. That repetition is what reads as designed rather than decorated.
- A fixed full-viewport film-grain overlay at opacity .16 with mix-blend-mode multiply. Three lines of CSS, disproportionate payoff.
- An ARCH silhouette derived from the product, repeated at four different scales across four sections. Never a page whose only radius is a uniform 12-16px.
- Ledger rows instead of feature cards: hairline border-top, a two-column auto/1fr grid, an accent N° 01 numeral in the left gutter, zero background, zero radius, zero shadow.
- The hero object is pierced: a rotating edition seal hangs outside its top-left corner and a control pill straddles its bottom edge — it stops reading as "an image in a slot" and starts reading as "an object on a stage."
- A breathing ambient glow behind the product that is DIEGETIC — it is the object's own warmth spilling onto the paper.
- The page closes on a monument: an outlined wordmark at 19.5vw with a 1px accent stroke.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · GROUND→--primary-foreground · GROUND-SOFT→--secondary · NOIR→--accent · ink at 52%→--muted · ink at 16%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
Build nine tonal roles from the fixed tokens and never introduce a tenth hue.
- GROUND: the palette's lightest warm pole, a tinted paper in the #F4EEE3 register. Never #fff, never #fafafa.
- GROUND-SOFT: a second ground roughly 2 percent darker (the #EDE4D3 relationship) used ONLY for section alternation.
- INK: a warm near-black where R is greater than G is greater than B (the #211B15 relationship). Never #111, never #222.
- INK AT ALPHA — this is the rule that makes the page read as tinted paper rather than as UI: body and secondary text are rgba(ink,.72), tertiary and captions rgba(ink,.52), ALL hairlines rgba(ink,.16), placeholder text rgba(ink,.32), a progress-track rgba(ink,.12). No independent gray hex exists.
- ACCENT plus ACCENT-DEEP: one metallic-warm hue from the brief and a darker hover sibling (the #A9834C / #8A6836 relationship). Optionally one lighter sibling for accent text on dark grounds (the #E8C88F register) and one mid sibling for gradient ends (#C79A5C register).
- NOIR: a warm near-black for inverted chapters (#181410 register), plus NOIR-SOFT one step up.
- PAPER-ON-NOIR: a dedicated cream (#F1E9DA register) used for ALL text on dark grounds. White is never used for text anywhere on this page.
- HAIRLINE-NOIR: rgba(paper-on-noir,.18) for rules inside dark chapters.
- ERROR is not another pole: implement validation with a contrast-safe color-mix between var(--primary) and var(--foreground), used nowhere else.

The accent's fifteen jobs — use at least ten of them: the eyebrow rule, the italic turn word in every headline, the decorative quote glyph, star ratings, section N° numerals, the price superscript, strikethrough colour on struck prices, the focus ring, the ::selection background, the progress-bar gradient, the seal orb, the swatch check dot, accordion icon bars, the footer stroke, and ticker separators.

Optional but strongly recommended — A COLORWAY STATE MACHINE. Under a body attribute, reassign the applicable fixed tokens (--background, --foreground, --secondary, --muted and --border) from mixes of the root palette; never create stage-named color properties. Let a real product control in the hero swap them. Its blast radius must reach at least four places: the hero art, the sticky nav including its scrolled/blurred variant, a control far down the page (pre-select the matching swatch in the order form), and the browser theme-color meta. Persist the choice in localStorage and restore it on load. Every consuming property transitions over .8s. A hero with zero state reads as a poster.

## Typography system
THREE families, three non-overlapping jobs, zero ambiguity. Load only the weights actually used, and load them from a real type foundry service rather than the default free-font stack when the brief allows.
- DISPLAY (400/500/600): all headlines, ALL numerals, the wordmark, prices, totals, stepper output, spec numerals. A contemporary display sans with a tall x-height and tight caps.
- BODY (400/500/700): paragraphs, micro-caps, labels, captions, nav, form inputs.
- SERIF, ITALIC ONLY: accent fragments, pull-quotes, the "medium" material line, the decorative quote glyph, ticker emphases. Load ONLY its italic weight, because it is NEVER used upright. That self-discipline is part of the world.

Scale (all clamp, all measured):
- Hero h1: clamp(3.2rem,8.4vw,7.2rem) / line-height .98 / letter-spacing -.015em / display weight 500.
- Section h2: clamp(2.3rem,5vw,4.2rem) / 1.04 / -.01em / max-width 16em.
- Feature h3: clamp(1.45rem,2.4vw,2rem) / 1.15 / -.005em.
- Price: clamp(2.4rem,4vw,3.4rem) / -.01em / weight 600.
- Body: 1.0625rem / 1.6 / 0.
- Micro-caps: .72rem to .8rem uppercase with .16em to .30em tracking.
- Closing wordmark: clamp(4.5rem,19.5vw,17.5rem) / .85 / POSITIVE .06em.

TRACKING IS A FUNCTION OF SIZE: -.015em above 100px, -.01em at 40-70px, -.005em at 30px, 0 at body, +.16em to +.30em at 11-13px uppercase. Line-height likewise: .85-.98 at display, 1.04-1.15 at subheads, 1.6 at body. Target a display-to-micro size ratio of at least 8:1 — a generic page sits at 3:1.

THE ITALIC-SERIF TURN — the single highest-leverage device in this world. One CSS class, six applications. Every h1 and h2 gets its second clause wrapped in an accent span: serif family, font-style italic, weight 400, colour accent, and letter-spacing:0 to explicitly cancel the display face's negative tracking (a serif italic needs its own tracking). Inside section titles give that span font-size:1.02em so the serif optically matches the sans x-height.

NEVER LET A DISPLAY HEADLINE AUTO-WRAP. Break it into explicit block-level line spans so the rag is AUTHORED — and reuse those spans as the animation stagger targets.

PROMOTE NUMERALS. Inside spec rows and stat lines, wrap the number in a bold tag and give it the display family at 1.35rem inside a .98rem body line, so "Height — 42 cm" has a display-face numeral inside a body-face sentence. That one rule is the entire museum-label effect. Prices get a superscript currency mark at font-size .45em, top -.9em, in the accent; struck was-prices get text-decoration-color accent at text-decoration-thickness 1.5px. tabular-nums on every price, total and counter.

## Page chassis
- ANNOUNCE BAR (optional but excellent): a full-bleed ink strip above the nav, centred, .8125rem, letter-spacing .08em, padding .62em, with accent middot separators and one word in the light-accent sibling. Two jobs: commerce register, and giving the sticky nav a dark plate to detach from.
- NAV: position sticky, top 0, z-index 100. TRIPLE-STATED. Default is transparent-to-the-stage background. On scroll past 32px add a scrolled class: rgba(ground,.9) plus backdrop-filter blur(14px) plus box-shadow 0 1px 0 hairline. And the scrolled state is itself colorway-aware, so scrolling inside a dark colorway gives a blurred DARK bar at rgba(noir,.88). Transition colour and background-color over .8s with the shared ease, box-shadow over .5s.
- WORDMARK IS A LOCKUP, NOT A WORD: display face weight 600 at 1.45rem tracked .14em, with a baseline-aligned sub-label in the body face at .6rem, .3em tracking, opacity .55, uppercase. Two type registers inside one mark.
- Nav row: flex, gap 2rem, max-width 90rem, padding 1rem var(--pad). Links .9rem weight 500, opacity .85 to 1 over .25s. A small pill CTA on the right that inverts to the accent on hover. Below 860px the link list disappears and only the CTA remains — no burger overlay is required in this world.
- GRAIN LAYER: position fixed, inset -50%, z-index 90, pointer-events none, opacity .16, mix-blend-mode multiply, background-image an inline SVG data URI of feTurbulence type fractalNoise baseFrequency 0.85 numOctaves 2 stitchTiles stitch, desaturated with feColorMatrix saturate 0, painted onto a 240x240 rect at opacity 0.5.
- Global base: html and body overflow-x clip, scroll-behavior smooth, antialiased, text-rendering optimizeLegibility. ::selection recoloured to accent-on-ground. :focus-visible is a 2px accent outline at outline-offset 3px with border-radius min(var(--radius), 2px). A skip link that slides from top:-4rem to top:1rem on focus over .3s.
- THE COORDINATED NUMBERS — never guess these three independently, derive all of them from the measured announce+nav stack: hero min-height calc(100vh - 8.2rem), sticky column offsets top 6.5rem, and scroll-margin-top 4.5rem on every anchored section.

## Hero forms (pick the one the catalogue calls for — every one of them is LOADED)
1. THE STAGE (default, and the split hero done properly). Grid 1.05fr .95fr, gap clamp(2rem,5vw,5rem), align-items center, padding clamp(2rem,5vh,4rem) var(--pad) clamp(4rem,8vh,6rem), min-height calc(100vh - 8.2rem), overflow clip.
LEFT COLUMN, max-width 36rem, carries the whole offer — not a headline and a button: an eyebrow at .75rem/.22em uppercase in the accent with a ::before rule 2.4rem wide and 1px tall; the hand-broken h1 ending on the italic turn; a lede at clamp(1rem,1.35vw,1.15rem)/1.65 capped at 30em; a price row (baseline-aligned flex, gap 1rem) holding the price with its accent superscript currency, the struck was-price at 1.15rem with an accent 1.5px strike, and an outlined status badge at .72rem/.16em uppercase in a var(--radius) pill with a 1px hairline border; a CTA row with the primary pill and one QUIET secondary link (.9rem, border-bottom hairline, padding-bottom .2em, turning accent on hover); and a reassurance note at .82rem. That is nine differentiated pieces of commerce information.
RIGHT COLUMN IS A STAGE, NOT A PHOTO SLOT — five layers, and the object is CAPPED: justify-self center, width min(100%,30rem). Never a full-bleed photo slab. Whitespace around the object IS the composition.
- z0 — the glow: position absolute, left 50%, top 44%, width 130%, aspect-ratio 1, translate(-50%,-50%), background radial-gradient(circle, color-mix(in srgb, var(--primary) 55%, transparent) 0%, transparent 62%), filter blur(6px), pointer-events none. On dark, drop the same var(--primary) mix to 40%; no stage-glow color property.
- z1 — the frame: aspect-ratio 4/5, overflow hidden, border-radius 15rem 15rem 1.1rem 1.1rem (the arch), box-shadow 0 40px 90px -30px rgba(ink,.35).
- z1a — TWO absolutely stacked images cross-fading on opacity .9s and transform .9s, the outgoing one going to scale(1.04) so the swap carries a subtle zoom.
- z3 — the seal: 7.2rem square at top:-2.4rem left:-2.4rem, OUTSIDE the frame, an inline SVG textPath on a circle carrying tracked uppercase micro-text at 8.6px / .25em with one small accent orb, spinning 30s linear infinite. Shrink to 5.6rem at top:-1.6rem left:-1rem below 600px.
- z4 — the control pill: straddling bottom:-1.55rem, translateX(-50%), width min(19rem,86%), padding .3rem, border-radius var(--radius), 1px stage hairline, box-shadow 0 18px 40px -18px rgba(ink,.4).
- below — a museum caption at .8rem/.06em, centred, height 1.4em, with absolutely-stacked spans cross-fading on opacity .6s so the label follows the control.
The hero TERMINATES IN A RAIL, never in whitespace: a full-bleed strip with border-top 1px hairline and a flex list of four uppercase micro-labels at .8rem/.1em, each with an accent ::before dot .32em wide, padding 1.1rem var(--pad), gap 2.5rem. Below 600px it becomes a 1fr 1fr grid at .68rem/.08em.
2. THE PLINTH (single column, best for one hero object, for RTL pages, and for phone-first merchants). Copy centred above at max-width 44rem with the same eyebrow, authored headline, lede and full price row; then the object centred at width min(100%,34rem) with the identical five-layer stage; then the control pill; then the stat rail full-bleed underneath. The centring is permitted here and only here plus the closing wordmark — nothing else on the page is centred except one placard.
3. THE COUNTER (for a merchant with a small range — food, cosmetics, gadgets). Grid 1.15fr .85fr. The right column holds TWO arch frames instead of one: a tall 4/5 lead frame at radius 15rem 15rem 1.1rem 1.1rem, and a small square detail plate at aspect-ratio 1 overlapping it by margin-top -3rem and margin-inline-start -2.5rem at radius 6rem 6rem 1rem 1rem, with its own lighter shadow 0 30px 70px -30px. The price block sits in the gap between them on the paper, not inside either frame. Same seal, same rail, same glow behind the lead frame only.

## Section seams (the atelier's own vocabulary — every boundary uses one, never the same twice in a row)
This world escapes the linear card stack CHROMATICALLY and through stickiness, not spatially. Use at least five of these seven per page.
- CHROMATIC INVERSION: full-bleed ground changes as chapter breaks — an ink ticker band, a near-black chapter, a full-bleed photograph, a ground-soft transactional chapter, an ink footer. Aim for four to five ground changes across a twelve-section page. Sections change by changing COLOUR, not by adding whitespace.
- TICKER RIBBON: a 1.05rem-tall ink band between two chapters, border-block 1px rgba(light-accent,.14), holding a width:max-content flex track of TWO identical chunks animated translateX(-50%) over 30s linear infinite. Items are display face 400 at 1.05rem, .06em tracking, padding 0 1.4rem, with accent separators and inline serif-italic emphases in the light-accent sibling. This is the cheapest possible anti-card-stack device: instead of 8rem of empty space, a black ribbon of moving text.
- BUTT-JOIN: one section gets padding-top:0 so it welds to the previous one and the two read as a single continuous chapter with no double gap.
- HAIRLINE SEAM: a section announced by border-block 1px hairline plus a 2-percent-darker ground, never by empty space.
- TERMINAL RAIL: the hairline micro-label rail that ends the hero (and may end any chapter), which then meets the ticker — TWO transitional devices where a generic page has 6rem of nothing.
- THE BREATH: one section with NO heading, no eyebrow, no CTA and no explanation — a full-bleed photograph at height min(92vh,54rem) with one line of serif-italic voice over it. A generic builder puts a headline and three cards here. Do not.
- STICKY ANCHOR: one position:sticky media column at top 6.5rem so a single image serves an entire chapter of scrolling while three ledger rows pass it.

## Layout physics
- ONE inline-padding token: clamp(1.25rem,4.5vw,4.5rem). Container max-width 90rem. Section block padding clamp(5rem,11vh,8.5rem) — the middle term is vh, so vertical rhythm scales with viewport height.
- MEASURE IS CAPPED IN EM, NOT PX: body 34em, lede 30em, pull-quote 20em, aside 24em, accordion body 38em, form sub-copy 32em, hero copy 36rem. Line length must survive a font-size change.
- NO GRID IS 50/50. Skew every two-column grid by 5-25 percent and argue the direction from content weight: hero 1.05fr/.95fr, story .92fr/1.08fr (the MEDIA column is the narrow one because it is sticky and the text is three long rows), inverted chapter 1.05fr/.95fr, transactional .88fr/1.12fr (form 27 percent wider than the image), question list .8fr/1.2fr (the HEADING column smaller than the list). At least one grid must invert expectation. Column gaps clamp(2.5rem,6vw,6rem).
- OVERFLOW IS A COMPOSITIONAL DEVICE. Exactly four elements should deliberately break their container: the seal at -2.4rem, the control pill at -1.55rem, a decorative quote glyph at top -1.3rem / left -.35rem, and the glow at width 130%. This is only safe because overflow:clip sits on every section that contains a piercing element, plus overflow-x:clip on html and body.
- LEDGERS, NOT CARDS, for features, values and specs: padding clamp(1.8rem,3.5vw,2.6rem) 0, border-top 1px hairline (border-bottom on the last), grid-template-columns auto 1fr, gap 1.4rem clamp(1.2rem,3vw,2.4rem), with N° 01 in the display face at .95rem, .1em tracking, accent colour, padding-top .45rem in the left gutter.
- GUTTER RULES, NOT CARD EDGES, for multi-column blocks: three columns at gap clamp(2rem,4vw,4rem), then on the adjacent siblings apply border-inline-start 1px hairline, padding-inline-start clamp(2rem,3vw,3rem), and margin-inline-start calc(clamp(2rem,4vw,4rem) * -.5) so the rule sits in the MIDDLE of the gutter. Only above 1024px; below that they stack at gap 3rem, max-width 40rem.
- ZERO ROW GAP GRIDS: a two-column definition list at gap 0 clamp(2rem,5vw,4.5rem) whose rows are separated by border-top hairlines, each row a space-between flex with a .74rem/.16em uppercase term on the left and a right-aligned value on the right. Below 600px it becomes one column with the value falling under the term.
- ONE CENTRED PLATE AS A PATTERN BREAK: a placard at max-width 62rem, margin inline auto, border 1px hairline, border-radius min(var(--radius), 1.2rem), padding clamp(2rem,5vw,4rem), and a RAKING-LIGHT sheen background: linear-gradient(160deg, color-mix(in srgb, var(--background) 50%, transparent), transparent 55%). Its head is centre-aligned — eyebrow, title at clamp(1.7rem,3vw,2.4rem), a serif-italic MEDIUM line naming the materials, and a 3.4rem by 1px var(--primary) rule with margin 1.4rem auto 0.
- SHAPE IS BRAND. Derive one non-rectangular silhouette from what is being sold and repeat it at four scales: 15rem 15rem 1.1rem 1.1rem on the hero frame, 12rem on the story media, 15rem on the inverted-chapter frame, 9rem 9rem 1rem 1rem on the order card, collapsing to 10rem 10rem 1rem 1rem below 600px. Plain frames stay at 1.1rem. Never ship a page whose only radius is a uniform 16px.
- IMAGE OVERSCAN FUNDS MOTION: any parallaxed image is top:-12% and height:124% inside an overflow:hidden parent, so travel never exposes an edge. Its scrim is linear-gradient(to top, rgba(dark,.62), rgba(dark,.05) 55%) — dark only where the type sits.
- OVERLAY CONTENT STILL OBEYS THE GRID: an absolutely-positioned quote over a photograph carries the same container class so it aligns to the same 90rem measure as everything else, positioned bottom clamp(2.5rem,8vh,5.5rem).
- RESPONSIVE COLLAPSE: below 1024px every two-column grid becomes 1fr, sticky becomes static, the hero stage narrows to min(100%,26rem), and in the inverted chapter the media takes order:-1 so the dark chapter OPENS on the photograph.

## Motion identity (GSAP 3 + ScrollTrigger from a CDN; native scroll — NO smooth-scroll library)
THE SAFETY CONTRACT IS NON-NEGOTIABLE AND COMES FIRST. Compute a single flag: reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, hasGsap = typeof window.gsap !== "undefined", animate = hasGsap && !reduced. EVERY hidden initial state — every autoAlpha 0, every y offset, every start scale — is set with gsap.set() INSIDE the animate branch. Never author opacity:0 or visibility:hidden in CSS for an animated element. If the CDN fails or motion is reduced, the page is simply fully visible and fully functional. Add a CSS prefers-reduced-motion block that beyond the blanket .01ms override also sets the ticker track to animation:none and width:auto and stops the seal spin.

TIMING BANDS — every duration on the page belongs to one of these: .25-.45s interaction feedback; .5-.7s component state; .8-.9s theme or identity change; 1.0-1.4s narrative or data reveal; 1.8s hero image settle; 3.4s ambient loop; 30s infinite decorative. ONE shared CSS easing token, cubic-bezier(.22,.61,.2,1), used by roughly twenty transitions. GSAP eases: power3.out for entrances, power2.out for settles and counters, power3.inOut for clip wipes, sine.inOut for the ambient loop, none for scrub.

TRAVEL DISTANCES ARE TINY. y offsets of 14 / 30 / 34 / 60 only — use three different distances inside one hero to encode three depth planes. Scales of .85 / .96 / 1.04 / 1.14 / 1.16. Hover lift translateY(-2px). Glyph nudge translateX(4px). NOTHING on this page travels 100px.

The mandatory motion set:
1. HERO ENTRANCE — four tweens at OVERLAPPING absolute timeline positions, not a sequence. Set: copy blocks and rail to autoAlpha 0, y 34; the frame to autoAlpha 0, y 60, scale .96; the frame image to scale 1.16; the seal, caption and control to autoAlpha 0, y 14. Then tl.to(copy, {autoAlpha:1, y:0, duration:1, stagger:.09}, .15) .to(frame, {autoAlpha:1, y:0, scale:1, duration:1.25}, .3) .to(frameImg, {scale:1, duration:1.8, ease:"power2.out"}, .3) .to(furniture, {autoAlpha:1, y:0, duration:.8, stagger:.1}, 1.05). Roughly 2.1 seconds of choreographed arrival: the image lands with a Ken Burns settle inside its already-moving frame, and the furniture powers on last.
2. ONE AMBIENT DIEGETIC LOOP, and only one per page: gsap.to(glow, {scale:1.12, opacity:.75, duration:3.4, ease:"sine.inOut", yoyo:true, repeat:-1}). It must be JUSTIFIED BY THE SUBJECT — a lamp breathes light, a coffee page gets rising steam, a perfume page a slow drifting haze. A floating decorative blob is not diegetic and is banned.
3. GENERIC REVEALS — mark roughly fifteen elements with a reveal attribute, gsap.set({autoAlpha:0, y:30}) then .to({autoAlpha:1, y:0, duration:.9, ease:"power3.out"}) with scrollTrigger start "top 90%", once:true.
4. CURTAIN WIPES on framed images: clipPath from inset(100% 0% 0% 0%) to inset(0%) over 1s power3.inOut while the inner image counter-scales 1.14 to 1 over 1.4s power2.out at timeline position 0, then clearProps both. start "top 88%" — images start slightly later than copy so the wipe is actually seen. once:true.
5. ONE SCRUBBED PARALLAX ON THE WHOLE PAGE, on the breath photograph: gsap.fromTo(img, {yPercent:-7}, {yPercent:7, ease:"none"}) with trigger the section, start "top bottom", end "bottom top", scrub:true — funded by the 124 percent / -12 percent overscan.
6. ONE NUMBER COUNT-UP via a proxy object: tween {v:0} to the target over 1.4s power2.out with onUpdate writing Math.round(obj.v) to textContent, triggered at "top 90%" once, PLUS a 4000ms setTimeout fallback that paints the final value instantly in case the trigger never fires on a deep-linked or already-scrolled load.
7. THE INFINITE TICKER, built from two duplicated chunks in a width:max-content track — CSS keyframes, not GSAP.
8. THE ROTATING SEAL — CSS keyframes spin 30s linear infinite on the SVG.

once:true on EVERYTHING non-scrubbed. Nothing on this page re-animates on scroll-up.

MICRO-INTERACTION KIT (all CSS, all inside the timing bands):
- Button: transform translateY(-2px) on hover over .35s, and SEPARATELY a decoupled child transition on the arrow glyph, transform translateX(4px) — two transitions, not one.
- Segmented control: an ::after thumb at top .3rem, bottom .3rem, left .3rem, width calc(50% - .3rem), sliding translateX(100%) over .5s with the shared ease, while the label colour flips on a .45s transition carrying a deliberate .05s DELAY so the text changes just after the thumb starts.
- Radio cards driven by :has(input:checked) — accent border plus box-shadow 0 0 0 1px accent plus a lighter background over .3s, with a check dot going transform scale(0) to scale(1) over .3s.
- Stepper buttons invert (ink fill, ground text) over .25s; disabled at opacity .3.
- Inputs on focus change THREE properties together over .3s: border-color to accent, box-shadow 0 0 0 1px accent, and the background lightening.
- Validation error entrance: opacity 0 and translateY(-3px) to visible over .3s, with min-height:1.2em reserving the space so NOTHING reflows.
- Accordions: grid-template-rows 0fr to 1fr over .5s with an overflow:hidden inner — the correct way to animate height auto. Its icon is two 1.5px pseudo-element bars, the second rotated 90deg and un-rotating to 0deg over .45s.
- Theme-change transitions on the hero and nav run at .8s; image cross-fades at .9s in the hero, .6s on captions, .7s on the order card.

## Components
- BUTTONS: pills only — border-radius: var(--radius) (this world's :root sets --radius: 999px). Primary is ink-filled with ground text, padding 1.02em 1.7em, .95rem weight 500, .02em tracking, line-height 1, inline-flex with gap .65em holding an arrow glyph; on hover it becomes accent-deep and lifts. Small variant .78em 1.35em at .85rem. GHOST is background transparent with box-shadow inset 0 0 0 1px as the border, going to inset 0 0 0 1px accent plus accent text on hover. Disabled at opacity .45 with cursor not-allowed and no lift. UI NEVER uses a real border for its outline — inset box-shadow is the border replacement.
- SHADOWS: only on PHOTOGRAPHS, and always large-blur, large-negative-spread, low-opacity, hue-tinted — 0 40px 90px -30px color-mix(in srgb, var(--foreground) 35%, transparent) on the hero frame, 0 30px 70px -30px on smaller frames, 0 40px 90px -30px color-mix(in srgb, var(--foreground) 70%, transparent) on frames sitting on dark grounds, 0 18px 40px -18px color-mix(in srgb, var(--foreground) 40%, transparent) under the floating control pill. Zero shadows on cards, panels, nav items or buttons.
- INPUTS: background rgba(white,.55), border 1px hairline, border-radius min(var(--radius), .7rem), padding .95em 1.1em, 1rem. Labels above at .74rem, weight 500, .18em tracking, uppercase, in rgba(ink,.52), margin-bottom .6rem. Hint text .78rem. Phone fields are type tel with inputmode numeric and a real pattern. Selects are styled to match the inputs exactly.
- ACCORDION: a hairline-topped list, each item hairline-bottomed, the question a full-width flex button in the display face at clamp(1.05rem,1.6vw,1.3rem) weight 500, padding 1.4rem 0, turning accent-deep on hover and when expanded. Single-open behaviour: opening one closes the others, with aria-expanded maintained and role region plus aria-labelledby on the panels.
- DECORATIVE QUOTE GLYPH: the serif italic opening quote at 4.6rem, line-height 1, accent at opacity .5, absolutely positioned to overflow its column in TWO directions.
- FOOTER: an ink band with a newsletter row (1fr 1fr, collapsing to 1fr), then THE MONUMENT — the wordmark at clamp(4.5rem,19.5vw,17.5rem), line-height .85, letter-spacing +.06em (positive, because hairline strokes need air), color transparent, -webkit-text-stroke 1px accent at .5 alpha, user-select none, aria-hidden, centred. Then a hairline-topped row of links at .85rem in rgba(paper,.7) and a credit line at .8rem in rgba(paper,.45).
- CRAFT DETAILS THAT SIGNAL INTENT: explicit width and height on every image; fetchpriority high on the LCP image and loading lazy elsewhere; alt empty plus aria-hidden on decorative duplicates and art-directed descriptive alt on content images; aria-live polite on error and status text; an output element for the stepper; sr-only text for star ratings; a skip link; and an inline-SVG data-URI favicon plus a theme-color meta that follows the active colorway.

## Conversion objects (this world SELLS — these are its money components)
- THE PRICE BLOCK: a baseline-aligned flex row at gap 1rem — display-face price at weight 600 with an accent superscript currency mark at .45em / top -.9em (for currencies written as a suffix, the mark goes after the numeral at the same size and colour); a struck was-price at 1.15rem in rgba(ink,.66) with text-decoration-color accent at 1.5px; and an outlined status pill at .72rem / .16em uppercase, border-radius var(--radius), 1px hairline border. Under it a reassurance line at .82rem stating exactly what happens on submit and what it costs today.
- PRODUCT CARDS ARE NOT BOXES. This world may use cards, but a product card here is a shaped FRAME plus a ledger row, never a bordered container with a shadow: an arch-topped frame at 9rem 9rem 1rem 1rem, aspect-ratio 4/5, overflow hidden, carrying the photograph's own 0 30px 70px -30px shadow — and nothing else. Beneath it a border-top hairline row: the name in the display face weight 500 on the start side, the price in the display face weight 600 with tabular-nums on the end side, and a .74rem / .16em uppercase micro-line under the name. Grid repeat(auto-fit, minmax(15rem,1fr)) at gap clamp(1.6rem,3vw,2.6rem) — and alternate the frame ratios (4/5 and 1/1.08) so the grid is never a metronome. The card lifts NOTHING on hover; instead the image inside the frame swells scale(1.03) over 1.6s and the name's hairline turns accent.
- THE ORDER CARD is sticky at top 6.5rem beside the form: the arch frame with its cross-fading colorway images, then an EDITION METER — a space-between row with the count in the display face at 1.5rem next to .8rem / .1em uppercase micro-caps, a 3px progress track at rgba(ink,.12) radius min(var(--radius), 2px) whose fill is a linear-gradient(to right, accent, accent-light) transitioning width over 1.4s (the width is written by JS at the same moment the count-up fires), and a note at .8rem. Scarcity stated as a fact, never as a countdown clock.
- THE ORDER FORM IS THE CLIMAX OF THE PAGE, on a ground-soft chapter with border-block hairline seams, grid .88fr 1.12fr. It must be a real form with real UX, and for a cash-on-delivery market it collects: full name, phone, wilaya or region (select styled identically to the inputs), address, quantity, and a delivery choice. Variant and delivery choices are RADIO CARDS built with :has(input:checked): border 1px hairline, radius min(var(--radius), 1rem), padding 1rem 1.1rem, gap .9rem, background color-mix(in srgb, var(--background) 35%, transparent) going to a 70% mix when checked, with a physically modelled dot — background radial-gradient(circle at 34% 30%, var(--background), var(--foreground)) plus box-shadow inset 0 0 0 1px color-mix(in srgb, var(--foreground) 14%, transparent) and inset -4px -6px 10px color-mix(in srgb, var(--foreground) 14%, transparent) for a specular highlight and a shadowed underside — and a 1.15rem check ring whose inner var(--primary) dot pops scale(0) to scale(1).
- QUANTITY is a stepper, not a number input: an inline-flex group at border-radius var(--radius) with 2.9rem true-circle buttons at 50% and an output element at min-width 2.6rem in the display face at 1.25rem. It has a cap, and THE CAP IS GIVEN A REASON in the hint text.
- THE FOOT OF THE FORM is a border-top hairline row, space-between, padding-top 1.6rem: a live TOTAL in the display face at 2rem weight 600 with tabular-nums under a .82rem / .1em uppercase label, plus a struck was-total in the body face with the accent strike, both recomputing on every quantity, variant and delivery change — beside the submit pill. Below, a .8rem note.
- VALIDATION IS BLUR-GATED: keep a touched map so an error only appears after a field's first blur, never while someone is still typing into a fresh field. Errors are full sentences in brand voice, in the error mix of var(--primary) and var(--foreground), with min-height reserved.
- SUBMIT HAS A DELIBERATE 750ms PENDING STATE — the button label becomes a human present-tense sentence — and then the form CROSS-FADES IN PLACE into a success panel absolutely positioned over it inside the same box: the success side transitions opacity, transform and visibility over .7s with transition-delay .25s, .25s, 0s; the form leaves over .45s to translateY(-10px) with visibility 0s .45s, so focus never lands on a hidden element. The success panel opens on a large order number inside an 11rem SVG ring drawn by stroke-dashoffset — a circle with pathLength 100, stroke-dasharray 101, stroke-dashoffset 101 to 0 over 1.4s with a .5s delay, stroke-width 1.5, rotated -90deg — with the numeral at 2.6rem display weight 600 and a .62rem / .26em uppercase sub-label. Layer a GSAP pop on the numeral: fromTo({scale:.85, autoAlpha:0}, {scale:1, autoAlpha:1, duration:.9, delay:.35, ease:"power3.out"}). The success copy echoes the buyer's own name and choices back to them. The instant validation clears — as the success side begins its entrance — the page hands the entry to the house ledger by dispatching the wandit:lead CustomEvent on document with the buyer's fields flat in detail (name, phone as typed, wilaya, commune, plus the canonical order keys product, quantity, price, delivery and total when collected, and colorway under its own key), and the form keeps its one off-canvas decoy input marked data-wandit-hp that the page's own script never reads or validates.
- PERSIST IT: store the order and the chosen colorway in localStorage; on return, restore the colorway and show the success state INSTANTLY (no animation) so a returning buyer is not asked to order twice.
- CROSS-SECTION STATE LINKS: a CTA in an earlier chapter sets the colorway AND then smooth-scrolls to the order section, so a button in section four rewrites section eight before travelling to it. Sections talk to each other.
- CTAs anywhere else on the page: the pill with the sliding arrow, or the quiet hairline text link. There is never a full-width solid rectangle button.

## Object-record furniture (REQUIRED — this is the atelier's voice)
- Fig. captions: a space-between flex row under every framed image — descriptive text on the start side in rgba(ink,.52) at .78rem / .06em, the figure number in the accent on the end side.
- THE WALL LABEL: the centred placard, whose head reads eyebrow, title with the year, and an italic-serif MEDIUM line naming materials and edition in one breath ("Hand-thrown stoneware, brushed brass, travertine — edition of 250"), then the 3.4rem accent rule, then the zero-row-gap definition list with promoted numerals, then a footnote whose last clause is a small human joke or a promise.
- THE EDITION SEAL: circular textPath micro-type naming the workshop and the edition, rotating forever.
- N° 01 / N° 02 / N° 03 in the accent in every ledger gutter.
- Definition rows on dark grounds: a flex li with a min-width 9.5em uppercase accent label at .78rem / .14em and a value in rgba(paper,.82), separated by hairline-noir rules.
- The stat rail's four uppercase micro-labels — real facts (material, lead time, delivery, guarantee), never adjectives.
- Reviews with a star row in the accent at .28em tracking, the quote in serif italic at clamp(1.12rem,1.5vw,1.3rem)/1.5, and an uppercase .12em citation whose name is weight 500 in full ink.
- A cite line under the pull-quote at .8rem / .18em uppercase in the light accent.
- These invent no business fact — they are TYPESETTING. Fill them from the brief.

## Atelier ban list (in addition to the global one)
Neutral grays of any kind · pure white text or a pure white ground · box-shadows on cards, panels, buttons or nav · a uniform 12-16px border-radius as the page's only shape · feature cards with backgrounds and icons · icon grids and emoji bullets · a 50/50 two-column grid · a full-bleed photo slab as the hero right column · a hero with no state, no price and no offer · centred body copy (only ONE placard and the closing wordmark may be centred) · gradients used as decorative fills (a 160deg raking sheen and a 3px progress bar are the only gradients allowed besides the diegetic glow) · countdown timers and fake urgency · glassmorphism · bouncing chevron scroll cues · smooth-scroll libraries · pinned or horizontally-scrolling sections (this world does not need them) · per-character text splitting · more than ONE ambient loop · more than ONE scrubbed animation · any hidden state authored in CSS.

## Intensity
This world fails softly and invisibly: every wrong decision here is a small comfortable default. A gray border instead of ink-at-16-percent. A 16px radius instead of an arch. A card instead of a ledger row. A photo instead of a stage. A headline with one clause instead of a turn. Executed at 60 percent this is exactly the generic page it is meant to replace. Executed at 100 percent — grain over tinted paper, one accent doing fifteen jobs, an object lit by its own breathing glow with a seal hanging off its corner, ledgers and wall labels and a form that talks like a person — it looks like a workshop that has been selling to people who know, for years. Push INTO the specificity. Every single number above is load-bearing.`,
	energy: "medium",
	family: "atelier",
	id: "atelier",
	industries: [
		"ecommerce",
		"ceramics",
		"crafts",
		"home-decor",
		"furniture",
		"beauty",
		"cosmetics",
		"perfume",
		"coffee",
		"food-artisan",
		"patisserie",
		"fashion",
		"accessories",
		"gadgets",
	],
	kind: "both",
	mood: ["warm", "crafted", "tactile", "editorial", "collectible"],
	name: "Atelier",
	preview: {
		ground: "#F4EEE3",
		ink: "#211B15",
		accent: "#A9834C",
		fontFamily: "Space Grotesk",
		sampleWord: "L'Atelier",
	},
	priceFeel: "premium",
	tagline:
		"Tinted paper with a grain you can almost feel, one brass thread running through everything, and your product lit like a museum piece with its own edition number — a shop that looks hand-made, right down to the order form.",
};
