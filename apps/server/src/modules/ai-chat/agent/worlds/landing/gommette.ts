import type { DesignWorld } from "../types";

/**
 * GOMMETTE — the sticker book.
 * A warm sheet ground where every element is a flat die-cut sticker:
 * bright fill, thick white halo, tiny soft drop, peel-corner hovers.
 * Joyful kid energy with brutalist bones — bloc's little sibling with
 * the opposite temper. Fuses with guimauve (puff meets sticker — the
 * full kids universe) and bloc (the sticker grows teeth — teen commerce).
 */
export const gommette: DesignWorld = {
	avoidFor: [
		"lawyer / law firm",
		"financial advisor",
		"fine dining",
		"aesthetic clinic",
		"notary",
		"funeral-adjacent",
	],
	doc: `# DESIGN WORLD: GOMMETTE — the sticker book that peels open

## Philosophy
This page is a STICKER BOOK, not a website. One warm sheet of paper runs from the first pixel to the footer, and everything placed on it — headline words, buttons, product art, prices, form fields, the FAQ — is a DIE-CUT STICKER: a flat bright fill, a thick pure-white halo cut around its exact silhouette, and one tiny soft drop shadow proving a small thumb pressed it on. Defining structural facts: (1) the sheet ground NEVER changes color — color is never poured onto the page, it is glued on, so a sticker color never touches the viewport edge; (2) every sticker is FLAT — die-cut vinyl, zero inflation, zero gloss, zero gradient; depth is the halo plus the one tiny drop, nothing else; (3) drawn imagery has NO ink outlines — the white halo is the only contour this world knows; (4) somewhere on the page exactly ONE sticker has been peeled off, leaving a grey die-cut ghost behind — proof someone already played here. The temper is joyful kid energy on brutalist bones: flat color, chunky shapes, frank scale — BLOC intimidates, GOMMETTE delights. Impossible failure modes: a gradient wash, a glossy highlight, a puffy inflated blob, a hard black offset shadow, whispering luxury, grey timidity. Self-audit before shipping: (1) zero gradients anywhere; (2) every colored element wears its white halo and a drop from the single world spec (no second shadow recipe exists) — hunt the one naked color patch and dress it; (3) exactly ONE ghost gap; (4) no sticker color runs full-bleed; (5) at most 4 sticker colors + ink + white + sheet; (6) every resting rotation comes from the declared angle set.

## The variation contract (why two GOMMETTE sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- The die-cut construction on every element: flat fill + pure-white halo 4–6px + the tiny drop (0 4px 10px at 14–18% ink — the ONLY shadow spec in the world).
- Flat fills only. No gradients, no gloss, no inner shadows, no inflation — die-cut vinyl, never balloon.
- One constant sheet ground (#FDF8F0 register); sticker colors never full-bleed, never touching the viewport edge.
- Rounded chubby display face from the register; body Varela Round; never italic.
- Peel & pop motion: short small back.out pops (≤1.45, ≤0.5s), the peel-corner hover, nothing bounces big.
- The sticker-sheet section with its ONE peeled-off ghost gap.
- Drawn flat SVG sticker art with the white halo as the only outline; zero photography.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Which sticker color LEADS the page (an orange-led shop, a sky-led swim school, a rose-led crèche, a leaf-led vet are all GOMMETTE), and the exact hexes inside the four registers.
- The display face within the register: Baloo 2 or Sniglet, one per site.
- The DIE-CUT SHAPE SET: each site picks 4–5 shapes from the library (squircle, circle, pill, star, scallop seal, cloud, heart, blob) and reuses ONLY those.
- The ROTATION SET: 3–4 angles from −6°…+6°, reused everywhere (free rotation looks generated).
- The CONCEPT NOUN driving the page — l'album, la planche, la récré, le trousseau, la fête — it names the hero cluster, the showpiece scene and the copy voice.
- The drawn objects, the ghost gap's joke caption, the showpiece scene, the section order beyond the fixed opening and closing.
A GOMMETTE page with no ghost gap is a failure: the peeled sticker is the world's signature of life.

## The vibe (voice)
Warm French that talks to parents with a wink — short lines, honest facts, one smile per section. Register: "Des bodies tout doux, des prix tout petits." · "On emballe, on livre, tu câlines." · "La taille 6 mois part vite — on t'aura prévenu !" Diminutives welcome (p'tit, doudou), never babytalk soup; prices, delays and stock said plainly, like a maman would want them. Exclamation marks: maximum one per section — the stickers already smile. No superlative inflation, no "univers premium", no corporate we.

## Visual signatures (the owned tics live here — reproduce exactly)
- DIE-CUT STICKER HALO (owned tic): every element carries box-shadow: 0 0 0 5px #FFFFFF, 0 4px 10px rgba(35,32,28,.16) — a 4–6px pure-white ring hugging the silhouette plus ONE tiny soft drop (y 3–5px, blur 8–12px, 14–18% ink alpha). On drawn SVG art the halo is a white understroke: duplicate the silhouette shapes beneath with fill #FFF, stroke #FFF, stroke-width 10–14 (at a 120–200 viewBox scale), stroke-linejoin round, then filter: drop-shadow(0 4px 8px rgba(35,32,28,.16)) on the svg. ALWAYS pure white, never tinted, never omitted.
- PEEL-CORNER HOVER (owned tic): on hover/focus-visible a sticker lifts a curled corner — an ::after triangle at one corner (14–22px, background #FFFFFF, border-radius 0 0 0 10px, micro drop 0 2px 4px rgba(35,32,28,.2)) scales 0→1 in 0.18s power2.out while the sticker rotates −2° and lifts −2px. Active/press: the curl flattens, the drop collapses to 0 1px 2px — the sticker is smoothed back on. Same states on :focus-visible and :active for keyboard/touch parity.
- STICKER-SHEET SECTION (owned tic): a grid of mixed-shape stickers (the site's shape set) on a large white sheet-sticker panel, each at a rest angle from the rotation set — and ONE cell is the peeled-off gap: a grey die-cut ghost (fill in the #EAE3D6/#E5DECF register, 2px dashed rgba(35,32,28,.22) outline tracing the silhouette, no halo, no drop) with a small ink caption inside ("Déjà adopté !" register). One ghost gap per page, never more.
- LE MOT COLLÉ: exactly one word per major headline is a word-sticker — set on a sticker-color chip (padding .05em .35em, radius .35em, halo + drop, rotated from the angle set), ink text on the fill. The rest of the headline sits directly on the sheet in ink.
- WORD-STICKER TEXT (display-scale only): big standalone words get the die-cut treatment as text — 8-direction white text-shadow (5px 0, −5px 0, 0 5px, 0 −5px, 4px 4px, −4px −4px, 4px −4px, −4px 4px, all #FFF) plus one 0 6px 0 drop in rgba(35,32,28,.12). Reserved for the footer wordmark and at most one hero word.
- SCALLOP PRICE BADGES: prices and counts live in scalloped-seal or star-polygon SVG badges (16–24 lobes, mild depth), sticker-color fill, white halo, display-face numeral in ink, rotated from the angle set, overlapping their parent card's edge by 10–18px.
- MINI INFO-STICKERS: honest facts (paiement à la livraison, 2–5 jours, échange facile) as small pill stickers 12–13px, display face 700, one per fact, grouped in a row of 2–3 — never floating bare text.
- Rest rotations everywhere: stickers never sit perfectly straight; every rotation comes from the declared angle set, and two neighbors never share the same angle.

## Color physics
- SHEET: the #FDF8F0/#FBF4E8 register — one tone per site, constant from header to pre-footer. The sheet is the only ground; sections are separated by rhythm and stickers, never by ground changes.
- INK: #23201C. All prose, headline text on sheet, details inside drawings (eyes, stitches). Never pure black, never grey text.
- THE FOUR STICKER COLORS (flat fills ONLY): sunny orange #FF9F1C (register #FF9F1C/#FFAF3C/#F98F07) · sky #47B5E3 (register #47B5E3/#5BC0EA/#3AA8D8) · leaf #58B368 (register #58B368/#6BC178/#4AA65B) · rose #F26D9C (register #F26D9C/#F583AC/#E85C90). ONE leads per site (CTAs, the hero mot collé, the biggest badges); the other three support. Ink text on all four; white appears only as halo, never as text on color below display scale.
- SCENERY TINTS: inside scene stickers and card art zones ONLY, each color owns a pale tint (orange #FFECD1, sky #DCEFF8, leaf #E4F2E2, rose #FCE4ED) for walls, floors, skies. Tints NEVER appear as section grounds or UI fills — they exist only inside the die-cut edge of a drawing.
- GHOST GREY: the #EAE3D6/#E5DECF register with 2px dashed rgba(35,32,28,.22) — reserved for the peeled gap and empty "slot" states that stickers pop onto. Ghosts never carry halo or drop (they are the absence of a sticker).
- THE BACK COVER: exactly ONE full-bleed ink (#23201C) slab per page — the footer. Ink may run full-bleed; sticker colors never. On the back cover, halos and drops stay (stickers glued on the back of the book), text flips to sheet.
- Gradients exist NOWHERE — not in art, not in text, not in a hover, not as light. Alpha exists only in the two drop-shadow recipes and the ghost dash.

FIXED TOKEN MAP — SHEET→--background · INK→--foreground · LEAD STICKER COLOR→--primary · INK→--primary-foreground · WHITE→--secondary · second sticker color→--accent · GHOST GREY→--muted · ink at 15%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, tint or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Baloo 2 (600–800) or Sniglet (800) — ONE per site. Chubby, rounded, warm. Sentence case by default; uppercase only on mini info-stickers and badges. Tracking 0 to −0.01em. Never below 1.1rem.
- BODY: Varela Round 400 (its only weight — never fake-bold; emphasis is a mot collé or a color word). 1rem–1.06rem, line-height 1.55–1.65, measure ≤60ch, flush left, never center-aligned paragraphs.
- Hero statement: clamp(2.4rem, 6.5vw, 5.2rem), line-height 1.04–1.12. Section titles: clamp(1.7rem, 3.8vw, 3rem). Scale ratio hero:body ≈ 5:1 — loud like a kid, not like a billboard.
- LABELS: display face 700, 12–13px, uppercase, tracking +0.04–0.08em, ALWAYS inside a mini pill sticker — never floating letter-spaced whispers on bare ground (that is ÉCRIN's language).
- NUMERALS & PRICES: display face 700–800 inside scallop badges, clamp(1.1rem, 2.2vw, 1.6rem); currency affix at 55–65% size. Step numerals on round stickers may hit clamp(1.8rem, 4vw, 3rem).
- NEVER italic. Never a serif, never a mono, never a weight under 400.
- Arabic pairing: display Baloo Bhaijaan 2 (700–800) — the same chubby family speaks Arabic natively; body Rubik (400/500). Same halos, same badges; mirror the rotation set (−6…+6 flips sign) and the peel corner flips to the left in RTL.

## Signature art / components
- DRAWN STICKERS: every image is a hand-built inline SVG in flat sticker style — 2–4 flat fills from the palette + tints, chunky rounded silhouettes, tiny ink details (eyes, stitches, seeds) — and NO ink outline: the white understroke halo is the only contour. Objects are figurative and simple — a teddy, a body, a biberon, a scoop, a paw, a balloon — one object per sticker, boxy-cute, resting at an angle from the set. Each meaningful drawing carries role="img" and a real aria-label in the page's language; decorative repeats are aria-hidden.
- SCENE STICKERS: bigger compositions (a nursery wall, a pool, a party backdrop) are ONE large die-cut panel (radius 20–28px, halo 6px, tint ground) with flat props — shelf, crib, rug, window — in the same no-outline language. Scenes are where flying stickers land in the showpiece.
- BUTTONS: pill or squircle stickers — pill forms (buttons, chips, mini info-stickers) consume var(--radius) directly — lead-color fill, halo + drop, display face 700, 14–16px padding block / 24–32px inline, ink text. Hover/focus-visible: the peel-corner curl + lift −2px + rotate −2°; active: smoothed flat. Secondary: white-fill sticker with ink text, same construction.
- FORMS: the form is a large white sticker page (fill #FFF, radius 24px, halo — subtle on the sheet, the drop does the work). Fields: sheet-fill (#FDF8F0) rounded 12–14px, 2px solid rgba(35,32,28,.15) border, 12–14px padding; focus: 3px solid lead-color outline, offset 2px. Labels are mini word-stickers above fields, never placeholder-as-label. Phone-first: input type="tel" with a local placeholder; structured choices (wilaya, taille, créneau) in a select. Invalid: 2px rose border + a frank line ("Il nous faut ton numéro pour te rappeler !"). Success: LE TAMPON — a big rotated sticker slaps onto the form (scale 1.3→1, back.out(1.4), 0.3s) saying what actually happens next, with the visitor's name if given. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, wilaya, … }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads, fills or references.
- LA FRISE: a short aligned strip of 3–5 mini figurative stickers (star, heart, circle glyph) used as a section divider — maximum twice per page, always in a row, never scattered (scattered fields are TUTTI's confetti).
- FAVICON: inline SVG data URI — a lead-color circle sticker with a white halo ring on the sheet.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 8rem); content containers 1140–1280px; scene panels may stretch to 1360px but never bleed.
- Every section carries overflow-x: clip — entrance offsets and flying stickers start off-stage and must never widen the page at 390/768/1440.
- HEADER: sheet ground, sticky allowed, tiny drop as its only edge. Wordmark in the display face with one small color-dot sticker; 3–4 nav links in ink (hover: a mini sticker dot pops in before the word); ONE sticker-button CTA.
- FIXED OPENING (hero law): the first viewport must contain at least THREE stickers of THREE different shapes, one mot collé in the headline, and a real price or offer readable without scrolling. Hero families: LE GRAND COLLAGE (headline + sub + CTA on one side, an overlapping cluster of 2–4 drawn stickers + one badge on the other) or a composed variant from LES GESTES. Info mini-stickers row near the CTA with 2–3 honest facts.
- FIXED CLOSING: the form-as-sticker-page (split: warm promise + contact facts beside the white form sticker), then LE DOS DU CARNET — the ink back-cover footer: the brand as a giant word-sticker (white 8-direction halo text), the four color dots in a row, contact stickers with real hrefs (tel:, mailto:, maps, social), one honest legal line in sheet at 60% size.
- FREE MIDDLE (compose 3–5, never two adjacent sections with the same layout): la planche-vitrine (the sticker-sheet grid with its ghost gap) · la planche animée (the scrubbed showpiece) · l'album (product/service cards as white sticker pages with art zones and scallop badges, irregular grid — one card spans wider) · les vignettes à collectionner (numbered steps as round stickers popping onto ghost slots) · la question qui se décolle (FAQ as peel-flap rows) · le coin soulevé (one key card with a permanently half-peeled corner revealing a secret price or word).

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: peel & pop — short, small, cheerful. Every hidden state set via gsap.set, never in CSS; gate everything on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). JS dead → the album is already full: every sticker in place, the showpiece scene composed, the sheet showing its ghosts — a designed "already peeled" state, fully readable.
- Easing identity: back.out(1.2–1.45) for pops — NEVER above 1.45 (big overshoot and squash-and-stretch are GUIMAUVE's; gommette's pops are short and flat). power2.out for peels, settles and hovers. Durations: pops 0.32–0.5s, hovers 0.15–0.25s. Nothing exceeds 0.6s.
- ENTRANCES — the pop-on: a sticker scales from 0.72 with rotation from restAngle ± 4°, back.out(1.35), 0.4s, autoAlpha riding the scale. Staggers 60–100ms in reading order. Sections never fade as one block — stickers arrive one by one, like a kid placing them.
- SHOWPIECE TYPE — LA PLANCHE ANIMÉE (peel & place): ONE pinned scene per page (scrub 0.5, end +=1600–2200px). A sticker sheet on one side, a scene panel on the other; on scrub each sticker peels off the sheet (a −9° twist at 0.85 scale) and flies to its exact place in the scene (x/y computed from ghost slot to landing point, transform-proof, invalidateOnRefresh), settling flat at its rest angle. Each departure reveals the grey ghost beneath. The last sticker is the payoff (the price badge, the brand, the cherry). Below 900px: no pin — the scene arrives composed, stickers pop-on in view, ghosts visible on the sheet above.
- HOVER: the peel-corner curl (owned tic spec above) is THE hover — no color fades, no underline slides, no scale glides beyond the −2px lift. Keyboard and touch parity mandatory.
- Counters (ages, sizes, prices) pop through 4–6 stepped values (snap: 1) over 0.5s — a flip of album pages, not a glide.
- REDUCED MOTION: the composed page — showpiece at its final placed frame, ghosts visible, counters at final values, curls dormant. A designed still, never a blank.

## Gommette ban list (in addition to the global one)
- Hard BLACK offset shadows, 3–4px ink borders, marker highlights, clashing rotated price-chips — BLOC's language; gommette's edges are WHITE halos, its shadows tiny and soft, its prices in scallop badges.
- Puffy containers with inner-shadow "inflation", candy-stripe dividers, back.out(1.7) bounces and squash-and-stretch hovers — GUIMAUVE's language; gommette is die-cut FLAT, its pops short and small.
- Memphis confetti fields, squiggle underlines, zigzag dividers, colored offset shadows — TUTTI's language; gommette's minis stand in one aligned frise, its shadows ink-tinted only.
- Chrome/metal text, glossy aqua orbs, specular sheen — AN2000's language; nothing in gommette shines.
- Soft-shadow floating white cards on white as the card system — CLAIR's language; gommette's card is a die-cut sticker with a halo.
- Poster-ground section rotation — AFFICHE's language; the sheet never changes color.
- Torn edges, tape strips, ransom letters, misregistered print — FANZINE's language; gommette's cuts are clean.
- Pinned polaroids, pins, paperclips, handwritten annotations — CARNET's language.
- Gradients anywhere; inner shadows; backdrop-filter; glassmorphism.
- Ink outlines around drawn objects — the white halo is the only contour.
- Full-bleed sticker color; a section ground that is not the sheet (the ink back cover excepted).
- Photography or photoreal rendering; 3D shading; isometric perspective.
- Italic anywhere; thin letter-spaced luxury caps; grey body text.
- Free rotation outside the declared angle set; more than one ghost gap.
- Scattered decorative shapes with no halo and no meaning.

## LES GESTES (moves menu)
- LA PLANCHE ANIMÉE — the showpiece: sheet + scene pinned; stickers peel off one by one on scrub and place themselves into the scene, ghosts left behind, payoff sticker last. The world's whole story in one scroll.
- LE GRAND COLLAGE — hero as an overlapping cluster: one big drawn sticker + 1–2 smaller ones + a scallop badge, overlapping 12–24px at rest angles, beside the headline column.
- LE MOT COLLÉ — the inline word-sticker: one headline word on a rotated color chip. Doubles as the emphasis system everywhere (never bold, never italic — glued).
- LA PLANCHE-VITRINE — the sticker-sheet grid as a section (or a hero): categories/products as mixed-shape stickers on a white sheet panel, ONE peeled ghost gap with its joke caption.
- L'ALBUM — product cards as album pages: white sticker cards, tinted art zone with the drawn object, name in display, one spec line, scallop price badge overlapping the edge. Irregular grid — one card spans two columns.
- LE BADGE ÉTOILE — scallop/star badges carrying prices, counts or ages; on view they pop with a −8° twist settle; counters inside snap through stepped values.
- LES VIGNETTES À COLLECTIONNER — numbered steps as round stickers that pop onto waiting grey ghost slots in sequence — the collect-the-set moment; works for process, program, levels.
- LE COIN SOULEVÉ — one card with a permanently half-peeled corner (a white ::after fold at 30–40% size) revealing a secret on the back: the price, a promo word, a wink.
- LA QUESTION QUI SE DÉCOLLE — FAQ rows as sticker flaps: question on a pill sticker, answer beneath; opening lifts the flap corner and reveals the answer (answers visible by default with JS dead).
- LE TAMPON — the slap entrance: an element lands scale 1.3→1 with a small rotation settle (back.out(1.4), 0.3s), used for the form success and at most one hero beat.
- LA FRISE — the aligned strip of 3–5 mini stickers as a divider or a caption row; max twice per page.
- LA CHASSE — one tiny sticker hidden in a section (a mouse, a star); tapping it sticks it to a corner "collection" strip with a pop — a reward for the curious, never blocking anything.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- P'TIT BOUT (kids & baby shop, Oran) — GRAND COLLAGE hero: headline "Tout doux pour ton p'tit bout." with the mot collé in rose, beside a cluster of teddy + body stickers and a "Dès 900 DA" star badge. Showpiece: la planche animée — five nursery stickers (veilleuse, doudou, mobile, cadre, coussin) peel off the sheet and furnish a drawn nursery scene, ghosts left behind. Orange-led; planche-vitrine of categories with the "Déjà adopté !" gap; vignettes for the 3 order steps. Tender, generous.
- GLACES DODO (gelato, Alger) — TOTEM hero: one colossal centered cone sticker, headline stacked above, mini flavor stickers at the viewport's four corners, price badge planted on the cone. Showpiece: la tour — scoop stickers peel from a flavor sheet and STACK onto the cone one by one on scrub, the cherry slapping last (TAMPON). Rose-led; album of coupes with scallop DZD badges; coin soulevé on the "parfum du mois" card.
- CRÈCHE SOLEIL (kindergarten, Oran) — the hero IS a planche-vitrine: the first viewport is the activity sticker sheet (peinture, sieste, chansons, goûter…), ghost gap captioned "Cette place attend ton enfant.", headline on the sheet's top edge. Showpiece: la journée — a pinned timeline of grey ghost slots that activity stickers pop onto hour by hour on scrub, collecting the full day by 16h30. Sky-led; vignettes for inscription steps; voice extra-warm.
- PIZZA PICCOLO (pizzeria, Constantine) — CASCADE hero: the headline words tumble diagonally down the viewport as separate word-stickers ("La pizza", "que les enfants", "réclament."), a pizza sticker anchoring bottom-right. Showpiece: le grand décollage — one giant pizza sticker covers a pinned viewport and PEELS BACK across it on scrub (a growing white fold), revealing the menu board beneath; the fold completes, the price badges pop. Orange-led; coin soulevé reveals "la part surprise".
- SPLASH (swimming school, Oran) — PANORAMA hero: one wide pool scene sticker spans the hero, kid stickers in the water, headline overlapping its top edge. Showpiece: le plongeon — on scrub a diver sticker arcs from board into pool (curved x/y arc), splash stickers popping at entry, then three level badges (têtard, grenouille, dauphin) pop along the lane. Sky-led; vignettes as the levels ladder; badges carry ages.
- VÉTO COMPAGNON (veterinary, Alger) — PARADE hero: the headline above a marching row of animal stickers along the hero's bottom edge (cat, dog, rabbit, bird), each at a different angle from the set. Showpiece: la visite — a pinned exam scene where care stickers (stéthoscope, vaccin, câlin) arrive from off-canvas and apply onto a big cat sticker one by one, each stamping a leaf-green check badge. Leaf-led; la question for worried-owner FAQs; one honest line about prices.
- LA FÊTE DE LILA (event planner, Oran) — CARTE hero: the whole first viewport is ONE huge white invitation-card sticker rotated −2°, holding the headline, the date as a mot collé, mini party stickers at its corners. Showpiece: les guirlandes — a pinned party backdrop assembles as balloon and garland stickers pop in on a 90ms stagger, the date badge slapped center last (TAMPON). Rose-led; album of formules; la chasse hides a tiny cake sticker in the FAQ.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the HALO DISCIPLINE (every colored element die-cut in pure white — one naked color patch and the page stops being a sticker book and becomes a pastel template), LA PLANCHE (the sheet, the ghosts, the peel — the showpiece is the world's entire story; a GOMMETTE page without a peeled ghost is dead stock), and the FLATNESS (one gradient, one puff, one gloss and you have leaked into a neighbor's world). The cheap separators from a generated page: the ghost gap's joke caption, the peel-corner curl, the rotation set reused like a fingerprint, mini info-stickers carrying real facts, the TAMPON success saying what really happens next, one hidden sticker for the kid who scrolls everything. When in doubt, add one more sticker and one more honest word — abundance and honesty are this world's charm.`,
	energy: "loud",
	family: "neobrutalism",
	// guimauve: puff meets sticker — the full kids universe.
	// bloc: the sticker grows teeth — teen commerce.
	fusesWith: ["guimauve", "bloc"],
	id: "gommette",
	industries: [
		"kids & baby shop",
		"kindergarten / crèche",
		"swimming school",
		"music school",
		"veterinary",
		"gelato / desserts",
		"fast food",
		"pizzeria",
		"multi-product shop",
		"food delivery brand",
		"event planner",
		"dance studio",
		"private school",
	],
	kind: "website",
	mood: ["joyful", "playful", "tender", "bright", "die-cut"],
	name: "Gommette",
	priceFeel: "accessible",
	preview: {
		accent: "#FF9F1C",
		fontFamily: "Baloo 2",
		ground: "#FDF8F0",
		ink: "#23201C",
		sampleWord: "Youpi !",
	},
	tagline:
		"Le carnet d'autocollants : tout est sticker, halo blanc, joie découpée.",
};
