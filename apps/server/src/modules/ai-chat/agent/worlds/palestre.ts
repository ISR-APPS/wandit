import type { DesignWorld } from "./types";

/**
 * PALESTRE — training-floor energy: condensed uppercase at violent scale, one
 * page-wide diagonal angle used as the seam between every scene, duotone
 * action photography, and numbers that count as you scroll. The loud pole of
 * the library, priced for real neighbourhood clubs. The doc is appended
 * VERBATIM to the builder system prompt.
 */
export const palestre: DesignWorld = {
	avoidFor: [
		"law",
		"notary",
		"wedding",
		"luxury-real-estate",
		"baby",
		"funeral",
		"spa",
	],
	doc: `# DESIGN WORLD: PALESTRE — the training floor

## Philosophy
This page is a TRAINING FLOOR, not a website. It has the physics of the room it sells: hard surfaces, no soft edges, weight that lands, a clock running, and numbers on the wall readable from across the hall. Condensed uppercase type at violent scale does the shouting; ONE diagonal angle, repeated everywhere, does the cutting; duotone photography reduces every body in the room to ink and one sweat-neon tone; mono tabular numerals prove the claims — kilos, reps, minutes, members, weeks. Everything is a slab, a rule, a counter or a cut. Nothing floats, nothing glows; only action slabs and chips take the token-borne pill silhouette, and nothing apologises.

The failure mode this world exists to kill is the "fitness landing page": a smiling stock model with a dumbbell, three pastel cards with icons, a soft green button, the word "wellness". Every rule below pushes toward the opposite — the wall of a real salle, printed in two colours because two colours is what the printer had. And the loudness is DISCIPLINED: one angle, one accent, two type registers, one token-borne action radius, repeated forty times. One idea repeated forty times reads as a brand; forty ideas read as a mess.

## The vibe
A coach who counts. Copy is short, imperative, second-person, and rarely exceeds nine words: "Six semaines. Apporte de l'eau." / "Première séance offerte — ramène ta pièce d'identité." No adjective does sales work; the numbers do it.
- Every headline is a COMMAND or a MEASUREMENT, never a description. Not "Notre salle moderne vous accompagne" but "Douze semaines. Ton corps décide."
- Every promise carries a unit: minutes, semaines, kilos, séances, jours par semaine, DZD par mois. Micro-copy is written the way a whiteboard is written — never an experience, always a session with a duration and a level.
- Validation errors talk like a coach, short and without cruelty: "Il manque ton numéro." / "Le nom, d'abord."
- Banned in every language: generic bien-être filler, "expérience", "solutions", vague "transformer", "premium" about itself. If a sentence would work for a spa, delete it.
- Write in the brief's language. In Arabic the same voice holds, carried by weight and the accent colour (see the RTL note).

## Visual signatures (what makes it instantly recognizable)
- ONE ANGLE, PAGE-WIDE. A single cut angle is chosen once (7-10deg) and every diagonal — clip-path section edges, skewed slabs, rotated marquees, the featured flag, the split hero, image wipes — uses that exact angle. Two different diagonals on one page is a bug.
- Condensed uppercase display at wordmark scale: clamp up to 15-18vw, edge to edge, line-height .8, weight 800-900.
- Duotone imagery: every photograph is exactly two tones — the ground's dark pole in the shadows, the accent or light pole in the highlights. No full-colour photograph exists except a merchant logo and honest before/after evidence.
- Numbers everywhere in mono tabular, counting as you scroll — never on a timer.
- The WELDED GRID: grids whose 2px gaps are the accent showing through from the container behind. The grid lines ARE the accent.
- Outline-stroke type: giant round numerals and the closing wordmark drawn with -webkit-text-stroke at weights that scale with size.
- Token-borne pill radius on action slabs and chips, zero radius on every non-action surface, zero soft shadows: separation is a 3px accent rule, a 2px welded gap, a 1px table hairline or a hard diagonal — nothing else.
- The page ends mid-letter: the closing wordmark is clipped by the bottom of the document.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — FLOOR or CHALK→--background · the opposite type pole→--foreground · ACCENT→--primary · the dark pole→--primary-foreground · the inverted-ground pole→--secondary · ACCENT-DEEP→--accent · type colour at 56%→--muted · type colour at 14%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
Two poles and ONE accent. Build nine tonal roles from the fixed tokens, never a tenth hue.
- The brief's poles decide the variant. FLOOR (default): the dark pole as ground — a rubber-mat near-black shifted 2-4 RGB points (the #0B0B0D / #101014 register), never pure #000. CHALK: the light pole as ground — a dusty off-white with a grey cast (the #EDEBE6 register), never #fff. Commit to one; the page has a ground plus INVERTED chapters, not a light half and a dark half.
- ALPHA STEPS OF THE TYPE COLOUR do all secondary work — no detached grey ever exists: display 1, body .78, secondary .56, tertiary .34, table hairlines .14, strong internal rules .28.
- ACCENT: exactly ONE hyper-saturated hue from the brief — the sweat-neon (acid lime, volt yellow, blood orange, hazard red, electric blue register). Never purple or violet in any variant (global ban, restated because this world attracts it). ACCENT-DEEP: one sibling 12-18% darker for pressed states.
- The accent's jobs — use at least ten: the 3px rule on every cut edge, welded grid lines, counter numerals, progress fills, the active interval in a timer strip, the ONE emphasised word in a title, chapter round numbers, the plan flag, ::selection, :focus-visible, the WhatsApp glyph, currency marks, marquee separators, the fill that wipes into an outline slab. An accent only on buttons is a failed palette.
- ERRORS introduce no hot tone: validation uses a 3px var(--primary) bar plus full-strength var(--foreground) type, or a contrast-safe mix of those two fixed tokens. Never a second hue.
- Declare color-scheme (dark on floor, light on chalk) and a theme-color meta matching the ground — inverted chapters do NOT change it.
- DUOTONE IS A COLOR RULE, NOT A FILTER PRESET. Exact two-layer recipe: wrapper at position:relative, isolation:isolate, overflow:hidden, background the applicable dark fixed pole (var(--background) in FLOOR, var(--foreground) in CHALK); the img at object-fit:cover with filter:grayscale(1) contrast(1.22) brightness(1.02); a ::before at inset:0 repeats that dark fixed pole with mix-blend-mode:lighten; an ::after at inset:0 uses var(--primary) on hero and interlude images, or the applicable light fixed pole (var(--foreground) in FLOOR, var(--background) in CHALK) on portraits, with mix-blend-mode:multiply. Do not create duo-shadow or duo-light color properties. @supports not (mix-blend-mode: multiply) falls back to filter:grayscale(1) contrast(1.25) plus a 3px var(--primary) border.
- HONESTY OVERRIDE: merchant-supplied before/after evidence is NEVER duotoned, tinted, flatteringly cropped or animated between states — flat, in colour, in a hard frame with a mono date caption.

## Typography system
THREE families, three sealed jobs. Never Inter, Roboto or Open Sans (global ban); at most 3 families, only the weights used.
- DISPLAY: a CONDENSED grotesk with a real 800/900 (the Archivo Narrow / Oswald / Anton / Barlow Condensed territory; a variable width axis at 75-85% is better still). UPPERCASE ONLY, above 2.4rem and nowhere else — wordmark, section titles, plan names, marquee text, monument.
- BODY: a workhorse grotesk with 400/600/800 (Barlow / Public Sans / Archivo territory), sentence case, for prose, helper text and slab labels.
- MONO: a technical monospace with true tabular figures (JetBrains Mono / Roboto Mono / IBM Plex Mono territory), 400/500/700. It owns ALL numerals, micro-labels, timers, schedule times, prices, captions. A number set in the body face is a bug here.

Scale — all clamp, ratio about 20:1, the middle deliberately empty:
- Hero wordmark: clamp(3.4rem, 15vw, 14rem) / .8 / -.025em / 900. A name under 8 characters may go to 18vw; a long one drops to 11vw and breaks onto two lines rather than shrinking below 9vw.
- Section title: clamp(2.6rem, 7.5vw, 6.4rem) / .86 / -.02em / 800, max-width 14ch so the break is authored.
- Statement line (the only mid-size type allowed): clamp(1.5rem, 3vw, 2.4rem) / 1.12 / -.01em, max-width 24ch.
- Counters: clamp(2.8rem, 7vw, 6rem) / .85 / -.04em, mono 700, tabular-nums, the unit as a .34em mono accent span on the same baseline (flex, align-items:baseline).
- Body 1.0625rem / 1.58, measure 42ch (lede 34ch, caption 30ch). Micro-labels: mono uppercase .7-.78rem at .18-.26em — and per the global rule, never the opening element of a hero.
- Closing monument: clamp(4rem, 18vw, 17rem) / .78 / -.02em, outlined.
TRACKING IS A FUNCTION OF SIZE: -.025em above 8rem, -.02em at 3-6rem, -.01em at the statement, 0 at body, +.18 to +.26em at mono micro. Condensed faces already run tight — never add positive tracking to display type to make it breathe; that turns a sports page into a tech page.
OUTLINE TYPE IS A MATERIAL, used at least three times per page (chapter numerals, one title word, the monument): color:transparent plus -webkit-text-stroke, and THE STROKE SCALES WITH THE SIZE — 1.5px under 4rem, 2px at 4-8rem, 3px at 8-12rem, 4px above 12rem. A 1px stroke on a 14rem word disappears; that is the most common execution error here. Outline and fill may be MIXED INSIDE ONE HEADLINE.
EMPHASIS IS NOT ITALIC — this overrides the global "one italic word in the headline" device. Condensed faces have no usable italic, so emphasis is (a) the accent colour, (b) a skewX at the page's cut angle on the span, or (c) an accent slab behind the word at zero radius with .1em padding. Pick ONE per page and repeat it.
PROMOTE EVERY NUMBER: a quantity inside prose is a mono 700 span at 1.15em in full-strength type while the sentence sits at .78 alpha.

## Page chassis
- THE NAV IS A SLAB, NOT A BAR: position:fixed; inset:0 0 auto 0; z-index:100; height 68px; ground background at full opacity (no blur, no transparency, no glass); border-bottom 3px solid accent. Wordmark left in display 800 at 1.35rem/.01em; a mono status line of real facts only (opening hours, next class) at .72rem/.2em in the .56 step, hidden below 900px; and a CTA SLAB FLUSH TO THE RIGHT VIEWPORT EDGE — full nav height, zero margin, border-radius var(--radius), accent background, ink label in mono 700 uppercase at .78rem/.14em. It touches the edge of the screen; that decision alone stops this being a template navbar.
- SCROLL: past 240px the nav compresses to 52px over .22s and the accent border grows to 4px; past 520px on scroll-down it hides with translateY(-102%) over .28s power3.out and returns on scroll-up (ScrollTrigger self.direction), suppressed while the menu is open. SCROLL PROGRESS is drawn ON its bottom edge: a 3px accent-deep line at scaleX(0), transform-origin:left, scrubbed to document progress with ease "none" — the motif that travels.
- BURGER: three bars of DIFFERENT widths (26px, 18px, 26px), 3px tall, 5px apart, in the accent; open rotates the outer two into an X over .22s while the middle scales X to 0 over .12s. The menu is a full-screen ink takeover entering with a clip-path wipe along the page angle over .42s, holding numbered links in display 800 at clamp(2.2rem,9vw,4.5rem) staggered .05.
- BASE: html,body{overflow-x:clip} (mandatory — rotated slabs and cut sections overflow by design). scroll-behavior:smooth, scroll-padding-top:5.5rem. A skip link slamming from top:-4rem to top:0 on focus.
- RADIUS LAW: every action slab and chip consumes var(--radius) directly (:root sets --radius: 999px); containers, inputs and image frames use min(var(--radius), 0px); progress tracks use min(var(--radius), 2px); true status dots use 50%. These var(--radius)-derived declarations are the sanctioned mechanism; another corner treatment means the page has drifted.
- SHADOW LAW (override): no blurred shadows anywhere. The one permitted shadow is a HARD OFFSET with zero blur — 6px 6px 0 var(--primary) — on at most two elements per page.
- TEXTURE: optional fixed grain at opacity .05-.07 — inline SVG feTurbulence fractalNoise, baseFrequency .9, numOctaves 2, tiled 200px, inset:-40px, z-index:60, pointer-events:none; .09 on the chalk variant so it reads as paper dust.

## Hero forms (pick the one the brief calls for — never the marketplace split)
1. THE WALL (default). A full-bleed duotone action photograph as the GROUND (position:absolute; inset:0; overscanned to 116%, object-position chosen consciously — a body mid-effort cropped tight, never a wide empty gym interior). min-height:100svh, content FLOOR-ANCHORED (flex-direction:column; justify-content:flex-end; padding-bottom clamp(2rem,6vh,4rem)). The hero's bottom edge is CUT at the page angle and the next scene interlocks into it. Over the image a two-axis ramp: vertical from the ground at .86 alpha at the floor, .18 at 45%, .04 at 70%, plus a horizontal ramp weighting the type side to .7 — the bottom stop EQUALS the page ground so no seam shows under the diagonal. On top: the business name as a wordmark at 15vw mixing fill and outline across its lines; ONE statement line at 24ch; and a WELDED STAT RAIL fused to the floor — a 2px-gap grid of three or four mono counters (membres, cours par semaine, années, m2) with accent grid lines. CTA policy: exactly TWO slabs side by side with a 2px accent gap between them, a filled primary and an outline secondary (WhatsApp or the schedule), both skewed at the page angle with counter-skewed labels.
2. THE SCOREBOARD (no photography — for a weak image budget or a page that must load on 3G). Ink ground, zero images. The wordmark broken across two or three lines ALTERNATING fill and outline, each indented further than the last by clamp(1.5rem,6vw,6rem). To one side, an accent slab cut at the page angle running off the viewport edge, carrying ink-coloured mono text (today's schedule, the next class). Along the floor, four counters in the welded grid, and above them an INTERVAL STRIP: a mono row of paired times (45:00 SÉANCE / 15:00 RÉCUP) with the active interval in the accent over a 6px progress track. Zero photographs is a legitimate, strong outcome here.
3. THE SPLIT-CUT (best for a single coach or discipline, and the strongest RTL form). The viewport divided by ONE diagonal at the page angle: the ink field with wordmark and statement on one side, a duotone photograph clipped by the same diagonal on the other, a 3px accent rule along the shared edge. Copy side 1.15fr, image side .85fr. Below 780px the diagonal rotates to horizontal: the image takes order:-1 at 46vh with a cut bottom edge, copy beneath, accent rule intact.
Whichever form is used, the hero terminates in a HARD DEVICE — the stat rail, the interval strip or a marquee band — never in whitespace, never in a bouncing chevron.

## Section seams (Palestre's own vocabulary — never the same twice in a row; at least five per page)
- THE CUT (the signature; at least three per page, always the identical angle). A section edge is a clip-path polygon at the page angle and the neighbour is pulled up by half the rise so the two INTERLOCK — the diagonal is a shared edge, not a triangle of empty ground. Both edges cut: polygon(0 0, 100% var(--rise), 100% 100%, 0 calc(100% - var(--rise))). One edge cut: polygon(0 0, 100% var(--rise), 100% 100%, 0 100%). The section carries margin-block: calc(var(--rise) * -0.5) and adds calc(var(--rise) * 0.6) to its block padding so no content is eaten by the slope. A 3px accent rule runs along the cut, drawn by an absolutely positioned element rotated by the angle or by the neighbour's accent background peeking through.
- THE INVERSION. A hard ground flip — floor to chalk or back — landing exactly ON a cut edge, no transition, no gradient, no fade. The type system flips in the same instant: alpha steps, hairlines, duotone light tone. Two or three per page.
- THE BELL. A 3.2-3.8rem band between chapters, bordered 3px accent top and bottom, holding mono uppercase micro-type at .74rem/.22em: an interval line (ROUND 03 — 45 MIN — RÉCUP 00:15), a class roster, or one fact. Instead of 7rem of nothing between chapters, a hard band of information.
- THE ROSTER. A full-bleed marquee slab rotated at the page angle, running off BOTH page edges, carrying class names in display 800 at clamp(1.6rem,4vw,3rem) with accent separators. Two rosters lean in OPPOSITE directions and scroll opposite ways at different speeds so they cross.
- THE FLOOR. A full-bleed duotone action interlude at min(78vh, 620px) with NO heading, NO CTA, NO explanation — one bottom-anchored line of display type at the angle-skew and a mono caption. A generic builder puts a headline and three cards here; do not.
- THE GAUGE. A 6px track in the .14 step spanning the full width at a boundary, its accent fill scrubbing 0 to 1 as the seam passes mid-viewport. The seam is literally a measurement.
- THE STACK-SLAM. The next scene is pulled up with margin-top between -4rem and -9rem, carries a 3px accent top edge and its own opaque ground, and lands ON the previous scene. Pair it with a slam-in reveal.
- THE RACK. Two adjacent chapters share one continuous ledger — the same hairlines and column grid across the boundary — so it reads as a table continuing rather than a section ending.
This world uses ZERO whitespace-plus-hairline seams — stricter than the global rule, which permits one. A training floor has no soft transitions.

## Layout physics
- NON-COLOR MECHANICS, declared in a later :root block: --cut (the angle, 7-10deg, chosen once); --rise (the vertical travel of a full-width diagonal, derived from the angle — 7deg gives 12.3vw, 8deg gives 14vw, 9deg gives 15.8vw, 10deg gives 17.6vw), capped as min(Xvw, 190px) so an ultrawide screen does not lose 300px to a triangle (above 1360px the angle flattens toward 6deg, and that is correct); --pad: clamp(1.25rem, 4.5vw, 4.5rem); --shell: 90rem; --rule: 3px; --hair: 1px, coloured with var(--border) (tables only).
- ONE DOMINANT LEAN. Decide once whether cuts rise or fall to the right. About 70% of diagonals use that lean; the counter-lean appears exactly twice — the showpiece and the monument. Random alternation reads as noise.
- Vertical rhythm: clamp(4.5rem, 11vh, 8rem) on a standard chapter, clamp(6rem, 14vh, 10rem) on the showpiece, clamp(2.2rem, 6vh, 3.4rem) on a band, plus the cut compensation. The middle term is vh so pacing survives a laptop and a 4K panel.
- NEVER 50/50. Ratios: 1.12fr .88fr (copy-led), .8fr 1.2fr (media-led), 1.35fr .65fr (counters against a narrow caption column). Alternate reading order with an even-index order swap. Column gap clamp(2rem, 5vw, 5rem) — except welded grids, whose gap is exactly 2px.
- THE WELDED GRID (this world's card replacement): a container at background:var(--primary) with gap:2px whose children have background:var(--background) and padding clamp(1.4rem,3vw,2.4rem). The primary shows through as 2px grid lines — zero borders, zero radius, zero shadow, zero air. Use it for stat rails, discipline lists, coach rosters, the trust strip. On hover a cell inverts entirely over .16s with the numeral flipping at a 40ms delay so the fill lands first.
- LEDGERS FOR SCHEDULES, not cards: a real timetable grid with 1px hairlines, mono times at .82rem, class names in display 700 uppercase at 1.05rem, the level as a var(--radius) chip at .66rem/.14em. Below 720px it becomes a per-day accordion, never a horizontal scroll trap.
- OVERFLOW IS COMPOSITION. Exactly four elements break their container per page: a giant outlined round numeral crossing a cut edge, a counter hanging past its column by 1.5-3rem, a rotated roster exiting both page edges, and the monument clipped by the document bottom. Safe only because overflow-x:clip sits on html and body and overflow:hidden on every cut section.
- THE GHOST ROUND NUMBER: each chapter's number as an outlined display numeral at clamp(9rem,22vw,20rem), stroke 3px accent at .16 alpha, z-index 0, half-outside its column and bitten by the section's cut. Content sits at z-index 2 over it.
- IMAGES ARE HARD FRAMES: no radius, no shadow, one edge cut at the page angle, a 3px accent rule on that edge, a mono caption below in the .56 step. Parallaxed images overscan to 118% inside overflow:hidden. Portrait plates 4/5, action plates 3/2 or full-bleed. COACH PLATES add a name in display 800 at clamp(1.4rem,2.6vw,2rem) overlapping the photo's bottom edge by -1.1rem at z-index 2, over a mono spec row (discipline, years, certification) from the brief only.
- MOBILE COLLAPSE IS SURGICAL: two-column grids become 1fr; the welded grid drops 4 columns to 2 and keeps its accent gaps; --rise stays vw-derived so the angle is identical at 390px; the pinned showpiece becomes stacked panels; rotated rosters keep their rotation but drop to one at a slower speed; the nav status line and one link disappear.
- THE CLOSING MOVE: the business name as an outlined monument at clamp(4rem,18vw,17rem), stroke 4px accent, -.02em, positioned so the LOWER HALF OF THE LETTERFORMS IS CLIPPED by the end of the document. Above it one mono line — the address or the hours. The page ends the way a set ends.

## Motion identity (GSAP 3 + ScrollTrigger via CDN; Lenis optional)
THE SAFETY CONTRACT COMES FIRST. animate = (typeof window.gsap !== "undefined") && !matchMedia("(prefers-reduced-motion: reduce)").matches. EVERY hidden initial state is set with gsap.set INSIDE that branch — no opacity:0, no transform, no clip-path start state in CSS. If the CDN dies the page is a complete, converting poster, and every counter's REAL final number is hard-coded in the HTML so a no-JS visitor reads truth, not zeros.

TIMING — this world explicitly OVERRIDES the global bands, because a training floor is fast:
- gsap.defaults({ease:"power4.out", duration:.7}) — overrides the global power3.out / 1.1.
- Interaction feedback .12-.22s (global .25-.45s; hovers here snap). Component state .3-.45s. Entrances .5-.8s (global .9-1.4s). Image wipes .68s with the inner image counter-scaling over 1.05s (global 1.4s/1.8s — same de-synced principle, shorter). Marquees 18-26s (global 20-40s; the fast end is intentional).
- STAGGERS ARE TIGHT: .05 micro rows and letters, .065 headline lines, .08 cards and plates. Never above .1 — a slow stagger makes this world look tired.
- Shared CSS easing token cubic-bezier(.16,.84,.32,1). GSAP: power4.out for slams and line rises, power3.out for chrome, power3.inOut for clip wipes, "none" for anything scrubbed.
- Travel is SHORT and HARD: y 44 / 26 / 14 as three depth planes, yPercent 112 for masked lines, scale 1.12 to 1 on image interiors, skewY 2.5deg to 0 on slams. Nothing travels 100px and nothing bounces — no back.out, no elastic, ever.

THE MANDATORY SET
1. SLAM-IN REVEAL (the default entrance, about fifteen elements): gsap.set({autoAlpha:0, y:44, skewY:2.5}) then to({autoAlpha:1, y:0, skewY:0, duration:.52, ease:"power4.out"}), scrollTrigger start "top 86%", once:true. On complete a 3px accent rule beneath the block scales X 0 to 1 over .28s — the impact leaves a mark.
2. MASKED LINE RISE on every display headline: each line in an overflow:hidden wrapper, yPercent 112 to 0, .58s, stagger .065, power4.out, padding-bottom .08em and margin-bottom -.08em so nothing clips. Split at REAL wrap points (compare offsetTop), run on window.load so font metrics are final, aria-label on the parent and aria-hidden on the lines, then ScrollTrigger.refresh().
3. HERO TIMELINE — overlapping absolute positions, complete in about 1.25s: the accent cut rule draws (scaleX 0 to 1, .5s power3.inOut) at 0; the duotone plate wipes in along the page angle (clip-path polygon, .68s power3.inOut) at .1 with its inner img scaling 1.12 to 1 over 1.05s power2.out; the wordmark letters slam out of their mask (yPercent 112, stagger .045, .58s power4.out) at .18; THE RECOIL at .74 — the hero content block moves y +6 then back to 0 over .18s power2.out, one frame of impact, used at most twice on the whole page; statement and micro row at .62 (y 26, stagger .05); the stat rail at .8 (stagger .05); the mobile sticky bar at .95.
4. SCRUB-DRIVEN COUNTERS — this OVERRIDES the global "count-up on view": numbers run on YOUR SCROLL, not a clock. Tween a proxy with ease "none" and scrollTrigger {trigger, start:"top 80%", end:"top 32%", scrub:.35}, writing Math.round(proxy.v) into textContent with toLocaleString and a narrow no-break space as the thousands separator. Scrolling back un-counts them — the visitor drives the number. A 3500ms setTimeout safety paints the final value if the trigger never fires.
5. PROGRESS METERS: every counter and stat row carries a 6px track in the .14 step at 2px radius with an accent fill at scaleX(0), transform-origin:left, scrubbed over the same window with ease "none". Twelve across the page is not too many — the repetition is the design.
6. THE SHOWPIECE — ONE PINNED TRANSFORMATION TIMELINE, the only pinned scene on the page. Three or four panels (AVANT / PENDANT / APRÈS, or SEMAINE 01 / 06 / 12) pinned with {pin:true, scrub:.8, end:"+=240%", anticipatePin:1, invalidateOnRefresh:true}. Each panel enters with a clip-path polygon wipe along the page angle taking 0.28 of the timeline and overlapping the outgoing panel by 0.06; a mono week counter scrubs across the whole timeline; a full-width 6px accent bar scales X 0 to 1 across it; each caption slams in at its panel's local 0.1. Built inside gsap.matchMedia("(min-width: 900px)") with a real teardown — the CSS DEFAULT is the panels stacked vertically with their own slam-ins, so mobile and no-JS get the full sequence. If the brief supplies real client evidence, THIS is where it lives — untouched, date-captioned.
7. MARQUEES: CSS keyframes, not GSAP. A duplicated track at width:max-content translating 0 to -50% (or -50% to 0) over 22s linear infinite for the roster, 18s for a short class list, 26s for a footer strip, rotated at the page angle by a wrapper. animation-play-state:paused under reduced motion with width:auto.
8. THE ONE AMBIENT LOOP (maximum one per page): the "en ce moment" status dot — a true 50% accent circle at 8px running opacity 1 to .25 over 1.1s ease-in-out alternate infinite, with a ring scaling 1 to 2.2 and fading to 0 over 1.6s. Only if the brief gives real live information. No breathing glows, no floating blobs.
9. HOVER MICRO-CRAFT (CSS, .12-.22s): outline slabs FILL from the leading edge via a ::before at scaleX(0), transform-origin:left, to 1 over .22s while the label inverts at a 40ms delay; welded cells invert whole; image plates swell scale(1.04) over .55s on a WRAPPER, never on the element GSAP transforms; arrow glyphs translate X 5px on their own transition; schedule rows grow their accent tick 3px to 12px. Every :hover lives inside @media (hover:hover), with parity via :focus-visible and an .is-open class toggled by click, Enter and Space.
10. REDUCED MOTION: the global block (animation-duration .01ms, animation-iteration-count 1, transition-duration .01ms, scroll-behavior auto) PLUS designed stills — counters at final values, the pinned timeline as the stacked grid, marquees frozen with full text visible, the status dot solid.
LENIS IS PERMITTED (lerp .09, wheelMultiplier 1.05) since the scrub choreography benefits from it; expose it as window.__lenis and stay correct on native scroll. CANVAS IS NOT REQUIRED and should usually be skipped; if the concept demands one (a bar-path trace, a heart-rate line), an inline SVG polyline of the same shape is authored in the HTML and hidden only AFTER the context is created, the loop is gated by an IntersectionObserver at threshold .05 and paused on visibilitychange, reduced motion draws one static frame, devicePixelRatio capped at 1.5.

## Components
- SLABS (this world's buttons): border-radius: var(--radius), padding 1em 2rem, mono or body 800 uppercase at .82-.95rem with .1em tracking, line-height 1. PRIMARY is accent-filled with ink type; SECONDARY is transparent with a 3px accent border, filling on hover. Both may take the SKEW variant — transform:skewX(calc(var(--cut) * -1)) with the label counter-skewed upright. Pressed: translateY(2px) with the hard offset shadow collapsing 6px 6px 0 to 2px 2px 0 over .1s. Disabled at .34 alpha. Never full-width on desktop.
- CHIPS: var(--radius), 1px border in the .28 step, mono .66rem/.14em uppercase, padding .3em .8em — levels (DÉBUTANT / INTERMÉDIAIRE / AVANCÉ), disciplines, time tags. They share the token-borne pill silhouette with action slabs; status dots are true circles.
- PLAN SLABS (pricing): three columns in a welded grid, each with the plan name in display 800 at clamp(1.6rem,3vw,2.2rem), the price as a mono tabular moment, a hairline-separated list of real inclusions, a slab at the foot. The FEATURED plan inverts entirely (accent ground, ink type), sits 1.5rem taller via padding, carries the 6px 6px 0 offset shadow, and wears a FLAG — a small accent-deep slab rotated at the page angle pinned to its top-left corner, mono 700 at .68rem/.18em. Never three identical rounded cards.
- FAQ / ACCORDION: rows separated by 3px accent rules, not hairlines. The head is a grid of auto 1fr auto at align-items:baseline — mono index, display 700 uppercase question at clamp(1.05rem,2vw,1.5rem), a plus built from two 3px bars. Opening rotates the vertical bar 90deg over .22s and expands the body via grid-template-rows 0fr to 1fr over .38s (never max-height). aria-expanded in sync, single-open.
- FORMS: fields at 56px minimum height, transparent background, border 0, border-bottom 3px in the .28 step going accent on focus over .16s, radius min(var(--radius), 0px), padding .9em 0, body face at 1.05rem. Labels above in mono uppercase .72rem/.2em, lifting to full strength and accent on focus in the same transition. Helper text .8rem in the .56 step. Inputs never carry a background fill — this is not a form on a card, it is a form cut into the floor.
- TABLES AND SCHEDULES: 1px hairlines only (the sole place a hairline exists), mono times, tabular-nums, a 3px accent left edge on the row for today or the next class.
- ICONS ARE DRAWN, NEVER FONTS OR EMOJI: inline SVG on a 24px viewBox, stroke-width 2, fill none, and — the signature — stroke-linecap:butt with stroke-linejoin:miter. That single attribute keeps the icon set from softening into a wellness page.
- ::selection ink-on-accent; :focus-visible a 3px accent outline at offset 3px; a visually-hidden utility; explicit width and height on every image; fetchpriority="high" on the hero image and loading="lazy" below the fold; real alt text; aria-live="polite" on validation and status regions.
- FAVICON: an inline SVG data URI — the ground as a filled square with one accent diagonal at the page's exact cut angle. The page's geometry at 32px.

## Conversion objects (the intake desk — Algerian market, COD and WhatsApp shaped)
This world sells memberships, trials and class packs, and when the merchant also sells goods (supplements, gear, wraps) it sells them cash on delivery. The conversion block gets the same violence as the hero — a scene, not a footer.
- THE INTAKE CARD is a hard slab on an inverted chapter: radius min(var(--radius), 0px), a 3px accent border, the 6px 6px 0 offset shadow, on a .8fr 1.2fr grid beside a duotone plate. Its head is a mono step counter (ÉTAPE 01 / 03) and a display 800 title.
- FIELDS, in this order: full name (autocomplete="name"); phone (type="tel", inputmode="tel", autocomplete="tel", a real pattern, a mono placeholder showing the local format); wilaya as a styled native select matching the inputs exactly (border-bottom 3px, radius min(var(--radius), 0px), a drawn SVG chevron with butt caps — never the browser default arrow); address as a textarea for delivery orders; the objective or class as RADIO SLABS at border-radius var(--radius) driven by :has(input:checked) — the chosen slab inverts to accent with ink type over .18s and its 3px left edge grows to 9px. No custom circles; the whole slab is the control.
- PRICE TYPOGRAPHY: mono 700 with tabular-nums at clamp(2.2rem,5vw,3.6rem); thousands separated by a NARROW NO-BREAK SPACE (U+202F) so "3 500 DZD" never breaks across a line; the DZD mark as a .38em mono uppercase accent span, baseline-aligned in a flex row with a .4em gap. A struck previous price beside it at .9rem in the .56 step with a 2px accent strike (text-decoration-thickness:2px, text-decoration-color:accent). Monthly plans append a mono " / MOIS" at .3em. Never a currency symbol glued to the numeral in the display face.
- STICKY MOBILE ORDER BAR (below 780px): fixed to the bottom, 68px tall, ground background, 3px accent top border, radius min(var(--radius), 0px), safe-area padding via env(safe-area-inset-bottom). Left, the price in mono tabular with its accent DZD mark under a .68rem mono line (the plan name, or "1re séance offerte"). Right, an accent slab CTA at border-radius var(--radius) touching the right edge at full bar height. It enters translateY(110%) to 0 over .3s power3.out on a ScrollTrigger fired at the hero's "bottom top", and hides while the intake form is in view so it never covers the field a thumb is typing into.
- WHATSAPP CTA, styled to the world and never a green blob: an outline slab with a 3px accent border carrying a hand-drawn inline SVG WhatsApp glyph at 20px (stroke 2, butt caps) and a mono uppercase label, filling accent on hover like every outline slab. The href is a wa.me link built from the brief's real number with a PREFILLED message in the page's language naming the plan being viewed. No number in the brief means no component — never invent one.
- TRUST STRIP: a welded 2px grid of three or four cells, each with a drawn SVG icon (24px, stroke 2, butt caps, miter joins) above a mono uppercase micro-label and a .8rem line. Draw them yourself: two rectangles and two 999px wheels for delivery, a banknote with a check for paiement à la livraison, a shield with a tick for the guarantee, a clock with two straight hands for the schedule. Never emoji, never an icon font, never rounded caps. Facts from the brief only.
- VALIDATION IS BLUR-GATED: a touched map so an error appears only after a field's first blur, never mid-typing. Messages are short coach sentences prefixed with a 3px accent bar, in a region with min-height:1.2em reserved so nothing reflows.
- SUBMIT: a 700ms pending state where the label becomes a present-tense human sentence, then the card CROSS-FADES IN PLACE into a success panel absolutely positioned inside the same box — the form leaving over .3s to translateY(-8px) with visibility handled so focus never lands on a hidden control, the success entering over .42s after a .2s delay. The panel opens on a big mono booking number, echoes back the visitor's name and choice, states what happens next and when, and offers the WhatsApp slab as follow-up. The form never pretends to reach a server — yet the rep is logged: the instant validation passes, as the success panel enters, the page dispatches the wandit:lead CustomEvent on document with the visitor's fields flat in detail (name, phone as typed, wilaya, commune, plus the chosen objective or plan), and keeps one off-canvas decoy input marked data-wandit-hp in the form that the page's own script never reads.
- CROSS-SECTION LINKS: a plan slab's CTA writes its plan into the intake form's radio slabs and then scrolls to it. A button in scene four rewrites scene nine before travelling to it.

## Training-log furniture (REQUIRED — this is Palestre's voice)
Typesetting devices, not business claims; filled from the brief, written in the page's language.
- ROUND NUMBERS instead of section numbers: R01, R02, R03 — mono, in the accent, with the giant outlined twin behind the chapter.
- INTERVAL NOTATION on bands and captions: 45:00 / 00:15, WORK / REST or the local equivalent, active side in the accent.
- REP-SCHEME SHORTHAND where the content supports it: 5x5, 3x12, AMRAP 12', 4 SÉRIES — mono, uppercase, never explained.
- SESSION SPEC LINES under coach plates and class rows: DISCIPLINE — DURÉE — NIVEAU, mono .72rem/.2em, em-dash separated.
- THE SCOREBOARD RAIL: the welded counter grid, repeated at least twice with different metrics.
- MEASUREMENT CAPTIONS under every framed image: what it is, plus one mono figure (a time, a date, a weight) in the accent, on a space-between row.
- THE WALL LIST: the schedule typeset as a real ledger with hairlines and mono times — the most convincing element on a gym page, and the one most builders replace with three cards.
- A CLOSING FACT LINE above the monument: hours, address or founding year in mono. Never a slogan.

## Arabic and RTL adaptation
- dir="rtl" on the html element, the whole chassis on logical properties (padding-inline, margin-inline, border-inline-start, inset-inline-end). The nav CTA slab moves to the LEFT viewport edge and still touches it.
- THE LEAN MIRRORS: multiply the cut angle by -1 for the entire page so the diagonals still lean forward in the reading direction, and flip every clip-path rise to the opposite edge. The magnitude is unchanged; only the sign flips.
- NO LETTER-SPACING ON ARABIC, ever — tracking breaks the script's joining and is the most common failure on Arabic pages. Arabic micro-labels use weight plus the accent colour plus a 3px accent tick before the text, letter-spacing:0, slightly larger (.86-.95rem instead of .72rem) and looser (1.5 instead of 1.3); mono numerals stay tracked.
- NO SKEW ON ARABIC TYPE: the skew-emphasis device is dropped; emphasis is the accent colour plus a heavier weight. Skewed SLABS remain legal as long as the label is counter-skewed upright.
- UPPERCASE HAS NO MEANING IN ARABIC: remove text-transform:uppercase from every Arabic string; the display register comes from weight, size and the condensed-Kufi character of the face.
- PAIRING: an Arabic display in the Almarai / Cairo / Noto Kufi Arabic bold territory, an Arabic text face for prose, the SAME Latin mono for numerals and timers. Never artificially condense an Arabic face to imitate the Latin display.
- Numerals stay LTR inside RTL lines (a span with dir="ltr" and unicode-bidi:isolate) so prices, times and phone numbers never scramble; keep tabular-nums. Marquee direction flips with the text direction.

## Palestre ban list (in addition to the global one)
Soft or blurred box-shadows (only the hard 6px 6px 0 offset, twice per page) · any radius treatment outside the sanctioned var(--radius)-derived set · glassmorphism and backdrop-filter · gradients as decoration (only the hero legibility ramp and a 6px progress fill) · more than ONE accent hue · purple or violet in any variant · thin, light or regular display weights (display is 800-900 or it is not display) · italic display type · untreated full-colour stock photography except merchant logos and honest before/after evidence · smiling-at-camera stock fitness imagery, wide empty gym interiors as a hero, dumbbell clipart · rounded stroke-linecap on any drawn icon · emoji as icons · three-icon feature grids and rows of identical rounded cards · whitespace-plus-hairline as a section seam · two different diagonal angles on one page · a bouncing chevron scroll cue · countdown timers selling fake urgency (interval and class timers are honest information; "offre expire dans 04:59" is banned) · testimonial carousels · more than ONE pinned scene · more than ONE ambient loop · elastic, bounce or back eases · staggers above .1s · numbers set in the body face · any hidden state authored in CSS.

## Intensity
This world has one failure mode and it is TIMIDITY. A 6deg cut instead of 8. A 9vw wordmark instead of 15. A 1px stroke on a 14rem outline. Grey borders instead of accent rules. A 12px radius smuggled into the pricing row. A stock photo left in colour because it looked nice. Each is individually forgivable, and together they rebuild exactly the generic gym page this world exists to replace.

Executed at 100% — one angle cutting the page eight times at the identical degree, a name at fifteen percent of the viewport width, bodies printed in ink and acid, twelve counters that only move when the visitor scrolls, a schedule typeset like a real wall, a pinned twelve-week timeline, and a form that talks like a coach — the page reads like the front door of a room where people actually work. Push INTO the hardness. Every number above is load-bearing, and the angle is the same number every single time.`,
	energy: "loud",
	id: "palestre",
	industries: [
		"gym",
		"fitness",
		"martial-arts",
		"boxing",
		"crossfit",
		"personal-training",
		"sports-club",
		"coaching",
		"dance",
		"nutrition",
		"supplements",
		"physiotherapy",
		"events",
		"streetwear",
	],
	kind: "website",
	mood: ["explosive", "gritty", "athletic", "high-contrast", "disciplined"],
	name: "Palestre",
	priceFeel: "accessible",
	tagline:
		"Your name at the width of the whole screen, the page sliced by the same hard diagonal eight times, bodies printed in ink and acid, and counters that only move when the visitor scrolls — a page with the physics of the room you actually train in.",
};
