import type { DesignWorld } from "../types";

/**
 * CATALOGUE — the stark gallery e-shop.
 * The minimal design-object commerce world: pure white, one grotesque, one mono,
 * product-on-seamless photography on plinth plates, SKU register captions under
 * everything, and a catalogue that re-sorts itself once. Photography is LAW here.
 * fusesWith rationale: ecrin (the ivory void lends its stillness to a shop that
 * must still price things), silhouette (B/W fashion editorial meets the ruthless
 * grid — lookbook + rayon), poudre (cosmetic macro texture sold on a plinth).
 */
export const catalogue: DesignWorld = {
	avoidFor: [
		"dentist",
		"general practitioner / cabinet",
		"aesthetic clinic",
		"medical lab / analyses",
		"lawyer / law firm",
		"notary",
		"insurance agency",
		"HVAC / climatisation",
		"general contractor",
		"kindergarten / crèche",
		"street food / food truck",
	],
	doc: `# DESIGN WORLD: CATALOGUE — the stark gallery e-shop

## Philosophy
This page is a SHOP WINDOW ON A WHITE WALL, not a website. Objects stand alone on seamless plinths, lit once, photographed once, labelled like museum pieces that happen to have a price. First structural fact: PHOTOGRAPHY IS LAW and it is always product-on-seamless — one object, an off-white sweep, one hard contact shadow, no props, no hands, no room. Second: EVERY object carries a SKU register caption in mono (reference, material, dimension, price) — no image is ever mute. Third: the page is COMMERCE, not a gallery brochure — a dense priced index, stock states, an honest way to reserve; a CATALOGUE page with no prices on it has failed. Geometry is square: every frame, field and button uses min(var(--radius), 0px) — this world's corners stay cut. Impossible failure modes: a warm decorative page (the only colour is one functional hue, used three times); a page carried by illustration (there are no drawings at all); an atmospheric page with no numbers. Self-audit before shipping: (1) every product on the page has a mono SKU caption containing a reference and a price in DZD; (2) zero border-radius anywhere except the 5px stock dot; (3) zero box-shadows on any element (only the inset 1px plinth foot rule); (4) at least two photographs offer an alternate angle on hover AND on focus AND on tap; (5) the page reads as a catalogue with the stylesheet's colours stripped to black on white.

## The variation contract (why two CATALOGUE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Pure #FFFFFF ground, #131313 ink, greys only for support, ONE functional colour used three times maximum.
- Product-on-seamless plinth photography with the object's single hard contact shadow preserved, on SQUARE plates — no mask, no radius, no frame.
- SKU register captions under every product; a neutral grotesque for display and body, mono for captions, and mono NEVER sets prose.
- Catalogue snap motion: opacity-only entrances, one scrubbed re-sort, zero parallax, zero drift.
- Honest commerce: real prices, real stock states, a reservation that promises only what a shop can keep.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The grey register (#6B6B6B can move to #767676 or #5E5E5E) and the FUNCTIONAL COLOUR: deep green #2E4E3F, oxblood #5C1F1F, ink-blue #1B3358 or burnt orange #A3441C — one per site, only for stock, cart and success.
- The faces within the register: Hanken Grotesk or Instrument Sans; DM Mono or Martian Mono.
- The COUNTING NOUN driving the page — la vitrine, le rayon, la série, le lot, la pièce — it names the hero head, the index, the showpiece and the reservation.
- The photographic subject family (ceramics, leather, glass, garments, jewellery, jars), the section order beyond the fixed opening and closing, and which geste carries the scrub.
Name the counting noun FIRST, then let it number the page ("3 / 38", "Vitrine 03", "Série 12").

## The vibe (voice)
Shopkeeper's French: flat, exact, slightly dry, never selling. Facts persuade — a material, a measurement, a delay, a price — and every declarative carries a number where it can. Register: "Trente-huit pièces en rayon. Chacune est photographiée sur fond nu, mesurée, numérotée, et vendue au prix écrit." · "Les prix ne bougent pas et il n'y a pas de solde. Quand une pièce part, la ligne reste et passe en épuisé jusqu'au réassort." · "Elle a été dessinée pour tenir dans un couloir d'appartement algérois : quarante-sept centimètres, pas un de plus." Never "unique", never "exceptionnel", no exclamation mark, no discount, no countdown. Social proof is ONE static quote, verbatim, with the buyer's commune and the reference they bought.

## Visual signatures (what makes it instantly recognizable)
- THE PLINTH PLATE — OWNED TIC ①: every product sits on a 3:4 plate filled with the seamless tone (#EDEAE3 register, #E5E1D8 on the seamless band), photo \`object-fit: cover\`, square corners, no frame, no radius, no shadow. Its only ornament is \`box-shadow: inset 0 -1px 0 rgba(19,19,19,.12)\` — the plinth's front edge. The object's own hard contact shadow is preserved by the grade.
- SKU REGISTER CAPTIONS — OWNED TIC ②: under EVERY product, mono 10.5px, uppercase, +0.045em, line-height 1.45, grey #6B6B6B with the price in ink at weight 500 — "Réf NV-013 · Grès chamotté / Ø 21 · H 42 cm · **14 800 DA**", two lines, price always last. A stock dot (5px square, functional colour, grey when sold out) may open the line. No product exists without one.
- ALTERNATE-ANGLE SWAP — OWNED TIC ③: two stacked \`<img>\` of the same asset; the lower is the alternate crop (\`transform: scale(1.36)\` + a per-product \`object-position\`, e.g. 52% 26% for a tall vessel, 50% 62% for a seated object); the upper fades out over 0.35s linear on \`:hover\`, \`:focus-visible\` and \`.is-alt\`. The plate is a \`<button aria-pressed>\` so pointer, keyboard and touch all get the second view. A persistent 9px mono chip ("2 vues") sits top-right as the affordance — never a hidden hover-only hint.
- THE RULE SYSTEM: horizontal hairlines only. Ink at 16% (\`rgba(19,19,19,.16)\`) opens and closes every band; ink at 9% separates index rows; a solid #131313 1px rule sits under any head governing a table. Vertical hairlines exist ONLY inside a multi-column ledger band, never as a page-wide column grid.
- THE LEDGER BANDS: four-cell hairline bands (practical facts in the hero, the four rules near the footer) with an ink top rule, cell padding 14px, mono label 9.5px +0.13em over a 13.5–15.5px sans value. THE REFERENCE STRIP: a slim mono row of SKUs across the container, closing the hero — inventory read as texture.
- Numbers are the largest non-headline element: a followed piece states its price in mono at clamp(2rem, 4.4vw, 3.2rem), tracking -0.03em, any chip beside it optically levelled — baseline-aligned, then nudged down 1.2% of the numeral's size so both ink bottoms land on one line.

## Color physics
- GROUND: pure #FFFFFF. Not off-white, not warm white — the wall must be paper.
- SEAMLESS: #EDEAE3 (register #EDEAE3/#E5E1D8) — the photographic sweep extended into CSS. It fills plinth plates and exactly ONE full-bleed band per page (usually the quote band). It is the world's second ground, never a card or a button.
- INK: #131313, never pure black. GREY: #6B6B6B for all secondary text, captions, labels and inactive rules — two greys maximum on a page.
- FUNCTIONAL COLOUR: one only, deep green #2E4E3F by default. BUDGET: exactly three roles — the stock dot, the cart counter and reserved state, the success panel. Never in a headline, a rule, a wash, or a hover fill on anything that is not a cart control.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · FUNCTIONAL COLOUR→--primary · GROUND→--primary-foreground · SEAMLESS→--secondary · INK→--accent · GREY→--muted · ink at 16%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- GRADIENTS DO NOT EXIST — not in backgrounds, borders or type. Light lives inside the photographs.
- Contrast law: ink on white ≥ 15:1; grey on white is 5.4:1 and forbidden below 10px — mono captions never go under 9px, and 9px is the corner chip only.

## Typography system
- DISPLAY + BODY: Hanken Grotesk (default) or Instrument Sans — one neutral grotesque doing both jobs, weights 400/500/600, 500 for every headline. Never a serif, never italic.
- Hero claim: clamp(2.4rem, 5.4vw, 4.75rem), line-height 0.95, tracking -0.042em, max 13ch. Section titles clamp(1.8rem, 3.7vw, 3.1rem), 1.02, -0.032em, max 19ch; wall-label variant clamp(1.45rem, 2.3vw, 2rem). Display never exceeds 10vw — fit-to-viewport is AFFICHE's, 15–25vw word-structures are MANIFESTE's.
- Body 16px, line-height 1.62, measure 46–52ch; notes and specs 13.5–14.5px.
- MONO: DM Mono (default) or Martian Mono, 300–500 — references, prices, dimensions, stock, labels, kickers, table headers, rule numerals, footer. It NEVER sets prose beyond one line and never sets a headline. Micro register 10.5px +0.055em uppercase; kickers +0.14em; corner chips 9px +0.1em; rule numerals clamp(1.1rem, 1.7vw, 1.45rem) in ink.
- ARABIC PAIRING (this world may serve Arabic pages): prose and headlines in IBM Plex Sans Arabic 400–600 at the same clamps; SKU captions stay in the Latin mono; prices as "4 200 دج" with Western-Arabic digits. In RTL the grid mirrors, captions align right, and each alternate-angle \`object-position\` mirrors its horizontal value.

## Signature art (the photography law) & components
Photography is LAW: this world's imagery is product still-life and nothing else. Zero illustration, zero icons, zero drawn scenes, zero lifestyle or people.
- SUBJECT: ONE object per frame, centred or near-centred, shot straight on or at a shallow angle, standing on the surface it casts its shadow onto, against a seamless off-white sweep with a visible soft horizon; the contact shadow falls left or right and is never retouched out.
- ART-DIRECTION PHRASE — reuse VERBATIM in every generation prompt: "minimal product still-life on seamless off-white background, single soft contact shadow, gallery lighting, no text".
- GRADE (law): \`filter: contrast(1.03) saturate(.94)\` on every photograph, plus a unifying tint over each plate — a \`::after\` at \`inset: 0\` filled #E7DFCF, \`mix-blend-mode: color\`, 0.17 opacity. This pulls a cool glass frame and a warm leather frame into one studio. Never B/W (SILHOUETTE's grade), never warm-golden (ÉCLAT's), never duotoned.
- FRAMING: square plates only — 3:4 for a catalogue cell, 1:1 for a followed piece on wide screens, 4:5 folded to one column with \`max-height: 80vh\`.
- Type NEVER sits on a photograph. Captions live under the plate; the only thing permitted over a plate is the 9px "2 vues" corner chip on white.
- BUTTONS: square, 1px border. Primary = ink fill, white mono label, padding 12px 20px, inverting to white-on-ink-outline on hover/focus. Reserve controls = 1px hairline, mono 10px, padding 7px 11px; hover fills ink; \`aria-pressed="true"\` fills the functional colour.
- FORMS: no boxes. Each field is a 9.5px mono label over a borderless input with a single 1px hairline underneath; hairline and label go ink on \`:focus-within\`. Phone-first (a \`type="tel"\` input high in the order), a \`select\` for the structured choice (commune, retrait ou livraison). On valid submit dispatch the \`wandit:lead\` CustomEvent on \`document\` with the visitor's fields flat in \`detail\` (nom, telephone, commune, retrait, message) plus the reserved references and the total; include one off-canvas decoy input carrying \`data-wandit-hp\` that the page's own script never reads or writes. The success state is a panel bordered 1px in the functional colour stating exactly what happens next: "Vos pièces sont mises de côté pour 48 heures à votre nom. On vous appelle avant 18 h."
- CARDS DO NOT EXIST: a "card" here is a plate plus a caption plus a control — no container, no border, no shadow.
- \`::selection\` ink ground with white text. \`:focus-visible\` 2px #131313 outline, offset 3px. One h1, semantic landmarks, real French alt text on every photograph, decorative SVG \`aria-hidden\`, a polite live region on the cart total.
- Favicon: inline SVG data URI — a white ground, an ink vessel silhouette, one grey 1.6px contact-shadow bar under it.

## Page chassis
- Container max-width 1400px; gutter clamp(18px, 3.4vw, 48px); band padding-block clamp(3.4rem, 7vh, 5.6rem); every band opened by a full-bleed 1px ink-16% rule; \`scroll-margin-top: 72px\` on every anchored section.
- HEADER: sticky, white, 64px, one hairline bottom. Wordmark 19px sans 600 at +0.1em beside a 10px mono descriptor; mono nav links underlining on hover and focus; a square cart chip right, its count taking the functional colour once non-zero. Nav collapses below 640px and the chip takes the right edge.
- FIXED OPENING (hero law): the first viewport always holds (1) the claim as the one h1, (2) at least one plinth plate with its SKU caption, (3) a ruled ledger band of four practical facts (stock, delivery, pickup, payment), (4) one reference strip or equivalent mono texture. Their COMPOSITION is client-owned — pick a hero geste.
- FIXED CLOSING: the counter — a two-column band with the réservation récapitulatif (list, total in DZD, one honest limit line) beside the underlined form, then a four-column mono footer (boutique, adresse, ouverture, contact) over a solid ink rule, closed by a legal line and a "prix en DZD, TVA comprise" line.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent sections with the same skeleton:
  · LE RAYON — the priced index: a sticky wall label beside a hairline table on six tracks (88px ref / 1.35fr name / 1fr material / 122px dimension / 116px price / 92px state), rows padded 15px, hover filling the seamless tone, sold-out rows dropping to grey with a struck price; folds at 999px into a two-track block (ref+state, name+price, material+dimension).
  · LA VITRINE — a plinth grid: six across on wide screens, three at 1100px, two at 620px.
  · LA PIÈCE SUIVIE — one object bleeding to a viewport edge, spec ledger, giant mono price and reserve control beside it.
  · LE RÈGLEMENT — a four-column ruled band of shop rules with mono numerals as column heads.
  · LA PAROLE — the seamless full-bleed band: one static quote at clamp(1.5rem, 3.5vw, 2.9rem) in 25ch, attribution in mono with the reference bought, one small plinth at 236px.
  · LE BANDEAU — a slim mono strip of references, dates or sizes across the full width, closing a band.

## Motion identity (CATALOGUE SNAP)
GSAP 3.12.x + ScrollTrigger via cdnjs UMD, everything gated on \`(window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches)\`. Hidden states are set ONLY through \`gsap.set\` — CSS never hides anything, and the page is complete with JS dead.
- THE LAW: entrances are OPACITY ONLY. Nothing slides, nothing rises, nothing scales, nothing drifts, nothing parallaxes. Duration 0.35–0.45s (measured: 0.42s power1.out for blocks, 0.38s linear for index rows), stagger 0.045–0.055s. The page is near-still on purpose: a catalogue does not perform.
- EASING: power1.out and \`none\` for entrances, power1.inOut for the one re-sort. Overshoot is forbidden wave-wide; back.out is GUIMAUVE's.
- HOVER: 0.25–0.35s colour transitions only (ink fills, hairlines darkening, the seamless row fill), plus the alternate-angle crossfade. No lifts, no scale, no glow. Every hover has keyboard and touch parity through \`:focus-visible\` and an \`aria-pressed\` toggle.
- SHOWPIECE — exactly one per page, scroll-scrubbed. Seed: LE RANGEMENT. The plinth grid re-sorts itself once, arrival order → price ascending, by translating each cell from its measured slot to its target slot (slots read with \`offsetLeft/offsetTop\` inside a \`position: relative\` grid, so a resize rebuilds them). Scrub 0.45; pinned when the viewport is at least 1000×620 with \`end: "+=110%"\`, otherwise unpinned from \`top 60%\` to \`bottom 46%\` — late on purpose, so ordinary scroll depths never catch the folded grid half-emptied. On a single row (six across) the cells shuffle TOGETHER — stagger 0.05, duration 1. On a folded grid they move ONE AT A TIME — stagger 0.62, duration 0.52 — so no still frame ever shows two plates crossing. Order the moves along the permutation's cycle starting at the LAST slot, each cell landing on the slot the next one is about to leave: exactly one slot is vacant at any moment and it is always the last. The travelling cell takes \`zIndex: 40\` for its flight, then returns to a base z-index ranked by travel distance. A 1px progress hairline between the two sort labels draws \`scaleX\` 0→1 across the span while the labels exchange opacity (1 ↔ 0.3) at 42% of it. That rule and that crossfade are the only motion on the page that is not a plain fade.
- REDUCED MOTION: nothing is hidden, the grid holds its arrival order, both sort labels read at full strength and the progress rule reads as a plain connector. The still page is the composed page.

## Ban list (the global ban list applies; these are CATALOGUE-specific)
1. The plumb line, roman-numeral section markers, and floating letter-spaced micro-caps on bare ground — ECRIN's tics; here every label is anchored to a rule, a plate or a table.
2. The single sumi-e ink stroke, vertical writing-mode labels on hairlines, and off-centre \`ma\` composition — WABI's tics; CATALOGUE's emptiness is a wall, not a void.
3. Type-over-photo collision, mixed-scale lockups, one crimson accent word per viewport, and B/W photography — SILHOUETTE's tics.
4. The die-cut sticker halo, peel-corner hovers and sticker-sheet grids — GOMMETTE's tics.
5. Hard offset shadows, 3–4px solid borders on everything, and clashing rotated price-chips — BLOC's tics; CATALOGUE prices are typography, never chips.
6. Caption plinths — small raised plates overlapping a photo corner — MAISON's tic; captions live under the plate, on the wall.
7. The property meta hairline strip pinned to a photograph's bottom edge — DOMAINE's tic; nothing is ever pinned onto an image here.
8. Deep-rounded warm masks (28–48px) — ÉCLAT's; letterbox 21:9 bars and Ken-Burns scrubs — GÉNÉRIQUE's; halftone-dot imagery — GAZETTE's.
9. Project index rows with a floating hover thumbnail — STUDIO's tic; the index here never previews, it prices.
10. Shelf line-ups on a drawn shelf rule — BOULANGE's; the numbered index spine that fills as sections pass — CAPITALE's; contact-sheet strips and EXIF chips — PHOTOGRAPHE's; exposed page-wide column rules and the oversized red circle — GRILLE's.
11. Soft-shadow floating cards — CLAIR's; alternating black/white section inversions — MANIFESTE's; rotated crossing marquees and machine-telemetry voice — CINÉTIQUE's.
12. Any border-radius above 0 except the stock dot; any box-shadow other than the inset plinth foot; serif or italic type; mono setting prose.
13. Lifestyle photography, models, hands, room sets, props beside the object, cut-outs with no shadow, and any two photographs on one page whose grades do not match.
14. Sale badges, strikethrough promo pricing, urgency counters, star-rating rows, testimonial carousels, and any product shown without a price.

## LES GESTES (moves menu)
1. LA DEVANTURE — hero: the claim and two CTAs on the left column (41%), a ruled head ("En vitrine cette semaine · 3 / 38") over a row of three plinths on the right (59%), the whole closed by a full-width four-cell ledger band and a reference strip.
2. LE RAYON RÉGLÉ — the priced index with a sticky wall label; the label follows the table down so the left column is never empty, and stops at the table's foot.
3. LE RANGEMENT — the showpiece: the plinth grid re-sorting itself once on scrub between two named orders, the progress hairline drawing between the labels.
4. LA PIÈCE SUIVIE — one object bleeding to a viewport edge on a 1:1 plate, SKU caption on a hairline beneath, a five-row spec ledger beside it, the giant mono price and reserve control under that.
5. LE MUR DE SIX — a plinth wall of six with captions and no titles, used as a breath between two dense bands; on scrub the plates simply arrive in price order, opacity only.
6. LE COMPTOIR — the closing: récapitulatif list, total in DZD over a solid rule, one honest limit line, and the underlined form beside it.
7. LE RÈGLEMENT — four shop rules in a ruled band with mono numerals as heads, closed by a line stating the same rules are posted at the counter.
8. LA PAROLE UNIQUE — the seamless band: one buyer quote at 25ch with the reference they bought, one small plinth at the right, vast air between them.
9. LE DIPTYQUE DE MATIÈRE — two plates at different aspect ratios side by side (3:4 and 1:1) sharing one caption line that names both references.
10. LE BANDEAU DE RÉFÉRENCES — a slim mono strip of SKUs, sizes or dates spanning the container, count pushed to the right edge.
11. LA COUPE — a plate whose DEFAULT state is the tight alternate crop, beside the same object's full view; the pair teaches the swap.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. "TRENTE-HUIT" (multi-product concept store) — Hero: LA DEVANTURE — claim left, three plinths right under a ruled head, ledger band and reference strip closing it. Showpiece: LE RANGEMENT — six plates re-sort from arrival order to price ascending across one row. Order: devanture → rayon → rangement → pièce suivie → règlement → parole → comptoir. Mood: the flagship — dense, priced, unsentimental.
2. "LIGNE 01" (fashion boutique) — Hero: a full-width wall of five garment plates at 4:5 filling the first viewport, claim beneath them as one mono strip, no text column at all. Showpiece: LA TAILLE — a pinned size table whose rows fill one by one on scrub while the plate beside it swaps to its alternate angle at each row. Order: mur-hero → taille → rayon → parole → règlement → comptoir. Mood: the coldest sibling — measurements as seduction.
3. "GRÈS & VERRE" (home & decor shop) — Hero: the claim alone on white with only the reference strip beneath it; no photograph in the first viewport, the first plate arriving one scroll later. Showpiece: LA COUPE pinned — the tight crop slides open to the full view while the SKU caption rewrites itself from detail to whole. Order: hero-texte → mur de six → coupe → pièce suivie → règlement → comptoir. Mood: the most austere — the shop makes you wait for the object.
4. "OR MAT" (jewellery brand) — Hero: one small plate (240px) low on the left, the claim running along the viewport's top edge, white doing 80% of the work. Showpiece: LE MUR DE SIX assembling — six plates fade in one by one in price order, opacity only, no travel, while the running total climbs beside them. Order: hero-minuscule → rayon → mur → parole → règlement → comptoir. Mood: the quietest — scale as luxury.
5. "DROP 04" (streetwear / drops) — Hero: the priced index IS the hero — the ruled catalogue fills the first viewport with the claim demoted to its wall label. Showpiece: LE BANDEAU pinned — a reference strip scrubs sideways while, above it, a single plate swaps to the piece the strip has reached. Order: rayon-hero → bandeau → mur de six → pièce suivie → règlement → comptoir. Mood: the fastest-reading sibling — inventory as identity.
6. "L'ÉPICERIE" (grocery / gourmet) — Hero: a band of nine tiny plates (110px) above the claim, a shelf of jars read as one texture. Showpiece: LE COMPTOIR assembling — the récapitulatif builds itself line by line on scrub, each line pulling in its thumbnail while the total climbs. Order: étagère-hero → règlement → rayon → comptoir → parole → contact. Mood: the busiest — repetition as abundance.
7. "ATELIER SOIXANTE" (interior design / home staging) — Hero: LA PIÈCE SUIVIE as the opening — one object full-bleed left, spec ledger right, no statement block; the claim is the object's name. Showpiece: LA DOUBLE VUE — a pinned pair of plates swapping to their alternate angles in sequence while their two SKU captions exchange positions. Order: pièce-hero → rayon → double-vue → parole → règlement → comptoir. Mood: the most editorial — one object argued at length.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails. (1) THE GRADE AND THE PLATE — every photograph on one seamless, one grade, one square plate; a single frame with a different background tone or a lifted shadow turns the shop into a marketplace listing. (2) THE CAPTIONS — an object without its reference, material, dimension and price is not merchandise, and a page whose photographs are mute is a moodboard. (3) THE STILLNESS — the moment something drifts, parallaxes or bounces, the wall becomes a website; the one re-sort is the entire motion budget and it must be worth watching. The cheap details that separate this from a generated page: the "2 vues" chip that promises a second angle and delivers it to keyboards too, the inset 1px plinth foot under every plate, the sold-out row that keeps its line and strikes its price, the reference strip closing the hero, and the success message that says exactly how long the shop will hold the piece.`,
	energy: "quiet",
	family: "mono-commerce",
	fusesWith: ["ecrin", "silhouette", "poudre"],
	id: "catalogue",
	industries: [
		"multi-product shop",
		"home & decor shop",
		"fashion boutique",
		"jewelry brand",
		"streetwear / drops",
		"cosmetics / skincare brand",
		"cosmetics brand",
		"grocery / gourmet",
		"electronics / gadgets",
		"COD product landing (single product)",
		"interior design / home staging",
	],
	kind: "website",
	mood: ["stark", "gallery-clean", "precise", "catalogued"],
	name: "Catalogue",
	preview: {
		accent: "#6B6B6B",
		fontFamily: "Hanken Grotesk",
		ground: "#FFFFFF",
		ink: "#131313",
		sampleWord: "VITRINE — 03",
	},
	priceFeel: "premium",
	tagline: "La galerie qui vend : fond nu, grille implacable, prix écrits.",
};
