import type { DesignWorld } from "../types";

/**
 * MAISON — interior-calm.
 * The interior-architecture studio site: greige ground, cool-calm room
 * photography in square hairline apertures, raised caption plinths, a numbered
 * room index the scroll walks. Every value below was measured on the shipped
 * demo (Maison Sud — architecture d'intérieur, Hydra, Alger); none is invented.
 * fusesWith: matiere (the drawn, warm half of the same trade), domaine (the same
 * house seen from outside at dusk), wabi (the same emptiness, held in ink),
 * catalogue (the objects that end up furnishing these rooms).
 */
export const maison: DesignWorld = {
	id: "maison",
	name: "Maison",
	family: "maison",
	tagline: "Le greige et la lumière : l'intérieur légendé pièce par pièce.",
	kind: "website",
	mood: ["greige", "calm", "spatial", "photographic", "measured"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"interior design / home staging",
		"architect (firm)",
		"architecture portfolio",
		"renovation / remodeling",
		"carpentry / woodwork",
		"home & decor shop",
		"single property showcase",
		"real estate agency",
		"property developer / promoteur",
	],
	avoidFor: [
		"street food / food truck",
		"fast food",
		"kids & baby shop",
		"kindergarten / crèche",
		"DJ / entertainment",
		"streetwear / drops",
	],
	fusesWith: ["matiere", "domaine", "wabi", "catalogue"],
	preview: {
		ground: "#F4F2EE",
		ink: "#21201D",
		accent: "#767268",
		fontFamily: "Albert Sans",
		sampleWord: "Maison N°7",
	},
	doc: `# DESIGN WORLD: MAISON — the interior studio measured in daylight

## Philosophy
This page is A SET OF ROOMS PRESENTED IN THE ORDER YOU WOULD WALK THEM — the folder an interior architect opens on the table: a plan, then the numbered rooms, each photographed at the hour its light is best, each legended on a small raised plate. Nobody browses here; the visitor is walked through a house.

Three structural facts govern everything. FIRST: every photograph is a SQUARE-CORNERED APERTURE — 1px ink/10% frame, no radius, one shared cool grade — and no type ever sits on it; captions live on RAISED PLINTHS overlapping a corner, everything else beside the frame. SECOND: the page is NUMBERED — rooms, projects, steps and materials carry N°01 … N°06, the numbering being the itinerary the showpiece walks, not decoration. THIRD: the palette is near-monochrome greige, the only saturated colour what the rooms contain. Remove the photographs and MAISON is a quiet ruled document.

Impossible here: the sunlit terracotta atelier with arches and drawn miniatures (MATIÈRE's); the dark-luxury interior page; a photograph dimmed under centred white type; twelve mood images and not one surface, material or fee. A MAISON page states the m², the commune, the year, the material and a figure in dinars or an honest "sur devis".

Self-audit: (1) zero rounded corners anywhere; (2) every photograph identically graded inside a 1px ink/10% frame; (3) at least three plinths and six floorplan glyphs; (4) exactly ONE scrubbed showpiece, and it is an itinerary; (5) the warm thread used three times or fewer; (6) with JavaScript dead the page is complete, no column void above the footer, the showpiece a composed planche.

## The variation contract (why two MAISON sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- Greige double ground, brown-black ink, ONE stone grey, ONE warm thread rationed to three uses. No dark section, no third hue.
- Square-cornered hairline apertures, the shared cool grade, photography as the page's only colour and imagery. No drawn scenery, no illustration, no icons.
- The three tics, all visible on every build: ROOM INDEX SYNC, CAPTION PLINTHS, HAIRLINE FLOORPLAN GLYPHS.
- A light humanist sans as display (300 and below at display sizes) against a serif whisper reserved for names. Never a third face, never italic.
- ROOM WALK motion: 1.6s power1.inOut, anchored stops, lateral pans; nothing zooms, snaps or overshoots.
- Real numbers: surface, commune, year, material, delivery, fee.
CLIENT-OWNED — where the siblings diverge:
- The greige pair inside the register (#F4F2EE/#EDEAE4, #F2F0EB/#EAE7E1, #F5F3F0/#EDEBE5) and the stone (#767268, #6E6B62, #7D7A70).
- The display face (Albert Sans default, Onest) and the serif whisper (Cardo default, Vollkorn).
- THE DRIVING ROOM — le séjour du matin, le couloir, le seuil, la table, la fenêtre du sud. It names the hero aperture, the showpiece itinerary and the copy's vocabulary; without one a MAISON page is a beige template. Choose it first, then let it choose the photographs.
- The itinerary length (4–6 stops), the section order beyond the fixed opening and closing, the gestes played, the business: architecte d'intérieur, agence, rénovation, home staging, ébéniste, showroom. The furniture never changes; the plinth vocabulary does (PIÈCE/SURFACE/SOL for a room, ESSENCE/FINITION/DÉLAI for furniture).

## The vibe (voice)
Calm spatial French, factual, spoken slowly. Describe light and matter like someone who has been on site: hours, orientations, thicknesses, essences. One adjective per paragraph, no superlatives; the studio says what it does NOT do.
- « La lumière entre par le sud vers 11 h. Tout le plan en découle. »
- « Nous ne dessinons pas des ambiances : nous déplaçons des murs, puis nous choisissons trois matières et nous nous y tenons. »
Forbidden: "cocooning", "clé en main", "haut standing", exclamation marks, any sentence a brochure generator could produce.

## Visual signatures (the measured law)
- **LES PLINTHES DE LÉGENDE (owned tic 1).** A small raised plate in chalk #FBFAF7, 1px ink/10% border, padding .6rem .95rem .68rem, max-width min(80%, 340px), STRADDLING a photograph's corner: two thirds over the aperture, 16–22px outside it. It is RAISED — what separates it from every flat plate in the wave: box-shadow 0 10px 26px rgba(33,32,29,.07), 0 1px 0 rgba(33,32,29,.05). Inside: the standard 10.5px/0.18em stone micro-cap key over a serif-whisper value at clamp(.94rem,1.1vw,1.1rem), optionally a third line at .82rem/1.5 in ink/45%. Corners are assigned, never random: bottom-left on the hero, on any band and in the showpiece; top-right on a portrait. THE HERO PLATE STRADDLES THE SEAM — the page's signature move: left offset −(one gutter + 45px) at 1241px and up, −(one gutter + 14px) from 1101 to 1240, −(one gutter − 4px) down to 761px, At 1440 the plate stands 85px clear of the frame — a quarter of its width on bare greige, three quarters still over the photograph — and nothing in the text column reaches it. Below 760px the plate crosses the aperture's TOP-left edge instead — top −18px, capped at min(74%, 262px) — so the legend meets the room inside the phone's first viewport. One plinth per aperture, never on a photograph already captioned below. Cap it at min(62%, 260px) on a 3/4 portrait, min(66%, 250px) below 1000px and min(88%, 320px) below 760px: wider than two thirds of its picture, a plate stops being a plate.
- **LES GLYPHES DE PLAN (owned tic 3).** Tiny 1px floorplan icons drawn inline in SVG, 18–22px, viewBox 0 0 24 24, stroke rgba(33,32,29,.45), fill none, stroke-width 1: a room with a door swing arc, a corridor with a light shaft, a stair run, a window in a wall, an L of counter, a bath with a basin. The page's ONLY iconography, used as BULLETS and label prefixes on facts, contact lines, materials and steps. Never dimensioned, never annotated with mm or arrowheads: GABARIT's language.
- **L'INDEX DES PIÈCES (owned tic 2, and the showpiece).** A numbered room list — N°01 Séjour, N°02 Cuisine, N°03 Couloir … — pinned beside a single aperture. As the scroll advances the aperture WALKS room to room (lateral pan + dissolve), the active row inks from ink/40% to full, a stone hairline fills under it, a large light numeral advances beside. Its STILL form opens the page — L'ITINÉRAIRE on the hero's base band, right of the seam: a micro-cap on the band's ink/18% rule, then one cell per room on a five-column grid, each topped by a 2px tick (ink/10%, stone on the room the hero photograph shows), N°01 … N°05 in the 9.5px/0.19em register over serif-whisper names at clamp(.8rem,1.05vw,.95rem), rooms not yet reached at ink/45%. The hero ANNOUNCES the itinerary, the showpiece WALKS it; never scrub the strip — a second moving rail is a second showpiece.
- **Two hairline registers, and only two.** ink/10% for aperture frames, plinth borders, row and grid rules; ink/18% for label rules, field underlines, the closing rule and active states. Nothing exceeds 1px but the 2px index rail — filling on scrub in the showpiece, printed still in the hero itinerary.
- **Labels attached to a rule, never floating.** Micro-caps (display 500, 10.5px, 0.18em, stone) sit on a border-top with .8rem above the text, or inside a plinth. The tighter 9.5px/0.19em register is reserved for material numbers, itinerary ticks, fact keys and table heads. A micro-label on bare ground is ÉCRIN's tic.
- **Air as a material.** Rhythm padding-block clamp(4.4rem,8vw,8rem); one idea per section; the middle sections each leave a grid column deliberately empty — asymmetric, load-bearing, never WABI's off-axis ma. In the hero and the closing the air is a ROW, never a void column.
- **The monument close.** The practice's name at clamp(2.6rem,8vw,6.6rem)/.98 at weight 200, above a stone hairline, legal line beneath a second hairline. Never below 2.6rem: on a phone the closing word must beat the h1.

## Color physics
- GROUND A: the #F4F2EE / #F2F0EB register — greige with a green-grey cast, never cream, never ivory. GROUND B: 5–8 RGB points deeper, the #EDEAE4 / #EAE7E1 register. Sections alternate A/B; that alternation plus the photographic bands are the only sectioning devices. No third ground, no dark section.
- INK: #21201D, a brown-black. Prose 66%, captions and glyph strokes 45%, hairlines 10% and 18%.
- STONE (the accent): the #767268 / #6E6B62 register. Budget: micro-cap labels, plinth keys, the index rail and its fill, rules under active items, the footer rule, small numerals. Never a large fill.
- CHALK: #FBFAF7 for plinths, the success plate and the header bar — the only value lighter than ground A. Photo matte #E4E1DA behind every aperture: a slow image reads as a warm plate, not a white hole.
- THE WARM THREAD: one pigment, the #B65C2E register, no more than THREE uses per page: (1) the active tick in the showpiece index, (2) link hover and :focus-visible, (3) one rule or word in the closing.
- Gradients: NONE except the optional 8%-white daylight band of the "course du jour" geste. No washes, no coloured overlays, nothing metallic.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · STONE→--primary · GROUND A→--primary-foreground · GROUND B→--secondary · THE WARM THREAD→--accent · ink at 45%→--muted · ink at 10%→--border · zero→--radius · DISPLAY→--font-heading · DISPLAY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, matte or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: a light humanist sans — **Albert Sans** (default) or Onest. Weights 200/300 at display sizes, 500 for micro-caps, 400 for prose. Authority comes from SIZE and AIR: a bold headline is a MAISON failure.
- SERIF WHISPER: **Cardo** (default) or Vollkorn, 400 only, reserved for NAMES — projects, rooms, materials, the press quote, plinth values. It never sets prose or a button. NEVER italic: emphasis is the serif, the stone, or nothing.
- Scale (measured): h1 clamp(2.4rem,5.4vw,4.5rem)/1.07, tracking -0.022em, three hand-broken lines maximum, in a column wide enough that the longest unit never re-wraps: seven of twelve at 4.5rem, never five. Section titles clamp(1.85rem,3.5vw,3rem)/1.12, tracking -0.018em. Serif names clamp(1.3rem,2.1vw,1.9rem)/1.2. Lede clamp(1.02rem,1.15vw,1.18rem)/1.66 at 48ch. Prose 16.5px/1.72 at 62ch in ink/66%. Captions .86rem/1.55 at ink/45%. Index numerals at 200, clamp(2.4rem,5.6vw,4.6rem), tracking -0.03em; small numerals 11px/0.16em.
- Display type never exceeds ~10vw nor fills the viewport width: fit-to-viewport caps are AFFICHE's, 15–25vw words-as-structure MANIFESTE's.
- Numerals in the French manner — "240 m²", "8 %", "120 000 DA" — non-breaking spaces before units and in hour ranges.
- Arabic pairing: both roles in **Almarai** (300 display, 400 prose); the serif whisper's job passes to Almarai 400 at +2% in stone, micro-cap tracking resets to 0, the index rail mirrors right, numerals stay Latin.

## Signature art — the photographic direction
- Art-direction phrase, reused VERBATIM in every generation prompt: "interior design photography, calm neutral palette, soft morning light, textured plaster and pale wood, no people, no text".
- THE GRADE IS LAW: every image carries filter: saturate(.9) brightness(1.02) — cool, calm, one family. A warm cast, a coloured lamp or a sunset is rejected, not corrected: MAISON's light is daylight between 9 h and 17 h.
- Six to eight images: a wide living space (the hero), a joinery or kitchen detail, a bedroom, a circulation shot, a wet room in stone, a furniture corner. No people, no night.
- FRAMES: square corners, 1px ink/10% border, matte behind. Aspects: 1/1 for the hero aperture and the showpiece stage, 3/4 portrait, 3/2 or 2/1 bands, 4/5 below 760px. The square is MAISON's signature crop.
- CAPTIONS: on a plinth (tic 1) or on a hairline UNDER the frame — border-top ink/10%, padding-top .8rem, .86rem, ink/45% — naming room, project and material. Text NEVER sits on a photograph: type-over-photo collision is SILHOUETTE's, photo-through-type ÉLAN's.
- COMPONENTS. Buttons: square — every corner consumes min(var(--radius), 0px), MAISON's edges stay cut — ink fill, greige text, 11px/0.16em micro-caps, padding 1.02rem 1.7rem, hover #34322D over .32s; ghost buttons swap the fill for a 1px ink/18% border. Links: ink over a 1px ink/18% baseline turning warm on hover and :focus-visible. Tables: stone micro-cap heads over an ink/18% rule, serif-whisper figures, rows ruled ink/10%, an honest note beneath — never a pricing card. FORMS: no boxes — micro-cap labels above fields whose only chrome is a 1px ink/18% bottom rule turning warm on focus; telephone FIRST and required (type="tel", inputmode="tel"); one off-canvas decoy input carrying data-wandit-hp the script never reads. On valid submit dispatch a wandit:lead CustomEvent on document with the visitor's fields flat in detail, then replace the form with an honest chalk plate: who calls back, how soon, what to prepare.

## Page chassis
- Container max-width 1240px, padding-inline clamp(20px,5vw,58px). Bands span the body width — never 100vw.
- HEADER: a 60px chalk bar with an ink/10% bottom rule. Wordmark at 300, second word in stone; micro-cap nav; telephone right on a hairline. No blur, no shadow, no pill.
- FIXED OPENING — LE SEUIL, never a fifty-fifty split: a text column of 7 of 12 (rule-anchored locality label, h1 in two or three hand-broken lines, lede, one ink CTA) against a 1/1 aperture of 5 of 12 whose plinth BRIDGES THE SEAM. Both columns then land on LE SOCLE, the hero's base band: ONE ink/18% rule crossing all twelve columns, broken only by the gutter, carrying two labelled panels that start at the same y — the four glyph-bulleted figures at 7, the printed itinerary at 5, each opening with its own micro-cap. The locality label opens on the same register, bracketing the hero; the glyph row is never a tail inside the text. Stacked below 760px the order is text, itinerary, aperture, figures — the numbered index must reach the phone's first viewport — and hero padding-block opens at 2.2rem so the plate and a slice of room still meet the fold. Variants may swap the aperture for a drawn hairline plan, three apertures on one baseline, or a band above the headline; the law holds — the headline never sits on the photograph, the split is never even, the first viewport states commune, founding year and the itinerary to come.
- FIXED CLOSING — LE RENDEZ-VOUS: a true 7/5 split with NO void column — form left (7) with an honest success plate, contact facts right (5) as glyph-bulleted lines over the honoraires table, both columns ending together; then ONE atelier band across the twelve columns carrying its plinth, then the monument footer above a stone hairline. A left half that runs out while the right rail continues is this world's commonest failure: move an aperture to the band, never pad the form.
- FREE MIDDLE — compose 4–6 of the gestes below (2, 3, 5–11), never two adjacent alike; la citation nue is the ONLY permitted form of social proof.

## Motion identity — ROOM WALK
Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state is set by gsap.set only; CSS never hides content.
- Easing: power1.inOut everywhere; CSS transitions .32s cubic-bezier(.4,0,.2,1). Durations 1.4–1.6s. Nothing bounces, snaps or overshoots.
- Entrances (measured): blocks lift from y:26, opacity 0, 1.5s, trigger "top 88%", stagger .1s in a group. Apertures lift from y:34 over 1.6s while the IMAGE INSIDE pans laterally from x:-2.2% to 0 at a fixed scale(1.045) — a walk in, never a zoom, never a Ken-Burns drift (GÉNÉRIQUE's). Plinths land last: y:14, opacity 0, 1.1s, delay .18s. Glyphs fade at .9s, stagger .07s.
- THE SHOWPIECE — L'INDEX DES PIÈCES (one per page): a pinned stage of 4–6 stops, index list left (4 of 12), square aperture right (8 of 12). Beats in timeline units: HOLD .72, WALK .28 — three quarters of every stop is a still room. On each walk the outgoing photograph goes to x:-4% and fades to 0 while the incoming enters from x:5% (power1.inOut, fixed scale, no zoom); the shared plinth's key and value are REWRITTEN at the midpoint with a .3s fade — one plinth updating, never five printing over each other; the numeral advances with a y:12 lift; the active row inks and its stone hairline fills 0→100%. Beneath the list: a 2px stone rail scrubbing with the scene, then the level's 1px floorplan, the visited room filling stone/16%. Pin length innerHeight × 3.2 desktop, × 2.4 below 760px; scrub .6; pin starts at top top+= max(78, min(130, (innerHeight − stageHeight)/2)) so the header never crops the numeral. Start and end are FUNCTIONS re-measured on every refresh (invalidateOnRefresh): a rotate or a late reflow must never leave a stale pin.
- NEVER: a second scrubbed scene, a zoom, multi-axis parallax, or a photograph that changes size on scroll.
- Hover / focus parity: aperture frames deepen from ink/10% to ink/18%; plinths lift 2px; links swap their baseline to the warm thread; index rows ink. Every hover state repeats on :focus-visible (2px warm outline, offset 3px).
- Reduced motion / no JS: the showpiece is a composed PLANCHE — the numbered index inked, the rooms in a 2-up grid of framed apertures each carrying its plinth.

## Ban list (adds to the global ban list)
- MATIÈRE — the closest boundary in the registry — by name: her arch-only geometry and arch-topped frames, her drawn room miniatures lit from inside, her material-swatch cabinet that retints the page, her 4% plaster grain, her warm double-ground with its ONE inverted interlude. MAISON is the photographic, cool half of the same trade: zero arches, zero drawn rooms, zero grain, zero retinting, greige A/B only, no dark interlude.
- ÉCRIN's floating letter-spaced micro-caps on bare ground, her centred plumb line, her roman numerals. WABI's sumi-e brush stroke, vertical writing-mode labels and off-centre ma composition.
- CATALOGUE's product-on-seamless-plinth photography with its hard contact shadow and her SKU captions (RÉF, matière, prix): MAISON's plinths carry rooms, not references.
- DOMAINE's property meta hairline strip welded to a photo's bottom edge, her dusk-grade law and her serif price plate — by name. Our plate is raised, crosses the seam and legends a room; hers is flat and prices one.
- ÉCLAT's deep-rounded warm masks and photo-orbit. GABARIT's dimensioned lines with arrowheads and mm labels.
- GÉNÉRIQUE's letterbox bars and Ken-Burns scrub; SILHOUETTE's type-over-photo collision; PHOTOGRAPHE's sprocket strips, EXIF chips and masonry drift; CLAIR's soft-shadow floating cards.
- Dark sections; cream-and-gold luxury coding; gradient washes; glassmorphism; rounded corners; bold display weights; italics; icon fonts and emoji; centred long paragraphs; uncaptioned mood-board grids.

## LES GESTES (the moves menu)
1. **Le seuil** — the 58/42 opening: label on a hairline, h1 in two or three hand-broken lines and a lede at 7 of 12; a 1/1 aperture at 5 with its plinth crossing the seam; LE SOCLE beneath both — one rule across the twelve, figures left, itinerary right.
2. **La planche des projets** — the asymmetric project grid: one a 3/4 portrait offset 4rem down, plinth top-right; two a full-width 2/1 band, plinth bottom-left; three mirrors one.
3. **L'index des pièces** — the pinned room itinerary (default showpiece): list left over the level's floorplan, aperture right, one plinth rewriting, the numeral advancing, the rail filling.
4. **Le plan au trait** — a real floorplan at 1px in the glyph language: walls, one door swing, one light shaft, room names in micro-caps. Hero art when the client has no photography.
5. **L'enfilade** — alternative showpiece: the room list IS the stage; each row opens on scrub to reveal its aperture inline, the previous closing as the next opens.
6. **La course du jour** — alternative showpiece: one held aperture while an 8%-white daylight band crosses it, the plinth rewriting the hour at three stops.
7. **La coupe** — alternative showpiece: a hairline section pinned (RDC, 1er, toit), the scroll descending the levels while the aperture beside changes.
8. **Le relevé** — the method as three or four numbered rows on hairlines (numeral at 200, serif name, one paragraph, one glyph) against a tall 3/4 aperture.
9. **La citation nue** — one press quote at clamp(1.5rem,3.4vw,2.7rem) in the serif whisper, no photograph, a hairline rail of publication names left, air right.
10. **Les matières** — six materials as a typographic grid: glyph, N°01–06 numeral, serif name, one factual line, provenance in stone micro-caps. No swatches, no cabinet.
11. **Le tableau des honoraires** — real DZD figures with a note that refuses urgency ("les tarifs sont annuels, pas promotionnels"), then LE MONUMENT beneath the closing.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**1. MAISON N°7 (architecture d'intérieur, three houses).** Driving room: *le séjour du matin*. Hero: geste 1 — text at 7, aperture at 5, the plinth crossing the seam, the five rooms printed on the socle. Showpiece: geste 3 — aperture panning, numeral advancing, rail filling. Order: seuil, planche, relevé, index, matières, citation, rendez-vous. Mood: a practice that walks you through one finished house.

**2. LE PLAN (agence d'architecture, rénovation lourde).** Driving room: *le couloir*. Hero: no photograph above the fold — h1 in three lines left, a real 1px floorplan (geste 4) filling the right half; the first aperture arrives after the fold as a 2/1 band. Showpiece: LE PARCOURS — that plan pinned, a stone dot travelling its corridor, rooms inking as it enters. Order: plan hero, parcours, avant/après, relevé, honoraires, rendez-vous. Mood: an office that thinks in plan.

**3. LES SURFACES (ébéniste / showroom mobilier).** Driving room: *la table*. Hero: three apertures of decreasing size on ONE baseline across the top (1/1, 3/4, 1/1 at 62%), headline flush-left beneath at 4.4rem. Showpiece: L'ENFILADE (geste 5) — six pieces as rows opening one at a time on scrub, each revealing its aperture with essence, finition and délai. Order: cadence, enfilade, matières, atelier, honoraires, rendez-vous. Mood: a workshop that shows the grain first.

**4. LA MAISON DU SUD (villa unique, home staging avant vente).** Driving room: *la fenêtre du sud*. Hero: a full-width 2/1 band at the very top, plinth bottom-right, h1 and lede beneath on greige. Showpiece: LA COURSE DU JOUR (geste 6) — the living room held while the daylight band crosses it and the plinth rewrites 9 h, 13 h, 17 h. Order: band hero, les pièces, course du jour, matières, citation, rendez-vous. Mood: one house, one day of light.

**5. L'ATELIER (practice of nine, twelve projects).** Driving room: *le seuil*. Hero: a 3/4 portrait bleeding off the right edge, a tall text column left with the h1 over a six-line practice ledger (fondée, projets, communes, équipe, délai, honoraires). Showpiece: LA COUPE (geste 7) — a hairline section pinned, the scroll descending RDC → 1er → toit. Order: bleed hero, coupe, planche, relevé, citation, rendez-vous. Mood: a studio that draws the whole building.

**6. RUE DIDOUCHE (appartement rénové, single property showcase).** Driving room: *la porte-fenêtre*. Hero: a quadrant — h1 top-left, a small 1/1 aperture top-right, lede bottom-left, a tall 3/4 aperture bottom-right. Showpiece: LE SEUIL SÉQUENCE — five square apertures wider than the container, travelling one per stop, numerals lighting in turn (never a horizon continuing across the crops — HORIZON's lock). Order: quadrant, séquence, surfaces, matières, honoraires, rendez-vous. Mood: doorway by doorway.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or MAISON collapses into a beige template. FIRST, THE PHOTOGRAPHY AND ITS GRADE: square corners, 1px ink/10% frame, saturate(.9) brightness(1.02), daylight only — one rounded mask, one dusk file, one ungraded image and the world is gone. SECOND, THE FURNITURE ON THE PICTURES: the raised plinth turns a handsome interior shot into a documented room, and on the hero it leaves a quarter of itself on bare greige — that crossing, over the base band's rule, is the whole difference between this page and a left-copy/right-photo template; an uncaptioned photograph is wallpaper, and wallpaper is what the merchant already has. THIRD, THE ITINERARY: an index that could be shuffled without loss is decoration — number the rooms in walking order, print the strip in the hero, let the scroll walk it.

The cheap details cost nothing: the hour beside the light ("plein sud, 11 h"); the plaster's thickness; the commune under every project; the honoraires table that says 8 % then what it includes. When in doubt, add a measurement — here, precision is the calm.`,
};
