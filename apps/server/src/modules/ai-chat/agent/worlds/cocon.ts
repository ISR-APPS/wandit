import type { DesignWorld } from "./types";

/**
 * COCON — dewy ritual softness for skin, hair and hammam.
 * Light is the material: two or three large pastel radials stand in for every
 * flat background, texture macros dissolve into the cream ground instead of
 * ending, ingredients get provenance plates, and the routine — matin / soir —
 * is the page's journey. The order form is a soin, not a checkout. The doc is
 * appended VERBATIM to the builder system prompt.
 */
export const cocon: DesignWorld = {
	avoidFor: [
		"auto",
		"tools",
		"gaming",
		"industrial",
		"construction",
		"logistics",
	],
	doc: `# DESIGN WORLD: COCON — the dew ritual

## Philosophy
This page is a RITUAL, written in light. It sells something a person puts on their skin in a quiet bathroom at 7am or 11pm, so the page has to feel like that room: warm air, condensation on a mirror, a jar with the lid off, one lamp. Nothing on it is sharp, nothing on it is fast, and nothing on it has a hard edge — not the images, not the sections, not the buttons, not the order form.

The organising idea is that LIGHT IS THE MATERIAL. Every ground is two or three enormous soft radial gradients — dew — never a flat fill. Every photograph dissolves into that ground instead of stopping at a rectangle. Every frame is an arch or an oval. The result is a page with almost no visible boxes: content floats in a lit room, and the only firm lines are hairlines you can barely see and one accent thread.

Structurally this is a vertical stack with one sticky-split showpiece — deliberately. The distance between this world and a generic wellness template is not layout gymnastics but forty decisions: dew instead of fills, dissolves instead of edges, arches instead of radii, provenance plates instead of feature cards, a matin/soir state machine instead of a static page, blur-and-settle instead of masked cuts, ruled lines instead of input boxes, and copy written by somebody who actually made the thing and is slightly embarrassed to sell it. The failure mode of this world is TIMIDITY WITHOUT CRAFT.

The price register is a soin you buy for yourself twice a month: gentle numbers worn with complete confidence. This world never does discount typography — no red badges, no screaming strikethroughs, no countdown. It states a price the way a good pharmacist does: once, calmly, and moves on.

## The vibe
Made in small batches, by somebody who smells the batch before it ships. Attentive, tender, unhurried, clean without being clinical. Copy rules, non-negotiable — they carry 40 percent of this world:
- Headlines are SHORT and sensory, six words or fewer, and at least one carries a gesture verb: "Le matin commence ici." / "Deux gouttes, puis on respire." / "La peau boit d'abord."
- Every product claim is attached to a MATERIAL or a GESTURE, never to an adjective: not "hydratation intense" but "de l'huile de figue de barbarie, pressée à froid, deux gouttes le soir".
- Every instruction is written as a gesture with a duration: "Chauffez une noisette entre les paumes. Trente secondes."
- Validation errors are gentle full sentences that give a reason: "Il nous faut votre nom pour écrire sur le colis." / "Un numéro à dix chiffres — c'est le seul moyen qu'on a de vous prévenir avant de passer."
- ONE unexplained line somewhere in the page: a single serif sentence on the bare dew field, no heading, no button, no explanation.
- Banned words everywhere: solutions, miracle, révolutionnaire, transformez, expérience, premium, secret, magique, and their English and Arabic equivalents.
- Write in the brief's language. In Arabic the same rules hold; Arabic has no italic, so the "soft voice" fragments are carried by the accent colour plus a lighter display weight, never by a slanted face.

## The dew law (do this FIRST — everything else in this world depends on it)
NO ELEMENT ON THIS PAGE MAY HAVE A FLAT BACKGROUND-COLOR ALONE. Every ground — the body, every scene, the order chapter, the footer, the mobile bar — is a base colour PLUS at least two large soft radial gradients. Build it once, reuse it everywhere:
- Body base: the cream ground. On top, a fixed pointer-events-none layer at z-index 0 holding radial-gradient(58vw 48vw at 14% 4%, blush at .55 alpha, transparent 62%) and radial-gradient(74vw 62vw at 52% 106%, cream-deep at .8 alpha, transparent 70%).
- TWO of the radials live in the DOM as real divs (.dew-a and .dew-b): width 62vw, aspect-ratio 1, border-radius 50%, background radial-gradient(circle at 50% 50%, the pole at .5 alpha, transparent 68%), position fixed, z-index 0 — elements, so GSAP can drift them with transforms only.
- NEVER apply filter: blur() to a full-viewport layer. The transparent gradient stops do the softening; a blurred fullscreen layer repaints every frame and this world scrolls a lot.
- Every scene declares its OWN local dew: one or two radials at 40-70 percent of the body's opacities, positioned from that scene's composition (behind the product, under the headline, in the corner the arch leans toward). A scene with a plain background-color is a bug here, exactly like a detached grey. Content sits at z-index 1 or above; the dew never covers content.

## Visual signatures (what makes it instantly recognizable)
- A page with no visible rectangles. Arches, ovals and capsules only; the softest thing on screen is also the most structural.
- Texture macros — cream, gel, foam, clay, oil, wet hair, steam on tile — full-bleed and EDGELESS: their bottom 18-24vh dissolves into the cream ground through a gradient whose final stop IS the next scene's background. An image never ends. It evaporates.
- LA GOUTTE, a drawn dew drop, is the traveling motif and appears in at least seven places: the routine step bullets, the trust-badge glyph, the sensorial-line separators, the accordion icon, the scroll cue at the end of the hero, the input-focus dot, and the success panel.
- Ingredient provenance plates: an oval macro, a name, an origin, a function. Three lines of type and a circle — repeated six to nine times, staggered vertically like drops running down glass.
- The ROUTINE: a matin/soir sticky-split where a numbered list of gestures scrolls past a pinned product that changes with each step. This is the showpiece and it gets triple the ambition of any other scene.
- A breathing glow behind the product, 6.5 seconds per breath — slower than any other world's ambient loop, because this page exhales.
- The nav does not sit in a bar; past 48px it MORPHS into a floating cream capsule with an 18px blur behind it.
- The order form has no input boxes at all — only soft ruled lines that turn rose and grow a dew drop when you focus them.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — CREAM→--background · INK→--foreground · ROSE→--primary · CREAM→--primary-foreground · CREAM-DEEP→--secondary · BOTANICAL→--accent · ink at 56%→--muted · ink at 12%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, dew or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
Build ten tonal roles from the fixed tokens. Never introduce an eleventh hue, and never introduce a neutral grey of any kind.
- CREAM (the ground): the palette's lightest warm pole, in the #FBF6F1 register. Never #ffffff, never #fafafa, never a cool white.
- CREAM-DEEP: the same cream warmed and darkened 3-4 percent, the #F4EAE2 relationship. It is the alternation ground, the final stop of every dissolve, and the ground of the order chapter.
- BLUSH: the palette's rose pole at its lightest, the #EBCDC7 register. BLUSH IS LIGHT, NOT PAINT — it appears in dew gradients, glows and one panel tint, and it is NEVER a text colour and never a button fill.
- ROSE (the accent) plus ROSE-DEEP (its hover/active sibling): the #C98B84 / #A96C66 relationship — a clay rose with enough weight to be read at 12px. This is the only hue that ever touches type as a colour.
- BOTANICAL: a muted sage or eucalyptus, the #A9B8A4 register. It is the second light pole (the cool side of the dew), the provenance tint and the "natural composition" mark. Optionally BOTANICAL-DEEP (#6F8069 register) for micro-type on cream when the brief's product is herbal rather than floral.
- INK: a warm mauve-brown near-black where R is greater than B is greater than G, the #2E2422 relationship. Never #111, never a slate, never pure black.
- INK AT ALPHA — the rule that keeps this page made of light rather than of UI: body text rgba(ink,.74), tertiary and captions rgba(ink,.56), ALL hairlines rgba(ink,.12) (softer than most worlds — a .16 hairline reads as a border here), strong rules rgba(ink,.22), placeholders rgba(ink,.34), disabled rgba(ink,.30). No independent grey hex exists anywhere on this page.
- DUSK: the deep pole for the single inverted scene — a deep plum-brown or deep botanical in the #33292E register. NEVER black, never navy. Dusk is a dimmed room, not night.
- CREAM-ON-DUSK: a dedicated warm cream (#F6EDE6 register) used for ALL text on dusk grounds, with hairlines at rgba(cream-on-dusk,.16). White is never used for text anywhere on this page.
- CLAY (error) is not another hue: validation uses a contrast-safe color-mix between var(--primary) and var(--foreground), and it appears nowhere else.

THE ACCENT'S TWELVE JOBS — use at least nine: the dew-drop motif fill · the active routine numeral · the input focus rule and its dot · the ::selection background at .22 alpha · the price currency mark on hover states and the strike on a was-price · the focus-visible ring · the trust-badge stroke · the primary CTA fill · the WhatsApp glyph stroke · the founder-note quote glyph · the segmented-control thumb label · the closing wordmark tint. An accent that only fills a button is a failed palette.

THE MOMENT MACHINE (strongly recommended, and free with the routine) — scope MATIN and SOIR overrides of the applicable fixed tokens under a body data-moment attribute; never create dew-named color properties. MATIN mixes var(--primary) and var(--accent) over var(--background) at .55/.34 alpha. SOIR mixes var(--accent) toward var(--foreground) over var(--secondary) at .42/.26 — the room dims, it does not go dark. Implement it as two stacked children inside each dew div cross-fading their opacity over 1.6s, never as a background-color transition. Its blast radius must reach five places: the dew field, the routine media set and caption, the nav capsule tint, the pre-selected moment radio in the order form, and the theme-color meta. Persist in localStorage and restore on load with a .no-anim class on html for the first 120ms so the restore does not animate.

## Typography system
TWO families, three jobs, no ambiguity. A third face is a mistake in this world.
- DISPLAY (300 and 400 ONLY): a light, high-contrast serif with rounded terminals and open bowls — the Cormorant Garamond / Playfair Display / Gilda Display / Italiana / Prata territory (never Fraunces, which the global font ban excludes as a display face). Headlines, the wordmark, prices, totals, step names, the order number, the closing monument. NEVER above weight 400. If the brief's face has no 300, use 400 and lift the size instead of the weight.
- BODY (300/400/500): a humanist sans with open apertures and slightly soft joints — the Jost / Hanken Grotesk / Karla / Work Sans / Figtree territory. Paragraphs, labels, micro-caps, nav, inputs, buttons, captions. WEIGHT 600 AND ABOVE IS BANNED ON THIS ENTIRE PAGE: emphasis comes from size, colour and space, never from bold.
- The DISPLAY face used at 300 in a large size, in rose, IS this world's italic. Where another world would set an accent fragment in serif italic, Cocon sets it lighter, larger by 1.04em, and in rose.
- Arabic: display in the Amiri / Aref Ruqaa / Reem Kufi territory at a lighter optical weight, body in the IBM Plex Sans Arabic / Noto Sans Arabic territory. Arabic NEVER receives letter-spacing (it breaks the joins) — set letter-spacing 0 on every Arabic element, raise sizes by 8 percent and line-heights by .15, and replace every uppercase micro-cap with a normal-case .82rem line in rose.

Scale (all clamp, all measured):
- Hero h1: clamp(2.9rem,7.2vw,6rem) / line-height 1.06 / letter-spacing +.012em / weight 300.
- Section h2: clamp(2rem,4.4vw,3.4rem) / 1.12 / +.01em / weight 300 / max-width 15em.
- h3 and step names: clamp(1.35rem,2.4vw,1.9rem) / 1.26 / +.005em / weight 400.
- Routine step numeral (outlined): clamp(3.4rem,7vw,5.6rem) / .9 / weight 300 / color transparent / -webkit-text-stroke .8px rgba(ink,.28).
- Price: clamp(2rem,3.4vw,2.9rem) / weight 300 / +.02em / tabular-nums.
- Body: 1.0625rem / 1.72 (this world breathes — 1.6 is too tight here) / 0.
- Micro-caps: .66rem to .78rem uppercase, tracking +.18em to +.28em, weight 500, in rgba(ink,.56) or rose.
- Closing wordmark: clamp(3.4rem,15vw,13rem) / .92 / +.08em / weight 300, FILLED in rgba(ink,.10) — not stroked. A hairline stroke is a hard edge and this world does not have hard edges.

THIS WORLD OVERRIDES THE GLOBAL TRACKING CONVENTION. Everywhere else, tracking goes negative as type grows. Here DISPLAY TRACKING IS POSITIVE AT EVERY SIZE — +.012em at the hero, +.01em at h2, +.005em at h3 — because a light rounded serif closed up reads cramped and anxious. Negative letter-spacing anywhere on this page is a bug. The only tight thing in Cocon is nothing.

NEVER LET A DISPLAY HEADLINE AUTO-WRAP. Break every h1 and h2 into explicit block-level line spans so the rag is authored, and reuse those spans as the stagger targets for the soft rise.

PROMOTE NUMERALS. In spec rows, composition lists and durations, wrap the number in a span carrying the display face at 1.25rem inside a .98rem body line, with tabular-nums: "Flacon — 50 ml" gets a serif numeral inside a sans sentence. Percentages in the composition list get the same treatment at 1.35rem. Target a display-to-micro ratio of at least 8:1 (96px hero against a 11px micro-cap); a generic page sits at 3:1.

## Page chassis
- NO ANNOUNCE BAR. This world does not shout above its own nav. If the brief has a shipping promise, it belongs in the hero reassurance line and the trust strip.
- HEADER: position fixed, top 0, inset-inline 0, z-index 100, padding .9rem clamp(1.4rem,5vw,5rem), background transparent over the hero, transition .8s with the shared ease.
- THE CAPSULE MORPH (the chassis signature): past 48px of scroll the header's inner row becomes a floating capsule — max-width 76rem, margin-inline auto, padding .55rem .6rem .55rem 1.2rem, border-radius var(--radius), background rgba(cream,.82), backdrop-filter blur(18px) saturate(1.05), box-shadow 0 16px 40px -26px rgba(rose-deep,.4) plus inset 0 0 0 1px rgba(cream,.6). Under data-moment soir the capsule tints to rgba(cream-deep,.84). Transition background, padding, box-shadow and max-width together over .8s. It never becomes a solid bar with a bottom border.
- WORDMARK IS A LOCKUP: display face 300 at 1.5rem with +.06em tracking, plus a baseline-aligned sub-label in the body face at .58rem, +.28em tracking, uppercase, rgba(ink,.55) — two registers inside one mark.
- Nav links .9rem weight 400 at rgba(ink,.78), going to full ink over .5s, each with a 1px rose underline that grows transform: scaleX(0) to scaleX(1) from the inline-start over .5s. One small rose pill CTA on the end. Below 860px the links disappear and only the wordmark and the pill remain — this world has NO hamburger and no full-screen menu overlay.
- THE VEIL: a fixed full-viewport grain at inset -30%, z-index 90, pointer-events none, opacity .045, mix-blend-mode multiply, background-image an inline SVG data URI of feTurbulence type fractalNoise baseFrequency 0.9 numOctaves 2, desaturated with feColorMatrix saturate 0, painted on a 220x220 rect at opacity .5. Four times finer than a paper world's grain — it should read as skin, not as newsprint.
- Global base: html and body overflow-x clip (mandatory — the texture chip, the provenance tag, the glow at 118 percent and the arch overlaps all bleed), scroll-behavior smooth, antialiased, text-rendering optimizeLegibility, color-scheme light. ::selection is rgba(rose,.22) with ink text. :focus-visible is a 2px rose outline at outline-offset 3px with border-radius var(--radius). A skip link sliding from top -4rem to top 1rem over .45s.
- THE COORDINATED NUMBERS — derive all three from the measured header, never guess them independently: header stack 4.6rem, so hero min-height calc(100svh - 4.6rem) with a 100vh fallback declared first; every sticky column offset top 7.2rem; scroll-margin-top 5.4rem on every anchored scene.

## Hero forms (pick the one the product calls for — every one of them dissolves at the bottom, none of them ends in whitespace)
1. LA ROSÉE (default). Grid .92fr 1.08fr — the MEDIA column is the wide one, which inverts the marketplace expectation — gap clamp(2.2rem,5vw,4.5rem), align-items center, min-height calc(100svh - 4.6rem), padding-block clamp(3rem,8vh,6rem) clamp(4rem,9vh,7rem), overflow clip.
LEFT COLUMN, max-width 34rem, and it OPENS ON THE HEADLINE — no eyebrow above it, ever. Order: the hand-broken h1; a rose micro-caps line UNDER the headline (this world's eyebrow arrives second); a lede at clamp(1rem,1.3vw,1.12rem)/1.72 capped at 28em; the SENSORIAL LINE (three micro words separated by 4px dew-drop glyphs — "fondant · non gras · sans parfum" — .72rem, +.2em, rgba(ink,.56)); the price row; a CTA row holding the rose pill and the quiet WhatsApp pill; and a .8rem reassurance line stating exactly what happens after submit. Seven differentiated pieces of information, none of them a bullet list.
RIGHT COLUMN IS A LIT STAGE, FIVE LAYERS, and the object is capped at width min(100%,29rem) — never a full-bleed photo slab:
- z0 the glow: position absolute, left 50%, top 46%, width 118%, aspect-ratio 1, translate(-50%,-50%), background radial-gradient(circle, rgba(blush,.62) 0%, transparent 64%), pointer-events none.
- z1 the arch frame: aspect-ratio 4/5, overflow hidden, border-radius 14rem 14rem 1.8rem 1.8rem, box-shadow 0 40px 90px -38px rgba(rose-deep,.38).
- z1a two absolutely stacked images cross-fading opacity 1.1s while the outgoing one goes to scale(1.04) over 1.6s.
- z2 THE TEXTURE CHIP — an oval macro of the product's actual texture (the cream on a fingertip, the gel in a spoon), 8.6rem, border-radius 50%, position absolute at bottom -2.2rem inline-start -2.6rem, ring box-shadow 0 0 0 3px cream plus 0 18px 36px -22px rgba(rose-deep,.35). This is the single most identifying object of the world. It always overflows the frame.
- z3 the provenance tag: a cream capsule at top 12%, inline-end -1.6rem, padding .45em .95em, border-radius var(--radius), 1px hairline, backdrop-filter blur(8px), .68rem/+.2em uppercase, naming the hero ingredient and its origin.
Under the stage a caption line at .78rem in rgba(ink,.56), centred, giving format and volume from brief facts.
The hero TERMINATES IN A DISSOLVE: its final 16vh is a linear-gradient(to bottom, transparent, cream 100%) welded to the next scene, and the scroll cue is a 1px vertical rose thread 4.5rem tall with a 5px dew drop at its end, the drop travelling 0 to 12px and fading over 2.6s ease sine.inOut, infinite. Never a bouncing chevron.
2. LE BAIN (immersive — for hammam, soap, hair masks, any product whose texture is the story). A full-bleed macro at min-height 92svh, the image at height 124% and top -12% inside overflow hidden (it funds the scrub). Scrim: linear-gradient(to bottom, rgba(dusk,.28) 0%, transparent 34%, rgba(cream,.55) 72%, cream 100%) — dark only where type sits, cream where the next scene begins. The copy lives in a CARTE: max-width 33rem, background rgba(cream,.74), backdrop-filter blur(12px), border-radius min(var(--radius), 2.2rem), padding clamp(1.8rem,4vw,2.8rem), at inset-inline-start clamp(1.4rem,6vw,6rem) and bottom 16vh, with the bloom shadow. An 11rem arch-C product plate hangs outside its top inline-end corner at margin -3rem. This is the only glassy panel allowed besides the nav capsule.
3. LE RITUEL (for a set, a coffret, a three-step routine). Centred copy at max-width 40rem — and choosing this hero SPENDS the page's one discretionary centred moment — then three arch frames at widths 1fr 1.12fr 1fr and heights 21rem / 26.5rem / 23rem, with margin-top offsets 2.6rem / 0 / 4rem so the row breathes like drops on glass, each with a dew-drop numeral caption at .72rem/+.22em. Below 780px they stack to one column at max-width 24rem, offsets removed.

## Section seams (Cocon's own vocabulary — every boundary uses one, never the same twice in a row; use at least five of the seven)
1. LE FONDU (the signature seam, and the reason this world exists). A full-bleed texture macro whose bottom 18-24vh is a linear-gradient(to bottom, transparent 0%, rgba(cream,.45) 42%, cream 100%) and whose top 10-12vh carries the inverse gradient from the previous ground. The photograph therefore has NO EDGE at all: it condenses out of the page and evaporates back into it. Use it at least twice per page, and always make the gradient's final stop the exact token of the next scene's ground — a mismatch of even 2 percent shows as a band.
2. LA BUÉE (the mist). A 9vh band between two grounds, filled with linear-gradient(to bottom, ground-A, ground-B) plus one wide low radial of blush at .3 sitting across the join, so two tones meet through fog instead of at a line. No rule, no shadow, no padding.
3. L'ARCHE (the arch rise). The incoming scene begins with a giant arch: border-radius 50% 50% 0 0 / 12rem 12rem 0 0, margin-top -6rem, position relative, z-index 2, so the new ground literally arches over the outgoing one. Use it exactly once, and use it to open the order chapter — the transaction should feel like walking through a doorway.
4. LE FIL D'EAU (the water thread). The one hairline this page is allowed, turned vertical: a 1px rose-at-.5 line, 6-9rem tall, margin-inline auto, with a 5px dew drop at its lower end, standing in for 8rem of empty space between two calm scenes.
5. LE REPOS (the rest). A scene with no heading, no eyebrow, no CTA, no image: one display line at clamp(1.5rem,3vw,2.3rem)/1.4 in rose-deep, max-width 20em, centred, on the bare dew field, padding-block 14vh. A generic builder puts three cards here. Do not.
6. LA PLAQUE (the overlapping plate). A provenance-plate row that straddles the boundary — margin-top -5rem, z-index 2 — landing on the previous scene's dissolving bottom so the ingredients appear to float out of the photograph.
7. LE MIROIR (the tone flip). Exactly once per page, a dusk scene: scope fixed-token overrides so the ground mixes var(--foreground) and var(--accent), type flips to a var(--background)/var(--secondary) cream mix, hairlines to that mix at 16%, and the arch frame inside it gets box-shadow 0 40px 90px -38px color-mix(in srgb, var(--foreground) 55%, transparent). It arrives through a BUÉE and leaves through a FONDU — never through a hard cut. Give it to the founder's note or the ritual-at-night scene.

## Layout physics
- ONE inline padding token: clamp(1.4rem,5vw,5rem). Container max-width 84rem. Scene block padding clamp(5.5rem,13vh,9.5rem) — the middle term is vh so the rhythm follows the viewport.
- NO GRID IS 50/50. Hero .92fr/1.08fr · routine .94fr/1.06fr (the sticky media narrow, the gesture list wide) · story scene 1.08fr/.92fr · order chapter 1.06fr/.94fr (the form wider than the plate) · founder note .84fr/1.16fr. At least one grid inverts expectation. Column gaps clamp(2.5rem,6vw,5.5rem).
- MEASURE IS CAPPED IN EM: body 33em, lede 28em, plate function line 15em, repos line 20em, form microcopy 30em, footnote 36em.
- SHAPE IS THE BRAND, AT FOUR SCALES: arch A 14rem 14rem 1.8rem 1.8rem (hero, 4/5) · arch B 9rem 9rem 1.6rem 1.6rem (routine media, 3/4) · arch C 5rem 5rem 1.4rem 1.4rem (order plate, 1/1) · oval 50% (provenance macros, texture chip, badges) · capsule var(--radius) (nav, chips, buttons, stepper; :root sets --radius: 999px). Below 600px arch A relaxes to 10rem 10rem 1.6rem 1.6rem. THIS WORLD OVERRIDES THE GLOBAL RADIUS HABIT: ordinary panels cap the token at their named 1.4-2.2rem treatment, and a uniform 12-16px radius everywhere is an outright failure. The single exception is the ruled form field, which has NO box and therefore caps the token at 0.
- THE DEW STAGGER: in any plate grid, nth-child(3n+2) gets margin-top 2.4rem and nth-child(3n+3) margin-top 4.2rem, cancelled below 700px. Grids in this world are never metronomes.
- PLATES, NOT CARDS. A provenance plate is an oval image plus three lines of type on the bare ground: no background, no border, no shadow on the text block. Where another world reaches for a card, reach for an oval and a caption.
- OVERFLOW IS COMPOSITION. Exactly four things deliberately break their container: the texture chip at -2.6rem, the provenance tag at -1.6rem, the glow at 118 percent, and the PLAQUE row at -5rem. Safe only because overflow clip sits on every scene containing them plus overflow-x clip on html and body.
- IMAGE OVERSCAN FUNDS MOTION: any scrubbed image is top -12% and height 124% inside overflow hidden, so parallax never exposes an edge.
- IF AN IMAGE ROLE FAILS or image generation is unavailable, the composition still ships intact: keep the arch, the glow, the dew and the caption, and fill the picture area with a LABELLED IMAGE SLOT — a rgba(blush,.28) field at the frame's exact aspect-ratio and radius, carrying one .68rem/+.22em uppercase rgba(ink,.56) line naming the shot ("PHOTO PRODUIT · FLACON · FOND CRÈME"). The texture chip and the provenance ovals degrade the same way, as tinted ovals with their label. Never draw a fake product, a leaf, a droplet illustration or a stock-flavoured stand-in to plug the hole — the global ban on invented imagery holds, and a missing photo never becomes a missing scene.
- ZERO-ROW-GAP DEFINITION LISTS for composition and specs: two columns at gap 0 clamp(2rem,5vw,4rem), rows separated by 1px hairlines, each row a space-between flex with a .7rem/+.22em uppercase term and a right-aligned display-face value with promoted numerals. One column below 600px with the value under the term.
- RESPONSIVE COLLAPSE: below 1024px every two-column grid becomes 1fr; below 900px the routine's sticky media goes static and takes order:-1 above the gesture list while the matin/soir capsule becomes sticky at top 4.6rem; below 700px the dew stagger is off, the trust strip becomes 2x2, and the mobile order bar appears.
- CENTRING IS RATIONED TO FOUR THINGS AND NO MORE: the REPOS line, the closing wordmark, the hero's one-line format caption under the stage, and ONE chosen moment (the RITUEL hero's copy block, or the founder's note, or the trust strip — pick one at the start of the build). Everything else is aligned to the flow start. Centred body copy is the fastest way to make this world look like a template.

## Motion identity (GSAP 3 + ScrollTrigger via CDN; native scroll — smooth-scroll libraries are unavailable)
THE SAFETY CONTRACT COMES FIRST AND IS NON-NEGOTIABLE. Compute one flag: reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, hasGsap = typeof window.gsap !== "undefined", animate = hasGsap && !reduced. EVERY hidden initial state — every autoAlpha 0, every y, every blur, every start scale — is set with gsap.set() INSIDE the animate branch, never authored in CSS. If the CDN fails or motion is reduced, the page is simply fully visible and fully functional: the dew stops drifting, the glow parks at scale 1, the routine shows all steps as active-legible, and the order form works.

THIS WORLD OVERRIDES THE GLOBAL MOTION DEFAULTS in four places:
1. gsap.defaults({ease:"power2.out", duration:1.35}) — not 1.1 with power3. Power3 has a fast head; this world has no fast heads.
2. NO MASKED LINE RISES. The global headline reveal (overflow hidden wrapper, yPercent 112 to 0) is banned: a mask edge is a cut, and Cocon has no cuts. The replacement is THE SOFT RISE — set lines to autoAlpha 0, y 18, filter blur(8px); tween to autoAlpha 1, y 0, filter blur(0px) over 1.5s with stagger .14. Restrict blur tweening to at most five elements per page (headline lines only), set will-change filter before and clearProps "filter,willChange" after.
3. NO CLIP-PATH WIPES. Images arrive by SETTLE: autoAlpha 0 and scale 1.07 to autoAlpha 1 (1.1s) and scale 1 (2.2s, power2.out) — de-synchronised, so the picture is visible while it is still settling.
4. Interaction feedback is .45-.65s, not .25-.45s. A button that answers in 250ms feels nervous in this room.

TIMING BANDS — every duration belongs to one: .45-.65s interaction · .7-.9s component state · 1.2-1.8s narrative reveals · 1.6s moment change · 2.2s image settle · 6.5s the breath · 22s and 27s the dew drift · 42s any marquee (and marquees are discouraged). ONE shared CSS easing token: cubic-bezier(.28,.72,.3,1), used by roughly twenty transitions. GSAP eases: power2.out for entrances and settles, power1.out for pure fades, sine.inOut for every loop, none for scrub. BACK, ELASTIC AND BOUNCE ARE BANNED OUTRIGHT — nothing in this world overshoots.

TRAVEL IS TINY: y of 12, 18, 26 and 40 only; x of 8 for a caption arriving beside a rule; scales of .97, 1.03, 1.04, 1.07, 1.09; hover lift translateY(-2px). Nothing on this page travels 100px.

The mandatory motion set:
1. HERO ENTRANCE — one timeline, overlapping positions, about 2.6 seconds of arrival. Sets: headline lines autoAlpha 0 / y 18 / blur 8px; the sub-block (micro-caps, lede, sensorial line, price, CTAs, reassurance) autoAlpha 0 / y 26; the arch frame autoAlpha 0 / y 40 / scale .97; its image scale 1.09; the texture chip and provenance tag autoAlpha 0 / scale .92; the glow autoAlpha 0 / scale .8. Then: tl.to(glow,{autoAlpha:1, scale:1, duration:1.8},0) .to(lines,{autoAlpha:1,y:0,filter:"blur(0px)",duration:1.5,stagger:.14},.2) .to(frame,{autoAlpha:1,y:0,scale:1,duration:1.6},.35) .to(frameImg,{scale:1,duration:2.2},.35) .to(sub,{autoAlpha:1,y:0,duration:1.2,stagger:.1},.9) .to([chip,tag],{autoAlpha:1,scale:1,duration:1,stagger:.12},1.5). The light arrives first, then the words, then the object, then the details.
2. THE BREATH (ambient, diegetic): gsap.to(glow,{scale:1.09, opacity:.85, duration:6.5, ease:"sine.inOut", yoyo:true, repeat:-1}). It is the product's own warmth on the paper, not a floating blob.
3. THE DEW DRIFT (the world's second ambient loop, and the only page allowed two): gsap.to(".dew-a",{xPercent:4, yPercent:-3, duration:22, ease:"sine.inOut", yoyo:true, repeat:-1}) and gsap.to(".dew-b",{xPercent:-5, yPercent:4, duration:27, ease:"sine.inOut", yoyo:true, repeat:-1}). Transforms only — never animate background-position or a filter on these.
4. GENERIC REVEALS on roughly sixteen elements: gsap.set({autoAlpha:0, y:26}) then to({autoAlpha:1, y:0, duration:1.35}) with scrollTrigger start "top 88%", once true, stagger .12 inside a group.
5. THE ROUTINE (the showpiece, and the page's scrubbed moment). The media column is position sticky at top 7.2rem — no ScrollTrigger pin, no layout jump. One ScrollTrigger per step with start "top 62%" and end "bottom 62%", onEnter and onEnterBack setting the active index: the active step's outlined numeral fills from transparent to rose over .7s while its stroke fades out, its body copy goes from rgba(ink,.5) to rgba(ink,.74) over .6s, and the sticky media cross-fades to that step's image over .9s. Beside the list runs the PROGRESS THREAD: a 1px rgba(ink,.12) vertical line with a rose fill at transform-origin top, scaleY 0 to 1, ease none, scrub .6, trigger the routine section, start "top 70%", end "bottom 80%" — and a 7px dew drop translated along it by the same scrub. This is the FIRST of the page's two scrubs; the FONDU parallax below is the second, and there is no third.
6. THE SECOND AND LAST SCRUB — ONE PARALLAX on the FONDU macro: gsap.fromTo(img,{yPercent:-7},{yPercent:7, ease:"none"}) with start "top bottom", end "bottom top", scrub true, funded by the 124 percent overscan. (If hero form 2 is used, that hero carries this instead and the interior macro stays still — never two parallaxes.) THE SCRUB CENSUS IS EXACTLY TWO on this page and they are named: the routine's progress thread and this parallax. A third scrub is a bug.
7. THE TRUST BADGES draw themselves on view: each ring is an SVG circle with pathLength 100, stroke-dasharray 101, stroke-dashoffset 101 to 0 over 1.2s power1.out, stagger .14, once true.
8. ONE COUNT-UP, on a composition percentage from the brief: tween a proxy {v:0} over 1.8s power2.out writing Math.round to textContent, start "top 90%", once — plus a 4000ms setTimeout fallback that paints the final value if the trigger never fires on a deep-linked load. Prices NEVER count up; a price that spins reads like a slot machine.
9. THE MOMENT CHANGE: the matin/soir cross-fade over 1.6s, plus the media set swap over .9s and the caption swap over .6s.
once:true on everything non-scrubbed. Nothing in this world re-animates on scroll-up.

MICRO-INTERACTION KIT (all CSS, all inside the bands):
- Primary pill: translateY(-2px) over .55s AND, separately, its bloom shadow growing from 0 14px 34px -18px rgba(rose,.5) to 0 20px 46px -20px rgba(rose,.6) over .6s. Two transitions, not one.
- Ghost pill: inset 0 0 0 1px rgba(ink,.16) going to inset 0 0 0 1px rose with rose text and a rgba(rose,.08) fill over .55s.
- Segmented matin/soir control: an ::after thumb at inset .32rem, width calc(50% - .32rem), sliding translateX(100%) over .62s with the shared ease, the labels flipping colour over .5s with a deliberate .06s delay so the type changes just behind the thumb.
- Ruled input focus: the rule grows 1px to 1.5px and turns rose, the label turns rose, and a 5px rose dew dot at the line's end fades in from scale .6 — three properties, .5s, one ease.
- Radio plates via :has(input:checked): the oval swatch gains box-shadow 0 0 0 1px rose and a rgba(blush,.35) fill over .5s, and the check drop scales 0 to 1 over .5s.
- Accordion: grid-template-rows 0fr to 1fr over .7s with an overflow hidden inner (the only correct way to animate to height auto); the icon is a dew drop rotating 180deg over .55s.
- Plate hover: the oval image swells scale(1.04) over 1.8s and a rgba(rose,.35) ring fades in over .6s. The plate itself never lifts.
- Reduced-motion block: beyond the blanket .01ms override, park the glow, stop both dew drifts, freeze the scroll-cue drop, and set the progress thread to scaleY(1).

## Components
- BUTTONS: capsules only — border-radius: var(--radius), never a rectangle, never full-width except the mobile bar's CTA and the form's submit below 600px. Primary: rose fill, cream-on-dusk text, padding 1.05em 1.9em, .95rem weight 500, +.02em, line-height 1, inline-flex gap .6em with a 5px dew drop as its glyph (which nudges translateX(4px) on hover, decoupled from the lift). Hover to rose-deep. Small variant .8em 1.4em at .86rem. Ghost as above. Disabled at opacity .4, cursor not-allowed, no lift. UI borders are inset box-shadows, not real borders, so nothing changes size on hover.
- SHADOWS ARE BLOOM, NEVER DEPTH. Every shadow on this page is large-blur, large-negative-spread, low-alpha and TINTED with rose-deep or dusk — never neutral black on light grounds: 0 40px 90px -38px rgba(rose-deep,.38) on the hero arch · 0 24px 56px -30px rgba(rose-deep,.32) on routine and order frames · 0 18px 40px -24px rgba(rose-deep,.30) on ovals and floating chips · 0 16px 40px -26px rgba(rose-deep,.4) under the nav capsule · 0 -18px 40px -24px rgba(rose-deep,.3) ABOVE the mobile bar. Zero shadows on text, plates, inputs, nav links or list rows.
- INPUTS ARE RULES, NOT BOXES (see Conversion objects). Selects and textareas are styled identically to them.
- PROVENANCE PLATE: oval macro at aspect-ratio 1 / border-radius 50% / overflow hidden with the bloom; the ingredient name in display 400 at 1.15rem; the origin in .66rem/+.22em uppercase rgba(ink,.56) with a rose dew-drop separator; the function in .82rem/1.6 rgba(ink,.74) capped at 15em. Optionally a percentage in display at 1.25rem. Grid repeat(auto-fit, minmax(11.5rem,1fr)), gap clamp(2rem,4vw,3.2rem) with row-gap clamp(2.6rem,5vw,4rem), plus the dew stagger.
- ACCORDION for "à savoir" and FAQ: a hairline-topped list, each question a full-width flex button in the display face at clamp(1.1rem,1.7vw,1.35rem) weight 400, padding 1.5rem 0, turning rose-deep when open, single-open behaviour with aria-expanded maintained and role region plus aria-labelledby on the panels.
- FOOTER: cream-deep with its own two dim radials (never dusk — the page ends in the morning), a newsletter or contact row at 1fr 1fr collapsing to 1fr, then THE MONUMENT: the wordmark at clamp(3.4rem,15vw,13rem), line-height .92, +.08em, filled rgba(ink,.10), user-select none, aria-hidden, centred, with the top 30 percent of its letterforms overlapped by the row above at margin-top -1.5rem. Then a hairline row of links at .85rem in rgba(ink,.6) and a credit line at .78rem in rgba(ink,.45).
- CRAFT DETAILS THAT SIGNAL INTENT: explicit width and height on every image; fetchpriority high on the LCP image, loading lazy elsewhere; descriptive alt on content images and alt empty with aria-hidden on decorative duplicates; aria-live polite on validation and total; an output element for the stepper; a skip link; an inline-SVG data-URI favicon of the dew drop; and a theme-color meta that follows the active moment.

## Conversion objects (this world SELLS — and it sells the way a pharmacist sells: quietly, completely, once)
- THE PRICE BLOCK: a baseline-aligned flex row, gap .9rem, flex-wrap wrap. The price in display 300 at clamp(2rem,3.4vw,2.9rem), tabular-nums, +.02em, with THIN-SPACE THOUSANDS using U+202F (3 500, not 3,500 and not 3500). The currency mark is a sibling span at .34em, +.2em tracking, uppercase, rgba(ink,.56), sitting ON THE BASELINE after the numeral at margin-inline-start .45em — never a superscript, which reads clinical here. A was-price, if the brief has one, sits at 1.05rem in rgba(ink,.5) with text-decoration line-through, decoration-color rgba(rose,.7), thickness 1px. Any promotion is stated IN WORDS in a rose micro-caps line ("offre de lancement", "prix de la première série"), never as a red percentage badge. Under the block, a reassurance line at .8rem in rgba(ink,.62): what happens on submit, that payment is on delivery, and the delivery window — all from brief facts only.
- THE ORDER CHAPTER opens through the ARCHE seam onto cream-deep with its own dew. Grid 1.06fr .94fr, gap clamp(2.5rem,6vw,5rem), scroll-margin-top 5.4rem. The narrow column holds the STICKY ORDER PLATE at top 7.2rem: an arch-C frame with the moment-aware image, the price block, a three-row composition list with promoted numerals, and three trust badges. The wide column holds the form.
- THE FORM IS A SOIN, IN THREE GESTES. Group the fields into three numbered groups, each opened by a rose dew-drop numeral and a .7rem/+.22em uppercase label, separated by 1px hairlines with padding-block 2.2rem: GESTE 01 — vous (téléphone FIRST, then nom complet) · GESTE 02 — la livraison (wilaya, adresse, quantité) · GESTE 03 — la confirmation (moment préféré, note optionnelle, total, submit). The phone leads the ritual because it is the merchant's only real channel and a form abandoned after one field has still left something usable. Numbered steps make a long COD form feel like a routine instead of a checkout.
- FIELDS ARE SOFT RULED LINES: border 0, border-bottom 1px rgba(ink,.16), background transparent, border-radius min(var(--radius), 0px), padding .95em .25em .7em, min-height 3rem so a boxless field still clears a 48px tap target, font-size 1.05rem in the body face at weight 400, color ink. This is the ONE place the no-sharp-corners law does not apply, because a rule has no corners. Label ABOVE at .68rem/+.22em uppercase in rgba(ink,.56), margin-bottom .55rem. Hint text below at .78rem in rgba(ink,.56). Never a filled input box, never a 1px full border, never a floating placeholder label.
  - nom complet: autocomplete name, required, minlength 3.
  - téléphone: type tel, inputmode tel, autocomplete tel, required, pattern for a ten-digit Algerian mobile (0 followed by 5, 6 or 7, then eight digits), live-formatted as the user types into 0X XX XX XX XX groups, and on RTL pages the input itself carries dir="ltr" so the number never reverses while the rest of the form mirrors.
  - wilaya: a NATIVE select styled to the same ruled line (appearance none, a drawn chevron SVG at 1.25px stroke with round caps at the inline-end, rotating 180deg on focus over .5s), options from the brief's delivery zones only. Under it, and REPEATED as a two-cell ruled row directly above the submit — never in an FAQ, never below the fold — the DELIVERY FEE and the DELIVERY DELAY for the chosen wilaya at .8rem, both cross-fading over .5s whenever the selection changes, with the total recomputing alongside them. Both figures are business facts and come only from the brief; where the brief prices no zone, the line states its single flat term and invents no number.
  - adresse: a textarea at 2 rows on the same ruled line, auto-growing to 4 rows, with a hint asking for the landmark a delivery driver would actually use.
  - quantité: a stepper, never a number input — an inline-flex group at border-radius var(--radius) with 2.8rem true-circle buttons at 50% (1px hairline, filling rose with cream text on hover over .45s) and an output element at min-width 2.4rem in display 400 at 1.2rem. It has a cap and THE CAP IS GIVEN A REASON in the hint.
  - moment préféré: two radio plates (matin / soir) pre-selected from the page's current moment, built with :has(input:checked).
- THE FOOT OF THE FORM: a hairline-topped space-between row at padding-top 1.6rem — a .72rem/+.2em uppercase label over a live TOTAL in display 300 at 1.9rem with tabular-nums and thin-space thousands, recomputing on every quantity, variant and wilaya change with a .5s opacity dip (1 to .35 to 1) rather than a count-up — beside the submit capsule. A .8rem note beneath repeats that nothing is paid online.
- VALIDATION IS BLUR-GATED: keep a touched map so a message appears only after a field's first blur, never while somebody is still typing. Messages are gentle full sentences in CLAY at .8rem, entering opacity 0 to 1 with y -3 to 0 over .45s, with min-height 1.15em reserved so nothing reflows, and aria-live polite on the container.
- SUBMIT AND THE CALM SUCCESS STATE: a deliberate 900ms pending state in which the label becomes a present-tense human sentence ("On note votre commande…"). Then the form LEAVES over .7s to opacity 0, filter blur(6px), y -8, visibility 0s .7s; the success panel — absolutely positioned over the same box so nothing jumps — ARRIVES with transition-delay .35s over 1.1s on opacity, filter blur(6px) to 0 and y 12 to 0. Inside it: a drawn arch in SVG (stroke 1.25px rose, pathLength 100, stroke-dasharray 101, stroke-dashoffset 101 to 0 over 1.8s power1.out with .4s delay) containing the order number at 2.2rem display 300 and a .62rem/+.26em uppercase sub-label; two lines echoing the buyer's own name, wilaya and total; and the next step in plain language. THEN THE PAGE SETTLES: kill the breath loop and tween the glow to scale 1, opacity .5 over 2.4s. No confetti, no check-mark pop, no sound, no redirect. Persist the order and the moment in localStorage and, on return, paint the success panel instantly with no animation. And at the moment validation passes — as the panel begins to arrive — the page confides the order to the wandit runtime by dispatching the wandit:lead CustomEvent on document with the buyer's fields flat in detail (name, phone as typed, wilaya, commune, plus quantité and moment), while one off-canvas decoy input marked data-wandit-hp rests in the form, never read by the page's own script.
- STICKY MOBILE ORDER BAR (below 860px): position fixed, bottom 0, inset-inline 0, z-index 95, padding .8rem 1rem calc(.8rem + env(safe-area-inset-bottom)), background rgba(cream,.9), backdrop-filter blur(16px), border-radius 1.6rem 1.6rem 0 0, box-shadow 0 -18px 40px -24px rgba(rose-deep,.3), grid auto 1fr gap .9rem align-items center. Start side: the price at 1.15rem display 400 tabular-nums with the .34em currency mark and a .64rem/+.2em uppercase line above it. End side: the rose capsule. It enters on a ScrollTrigger at the hero's bottom, translateY(110%) to 0 over .7s with the shared ease, and a second ScrollTrigger on the order chapter sends it back out while the form is on screen so it never covers the fields.
- WHATSAPP IS THE QUIET PATH, STYLED TO THE WORLD: a cream capsule with inset 0 0 0 1px rgba(ink,.16) and rose text, carrying a HAND-DRAWN inline SVG glyph — the handset-in-bubble at 1.05rem, stroke 1.4px, round caps, fill none, in rose. Never the filled green mark, never a floating green circle, never a bouncing bubble. Hover fills rgba(rose,.08) and turns the inset border rose over .55s. It appears exactly twice: beside the hero's primary CTA and at the foot of the order chapter, with a pre-filled message built from brief facts.
- TRUST STRIP WITH DRAWN SVG BADGES (four, from brief facts only — never invent a dermatological test or a certification): each a 3.6rem circle with a 1px rgba(ink,.18) ring containing an inline SVG at viewBox 0 0 32 32, fill none, stroke rose or rgba(ink,.62), stroke-width 1.25, round caps and joins. The five drawings to choose from: LA GOUTTE (a teardrop with a small inner highlight arc) · LA FEUILLE (two arcs meeting at a point with a midrib) · LA PIPETTE (a dropper bulb with three tick marks) · LE TESTÉ (a rounded square with an arch cut and a small check inside, for dermatologically tested) · LE FLACON (a squat bottle with a fill line). Under each, two lines of .66rem/+.2em uppercase in rgba(ink,.56) capped at 9em. The badges are separated by FIL D'EAU threads in the gutters, not by borders. Rings draw themselves on view. Four across on desktop, 2x2 below 700px.
- CTAs anywhere else on the page are the rose capsule or a quiet text link with a 1px rose underline growing from the inline-start. There is never a full-width solid rectangle button on a desktop viewport.

## Ritual furniture (REQUIRED — this is Cocon's voice, and it invents no business fact)
- GESTE 01 / GESTE 02 / GESTE 03 numbering in the routine and in the order form, always with a rose dew drop.
- PROVENANCE CAPTIONS in the plates: name, origin, function, in three registers of type on one oval.
- THE TEXTURE LINE, set in the display face at 300 in rose, one per product: "texture gel-crème, fondante, sans film gras."
- SENSORIAL TRIPLES: three micro words separated by 4px dew-drop glyphs, used under the hero copy and under any framed product.
- THE RUNNING HEAD: during the routine, a fixed label at the page's inline-start edge, rotated -90deg (and +90deg under RTL), .66rem/+.28em uppercase in rgba(ink,.4), reading the current moment. It fades in and out with the section over .8s.
- PLANCHE 01 / PLANCHE 02 captions under the macro images, in a space-between flex row: descriptive text on the start side in rgba(ink,.56) at .78rem, the plate number in rose on the end side.
- LE MOT DE LA FONDATRICE: one short note in the display face at 1.2rem/1.55 on a blush-tinted plate (rgba(blush,.35), radius min(var(--radius), 2rem), padding clamp(1.6rem,3vw,2.4rem)), opened by a rose quote glyph at 3.4rem, line-height 1, opacity .5, overflowing its plate in two directions, and signed with a name and a role in .72rem/+.2em uppercase.
- À SAVOIR footnotes: small hairline-separated rows giving honest caveats (patch test, storage, who it is not for). A page that admits a limit is a page that gets believed.
- SPEC ROWS with promoted numerals: format, volume, duration of use, pH, batch — whatever the brief actually gives.
- THE REPOS LINE: one unexplained display sentence on bare dew.
Fill all of these from the brief. They are typesetting, not claims.

## Arabic and RTL adaptation (this market ships both — build it as a first-class layout, never a mirrored afterthought)
- dir="rtl" and lang="ar" on the html element, and EVERY spacing property written logically: padding-inline, margin-inline, inset-inline-start, border-inline-start. No physical left or right appears in the stylesheet, so the hero's .92fr/1.08fr, the routine split, the order chapter and the dew stagger all mirror for free.
- NEVER LETTER-SPACE ARABIC — tracking breaks the joins and is the single commonest failure. Every +.18em to +.28em micro-cap value in this document drops to 0 under html[lang="ar"], and text-transform uppercase is removed (Arabic has no case). The micro-caps register is carried instead by three substitutions: size +8 percent, the ROSE colour in place of rgba(ink,.56), and a 4px dew drop before the line.
- Line-heights go UP: body 1.87, plate function line 1.75, form hints 1.7. Sizes go up 8 percent. Every measure cap loosens by 2em.
- Faces: display in the Amiri / Aref Ruqaa / Reem Kufi territory at its lightest usable weight, body in the IBM Plex Sans Arabic / Noto Sans Arabic / Almarai territory. Never stretch one Latin face across both scripts, and never render Arabic in a face without real Arabic glyphs. The sub-400 display rule survives as SIZE plus rgba(ink,.8), because most Arabic faces have no 300.
- Numerals: keep Western digits (0-9) for prices, totals, volumes and the phone field — that is what Algerian commerce reads — with the same U+202F thin-space thousands and tabular-nums. Choose one numeral system and hold it across the whole page, including the GESTE numerals.
- The phone input keeps dir="ltr" on the field itself inside the RTL form so the number never reverses while typing. The wilaya select and the price row keep dir="ltr" for the same reason.
- Three things do NOT mirror: the arch silhouettes (symmetric, they mirror for free and need no rule), the dew radial positions (re-author them from the mirrored composition rather than flipping a transform, so the light still falls where the arch leans), and the routine's step order, which stays 01 to 03 running from the start edge.
- The running head rotates +90deg instead of -90deg, and the scroll-cue drop, the progress thread and the fil d'eau are vertical, so they need no adaptation at all.
- Arabic has no italic — which costs this world nothing, because its emphasis was never a slant: the soft voice is the display face lighter, larger by 1.04em, and in rose. The Arabic page is therefore typographically identical to the French one.

## Global rules this world overrides (declare each in an HTML comment near the relevant code, then obey it)
1. Motion defaults: power2.out at 1.35s, not power3.out at 1.1s.
2. Masked line rises are replaced by the blur-and-settle SOFT RISE — this world has no mask edges.
3. Clip-path image wipes are replaced by the SETTLE — no hard wipe edge anywhere.
4. Interaction feedback runs .45-.65s instead of .25-.45s; ambient loops run 6.5s, 22s and 27s instead of 3-4s.
5. TWO ambient loops are allowed (the breath and the dew drift) where most worlds allow one, because the dew is the concept.
6. Display tracking is POSITIVE at every size; negative tracking is banned.
7. The hairline seam is allowed more than once, but ONLY in its vertical FIL D'EAU form; horizontal hairline seams between scenes stay banned.
8. Minimum radius on any panel is 1.4rem, with the single exception of the ruled form field, which has no box at all.
9. Global: no hand-drawn SVG illustrations. HERE: the dew drop, the four trust badges, the WhatsApp glyph, the select chevron, the success arch and the favicon are DRAWN inline SVG in one stroke language (1.25-1.4px, round caps and joins, fill none) — they are UI marks, not imagery. The ban still holds absolutely for anything standing in for a PHOTOGRAPH: no drawn products, no illustrated flowers or leaves, no mascots, no drawn logo. A missing photo becomes a labelled image slot, never a drawing.
10. Global: count-up numerals on stats and prices. HERE: exactly ONE count-up exists (a composition percentage from the brief); the price never animates and the live total dips its opacity 1 to .35 to 1 over .5s instead of spinning.
11. Global: inputmode numeric on the phone field. HERE: inputmode tel — the call-shaped keypad is the affordance this market expects. Everything else in the global COD contract holds unchanged: phone first, no email, no account, a styled wilaya select, blur-gated validation, the fee and delay beside the submit.

## Cocon ban list (in addition to the global one)
Any flat background-color with no dew · pure white or a cool white ground · neutral greys, slates, or any colour that is not an alpha of the palette · black text or black shadows on light grounds · a rectangular image with four visible corners · sharp corners under 1.4rem on any panel · font-weight 600 or above anywhere · negative letter-spacing on display type · masked line rises, clip-path wipes, or any animation with a hard moving edge · bounce, elastic, back, or any overshoot · interaction transitions under .4s · count-up on a price · red or orange promotion badges, "-30%" chips, countdown timers, fake stock counters · a green WhatsApp blob · confetti or a popping check-mark on success · feature cards with backgrounds, borders and icons (this world has plates, not cards) · icon triads · emoji · the spa cliché kit: stacked river stones, bamboo, orchids on folded towels, a woman in a white robe with cucumber slices · lorem-flavoured wellness copy ("prenez soin de vous") with no material behind it · a 50/50 grid · a hero whose right column is a full-bleed photo slab · centred body copy beyond the four rationed centred moments · backdrop-filter beyond the four rationed surfaces (the nav capsule, the hero provenance tag, the BAIN carte, the mobile order bar) — a fifth translucent panel is glassmorphism and is banned · a hamburger menu · a bouncing chevron scroll cue · more than two ambient loops · more than two scrubbed animations · any hidden state authored in CSS.

## Intensity
This world dies of half-measures. Every wrong decision here is a comfortable default that looks fine alone: a flat cream background instead of dew, a 16px radius instead of an arch, a photo that ends at its box instead of dissolving, a bordered input instead of a ruled line, a 300ms hover instead of 550ms, one more weight of the sans instead of more space. Any three of those and the page becomes the generic pastel wellness template it exists to replace — and it will still look "clean", which is exactly the trap.

Executed at 100 percent — a room made of two drifting pastel radials, a texture macro condensing out of the page and evaporating back into it, an arch with a dew of texture hanging off its corner, provenance plates staggered like drops on glass, a matin/soir routine where the product changes as you read the gestures, badges that draw themselves, and an order form of soft ruled lines closing on a slowly drawn arch while the page exhales — it looks like a house that has been making this cream for years and would like you to use it properly. Every number above is load-bearing. Softness is not the absence of decisions; it is forty of them.`,
	energy: "quiet",
	family: "cocon",
	id: "cocon",
	industries: [
		"beauty",
		"cosmetics",
		"skincare",
		"haircare",
		"spa",
		"hammam",
		"wellness",
		"perfume",
		"soap",
		"herbal",
		"salon",
		"baby",
		"ecommerce",
	],
	kind: "product",
	mood: ["soft", "dewy", "ritual", "botanical", "tender"],
	name: "Cocon",
	preview: {
		ground: "#FBF6F1",
		ink: "#2E2422",
		accent: "#C98B84",
		fontFamily: "Cormorant Garamond",
		sampleWord: "Cocon",
	},
	priceFeel: "accessible",
	tagline:
		"A page made of light instead of boxes — pastel dew drifting behind an arch of cream, texture photographed so close it dissolves into the paper, your ingredients named one by one, and a morning-and-evening ritual that ends in an order form as gentle as the product.",
};
