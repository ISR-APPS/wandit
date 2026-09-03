import type { DesignWorld } from "../types";

/**
 * ÉCRIN — the jewel case.
 * Luxury through emptiness: warm-white void, 1px hairlines, micro type,
 * one centered plumb line stitching the page together. Proven against the
 * Maison Aube demo (haute joaillerie, Genève); every value below is the one
 * shipped there. The doc is appended VERBATIM to the builder system prompt.
 */
export const ecrin: DesignWorld = {
	avoidFor: [
		"fast food",
		"kids & baby shop",
		"crossfit / functional",
		"festival",
		"street food / food truck",
		"spare parts",
	],
	doc: `# DESIGN WORLD: ÉCRIN — the jewel case

## Philosophy
This page is a JEWEL CASE, not a website. The warm-white ground is the velvet; whatever the client sells is the stone; everything else is removed until only the setting remains. Its first structural fact: the client's NAME is the only large thing on the page — every other glyph on the page is ≤ 1.05rem, headings included. Hierarchy is therefore built from emptiness, tracking, hairlines and position, never from size. Its second structural fact: the page hangs on ONE dead-centered vertical axis — la ligne à plomb — a 1px hairline that draws itself downward between every section as the visitor scrolls, pausing to bloom a tiny label at each threshold. Its third structural fact: nothing is filled, shadowed, rounded or tinted — 1px hairlines and bare ground do all the construction. Loudness is structurally impossible here: there is no size to shout with, no color to shout in, no panel to shout from. So is clutter: the emptiness quota makes a dense viewport a law violation, not a taste error. Self-audit before shipping:
- Exactly ONE text element class exceeds 1.05rem: the client's name, appearing large at most twice (hero + footer terminal).
- Zero box-shadows, zero filled panels or tinted section backgrounds, zero border-radius except perfect circles.
- Every rule, frame and separator is exactly 1px.
- At least 60% of every viewport is bare ground.
- The muted client tone (if the client owns one) appears at most ONCE per viewport, never as text, never wider than 14px.
- The plumb line can be traced from below the hero name to the footer ring without a missing segment.

## The variation contract
WORLD LAW — never renegotiated by brief or builder:
- The ≤ 1.05rem law and the name-as-only-monument.
- Warm-white ground register, near-black warm ink, greige hairlines; NO chromatic accent.
- The plumb line, the floating micro-caps, the roman-numeral markers (the three owned tics).
- Hairline-only construction; one ground per page (no section alternation — the rhythm is the line and the emptiness, never color).
- Centered symmetric axis: compositions balance around the vertical center. Mirrored, flanking, centered — never deliberately off-axis.
- Garamond-family display + humanist sans micro body; never italic, never bold ≥ 600, never mono.
- Near-still motion: fades, hairlines drawing, tracking blooming; entrance travel ≤ 16px.
- Zero photography in the base world (photographs enter only through the SILHOUETTE fusion, small and hairline-framed).
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside the three registers.
- Display face within the register: Cormorant Garamond or EB Garamond.
- The ONE muted tone (or none): a desaturated whisper — poudre #C2A29A, sauge #A8B0A2, brume #A6AEB8, lin #C6BCA4 register — and WHERE its rationed appearances fall.
- The driving noun — l'aube, le silence, l'aplomb, la retenue, la descente — it names the hero label, the interlude sentence and the showpiece's kin.
- The drawn-geometry vocabulary for the offers (which 2–4 hairline elements stand for each piece, room, service or act).
- Section order beyond the fixed opening and closing; which gestes are played; the plumb-line showpiece variant (label bloom, timeline, descent, floors, drop).
An ÉCRIN page without its noun is a failure: name it FIRST, then let it choose the label, the interlude and the line's behavior.

## The vibe (voice)
Very few words, said once. Short declaratives, concrete numbers, zero adjectives of self-praise — the words "luxe", "prestige", "exception", "exclusif" are BANNED: claiming luxury is what cheap pages do. Prices are said plainly and completely. Example register (demo language French):
- "Douze pièces par an. Rarement plus."
- "L'atelier reçoit sur rendez-vous, du mardi au samedi."
- "CHF 18 400.– — saphir de Ceylan non chauffé, 2,4 carats."
No exclamation marks, no rhetorical questions, no "découvrez". One honest hospitality line near the contact ("La maison vous rappelle avant demain soir." register).

## Visual signatures
- THE ≤ 1.05rem LAW: the client's name set in the display serif at clamp(3.6rem, 13vw, 10rem), weight 300–400, line-height 1.02; every other glyph ≤ 1.05rem. The contrast between one enormous word and a page of whispers IS the identity.
- FLOATING MICRO-CAPS (owned tic): uppercase labels 0.66–0.72rem, +0.28–0.35em tracking, weight 400–500, in ink or greige, sitting on bare ground — never inside a pill, never underlined, never over a rule. Centered ones carry text-indent equal to their tracking so they optically center.
- THE PLUMB LINE (owned tic + showpiece): a 1px vertical hairline in greige on the exact horizontal center, drawing downward (scaleY, transform-origin top) through a threshold gap of clamp(11rem, 24vh, 15rem) before every section, ending at a node.
- ROMAN-NUMERAL MARKERS (owned tic): I · II · III in the display serif, 0.8–0.9rem, weight 400, centered on the line at each node, with the section's micro-caps label blooming 0.9rem below. Unnumbered pauses mark their node with a single interpunct "·".
- HAIRLINE-ONLY CONSTRUCTION: every frame, rule and separator is 1px, in greige (#B8B2A6 register) or ink at 12–16% opacity. Frames are rare and always rectangular, radius 0.
- DRAWN-GEOMETRY OFFERS: each offer abstracted to 2–4 hairline SVG elements (circle, line, arc, dot) at 280–420px — large scale lives in imagery and emptiness, never in type.
- EMPTINESS QUOTAS: section vertical padding clamp(4rem, 9vh, 6.5rem); threshold gaps clamp(11rem, 24vh, 15rem) — the emptiness budget lives in the line-crossed thresholds, never in line-less padding; ≥ 60% bare ground per viewport.

## Color physics
- GROUND: the #FCFBF8 / #FAF9F5 register — one warm white per page, chosen once, never alternated. No dark or inverted sections, ever: the case never closes.
- INK: the #1A1A18 / #201F1C register — warm near-black, never #000.
- GREIGE: the #B8B2A6 / #ABA69B / #C4BFB4 register — hairlines, whisper labels, placeholders, the plumb line, secondary captions. Greige is structure, not decoration.
- MUTED CLIENT TONE (optional, client-owned): one desaturated tone with saturation ≤ 25% and lightness 60–72% (poudre #C2A29A, sauge #A8B0A2, brume #A6AEB8, lin #C6BCA4 register). Budget: at most ONE appearance per viewport, only as a filled dot or stone ≤ 14px in a drawing or interlude — never text, never a fill area, never a border. Three appearances per page is the ceiling.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · INK→--primary · GROUND→--primary-foreground · GROUND→--secondary · MUTED CLIENT TONE→--accent · GREIGE→--muted · ink at 14%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every register sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- NO chromatic accent beyond that tone. NO gradients anywhere on the page — not in backgrounds, not in strokes, not "subtle washes". NO gold (#A87E3F–#D4AF37 territory) in any form.
- ::selection is inverted case: ink ground, warm-white text.

## Typography system
- DISPLAY: Cormorant Garamond or EB Garamond (Google Fonts), weights 300–500 only. Used ONLY for: the name (clamp(3.6rem, 13vw, 10rem) hero; clamp(2.2rem, 5vw, 3.2rem) footer), roman numerals, prices and the interlude sentence at ≤ 1.05rem. Huge but rare.
- BODY: Instrument Sans or Hanken Grotesk, weights 400–500. Prose 0.85–0.95rem, line-height 1.75–1.9, measure 26–36ch, flush-left or centered only when ≤ 3 lines.
- MICRO-CAPS: body face 400–500, 0.66–0.72rem, +0.28–0.35em tracking, uppercase. The only "heading" style below the name.
- Hard rules: NEVER italic (the whisper is tracking and size, not slant). Never weight ≥ 600. Never a mono face. Never letter-spacing on the display serif name beyond ±0.02em. Centered tracked caps always get matching text-indent.
- Arabic pages: display Amiri 400 for the name; body IBM Plex Sans Arabic 300/400. Letter-spacing is REMOVED on Arabic script (tracking breaks the ligatures) — micro labels rely on size and greige alone; numerals stay roman.

## Signature art / components
LA GÉOMÉTRIE DU BIJOU (imagery system): every offer is drawn as an abstraction of 2–4 hairline elements — a ring is a 1px circle with a small stone-circle seated at its top point; a pendant is a chain "V" of two diagonals, a vertical drop line and one filled stone-dot; a pair is two mirrored circles; a room is a thin rectangle; a service is a line and a dot. Rules: SVG stroke 1px ink (vector-effect: non-scaling-stroke), flat frontal elevation, zero shading, zero fill except the single stone-dot ≤ 14px (greige, or the client tone within its budget). Figurative line-engravings that draw themselves on scroll are FORBIDDEN — that is ORFÈVRE's tic; ÉCRIN's drawings appear whole and near-still, only straight hairlines ever draw. Every drawing carries role="img" and a real aria-label in the page's language.
- BUTTONS — le bouton-écrin: 1px ink rectangle, radius min(var(--radius), 0px) — the case's corners stay cut, padding 1.05rem 2.8rem, micro-caps 0.7rem +0.3em; on hover/focus-visible the case fills ink and text flips to ground over 0.45s ease. Secondary action: bare micro-caps with a 1px underline that draws scaleX 0→1 in 0.5s.
- LINKS: no resting underline; a 1px hairline draws beneath on hover AND :focus-visible, 0.4–0.55s.
- FORMS: bare fields — no boxes; a 1px greige bottom hairline that turns ink on focus, 3.2rem row height, floating micro-caps label above each field, generous 2.6rem field gaps. Phone-first: the tel input (type="tel", inputmode="tel", autocomplete="tel") sits directly after the name. Selects styled as the same bare field. Honest success state: the form is replaced by a composed centered moment — a small 1px ring, one micro-caps line, one sentence with a real promise ("La maison vous rappelle avant demain soir."). On valid submit dispatch the "wandit:lead" CustomEvent on document with the visitor's fields flat in detail ({ name, phone, subject, … }). Include exactly one off-canvas decoy input with data-wandit-hp (position absolute, left −9999px, tabindex −1, aria-hidden) that the page's own script NEVER reads or writes.
- LE CERTIFICAT (spec table): a 1px hairline-framed rectangle, max-width 40rem, rows of label (micro-caps, left) and value (0.9rem, right), separated by 1px greige rules that draw from center on entrance.
- FAVICON: inline SVG data URI — a 1px ink vertical line ending in a small stroked circle, on the ground hex.

## Page chassis
- Containers: content max-width 68rem; prose columns 26–36ch; certificat max-width 40rem; the drawn geometry may reach 420px. Section padding clamp(4rem, 9vh, 6.5rem); thresholds clamp(11rem, 24vh, 15rem).
- HEADER: static, no background, no border, no blur. Grid 1fr auto 1fr: left — two micro-caps anchors; center — the wordmark in micro-caps 0.72rem +0.35em; right — tel link + rendez-vous anchor. Below 640px: wordmark + tel only. All anchors point to real section ids.
- FIXED OPENING — l'ouverture au nom: min-height 88–96vh, centered column: (optional client-tone dot) → floating micro-caps line naming métier and city → the NAME at clamp(3.6rem, 13vw, 10rem) → one whisper sentence ≤ 30 words at 0.95rem → a tiny secondary micro line (roman-numeral founding year register) → the first plumb segment drawing down ~7rem on load.
- FIXED CLOSING: the rendez-vous form (fields per above, one intro line stating real hours), then the terminal footer: the last plumb segment ends in a 12px 1px-stroked ring (le point final), the name in display at clamp(2.2rem, 5vw, 3.2rem), one address + phone line at 0.85rem, hours in micro-caps, © year in roman numerals in greige 0.7rem.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike:
  · LES COLONNES JUMELLES — two 26–30ch prose columns flanking the central axis symmetrically, 8–12% gutter each side of center.
  · LA VITRINE SOLITAIRE — one offer per ~70vh row: drawn geometry on one side of the axis, caption block (greige numbering micro-line "Pièce I — sur douze" register, micro-caps name, one 0.85rem line, price in display serif 1.05rem) mirrored on the other; sides alternate row by row.
  · LE CERTIFICAT — the framed spec table, centered.
  · LA TRIADE — three centered micro entries separated by two 1px vertical hairlines (grid 1fr 1px 1fr 1px 1fr); below 700px the separators become 3rem horizontal rules.
  · L'INTERLUDE — min-height 50–65vh, one sentence ≤ 20 words in the display serif at 1.05rem, centered, with the client tone's dot above it; the unnumbered "·" node.
  · LA CHAMBRE — a full-viewport near-empty room: one drawing centered, one caption line, nothing else; reserved for the signature offer.
- THE SHOWPIECE — LA LIGNE À PLOMB: every threshold's segment scrub-draws (scaleY 0→1, origin top) across its own scroll window (start "top 82%", end "bottom 55%", scrub ~1); as the line completes, the node blooms: numeral fades in, label fades while its tracking opens 0.16em → 0.3em. The TERMINAL threshold ends "bottom 88%" instead — its ring must be able to bloom at max scroll. The line never pins, never parallaxes — it simply descends with the reader, the page's pulse.

## Motion identity
Registry personality: near-still micro-motion, hairlines drawing (1.4–2s). ÉCRIN is the quietest world in the catalogue — motion is barely-witnessed settling, never performance.
- Easing: power1.out for entrances, sine.inOut for loops and crossfades. NOTHING uses back/elastic/bounce/steps. Durations 1.4–2s; staggers 150–250ms.
- Entrances: opacity (autoAlpha) with y ≤ 12px — entrance travel never exceeds 16px. Hairlines (certificat rules, triade separators, underlines) draw via scale 0→1 over 1.4–1.8s. Micro-caps bloom: fade in while tracking opens from 0.16em to its 0.3em rest.
- Hero sequence on load: tone dot → label bloom → name fade (2s) → whisper → first segment draws — ~2.8s total, overlapped.
- Scrub: exactly ONE scrubbed system per page (the plumb-line spine). No pinned scenes, no parallax, no horizontal scrub — ÉCRIN never pins.
- Micro-breath: at most TWO elements per page may breathe — scale 1→1.006 over 4–6s sine.inOut yoyo; a suspended stone may sway ±0.5deg with transform-origin at its chain top.
- Hovers: 0.4–0.55s hairline draws and case-fills; identical states on :focus-visible; touch gets the settled state, no hover-dependent content.
- Reduced motion / dead CDN: the full composed page — all lines drawn, all labels at rest tracking, all drawings whole. Dual-visibility law: hidden states only ever set by gsap.set, never in CSS.

## Écrin ban list (in addition to the global list)
1. Any text above 1.05rem that is not the client's name — no exceptions, not for prices, not for numerals, not for pull-quotes.
2. Any chromatic accent, any gradient, any tinted or dark section — one warm-white ground, period.
3. Gold in any form, gold hairline engravings that draw themselves on scroll, filigree corner flourishes — that is ORFÈVRE's language.
4. Type-over-photo collisions, mixed-scale display lockups, the single crimson accent word — SILHOUETTE's language; base ÉCRIN carries zero photography.
5. Boxed drop caps, the italic accent word, double-filet rules — VELIN's language; ÉCRIN never sets an italic glyph.
6. Sumi-e brush strokes, vertical writing-mode labels, off-center ma composition — WABI's language; ÉCRIN's axis is dead-center and symmetric.
7. Words-as-layout at viewport scale, black/white inversion flips, thick underline slabs — MANIFESTE's language.
8. Full-page grain, arch geometry and arch pills, drawn glowing room miniatures, warm double-ground alternation — MATIÈRE's language.
9. Filled cards, panels or chips; box-shadows of any blur; border-radius except perfect circles.
10. Font weight ≥ 600 anywhere; any mono face; letter-spacing on Arabic script.
11. Icons of any kind — the world's only pictures are its hairline geometry.
12. More than one scrubbed system; pinning; parallax; entrance travel > 16px.
13. Decorative dots/shapes scattered without the tone budget — every mark on the ground must be countable and named.

## LES GESTES (moves menu)
1. L'OUVERTURE AU NOM — the fixed hero: label, NAME, whisper, first segment. Variants: name on one line; name split on two lines; name tracked wide at reduced size (never below 3.6rem).
2. LA VITRINE SOLITAIRE — one offer per ~70vh, geometry and caption mirrored across the axis, alternating sides row by row. The core commerce geste.
3. LES COLONNES JUMELLES — twin prose columns flanking the center; use for the maison/story section; each column ≤ 30ch, 4–6 sentences.
4. LE CERTIFICAT — the hairline-framed spec table; rows draw their rules from center, 150ms apart. Use for provenance, tariffs, protocols, honoraires.
5. LA TRIADE — three micro entries between two vertical hairlines; use for services, hours, practice areas. Separators draw on entrance.
6. L'INTERLUDE — the unnumbered pause: one display-serif sentence in 50–65vh of emptiness, the tone's dot above. Place at the page's midpoint.
7. LA BASCULE MIROIR — any content pair mirrored around the axis (text left / geometry right, then flipped); keeps symmetry while escaping stacked-center monotony.
8. LE SEUIL FLEURI — the node treatment: numeral + blooming label; variants: interpunct node for pauses, tone-dot node (counts against the budget), date node for timelines.
9. LE POINT FINAL — the footer terminal: the line ends in a 12px stroked ring above the closing name. Variants: ring, plain dot, the tone's last appearance.
10. LA RESPIRATION — grant breath (scale 1→1.006, 4–6s) to at most two drawings; a pendant stone may sway ±0.5deg. Everything else holds still.
11. LE TRAIT TIRÉ — the drawn 1px underline as hover, focus and active-nav state; also usable as a 3rem centered rule closing a section.
12. LA CHAMBRE — one full viewport, one drawing, one caption: the signature offer alone in its case.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. L'AUBE — Maison Aube, haute joaillerie, Genève. Hero: centered name under a rising poudre dot, whisper naming the twelve yearly pieces. Vitrine of three pieces alternating around the axis, interlude at midpoint, certificat, triade of services, rendez-vous. Showpiece: the label-blooming spine, numerals I–V. Mood: dawn-quiet, precise, unhurried.
2. LE TESTAMENT — Cabinet Verne, notaires, Genève. Hero: the name high in the viewport, the line starting immediately beneath and running long into empty ground before section I. Order opens on the certificat (les actes et leurs émoluments) before the story. Showpiece: le fil du temps — the spine blooms DATES (1897 · 1952 · 2011) with one-line facts of the étude's history. Motion: pure 2s fades, zero travel. Mood: archival, grave, exact.
3. LA GOUTTE — Néroli, parfumeur, Genève. Hero: the name split on two lines hugging the axis, sauge tone. Chambre first: the flacon drawn as a hairline rectangle and shoulder arcs. Showpiece: on scrub, a single sauge drop detaches from the line's tip and falls into the flacon outline waiting at the next node. Motion: the drop is the page's only traveler. Mood: still air, held breath.
4. L'APLOMB — Hôtel du Lac, hotel, Lausanne. Hero: the name in the lower third, vast empty "sky" above it. Showpiece: les étages — the spine descends through five floor-marks V→I, each blooming a room name and its CHF tariff. Rooms as vitrine rows with thin-rectangle plans; triade of table, cave, quai. Motion: one slow breathing drawing per floor. Mood: lakeside hush.
5. LA RETENUE — Studio Meier, architecture portfolio, Zurich. Hero: the name tracked +0.02em on a single line, brume tone. Showpiece: le plan suspendu — projects hang on the line as proportional hairline rectangles, each settling from 2° to 0° as the line reaches it. Colonnes jumelles for the practice statement; certificat lists competitions won, plainly. Mood: engineered calm.
6. LA CONSULTATION — Étude Rivaz, avocats, Genève. Hero: twin micro-caps columns (domains left, bar admissions right) above the centered name. Order opens on la triade (three practice areas), then colonnes jumelles, then certificat des honoraires. Showpiece: the spine pauses at each domain and blooms a one-line, dated precedent. Motion: fades only, 1.8s, no y — the stillest sibling. Mood: discretion made visible.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: the ≤ 1.05rem LAW (one oversized subheading and the page collapses into ordinary minimalism — the name must be the only monument), COMPOSED EMPTINESS (the 60% quota only works because the plumb line and the nodes make the void read as intention, not absence — a dead zone is emptiness without the line), and HAIRLINE DISCIPLINE (one 2px border or soft shadow and the case becomes cardboard). The cheap details that separate ÉCRIN from a generated page: text-indent matching the tracking on centered caps, roman numerals for years and sections, prices set in the display serif with the Swiss ".–", the ground-colored gap where a numeral sits on the line, the honest callback promise in the success state, the 12px ring that ends the page. When in doubt, remove — subtraction is this world's voltage.`,
	energy: "quiet",
	family: "extreme-minimal",
	fusesWith: [
		// silhouette — bridge: photography enters the void — fashion.
		"silhouette",
		// orfevre — bridge: the white case opens on black velvet — jewelry day/night.
		"orfevre",
	],
	id: "ecrin",
	industries: [
		"specialist (cardio, derma, ophtalmo…)",
		"jewelry brand",
		"aesthetic clinic",
		"skincare / esthetician",
		"cosmetics brand",
		"architect (firm)",
		"architecture portfolio",
		"single property showcase",
		"interior design / home staging",
		"fine dining",
		"notary",
		"lawyer / law firm",
		"financial advisor",
		"fashion boutique",
		"photographer",
		"spa / hammam",
		"hotel",
	],
	kind: "website",
	mood: ["hushed", "precious", "weightless", "precise"],
	name: "Écrin",
	priceFeel: "premium",
	preview: {
		accent: "#B8B2A6",
		fontFamily: "Cormorant Garamond",
		ground: "#FCFBF8",
		ink: "#1A1A18",
		sampleWord: "Le Silence",
	},
	tagline: "Le luxe par le vide : un écrin blanc, des filets, le silence.",
};
