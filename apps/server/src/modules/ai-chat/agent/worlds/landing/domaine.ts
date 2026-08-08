import type { DesignWorld } from "../types";

/**
 * DOMAINE — estate-prestige.
 * The luxury property site (Sotheby's / Christie's register) done LIGHT:
 * ivory ground, bronze hairlines, dusk photography carrying all the color.
 * Values below were measured on the shipped demo (Domaine Les Palmiers,
 * Club des Pins, Alger) — none is invented.
 * fusesWith: maison (the interior half of the same house), ecrin (the same
 * hush with a centered spine), voeu (the same dusk light, for a wedding estate).
 */
export const domaine: DesignWorld = {
	id: "domaine",
	name: "Domaine",
	family: "domaine",
	tagline:
		"L'ivoire et le bronze : la propriété de prestige, photographiée au crépuscule.",
	kind: "website",
	mood: ["ivory", "hushed", "patrician", "photographic", "dusk"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"real estate agency",
		"property developer / promoteur",
		"single property showcase",
		"vacation rentals",
		"property management",
		"commercial real estate",
		"interior design / home staging",
		"hotel",
		"guesthouse / riad",
	],
	avoidFor: [
		"street food / food truck",
		"fast food",
		"kids & baby shop",
		"kindergarten / crèche",
		"gym / fitness club",
		"streetwear / drops",
	],
	fusesWith: ["maison", "ecrin", "voeu"],
	preview: {
		ground: "#F6F3ED",
		ink: "#26221B",
		accent: "#8A6D3F",
		fontFamily: "Prata",
		sampleWord: "Le Domaine",
	},
	doc: `# DESIGN WORLD: DOMAINE — the estate presented on ivory paper

## Philosophy
This page is a PROPERTY FOLIO, not a website: the presentation binder a good promoteur puts on the table when the visit is over — ivory stock, a hairline ruled around every plate, eight photographs taken at the same twenty minutes of dusk. Two structural facts govern everything. FIRST: the photographs carry all of the color and the UI carries none — ivory ground, brown-black ink, one bronze, hairlines. Remove the images and the page is a quiet ruled document; add them and it is warm and specific. SECOND: every photograph is a SQUARE-CORNERED APERTURE — a 1px #26221B/12% frame, never a rounded mask, never a bar-letterboxed band — and every aperture carries furniture: a reference strip welded to its bottom edge and, when there is a price to state, an ivory plate straddling a top corner.

Impossible here: the dark-gold luxury cliché (this world is LIGHT); white type centered over a dimmed photograph; a rounded card with a soft shadow; a hero that says "prestige" without a surface, an orientation or a price. A DOMAINE page states the m², the rooms, what the window sees, and a price or an honest "sur demande" — that honesty IS the luxury.

Self-audit (all countable): (1) zero rounded corners on media, plates, buttons or fields; (2) every photograph identically graded and warm-lit against a cool sky; (3) at least two reference strips and one price plate; (4) exactly one scrubbed showpiece; (5) no micro-cap label floating on bare ground; (6) the page reads as a finished document with JavaScript disabled.

## The variation contract (why two DOMAINE sites are siblings, never clones)
WORLD LAW — never renegotiated:
- Ivory grounds, brown-black ink, ONE bronze. Photography is the only color. No dark sections, no inverted interludes.
- Square corners everywhere — buttons, plates, fields and apertures use min(var(--radius), 0px), the geometry stays square; the 1px ink/12% photographic frame; the hairline as the only rule weight the page owns.
- The three tics: the reference strip, the dusk grade, the serif price plate (specs below). All three visible on every build.
- A high-contrast serif display (Prata register) against a plain humanist sans (Mulish register). Never a second display face.
- Estate glide motion: 1.2–1.6s power1.inOut lifts, no overshoot, no snap, no Ken-Burns.
- Real numbers: surfaces, room counts, orientation, delivery date, and a price or an honest "sur demande".
CLIENT-OWNED — where siblings diverge:
- The ivory pair inside the register (#F6F3ED/#F1EDE4 · #F5F1E8/#EFEAE0 · #F7F4EE/#F2EEE5) and the bronze (#8A6D3F / #7E6338 / #8F7442).
- The display face within the register: Prata, Cormorant Upright, Gilda Display where free.
- The DRIVING NOUN — le parc, la côte, la pinède, le silence, la vue — it names the hero photograph, the showpiece and the copy. Choose it first.
- The photographic subjects, the section order beyond the fixed opening and closing, which gestes are played, film hero or still hero.
- The business: promoteur, agence, villa unique, location saisonnière, hôtel particulier. The furniture never changes; the strip's vocabulary does (SURFACE · CHAMBRES · VUE · RÉF for a villa, NUITS · CHAMBRES · VUE · SAISON for a rental).

## The vibe (voice)
Patrician French, short, factual, never salesy. State the fact, then stop. Numbers are welcome; adjectives are rationed to one per paragraph. Honesty is this register's proof of wealth: say what is unfinished, say what is reserved, refuse the countdown.
- « Douze villas dans une pinède de trois hectares. »
- « Le parc existait avant nous. Nous avons posé douze maisons entre les pins, sans en abattre un seul. »
- « Nous ne mettons pas de compte à rebours : téléphonez, nous vous dirons l'état réel du jour. »
Forbidden: "luxe", "prestige", "haut standing", "opportunité", exclamation marks, any sentence a brochure generator could produce.

## Visual signatures (the measured law)
- **LA BANDE DE RÉFÉRENCES (owned tic 1).** A four-cell hairline strip welded to a photograph's BOTTOM EDGE — absolute, left/right/bottom 0, ivory at 96%, border-top ink/12%, cells divided by ink/12% verticals. Each cell: a 9px/1.55, 0.19em uppercase bronze key over a Prata value at clamp(.86rem,1.05vw,1.06rem) set .12rem beneath it, padding .62rem clamp(.55rem,1.3vw,1.1rem) .68rem; measured height ≈ 57px; folds to 2×2 below 700px. It is the page's spine of facts: SURFACE · CHAMBRES · VUE · RÉF on a property, PIÈCE · SURFACE · ORIENTATION · NIVEAU on a room.
- **LA LOI DU CRÉPUSCULE (owned tic 2).** Every photograph is dusk: warm interior/window glow against a cool violet or rose sky. Graded in CSS so the set sits in one palette — filter: saturate(1.05) contrast(1.02) plus a rgba(138,109,63,.04) overlay on a ::after at inset 0. No image escapes it, including a video poster. Photos with a midday sky are rejected, not corrected.
- **LA PLAQUE DE PRIX (owned tic 3).** An ivory plate, 1px ink/24% border, padding .8rem clamp(.9rem,1.6vw,1.35rem) .95rem, max-width min(70%,340px), STRADDLING a photograph's top corner (top:-22px, left or right at clamp(16px,3–4vw,36–56px)). Inside: a 10.5px/0.2em bronze micro-cap line over a Prata figure at clamp(1.1rem,1.75vw,1.62rem) — "98 000 000 DA" or "Sur demande". FLAT: no shadow, no lift. The strip owns the bottom edge, the plate the top corners; a bottom-corner plate is allowed ONLY on a photograph with no strip (the quote band).
- **Hairline discipline.** Two weights: ink/12% for frames, cell rules and table rows; ink/24% for label rules, plate borders, field underlines and the closing table rule. Bronze is a rule exactly twice per page (footer rule, showpiece progress rail). Nothing exceeds 1px except the 3px scrub fill.
- **Labels are always attached.** Micro-caps sit on a hairline (border-top, padding-top .85rem), in a strip cell, or on a plate — never floating on bare ground, which is ECRIN's tic.
- **Ledgers instead of cards.** Facts live in hairline key/value rows (key 9.5px/0.18em bronze caps, value Prata clamp(.98rem,1.15vw,1.14rem), padding .85rem 0, border-bottom ink/12%) — never boxes with icons.
- **The monument close.** The estate's name at clamp(2rem,8.6vw,7.4rem)/.94 under a bronze rule, legal line beneath a second hairline.

## Color physics
- GROUND A: the #F6F3ED / #F5F1E8 register (warm ivory). GROUND B: 4–7 RGB points deeper, the #F1EDE4 / #EFEAE0 register. Sections alternate A/B; the alternation is the only sectioning device besides full-bleed photography. There is NO third ground and NO dark section.
- INK: #26221B, a brown-black — never #000. Body at 72%, captions at 55%, hairlines at 12% and 24%.
- BRONZE: the #8A6D3F / #7E6338 register. Budget per page: micro-cap labels, ledger keys, the scrub rail, ONE footer rule, the wordmark's second word, hover underlines, focus rings. Never a bronze fill larger than a 3px bar, never gold — foil small-caps are GÉNÉRIQUE's, gold line-art is ORFÈVRE's.
- Photo matte #E6E0D4 sits behind every aperture so a slow-loading image reads as a warm plate.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · BRONZE→--primary · GROUND A→--primary-foreground · GROUND B→--secondary · photo matte→--accent · ink at 55%→--muted · ink at 12%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, wash or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Gradients: NONE, anywhere. The 4% bronze photographic wash is flat and is the page's only overlay.
- Every saturated color comes out of the photographs: rose sky, violet dusk, tungsten light.

## Typography system
- DISPLAY: a high-contrast serif — **Prata** (default), Cormorant Upright, or Gilda Display where unclaimed. One weight (400). Used for headlines, all numerals of consequence (prices, m², distances, references, phone), strip values, ledger values, room names and the footer monument. NEVER italic; emphasis is bronze or nothing.
- BODY: a plain humanist sans — **Mulish** (default) or Karla. 400 for prose, 600 for micro-caps, 17px/1.7 base. Mono is banned: this world does not speak machine.
- Scale (measured): h1 clamp(2.3rem,5.7vw,4.7rem)/1.05, tracking -0.012em, three short hand-broken lines maximum. Section titles clamp(1.85rem,3.5vw,3.15rem)/1.1; sub-heads clamp(1.25rem,1.9vw,1.65rem); lede clamp(1.02rem,1.15vw,1.2rem)/1.62 at 46ch; prose 60ch; captions .88rem at ink/55%.
- Display type never exceeds ~10vw nor fills the viewport width — fit-to-viewport caps are AFFICHE's, 15–25vw words-as-structure are MANIFESTE's.
- Micro-caps: Mulish 600, 10.5px, 0.2em (9–9.5px in strips and ledgers), always attached to a rule or a cell. Accents survive capitalisation: RÉF, PIÈCE, SÉJOUR, never REF or PIECE — a micro-cap inside an overflow:hidden cell needs line-height ≥1.5 (1.55 at 9px) or the raster clips the diacritic.
- Numerals: Prata, spaced in the French manner ("98 000 000 DA", "320 – 610 m²"), non-breaking spaces before units, in hour ranges ("18 h – 20 h") and inside a month + year ("décembre 2027") so a delivery date never breaks in two.
- Arabic pairing: **Amiri** for display and body, ink and hairlines unchanged; strip cells reverse to RTL with the same rules; micro-caps become Amiri 600 with tracking reset to 0.

## Signature art — the photographic direction (this world is photographic; it draws nothing)
- Art-direction phrase, reused verbatim in every generation prompt: "editorial luxury real-estate photography, dusk golden hour, warm window glow against cool violet sky, ivory stone, no people, no text".
- Six to eight images: one hero (façade or pool at dusk), two to four interiors lit from inside, one terrace or coastline, one detail room. No people, no text in frame, no daylight.
- Crops are compositional: 16/9 full-bleed bands, 4/3 lead property, 3/4 portrait card, 2/1 closing band, 3/2 showpiece. Below 700px every aperture goes to 4/5 so the strip never eats more than a quarter of the picture.
- A video is optional and only ever the hero: slow push-in at dusk, muted, looped, playsinline, NO autoplay attribute — JavaScript starts it, so a dead script or a reduced-motion visitor gets the graded poster.
- Captions sit on a hairline UNDER the frame (border-top ink/12%, padding-top .8rem, .88rem, ink/55%) and name the room and the lot. Text NEVER sits directly on a photograph — it sits on a plate or beside the frame.
- COMPONENTS. Buttons: square, ink fill, ivory text, 11px/0.17em micro-caps, padding 1.05rem 1.7rem, hover fills bronze-deep in 0.35s; ghost buttons swap the fill for a 1px ink/24% border. Links: 10.5px micro-caps over an ink/24% baseline; nav links grow a bronze underline from the left (background-size 0→100% 1px). Tables: 9.5px bronze micro-cap heads over an ink/24% rule, Prata cells at clamp(.95rem,1.1vw,1.1rem), rows ruled ink/12%, final row ink/24%; below 760px each row becomes a hairline block whose cells print their label from a data attribute. FORMS: no boxes — micro-cap labels above fields whose only chrome is a 1px ink/24% bottom rule turning bronze on focus; phone first and required (type="tel", inputmode="tel"); selects for villa and créneau; one off-canvas decoy input carrying data-wandit-hp that the page's own script never touches. On valid submit dispatch a wandit:lead CustomEvent on document with the visitor's fields flat in detail (nom, telephone, email, villa, creneau, commune, message, source), then replace the form with an honest ivory plate: who calls, within how long, what to bring.

## Page chassis
- Container 1280px, padding-inline clamp(20px,5vw,64px); section rhythm padding-block clamp(4.6rem,8.5vw,8.5rem). Full-bleed sections span the body width — never 100vw (scrollbar overflow).
- HEADER: a 64px ivory bar with an ink/12% bottom rule. Serif wordmark with its second word in bronze, micro-cap nav, Prata telephone on a hairline at the right. No blur, no shadow, no pill.
- FIXED OPENING — the frontispice: an ivory band carrying a rule-anchored locality label, the display headline (2–3 hand-broken lines), a lede and the CTA, ABOVE the first photograph. The photograph arrives full-bleed at 16/9 capped to 62vh (4/5 capped to 66vh on mobile), price plate straddling a top corner, reference strip welded to its bottom edge. Variants may invert the order or replace the band with a plate, but the law holds: the headline never sits on the photograph.
- FIXED CLOSING — la demande de visite: a 7/5 split, form left (micro-cap labels, hairline fields, honest success plate), contact ledger right followed by one square-cornered photograph and its caption; then the monument footer under a bronze rule.
- FREE MIDDLE — compose 4–6, never two adjacent alike: **la fiche** (5/7 split: hairline ledger against a display statement, closed by a four-cell distance rail) · **les lots** (asymmetric 12-column grid: 7-wide lead offset 4.6rem down, 5-wide portrait, full-width 2/1 band, each with strip and plate) · **la visite** (the scrubbed showpiece) · **la bande du soir** (a full-bleed dusk photograph carrying ONE static client quote on a plate — the only permitted social proof) · **le cahier des charges** (4/8 split: a tall 2/3 photograph against two stacked-label spec ledgers) · **le tableau des lots** (the price table with an honest note beneath).

## Motion identity — ESTATE GLIDE
Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state is set by gsap only; CSS never hides content. With the CDN dead the page is complete, lit and composed.
- Easing: power1.inOut for everything, durations 1.2–1.6s. Nothing overshoots, snaps or bounces. CSS transitions 0.3–0.4s cubic-bezier(.4,0,.2,1).
- Entrances (measured): blocks lift from y:30, opacity 0, 1.35s, trigger "top 88%". Photographic figures lift from y:44 over 1.6s while the image inside wipes open from clip-path inset(16% 0 0 0) to inset(0) — a curtain rising, never a zoom. Any image that translates must sit in an overflow:hidden frame. Strip cells arrive y:14, stagger 0.07s; the price plate lands last, y:20, 1.2s, delay 0.15s; rail cells stagger 0.09s.
- THE SHOWPIECE — la visite (one per page): a pinned frame in which rooms CROSSFADE. Rooms are stacked absolutely; the arriving room dissolves IN over the one below and the one below never fades out, so the frame is never washed out. Beats in timeline units: HOLD 0.76, FADE 0.24 — three quarters of the scroll shows one clean room. Frame 3/2 capped at 64vh — 70vh on desktop once the viewport is 820px tall or more, so the pinned scene never floats above a band of dead ivory (3/4 capped at 62vh below 760px); the pin starts vertically centered — top top+= max(76, (innerHeight − stageHeight)/2) — and runs innerHeight × 2.9 (× 2.2 on mobile), scrub 0.55. ONE shared reference strip and room name sit above the stack and are REWRITTEN at each beat with a 0.32s fade-in: the strip updating is the scene; four crossfading strips printing over each other is the failure. The name plate carries the room name ONLY, never a numeral — a numbered room list is MAISON's index. A hairline rail with a 3px bronze fill scrubs beneath, four micro-cap ticks lighting bronze in turn.
- NEVER: Ken-Burns zoom (GÉNÉRIQUE's), letterbox bars, multi-axis parallax, a second scrubbed scene.
- Hover / focus parity: nav underlines grow from the left, buttons fill bronze-deep, frames deepen their border from ink/12% to ink/24%. Every hover state is reproduced on :focus-visible (2px bronze outline, offset 3px).
- Reduced motion / no JS: the showpiece stays a 2×2 grid of the four rooms, each with its own name plate and reference strip — a composed contact sheet, not a blank; the scrub rail and ticks (pure motion furniture) are hidden; the hero video never starts and its graded poster stands in.

## Ban list (adds to the global ban list)
- GÉNÉRIQUE's letterboxed 21:9 photography with hard black bars, her champagne foil small-caps, her Ken-Burns scrub — by name.
- ORFÈVRE's self-drawing gold hairline engravings, filigree corner flourishes and gilded page-edge line.
- SILHOUETTE's type-over-photo collision and her one-crimson-word rule.
- MATIÈRE's arches and arch-topped frames — DOMAINE's geometry is square, always.
- ÉCLAT's 28–48px deep-rounded warm masks and her photo-orbit statement.
- VÉLIN's boxed drop caps and double filets; ÉCRIN's floating micro-caps on bare ground and her centered plumb line; MAISON's pinned numbered room index and her raised caption plinths (DOMAINE's plates are flat, priced and never numbered); CAPITALE's giant pull-figure and navy duotone.
- Dark or black sections, gold-on-charcoal coding, glassmorphism, blur bars.
- Rounded corners; soft shadows; icon rows; testimonial carousels (ONE static quote on a plate is the permitted form); "prestige/haut standing" copy; countdowns; dimmed-photo hero with centered white type; centered long paragraphs; mono captions; emoji.

## LES GESTES (the moves menu)
1. **Le frontispice** — ivory band above a full-bleed dusk photograph or film: rule-anchored locality label, three hand-broken display lines at 15fr against a 9fr lede+CTA column, then the photograph with a plate at a top corner and the strip on its bottom edge.
2. **La double page** — no full-bleed at all: a tall 3/4 photograph bleeding off the left edge, an ivory column right holding a short claim, a six-row ledger and the CTA.
3. **La plaque-titre** — one full-viewport photograph with the h1 set INSIDE an ivory plate straddling its bottom-left corner: the only geste where the headline touches the picture, and it touches it through a plate.
4. **Le triptyque** — three apertures of unequal width (5/4/3) under one hairline, a single reference strip running across all three, headline and CTA sharing the baseline below.
5. **La grille des lots** — the asymmetric property grid of the free middle; alternate the plate corner card by card; a name and one factual line under each frame.
6. **La fiche** — the 5/7 ledger-against-statement split, closed by a four-cell distance rail in Prata at clamp(1.15rem,1.9vw,1.7rem).
7. **La visite** — the pinned room-tour crossfade with the shared strip rewriting itself (spec in Motion identity). The default showpiece.
8. **L'ouverture d'objectif** — alternative showpiece: one held photograph whose aperture WIDENS on scrub from 3/4 to 2/1, the strip re-flowing from two cells to four.
9. **La cascade de plaques** — alternative showpiece: a held façade while four ivory plates (surface, orientation, livraison, prix) land one after another down the frame's right edge, the last saying "sur demande".
10. **La bande du soir** — the quote band: its ivory plate straddles the bottom-left corner and hangs half onto the ground below.
11. **Le tableau des lots** — the real price table: micro-cap heads, Prata figures, état in micro-caps (disponible bronze, réservé ink/55%), and a note that refuses urgency.
12. **Le monument** — the closing wordmark at clamp(2rem,8.6vw,7.4rem) under a bronze rule, two lines if the name is long.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**1. LE PARC (promoteur, twelve villas).** Driving noun: *la pinède*. Hero: geste 1 — ivory frontispice band, "Douze villas / dans une pinède / de trois hectares" at 4.7rem, lede and CTA right, then a full-bleed dusk film capped at 62vh with "Sur demande — villa Palmier" straddling its top-right corner and SURFACE · CHAMBRES · VUE · RÉF welded to its bottom. Showpiece: geste 7 — four rooms crossfading in a pinned 3/2 frame, the shared strip rewriting from Séjour to Terrasse, bronze rail filling beneath. Order: frontispice · fiche · grille des lots · visite · bande du soir · cahier · tableau · demande. Mood: a promoteur who shows the finished house before he says a price.

**2. LE REGISTRE (agency, forty listings).** Driving noun: *l'inventaire*. Hero: geste 2 — a 3/4 portrait of a stair hall bleeding off the left edge, an ivory column right with one claim in three display lines, a six-row agency ledger (fondée · mandats · communes · honoraires) and the CTA. No full-bleed above the fold. Showpiece: the LEDGER FILL — eight mandate rows whose hairlines draw left to right on scrub while a 4/3 aperture beside them swaps photograph every two rows and its strip rewrites. Order: double page · tableau des mandats · showpiece · grille des lots · bande du soir · demande. Mood: a house that keeps a register, not a shop window.

**3. LA VILLA SEULE (single property showcase).** Driving noun: *la vue*. Hero: geste 3 — one full-viewport dusk photograph of the façade, the h1 inside an ivory plate straddling its bottom-left corner, the strip on the bottom edge running the length of the picture. Showpiece: geste 9 — la cascade de plaques: the terrace photograph is held while four plates land down its right edge, surface, orientation, livraison, then "Prix sur demande". Order: plaque-titre · fiche · cahier des charges · showpiece · bande du soir · demande. Mood: one house, told once, with nothing to compare it to.

**4. LA CÔTE (vacation rentals, six houses).** Driving noun: *la saison*. Hero: geste 4 — a triptyque of unequal apertures (coastline 5, terrace 4, bedroom 3) under one hairline, a single strip across all three (NUITS · CHAMBRES · VUE · SAISON), headline and "Voir les disponibilités" sharing the baseline below. Showpiece: geste 8 — the coastline aperture widens from 3/4 to 2/1 on scrub while the strip re-flows from two cells to four. Order: triptyque · grille des maisons · showpiece · tableau des saisons · bande du soir · demande. Mood: the same coast, six front doors.

**5. LE SOIR TOMBE (hôtel particulier / guesthouse).** Driving noun: *le silence*. Hero: an INVERTED frontispice — the photograph takes the top 62vh full-bleed, the price plate straddles its BOTTOM-left corner (this one photograph carries no strip, so the bottom is free), headline and lede sit beneath on ivory, flush left, the reservation CTA on the telephone's baseline. Showpiece: SEQUENCE RECOMPOSITION — four apertures held in a 2×2 grid recompose on scrub into one large frame plus three small, the shared strip travelling to the large frame as it grows. Order: inverted frontispice · fiche · showpiece · cahier des services · bande du soir · demande. Mood: arriving after dark and being expected.

**6. LES CHIFFRES (commercial real estate / property management).** Driving noun: *le rendement*. Hero: a LEDGER HERO with no photograph above the fold — the h1 in two lines over a full-width hairline table of the asset's facts (surface louable · occupation · baux · livraison) in Prata at 1.4rem; the first photograph arrives after the fold as a 2/1 band with its strip. Showpiece: the STRIP TRAVERSE — one held wide photograph while its reference strip travels horizontally along the bottom edge, cells swapping at each floor marker. Order: ledger hero · bande 2/1 · showpiece · cahier technique · tableau · demande. Mood: a document that happens to be beautiful.

**7. LA MAISON D'HÔTES (guesthouse, eight rooms).** Driving noun: *le jardin*. Hero: an APERTURE hero — a narrow 3/4 photograph column centered in a vast ivory field, the headline split around it (first line above, second below), the strip welded under the column, the CTA on a hairline at the far right. Showpiece: the CAPTION WALK — one aperture held still while a single ivory plate walks the frame's perimeter on scrub, stopping at each corner to name a part of the garden while the strip beneath rewrites (CHAMBRE · SURFACE · LIT · À PARTIR DE). Order: aperture hero · fiche · showpiece · bande du soir · tableau des tarifs · demande. Mood: eight doors on one garden, priced without embarrassment.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or DOMAINE collapses into a beige template. FIRST, the PHOTOGRAPHY AND ITS GRADE: every image dusk, identically graded, square-cornered, hairline-framed. One midday photograph, one rounded corner, one ungraded file and the world is gone — this is the page's entire color budget. SECOND, the FURNITURE ON THE PICTURES: the reference strip and the price plate are what turn a handsome photograph into a property document; a full-bleed photo with no strip is wallpaper. THIRD, the RESTRAINT OF THE UI: ivory, brown-black, one bronze, 1px, square. The instant a second color, a shadow or a radius appears, the page reads cheap.

The details that separate this from a generated page cost nothing: non-breaking spaces in "18 h – 20 h" and "320 – 610 m²"; the état column that says "réservé" out loud; the note under the price table that refuses urgency; the caption that names the stone; the success plate that tells the visitor to bring an identity card. When in doubt, add a number — a surface, a distance, a delivery month. Here, precision is the luxury.`,
};
