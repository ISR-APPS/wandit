import type { DesignWorld } from "./types";

/**
 * RIVIERA — Mediterranean coastal light for hospitality, travel and the table.
 * One structural idea carries the whole world: a HORIZON LINE held at a single
 * optical height through every scene, welding photographed sea to printed
 * ground, while the page background travels from morning paper to dusk ink.
 * The doc is appended VERBATIM to the builder system prompt.
 */
export const riviera: DesignWorld = {
	avoidFor: [
		"industrial",
		"manufacturing",
		"gaming",
		"esports",
		"law",
		"notary",
		"crypto",
		"logistics",
	],
	doc: `# DESIGN WORLD: RIVIERA — the Mediterranean horizon

## Philosophy
This page is a DAY SPENT BY THE SEA, typeset. Not a hotel website, not a booking funnel — a printed travel folio with the light left in: bleached linen type over luminous photography, one italic word doing all the romance, postcard plates with stamps and coordinates, and a single hairline horizon running through the whole page at exactly the same height, scene after scene, so the sea never breaks. Where coastal pages reach for cyan gradients and a search widget, this one reaches for LIGHT and for a STRUCTURAL LAW.

The world rests on two ideas and refuses a third. The HORIZON: one 1px rule at one optical height in every scene — sometimes drawn in ink, sometimes photographed as the actual sea, always at the same y. The DAY ARC: the ground travels from morning paper through sand, shallow water and the citrus hour into dusk and night ink, so a visitor who scrolls top to bottom has scrolled from breakfast to after-dinner without being told so. Type, plates, seams and motion all exist to serve those two.

The restraint here is warm, not austere: air, sun, overexposed white, and one saturated citrus that behaves like sunlight rather than like a brand color. The page should feel like the ten minutes before lunch when the light is too bright to read, and like the twenty minutes after sunset when it is not. If your draft could be re-skinned into a SaaS page by swapping hexes, the horizon law was not enforced.

## The vibe
A place, described by someone who lives there: first-person-plural, sensory and factual at once, never brochure-speak. Copy rules, non-negotiable, they carry a third of the design:
- EVERY headline is two clauses with a turn, and EXACTLY ONE word of it is display italic: "Le matin commence dans l'eau." / "Trois chambres, une seule vue." Two italic words is a bug, not a flourish.
- Sensory before commercial: name a material, a temperature, a time, a sound before a price — salt, pine, whitewash, grilled fish, the 7am boat, shade at two.
- Facts are placed, not listed: "Douze minutes à pied jusqu'au sable" beats "proche de la plage".
- Section heads read like hours of a day, not like features. The page has a schedule.
- System messages stay in voice, in full sentences: "Il nous faut votre numéro pour confirmer la table." Never "Champ requis".
- Banned words: paradise, oasis, unforgettable, exclusive (as self-description), experience, escape, solutions, elevate — and their French and Arabic equivalents. Also banned: exclamation marks outside a quoted human voice.
- Write in the brief's language. Arabic has no italic, so the turn word carries the accent COLOR plus a 1.06em size bump plus one lighter display weight, and the chassis mirrors (dir="rtl", logical properties, padding-inline, border-inline-start).

## Visual signatures (what makes it instantly recognizable)
- A hairline horizon at ONE height — declared once as a token, obeyed by photographs, section rules, plate crops and the pinned gallery. It is the motif that TRAVELS.
- A page background that changes six times on the way down, warm paper white to night ink, crossfading rather than cutting.
- A slow citrus SUN disc fixed to the viewport, descending toward the horizon as you scroll and setting behind it at the dusk crossover.
- Full-bleed photography that is bright and high-key — sun in frame, blown highlights, wet stone, whitewash — with linen type over four-stop scrims, never over raw image.
- POSTCARD PLATES: photographs printed with a real linen margin, a drawn stamp hanging off the top corner, coordinates with prime marks beneath, and a hand of rotation between -1.8deg and +1.4deg.
- Panoramic 21/9 crops used as structure, not as banners: the horizon inside the crop lines up with the ink rule continuing out of both sides.
- One italic word per headline, and a closing wordmark set entirely in display italic at eighteen viewport widths.
- Hour marks — 07h00, 12h00, 17h00, 20h00 — instead of chapter numbers.

## The horizon law (do this FIRST — it is what makes the world work)
After the required opening contract-token block, declare ONE world-specific NON-COLOR token in a separate :root rule: --sea: 58%. That is the optical height of the horizon, measured from the top of any full-height scene box, and it is the most load-bearing number in this world. Below 720px it becomes 50% (portrait crops eat sky, floor-anchored copy needs the room) — one media query, nowhere else.

Four consumers, all mandatory:
1. PHOTOGRAPHS. Every image containing a real horizon uses object-fit:cover with an object-position tuned so the sea line lands on --sea. Never accept the default center crop; state object-position explicitly on every image (for example 50% 38%) and re-tune it per image after the first screenshot pass. A horizon sitting 9% off the token is a Pass-1 correctness bug here.
2. INK RULES. Contained scenes draw the horizon themselves: a full-bleed 1px rule at rgba(ink,.14), position absolute, top:var(--sea) of the scene box, inset-inline 0, pointer-events:none, aria-hidden, at z-index 0 with content at z-index 1 — it passes UNDER photographs, type and plates and reappears on the other side.
3. PLATE CROPS. Any framed plate holding a horizon is placed so its internal sea line meets the drawn rule: give it aspect-ratio 21/9, align its own 58% line to the rule, and let the rule continue edge to edge out of both sides. That alignment is the shot people screenshot.
4. THE ACCENT SEGMENT. The rule carries exactly ONE 88px segment in the accent hue, at the sun's inline coordinate (see motion). Two segments is decoration; one is a sun on a horizon.

This world overrides the global "at most ONE hairline seam per page" rule, precisely: the horizon rule is a MOTIF, not a seam, and it recurs in every scene. Scene BOUNDARIES still use the seam vocabulary below, and a boundary announced by nothing but a rule and whitespace stays banned here as everywhere.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — AUBE→--background · INK→--foreground · CITRUS→--primary · INK→--primary-foreground · MIDI→--secondary · NUIT→--accent · ink at 52%→--muted · ink at 14%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every daylight stop, sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. The non-color --sea, gutter and geometry properties remain independent. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
Three poles from the brief drive everything: a SEA pole (the palette's cool blue-green), a SAND pole (the palette's warm light neutral), a CITRUS pole (the palette's saturated warm accent). Build eleven tonal roles from the fixed tokens — six grounds, two text poles, three accent siblings. Validation derives from the same fixed poles; no extra error hue exists.

THE GROUND PROGRESSION — six stops, in order down the page, all derived from the brief's poles (the registers show relationships, not mandates):
- 01 AUBE — the sand pole at its lightest, a warm paper (#FBF6EC register). Never #fff, never #fafafa.
- 02 MIDI — that paper 3-5 RGB points down, sand proper (#F3EADA register).
- 03 EAUX PEU PROFONDES — the sea pole at about 12% into the paper, a pale green-blue that still reads as light (#E4EDEA register).
- 04 HEURE DORÉE — the citrus pole at about 18% into the paper, an apricot wash (#F2DFC6 register).
- 05 CRÉPUSCULE — THE CROSSOVER. The sea pole driven deep, held on the BLUE side (hue 205-225, never magenta) — the #223447 register. Type flips here.
- 06 NUIT — the palette's dark pole, a warm-shifted near-black blue (#101A26 register).
The global ban on violet accents stands: dusk is a GROUND, never an accent, and the accent stays citrus at every stop.

INK AND LINEN — two text poles, one per half of the arc:
- INK (stops 01-04): a warm near-black where R is greater than G is greater than B (#1C1A16 register). Body rgba(ink,.74), captions rgba(ink,.52), hairlines rgba(ink,.14), strong rules rgba(ink,.30), placeholders rgba(ink,.34). No detached gray hex exists on this page.
- LINEN (stops 05-06 and ALL type over photography): a bleached warm off-white (#F6F1E6 register). Never pure white — not in text, not in a border, not in an icon stroke. Secondary rgba(linen,.76), captions rgba(linen,.56), hairlines rgba(linen,.18).
The crossover is one night class on the scene that reassigns the text tokens; every component reads tokens, so nothing needs a second ruleset.

ACCENT — exactly ONE citrus hue, plus a deeper hover sibling (bright apricot to burnt) and a paler sibling for accent text on night grounds. Use at least nine of its jobs: the italic turn word in section heads, hour marks, the sun disc and bloom, the 88px horizon segment, stamp cancellation arcs, the tide bar in the scroll cue, ::selection, :focus-visible, the price superscript and currency mark, coordinate prime marks, ticker separators, the drawn line-icon strokes in the trust strip.

SCRIMS ARE FOUR-STOP, ALWAYS: rgba(dusk,.74) at 0% (the floor, where type lives), rgba(dusk,.30) at 26%, rgba(dusk,.04) at 54%, rgba(dusk,.26) at 100% — the returning top stop keeps the fixed nav legible over bright sky. Add a horizontal gradient weighting the text side, to inline-end, rgba(dusk,.42) to transparent at 62%. The bottom stop must EQUAL the next scene's ground stop; that is what makes the weld work. Photographs here never end at an edge.

TWO ATMOSPHERE LAYERS, both fixed, both pointer-events:none: SALT HAZE — inline SVG feTurbulence fractalNoise, baseFrequency 0.9, numOctaves 2, stitchTiles stitch, desaturated with feColorMatrix saturate 0, tiled 220px, inset -40px, opacity .045, z-index 70, mix-blend-mode multiply on light stops and screen under the night class. SUN BLOOM — one radial-gradient in the citrus pole at 8% alpha, 70vmax wide, anchored to the sun, blurred 40px, z-index -1; it is why the light reads as light and not as a filter.

Declare color-scheme:light on :root and a theme-color meta REWRITTEN by JS as each stop takes over, so even the browser chrome travels through the day.

## Typography system
TWO families, two sealed jobs. A third family is a bug here — the discipline is part of the coastal calm.
- DISPLAY: a high-contrast old-style or transitional serif WITH A TRUE ROMANTIC ITALIC — the Cormorant Garamond / Prata / Fraunces / Playfair territory. Weights 300-500 only; load the italic even if you load nothing else, because the italic is why this family was chosen. For Arabic, pair a display Arabic serif of similar contrast and keep the roles sealed.
- TEXT: a humanist or lightly geometric sans with open apertures and true tabular figures — the Jost / Outfit / Karla / Work Sans territory. Weights 400/500 only. It sets body, micro-caps, labels, nav, form fields, coordinates, prices and every numeral.
Never let the sans set a headline above 2rem, never let the serif set body copy, and never set the serif upright below 1.5rem — small upright serif is what makes a page look like a menu template.

The scale, ratio about 11:1, with a deliberately thin middle: hero h1 clamp(3.4rem,9vw,8.2rem) / .96 / -.015em / weight 400 · section h2 clamp(2.2rem,4.8vw,4rem) / 1.02 / -.01em / max-width 13em · plate title h3 clamp(1.5rem,2.3vw,2.05rem) / 1.14 / -.005em · lede clamp(1.05rem,1.5vw,1.3rem) / 1.62 / 32em · body 1.0625rem / 1.68 / 62ch · micro-caps .72-.8rem uppercase at .2em (.24em on hour marks) · closing wordmark clamp(4rem,18vw,16rem) display ITALIC / .86 / +.01em.
TRACKING IS A FUNCTION OF SIZE: -.015em above 90px, -.01em at 40-70px, -.005em at 28-34px, 0 at body, +.2em to +.26em at 11-13px uppercase. LINE-HEIGHT TIGHTENS AS SIZE GROWS: .86 wordmark, .96 h1, 1.02 h2, 1.62 lede, 1.68 body.

THE ITALIC TURN — the highest-leverage device here. One class, applied exactly once per headline: display family, italic, font-size 1.04em (the italic optically shrinks and needs it back), letter-spacing 0 to cancel the display negative tracking, colored accent on section heads and ink on the h1 so the hero stays about light rather than branding. Never two per headline, never a whole clause, never on body copy.

NEVER LET A DISPLAY HEADLINE AUTO-WRAP. Break every h1 and h2 into explicit block-level line spans so the rag is AUTHORED, and reuse those spans as the animation stagger targets. Ragged-right, never justified, never centered except the two places named in Layout physics.

NUMERALS ARE A DESIGN OBJECT: tabular-nums on every price, count, distance and coordinate. Coordinates sit in the sans at .78rem / .16em with the degree and prime marks in the accent (36°45′ N · 3°04′ E). DZD prices use a THIN SPACE for thousands (12 500 DZD), currency mark in the accent at .5em / vertical-align .35em, with per-unit qualifiers (la nuit, la personne, le couvert) after it in the sans at .8rem in rgba(ink,.52).

HOUR MARKS replace chapter numbers. A running head is a baseline-aligned flex row of [hour mark, accent sans .78rem/.24em] [uppercase micro-label] [flex:1 hairline at rgba(ink,.14)] [right-aligned factual aside], hanging on a border-bottom. The hours advance down the page and must agree with the ground stop they sit on — an 07h00 head on the night ground is a visible error.

## Page chassis
- NO ANNOUNCE BAR, NO BOOKING WIDGET. The top of this page is sky.
- NAV: position fixed, inset 0 0 auto 0, z-index 100, padding .95rem var(--gutter), transparent over the hero with a transparent border-bottom that resolves to a 1px linen hairline at 18% past 320px. The scrolled state is rgba(current-ground,.86) plus backdrop-filter blur(12px) plus the hairline, and it is GROUND-AWARE — scrolling into dusk gives a blurred dark bar with linen links, driven by the same crossover class the scenes use. Transition background-color and color .7s, border-color .4s.
- WORDMARK IS A LOCKUP: display face 1.35rem weight 400 with the establishment type beside it in the sans at .6rem, .3em, uppercase, opacity .6, baseline-aligned. One italic letter or ampersand inside it is the only ornament it gets.
- Nav links: sans .82rem/.06em in the active text token at 78% going to 100%, with a 1px accent underline scaling X 0 to 1 over .34s, transform-origin flipping from inline-end at rest to inline-start on hover. On the end side, ONE affordance: an outline pill (1px current-text at 45%, radius var(--radius), padding .62em 1.15em, .78rem, .1em uppercase) filling with accent and inverting to the night ground over .35s.
- Below 880px the links become a full-screen takeover on the current ground stop: display face at clamp(2rem,9vw,3.4rem) with an hour mark beside each, stagger .07s, and the horizon rule drawn across the overlay at --sea. The burger is TWO 1px bars crossing into an X, never three.
- GLOBAL BASE: html and body overflow-x:clip (mandatory — rotated plates, the -14% overscan and bleed layers all overflow), scroll-behavior smooth, scroll-padding-top 4.5rem, antialiased, text-rendering optimizeLegibility. ::selection accent on the current ground. :focus-visible a 2px accent outline at outline-offset 3px. A skip link sliding from top:-4rem to top:1rem over .3s.
- THE SKY LAYER (the ground progression's mechanism): one fixed div, inset 0, z-index -2, background-color at stop 01, with the sun bloom at z-index -1. Scenes are background:transparent ONLY when the html element carries the js class; without JS each scene falls back to its own literal stop color in CSS, so a dead CDN gives a hard-cut day arc instead of a white page. Not optional.
- COORDINATED NUMBERS, derived once from the measured nav height: hero min-height 100svh, sticky offsets top 5.5rem, scroll-margin-top 4.5rem, and the 4.6rem mobile reservation bar reserved as body padding-bottom below 900px.

## Hero forms (pick the one the place calls for — never the booking-widget hero)
1. LE LARGE (default — the full-bleed horizon cover). The photograph IS the ground: position absolute, inset 0, object-fit cover, object-position tuned so the sea lands on --sea, overscanned to 112%. min-height 100svh.
THE COPY HANGS FROM THE HORIZON, IT IS NOT FLOOR-ANCHORED — this is what separates this hero from every full-bleed cover in every other world, and it is not negotiable. The copy block is position:absolute with top:calc(var(--sea) + 2.5rem), inset-inline the gutter, so the h1's first line begins exactly where the water begins and the type sits ON the sea rather than in the dark at the bottom of the frame. The top 58% stays pure sky. Below 720px, where --sea becomes 50%, the offset tightens to 1.5rem. If your draft has the headline pushed to the viewport floor with justify-content:flex-end, you have built the house cover plate, not Riviera.
Copy at z-index 2: an authored h1 in linen with ONE italic word, a lede capped at 30em, and at the FLOOR — the one thing that does anchor to the bottom — LA LAISSE, the strandline bar (named for what the sea leaves on the sand, and distinct from the tide-bar scroll cue below): border-top 1px rgba(linen,.22), a flex row of [place name + coordinates] [flex:1] [one quiet affordance] [season or hours]. That affordance is a ruled text link or a linen outline pill, NEVER a filled block and NEVER two side by side; a date-picker strip in the hero is banned outright here. The four-stop scrim's bottom stop equals ground stop 02. The scroll cue is a TIDE BAR: a 64px 1px linen rule at 30% with an accent segment sweeping through it on a 2.6s cubic-bezier(.4,0,.2,1) infinite loop, keyframes translateX -100% at 0%, 0 at 58%, 100% at 100% — it lingers at center like water arriving before it leaves. Never a chevron.
2. LA FENÊTRE (the framed panorama — for guesthouses, restaurants, any brief with one very good photograph). Ground stop 01. The h1 sits ABOVE at the gutter, hand-broken into three lines. Below it a contained 21/9 plate at max-width 92rem with a 10px linen print margin and a 1px hairline outside it, its internal horizon landing on the plate's own 58% — and the page's ink rule continues out of BOTH sides of the plate, edge to edge, at exactly that height. That continuation is the whole idea; rule and sea 4px apart means the hero failed. Under the plate, a QUAI rail of four micro-labels, and the affordance lives in the rail, not over the image.
3. LA CARTE POSTALE (small guesthouses, tours, merchants with mixed-quality photography). Ground stop 01, grid 1.12fr/.88fr. The narrow column holds only an hour mark and a 44px accent tick; the wide column opens mid-thought with a display lede at weight 300. Center-left sits one 3/2 postcard plate rotated -1.6deg with its stamp hanging off the top corner, a written italic line beneath, coordinates under that. The ink rule passes BEHIND the postcard at --sea, entering one side and leaving the other, so the card lies on top of the sea. Under 600px it un-rotates to 0deg and the grid collapses to one column.

## Section seams (Riviera's own vocabulary — every boundary uses one, never the same twice in a row; use at least five per page)
- HORIZON WELD (the signature). The outgoing scene ends ON its photographed horizon and the next begins at padding-top:0 with its ground meeting that exact line, so the sea's edge IS the boundary. Give the image container a height terminating at its own --sea line, start the next ground there, lay a 1px rule at rgba(linen,.22) over the join. Use it once, at the strongest handoff — it is the shot.
- DUSK DISSOLVE. Any full-bleed image ends in a 22vh gradient from transparent to the NEXT ground stop. Images never end; they become the page. The workhorse seam: twice per page, never adjacently.
- SALT STEP. The ground advances exactly one stop in the day arc, announced by the horizon rule continuing across the boundary and nothing else. Because the crossfade is scrubbed, it reads as time passing, not as a colored stripe.
- LE LARGE (full-bleed interlude). One edge-to-edge scene, height min(78vh,640px): a photograph, a four-stop scrim and ONE line of display italic in linen. No heading, no eyebrow, no CTA, no explanation. A generic builder puts three cards here. Exactly one per page.
- POSTCARD OVERLAP. A postcard plate or quote block pulled UP onto a full-bleed image with margin-top -4rem to -8rem at z-index 3, rotated -1.4deg, its stamp overhanging its own top corner — a double overlap.
- QUAI. A full-bleed rail closing a scene: border-top 1px hairline, a flex list of four uppercase micro-labels at .78rem/.1em each preceded by a .32em accent dot, padding 1.1rem var(--gutter), gap 2.4rem; a 2x2 grid at .68rem below 600px. Where a generic page leaves 6rem of nothing, this world puts a rail.
- LA CÔTE (axis change). The pinned horizontal gallery — the showpiece, specified in Layout physics.
- BULLETIN. A 3rem band on the current ground, border-block 1px hairlines, carrying a 34s marquee of place names, distances and hours in the sans at .82rem/.1em with accent middot separators and one serif-italic phrase inside. One per page, never adjacent to the QUAI.

## Layout physics
- ONE gutter token: clamp(1.25rem, 4.2vw, 5rem) — page padding AND the anchor for every absolutely positioned ornament (sun, hour marks, stamps), so off-grid elements still snap to the margin.
- Container max-width 92rem, margin-inline auto. Sections are always full-bleed; only their inner grids are capped.
- Vertical rhythm is always a clamp whose middle term is vh: clamp(4.5rem,11vh,8rem) standard scene, clamp(3rem,7vh,5rem) welded scene, clamp(6rem,15vh,11rem) closing scene.
- NEVER 50/50: hero and story 1.12fr/.88fr, reversed chapter .84fr/1.16fr, question list .8fr/1.2fr (the heading column deliberately smaller than the list), reservation .92fr/1.08fr. Alternate reading order with an order-swapping modifier on even indices. Column gaps clamp(2rem,5vw,5.5rem).
- SHAPE IS RATIO, NOT RADIUS. Four aspect ratios used consistently are this world's silhouette: 21/9 panorama (anything with a horizon), 3/2 postcard recto, 4/5 portrait plate (people, rooms, dishes), 1/1 detail chip (materials, hands, close crops). Border-radius exists in exactly three treatments: var(--radius) on pills and steppers (:root sets --radius: 999px), 50% on the true-circle sun and stepper buttons, min(var(--radius), 3px) on form fields. This world OVERRIDES the global default of soft rounded cards — a 12-16px radius on any content container is a ban-list violation here.
- PRINT MARGINS INSTEAD OF CARDS. A photograph is presented as a print: padding 10px (14px on the 21/9 panorama) in the linen tone, a 1px hairline outside it, and — only on plates floating over a ground or another image — one shadow 0 26px 60px -28px rgba(dusk,.42). Contained plates on their own ground carry NO shadow. There are no bordered cards with backgrounds in this world.
- STAMP CORNER. Every postcard plate carries an inline SVG stamp, 46px, absolute at top -14px / inline-end -12px, z-index 2: a perforated square (rect with stroke-dasharray 3 3 in the accent), a 1px inner rule, one letterform or drawn wave inside, and TWO cancellation arcs (stroke-width 1, rgba(ink,.32)) crossing the stamp and continuing 18px onto the photograph. Arcs draw on entrance (stroke-dashoffset to 0 over .9s), never on hover only.
- COORDINATES UNDER EVERY PLATE: a space-between flex row at .78rem, .8rem below the plate — place name in display italic on the start side, coordinates in the sans with accent prime marks on the end side, both rgba(ink,.52).
- LEDGER ROWS, NOT FEATURE CARDS, for amenities, menus and specs: padding clamp(1.5rem,3vw,2.2rem) 0, border-top 1px hairline (border-bottom on the last), grid-template-columns auto 1fr auto, gap 1.2rem clamp(1rem,2.5vw,2rem), the hour mark or an accent N° in the left gutter, a right-aligned tabular-nums value. A menu is a ledger; a room list is a ledger; a price list is a ledger.
- ONE STICKY ANCHOR per page: a media column at position sticky, top 5.5rem, holding a 4/5 plate while three ledger rows pass it, its internal horizon aligned to the page rule at the moment it pins.
- THE SHOWPIECE — LA CÔTE, the pinned horizontal gallery. Panels at 76vw (never 100vw; the next must peek in), the lead panel at 62vw to break the metronome, each a 21/9 or 4/5 plate with a print margin, plate number, place name and coordinates. The rule that makes it this world's: THE HORIZON DOES NOT MOVE. Every panel is composed so its sea line sits at --sea of the track height, and one ink rule is drawn across the whole pinned viewport at that height — the coast travels sideways while the horizon stays perfectly still and the land slides along it. Inside the track, images drift xPercent -6 to 6 against the travel. CSS default is the STACKED layout; horizontal is opt-in inside gsap.matchMedia("(min-width:900px)") with a teardown, and mobile gets the same plates stacked with soft vertical parallax and the rule redrawn per plate.
- OVERFLOW IS COMPOSITIONAL: exactly four elements break their container — the stamp at -14px, the postcard overlap at -4 to -8rem, the sun bloom at 70vmax, the closing wordmark bleeding past the container edge. Safe only because overflow:clip sits on every scene containing a piercing element.
- IMAGE OVERSCAN FUNDS MOTION: any parallaxed image is top:-14%, height:128% inside an overflow:hidden parent, so travel never exposes an edge.
- CENTERING IS ALLOWED IN TWO PLACES ONLY: the italic line inside LE LARGE and the closing wordmark.
- RESPONSIVE: below 1024px two-column grids become one and sticky becomes static; below 900px LA CÔTE stacks and the mobile reservation bar appears; below 720px --sea becomes 50%, the sun hides, plates un-rotate, the QUAI becomes 2x2. Structural collapse only — never delete a scene on mobile.

## Motion identity (GSAP 3 + ScrollTrigger via CDN; Lenis OPTIONAL and welcome here)
THE SAFETY CONTRACT COMES FIRST. Compute one flag: reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, hasGsap = typeof window.gsap !== "undefined", animate = hasGsap && !reduced. EVERY hidden initial state is set with gsap.set() inside that branch; no stylesheet here contains opacity:0 or a transform on content. If the CDN dies, the page is a complete, readable folio with a hard-cut day arc.
Lenis is the one library this world genuinely wants — the tide reads better on eased scroll (lerp .085, wheelMultiplier 1). If you load it: expose window.__lenis, drive ScrollTrigger from its scroll event, kill it under reduced motion, and keep every anchor working without it.

SHARED IDENTITY: gsap.defaults({ease:"power3.out", duration:1.1}); all CSS transitions on cubic-bezier(.22,.68,.16,1); power4.out for masked rises, power3.inOut for clip openings, power2.inOut for rules drawing, sine.inOut for ambient, none for scrubbed.
TIMING BANDS: .25-.4s interaction · .5-.7s component state · .9-1.5s narrative reveals · 1.6s rule draws · 1.9s image settle · 2.4-3.6s ambient swells · 34s marquee.
TRAVEL IS SMALL: y offsets of 16 / 28 / 44 only, yPercent 112 for masked rises, parallax yPercent -7 to 7, swell yPercent 2.5. Nothing here travels 100px in a straight line.

THE MANDATORY SET:
1. HERO ENTRANCE — one timeline at overlapping absolute positions, complete in about 2.2s. Set: image scale 1.14, h1 lines yPercent 112 inside overflow:hidden wrappers, lede and LA LAISSE autoAlpha 0 / y 28, horizon rule scaleX 0. Then image to scale 1.03 over 2.1s power2.out at 0; h1 lines to 0 over 1.25s power4.out stagger .12 at .25; the rule to scaleX 1 over 1.6s power2.inOut at .5 from transform-origin inline-start; lede at .95; LA LAISSE and the tide-bar cue at 1.15 stagger .1. The page moves before the type arrives.
2. THE HORIZON DRAW — every ink rule, every scene: scaleX 0 to 1, 1.6s power2.inOut, transform-origin inline-start (inline-end in RTL), start "top 84%", once. The motif animates itself across the page as you descend.
3. HORIZON OPEN — this world's image reveal, not a fade and not a bottom-up wipe: clip-path from inset(58% 0 42% 0) to inset(0) over 1.5s power3.inOut, so the picture opens OUTWARD FROM ITS OWN HORIZON while the inner image counter-scales 1.14 to 1.03 over 1.9s power2.out. De-synced on purpose. start "top 86%", once, then clearProps.
4. THE TIDE SWELL — the ambient loop, and the reason this world feels like water. On the image WRAPPER (never the element ScrollTrigger transforms): gsap.to(wrapper,{yPercent:2.5, duration:3.2, ease:"sine.inOut", yoyo:true, repeat:-1}). De-sync siblings at 2.6s / 3.2s / 3.6s with delays 0 / .4s / .9s. Maximum THREE swelling elements; the scrubbed parallax lives on the inner image so the transforms never fight.
5. SCRUBBED PARALLAX on every full-bleed photograph: gsap.fromTo(img,{yPercent:-7},{yPercent:7, ease:"none"}), start "top bottom", end "bottom top", scrub:true — funded by the 128%/-14% overscan.
6. THE GROUND PROGRESSION — the page's spine. Per scene owning a stop, tween the SKY LAYER's backgroundColor to that stop with ease "none" and scrollTrigger {trigger: scene, start:"top 78%", end:"top 26%", scrub:.6}. Six tweens, continuous crossfade, no cut ever visible. The same triggers rewrite the theme-color meta on enter and toggle the night class that flips the text tokens (color transition .7s). Without JS the CSS per-scene backgrounds do the same job in hard cuts.
7. THE SUN — position fixed, inline-end at var(--gutter), diameter clamp(56px,7vw,104px), border-radius 50%, the accent at .5 alpha with filter blur(2px) and the bloom behind it, mix-blend-mode multiply on light stops and screen under the night class, z-index -1, aria-hidden. One document-length scrubbed tween (trigger body, start "top top", end "bottom bottom", scrub 1) moves it from top:14vh to top:calc(var(--sea) - 2rem) and fades .55 to 0 across the last 12% as it sets behind the horizon; the same scrub drives the 88px accent segment's inline position. Hidden below 720px and under reduced motion (parked at 18vh).
8. MASKED LINE RISES on every display heading: split at REAL browser wrap points (compare offsetTop), preserve em and strong ancestry with a class, run on window.load so font metrics are final, aria-label on the parent and aria-hidden on the lines, then ScrollTrigger.refresh(). yPercent 112 to 0, 1.15s power4.out, stagger .12, start "top 85%", once. Descender-safe masks: padding-bottom .06em, margin-bottom -.06em.
9. GENERIC REVEALS on roughly fifteen marked elements — ledger rows, plates, coordinate rows, form fields one by one: gsap.set({autoAlpha:0, y:28}) then to({autoAlpha:1, y:0, duration:.95, stagger:.09}), start "top 88%", once.
10. LA CÔTE: gsap.to(track,{x:-(scrollWidth - innerWidth), ease:"none"}) with pin:true, scrub:1, anticipatePin:1, invalidateOnRefresh:true. Reveals and drifts inside use scrollTrigger containerAnimation so they fire on horizontal position. The drawn horizon does NOT move — it sits outside the track, absolutely positioned on the pin container.
11. COUNT-UPS on real figures via a tweened proxy over 1.6s power2.out with thin-space thousands, start "top 90%", once, plus a 4000ms setTimeout fallback painting the final value if the trigger never fires on a deep-linked load. True numbers are hard-coded in the HTML.
12. ALWAYS call ScrollTrigger.refresh() inside document.fonts.ready.then().

MICRO-INTERACTION KIT (CSS, inside the bands): the nav underline scaling from a flipping origin over .34s · outline pills filling with accent over .35s · plate images swelling scale(1.03) over 1.6s on a WRAPPER, never on the GSAP-transformed element · a link arrow on its own decoupled translateX(4px) over .3s while the label shifts color · form rules and labels turning accent together on :focus-within over .3s · stamp arcs redrawing on hover over .5s · every :hover rule inside @media (hover:hover) with a keyboard-and-touch parity class.
GLOBAL REDUCED MOTION: animation-duration .01ms !important, animation-iteration-count 1 !important, transition-duration .01ms !important, marquee animation none with width auto, sun parked, swells stopped — alongside the designed static states, never instead of them. once:true on everything non-scrubbed: the tide does not run backwards.

## Components
- BUTTONS: two only. PRIMARY is a pill at border-radius var(--radius) filled with ink (linen on night grounds), padding 1em 1.7em, sans .9rem weight 500, .04em, inline-flex with gap .6em and an arrow glyph; on hover it becomes accent with the night ground as its label color and the arrow slides 4px. QUIET is a ruled text link: border-bottom 1px hairline, padding-bottom .22em, turning accent with the rule first (.3s) and the label second (.3s, delay .05s). No third button, and never a full-width solid rectangle.
- FORMS ARE RULED LINES: transparent background, border 0, border-bottom 1px rgba(ink,.22), border-radius min(var(--radius), 0px) (cap at 3px only where a field needs a real hit area, such as a textarea), padding .85em 0, 1rem in the sans, label above at .74rem/.18em uppercase in rgba(ink,.52). On focus the rule turns accent and thickens to 1.5px while the label turns accent — three properties, .3s, together. Selects match exactly, with a drawn 1px chevron as an inline SVG background, never the native arrow.
- VALIDATION IS BLUR-GATED: a touched map so an error appears only after a field's first blur. Errors are full sentences in the world's voice, in a contrast-safe color-mix between var(--primary) and var(--foreground), min-height 1.2em reserved so nothing reflows, entering at opacity 0 / translateY(-3px) over .3s, announced with aria-live polite. No extra color property or outside hue exists.
- ACCORDION for questions: a hairline-topped list, the question a full-width flex button in the display face at clamp(1.1rem,1.6vw,1.35rem) weight 400, padding 1.4rem 0, opening via grid-template-rows 0fr to 1fr over .5s with an overflow:hidden inner. Icon is two 1px pseudo-element bars, the second rotating 90deg to 0deg over .45s. Single-open, aria-expanded maintained, panels with role region.
- THE DRAWN ICON SET: every icon is an inline SVG you draw — 20px, fill none, stroke currentColor, stroke-width 1.25, stroke-linecap round: a wave (two stacked cubic curves), a key, a fork crossed with a knife, a wifi arc, a P in a square, a sun (circle plus six rays), a pin, a cup. Never emoji, never an icon font, never a filled glyph.
- FAVICON is an inline SVG data URI: the current ground as the field, a 1px linen horizon at 58%, one citrus dot above it. Theme-color follows the active stop.
- CRAFT DETAILS: explicit width and height on every image · fetchpriority high on the LCP image, lazy elsewhere · art-directed alt naming the place and the light, empty alt plus aria-hidden on decorative duplicates · sr-only text for icon-only affordances · a skip link · the split headline's aria-label carrying the real sentence.

## Reservation objects (this world CONVERTS — the Algerian market shape)
This is a hospitality world: the money components are a reservation, a phone call and a WhatsApp thread, not a checkout. They carry the same design weight as the hero.
- THE RESERVATION SCENE sits at ground stop 05 or 06, grid .92fr/1.08fr, a sticky 4/5 plate on the narrow side and the form on the wide side. Phone-first, it collects: full name (autocomplete name), phone (type="tel", inputmode="tel", a real pattern, and the LARGEST field in the form at 1.15rem), a styled wilaya select listing the 58 wilayas when travel or delivery is involved, address or arrival details, dates with the minimum computed from today, people via a stepper (inline-flex group at border-radius var(--radius), 2.8rem true-circle buttons at 50%, an output element at min-width 2.4rem in the display face at 1.2rem), and a free-text note in the world's voice ("Dites-nous l'heure d'arrivée, on garde la table").
- PRICE TYPOGRAPHY: display face, clamp(2.2rem,4vw,3.2rem), weight 400, tabular-nums, letter-spacing -.01em, THIN SPACE thousands (12 500 DZD), currency mark in the accent at .5em / vertical-align .35em, per-unit qualifier after it in the sans at .8rem muted. A struck previous price uses text-decoration-color accent at 1.5px. Never a price inside a colored badge.
- WHATSAPP CTA, styled to this world and never a green blob: a pill at border-radius var(--radius) in LINEN on night grounds (ink on light grounds) with a drawn 1px-stroke glyph you author yourself in the current text color, the number in tabular-nums, a .74rem/.18em uppercase micro-label above. It links to a wa.me URL with a pre-filled message in the page's language and voice, naming the place, and fills with accent on hover. Exactly twice per page: the reservation scene and the mobile bar.
- THE MOBILE RESERVATION BAR: below 900px, a fixed bottom bar revealed once the visitor passes the hero (ScrollTrigger on the hero's bottom, translateY 100% to 0 over .45s), height 4.6rem, background rgba(current-ground,.94) with blur(10px) and a hairline top border, price on the start side (display face 1.35rem plus qualifier) and TWO affordances on the end side: the accent pill (Réserver, scrolling to the form) and the WhatsApp pill. Its height is reserved as body padding-bottom so it never covers the footer, and its top border IS the horizon rule — the motif reaching the bottom of the page.
- TRUST STRIP: a QUAI rail of four items, each a drawn 20px 1px-stroke SVG icon above a .78rem/.14em uppercase label with a .8rem factual line under it — arrival hours, cancellation, payment on site or on delivery, distance to the sea. Facts come from the brief only; if the brief does not state one, drop the item rather than invent it. Never emoji, never a filled badge, never a star cluster.
- SUBMIT has a deliberate 700ms pending state whose label becomes a present-tense human sentence, then the form CROSS-FADES IN PLACE into a success panel absolutely positioned in the same box (success in over .7s, delay .25s; form out over .45s to translateY(-10px) with visibility switching at .45s so focus never lands on a hidden element). The panel opens on the visitor's own name and choices echoed back, a reference in the display face at 2.4rem, and one sentence saying exactly what happens next and when. The instant validation passes — as the panel arrives — the page drops the postcard in the box by dispatching the wandit:lead CustomEvent on document with the visitor's fields flat in detail (name, phone as written, wilaya, commune, plus dates and guests), while one off-canvas decoy input marked data-wandit-hp sits behind the counter, never read by the page's own script. No fake server call, no invented booking code.

## Postcard furniture (REQUIRED — this is Riviera's voice)
Every page ships all of these, in the page's language and the world's voice. They invent no business fact — they are typesetting, filled from the brief; anything the brief does not supply is DROPPED (never invent sunrise times, water temperatures, star ratings or awards).
- THE DATELINE: place name, coordinates with accent prime marks, and a season or month — inside LA LAISSE at the hero's floor and again in the footer.
- HOUR MARKS on every running head, advancing in agreement with the ground stops.
- PLATE NUMBERS AND PLACE NAMES under every framed photograph — place in display italic, number in accent sans.
- STAMP MARKS on postcard plates, with cancellation arcs running onto the photograph.
- ONE WRITTEN LINE: a single display-italic sentence over the LE LARGE interlude, no heading, no attribution, no CTA — the page's one moment of pure voice.
- THE ALMANAC: a zero-row-gap definition list of real brief facts (distance to the sand, hours, rooms or covers, languages, what is included), rows separated by hairlines, terms in .74rem/.16em uppercase on the start side, values right-aligned in tabular-nums with the numeral promoted to the display face at 1.3rem inside a .98rem line.
- A COASTLINE DRAWING: one inline SVG path, 1px stroke at rgba(ink,.3), linecap round, tracing an abstract coast with two or three accent dot markers and micro-labels — used once, never as a real map.
- THE CLOSING MONUMENT: the establishment's name in display ITALIC at clamp(4rem,18vw,16rem) / .86, linen on the night ground, rising out of an overflow mask (yPercent 104 to 0, 1.5s power4.out), with the horizon rule drawn one last time across it at --sea of the footer box. The last gesture is the name on the horizon, not a link farm.

## Arabic and RTL adaptation
- dir="rtl" and lang="ar" on the html element, and the whole chassis built on logical properties — padding-inline, margin-inline-start, border-inline-start, inset-inline, text-align start/end. No physical left or right in the stylesheet except transform-origin values, which flip explicitly.
- THE HORIZON IS SCRIPT-AGNOSTIC and that is this world's advantage: --sea is a vertical token, so the motif survives mirroring untouched. What flips is every ORIGIN — the horizon draw runs transform-origin inline-end, the nav underline grows from the right, the progress of LA CÔTE reverses so the coast travels left-to-right, and the sun moves to the inline-start gutter.
- NEVER LETTER-SPACE ARABIC. Tracking breaks the script's joining and is the fastest way to make an Arabic page look machine-translated. Every micro-label carrying .2-.26em — hour marks, coordinates, QUAI labels, the trust strip, the dateline — must set letter-spacing 0 under [lang="ar"] and recover its label-ness through size (.82rem instead of .74rem), the accent colour, and word-spacing .1em.
- ARABIC HAS NO ITALIC, so the turn word carries the accent COLOUR plus a 1.06em optical size bump plus one lighter display weight. Never fake an oblique with transform:skew — a slanted Arabic word reads as a rendering fault. The closing wordmark, which is display ITALIC in Latin, becomes the display face at its lightest weight with the accent on one letterform.
- Pair a high-contrast Arabic display face for the serif role (the Aref Ruqaa, Amiri or Noto Naskh Arabic territory) with an Arabic-capable humanist sans for the text role. Roles stay sealed: the sans never sets a headline, the display never sets body copy.
- Arabic sets optically larger and needs air: body line-height 1.68 becomes 1.9, display 0.96 becomes 1.16, and every display size comes down about 8 percent. The h1's -.015em tracking becomes 0.
- Numerals, coordinates with prime marks, prices, distances, hour marks and the wa.me link stay LTR inside bdi elements or unicode-bidi:isolate spans with tabular figures, so a phone number or 12 500 DZD never renders in a mangled order. Choose ONE numeral system, Western or Eastern Arabic, and use it everywhere including inside the almanac.
- Mirror the postcard rotations (-1.6deg becomes +1.6deg) and the stamp corner (top inline-end stays inline-end and therefore moves to the left visually), and reverse the BULLETIN marquee so it reads with the language.

## Global rules this world overrides (declared, and honoured)
1. HAIRLINES: global calls a 1px rule the weakest seam and allows at most ONE per page. Here the horizon rule is a MOTIF, not a seam, and recurs in every scene — while scene BOUNDARIES still use the seam vocabulary above, so a bare rule plus whitespace is never a boundary.
2. RADIUS: global tolerates soft rounded containers; here radius exists in exactly three treatments (var(--radius) pills and steppers, 50% true circles, min(var(--radius), 3px) on the textarea) and a 12-16px radius on any content container is a ban-list violation. Shape is carried by four aspect ratios instead.
3. TONAL ROLE COUNT: eleven ground, text and accent roles, all routed through the fixed tokens; validation is a mix of var(--primary) and var(--foreground), never an outside hue.
4. SMOOTH SCROLL: Lenis is permitted and welcome here under the wiring contract above, because the tide reads better on eased scroll; native scroll remains a complete fallback.
5. AMBIENT LOOPS: global allows one; here up to THREE elements swell simultaneously on de-synced 2.6 / 3.2 / 3.6s cycles, because water does not move in unison. A fourth is banned.
6. CENTRING: permitted in exactly two places — the interlude's written line and the closing wordmark.

## Riviera ban list (in addition to the global one)
Cyan-to-blue gradients and any tropical-travel-agency palette · a booking or date-picker widget bar inside the hero · star-rating badges, review-site logos and price-comparison chips · full-width slider carousels with round arrow buttons · rounded 12-16px cards with backgrounds and drop shadows · three-icon amenity grids · palm-tree, wave, sun or beach emoji anywhere · pure white text or a pure white ground · detached grays that are not alpha-of-ink or alpha-of-linen · a second italic word inside one headline · italic used on body copy · upright serif below 1.5rem · a third type family · photographs whose horizons disagree with --sea · type sitting on raw photography without the four-stop scrim · a bouncing chevron scroll cue · countdown timers and fake scarcity · centered body copy (only the interlude line and the closing wordmark are centered) · a hero photograph with no sky in it · violet or magenta as an accent (the dusk GROUND is blue-side and is never the accent) · more than three simultaneously swelling elements · any hidden state authored in CSS.

## Intensity
This world fails in exactly one way: half-committed. A horizon rule drawn in three scenes instead of eleven; a ground arc with two stops instead of six; a photograph cropped at the default center; one italic word forgotten. Each of those is invisible on its own and together they turn Riviera into a nice blue hotel page — precisely the thing it exists to replace. Executed at 100% — one line held at 58% down every scene, the sea welding to the paper, the sun descending as you read, the ground turning from breakfast light to after-dinner blue, a stamped postcard lying across the water — the page reads like a folio somebody printed because they love the place. Push INTO the light. Every number above is load-bearing.`,
	energy: "medium",
	id: "riviera",
	industries: [
		"hotel",
		"guesthouse",
		"travel",
		"tourism",
		"restaurant",
		"seafood",
		"cafe",
		"beach-club",
		"rental",
		"events",
		"wedding",
		"spa",
		"real-estate",
		"photography",
	],
	kind: "website",
	mood: ["luminous", "coastal", "romantic", "unhurried", "sunlit"],
	name: "Riviera",
	priceFeel: "premium",
	tagline:
		"Mediterranean light on paper: one hairline horizon running through every scene, stamped postcards lying across the water, and a page whose background travels from morning white to after-dinner blue as you scroll.",
};
