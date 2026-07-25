import type { DesignWorld } from "./types";

/**
 * VITRINE — the museum display case for ONE precious object.
 * Near-black ground, a breathing radial light pool, one object per viewport,
 * a French museum cartel under every view, a scroll-scrubbed multi-angle walk
 * around the SAME product, specs as a ruled acquisition register, the price
 * set like a stone in claw marks, and a cash-on-delivery form staged as an
 * acquisition ritual with a quiet, lights-down success state. Overrides the
 * global radius, shadow, hover-lift and entrance-timing rules — each override
 * is declared inside the doc. The doc is appended VERBATIM to the builder
 * system prompt.
 */
export const vitrine: DesignWorld = {
	avoidFor: [
		"street-food",
		"hard-discount",
		"toys",
		"fast-food",
		"supermarket",
		"kids-party",
		"baby",
		"gym",
	],
	doc: `# DESIGN WORLD: VITRINE — the museum case for one object

## Philosophy
This page is a DISPLAY CASE, not a shop. One object, alone, in a dark room, in its own pool of light. The visitor does not browse — they walk around a vitrine, read the label, lean in, and acquire the piece from the registrar's desk at the end of the room.

Three laws generate the world; everything else is consequence.

LAW ONE — ONE VIEWPORT, ONE OBJECT. Every principal scene is a full-height room holding exactly one view of the product, one cartel (museum label) and at most one line of voice. Never a grid, never two objects side by side; three variants means three vitrines in sequence, never one row of three. It is the hardest law in the library and it is what makes the world.

LAW TWO — THE PAGE IS A LIGHTING DESIGN. Nothing is lit evenly. The ground is near-black; light exists only where a lamp is aimed. Every visible surface sits inside a pool, at the edge of one, or deliberately in the dark. When tempted to add a background colour, add a LIGHT instead — a radial wash, a floor ellipse, a raking sheen. Flat fills are how this world dies.

LAW THREE — THE OBJECT IS NEVER CROPPED. Every product image is object-fit CONTAIN, floating with 12-18 percent breathing room on all sides, casting a contact shadow. A cropped full-bleed product photo is a catalogue; a contained object on darkness is a museum piece. The only cover-cropped image on the page is the one daylight scene.

Structurally: full-height rooms separated by darkness, one scrubbed multi-angle sequence, one chromatic inversion, a transactional chapter at the end. No carousel, no gallery grid, no lightbox. The distance from a generic dark landing page is not effect budget — it is the discipline of showing one thing at a time, labelling it properly, and lighting it.

## The vibe
Hushed, exact, slightly reverent, expensive without ever saying so. A conservator who knows the object's weight in grams and will not oversell it. The room is quiet; the object talks; the label is honest.

Copy rules, non-negotiable — they carry 40 percent of this design:
- HEADLINES ARE NOUN PHRASES, never sentences, never verb-first offers: "Or 18 carats, poli à la main." / "Le boîtier, à midi." / "Trois angles, une seule pièce." / "Verre saphir, 42 mm." You name an object; you do not pitch it.
- EVERY CLAIM CARRIES A UNIT. Not "très résistant" but "étanche à 30 m"; not "grande capacité" but "12 000 mAh". A number with a unit is the whole voice of this world.
- ZERO EXCLAMATION MARKS on the entire page. Not one. If a line needs one, the line is wrong.
- Section titles are two or three words: "La pièce" · "Autour" · "Le détail" · "Le registre" · "En plein jour" · "L'acquisition".
- Constraints are stated flatly, with a reason: not "stock limité" but "Édition de 40 pièces — 12 restantes en atelier."
- Validation errors are quiet complete sentences: "Le nom qui figurera sur le bordereau." / "Dix chiffres — les espaces sont acceptés."
- Banned words in every language: solutions, seamless, elevate, experience, transform, revolutionary, premium, luxe, exclusif, incontournable, unique en son genre, "profitez", "n'hésitez pas", "achetez maintenant".
- Approved CTA verbs, and only these: Acquérir · Réserver · Commander à la livraison · Voir la notice · Écrire.
- Write in the brief's language. Arabic follows the RTL section below; because this world uses no italics, its voice survives translation intact.

## Visual signatures (what makes it instantly recognizable)
- A near-black room with one radial POOL of light per scene, breathing on a slow 5.4-second cycle that changes BRIGHTNESS far more than size — a lamp settling, never a pulse. It is the only ambient motion on the page.
- One object per screen, contained not cropped, standing on a drawn elliptical contact shadow so it has weight.
- A CARTEL under every view: a 2.2rem accent hairline, the object's name, then one tracked micro-caps line reading MATÉRIAU · DIMENSIONS · ÉDITION · RÉFÉRENCE with accent middots. Four fields, always in that order.
- CLAW MARKS — four 1px accent L-brackets framing the stage, the price and the acquisition number. The same shape at three scales; it is this world's silhouette the way an arch is another world's.
- The price set like a stone: a large display numeral with thin-space thousands, a tiny tracked DZD micro-label on its baseline, one accent superscript footnote mark, inside its claw setting.
- Specs as a ruled ACQUISITION REGISTER with an accent head rule, hairline rows, and display-face numerals promoted inside body-face values.
- Darkness used as an actual section: 26-38vh of empty near-black between rooms with one accent inventory numeral floating in it.
- A pool of light that TRAVELS between rooms as you scroll instead of fading out and in.
- Exactly one white-cube scene where the whole page inverts to gallery daylight — the showpiece.
- Zero rounded corners. Zero box-shadows. Glass and metal have square edges.

## Color physics (instantiate with the brief's hexes — the physics is law, the hexes are the brief's)
TEN tokens drawn from exactly FOUR hue families — the noir/lumen neutrals, the accent metal, the white-cube pair, and one validation carnelian. Never a fifth family, never an eleventh token.
- NOIR (the room): the palette's darkest pole pushed to a near-black keeping the palette's temperature — the #0B0A09 register for warm palettes, #0A0B0D for cool. NEVER #000000. If the brief's darkest hex is above roughly 12 percent luminance, darken it; a vitrine cannot be staged on charcoal.
- NOIR-2 (the wall behind the case): 5-9 RGB points lighter (the #141311 relationship), for the trust strip, the form plate, the plinth face and section alternation. Never a card background.
- LUMEN (the light, and all text on darkness): a warm off-white in the #EDE7DC register. Pure #FFFFFF appears NOWHERE — not in text, not in a rule, not in a glow.
- THE ALPHA LADDER, the rule that makes the room read as lit rather than as dark UI: body rgba(lumen,.74), cartel spec lines rgba(lumen,.56), tertiary and footnotes rgba(lumen,.40), hairlines rgba(lumen,.14), strong rules rgba(lumen,.26), placeholders rgba(lumen,.32), disabled rgba(lumen,.26), row hover fill rgba(lumen,.03). No independent gray hex exists in this world.
- POOL: LUMEN warmed one step, used only inside radial gradients at alphas .04 to .24, always with mix-blend-mode screen so overlapping pools add instead of stacking.
- ACCENT plus ACCENT-DEEP plus ACCENT-LIGHT: one precious-metal hue from the brief — brass, old gold, copper, gunmetal blue, patina green — and two siblings (the #C6A15B / #9C7B3C / #E4CD97 relationship). THE ACCENT IS A METAL, NOT A LIGHT: never neon, never fully saturated, never a large fill. Its biggest use on the page is a 2.2rem hairline.
- CHALK plus INK (the white cube only): a gallery white that is not white, the #F2F0EB register, and a near-black ink in the #14130F register. Two tokens for exactly one section.
- CARNELIAN: one muted validation signal, the #A8402C register — the only hue outside the accent family, appearing in exactly two places, error text and the error field's underline.

THE ACCENT'S TWELVE JOBS — use at least nine: the cartel's top rule, the middots in every spec line, inventory numerals, the price superscript, the price and stage claw marks, the register's head and foot rules, ::selection, :focus-visible, the drawn SVG trust icons, the form's step numerals, the drop cap, the closing wordmark's outline stroke.

LIGHT PHYSICS — three formulas, reused everywhere:
- THE ROOM WASH (every dark section): radial-gradient(78% 58% at 50% 34%, rgba(lumen,.075) 0%, transparent 68%) over NOIR.
- THE POOL (behind every object): radial-gradient(circle at 50% 46%, rgba(pool,.22) 0%, rgba(pool,.09) 34%, transparent 68%), filter blur(10px), mix-blend-mode screen.
- THE FLOOR SPILL (where the object stands): radial-gradient(ellipse 46% 100% at 50% 50%, rgba(pool,.16), transparent 72%), width 68 percent of the stage, height 5.5rem, blur(6px).
And their counterweight, THE CONTACT SHADOW: a separate element, width 34 percent of the stage, height 1.6rem, radial-gradient(ellipse at 50% 50%, rgba(0,0,0,.85), transparent 70%), blur(8px), at the object's base. Light alone makes the object float; light plus contact shadow makes it stand.

Declare color-scheme dark on :root and a theme-color meta matching NOIR — swapped to CHALK while the white-cube room is in view.

## Typography system
TWO families minimum, THREE maximum, non-overlapping jobs. Load only the weights used, from a real foundry service — never Inter, Roboto or Open Sans.
- DISPLAY (300/400 only): a high-contrast serif with visible hairline thins — the Cormorant Garamond, Prata, Playfair Display, Bodoni Moda, Marcellus territory. Jobs: object names, the hero headline, the price, every promoted numeral, the acquisition number, the closing wordmark. NEVER below 1.05rem — hairline thins vanish at small sizes on a dark ground and the page turns muddy.
- LABEL (400/500/600): a quiet neo-grotesk or geometric with a large x-height and clean caps — the Jost, Archivo, Work Sans, Manrope, Public Sans territory. Its jobs and only its jobs: everything in tracked uppercase between .62rem and .82rem — cartel spec lines, form labels, buttons, nav, micro-caps, table terms, trust labels, the DZD mark. The museum SIGNAGE face; it never sets a paragraph.
- BODY (400): running prose — the LABEL family at normal tracking for a strict page, or a companion text serif in the Lora, Source Serif, Newsreader territory when the voice wants warmth.

Scale, all clamp, all measured:
- Hero h1 (the object's name): clamp(3rem,7.6vw,6.6rem) / line-height .94 / letter-spacing -.015em / display 400.
- Room title (each vitrine's h2): clamp(2.2rem,5.4vw,4.4rem) / .98 / -.012em / max-width 14em.
- Price jewel: clamp(2.8rem,5.2vw,4.4rem) / 1 / -.01em / display 400 / tabular-nums. Acquisition number: clamp(2.4rem,5vw,3.4rem) / 1 / 0.
- Cartel name line 1.05rem / 1.3 / .01em display 400; cartel spec line .70rem / 1.55 / .20em LABEL 500 uppercase.
- Micro-caps elsewhere: .62rem to .78rem at .22em to .34em tracking. This world tracks WIDER than any other in the library — museum signage is engraved, not typed.
- Body 1rem / 1.72 / +.006em. Table values .92rem / 1.6. Promoted numerals: display face 1.15rem tabular-nums inside a .92rem line.
- Closing wordmark: clamp(4rem,17vw,15rem) / .84 / POSITIVE .08em.

THE DARK-GROUND CORRECTION, a law: light type on dark blooms optically and closes up. Every text style on NOIR takes +.006em letter-spacing versus what you would use on paper, +.06 line-height, and one weight step DOWN in the display face (400 where paper would use 500). The white-cube section removes the correction in a scoped override.

TRACKING IS A FUNCTION OF SIZE: -.015em above 90px, -.012em at 40-70px, -.01em at 30-40px, +.006em at body, +.20em to +.34em at 10-13px uppercase. Target a display-to-micro ratio of at least 9:1.

NEVER LET A DISPLAY HEADLINE AUTO-WRAP. Break every h1 and h2 into explicit block line spans so the rag is authored, each inside an overflow:hidden wrapper with padding-bottom .06em and margin-bottom -.06em so descenders survive the mask — and reuse those spans as the stagger targets.

NO ITALICS EXIST IN THIS WORLD. Emphasis is the ACCENT COLOUR, a size step, or moving a phrase into the micro-caps register. Deliberate: the Arabic build is then typographically identical to the French one, which no editorial-italic world can claim.

SMALL CAPS WHERE AVAILABLE: on faces that support it, set the cartel name line and the register's terms with font-variant-caps all-small-caps at .82rem and .12em tracking instead of uppercase at .70rem. If the face synthesizes ugly small caps, fall back to tracked uppercase.

## Page chassis
- NO NAVBAR. The header is LA RÉGIE: fixed, height 3.4rem, z-index 100, transparent, grid auto 1fr auto, padding-inline var(--pad). Start — the wordmark lockup: the merchant's name in DISPLAY at 1.15rem, letter-spacing .06em, beside a baseline-aligned sub-label in LABEL at .58rem, .3em tracking, rgba(lumen,.45), uppercase. Middle — nothing, ever. End — THE ROOM COUNTER, "SALLE 01 / 05" in LABEL .64rem, .3em tracking, rgba(lumen,.5), current numeral in the accent, updated by ScrollTrigger as each room enters. It counts ONLY the five PRINCIPAL rooms (the vitrine, the walk, the détail, the white cube, the acquisition) — seams, the register and the footer are not rooms; hard-code the denominator from that count so the rail never disagrees with the page. Past 40px of scroll the rail gains background rgba(noir,.72), backdrop-filter blur(16px) and border-bottom 1px rgba(lumen,.10) over .6s; in the white cube every one of those tokens swaps to its CHALK equivalent over .6s.
- LA MARGE (desktop above 1100px): a fixed vertical strip on the inline-start edge, writing-mode vertical-rl, .62rem, .30em tracking, rgba(lumen,.30), inset-inline-start .9rem, top 50%, translateY(-50%), carrying the collection reference or the merchant's city and year. Rotated 180deg in RTL, hidden below 1100px.
- THE GRAIN: fixed, inset -50%, z-index 90, pointer-events none, opacity .09, mix-blend-mode overlay, an inline SVG data URI of feTurbulence fractalNoise baseFrequency 0.9 numOctaves 2 stitchTiles stitch, desaturated with feColorMatrix saturate 0, on a 240x240 rect at opacity .5. Note the .09 — dark grounds show grain twice as loudly as paper, so this world runs it at half the usual strength.
- THE VIGNETTE: one fixed pseudo-element, inset 0, z-index 89, pointer-events none, box-shadow inset 0 0 24vh 9vh rgba(0,0,0,.55). It is what turns a dark page into a dark ROOM, and it costs one line.
- Global base: html and body overflow-x clip with background NOIR on both so overscroll never flashes white, antialiased, text-rendering optimizeLegibility. ::selection is accent with NOIR text. :focus-visible is a 1px accent outline at outline-offset 3px, radius 0. A skip link sliding from top:-4rem to top:1rem on focus over .3s.
- THE COORDINATED NUMBERS, all derived from the 3.4rem rail: room min-height calc(100svh - 3.4rem) with a 100vh line declared FIRST as fallback; sticky column offset top 5.2rem; scroll-margin-top 4.2rem on every anchored section; padding-bottom 5.6rem on the last section so the sticky bar never covers the footer's last line.
- SMOOTH SCROLL IS WELCOME HERE, AND IT IS GATED: Lenis is optional but recommended at lerp .085 and wheelMultiplier .9. Wire it exactly — lenis.on("scroll", ScrollTrigger.update), drive lenis.raf from gsap.ticker.add, set gsap.ticker.lagSmoothing(0), expose the instance as window.__lenis, and DO NOT instantiate it at all when reduced is true, when the pointer is coarse, or when the Lenis CDN failed. Native scroll must remain a complete, correct experience; every ScrollTrigger on the page works identically without it.

## The room sequence (this world's page blueprint — follow it unless the brief names another arc)
1. LA VITRINE — the hero: the object lit, named, priced, its cartel and the four-fact rail.
2. LE NOIR — darkness with one accent numeral.
3. LA MARCHE — the pinned multi-angle walk: 2-4 shots of the SAME object, scrubbed, pool travelling.
4. LE CARTEL SEUL — one line of voice on darkness, no object at all.
5. LE DÉTAIL — a macro room: one extreme close-up, cartel naming material and finish, welded by LE SOCLE into...
6. LE REGISTRE — the acquisition table, the notice with the drop cap, the provenance leader list.
7. LE CUBE BLANC — the inversion: the object in daylight, worn or in use, the merchant's signed line. The showpiece.
8. LA VITRE — the glass-sweep seam back into darkness.
9. LES GARANTIES — the trust strip.
10. L'ACQUISITION — the ritual form beside a sticky object column.
11. LE COLOPHON — the dark footer with the monument wordmark.

## Hero forms (pick one — every one is fully loaded)
1. LA VITRINE CENTRALE (default; the signature; jewelry, watches, perfume, gadgets, art). Single column, centred, min-height calc(100svh - 3.4rem), display grid, place-items center, padding-block clamp(3rem,7vh,5.5rem), overflow clip. Top to bottom: the collection line in accent micro-caps at .66rem/.32em; the hand-broken h1; THE STAGE; the cartel; the price in its claw setting; one primary CTA plus one quiet link; the facts rail.
   THE STAGE IS SIX LAYERS OF LIGHT — width min(78vw,34rem), aspect-ratio 3/4, position relative, isolation isolate:
   - z0 the room wash, painted on the section, not the stage.
   - z1 THE POOL: absolute, left 50%, top 46%, width 128%, aspect-ratio 1/.86, translate(-50%,-50%), the pool gradient, blur(10px), screen blend, pointer-events none. It carries the page's single ambient loop.
   - z2 THE FLOOR SPILL: absolute, bottom -1.2rem, left 50%, translateX(-50%), width 68%, height 5.5rem, the floor formula, blur(6px), screen blend.
   - z3 THE CONTACT SHADOW: absolute, bottom -.4rem, left 50%, translateX(-50%), width 34%, height 1.6rem, the shadow formula, blur(8px).
   - z4 THE OBJECT: 2-4 absolutely stacked img elements at inset 0, width and height 100%, object-fit CONTAIN, filter drop-shadow(0 26px 34px rgba(0,0,0,.62)), all at opacity 0 except the first. Explicit width/height attributes; fetchpriority high on frame one.
   - z5 THE GLASS: absolute, inset -6%, pointer-events none, mix-blend-mode screen, background linear-gradient(122deg, transparent 34%, rgba(lumen,.055) 46%, rgba(lumen,.10) 50%, rgba(lumen,.03) 56%, transparent 70%). You are looking through a pane; this layer is the tell.
   - z6 THE CLAW MARKS: four L-brackets at the stage's corners, each two 1px accent lines of arm-length 1.6rem at opacity .45, inset -1.1rem. Pure CSS pseudo-elements, never an SVG file.
   THE HERO TERMINATES IN A FACTS RAIL, never in whitespace: full-bleed, border-top 1px rgba(lumen,.14), a flex list of exactly four LABEL micro-facts at .68rem/.24em uppercase, each preceded by a .3em accent SQUARE (this world has no round shapes), padding 1.15rem var(--pad), gap clamp(1.6rem,4vw,3.2rem); below 620px a 1fr 1fr grid at .62rem/.18em. The four facts are real: material, dimension, edition size, delivery.
2. LE SOCLE (the plinth; perfume bottles, sculpture, bags, shoes, appliances). Grid 1.12fr/.88fr, gap clamp(2.5rem,6vw,5.5rem), align-items center. The object stands on a DRAWN PLINTH: NOIR-2, width 62 percent of the stage, height 3.6rem, clip-path polygon(6% 0, 94% 0, 100% 100%, 0 100%) so it reads as a trapezoid seen slightly from above, a 1px rgba(lumen,.18) top edge, a raking linear-gradient(178deg, rgba(lumen,.10), transparent 62%) on its face. The contact shadow sits ON the plinth. The copy column is start-aligned at max-width 30em; nothing is centred in this variant.
3. LA CIMAISE (the picture rail; art prints, framed pieces, phones and tablets face-on, textiles). A full-bleed NOIR-2 wall, one 1px accent-at-.30 line edge to edge at 38vh, the object hanging from it with a 1px hairline dropping 2.2rem to its top edge. The cartel goes at the REAL museum offset: below the object's lower corner on the inline-end side, translated 2.4rem down, aligned to the object's end edge, max-width 18rem, start-aligned. Honor that offset exactly — it is a genuine hanging convention.

## Section seams (Vitrine's own vocabulary — every boundary uses one, never the same twice in a row)
Use at least five of the seven. LE NOIR and LE DÉPLACEMENT are MANDATORY. LE CUBE BLANC appears EXACTLY ONCE.
- LE NOIR (the dark between) — the default seam, and why this world needs no whitespace elsewhere. Between two rooms the page goes to pure NOIR for clamp(6rem,30vh,16rem): no wash, no pool, no copy. Inside it, exactly one thing, centred: a 4.5rem-tall 1px vertical hairline in rgba(lumen,.2), and beneath it the next room's inventory numeral in the accent at .66rem/.34em uppercase. Emptiness is a designed device, licensed here and nowhere else.
- LE DÉPLACEMENT DE LA LUMIÈRE (the travelling pool) — THE SIGNATURE SEAM. The light does not fade out and in; it MOVES. One position:fixed pool element lives behind the whole room sequence at z-index 1, pointer-events none. Each room registers its stage's centre from getBoundingClientRect on ScrollTrigger.refresh; a ScrollTrigger per room, scrub true, ease none, tweens the fixed pool's x and y in pixels from the previous anchor to this one across the darkness, with scale .82 to 1 and opacity .55 in the dark to 1 at the object. Desktop only above 900px; below that each room owns a local, non-travelling pool and the fixed one is display:none.
- LE CUBE BLANC (the white cube) — the one chromatic inversion and the page's SHOWPIECE. Ground flips to CHALK, all text to INK, the accent stays byte-identical, and the pool becomes a SHADOW: the object casts drop-shadow(0 30px 40px rgba(ink,.22)) plus a wider fainter floor ellipse in rgba(ink,.10), because daylight is diffuse and has no pool. HARD CUT at the boundary, never a gradient. The rail, marginalia, sticky bar and theme-color meta follow over .6s. Content: the object worn, used or held in a real place — the one cover-cropped image on the page — plus the merchant's signed line.
- LE CARTEL SEUL (the lone label) — a room with no object: one line of voice at max-width 22em, centred, a 2.6rem 1px accent rule above it, the inventory reference below. Height clamp(14rem,42vh,22rem). Use it once, after the walk.
- LA VITRE (the glass sweep) — a full-bleed 12vh strip whose background is the glass gradient at 108 percent width, rotated -3deg, with a 1px rgba(lumen,.10) line on each long edge; its gradient scrubs translateX from -14 to 14 percent across the boundary. It is how you cross from the white cube back into the dark.
- LE SOCLE (the plinth weld) — the next section starts at padding-top 0, welded to the previous by a plinth trapezoid whose base IS the next section's top edge. One double gap eliminated; two rooms read as one.
- LA CIMAISE (the rail seam) — one full-bleed 1px accent-at-.30 line with a .66rem/.30em micro-label sitting ON it (background NOIR, padding-inline .9rem, translateY(-50%)). Hairlines are this world's structural material everywhere else, but as a section BOUNDARY the global cap of one per page holds.

## Layout physics
- ONE inline-padding token: clamp(1.4rem,5vw,5.5rem). Container max-width 78rem — narrower than an editorial world on purpose. A vitrine is a room, not a spread.
- SECTIONS ARE HEIGHT-DRIVEN, NOT PADDING-DRIVEN: every principal room is min-height 100svh (100vh fallback line first), display grid, place-items center, padding-block clamp(3rem,7vh,5.5rem). Only the register, the trust strip and the footer are padding-driven, at clamp(4.5rem,10vh,7.5rem).
- EXACTLY FOUR THINGS MAY BE CENTRED and nothing else: the object stage, the cartel, single-sentence voice lines of at most 14 words, and the closing wordmark. All running prose is start-aligned at a measure of 32em or less. A centred paragraph is an instant failure of this world.
- NO GRID IS 50/50. The register is .78fr/1.22fr (table wider than its heading column); the white cube 1.18fr/.82fr, image leading; the acquisition chapter .84fr/1.16fr — the sticky OBJECT column narrow, the FORM wide, deliberately inverting the hero's proportion so the last room feels unlike the first. Column gaps clamp(2.5rem,6vw,5.5rem).
- MEASURE IS CAPPED IN EM: body 32em, notice 34em, voice line 22em, cartel 26rem, form sub-copy 30em, table 46rem.
- RADIUS IS ZERO. This world OVERRIDES the global mid-radius default completely: border-radius 0 on every frame, plate, input, select, table, button, badge, plinth, rail and bar. The ONE exception is the primary CTA, which may be a 0-radius rectangle OR a 999px pill — pick one at the start of the build and apply it to every CTA. Mixing the two is a correctness bug.
- HAIRLINES ARE THE ONLY BORDERS: 1px rgba(lumen,.14). No 2px, no 3px, no dashed. Three named exceptions: the register's head rule at 1px accent-at-.55, the claw marks at 1px accent, and the checked form row's 2px inline-start accent bar — a form needs a strong selected state and that is the price.
- SHADOWS: this world OVERRIDES the global shadow convention. Exactly two species, no third. (a) THE CONTACT SHADOW — a drawn blurred black ellipse element, never a box-shadow. (b) THE DROP-SHADOW FILTER on contained objects: drop-shadow(0 26px 34px rgba(0,0,0,.62)) on dark, drop-shadow(0 30px 40px rgba(ink,.22)) in the white cube. ZERO box-shadows on cards, panels, buttons, inputs, the rail, the bar or the form plate. If you have written a box-shadow, you have left the world.
- OVERFLOW IS COMPOSITIONAL, and exactly three elements use it: the pool at 128 percent, the glass sweep at 108 percent, and the closing wordmark bleeding past the container — safe only because overflow:clip sits on every room and overflow-x:clip on html and body.
- BACKDROP-FILTER IS RATIONED TO TWO ELEMENTS: the scrolled rail and the sticky order bar. A third use is glassmorphism and is banned.
- RESPONSIVE COLLAPSE below 900px: every two-column grid becomes 1fr; sticky becomes static; the walk's pin is REMOVED for a snap rail; the stage narrows to min(86vw,24rem); the marginalia disappears; the facts rail becomes 2x2; LE NOIR shrinks from 30vh to 16vh so the phone page is not an endurance test.
- IMAGE DISCIPLINE: explicit width and height attributes everywhere; fetchpriority high on the hero's first frame; loading lazy below the fold; art-directed alt text on content images; alt empty plus aria-hidden on the sticky bar's silhouette duplicate.

## Motion identity (GSAP 3 + ScrollTrigger from a CDN; Lenis optional)
THE SAFETY CONTRACT COMES FIRST. Compute one flag: reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, hasGsap = typeof window.gsap !== "undefined", animate = hasGsap && !reduced. EVERY hidden initial state — every autoAlpha 0, y offset, scale, and every frame opacity beyond the first — is set with gsap.set() INSIDE the animate branch. Never author opacity:0 in CSS for an animated element. If the CDN fails or motion is reduced, the page is a fully visible, fully functional vertical sequence of lit objects. Add a prefers-reduced-motion block that, beyond the blanket .01ms override, sets the pool's animation to none, freezes the dust canvas, and makes every walk frame position:static so all angles simply stack.

TIMING BANDS — this world OVERRIDES the global entrance band because it is slow on purpose: .30-.50s interaction feedback; .60-.80s component state; .60s room inversion; 1.2-1.8s entrances and narrative reveals (not .9-1.4); 2.2s light bloom; 2.4s total hero arrival; 5.4s the pool breath. ONE shared CSS easing token, cubic-bezier(.16,.68,.18,1), across roughly twenty transitions. GSAP eases: power2.out for light, power3.out for type and furniture, power4.out for masked line rises, sine.inOut for the breath, expo.out for the single success moment, none for EVERY scrub.

TRAVEL DISTANCES ARE TINY: y offsets of 12 / 18 / 22 / 40 only. Scales of .82 / .94 / 1.03 / 1.04 / 1.06. Nothing here travels 100px.

THIS WORLD OVERRIDES THE GLOBAL HOVER-LIFT: nothing translates on hover — objects in a vitrine do not bounce. INTERACTIVE SURFACES GAIN LIGHT instead: a hovered element raises its own background alpha by .04-.06 and/or its border from rgba(lumen,.14) to accent, over .40s. One exception, the world's best micro-interaction: the primary button's letter-spacing widens from .20em to .24em over .45s inside a fixed min-width, so nothing reflows.

The mandatory motion set:
1. L'ALLUMAGE (the lights come up) — the hero entrance, roughly 2.4s. The LIGHT arrives BEFORE the object; that order is the entire idea.
   gsap.set: a full-bleed NOIR overlay at z 60 to autoAlpha 1; the pool to scale .5, autoAlpha 0; the contact shadow to scaleX .3, autoAlpha 0; the object to autoAlpha 0, y 18, scale 1.04; the headline line spans to yPercent 112; cartel, price, CTA and rail to autoAlpha 0, y 12; the four claw marks to scaleX 0 and scaleY 0 with transform-origin at their own corner.
   tl.to(overlay,{autoAlpha:0,duration:1.0},0)
     .to(pool,{scale:1,autoAlpha:1,duration:2.2,ease:"power2.out"},.10)
     .to(contactShadow,{scaleX:1,autoAlpha:1,duration:1.6,ease:"power2.out"},.45)
     .to(object,{autoAlpha:1,y:0,scale:1,duration:1.6,ease:"power2.out"},.50)
     .to(lines,{yPercent:0,duration:1.1,stagger:.11,ease:"power4.out"},.85)
     .to(cartel,{autoAlpha:1,y:0,duration:.9},1.35)
     .to(claws,{scaleX:1,scaleY:1,duration:.5,stagger:.06},1.55)
     .to(furniture,{autoAlpha:1,y:0,duration:.8,stagger:.09},1.60)
2. LA MARCHE AUTOUR (the walk) — THE SIGNATURE INTERACTION: 2-4 shots of the SAME product from different angles, swapped by scroll progress so the visitor walks around the case.
   - All N frames: position absolute, inset 0, object-fit contain, will-change opacity, opacity 0 except frame 0.
   - ONE ScrollTrigger on the walk section: start "top top", end "+=" plus (N-1)*90 percent of viewport height, pin true, scrub .6, anticipatePin 1.
   - Its timeline holds N-1 crossfades, each one unit long: for i from 1 to N-1, tl.to(frame[i],{opacity:1,duration:1,ease:"none"}, i-1) and tl.to(frame[i-1],{opacity:0,duration:1,ease:"none"}, i-1). Crossfading opacity between shots of the same object on black reads as ROTATION, not as a slideshow — which is why the shot list keeps lighting and framing identical between frames.
   - THE COUNTER-MOVE THAT SELLS IT, on the same timeline: the pool's x scrubs from -6 to +6 percent and the contact shadow's scaleX from 1.06 to .94 across the full range, so the LIGHT swings around the object as the angle changes. Without it the walk is a fade; with it, a rotation.
   - THE CARTEL FOLLOWS THE ANGLE: the spec line is N absolutely stacked spans cross-fading over .5s, switched from the same timeline's onUpdate by mapping progress to an index. Never a second ScrollTrigger.
   - MOBILE BELOW 900px DOES NOT PIN — pin plus scrub on a phone is a scroll jail. The frames become a horizontal snap rail: scroll-snap-type x mandatory, each frame scroll-snap-align center at width 86vw, gap 1.2rem, scrollbar hidden, the cartel switched by IntersectionObserver at threshold .6, and a row of N 1px accent tick marks below as indicators (active at full opacity, the rest at .3).
   - IF GSAP IS ABSENT: the frames become a static stacked list of the first and last angle, each with its cartel. The walk is an enhancement, never a dependency.
3. LE DÉPLACEMENT — the travelling pool, contract given in Section seams. Scrub true, ease none, desktop only.
4. LA RESPIRATION — the ONE ambient loop, and it is a LAMP, not a heartbeat: gsap.fromTo(poolInner,{opacity:.72,scale:1},{opacity:1,scale:1.03,duration:5.4,ease:"sine.inOut",yoyo:true,repeat:-1}). The amplitude lives in OPACITY (.72 to 1, a 28-point swing) while the scale barely moves (3 percent) — a gallery lamp varies in brightness, not in size, and a glow that visibly inflates reads as a tech-product pulse. CRITICAL ENGINEERING LAW: the breath and the travel must never fight over the same transform. Build the pool as TWO nested elements — the OUTER wrapper carries the scrubbed x/y/scale, the INNER child carries the breathing scale and opacity. One element with two writers is a jitter bug you will not find by reading the CSS.
5. GENERIC REVEALS — roughly fourteen elements: gsap.set({autoAlpha:0,y:22}) then to({autoAlpha:1,y:0,duration:1.1,ease:"power3.out",stagger:.08}), scrollTrigger start "top 88%", once:true.
6. THE ROOM INVERSION — a ScrollTrigger on the white cube, start "top 60%", end "bottom 40%", toggling a class on the html element via onEnter/onLeave/onEnterBack/onLeaveBack. That class swaps six custom properties (ground, ink, hairline, pool, plate, rail-bg), each transitioning over .60s, and rewrites the theme-color meta. NOT two stacked sections cross-fading — a single token swap never breaks scroll height and reads as the lights changing in a room.
7. LE REFLET — the glass sweep: on the hero and walk stages, a scrubbed translateX from -14 to 14 percent across the section's range, ease none. Plus a one-shot on the price setting as it enters: a band clipped to the price box sweeping translateX(-120%) to translateX(120%) over 1.1s at opacity .12.
8. LE COMPTE — a proxy tween of {v:0} to the price over 1.6s power2.out, onUpdate writing through a formatter that inserts thin-space thousands, at "top 90%" once, PLUS a 4000ms setTimeout fallback painting the final formatted value instantly if the trigger never fires on a deep-linked load. Count-ups are for ARRIVALS only.
9. THE ROOM COUNTER — ScrollTrigger onToggle per room rewrites the rail's numeral with a .30s opacity blink from 1 to .3 to 1. No tween beyond that.
10. LES POUSSIÈRES (optional, desktop only, and the only canvas this world permits) — dust motes drifting inside the hero pool. One canvas over the stage at z 2, pointer-events none, sized to its box at devicePixelRatio capped at 2, holding 40 particles of radius .4-1.3px at alpha .05-.16 in LUMEN, vertical drift -3 to -9 px/s, horizontal sine drift of amplitude 6px and period 7-13s, wrapped to the box, rAF paused by an IntersectionObserver when off-screen. Never started below 900px, under reduced motion, or if getContext("2d") returns null. FALLBACK CONTRACT: if it does not initialize nothing is missing — the motes are atmosphere, never content, and no layout depends on them.

once:true on EVERYTHING non-scrubbed. Exactly TWO scrubs — the walk and the travelling pool; the glass sweep rides an existing timeline rather than opening a third. Exactly ONE ambient loop. Exactly ONE pin, desktop only.

## Components
- BUTTONS — two species, no third. PRIMARY (L'ACQUISITION): background LUMEN, colour NOIR, padding 1.15em 2.4rem, radius per the build's single choice, LABEL 600 at .78rem uppercase, letter-spacing .20em, line-height 1, min-width 14rem, centred, no shadow; hover over .45s to ACCENT-LIGHT with letter-spacing .24em plus box-shadow 0 0 0 1px rgba(accent,.5) — the only box-shadow in this world, and it is a ring; active ACCENT; disabled rgba(lumen,.26) background with NOIR text and no hover. GHOST (LE LIEN): transparent, border 1px rgba(lumen,.22), colour LUMEN, same type at weight 500, hover border ACCENT and background rgba(accent,.07) — used for WhatsApp, secondary actions and the footer. QUIET LINK: LABEL .72rem/.22em uppercase, rgba(lumen,.7), with a 1px underline drawn by ::after at bottom -.5em, scaleX(0) from transform-origin inline-start growing to scaleX(1) over .35s while the colour turns ACCENT. Never a full-width solid CTA outside the form.
- THE CARTEL — the world's most-used component; it appears 6 to 10 times and must be identical every time. A block at max-width 26rem, margin-inline auto, centred in the vitrine variants, start-aligned in the cimaise and socle variants.
  - Top rule: a 2.2rem by 1px ACCENT line, margin 0 auto 1rem (margin-inline-end auto when start-aligned).
  - Line 1, the name: DISPLAY 400, 1.05rem, letter-spacing .01em, LUMEN.
  - Line 2, THE SPEC LINE: LABEL 500, .70rem, letter-spacing .20em, uppercase, rgba(lumen,.56), reading MATÉRIAU · DIMENSIONS · ÉDITION · RÉFÉRENCE in that fixed order, separated by accent middots at padding-inline .55em and opacity .8. Exactly four fields; if the brief supplies three, the fourth becomes the inventory reference — never a gap, never a fifth.
  - Line 3 (optional), one note: BODY .82rem, rgba(lumen,.46), max-width 22em. Line 4, the reference: ACCENT, .64rem, .30em tracking, uppercase.
  THE CARTEL HAS NO BACKGROUND, NO BORDER BOX, NO SHADOW, NO PADDING BOX. It is text on darkness beneath one rule. Wrapping it in a card destroys the world.
- THE ACQUISITION REGISTER (the specs table) — a real table, max-width 46rem, margin-inline auto, border-collapse collapse. Above it a 1px rgba(accent,.55) rule, then two heads in LABEL .66rem/.28em uppercase rgba(lumen,.44) reading CARACTÉRISTIQUE and DÉTAIL. Rows at .8fr/1.2fr, gap 1.6rem, padding-block .95rem, border-bottom 1px rgba(lumen,.12); term LABEL .72rem/.20em uppercase rgba(lumen,.54), value BODY .92rem rgba(lumen,.86). PROMOTE EVERY NUMERAL inside a value — wrap it in a strong tag set in DISPLAY at 1.15rem with tabular-nums and full-alpha LUMEN, so "Diamètre — 42 mm" carries a display numeral inside a body sentence. That one rule is the entire museum-label effect and what makes a spec table look expensive. Row hover, desktop only: background rgba(lumen,.03) and the term turns ACCENT over .35s. The last row drops its border-bottom; the table closes on a 1px rgba(accent,.4) rule instead. LEADER VARIANT for short lists such as provenance: a flex row whose middle child is a 1fr element with border-bottom 1px dotted rgba(lumen,.24) translated -.32em, term on the start side, value on the end. Use it once.
- INPUTS: background rgba(lumen,.045), border 0, border-bottom 1px rgba(lumen,.26), radius 0, padding .95em .2em, min-height 3rem so the tap target clears 48px on a phone, 1.02rem, colour LUMEN, caret-color ACCENT. Focus changes three things over .40s: background to rgba(lumen,.075), border-bottom-color to ACCENT, and a ::after 1px accent line growing scaleX(0) to scaleX(1) from the inline-start edge over .45s. Placeholder rgba(lumen,.32). Override autofill with box-shadow inset 0 0 0 100px in the input's own background colour so the browser never paints a blue field into the room. Labels sit ABOVE at LABEL .66rem/.26em uppercase rgba(lumen,.5), margin-bottom .55rem, ENGRAVED (see Conversion objects). Selects match exactly and carry a drawn 10x6 accent chevron at the inline-end, rotating 180deg on focus over .3s. Never a native unstyled select.
- THE PLINTH, reusable: NOIR-2, clip-path polygon(6% 0, 94% 0, 100% 100%, 0 100%), 1px rgba(lumen,.18) top edge, a 178deg raking sheen on its face — under hero objects, under the register's title, and as the weld in LE SOCLE seams.
- THE FOOTER (LE COLOPHON): NOIR, border-top 1px rgba(lumen,.14), padding-block clamp(4rem,9vh,6.5rem). A zero-row-gap definition grid of contact facts (two columns, rows separated by hairlines, LABEL terms on the start side, values on the end), then THE MONUMENT — the wordmark at clamp(4rem,17vw,15rem), line-height .84, letter-spacing +.08em, colour transparent, -webkit-text-stroke 1px rgba(accent,.5), user-select none, aria-hidden, centred, bleeding past the container. Then a hairline-topped row: links at .68rem/.22em uppercase in rgba(lumen,.55), a credit line at .62rem in rgba(lumen,.34).
- CRAFT DETAILS: aria-live polite on validation and status text; an output element for the stepper; sr-only text for icon-only controls; a skip link; an inline-SVG data-URI favicon drawn from the claw-mark shape; a theme-color meta following the active room.

## Conversion objects (this world SELLS — these are its money components)
- THE PRICE AS A TYPOGRAPHIC JEWEL. A baseline-aligned inline-flex at gap .5em inside a padding box of clamp(1.1rem,2.5vw,1.8rem).
  - The numeral: DISPLAY 400 at clamp(2.8rem,5.2vw,4.4rem), tabular-nums, LUMEN, letter-spacing -.01em.
  - THOUSANDS ARE SEPARATED BY A NARROW NO-BREAK SPACE, written as the entity &#8239; so it survives copy-paste and never wraps: 12&#8239;500 renders as 12 500. Never a comma, never a period, never a plain space. It governs the price, the total, the sticky bar and every promoted numeral.
  - The currency: LABEL 600 at .22em of the numeral, uppercase, letter-spacing .26em, rgba(lumen,.55), on the numeral's baseline via align-self flex-end and padding-bottom .34em. A micro-label, never a superscript.
  - THE ONE ACCENT SUPERSCRIPT: a single footnote mark after the numeral at .30em, top -1.1em, ACCENT — and FUNCTIONAL, a real anchor to the note below stating in one sentence what the price includes.
  - THE SETTING (le chaton): four claw marks framing the price box — 1px ACCENT L-brackets, arm 1.4rem, opacity .7, drawing in via scaleX/scaleY from 0 over .5s staggered .06. The price is set like a stone, in the stage's shape at a smaller scale.
  - A struck was-price if the brief has one: 1.15rem, rgba(lumen,.5), line-through with text-decoration-color ACCENT at thickness 1px. NEVER a percentage-off badge or starburst. Under it the PROVENANCE NOTE at .74rem rgba(lumen,.46): "Vous payez à la livraison. Aucun paiement en ligne."
- THE STICKY ORDER BAR (la cimaise mobile) — minimal by design: silhouette, price, Acquérir. Fixed, inset-inline 0, bottom 0, z-index 95, height 4.4rem plus env(safe-area-inset-bottom) as padding-bottom, background rgba(noir,.86), backdrop-filter blur(18px), border-top 1px rgba(lumen,.14), radius 0, NO shadow, grid auto 1fr auto at gap .9rem and padding-inline clamp(1rem,4vw,1.4rem).
  - START, THE SILHOUETTE: a 2.6rem square plate of rgba(lumen,.05) with a 1px hairline holding the object's first frame at object-fit contain, filter brightness(.92), alt empty and aria-hidden. The object, small, still in its case.
  - CENTRE: the price in the jewel formula at small scale — DISPLAY 400 1.18rem tabular-nums with thin-space thousands, DZD micro-label at .58em/.20em rgba(lumen,.55). No struck price, no note.
  - END: the primary button, small variant — .72rem/.20em, padding .85em 1.35rem, min-width 8.2rem, label "ACQUÉRIR". It scrolls to the form; it never opens a modal.
  - It enters from translateY(100%) to 0 over .55s when ScrollTrigger passes the hero's bottom edge, AND IT RETREATS: when the form is in view it slides back out over .45s, because a bar must never cover the thing it points at. Desktop above 900px: a floating plate rather than a full-bleed bar — max-width 34rem, margin-inline auto, inset-inline 0, bottom 1.2rem, 1px hairline all round. In the white cube every token inverts with the page.
- THE ACQUISITION RITUAL (the COD form) — the climax of the page. Chapter grid .84fr/1.16fr: a STICKY OBJECT COLUMN at top 5.2rem (the stage's first frame, its cartel, the price in miniature) beside the form; below 900px the object column comes first and goes static. The form sits on a NOIR-2 plate with a 1px hairline, radius 0, padding clamp(1.8rem,4vw,3rem), max-width 34rem, staged in THREE NUMBERED STEPS.
  - THE STEP MARKERS: roman numerals I. II. III. in DISPLAY at 1.5rem, ACCENT, in a left gutter of 3.2rem, with a 1px rgba(lumen,.16) vertical thread running from one marker to the next — the ritual's spine. Each step's title sits beside its numeral in LABEL .68rem/.26em uppercase rgba(lumen,.62). In Arabic those become Eastern Arabic numerals in the same display face.
  - STEP I, L'IDENTITÉ: THE PHONE COMES FIRST, then the full name — the market's field-order law holds inside the ritual, because the number is the merchant's only real channel and a visitor who abandons after one field has still left something usable. THE PHONE FIELD exactly: type="tel" inputmode="tel" autocomplete="tel" pattern="[0-9 ]{9,14}", a hint naming the format 0X XX XX XX XX, and dir="ltr" on the field itself so the digits never reverse on an Arabic page. This world OVERRIDES the global "inputmode numeric" hint here — inputmode tel raises the keypad this market expects. Then the full name (autocomplete name, minlength 3), its label naming who signs for the parcel.
  - STEP II, LA DESTINATION: the wilaya select (all 58, styled identically, with the drawn accent chevron — never free text), commune and address as a 2-row textarea, an optional landmark line at a smaller measure.
  - STEP III, L'ACQUISITION: quantity as a STEPPER, not a number input — two 2.8rem SQUARE buttons at 1px hairline, radius 0, with an output element at min-width 3rem in DISPLAY 1.2rem tabular-nums between them; buttons invert to LUMEN fill with NOIR glyph over .3s on hover, rgba(lumen,.26) when disabled. The cap is REASONED in the hint: "Deux par foyer, pour que l'édition circule." Delivery choice is RULED ROWS, not cards: a full-width label row, border-bottom 1px hairline, padding 1rem 0, driven by :has(input:checked) — background to rgba(accent,.05), the 2px accent bar on the inline-start edge, and a 1.05rem SQUARE check box whose inner accent square goes scale(0) to scale(1) over .3s. Squares, never circles.
  - ENGRAVED LABELS, the ritual's tactile signature: every form label and step title carries a two-line incision shadow, text-shadow 0 1px 0 rgba(0,0,0,.55), 0 -1px 0 rgba(lumen,.06). One shadow below and one above is what the eye reads as CUT INTO the surface. In the white cube it flips to 0 1px 0 rgba(255,255,255,.7), 0 -1px 0 rgba(ink,.10).
  - THE DÉCOMPTE (the foot) — and the DELIVERY FACTS LIVE HERE, next to the submit, never in an FAQ and never below the fold. Above the rule, two ruled lines written the instant a wilaya is chosen: the delivery FEE and the delivery DELAY for that wilaya, term in LABEL .66rem/.26em uppercase rgba(lumen,.5) with the value in DISPLAY 1.05rem tabular-nums, each cross-fading over .40s on change. Both come ONLY from the brief; when the brief prices no zone, the line reads the brief's single flat term instead and no per-wilaya number is invented. Then border-top 1px rgba(accent,.45), padding-top 1.4rem, space-between — "TOTAL À LA LIVRAISON" at .68rem/.26em uppercase rgba(lumen,.5), and the total in the jewel formula at 2rem with tabular-nums and thin-space thousands. It recomputes on every quantity and delivery change with a .40s opacity blink from 1 to .35 to 1 — NOT a count-up. A total that counts up reads as a slot machine.
  - VALIDATION IS BLUR-GATED: a touched map so an error appears only after a field's first blur. Errors are complete sentences in CARNELIAN at .74rem with min-height 1.15em reserved so nothing reflows, and the field's border-bottom turns CARNELIAN. aria-live polite, aria-invalid and aria-describedby wired properly.
  - SUBMIT: the primary button full-width inside the form (the one legal full-width CTA), label "ACQUÉRIR", holding a deliberate 750ms pending state with the label replaced by a present-tense sentence ("Enregistrement…"), then the quiet success state.
- THE QUIET SUCCESS STATE — the world's most distinctive conversion moment. No confetti, no green tick, no bounce. THE LIGHTS DIM ON THE FORM AND COME UP ON THE RECORD.
  - The form's opacity goes to 0 over .50s while a panel absolutely positioned over it inside the same box fades in over .80s with a .30s delay; the form takes visibility 0s .50s so focus never lands on a hidden control. The plate's height is never animated — both states share one box. And at the instant validation passes — as the lights dim — the acquisition is entered in the registry: the page dispatches the wandit:lead CustomEvent on document with the buyer's fields flat in detail (name, phone as written, wilaya, commune, plus quantity and delivery choice), while one off-canvas decoy input marked data-wandit-hp stands off-stage in the form, never read by the page's own script.
  - The panel is darkness with one small pool (the radial formula at 40 percent scale) centred behind a single element: THE ACQUISITION NUMBER in DISPLAY 400 at clamp(2.4rem,5vw,3.4rem), tabular-nums, LUMEN, with the four CLAW MARKS drawing in around it over .60s staggered .07 at arm 2.2rem — the largest instance of the world's silhouette. One GSAP move on the numeral: fromTo({scale:.94,autoAlpha:0},{scale:1,autoAlpha:1,duration:1.1,delay:.35,ease:"expo.out"}).
  - Above it "ACQUISITION ENREGISTRÉE" in ACCENT at .68rem/.30em uppercase. Below it, the buyer's own order rendered AS A CARTEL in the exact cartel format — the name line, then a spec line of accent-middot fields reading their name · wilaya · quantity · total. The customer's order becomes a museum label. That is the payoff of the whole world and it costs twenty lines of markup.
  - Below the cartel, the WhatsApp ghost button so the buyer can confirm in one tap. PERSIST IT: store the order in localStorage and, on return, paint the success state INSTANTLY with no animation so a returning buyer is never asked to order twice.
- THE WHATSAPP CTA, styled to the world and NEVER green: the GHOST button with a hand-drawn inline SVG glyph at 15x15 in ACCENT — stroke 1.4, stroke-linecap and stroke-linejoin round, fill none, a circle outline with a small tail triangle at its lower-start corner and a handset path inside. Gap .7em, glyph on the inline-start side. Label "Commander sur WhatsApp" or, in the world's voice, "Écrire au conservateur". Href is the brief's wa.me link with a prefilled text parameter naming the object's inventory reference.
- THE TRUST STRIP (le bandeau) — full-bleed on NOIR-2, border-block 1px rgba(lumen,.12), padding-block 1.6rem, a 4-column grid at gap clamp(1.4rem,3vw,3rem), collapsing to 2x2 below 720px. Each cell: a 22x22 inline SVG icon YOU draw — stroke 1.2, stroke-linecap and stroke-linejoin round, fill none, stroke ACCENT, opacity .85 — then a LABEL .68rem/.24em uppercase line and a .78rem rgba(lumen,.5) sub-line. Draw exactly these four; no emoji, no icon font, nothing filled:
  1. PAIEMENT À LA LIVRAISON — a 14x10 banknote rectangle with a 3.2-radius circle centred inside it.
  2. LIVRAISON 58 WILAYAS — a truck: a 13x7 body box, a 6x5 cab welded to its end, two 2.2-radius wheels below.
  3. ÉCHANGE SOUS 7 JOURS — a circular arrow: an arc sweeping from 20 to 80 percent of a 9-radius circle, closed by a 3-unit chevron head.
  4. AUTHENTICITÉ — a certificate seal: an 8-radius circle with two 5-unit ribbon tails crossing below it, or an 8-point shield outline with a 3.5-unit check inside.
  The sub-lines are FACTS from the brief — delivery window, exchange terms, guarantee length — never adjectives.
- CROSS-SECTION LINKS: the hero CTA, the sticky bar and the register's foot all scroll to the acquisition chapter, respecting scroll-margin-top 4.2rem. A variant chosen anywhere on the page pre-selects the matching radio row in the form.

## Editorial furniture (REQUIRED — this is the vitrine's voice)
- LE CARTEL, specified above — furniture and component at once, and the most important thing on the page after the object.
- N° D'INVENTAIRE: every room carries a reference in ACCENT at .64rem/.32em uppercase at its top-start corner — "INV. 2026.04.11" or "RÉF. AL-0142". It is TYPESETTING: invent the format, never the facts around it.
- SALLE 01 / 05: the live room counter in the rail.
- LA NOTICE: exactly one longer paragraph on the page, max-width 34em, BODY .96rem/1.75, opening with a DROP CAP — the first letter in DISPLAY at 3.4em, float inline-start, line-height .82, margin-inline-end .12em, margin-block-start .10em, in ACCENT. One drop cap per page, never two.
- LA PROVENANCE: three or four leader rows giving origin, maker, date and run size — where the register's LEADER VARIANT earns its place.
- L'ÉCLAIRAGE: one technical footnote at the foot of a room, .62rem/.26em, rgba(lumen,.34), the page describing its own lighting: "Éclairage · un point, 45°, diffusé" or "Prise de vue · fond continu, sans retouche". The deepest museum move available, and it costs one line.
- LE CONSERVATEUR: the merchant's voice, once, in the white cube — one or two flat sentences with no adjectives, signed with a name in ACCENT at .68rem/.26em uppercase.
- FIG. CAPTIONS under any framed image carrying no cartel: a space-between row, descriptive text on the start side in rgba(lumen,.44) at .74rem/.06em, the figure number in ACCENT on the end side.
- The facts rail's four micro-labels: real facts (material, dimension, edition, delivery), never adjectives.
- None of these invent a business fact. They are typesetting. Fill them from the brief.

## Shot list conventions (this world spends its image budget on ONE object)
The walk only works if the frames are consistent, so the SHOT LIST is written as a camera move, not as four different photographs. Spend 4 or 5 of the 6 permitted images on the single product:
- Frames 1-3: THE SAME OBJECT, same lighting, same distance, same background — only the camera moves. Ask explicitly for a seamless near-black backdrop; one key softbox at 45 degrees camera-start-side plus a subtle rim from behind the opposite side; the object centred with roughly 15 percent margin on every side; no props, no hands, no text, no watermark, no studio reflections. Then name the angles: front / three-quarter / profile (or front / three-quarter / back).
- Frame 4: THE MACRO — one extreme close-up of the material, clasp, stitch, engraving or finish, same lighting family.
- Frame 5: THE WHITE CUBE — the same object in daylight on a neutral white seamless, or worn and held in a real place, soft shadow to one side. The only cover-cropped image on the page.
- IF AN IMAGE ROLE FAILS OR image generation is unavailable, the stage still ships: keep the ENTIRE light stack (wash, pool, floor spill, contact shadow, glass, claw marks) and put a LABELLED IMAGE SLOT where the object goes — a rgba(lumen,.05) plate at the stage's exact aspect-ratio with a 1px rgba(lumen,.14) hairline and one LABEL micro-caps line naming what belongs there ("PHOTO PRODUIT · FACE · FOND NOIR CONTINU"), so the merchant can drop the real photograph in without touching a single number. Never draw a fake product, a silhouette or an illustration to fill the hole — the global ban on invented imagery holds. A stage is never left empty, and a missing image never becomes a missing section.

## Arabic and RTL adaptation
- dir="rtl" on the html element, logical properties throughout (padding-inline, margin-inline, border-inline-start, inset-inline); every asymmetric grid mirrors automatically.
- CRITICAL: ARABIC IS NEVER LETTER-SPACED — spacing breaks the shaping of joined script. Every micro-caps rule in this document (.20em, .24em, .26em, .30em, .32em, .34em) drops to 0 in the Arabic build, and text-transform uppercase is REMOVED. The signage register is carried instead by three substitutions: size +2px, weight +100, and rgba(lumen,.5) becoming ACCENT. Scope all of it under html[lang="ar"].
- Line-height goes UP: body 1.9, cartel spec line 1.8, table values 1.75. Arabic ascenders and descenders need the room, and a dark ground makes tight leading worse.
- Faces: an Arabic display face in the Amiri, Aref Ruqaa, Noto Naskh Arabic territory for names and the price; an Arabic UI face in the IBM Plex Sans Arabic, Cairo, Almarai territory for labels. Never stretch one Latin face across both scripts.
- Numerals: keep Western Arabic digits (0-9) for prices and the phone field — that is what Algerian commerce uses — with the same narrow-no-break-space thousands. The step markers switch to Eastern Arabic numerals; the currency label becomes the Arabic form at tracking 0.
- The middot separator survives intact in Arabic typography; keep it. The claw marks are symmetric and mirror for free. The marginalia rotates 180deg to read correctly on the mirrored edge. The mobile snap rail's direction reverses automatically; author the frames so the front view is FIRST in DOM order regardless.
- Because this world uses no italics, the Arabic page is typographically identical to the French one. That is a design choice, not an accident.

## Explicit overrides of the global builder rules (each is already argued above — this is the roll-call, and every one must be declared in an HTML comment beside the code that does it)
1. Global: mid-radius rounded containers. HERE: radius ZERO everywhere; the single build-wide CTA shape (0 or 999px, chosen once) is the only exception.
2. Global: shadows are permitted as a depth device. HERE: exactly two species — the drawn contact-shadow ellipse and the drop-shadow filter on contained objects. Zero box-shadows on cards, panels, buttons, inputs, the rail or the bar; the primary CTA's 1px accent ring is an outline, not a shadow.
3. Global: hover lifts. HERE: nothing translates on hover — interactive surfaces GAIN LIGHT (background alpha +.04-.06, border to accent) over .40s, and the primary button widens its tracking .20em to .24em inside a fixed min-width.
4. Global entrance band .9-1.4s and the global ambient band of 3-4s (including the 4s breathing product glow). HERE: entrances run 1.2-1.8s with a 2.4s hero arrival, and the single ambient loop is a 5.4s opacity-led lamp settle, not a 4s pulse — the room is slow on purpose and its light varies in brightness rather than in size.
5. Global: inputmode numeric on the phone field. HERE: inputmode tel, the keypad this market expects.
6. Global: no hand-drawn SVG illustrations. HERE: the four trust icons, the WhatsApp glyph, the select chevron and the favicon are DRAWN inline SVG in the world's stroke language — they are UI marks, not imagery. The ban still holds absolutely for anything standing in for a PHOTOGRAPH: no drawn products, no silhouettes, no mascots, no logos, no illustrated scenes. A missing photo becomes a labelled image slot, never a drawing.
7. Global: count-up numerals on stats and prices. HERE: the price counts up ONCE on arrival; the live total NEVER counts up (it blinks 1 to .35 to 1 over .40s), because a total that spins reads as a slot machine.
8. Global: at most ONE hairline seam per page. HERE hairlines are the structural material of every rule, table and frame — but as a SECTION BOUNDARY the global cap of one holds, and LA CIMAISE is that one.
9. Global: one italic (or colour-accented) word inside a big headline. HERE: no italic exists anywhere — emphasis is the ACCENT colour, a size step, or a move into the micro-caps register, which is what makes the Arabic build typographically identical to the French one.

## Vitrine ban list (in addition to the global one)
More than one object in any viewport · product grids of any kind, including repeat(auto-fit,minmax()) card rows · object-fit cover on the product · a carousel with dots and arrows (the walk replaces it) · a lightbox · pure #000 ground or pure #FFF text or rules · any border-radius other than the one chosen CTA shape · box-shadows on cards, panels, buttons, inputs, the rail or the bar (the CTA's 1px ring is an outline, not a shadow) · glassmorphism; backdrop-filter is rationed to exactly two elements · neon or fully saturated accents — the accent is a metal · countdown timers, percentage-off starbursts, "STOCK LIMITÉ" banners, fake urgency of any kind · exclamation marks · emoji, icon fonts, filled icons, three-column feature cards · italics · centred running prose · letter-spacing on Arabic · per-character text splitting · more than ONE ambient loop · more than TWO scrubs · more than ONE pin, and NEVER a pin below 900px · a hero without a price · any hidden state authored in CSS · a cartel wrapped in a card · a spec table without promoted numerals · a success state that celebrates.

## Intensity
This world fails by being merely DARK. A near-black page with a product photo and gold text ships every day; it is not this world. The difference is entirely physics: light that arrives before the object, a pool that breathes on four seconds and TRAVELS between rooms, an object contained and shadowed rather than cropped, four fields in a fixed order under every view, numerals promoted to the display face inside body sentences, a price held in claw marks, and a form that dims its own lights and hands back the buyer's order as a museum label.

Executed at 60 percent — dark background, gold accent, rounded cards, a product grid, a green WhatsApp button — this is exactly the generic dark landing page it exists to replace. Executed at 100 percent, a visitor scrolling on a phone in Algiers feels let into a closed room after hours to look at one thing properly, and then quietly told they can have it, and pay when it arrives. Push INTO the darkness and the discipline. Every number above is load-bearing.`,
	energy: "quiet",
	id: "vitrine",
	industries: [
		"jewelry",
		"watches",
		"perfume",
		"cosmetics",
		"beauty",
		"fashion",
		"accessories",
		"gadgets",
		"tech",
		"art",
		"crafts",
		"home-decor",
		"photography",
		"optical",
	],
	kind: "cod",
	mood: ["dark", "precious", "hushed", "curated", "exacting"],
	name: "Vitrine",
	priceFeel: "premium",
	tagline:
		"Your product alone in a dark room, standing in its own pool of light with a museum label underneath — the visitor walks around it as they scroll, and the price is set like a stone in four gold brackets.",
};
