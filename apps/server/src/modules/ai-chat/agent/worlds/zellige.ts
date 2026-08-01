import type { DesignWorld } from "./types";

/**
 * ZELLIGE — Maghreb heritage craft, built as a courtyard.
 * One eight-point-star lattice instantiated at five scales (page field, frieze
 * border, interlude band, medallion, and — the signature — a clip-path mask
 * that opens images from a star to a full frame). Glazed teal + fired
 * terracotta on unglazed bone, arches that are radius-on-top-only, museum
 * placards, and a symmetry broken exactly once per page. The doc is appended
 * VERBATIM to the builder system prompt.
 */
export const zellige: DesignWorld = {
	avoidFor: ["tech", "gaming", "crypto", "gadgets"],
	doc: `# DESIGN WORLD: ZELLIGE — the courtyard

## Philosophy
This page is a COURTYARD, not a scroll. The visitor comes in off a hot street through a dark passage, and the space opens: plaster walls, a band of glazed tile at knee height, arches on three sides, water in the middle, light falling from above. A riad in Tlemcen, a hammam in Constantine, a weavers' cooperative in Ghardaïa, a room where couscous has been served the same way for sixty years — these places do not need to be sold, they need to be ENTERED. The page's job is the entrance.

Geometry here is not decoration, it is STRUCTURE. One eight-point star governs the background field, the section borders, the way images open, the buttons, the accordion icons and the favicon. That single motif at five scales is what separates this world from "a website with some Moroccan patterns on it". Everything looks made by a hand that counted, measured, and laid it one piece at a time.

And ornament is RATIONED. For ninety percent of the page the lattice sits at four percent opacity and you feel it more than you see it. It goes loud in exactly four places: the frieze borders, the interlude bands, the medallion, and the star masks. A page where the pattern is everywhere at full strength is a rug shop, not a riad.

## The single law (do this FIRST — everything else follows from it)
Author ONE tile, then instantiate it five times. Never draw a second unrelated pattern.

THE TILE. An inline SVG data URI, 40 by 40, fill none, stroke set explicitly, stroke-linejoin miter, drawn from two paths:
- Path A, the diamond, whose vertices land exactly on the tile's four edge midpoints so the field tiles with no visible seam at any scale: M20 0 L40 20 L20 40 L0 20 Z
- Path B, the square inscribed in the same circle (half-side 14.14): M5.86 5.86 H34.14 V34.14 H5.86 Z
- Path C, optional, only for the dense band variant, a centre diamond: M20 12 L28 20 L20 28 L12 20 Z
A plus B is the khatem — the eight-point star. That is the whole motif.

ENCODING NOTE (this bites every time): percent-encode the angle brackets and the hash inside url(...) — %23 for hash — keep the SVG on one line, and set the stroke colour LITERALLY inside the encoded string, because currentColor does not resolve inside a background-image data URI. So you declare the tile TWICE as CSS custom properties: once stroked in the ink colour for light grounds, once stroked in the cream colour for night grounds, and you swap which one is used when the ground inverts.

THE FIVE INSTANTIATIONS:
1. FIELD — 46px tile, stroke-width .8, ink at 4 to 5 percent opacity. position fixed, inset 0, z-index 0, pointer-events none, on every page. This is the world's texture; you feel the wall behind the type.
2. FRIEZE — the SAME tile cropped: a 7px-tall strip with background-size 22px 22px and background-position center, so you see the star field sliced through its equator into a running band. Glaze colour at 46 to 55 percent. This replaces the 1px hairline as the world's chapter border.
3. BAND — 132px tile (and a 168px second layer behind it), stroke-width 1.3, glaze at 10 to 18 percent, inside full-bleed interlude bands, the two layers scrubbing at different speeds.
4. MEDALLION — ONE single tile blown up to clamp(18rem,40vw,34rem), stroke 1px, opacity .07, rotating 34s linear infinite. Exactly one per page, behind the closing wordmark or behind a typographic hero, never both.
5. MASK — the star as a clip-path polygon rather than a stroke. This is the signature image reveal and it is described in full under Motion.

## The vibe
Hospitable, unhurried, made-by-hand, quietly proud. The host has been doing this a long time and is not impressed by marketing. Copy rules, non-negotiable:
- EVERY headline is two clauses with a turn, and the second clause carries the accent: "Entrez, la cour est fraîche." / "Posé à la main, carreau par carreau." / "Le feu du matin, la lumière de midi."
- EVERY constraint is given a reason: not "6 chambres" but "Six chambres, parce que la cour n'en supporte pas plus."
- One sensory fact per page, stated flatly, no adjectives: the hours the courtyard takes sun, the temperature of the hot room, how many days the tiling took.
- Validation errors speak like a person: "Il nous faut un numéro pour confirmer." / "Votre nom, s'il vous plaît — il sera sur la porte."
- BANNED WORDS on this page: authentique (as a self-claim), oriental, exotique, magique, ancestral, solutions, expérience unique, élever, seamless, premium as an adjective about itself.
- Write in the brief's language. In Arabic every rule above holds unchanged; since Arabic has no italic, the "turn" is carried by the accent COLOUR plus weight 600 plus the lattice underline — the exact same device Latin uses in this world, which is why the Arabic page is not a downgrade.

## Visual signatures (what makes it instantly recognizable)
- A bone-coloured lime-plaster ground with a barely-there star lattice fixed behind everything, and a running glazed frieze at every chapter boundary.
- ARCHES: every important image sits inside a shape whose radius is on the TOP CORNERS ONLY. No four-corner-rounded box exists anywhere on the page.
- Images do not fade in and they do not wipe — they OPEN, from a small eight-point star at the centre of the frame out to the full frame, in a slow 1.45s.
- MUSEUM PLACARDS under the frames: matériau, région, siècle, set as a hairline-divided field of terms and values.
- A tile field where images butt against each other with a 3px joint instead of a 2rem gap — grout lines, not card gutters.
- Perfect courtyard symmetry, violated in EXACTLY ONE place per page, unmistakably.
- Two glazes and only two: a saturated teal that owns structure, a fired terracotta that owns action.
- One chapter inverts to a GLAZED DARK ground — a green-black, the colour of a tile in shadow — and the whole type system flips with it.

## Global rules this world overrides (declare them in a comment, then obey them)
1. "Exactly ONE accent hue" becomes TWO glazes, because real zellige is at least two glazes — with an absolute content-based job split (see Color physics). Never a third.
2. "Never 50/50, always skew the grid" is suspended: symmetry is this world's SUBJECT. Arcades run 1fr 1.34fr 1fr, tile fields run equal columns, placards and thresholds are centred — legible only because it is broken exactly once (see The displaced tile).
3. "One italic word inside a headline" becomes NO italics at all, in any script. The accented word is fired colour plus weight 600 plus a lattice underline, so Latin and Arabic pages carry identical typographic logic.
4. "Geometric pattern accents at LOW opacity" applies to the FIELD only; the lattice is a structural material instantiated from 4 percent up to full strength in friezes and masks.
5. The grain overlay at 3-6 percent: the FIELD lattice IS this page's texture. Grain is optional; using both, keep combined texture under 9 percent or the plaster turns to sandpaper.
6. "Hairline is the weakest seam, at most one per page": the THRESHOLD seam replaces it entirely. True 1px hairlines still exist inside tables, placards and forms, which that rule never counted.
7. "Place images inside deliberate frames" is strengthened to law: every content image sits in an arch, a mihrab clip, or a butted tile field. A plain rectangular full-bleed image is legal only where a WATER SEAM dissolves it.
8. THE GLOBAL TIMING BANDS ARE SLOWED, deliberately and by exact amounts, because a courtyard has no hurry: gsap.defaults ease power2.out and duration 1.25 instead of the global power3.out / 1.1 (power2 decelerates less sharply, which is what makes a 1.4s reveal read as unhurried rather than as lag); narrative reveals 1.0-1.6s instead of .9-1.4s; the star reveal 1.45s with its counter-scale at 1.8s instead of 1.4s / 1.8s; the hero entrance resolves in about 2.9s instead of the global "within ~1.6s"; staggers .10-.18 instead of .09-.14; the medallion at 34s and the reflection at 7s instead of 3-4s ambients. Interaction feedback stays inside the global .3-.45s — only NARRATIVE time is stretched. Nothing here is faster than the global band, which is why the world still reads as calm rather than sluggish.
9. "Count-up numerals on view" stands, but only on the COUNT LINE and only on figures the brief actually supplies (tiles, days, rooms, years). Prices never count up in this world — a spinning price reads as a sale, and a riad is not having one.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — BONE→--background · CLAY→--foreground · FIRED→--primary · BONE→--primary-foreground · NIGHT→--secondary · GLAZE→--accent · clay at 52%→--muted · clay at 14%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, tile tone or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics and encoded data-URI images may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
Nine tonal roles from the fixed tokens. Never a tenth hue.
- BONE (ground): unglazed lime plaster, the palette's lightest warm pole — the #EFE7D9 / #E9DFCE register. Never #fff, never a neutral grey.
- BONE-DEEP: 3 to 5 percent darker (#E2D7C2 register), used ONLY for section alternation, table row stripes and input fills.
- CLAY (ink): a fired brown-black where R is greater than G is greater than B — the #241A12 register. Never #111.
- INK AT ALPHA, and no independent grey exists on this page: body rgba(clay,.74), tertiary and captions rgba(clay,.52), hairlines rgba(clay,.14), strong rules rgba(clay,.30), placeholders rgba(clay,.34), table dividers rgba(clay,.12).
- GLAZE (structural accent): the saturated teal-green of a glazed tile — the #14706A / #0F5F5C register. Plus GLAZE-DEEP for hover and GLAZE-LIGHT (#7CC8BF register) for text and strokes on dark grounds.
- FIRED (action accent): terracotta or ochre — the #B4552F / #C2703A register. Plus FIRED-DEEP for hover.
- NIGHT (inverted ground): a GREEN-BLACK, where B is greater than or equal to G and both exceed R — the #0D1513 register. Never neutral black; a tile in shadow is still a tile.
- BONE-ON-NIGHT: a warm cream used for ALL text on night grounds (#EDE2CE register). Pure white appears nowhere on this page.
- HAIRLINE-NIGHT: rgba(bone-on-night,.16).

THE TWO-GLAZE JOB SPLIT (this is what keeps two accents from reading as a mess — memorise it):
- GLAZE owns STRUCTURE: every lattice stroke, every frieze, section indices, rules and dividers, focus rings, ::selection, khatem glyphs, the accordion star, the trust-strip icons, form focus states, the WhatsApp glyph.
- FIRED owns ACTION AND HEAT: the primary CTA fill, prices, the ONE accented word per headline, placard term labels, the medallion's inner field, error text, the active state in a stepper.
- Never both on the same element. Never a third hue. If you cannot decide, ask which of the two jobs the element performs.
Declare color-scheme light (or dark for a night-dominant brand) on :root plus a theme-color meta that changes when the ground inverts.

## Typography system
TWO families, three jobs, plus the Arabic pair as a first-class citizen.
- DISPLAY: a serif with calligraphic confidence — high stroke contrast, sharp entry strokes, a slightly humanist axis. The Cormorant / Marcellus / Gilda Display / Bodoni-adjacent territory. Weights 400/500/600 only; the h1 sits at 500. Never 700 at display sizes — this world's authority comes from the letterform, not from fat.
- BODY / UI: a humanist sans with open apertures and a calm lowercase — the Karla / Commissioner / Work Sans / Public Sans territory. Weights 400/500/600.
- ARABIC DISPLAY: a Naskh or Kufi display in the Amiri / Aref Ruqaa / Reem Kufi territory — Naskh when the brand is hospitality-warm, Kufi when it is museum-cool. ARABIC BODY: the IBM Plex Sans Arabic / Almarai / Noto Kufi Arabic territory. Load only the weights actually used.

SCALE (all clamp, all measured):
- Hero h1: clamp(3rem,7.6vw,6.6rem) / line-height 1.02 / letter-spacing -.012em / weight 500.
- Section h2: clamp(2.1rem,4.6vw,3.7rem) / 1.08 / -.008em / max-width 15em.
- h3: clamp(1.35rem,2.2vw,1.8rem) / 1.2 / 0.
- Proverb line: clamp(1.45rem,2.6vw,2.15rem) / 1.42 / display 400.
- Body: 1.0625rem / 1.66, measure capped at 36em.
- Placard value: .95rem display 500. Placard term: .68rem uppercase, .24em tracking, weight 600, body face.
- Micro-caps: .72 to .82rem uppercase, .18 to .26em tracking.
- Closing wordmark: clamp(4rem,17vw,15rem) / .88 / POSITIVE .04em.
TRACKING IS A FUNCTION OF SIZE: -.012em above 90px, -.008em at 40-70px, 0 at body, +.18 to +.26em at 11-13px uppercase. Target a display-to-micro ratio of at least 9:1; a generic page sits at 3:1.

THE ACCENTED WORD — the highest-leverage typographic device here, one per headline maximum. Wrap the turn word in a span that gets: colour fired, weight 600, letter-spacing 0 (explicitly cancelling the display face's negative tracking), and a LATTICE UNDERLINE — a ::after strip at height 5px, inset-inline 0, bottom -.14em, background-image the tile at background-size 18px 18px, opacity .55, in glaze. On a link, that strip animates in with clip-path inset(0 100% 0 0) to inset(0) over .55s (animate the clip, never the width — stretching the pattern is a bug).

NEVER LET A DISPLAY HEADLINE AUTO-WRAP. Break every h1 and h2 into explicit block-level line spans so the rag is AUTHORED, and reuse those spans as the animation stagger targets.

PROMOTE NUMERALS. Inside count lines and spec rows, wrap the number in the display face at 1.35rem inside a .95rem body sentence, tabular-nums, thousands grouped with a THIN SPACE (U+202F): "1 240 carreaux, posés en 11 jours". That one rule is the entire museum-label effect.

ARABIC AND RTL — first-class, not an afterthought:
- dir="rtl" on the html element, and logical properties EVERYWHERE (padding-inline, margin-inline, border-inline-start, inset-inline) so the whole courtyard mirrors without a second stylesheet.
- The lattice is eight-fold symmetric and needs no mirroring — a gift of the motif. What DOES flip: the arch-overlap direction, the frieze-draw transform-origin (transform-origin 100% 50% under [dir=rtl]), the displaced tile's offset sign, and placard alignment.
- Arabic display sizes run 6 to 10 percent larger than the Latin equivalents, body line-height 1.78 instead of 1.66.
- letter-spacing is FORCED to 0 on all Arabic text — tracking breaks the joins and is the commonest tell of a Latin designer. No uppercase transform either (Arabic has no case): micro-labels and placard terms become .82rem weight 600 in glaze, untracked, instead of tracked caps. No italics anywhere, ever.
- Phone numbers, prices and dates stay LTR inside the RTL flow: wrap them in a span with dir="ltr" and unicode-bidi isolate so 0555 12 34 56 never scrambles. Section indices may use Eastern Arabic numerals as ornament, but prices and phone numbers stay in the digits the visitor will dial and pay with.

## Page chassis
- NAV: position fixed, height 5.4rem, TRANSPARENT over the hero, z-index 100. On scroll past 64px add .is-set: background rgba(bone,.88), backdrop-filter blur(16px) saturate(1.08), and a 7px FRIEZE border-bottom (a ::after strip with the tile at 22px, glaze .5). Transition background, colour and border over .7s with the shared ease.
- WORDMARK IS A LOCKUP: a 14px inline-SVG khatem glyph in glaze, then the name in the display face at 1.35rem weight 500 tracked +.1em, then optionally a .6rem body-face sub-label at .3em tracking, opacity .55. Hovering the lockup rotates the star 22.5deg over .8s — the world's smallest joke and its most memorable one.
- Right side: two or three quiet text links at .92rem, then the khatem pill CTA. Below 900px the links disappear and the burger appears; the CTA moves into the mobile sticky bar.
- BURGER: three equal 24px bars at 1.5px, the outer two crossing into an X over .5s while the middle fades — no unequal-bar cleverness, symmetry is the house style.
- MENU OVERLAY: opens as a STAR EXPANSION — the same 16-point clip-path polygon (see Motion), scaling .05 to 2.6 over 1.1s power3.inOut, origin at the burger. Inside: night ground, lattice at 8 percent in glaze-light, links in the display face at clamp(2rem,6vw,3.6rem) each prefixed by a khatem glyph and an index, stagger .12. Body scroll locked, focus trapped, Escape closes.
- GLOBAL BASE: html and body overflow-x clip (the enabler for the displaced tile, the arch overlaps, the medallion at 130 percent and the frieze bands), scroll-behavior smooth, antialiased. The FIELD lattice layer sits fixed at z-index 0. ::selection is glaze at .22 with clay text. :focus-visible is a 2px glaze outline at outline-offset 3px, border-radius min(var(--radius), 0px). A skip link sliding from top -4rem to top 1rem on focus over .3s.
- THE COORDINATED NUMBERS — derive all three from the measured nav, never guess them independently: hero min-height calc(100svh - 5.4rem), sticky column offsets top 7rem, scroll-margin-top 6rem on every anchored section.
- NO CANVAS, NO WEBGL, NO three.js in this world. The lattice is SVG and CSS. If you reach for a canvas here you have misunderstood the world.

## Hero forms (pick the one the place calls for — never the marketplace split)
1. THE COURTYARD (default). The page opens on a giant arch INSET from the page edges: a wrapper with padding clamp(14px,2.2vw,30px) so the bone lattice field is visible as plaster all the way around the opening. The arch itself: border-radius clamp(8rem,22vw,17rem) clamp(8rem,22vw,17rem) 3px 3px, min-height calc(100svh - 5.4rem), overflow hidden. Inside, a full-bleed photograph overscanned to 114 percent with a consciously chosen object-position, under a four-stop vertical scrim: rgba(night,.58) at 0 percent so the nav reads, .06 at 30 percent, .18 at 62 percent, .88 at 100 percent — and the last stop EQUALS the ground of whatever comes next. Copy is FLOOR-ANCHORED (flex-direction column, justify-content flex-end) at padding clamp(2rem,6vh,4.5rem) clamp(1.5rem,5vw,4rem), in bone-on-night, max-width 22em.
   NO CTA BUTTON INSIDE THE ARCH. The hero's action lives in the nav pill and in the mobile sticky bar. The only other element inside is the scroll cue: a 1px glaze rule 64px tall with a 10px star sliding down it on a 2.4s keyframe loop — never a bouncing chevron.
   Half-overlapping the arch's bottom edge by margin-top -2.6rem at z-index 3: THE PLACARD, a bone-deep strip at max-width 62rem, margin-inline auto, 1px hairline border, padding 1.2rem 1.8rem, carrying three placard fields separated by vertical hairlines. That overlap IS the hero's seam into scene two.
   The image enters with THE STAR REVEAL — the page's first and most important gesture.
2. THE ARCADE (three rooms, three services, three crafts). A symmetric three-column arcade: grid-template-columns 1fr 1.34fr 1fr, gap clamp(1rem,2vw,1.8rem), align-items end, column heights 62vh / 78vh / 62vh. Side arches at radius 6rem 6rem 2px 2px, the centre at 11rem 11rem 2px 2px. Copy sits ABOVE the arcade, centred on the courtyard axis at max-width 30em — centring is permitted here because the composition is architectural. A placard under each arch. Only the CENTRE arch runs the star reveal; the sides run a plain curtain wipe, so the middle is the event. Below 920px: one column, centre arch first via order -1 at 74vh, the two sides side by side at 44vh.
3. THE PLASTER WALL (typographic — a hammam, a museum, any merchant with weak photography). No photograph above the fold. Bone ground with the lattice at 9 percent (double the page rate) plus ONE medallion at clamp(18rem,40vw,34rem) at 7 percent, rotating. The type: one enormous display sentence at clamp(2.6rem,6.4vw,5.4rem), hand-broken into three lines, with the fired accent word and its lattice underline on the last. Then one real glazed object: a 96px square of solid glaze with the star knocked out of it in bone, sitting OFF the centre axis at translate(-38%,18%) — this is the page's displaced tile, and it then gets no other. The first photograph appears in scene two.

## Section seams (the courtyard's own vocabulary — every boundary uses one, never the same twice in a row, use at least five of the seven)
1. FRIEZE INTERLUDE — the pattern band. Full-bleed, height clamp(84px,11vh,140px), on night or bone-deep, carrying TWO lattice layers: a back layer at 168px tile / glaze .10 and a front layer at 96px tile / glaze .18, with 1px glaze rules at .3 alpha top and bottom. The layers scrub at different speeds (see Motion) — this is the world's parallax and it costs nothing. Optionally one line of centred micro-caps floating inside it.
2. ARCH OVERLAP — an arch frame pulled UP across a boundary by margin-top -5 to -9rem at z-index 3, its foot standing on the new ground, with a frieze interlude running BEHIND it so the band is visibly interrupted. Two devices in one seam; use it once per page, at the most important handoff.
3. GLAZE INVERSION — a hard cut from bone to NIGHT, and the whole type system flips: bone-on-night text, hairline-night rules, the lattice re-declared in glaze-light at .08, placard terms in glaze-light instead of fired, images allowed +6 percent brightness. One or two per page, never more.
4. THE THRESHOLD (seuil) — the world's quiet seam and its replacement for the global hairline: a 7px frieze, then 6.5rem of plain ground holding ONE centred proverb line in the display face with a 10px khatem glyph on each side, then another 7px frieze. No heading, no eyebrow, no CTA.
5. WATER SEAM — the reflecting pool. The bottom 16vh of a full-bleed image is duplicated, transform scaleY(-1), opacity .2, filter blur(1.5px), with mask-image linear-gradient(to bottom, black, transparent) so the photograph dissolves into its own reflection, whose final tone IS the next ground. Images never simply end here: they dissolve into water or they are cut by an arch.
6. COURTYARD SQUEEZE — the outgoing section narrows its last block to max-width 40rem, then the next opens edge to edge. Compression, then release, the way a passage opens onto a court.
7. TILE WELD — the next section starts at padding-top 0 and shares the previous section's frieze border, so two chapters read as one continuous wall.

## Layout physics
- ONE gutter token: clamp(20px,4.6vw,76px), used for page padding AND for absolutely positioned off-grid elements, so even the broken pieces snap to the margin. Container max-width 1520px; a narrow measure container at 62rem for placards, thresholds and forms. Section block padding clamp(5.5rem,12vh,9.5rem) — the middle term is vh so the rhythm breathes with the viewport height.
- SYMMETRY IS THE DEFAULT (see the overrides block). Arcades 1fr 1.34fr 1fr, tile fields equal columns, thresholds and placards centred on the axis. Two-column story rows may run 1fr 1.28fr, but at least three compositions must be genuinely symmetric or the world does not read.
- THE DISPLACED TILE — the world's structural law. EXACTLY ONE element on the page violates the symmetry, unmistakably, and it is the page's most photographable moment. Choose ONE form: (a) one arch in an arcade dropped 4.5rem lower than its siblings and 1.5x wider; (b) one image frame at translate(-9%,6%) so it crosses the gutter into the margin; (c) exactly one section whose grid runs 1fr 1.28fr while every other is symmetric; (d) a single 96px glazed square rotated 22.5deg sitting off-axis over a section boundary; (e) one placard flush to the inline start while every other is centred. NEVER TWO — two breaks read as sloppiness, one reads as a signature. Mark it with an HTML comment so a later pass does not "correct" it. On mobile it shrinks to translate(-6%,4%) but never disappears.
- RADIUS LAW: buttons, pills, status chips and the stepper consume var(--radius) directly (:root sets --radius: 999px); every content container, band, table, input and plain frame caps it at 0. The only other curves are sculpted ARCHES on TOP corners and true circles at 50%. The arch tokens: ARCH-L clamp(8rem,22vw,17rem) top / 3px bottom; ARCH-M 7rem / 2px; ARCH-S 3.2rem / 2px; and the HORSESHOE variant 50% 50% 0 0 / 42% 42% 0 0 for a true Moorish bulge on square-ish frames. A four-corner-rounded box does not exist in this world.
- THE MIHRAB CLIP — the pointed arch, one frame per page maximum, for the single most important portrait: an inline SVG clipPath with clipPathUnits="objectBoundingBox" and path "M0,1 L0,0.46 C0,0.30 0.14,0.13 0.5,0 C0.86,0.13 1,0.30 1,0.46 L1,1 Z", referenced as clip-path url(#mihrab). Keep a rounded sibling — "M0,1 L0,0.42 C0,0.19 0.22,0 0.5,0 C0.78,0 1,0.19 1,0.42 L1,1 Z" — for frames where the point would fight the subject's head.
- THE TILE FIELD replaces the card grid: repeat(auto-fit,minmax(15rem,1fr)) at gap 3px, not 2rem. Images butt against each other and the 3px of bone showing through IS the grout joint. Every fifth tile is arch-topped and spans two rows. No captions inside tiles; one placard under the whole field.
- LEDGER TABLES, NOT CARDS, for rates, hours, services and menus: a grid with 1px internal dividers at rgba(clay,.12), zero radius, zero shadow, the term in body caps .72rem/.2em, the value in the display face at .98rem, the price right-aligned with tabular-nums. Rows alternate to bone-deep; the head row carries a 7px frieze above it.
- FRIEZE BORDERS INSTEAD OF HAIRLINE BORDERS on chapter tops and running heads; true 1px hairlines survive only inside tables, placards and form rules.
- IMAGES: portrait 4/5 or 3/4 inside arches, 1/1 inside tile fields. Any parallaxed image is top -12 percent and height 124 percent inside an overflow-hidden parent so travel never exposes an edge.
- OVERFLOW IS COMPOSITIONAL, and exactly four things break their container: the displaced tile, one arch overlap, the medallion at 130 percent width, the hero placard at -2.6rem. Every containing section gets overflow clip.
- RESPONSIVE COLLAPSE below 980px: arcades stack, tile fields go to two columns still at 3px gap, arch radii drop one token (ARCH-L becomes ARCH-M), placards become one-column definition lists with hairline rows, sticky columns go static, and the pinned gallery falls back to a vertical stack.

## Motion identity (GSAP 3 + ScrollTrigger via CDN; native scroll — Lenis optional, and if used, exposed as window.__lenis)
THE SAFETY CONTRACT COMES FIRST AND IS NON-NEGOTIABLE. Compute one flag: reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, hasGsap = typeof window.gsap !== "undefined", animate = hasGsap && !reduced. EVERY hidden initial state — every autoAlpha 0, every y offset, every start clip-path — is set with gsap.set() INSIDE the animate branch. Never author opacity 0, visibility hidden or a start clip-path in CSS for an animated element. If the CDN fails or motion is reduced, the page is fully visible, fully readable, and every conversion element still works. Add a prefers-reduced-motion CSS block carrying the global blanket (animation-duration .01ms, animation-iteration-count 1, transition-duration .01ms, scroll-behavior auto) PLUS this world's DESIGNED stills, never a blank: the medallion stops rotating but stays at 7 percent, the reflection shimmer freezes mid-frame, every frieze renders at scaleX 1, every star reveal resolves straight to clip-path none so the arch radius is intact, the arcade walk renders as the stacked vertical layout, and every count-up paints its final value.

gsap.defaults({ease:"power2.out", duration:1.25}).
TIMING BANDS (an explicit override of the global bands — see the overrides block, item 8) — every duration belongs to one: .3-.45s interaction feedback (the global band, unchanged); .6-.8s component or ground state; 1.0-1.6s narrative reveal (THE HOME REGISTER — nothing narrative on this page is faster than 1 second); 1.9s hero image settle; 6-7s ambient; 34s medallion rotation; scrub for the lattice parallax. The shared CSS ease token is cubic-bezier(.16,.84,.28,1). GSAP eases: power3.inOut for every clip reveal (the star must open with weight at both ends), power2.out for entrances and settles, sine.inOut for ambients, none for scrub.
STAGGERS 0.10 to 0.18. A stagger of .06 reads nervous in this world.
TRAVEL DISTANCES: y of 18 / 32 / 54 only. Scales .96 / 1.06 / 1.14. Hover is NOT a translate here — tiles do not float. Hover changes GLAZE: colour, border, and a 22.5deg star rotation.

1. THE STAR REVEAL — the signature. At least three per page, never more than five (it must stay an event).
   START: clip-path polygon(61% 50%, 57.78% 53.22%, 57.78% 57.78%, 53.22% 57.78%, 50% 61%, 46.78% 57.78%, 42.22% 57.78%, 42.22% 53.22%, 39% 50%, 42.22% 46.78%, 42.22% 42.22%, 46.78% 42.22%, 50% 39%, 53.22% 42.22%, 57.78% 42.22%, 57.78% 46.78%)
   END: clip-path polygon(111% 50%, 100.2% 71.2%, 100.2% 100.2%, 71.2% 100.2%, 50% 111%, 28.8% 100.2%, -0.2% 100.2%, -0.2% 71.2%, -11% 50%, -0.2% 28.8%, -0.2% -0.2%, 28.8% -0.2%, 50% -11%, 71.2% -0.2%, 100.2% -0.2%, 100.2% 28.8%)
   Both strings have SIXTEEN vertices in the same order — that is why they interpolate. Edit one and you must edit the other identically, or the browser hard-cuts instead of animating. The end state is the same star scaled past the frame so it reads as the full rectangle.
   gsap.fromTo(frame, {clipPath: START}, {clipPath: END, duration:1.45, ease:"power3.inOut", onComplete: () => frame.style.clipPath = "none"}), with the inner image counter-scaling 1.14 to 1 over 1.8s power2.out from the same instant — the de-synced durations are what make it read as light spreading rather than a mask sliding. scrollTrigger start "top 84%", once true; clearing the clip on complete hands the shape back to the arch radius.
   A regular OCTAGON variant for smaller frames and the mobile fallback: from polygon(45.86% 40%, 54.14% 40%, 60% 45.86%, 60% 54.14%, 54.14% 60%, 45.86% 60%, 40% 54.14%, 40% 45.86%) to polygon(29.29% -20%, 70.71% -20%, 120% 29.29%, 120% 70.71%, 70.71% 120%, 29.29% 120%, -20% 70.71%, -20% 29.29%) over 1.2s.
2. THE PARALLAX LATTICE — inside every frieze interlude, the two layers travel at different rates against the scroll: the FRONT layer (96px tile) gsap.fromTo(front,{backgroundPositionY:"0px"},{backgroundPositionY:"-240px", ease:"none", scrub:.25}); the BACK layer (168px tile) to "-92px" with scrub:.8. Add yPercent -6 to 6 on the band's inner wrapper with scrub true. Three planes, one band, zero images.
3. HERO ENTRANCE — one overlapping timeline, roughly 2.9 seconds of unhurried arrival: the arch runs the star reveal at t=0.15 (1.5s); the image scales 1.14 to 1 over 1.9s also at t=0.15; the h1's authored lines rise yPercent 110 to 0 over 1.3s power3.out, stagger .14, at t=0.5; the placard fields come autoAlpha 0 / y 18, stagger .12, at t=1.15; the scroll cue at t=1.5. Any preloader is gated on an inline gsap-and-reduced-motion check and overlaps this at -=.7.
4. MASKED LINE RISE on every display block: split at REAL browser wrap points (compare offsetTop), preserve accent-span ancestry with a class, run on window.load so font metrics are final, aria-label on the parent and aria-hidden on the visual lines, descender-safe masks (padding-bottom .08em, margin-bottom -.08em), then ScrollTrigger.refresh(). 1.25s power3.out, stagger .13, start "top 86%", once.
5. THE FRIEZE DRAW — every frieze border enters with scaleX 0 to 1, transform-origin 0 50% (100% 50% under [dir=rtl]), 1.1s power2.out, once. A chapter announces itself by DRAWING its tile band, not by fading in a rule.
6. THE MEDALLION — one per page: rotate 360deg over 34s linear infinite in CSS keyframes plus a scrubbed yPercent -8 to 8. Never in the same viewport as the reflection shimmer.
7. THE REFLECTION SHIMMER — on the water seam's mirrored copy only: yPercent 0 to 1.2 and opacity .2 to .26 over 7s sine.inOut yoyo repeat -1. These two are the page's ONLY ambient loops; a third is banned.
8. COUNT-UPS on the count line (tiles laid, days, rooms, years): a proxy object tweened 1.9s power2.out with a thin-space thousands formatter, once, start "top 88%", PLUS a 4000ms setTimeout fallback painting the final value in case the trigger never fires on a deep-linked load.
9. GENERIC REVEALS — roughly fourteen elements: gsap.set({autoAlpha:0, y:32}) then to({autoAlpha:1, y:0, duration:1.15}), start "top 88%", stagger .12, once. Placards, ledger rows, threshold lines, trust items, form fields one by one.
10. OPTIONAL SHOWPIECE — THE ARCADE WALK (pinned; only if the merchant has four or more real rooms, crafts or dishes, and only ONE pinned section per page). A track of five arch frames translating x from 0 to -(scrollWidth - innerWidth) with pin true, scrub 1, anticipatePin 1, invalidateOnRefresh true, pin duration around 220 percent of viewport height. The frame nearest the viewport centre is ACTIVE: height 62vh to 82vh, radius interpolating ARCH-M to ARCH-L over .8s, its placard fading up; the others sit at opacity .55. Inside the pin, EVERY reveal uses scrollTrigger containerAnimation so it fires on horizontal position, and the images drift xPercent 5 to -5 against the travel. The CSS DEFAULT is the stacked vertical layout; horizontal is opt-in via a body class added inside gsap.matchMedia("(min-width:920px)") with a proper teardown.
once:true on everything non-scrubbed. Nothing on this page re-animates on scroll-up.

HOVER AND MICRO KIT (all CSS, all inside the bands): the khatem glyph rotates 22.5deg over .5s anywhere it appears; a tile's image swells scale(1.04) over 1.9s on a WRAPPER, never on the element GSAP transforms; a text link's lattice underline grows with clip-path inset(0 100% 0 0) to inset(0) over .55s; ledger rows tint to bone-deep over .35s; the primary button goes fired to fired-deep over .35s while its star rotates; inputs change border-colour and reveal their frieze strip together over .35s; the accordion star rotates 22.5deg and gains glaze when open.

## Components
- BUTTONS. PRIMARY, the KHATEM PILL: border-radius var(--radius), fired fill, bone text, padding 1.02em 1.7em, .94rem body face weight 600, .04em tracking, inline-flex with gap .7em holding a 13px inline-SVG eight-point star on the trailing side. Hover: fired-deep, star rotates 22.5deg. No lift, no shadow.
  SECONDARY, the OCTAGON: not a pill — an outlined button whose silhouette is a regular octagon. Build it as a two-layer box because clip-path eats borders: an outer element with the glaze background and clip-path polygon(29.29% 0%, 70.71% 0%, 100% 29.29%, 100% 70.71%, 70.71% 100%, 29.29% 100%, 0% 70.71%, 0% 29.29%), containing an inner element inset 1.5px with the SAME clip-path, the bone background and the label. Padding 1.1em 2.1em; on hover the inner fills to glaze at .1.
  TERTIARY: a text link with the lattice underline.
- SHADOWS ARE ALMOST BANNED — glaze is flat, plaster is flat. Exactly two: 0 34px 70px -34px rgba(clay,.32) under an arch frame that overlaps a boundary, and 0 18px 44px -22px rgba(clay,.26) under the floating hero placard. Zero on buttons, tiles, nav, tables or inputs.
- INPUTS: background rgba(bone-deep,.55), border 0, border-bottom 1.5px rgba(clay,.22), border-radius min(var(--radius), 0px), padding .95em .2em, 1rem. Labels above at .68rem uppercase, .24em tracking, weight 600, rgba(clay,.55) — in Arabic .82rem weight 600 in glaze, untracked, no uppercase. On focus THREE things change together over .35s: the bottom rule becomes 1.5px glaze, a 7px frieze strip fades in beneath it at .5, and the label takes glaze. Selects match exactly, with a small rotated star where the chevron would be.
- THE RESERVATION / ORDER BLOCK (this is an Algerian market: even a riad night or a hammam session is booked by phone, WhatsApp and cash). On a bone-deep chapter between two frieze seams, container 62rem, one column on mobile and a 1fr 1.28fr grid above 900px with a sticky arch-framed image at top 7rem beside it. It collects: full name; phone as type tel with inputmode tel, a real pattern, dir ltr and autocomplete tel; WILAYA as a select styled exactly like the inputs (all 58, or the merchant's list from the brief); a date or session select where the business has slots; address or arrival note; and guests or quantity as a STEPPER — an inline-flex group at border-radius var(--radius) with 2.9rem true-circle buttons at 50% and an output element at min-width 2.6rem in the display face at 1.25rem. Any cap is given a reason in the hint text.
  PRICES: display face, tabular-nums, thousands grouped with a THIN SPACE — U+202F, a real narrow no-break space, so 12 000 never breaks across a line — and the currency mark exactly as the brief writes it (DA or DZD, never both on one page, never a symbol invented for it), set in the body face at .55em with .08em tracking, placed AFTER the numeral as French and Arabic convention requires, in fired. A struck former price gets text-decoration-color fired at 1.5px.
  VALIDATION IS BLUR-GATED with a touched map so an error never appears while someone is still typing into a fresh field; errors are full sentences in brand voice, in fired, min-height 1.2em reserved so nothing reflows, aria-live polite.
  SUBMIT has a deliberate 750ms pending state with a human present-tense label, then the block CROSS-FADES IN PLACE into a success placard positioned over it in the same box (success in over .7s with staggered delays, form out over .45s with visibility 0s .45s so focus never lands on a hidden element). The success copy echoes the visitor's own name, date and choices back, with the reservation number inside a MEDALLION: the star glyph at 9rem whose strokes are drawn by stroke-dashoffset (pathLength 100, dasharray 101, dashoffset 101 to 0 over 1.4s, .5s delay), the number at 2.4rem display 600 in its centre. Persist it in localStorage and restore the success state instantly on return. And the instant validation passes — as the medallion begins to draw — the reservation is handed through the door: the page dispatches the wandit:lead CustomEvent on document with the visitor's fields flat in detail (name, phone as written, wilaya, commune, plus date and guests), while one off-canvas decoy input marked data-wandit-hp sits in the block, never read by the page's own script.
- WHATSAPP CTA, styled to the world and never a green blob: a bone (or night) pill at border-radius var(--radius) with a 1px glaze rule, an inline-SVG WhatsApp glyph drawn at 18px in GLAZE, the label in the body face at .9rem weight 600, the number under it at .78rem tabular-nums with thin-space grouping. It appears in the nav after scroll, at the foot of the reservation block, and in the mobile sticky bar. The href is a real wa.me link built from the brief's number with a prefilled message in the page's language.
- MOBILE STICKY BAR: fixed bottom, height 4.4rem plus env(safe-area-inset-bottom), bone at .94 alpha with backdrop-filter blur(14px) and a 7px frieze border-top. Inside: the fired khatem pill at about 62 percent of the width (Réserver / Commander) and the glaze-outlined octagon WhatsApp button for the rest. Slides in from yPercent 100 over .5s past 40 percent scroll; hidden above 900px.
- TRUST STRIP: four items, each with a DRAWN inline-SVG line icon at 1.25px stroke, 22px, 24 by 24 viewBox, glaze, no fills, every form taken from this world's geometry — the eight-point star, an arch, a key, a water drop. Labels .74rem uppercase, .16em tracking. Separated by 1px hairlines, never boxed into cards. Content is real: paiement à la livraison or sur place, delivery or arrival terms, cancellation window, languages spoken. Never an invented statistic or a fake badge.
- ACCORDION for questions: a hairline-topped list, each item hairline-bottomed, the question a full-width flex button in the display face at clamp(1.05rem,1.6vw,1.28rem) weight 500, padding 1.35rem 0, single-open with aria-expanded maintained, panels animated grid-template-rows 0fr to 1fr over .55s with an overflow-hidden inner. The icon is a small khatem that rotates 22.5deg and takes glaze when open — never a chevron.
- CRAFT DETAILS: explicit width and height on every image; fetchpriority high on the hero image, lazy elsewhere; art-directed alt on content images, empty alt plus aria-hidden on decorative duplicates (the water reflection, the medallion, the field lattice); an inline-SVG data-URI favicon carrying the eight-point star in glaze on bone; a theme-color meta following the active ground; a skip link; correct lang and dir attributes.

## Editorial furniture (REQUIRED — this is the courtyard's voice)
- THE PLACARD, the world's signature caption, under every important frame and under the hero. Three or four fields, hairline-divided, the term in FIRED caps at .68rem/.24em, the value in the display face at .95rem: MATÉRIAU (zellige émaillé, plâtre sculpté, bois de cèdre, laine tissée) · RÉGION (Tlemcen, Ghardaïa, Constantine, Kabylie) · SIÈCLE or ÉPOQUE (XVIIᵉ, 1908, contemporain) · optionally ATELIER or ARTISAN. In Arabic: المادة / المنطقة / القرن, weight 600, no tracking. THESE ARE TYPESETTING, FILLED FROM THE BRIEF. Never invent a century, a region, a material or a maker. With no heritage facts in the brief, the placard carries real operational facts in the identical form — capacité, durée, horaires, langues. Invented provenance is a lie and a Pass-1 correctness bug.
- THE KHATEM INDEX: every section head is a RUNNING HEAD, never a centred H2 — a baseline-aligned flex row of [12px star glyph in glaze] [index] [uppercase micro-label] [flex 1 frieze rule] [right-aligned factual aside], sitting on a 7px frieze border-bottom. Indices in Latin numerals, or Eastern Arabic (٠١ ٠٢ ٠٣) on Arabic pages.
- THE PROVERB LINE: exactly one per page, living in a threshold seam — one sentence of voice in the display face, khatem glyphs either side, no heading, no attribution unless the brief supplies one.
- THE LIGHT NOTE: one sensory operational fact set as a caption, in the page's language — "la cour prend le soleil de 11h à 15h", "salle chaude 42°, salle froide 24°", "le pain sort du four à 6h". From the brief, never invented.
- THE MAKER CREDIT: a .78rem line under one frame naming who made or laid or cooked the thing, when the brief names them.
- THE COUNT LINE: three or four facts as promoted numerals in one sentence — display face at 1.35rem inside a .95rem body line, tabular-nums, thin-space thousands: "1 240 carreaux · 11 jours · 3 patios".
- THE HOURS TABLET: the ledger table used for hours, rates or the menu — the most useful thing on a page like this, and in this world it is beautiful instead of an afterthought.
- THE CLOSING MONUMENT: the page's last gesture is typography — the wordmark edge to edge at clamp(4rem,17vw,15rem), line-height .88, tracking +.04em, colour transparent with -webkit-text-stroke 1px glaze at .55 alpha, user-select none, aria-hidden, with the medallion rotating behind it at 7 percent. Then a frieze, then a hairline row of real links and a credit line.

## Zellige ban list (in addition to the global one)
Mosaic clipart, lantern / camel / hamsa emoji, stock arabesque vectors · gold gradients and the "Arabian Nights" purple-and-gold palette · faux-Arabic ("kufic-look") Latin display faces · any italic on an Arabic page, and italics as the headline accent device anywhere in this world · tracked Arabic text · a pattern at more than 22 percent opacity behind body copy (only masks and friezes go higher) · MORE THAN ONE displaced element · four-corner border-radius on anything (arches are top-only, pills consume var(--radius)) · box-shadows on tiles, cards, buttons, nav or inputs · card grids with 1-2rem gaps (tiles butt at 3px) · a third hue beyond glaze and fired · pure white or pure black anywhere · neutral greys that are not an alpha of clay · bouncing chevron scroll cues · marquees and tickers of pattern (the lattice moves by scrub, never by loop) · countdown timers and manufactured urgency · glassmorphism · canvas, WebGL or three.js · per-character text splitting · more than two ambient loops · more than one pinned section · invented provenance, invented reviews, invented certifications · a hero that is a paragraph on the left and a photo on the right.

## Intensity
This world fails by being timid. The failure mode is a beige page with a faint pattern, some rounded cards and a serif headline — which is worse than a generic page, because it also looks apologetic about its own heritage. Executed at 100 percent it is unmistakable: a giant arch inset in plaster, an image that opens like a star from its own centre, a glazed frieze drawing itself under every chapter head, a placard telling you the material and the region, a band of tile scrolling at its own speed, one dark green-black room in the middle of the house, and exactly one tile deliberately out of line so you know a person put it there. Push INTO the geometry — count the tiles, keep the symmetry, break it once, and let every reveal take its full 1.4 seconds. Nothing in a courtyard is in a hurry.`,
	energy: "medium",
	id: "zellige",
	industries: [
		"hotel",
		"travel",
		"spa",
		"hammam",
		"restaurant",
		"cafe",
		"bakery",
		"crafts",
		"artisan",
		"jewelry",
		"beauty",
		"wedding",
		"events",
		"culture",
	],
	kind: "website",
	mood: ["crafted", "serene", "ornamented", "heritage", "sunlit"],
	name: "Zellige",
	priceFeel: "premium",
	tagline:
		"A courtyard you walk into: bone plaster, a glazed tile band running under every chapter, photographs that open from an eight-point star out to the full frame, and one tile deliberately out of line so you know a person laid it.",
};
