import type { DesignWorld } from "../types";

/**
 * ORFÈVRE — the goldsmith's black velvet.
 * Blue-black velvet ground on which the maison's objects exist ONLY as 1px
 * gold-stroke SVG engravings that draw themselves on scroll; double-hairline
 * gold frames with filigree corners; one gilded page-edge line. Proven against
 * the Maison Ambar demo (haute joaillerie, Casablanca); every value below is
 * the one shipped there. The doc is appended VERBATIM to the builder prompt.
 */
export const orfevre: DesignWorld = {
	avoidFor: [
		"fast food",
		"kids & baby shop",
		"spare parts",
		"crossfit / functional",
		"street food / food truck",
	],
	doc: `# DESIGN WORLD: ORFÈVRE — the goldsmith's black velvet

## Philosophy
This page is a GOLDSMITH'S PRESENTATION TRAY, not a website: blue-black velvet under one lamp, and on the velvet, gold. Its first structural fact: the maison's objects — jewels, flacons, façades, dishes, deeds — exist ONLY as engravings: 1px gold-stroke SVG line drawings on the dark ground, and they DRAW THEMSELVES as the visitor scrolls, in the goldsmith's order — silhouette first, facets second, glints last. Photography is not rationed here; it is impossible (GÉNÉRIQUE is the photographic dark sibling — ORFÈVRE's identity is the drawn line). Its second structural fact: containment is ceremonial — the only frame that exists is the double gold hairline with filigree corner flourishes; no filled cards, no shadowed panels. Its third structural fact: one gilded line runs the full viewport height at the page's edge — the gold leaf on the book's closed pages. The velvet is smooth: no grain, no texture overlay, no noise — darkness reads as depth because gold is rationed to the LINE. The failure mode "a dark theme with gold text sprayed everywhere" is structurally impossible: gold is a stroke weight, not a surface. So is loudness: nothing bounces, nothing glows neon, nothing slides far. Self-audit before shipping:
- Zero raster images, zero photographs, zero filled illustration: every pictured object is stroke-only SVG in the gold register.
- Every frame on the page is a double hairline (1px + 1px) with four filigree corners; zero box-shadows, zero border-radius above 2px.
- Exactly ONE gilded page-edge line; exactly ONE pinned scrubbed gravure.
- At most ONE gold word per headline; gold fills nowhere exceed 6px (glint dots).
- Sapphire appears only as a depth plane, on at most two bands per page.
- With JS dead, every engraving is fully drawn and the page reads complete.

## The variation contract
WORLD LAW — never renegotiated by brief or builder:
- Blue-black velvet ground register; warm ivory ink; gold as LINE, never as surface; deep sapphire for depth planes only.
- Engraved-only imagery: 1px gold-stroke SVG objects that draw on (the owned tic), in the order silhouette → facets → glints.
- The double-hairline frame with filigree corners and the gilded page edge (the other two owned tics).
- Roman-display small-caps culture (Cinzel / Italiana / Marcellus register) + EB Garamond body; italic never enters a headline.
- Draw-on motion identity (strokeDashoffset): unhurried, precise, no overshoot, no snap; exactly one pinned scrub — la gravure.
- No grain, no blur, no glassmorphism, no neon glow; light exists only as the one radial pool behind a centerpiece.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside the three registers (ground, ivory, gold) and the sapphire plane's opacity.
- The display face within the register: Cinzel, Italiana or Marcellus — one per site.
- The DRIVING NOUN — le trait, l'éclat, la main, le poinçon, la nuit — it names the hero whisper, the gravure's caption and the copy's spine.
- WHICH objects are engraved (the maison's actual inventory) and the gravure's subject: necklace, watch movement, façade, floor plan, flacon, cloche, interlocking rings.
- Section order beyond the fixed opening and closing; which gestes are played; the page edge's side (left or right); where the one or two sapphire bands fall.
An ORFÈVRE page without its noun is a failure: name it FIRST, then let it choose the gravure, the hallmarks and the words.

## The vibe (voice)
Hushed French with a goldsmith's arithmetic. The maison counts hours, hands, carats and millièmes; it never praises itself — the words "luxe", "prestige", "exclusif", "exception" are BANNED (claiming luxury is what plated pages do). Prices are complete and calm. No exclamation marks, no rhetorical questions, no "découvrez". Register examples (demo language French):
- "Quatre-vingt-dix heures d'établi. Une seule paire de mains."
- "L'or attend. Le trait décide."
- "48 000 MAD — or jaune 750 ‰, saphir de Ceylan non chauffé, 2,1 carats."
One honest hospitality line near the contact ("L'atelier vous rappelle sous 24 heures, du mardi au samedi." register).

## Visual signatures
- GOLD HAIRLINE ENGRAVINGS (owned tic): every object is an SVG drawn in stroke #D8B24A (or the site's gold) at 1–1.5 user units, fill:none — except glint dots ≤ 6px, the only filled gold. NEVER vector-effect: non-scaling-stroke (it moves dash math into screen space and breaks the draw-on); instead render each SVG within 0.8–1.2× of its viewBox so the hairline holds. Engravings DRAW THEMSELVES on scroll via strokeDashoffset (dash = getTotalLength, set by JS only) in the goldsmith's order: silhouette paths, then facet/detail lines, then glints (4-point sparkle crosses or dots) popping last. Facet strokes sit at 55–70% opacity for depth.
- DOUBLE-HAIRLINE FRAMES + FILIGREE CORNERS (owned tic): the world's only container — outer 1px gold at 30–40% opacity, inner 1px gold at 60–90%, set 6px apart; four filigree corner flourishes (a double spiral curl ending in a 2px dot, clamp(26px, 3vw, 40px) square) sit ON the outer corners and draw in before the frame's content reveals. Never thin+thick filet pairs (VELIN's), never ornament all along the frame sides (DIWAN's) — the sides stay bare hairline; the corners carry all the ceremony.
- GILDED PAGE EDGE (owned tic): ONE 1px vertical line, fixed, inset clamp(10px, 1.5vw, 20px) from the left (or right) viewport edge, full viewport height, filled with the page's only furniture gradient (#C9A227 → #F0D48A → #C9A227, background-size 100% 300%) whose sheen drifts over ~9s. It draws scaleY top→down over 1.8–2.4s on load, then holds. It is gold leaf, not a scroll progress bar — it never scrubs.
- THE DASHED LABEL: section labels are gold micro-caps 0.68–0.74rem, +0.3em tracking, flanked by two 22–28px gold hairline dashes with 0.9rem gaps ("— LA MAISON —" as drawn strokes, not glyphs). Never a floating bare label (ÉCRIN's tic), never a pill.
- LE MOT DORÉ: at most one word per headline set in flat gold — never gradient-filled text (GÉNÉRIQUE's champagne foil), never underlined.
- SAPPHIRE DEPTH PLANES: #1B2A4A flat or as rgba over the ground at 30–100% — full-bleed interlude bands and frame interiors only, never text, never borders.
- THE LIGHT POOL: one radial gradient (ellipse 55–70% of the section, rgba(27,42,74,.55) fading to transparent) may sit behind a centerpiece engraving — the lamp over the tray. Nowhere else does light exist as decoration.

## Color physics
- GROUND: the #0A0C12 / #0D1016 register — blue-black, never pure #000, never warm brown. One base ground; sections may alternate the two register tones for rhythm (a 3–5 RGB point step, barely felt).
- INK (text): warm ivory, the #EFE9DC / #EAE3D3 register. Secondary text is the same ivory at 58–68% opacity — never grey hexes.
- GOLD: the #D8B24A / #C9A227 / #B8922F register. Budget — strokes and engravings, frame hairlines, the dashed labels, the one gold word per headline, price affixes ("MAD", "‰"), the gilded edge. Gold NEVER fills an area larger than a 6px glint dot, never tints a panel, never becomes a button's resting background.
- SAPPHIRE: #1B2A4A, depth planes only (see signatures); at most two bands per page.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · GOLD→--primary · GROUND→--primary-foreground · second GROUND tone→--secondary · SAPPHIRE→--accent · ink at 62%→--muted · ink at 14%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, glint or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- GRADIENTS: exactly two are legal — the gilded edge's sheen and the one radial light pool. Backgrounds, buttons, text and frames are otherwise FLAT. No grain, no noise, no vignette washes.
- ::selection — gold ground (#D8B24A) with velvet text (#0A0C12): the inverted stamp.

## Typography system
- DISPLAY: Cinzel, Italiana or Marcellus (Google Fonts) — one per site, weights 400–600. Roman-inscription small-caps culture: display text is uppercase or Cinzel's native small-cap lowercase, tracking +0.04–0.1em, line-height 1.06–1.2. Used for the maison name, headlines, piece names, prices' figures.
- BODY: EB Garamond 400/500, 1–1.05rem, line-height 1.7–1.8, measure 30–38ch (long prose 55–65ch max), flush-left. Ivory at 100% for primary, 58–68% for secondary.
- H1 (the name): clamp(2.6rem, 7.2vw, 5.6rem), display 500, tracking +0.06em. Section titles clamp(1.7rem, 3.4vw, 2.9rem). The scale is engraved-plate generous, never poster-loud (~6:1 max ratio to body).
- MICRO-CAPS: display face 400 or body-caps, 0.68–0.78rem, +0.22–0.32em tracking, uppercase — labels, buttons, nav, hallmark captions.
- ITALIC: EB Garamond italic 400 exists ONLY in captions and whispers under engravings and in the one-line provenance under a price. Italic NEVER enters a headline (the italic accent word is VELIN's) and never exceeds 1.05rem.
- Hard rules: no mono face ever; no bold ≥ 700; numerals in prices take the display face with the currency affix in gold micro-caps; tabular alignment for price columns.
- Arabic pages: display Amiri 400/700 (engraved-serif kinship), body Noto Naskh Arabic 400/500; letter-spacing is REMOVED on Arabic script (tracking breaks ligatures) — labels rely on size and gold alone; the small-caps culture becomes a size-contrast culture; numerals stay Western in prices.

## Signature art / components
L'ART GRAVÉ (imagery system): every object the maison shows is constructed as a stroke-only SVG engraving, flat frontal or gentle 3/4 elevation, zero shading, zero perspective grids.
- Construction vocabulary: silhouettes as clean closed paths; facets as straight inner lines and nested steps (taille émeraude = nested cut-corner octagons + corner connectors; pear stone = teardrop + fan lines from the point; chain = two parallel catenary curves + a dashed link line between them); mechanisms as circles + radial ticks; architecture as elevation lines + window rectangles.
- Layer classes for the draw order: .sil (silhouette), .fac (facets/details, may sit at 55–70% opacity), .gli (glints: a + cross of two 14–20px lines, or a filled dot ≤ 6px).
- Every engraving carries role="img" and a real aria-label in the page's language; captions beneath in EB Garamond italic 0.85–0.95rem at 62% ivory.
- LES POINÇONS (hallmark row): the maison's credentials drawn as three small lozenge (rotated-square) engravings ~72px — maker's mark initials, the title "750", the maison's emblem — each with a micro-caps caption. The goldsmith's trust badges; never icon fonts.
- BUTTONS — le bouton-poinçon: radius min(var(--radius), 0px) — this world's corners stay cut, padding 0.95–1.1rem 2.1–2.4rem, display micro-caps 0.72–0.78rem +0.22em ivory, double hairline (outer 1px gold 40%, inner 1px gold 85% inset 5px); hover/:focus-visible fills the inner case gold (#D8B24A) and flips text to #0A0C12 over 0.35s ease. Native <button> gets appearance:none and background:transparent (the UA's grey face is a leak). Secondary action: bare micro-caps with a 1px gold underline drawing scaleX 0→1 in 0.4s.
- FORMS: fields on velvet — background transparent, 1px ivory-18% border, radius 0, 0.9rem 1rem padding, ivory text; focus border flips gold. Labels: gold micro-caps 0.7rem above each field. Phone-first: the tel input (type="tel", inputmode="tel", autocomplete="tel") sits directly after the name. Selects styled as the same bare field. Honest success state: the form is replaced by a composed moment — the maison's hallmark lozenge draws itself, one micro-caps line, one real promise ("L'atelier vous rappelle sous 24 heures, du mardi au samedi."). On valid submit dispatch the "wandit:lead" CustomEvent on document with the visitor's fields flat in detail ({ name, phone, subject, … }). Include exactly one off-canvas decoy input with data-wandit-hp (position absolute, left −9999px, tabindex −1, aria-hidden) that the page's own script NEVER reads or writes.
- FAVICON: inline SVG data URI — a gold-stroke lozenge with a center dot on the velvet hex.

## Page chassis
- Containers: content max-width 1180px, padding-inline clamp(1.4rem, 4vw, 3rem); prose 30–38ch; the gravure SVG may reach 720px wide. Section padding-block clamp(5rem, 12vh, 8.5rem).
- HEADER: in-flow, border-bottom 1px ivory-10%; wordmark in display small caps with a 12px gold lozenge glyph; 3–4 nav anchors in micro-caps 0.72rem with drawing gold underlines; tel link right. Below 640px the nav wraps beneath on its own hairline.
- FIXED OPENING — a hero that shows ONE engraving drawing on load (~2.4s) beside or behind the name: label (dashed micro-caps naming métier and city) → H1 with its gold word → one whisper ≤ 30 words → primary + secondary CTA. Composition is client-owned (split, centered-behind, framed-cover — see gestes) but the load-draw is law.
- FIXED CLOSING: the rendez-vous form (per components) beside the salon's honest facts (address, hours, tel) — close the facts column with one small engraving + italic caption (a loupe, a tray, the maison's tool) so it balances the form's height; the form sits inside or beside a double-hairline frame; then the footer — a centered filigree flourish, the wordmark at clamp(1.6rem, 3vw, 2.4rem), one address+tel line, micro-caps hours, plain © year. The gilded edge visually ends here.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike:
  · LA VITRINE GRAVÉE — 2–4 framed pieces, each engraving + name + provenance italic + price; columns staggered (the middle frame dropped 3rem) or alternating rows.
  · LE FIL D'OR — a gold hairline thread (horizontal on desktop, vertical left rail on mobile) that draws across the section, carrying 3–5 lozenge nodes: step name + glyph engraving + one line.
  · LE CABINET DE SAPHIR — a full-bleed sapphire band carrying one display sentence with its gold word and one wide engraving or the hallmark row.
  · LA GRAVURE — the pinned scrubbed showpiece (see motion).
  · LE REGARD DE PRÈS — one engraving beside its own enlarged fragment (scale 2.2–3×), a 1px hairline connecting whole to detail, caption naming the technique.
  · LA PAGE DE GARDE — a near-empty 55–70vh pause: one whisper sentence in display, one small engraving, nothing else.

## Motion identity
Registry personality: line-drawing draw-on (strokeDashoffset). ORFÈVRE's motion is the burin's patience — lines appear at engraving speed, nothing arrives faster than a hand.
- Easings: power2.out for entrances, power1.inOut for draws, sine.inOut for the edge sheen; scrub is linear. NOTHING uses back/elastic/bounce/steps.
- Draw durations 0.9–2.6s (small glyphs at the fast end, centerpieces at the slow); entrance travel ≤ 24px (autoAlpha + y 14–24px); staggers 70–160ms; glints pop 0.4–0.6s power2.out from scale 0.3.
- Page load: the gilded edge draws scaleY (1.8–2.4s) while the header settles, the hero label/dashes draw, the H1 rises, and the hero engraving draws silhouette→facets→glints (~2.4s total, overlapped).
- Frames: the four filigree corners draw first (0.7–1s, 90ms stagger), then the hairlines, then the framed content reveals.
- THE SHOWPIECE — LA GRAVURE: the maison's centerpiece engraves itself across a PINNED viewport (start "top top", end "+=260%", scrub 1): phase 1 silhouette paths draw (0–45%) and COMPLETE before any facet begins, phase 2 facet lines draw while the phase rail's active stage turns gold (45–78%), phase 3 glints pop one by one (78–100%), the caption fading in last; a stage rail (Le trait · Les facettes · Les éclats) tracks progress, each stage staying gold once its phase has begun. Exactly ONE pinned scrub per page. Below 900px the scene does not pin: the same timeline plays time-based (timeScale ~1.5) on entering the viewport.
- Hovers: gold underline draws 0.4s; frame inner hairline brightens 40%→85%; button case fills. Identical states on :focus-visible; touch gets the settled state.
- Reduced motion / dead CDN: the full tray — every engraving completely drawn, frames whole, labels at rest; hidden states only ever set by gsap.set, never in CSS. The edge sheen pauses.

## Orfèvre ban list (in addition to the global list)
1. Photography in any form — letterboxed 21:9 crops, Ken-Burns scrubs, champagne metallic-foil small caps: GÉNÉRIQUE's language. ORFÈVRE never photographs and never gradient-fills text.
2. Gold sunburst/fan rays, stepped ziggurat frames, gold chevron dividers with a center gem: FOLIES' language.
3. Arabesque ornament frames with mirror symmetry, eight-point star seals, illuminated section openers on ivory: DIWAN's language — ORFÈVRE's ornament lives ONLY in the four corners; frame sides stay bare.
4. Runtime shader/Canvas2D generative imagery, outline display type, telemetry voice, difference cursors: CINÉTIQUE's language.
5. Arch geometry, arch pills, drawn glowing room miniatures, full-page grain: MATIÈRE's language — no grain ever; the velvet is smooth.
6. White-void luxury, the centered plumb line, floating bare micro-caps labels, roman-numeral section markers in tiny centered serif: ÉCRIN's language — ORFÈVRE's dark is the point; labels carry drawn dashes.
7. Boxed drop caps with folio numbers, thin+thick double-filet rules, the italic accent word inside a roman headline: VELIN's language.
8. Wax-seal crest medallions and thin-thick-thin Oxford rules: PUPITRE's language — credentials are hallmark lozenges, never crests.
9. Neon-tube glow, multi-layer text-shadow, glass panels, backdrop-blur: VOLTAGE's language. Gold reflects; it never emits.
10. Filled cards, box-shadows, border-radius > 2px, tinted grey panels — the only container is the double hairline.
11. Gold as surface: gradient washes, gold buttons at rest, gold panels, more than one gold word per headline.
12. Bounce, overshoot, elastic, parallax drift, more than one pinned scrub, entrance travel > 24px.
13. Mono faces, icon fonts, emoji; decorative dots or sparkle fields without an engraved object to belong to.

## LES GESTES (moves menu)
1. LE FRONTISPICE FENDU — split hero: label + H1 + whisper + CTAs on one side, the load-drawn engraving inside a double-hairline frame on the other. Variants: engraving left; frame omitted and the engraving bleeding to the section edge.
2. LA COUVERTURE — hero as a single full-width double-hairline frame (the book's cover): everything centered inside, the engraving small at the frame's foot, corners drawing first.
3. LE NOM FENDU — the engraving dead-center at hero scale, the maison's name split around it (two display halves flanking), whisper below; for flacons, tall doors, single stones.
4. LA VITRINE GRAVÉE — the commerce geste: framed engraved pieces with provenance and price; stagger the middle frame or alternate rows engraving/caption.
5. LA GRAVURE — the pinned showpiece; subject variants: necklace, watch movement (gears then hands sweep once), building façade floor by floor, floor plan room by room, two rings interlocking from opposite edges, a cloche opening on a plated dish.
6. LE FIL D'OR — the drawn thread through 3–5 steps of the making; nodes are lozenges; glyph engravings 72px; the thread draws before the nodes bloom.
7. LES POINÇONS — the hallmark row: three lozenge marks with captions, on ground or on the sapphire band; draw in sequence, 150ms apart.
8. LE CABINET DE SAPHIR — the depth interlude: sapphire band, one display sentence with its gold word, one wide engraving (a chain spanning the width, a skyline, a garland).
9. LE REGARD DE PRÈS — whole piece + enlarged fragment side by side, hairline connecting them, caption naming the cut or the setting technique.
10. LE MOT DORÉ — the one gold word per headline; on entrance its tracking opens from +0.02em to rest while the rest of the line stays ivory.
11. LA COMMANDE — the closing form as a framed document: fields on velvet, gold focus, the hallmark-drawing success state, the honest callback promise.
12. LA SIGNATURE — the footer terminal: a centered filigree flourish draws, the wordmark beneath, the gilded edge ending level with it.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. LE TRAIT — Maison Ambar, haute joaillerie, Casablanca. Hero: frontispice fendu — name left with "l'or" gilded, a taille-émeraude stone drawing itself in a corner-flourished frame right. Middle: vitrine of three staggered pieces, fil d'or of four ateliers steps, sapphire hallmark band. Showpiece: the amber-drop necklace engraving chain → facets → six glints. Mood: lamplit, patient, exact.
2. LE CADRAN — Maison Helios, montres, Genève-sur-Bouregreg register. Hero: la couverture — one full-width frame, the name centered, a small crown glyph at the frame's foot. Showpiece: la complication — the movement engraves gear by gear (circles + radial ticks), then the two hands draw and sweep ONCE to 10:08 as the scrub closes. Middle plays le regard de près on the escapement. Mood: horological, metronomic.
3. LA TABLE D'OBSIDIENNE — fine dining, Rabat. Hero: le nom fendu around an engraved cloche at center. Showpiece: le service — the cloche silhouette draws, its lid line re-draws lifted, the plated dish appears beneath in facet lines, glints on the rim last. Menu as vitrine rows (plat gravé + prix MAD), sapphire band carrying the chef's one sentence. Mood: candlelit ceremony.
4. LA SUITE — Palais Amiral, hotel, Tanger. Hero: a horizon composition — the name band above, the hotel's FAÇADE engraved edge-to-edge beneath, drawing on load. Showpiece: la façade s'allume — pinned, the elevation draws floor by floor, then window glints pop one by one until the façade is lit. Fil d'or becomes the arrival ritual (quai, hall, suite, terrasse). Mood: liner-at-night.
5. L'ÉTUDE — Étude Benkirane, notaires, Casablanca. Hero: austere top-left column on a vast velvet field — label, name, one line; no hero engraving (the restraint variant), the gilded edge doubled in presence by sitting right. Showpiece: la signature — a single long calligraphic flourish draws across the pinned viewport, three acte titles blooming at its curves with their émoluments. Poinçons carry the chamber's credentials. Motion at the slowest register (2.4–2.6s draws). Mood: archival gravity.
6. LE SILLAGE — Ambre Noir, cosmetics brand (parfum), Marrakech. Hero: le regard de près played AS the hero — the name runs full-width across the top, and beneath it the flacon stands left while its stopper's cut floats enlarged 3× to the right, one hairline connecting whole to fragment. Showpiece: le sillage — from the flacon's neck a winding gold thread rises through the pinned viewport, blooming note names at its curls (bergamote · oud · ambre), a glint at each bloom. Vitrine of three flacons. Mood: perfumed dusk.
7. LE RIAD SAPHIR — spa / hammam, Fès. Hero: the portal — a tall engraved double door fills the left half full-height, unframed, bleeding to the section's edge; label, name and whisper sit right-aligned in the right half, the doors drawing on load. Showpiece: le plan — the riad's floor plan engraves room by room on the pin (patio last), each room blooming its label and temperature. Fil d'or is the bathing ritual's four steps. Two sapphire bands (steam planes) — the page's maximum. Mood: warm stone at night.
8. LA DOT — Dar Alliance, wedding services, Casablanca. Hero: a diptych — two double-hairline frames side by side (la promesse / la cérémonie), the name spanning both across the gutter. Showpiece: les alliances — two rings engrave from opposite viewport edges and interlock at center, one shared glint at the overlap. Vitrine becomes the three formules with plain MAD prices. Mood: vowed, symmetric, still.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: the ENGRAVINGS (an ORFÈVRE page with weak or missing line drawings is a dark template with gold text — the drawn objects ARE the photography budget, spent at 1px), the DRAW-ON (a page where the lines are simply present has lost its verb; the visitor must watch gold being laid), and the FRAME DISCIPLINE (one filled card or shadowed panel and the velvet becomes cardboard). The cheap details that separate it from a generated page: the filigree corners drawing before their frames, the dashed labels' drawn strokes, the ‰ in provenance lines, prices with the gold MAD affix, the hallmark lozenges near the form, the sheen drifting once across the gilded edge, the stage rail of la gravure turning gold as the burin advances. When in doubt, remove the surface and keep the line — restraint is this world's gold reserve.`,
	energy: "quiet",
	family: "dark-luxury",
	fusesWith: [
		// ecrin — bridge: white case by day, black velvet by night — one maison, two jewelry pages.
		"ecrin",
		// nocturne — bridge: the engraving meets the photograph — one maison, two nights.
		"nocturne",
	],
	id: "orfevre",
	industries: [
		"tattoo & piercing",
		"jewelry brand",
		"fashion boutique",
		"cosmetics brand",
		"fine dining",
		"hotel",
		"single property showcase",
		"aesthetic clinic",
		"notary",
		"lawyer / law firm",
		"financial advisor",
		"wedding services",
		"spa / hammam",
	],
	kind: "website",
	mood: ["hushed", "gilded", "nocturnal", "precise"],
	name: "Orfèvre",
	priceFeel: "premium",
	preview: {
		accent: "#D8B24A",
		fontFamily: "Cinzel",
		ground: "#0A0C12",
		ink: "#EFE9DC",
		sampleWord: "L'Or",
	},
	tagline: "Le velours noir de l'orfèvre : des traits d'or gravés sur la nuit.",
};
