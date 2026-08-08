import type { DesignWorld } from "../types";

/**
 * ONDE — the serene sage spa.
 * Popular wave (batch 9): the premium spa/wellness genre — sand ground, sage
 * accents, steam, stone, slow breathing calm — executed as the expensive version.
 * Photographic world: assets live in demo/assets/ and are graded in CSS.
 * fusesWith rationale: wabi (shared stillness, opposite imagery — ink vs photo) ·
 * eclat (shared warm-lifestyle clientele, opposite temperature — golden vs sage) ·
 * poudre (cosmetic macro register for a product line) · horizon (spa hotel /
 * destination retreats).
 */
export const onde: DesignWorld = {
	id: "onde",
	name: "Onde",
	family: "wellness-spa",
	tagline: "Sable, sauge et vapeur : le spa qui respire en continu.",
	kind: "website",
	mood: ["serene", "hazy", "warm-neutral", "slow", "photographic"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"spa / hammam",
		"skincare / esthetician",
		"nails & lashes studio",
		"hair salon",
		"cosmetics brand",
		"cosmetics / skincare brand",
		"yoga / pilates studio",
		"physiotherapy / kiné",
		"psychology / therapy",
		"nutritionist",
		"hotel",
		"guesthouse / riad",
	],
	avoidFor: [
		"gym / fitness club",
		"crossfit / functional",
		"martial arts / combat sports",
		"street food / food truck",
		"fast food",
		"car dealer",
		"electronics / gadgets",
		"streetwear / drops",
		"DJ / entertainment",
		"SaaS product",
		"dev tool",
		"AI product",
		"security company",
		"general contractor",
	],
	fusesWith: ["wabi", "eclat", "poudre", "horizon"],
	preview: {
		ground: "#F1EEE6",
		ink: "#2F3A2E",
		accent: "#7C8A6E",
		fontFamily: "Lustria",
		sampleWord: "Onde",
	},
	doc: `# DESIGN WORLD: ONDE — the serene sage spa

## Philosophy
This page is a ROOM FULL OF WARM STEAM, not a website. The reader arrives carrying noise and the page takes it off them in the first viewport: sand ground, one deep-green-grey ink, one sage that never shouts, photographs of stone, water and linen breathing in the same humid light. First structural fact: WHITE VEILS STRADDLE THE SECTION BOUNDARIES — steam gradients sit ON the join, dissolving both ways from it, never stopping (a 6.5–8s sine loop). Nothing else loops; the steam is the world's pulse. Second: THE PAGE IS A RITUAL, not a menu — content is ordered in numbered temps (01 · 02 · 03) hung on a hairline that draws itself, and the FIRST VIEWPORT already carries that rail, because a spa sells a sequence, not a list of services. Third: SOFT 16px ROUNDED RECTANGLES everywhere — no arches, no ovals, no 28–48px pillows.
Impossible failure modes: a loud page, a cold page (the ground is warm sand, never grey-blue), photographs as wallpaper behind centred white type, urgency. A brief asking for "dynamique et moderne" is asking for another world.
Self-audit — count them: (1) four or more steam veils, each breathing, NONE ending on a hard edge (measure a ground-to-ground join: adjacent pixel rows must differ by under 4 RGB points; a photograph's own edge is exempt, being a designed edge); (2) the ritual numerals appear exactly twice, hero index and showpiece rail, nowhere else; (3) three or more pebble glyphs as dividers or row markers; (4) every supplied photograph used, every mask 16px, every image on the identical grade; (5) zero looping animation on anything carrying words; (6) one h1, one scrubbed showpiece, one static quote.

## The variation contract (why two ONDE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Warm sand double-ground (two tones 3–6 RGB points apart), deep green-grey ink, ONE sage accent. No dark sections, no inverted interlude.
- Photography only, on one identical CSS grade, every supplied frame used; drawn matter is limited to hairlines, pebbles, numerals and veils.
- Steam veils straddling section boundaries, breathing continuously, never ending on an edge.
- The ritual: numbered circles joined by a drawing line — an index in the hero, the scrubbed showpiece later.
- 16px masks, 12px controls, hairlines at 16% and 30% ink; lowercase letterspaced labels, serif display, sans body.
- Tide-breath motion: 1.6s sine.inOut entrances, nothing bounces or snaps, no overshoot ever.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The exact hexes inside the registers (sand #F1EEE6/#EDE9DF · #F3F0E8/#EFEBE1 · #EFEBE0/#EAE5D9; sage #7C8A6E · #869279 · #6F7F63).
- The display face within the register (Lustria / Cormorant Infant / Gilda Display, one per site).
- THE ELEMENT that drives the page: eau, vapeur, sel, argile, huile, silence. It names the hero statement, the three temps, the macro photograph and the voice.
- The number of temps (three or four), the section order beyond the fixed opening and closing, which photograph carries the band, whether the price list is a carte or a grid of cards.
Choose the element first; it then chooses the photographs and the words.

## The vibe (voice)
Calm French, short declaratives, present tense, no superlatives, no exclamation marks. Say the temperature, the duration, the material — precision IS the luxury. Sentences may end early. Speak about time as something given, never sold. Examples:
- "Le temps ralentit à l'entrée."
- "Quatorze degrés, six secondes, trois fois. Le sang revient d'un coup."
- "Le thé est offert. Le temps aussi."
Never: "une expérience unique", "lâchez prise", "bien-être 360°", countdowns, "plus que 3 places".

## Visual signatures (measured, reproducible)
- STEAM VEIL TRANSITIONS (owned tic): a pointer-events:none span, height clamp(200px,26vh,340px), background radial-gradient(125% 50% at 50% 50%, rgba(255,255,255,.88) 0%, rgba(255,255,255,.48) 42%, rgba(255,255,255,0) 78%), transform-origin 50% 50%, z-index 2. THE LAW OF THE VEIL: the ellipse is centred inside its own box and reaches alpha 0 on all four sides, so it dissolves instead of stopping — a veil whose brightest stop lands on its own edge prints a hard white rule across the page and reads as a rendering bug. A boundary veil is a SEAM: a child of the LATER section pulled up by half its height (top: calc(var(--veil-h) / -2)), straddling the join so both grounds go equally pale. The same box, bottom-anchored and taller — clamp(260px,42vh,460px) — is the haze behind a footer wordmark. It breathes: opacity .72→1, scaleY .9→1.08, 6.5–8s sine.inOut yoyo, staggered 0.6s. Over a photograph's TOP edge use a downward LINEAR white (.68 → .30 at 40% → 0): it lifts a header off the image without a dimming bar.
- PEBBLE-STACK GLYPH (owned tic): three stacked rounded stones, one SVG symbol, 24×22 viewBox — rects 21.6×6.4 rx3.2 (opacity .92), 15.2×5.8 rx2.9 (.72), 8×4.8 rx2.4 (.54), currentColor in sage. Three uses: centred between two hairlines as a divider (flex, hairlines flex:1, gap clamp(14px,2vw,26px)); as the 24px marker column of every price row (opacity .55 → 1 on hover/focus-within, −2px lift); as the success-plate icon. It drifts −3px over 7–8.6s. Never more than one per 400px of column.
- RITUAL NUMERALS IN HAIRLINE CIRCLES (owned tic): 48px circles, 1px rgba(ink,.30) border, GROUND fill so the hairline passes behind and is masked, numeral 01/02/03 in the DISPLAY face at .92rem. The rail runs two ways and the page plays BOTH, once each. HORIZONTAL — the hero index: three equal columns, circles on the top row, display-face name under each, duration in tracked sage-ink (the duration line drops under 640px, the names never do); the hairline runs left:24px to the third circle's centre (right: calc((100% - 2*gap)/3 - 24px)) and draws scaleX 0→1 in 1.6s sine on arrival, with NO rings — no temps is active yet. VERTICAL — the showpiece rail: hairline at left:23px / top:26px / bottom:30px drawing scaleY 0→1 on scrub, an inner ring (inset −5px, 1px sage) marking the ACTIVE step only. Nowhere else — never section numbering, never a page index.
- Hairlines: rgba(47,58,46,.16) between rows and at section tops, rgba(47,58,46,.30) for circles, field underlines and ghost buttons. No box-shadows anywhere, ever.
- Labels are lowercase, .26em tracked, .71rem, deep sage — on bare ground or above a rule, never in a pill.

## Color physics
- GROUND A and GROUND B: two warm sands 3–6 RGB points apart — the #F1EEE6 / #EDE9DF register. Sections alternate A, B, A, B; the alternation is the rhythm and is subtle by design, never a visible stripe.
- PLATE: #E7E3D6 — one step deeper than ground B, for the contact panel and the success state only. Photo placeholder behind loading images: #E2DED2.
- INK: deep green-grey, never black — the #2F3A2E register. Body copy runs at rgba(ink,.72); micro-captions and legal lines at rgba(ink,.62) — never thinner, .52 drops under 3:1 on sand.
- ACCENT SAGE: #7C8A6E. Budget: the active ritual ring, pebble glyphs, the hairline under a hovered nav link, the select caret, selection. Never a sage section, never sage body copy.
- SAGE-INK #5C6B4F is the ONLY sage for text under 1rem (labels, captions, temperatures) — #7C8A6E fails contrast on sand at small sizes. It is ALSO the primary button's resting fill: #7C8A6E behind a #F5F3EC label measures 3.3:1; #5C6B4F measures 5.2:1, hover SAGE-DEEP #4A5740 6.9:1. This split is law.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · SAGE-INK→--primary · the #F5F3EC button label→--primary-foreground · GROUND B→--secondary · ACCENT SAGE→--accent · ink at 62%→--muted · ink at 16%→--border · 16px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- GRADIENTS EXIST ONLY AS STEAM: white → transparent, on section boundaries, photo edges and the showpiece stage. No coloured gradient, no gradient text, no gradient border, ever. Depth comes from photographs, never from an inverted ground.

## Typography system
- DISPLAY: a light, humanist, low-contrast serif — Lustria (default), Cormorant Infant or Gilda Display; one per site, weight 400 only, for h1/h2/h3, prices, temperatures and the footer wordmark. Italic nowhere.
- BODY: Mulish 300/400/500/600 (alt: Karla), clamp(15.5px,1.04vw,17px)/1.72; leads clamp(1.02rem,1.18vw,1.2rem)/1.68 max 46ch; running text max 56ch.
- Scale: h1 clamp(2.7rem,6.1vw,5.4rem)/1.02, max 12ch on open ground; one step down to clamp(2.4rem,4.4vw,4rem)/1.04, max 11ch, inside a plate over a photograph. h2 clamp(2rem,3.8vw,3.35rem)/1.1. h3 clamp(1.25rem,1.7vw,1.6rem)/1.2. The showpiece title runs smaller — clamp(1.85rem,2.9vw,2.7rem), max 14ch — because it shares a row with the stage. Display tracking −.008em. Never above 10vw: this is not a poster world.
- LABELS: body face 500, LOWERCASE, .71rem, tracking .26em, sage-ink. Uppercase is forbidden — lowercase is the softness. Micro-captions and durations: .73–.8rem, tracking .14–.18em.
- Numerals: prices in the display face with a .68rem tracked "DA" affix in the body face; tabular-nums on every price and temperature.
- Arabic pairing (if the page serves Arabic): Noto Naskh Arabic 400 for body and headings, +6% against the Latin, line-height 1.9; the display serif is dropped rather than substituted, and labels lose their tracking.

## Signature art — the photography law, and components
IMAGERY IS PHOTOGRAPHIC ONLY. One art-direction phrase for every generation: "serene spa photography, warm neutral tones, soft diffused daylight, gentle steam, natural stone and linen textures, no people, no text". THE ROSTER is five frames and it is the shot list: the steam room, folded linen on stone, a tea tray, a water detail, stones beside an oil bowl — objects and rooms, never faces or hands holding products. EVERY frame ships at least once; a supplied photograph left in the folder is a build error, and this genre may not run three sections on type alone. Reuse a frame at a second aspect only once the roster is exhausted.
- THE GRADE (identical on every image, no exception for hero or full-bleed): filter: brightness(1.03) saturate(0.9) contrast(0.97), PLUS the lifted-black veil — linear-gradient(to top, rgba(255,255,255,.34), rgba(255,255,255,0)) over the bottom 42% of the mask, z-index 1. Write it once as a selector list covering every mask; three near-identical variants is the same failure as three grades.
- MASK GEOMETRY: 16px radius rectangles only. Aspect is how photographs differ: a full-bleed hero, a 3:4 or 5:4 beside text, a full-bleed 58vh band, a portrait ~4:5 showpiece stage spanning both rows of its grid. GIVE EVERY MASK A DEFINITE HEIGHT — aspect-ratio, a height clamp, or flex:1 in a stretched column — and set the img position:absolute; inset:0. An img at height:100% in an indefinite grid row falls back to its intrinsic ratio and the SOURCE sets the section height. NEVER an arch, an ellipse, or a 28–48px pillow.
- CROPPING: object-position keeps the quiet third of the frame where type will sit and crops away any architectural arch — at EVERY breakpoint. A wide mobile crop re-exposes what the desktop crop hid; push object-position or zoom (background-size: auto 155%, or transform:scale) until it is gone.
- CAPTION LAW: an in-mask micro-caption (.73rem, tracking .18em, sage-ink) or a sentence below in rgba(ink,.62). Facts only: "le bassin froid — 14°C". An in-mask caption NEVER floats bare on photography — sage-ink over stone measures 2.5:1. Give it an anchored steam wash as its own background: radial-gradient(118% 132% at 14% 100%, rgba(255,255,255,.9), rgba(255,255,255,.58) 46%, rgba(255,255,255,0) 78%), generously padded: the wash reads as steam and the text clears 5:1.
- BUTTONS: 12px radius, .92rem padding-block, body 500 at .9rem, tracking .03em. Primary = SAGE-INK #5C6B4F fill, #F5F3EC text; ghost = transparent, rgba(ink,.30) hairline, sage-ink text. Transitions 0.4s cubic-bezier(.37,.01,.24,1); hover deepens to #4A5740; :focus-visible identical plus a 2px sage-ink outline offset 3px. Disabled goes hairline + rgba(ink,.62).
- CARDS: flat ground-A rectangles consuming var(--radius) directly (the 16px soft corner), 1px rgba(ink,.16) border, no shadow. In a row of three, offset them 0 / clamp(1rem,3.4vh,2.6rem) / clamp(2rem,6.8vh,5.2rem) — the tide staircase. The price sits at the foot above a hairline, display face clamp(1.3rem,1.85vw,1.7rem), duration as a tracked sage-ink small opposite.
- FORMS: no boxes. Lowercase tracked sage-ink labels above underline-only fields (1px rgba(ink,.30), focus → sage). Two columns on desktop, one under 640px. Phone is type="tel" with inputmode and a real Algerian placeholder; structured choices are selects with a drawn sage caret. One off-canvas decoy carries data-wandit-hp, is never touched by the page's script, and aborts the submit silently when filled. On valid submit dispatch wandit:lead on document with the fields flat in detail (decoy excluded), reveal an honest success plate (--plate, 1px sage border, 16px radius, pebble glyph, display-face first line) naming who calls back and when, and disable the button. No confetti, no checkmark animation.

## Page chassis
- Container min(1240px, 100% − 2×gutter), gutter clamp(20px,4.4vw,64px). Section padding-block clamp(5rem,10.5vh,8.5rem); the showpiece uses clamp(4rem,8.5vh,6.5rem), being height-bound.
- Header: absolute over the hero, not fixed, no blur bar. Grid auto / minmax(0,1fr) / auto — wordmark (display 1.62rem, lowercase) plus a tracked descriptor left, lowercase nav centred, reserve button right. It is legible because the head veil lifts the image's top strip to near-white, never because of a dimming bar. Under 900px the links drop.
- FIXED OPENING — the hero: ONE photograph filling the viewport (min-height 100vh, background-size: auto 155% so the crop is intimate and arch-free), a downward head veil across its top third, and a GROUND PLATE bottom-left — 16px radius, ground-A, max-width min(680px, 74%), padding clamp(1.7rem,2.8vw,2.6rem). Inside it, in order: label, h1 (one step down, max 11ch), lead at max 40ch, two buttons, then above a hairline the HORIZONTAL RITUAL INDEX — 01 · 02 · 03 joined by their drawing line, each with its temps name and duration. The owned device therefore lands in the first viewport at every width, photograph included. One micro-caption sits in the corner opposite the plate. A kicker + headline + CTA row + photo column is the generic skeleton; this world does not ship it.
- THE THRESHOLD STRIP closes the hero: a shallow ground band under the photograph carrying a centred pebble divider over one row of three or four practical facts at .8rem in rgba(ink,.62) — it gives the boundary veil somewhere to live.
- FIXED CLOSING — réservation then footer: the form sheet beside a column holding the plate of practical facts (adresse, horaires, téléphone, one honest line about arriving early) and, filling whatever height is left, a photograph — the closing column never ends in bare ground. Then a footer lockup: the wordmark at min(9.4vw,146px) flush left, a two-line note flush right, a steam haze BEHIND it (z-index 1 against content at 2), a hairline bar of legal micro-text.
- FREE MIDDLE — compose 3–5, never two adjacent alike: the ritual showpiece · the carte · the water band with the single quote · the staggered triptych · the gift-card staircase · a facts band.
- Social proof is ONE static quote, display face clamp(1.7rem,2.55vw,2.5rem), attributed with a name and a duration ("vingt-huit ans de hammam"). Never a carousel, never stars.

## Motion identity — TIDE BREATH (GSAP 3 + ScrollTrigger, CDN)
Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state is set by gsap.set, never in CSS: with JS dead the page is fully composed.
- ENTRANCES: opacity 0 → 1, y 22 → 0, 1.6s sine.inOut, stagger 0.11, start "top 78%" per section. That single long sine is the signature — no power4, no expo, no back, no overshoot.
- BREATHING LOOPS: veils and pebbles only. Veils yoyo opacity .72→1 / scaleY .9→1.08 over 6.5–8s sine.inOut, 0.6s apart so the page never pulses in unison; pebbles drift −3px over 7s, +0.4s per glyph. Anything carrying words NEVER loops.
- PHOTOGRAPH ARRIVAL: opacity 0.001 → 1 over 1.6s sine.inOut at "top 92%". No zoom, no pan, no Ken-Burns. The hero index hairline draws scaleX 0→1 once, on load.
- THE SHOWPIECE — the ritual (one per page): pin the section, scrub 0.5, end "+=210%" on desktop. Under 900px the section is taller than the viewport, so DO NOT PIN — scrub it as it travels ("top 82%" → "bottom 22%"); a pinned block taller than the screen crops its own last step. On a 4.4-unit timeline the rail draws scaleY 0→1, ease "none", over 4 units; the exchanges sit at 1.32–2.16 and 2.92–3.76, leaving three long SETTLED holds — a showpiece whose crossfades outweigh its holds photographs as mush, and the library shot lands in it. At each beat the stage steam swells 0.07 → 0.5 → 0.07 (0.34s / 0.46s) while the top photograph fades beneath it in 0.26s, so THE PHOTOGRAPH CHANGES INSIDE THE STEAM; the leaving step dims to 0.34 and loses its sage ring (scale 1 → 0.72), the arriving step returns to 1. Photographs stack in reverse ritual order so the static page shows temps 01 on top.
- HOVER: 0.35–0.4s cubic-bezier(.37,.01,.24,1) — a nav link grows a sage hairline, a price row's pebble lifts 2px to full opacity, a ghost button's hairline turns sage. Every hover is duplicated on :focus-visible and :focus-within, and the parity must be REAL: :focus-within on a row with no focusable child never fires, so the price row's name is a link to the booking section.
- REDUCED MOTION: no ScrollTrigger. The composed still is the design: the ritual shows temps 01's photograph, all numerals ringed, both hairlines fully drawn.

## Ban list (in addition to the global ban list)
- wabi's sumi-e brush stroke, vertical writing-mode labels and off-centre ma — ONDE is photographic, on its grid, and breathes continuously rather than once.
- eclat's photo-orbit statement, capsule glyph-badges and 28–48px deep-rounded warm-grade masks — ours are 16px on cool-neutral sand, not golden skin.
- herbier's specimen plates and tied tags; aquarelle's wash grounds, pigment-bloom masks and brush underpainting.
- guimauve's blob containers, candy-stripe dividers and back.out overshoot (≥1.7) — no overshoot of any strength exists here.
- poudre's texture macro interludes, oval portrait masks and shade-dot swatch rows.
- matiere's arch-only geometry, drawn room miniatures and 4% feTurbulence grain.
- generique's letterboxed 21:9 with black bars, Ken-Burns scrubs and champagne foil small-caps.
- serment's ECG vitals line and slot chips (our booking form is underline fields); silhouette's huge-type-over-photo collision; elan's photo-through-type masthead.
- Also banned: dark sections, uppercase labels, box-shadows, glassmorphism, emoji and icon fonts, stock "wellness" clichés (zen stones fanned in a row, orchid floating on water, candle bokeh), "relaxation" in a headline, any countdown or scarcity line.

## LES GESTES (moves menu)
1. LA CHAMBRE DE VAPEUR — hero: one photograph filling the viewport, a head veil across its top third, a ground plate bottom-left carrying label, h1, lead, buttons and the horizontal ritual index, one micro-caption opposite. The alternative is photo-LEFT bleeding to the left and top edges with the type column right — never photo-right with a kicker stack.
2. LE VOILE DE PASSAGE — a steam veil straddling a section join, breathing 6.5–8s, transparent on all four of its own edges. Use on at least four boundaries; adjacent veils never share a phase. A photograph's own edge is a designed edge: the veil kills the ground-to-ground step, it does not decorate.
3. LE RAIL DU RITUEL — the numbered circles stacked beside a photographic stage, joined by a line that draws on scrub. This is the showpiece; play it once.
4. LA CARTE D'EAU — the price list: a sticky title column (top clamp(2rem,10vh,5rem), closed at its foot by a 5:4 photograph so it is never a stub, kept under one viewport tall or it stops sticking) beside hairline-ruled rows of pebble marker / name-as-link + description + duration / tabular price.
5. LE PLAN D'EAU — a full-bleed water or stone macro, height clamp(360px,58vh,600px) SET ON THE MASK, in the same row as the page's single quote on ground. Photo column 1.28fr against 0.72fr of type; caption in the mask on its steam wash. Past ~70vh the quote drowns in bare ground and the section drifts into poudre's macro-interlude territory.
6. LE TRIPTYQUE DÉCALÉ — three columns, the middle a photograph at clamp(320px,44vh,460px), the outer ones two text blocks each, pushed down by different offsets (~3rem and ~5rem). Balance the block COUNT across the outer columns: 3-against-2 leaves one hanging 150px short and the foot goes slack.
7. L'ESCALIER DE CARTES — three gift-card plates stepped down 0 / ~2rem / ~4rem, each closing on a price above a hairline with a tracked duration opposite.
8. LE GALET COMPTÉ — the pebble glyph between two hairlines as a divider, or as a list's marker column. Punctuation, not decoration: one per block.
9. LA FICHE D'ACCUEIL — the form as a bare sheet: tracked lowercase labels over underline-only fields, two columns collapsing to one, closing on a flat #E7E3D6 plate (16px radius, 1px hairline; maximum two such plates per page) that names who calls back.
10. LE MOT D'EAU — the footer wordmark flush left against a two-line note flush right, the steam haze behind the lockup.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. L'EAU FROIDE — a city day-spa built on the descent from hot to cold. Hero: photo-LEFT at 44vw bleeding off the left and top edges, statement column right, the ritual index running VERTICALLY down the gutter between them. Showpiece: the temperature descent — a hairline thermometer whose numerals (42° / 28° / 14°) fill in turn as the pool photograph cools through the scrub. Mood: clinical calm, the most sober sibling.
2. LE SEL — a thalasso on the Aïn Témouchent coast. Hero: type only, statement plus one pebble stack on bare ground, the first image withheld until the second section. Showpiece: the breath — one long sine curve drawing across a pinned band while three photographs step behind it, one per crest. Mood: airy, saline, almost empty.
3. LA TISANERIE — a tea house with a small hammam upstairs. Hero: a 62vh photographic band across the top, the headline beneath it on ground, closed by a hairline meta row. Showpiece: the infusion — a hairline circle filling with sage tint over the scrub while three plant names and steeping times swap inside it. Mood: domestic, herbal, talkative.
4. LE MARBRE — a traditional hammam in Constantine. Hero: a narrow centred column, one small square photograph above the title, symmetric emptiness both sides. Showpiece: the stone stack — the pebble glyph assembling stone by stone, one per care step, each landing as its caption arrives. Mood: austere, monumental, old.
5. DEUX CORPS — a couples' spa inside a riad. Hero: two photographs flanking a centre column of type, mirrored crops, no wider than 34ch. Showpiece: the mirrored rails — two ritual hairlines drawing toward each other from the left and right edges, meeting at the centre circle where the shared photograph resolves. Mood: warm, private, symmetrical.
6. L'ATELIER DES HUILES — a skincare line sold from the spa. Hero: a wide ground band carrying the statement, one small photograph inset at the baseline right, a format/price meta line beneath. Showpiece: the dosage rail — three drop glyphs sliding along a hairline to their marks while oil captions and plant sources swap. Mood: apothecary, precise, product-forward.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or this world collapses into a beige template. THE STEAM: veils present, soft, genuinely breathing, DISSOLVED at every edge — a static veil reads as a rendering bug and a veil that stops dead on a boundary prints a white rule across 1440px, which is worse; a page without them is sand-coloured minimalism. THE GRADE: every photograph on the identical filter and lifted-black veil, so the images read as one afternoon in one building. THE RITUAL: the numbered circles, their drawing hairline and the photograph changing inside the steam are why the merchant believes this cost ten thousand euros — a showpiece that is a fade is a failure. The cheap details that separate ONDE from a generated page: tabular numerals on every price and temperature, the sage-ink/sage split for small text, lowercase labels, the pebble lifting 2px under a price row, the staircase offsets, and captions that state a temperature instead of an adjective. When in doubt, remove a sentence and let the steam rise.`,
};
