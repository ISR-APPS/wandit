import type { DesignWorld } from "../types";

/**
 * SILHOUETTE — the fashion magazine.
 * Photographic world (B/W editorial fashion). Proof demo: ARCHIVE SEIZE,
 * fashion boutique, Paris, EUR, French. The doc is appended VERBATIM to the
 * builder system prompt.
 * fusesWith rationale — ecrin: photography enters the void (minimal fashion);
 * manifeste: the image meets the argument (campaign sites).
 */
export const silhouette: DesignWorld = {
	avoidFor: [
		"kindergarten / crèche",
		"general contractor",
		"pharmacy",
		"fast food",
		"camping / glamping",
	],
	doc: `# DESIGN WORLD: SILHOUETTE — the fashion magazine

## Philosophy
This page is a SPREAD FROM A PARIS FASHION-WEEK ISSUE, not a website. Two materials exist — enormous didone type and black-and-white editorial photography — and the entire art is the TENSION between them: type overlaps the photographs, photographs crop the type, neither ever politely steps aside for the other. Its defining structural facts: (1) at least THREE type-over-photo collisions per page, with measured overlap — a headline that merely sits NEAR an image is a failure; (2) mixed-scale lockups — a giant display element and a tiny caption bound into one composition at a ratio of 12:1 or more; (3) the crimson budget — exactly ONE crimson element per viewport, everything else pure black on white; (4) zero border-radius and zero box-shadow anywhere — depth exists only through overlap, like layered paper on a light table. Impossible failure modes: a colorful page; a soft or rounded page; a stock-photo hero with dimmed overlay and centered white type; type and image living in separate, non-touching boxes; two accent colors. Self-audit before shipping: count ≥3 collisions where display type crosses a photo edge by 8–18% of the photo's width; every micro caption within 24px of a display element or photo edge (never floating alone); ≤1 crimson element per 100vh slice of the page; zero elements with border-radius > 0 or any box-shadow; every image grayscale; at least one lockup at ≥12:1 scale ratio in the first viewport.

## The variation contract (why two SILHOUETTE sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- The didone display register (Bodoni Moda / Libre Bodoni), tight leading, huge scale.
- B/W photography under the imagery law below; zero color imagery.
- The collision requirement (≥3 measured type-photo overlaps) and the lockup law (≥12:1).
- The crimson budget: one appearance per viewport, snap-on (never tweened), never italic.
- White ground, 0 radius, 0 shadow, hairline rules, editorial-snap motion.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside the registers: ground #FAFAF8 / #F7F5F1 / #FCFBF7; crimson #B3122E / #A6112B / #C41230; the ink stays #0D0D0D.
- Display face within the register (Bodoni Moda or Libre Bodoni), caps vs mixed-case display, and whether ONE full italic display line exists (never more).
- The DRIVING NOUN of the issue — le numéro, l'archive, le vestiaire, la saison, le regard — it names the hero, the showpiece, the section labels and the copy voice.
- The photographic subjects and crops, the showpiece variant (le défilé family, below), the section order beyond the fixed opening and closing, which 2–3 gestes play, and the ink-spread decision: zero or exactly one full-bleed ink section (the runway stage) — never more.
A SILHOUETTE page without a driving noun is a catalog; name the issue FIRST ("Nº 16", "Archive 03", "Saison Blanche"), then let it choose looks, words and crops.

## The vibe (voice)
French fashion-editorial: short, cutting, certain. Declaratives under ten words carry the page; prices and facts are stated flat, without apology or hype. Examples of the register: "La mode passe. La coupe reste." · "Chaque pièce a déjà vécu. C'est pour ça qu'elle vous va." · "Seize pièces par saison. Pas une de plus." Never exclamation marks, never "univers", never luxury-brochure vapor ("écrin d'exception"). Captions speak like magazine credits: "Look 03 — Smoking, laine, 1987."

## Visual signatures
- THE COLLISION (owned tic): display type crossing a photograph's edge by 8–18% of the photo's width, at least 3 per page. At least once per page the z-sandwich plays: one display line ABOVE the photo, the next line passing BEHIND it (z-index 3 / 2 / 1), so the image visibly bites the word.
- THE MIXED-SCALE LOCKUP (owned tic): a giant display word or numeral bound to a micro caption at a scale ratio ≥12:1 (e.g. 9rem display against 11px caps), the caption anchored to a corner or baseline of the display element, never more than 24px away. The lockup moves as ONE object.
- THE CRIMSON BUDGET (owned tic): ≤1 crimson element per viewport. Legal forms: one word inside a headline, one 2–3px rule ≤120px long, one numeral, or one filled CTA. Crimson NEVER tweens — it snaps on (duration 0) when its section enters. Crimson is never italic, never tinted, never at reduced opacity. Transient interaction states (:focus-visible ring, ::selection) are exempt from the count.
- Hairline system: 1px solid #0D0D0D rules structure the page (section labels sit ON a hairline, index rows are separated by hairlines); secondary rules and de-emphasized text in warm grey #B9B6B0.
- Radius 0, shadow 0, everywhere — buttons, photos and fields use min(var(--radius), 0px): all sharp rectangles, this world's corners stay cut. Depth is overlap: photos overlap each other 10–20%, type overlaps photos; nothing ever floats on a shadow.
- Giant FILLED didone numerals (issue and index numbers) as compositional anchors — always solid ink or crimson fill, never outlined or stroked.
- Photography ratio discipline: portrait 3:4 or 2:3 for figures, 1:1 for accessories; generous seamless margins inside the frame so type has room to collide.

## Color physics
- GROUND: the #FAFAF8/#F7F5F1 register — one white per site, used everywhere. No section tinting, no alternating grounds.
- INK: #0D0D0D. Text, rules, filled numerals, the dark stage. Never pure #000.
- CRIMSON: the #B3122E register, under the budget above. It is EDITORIAL punctuation, not a theme color: never backgrounds larger than a CTA, never borders around sections, never gradients, never twice in one viewport.
- WARM GREY: #B9B6B0 — secondary captions, de-emphasized meta, secondary hairlines. Never for display type.
- THE INK SPREAD: at most ONE full-bleed #0D0D0D section per page (the runway stage for the showpiece), where text flips to the ground white. This is a single dramatic beat — rhythmic black/white section alternation is MANIFESTE's language and is banned.
- Gradients exist ONLY inside photographs (the studio seamless falloff) — never on sections, buttons or type.
- Images are grayscale, always: client photography ships with filter: grayscale(1) contrast(1.08) as the floor.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · CRIMSON→--primary · GROUND→--primary-foreground · GROUND→--secondary · THE INK SPREAD→--accent · WARM GREY→--muted · INK→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every register sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Bodoni Moda or Libre Bodoni (Google Fonts), weights 400–700, optical size at maximum where variable. Leading 0.90–0.96, tracking −0.01em to −0.02em. Hero scale clamp(3.8rem, 12vw, 11.5rem); section titles clamp(2.2rem, 5vw, 4.8rem); prices and big numerals take the display face. Italic: at most ONE full display line per page may be italic; a single italic accent word inside a roman headline is VELIN's tic and banned; crimson words are always roman.
- BODY: Inter 300–500, 14–16px, line-height 1.55–1.7, columns ≤34em. Inter NEVER sets display (global law) and never exceeds 1.125rem.
- MICRO CAPTIONS: Inter 500, 10–11px, uppercase, +0.14em to +0.18em tracking — but ALWAYS locked to a display element, a photo edge or a hairline. A letter-spaced micro-caps label floating alone on bare ground is ECRIN's whisper and is banned here.
- Numerals: display face, filled, lining. No tabular-mono telemetry — this world speaks magazine, not machine.
- ARABIC PAIRING: if the site serves Arabic, display becomes Amiri 700 (the high-contrast serif register), body IBM Plex Sans Arabic 300–500; all tracking laws drop (Arabic is never letter-spaced); the scale law, collision law and crimson budget are unchanged; lockup anchors mirror for RTL.

## Signature art / components
IMAGERY LAW (photography is the law of this world): black-and-white editorial fashion photography. Subjects: garments in motion, fabric close-ups, accessories on seamless, model mid-movement — never direct eye-contact close-ups. Light: hard single flash, deep contrast, sharp cast shadow. Grade: true blacks, bright whites, punchy midtones, visible film grain. Framing: full-length figures and tight crops with generous seamless margins left free for type collision; subject off-center when type will cross it. Generation art-direction phrase, reused verbatim in EVERY generation: "black-and-white editorial fashion photograph, hard single flash, deep contrast, clean seamless studio background, sharp cast shadow, film grain, model mid-movement". Production sites regrade client photography to this law (grayscale(1) contrast(1.08) floor, crop to the ratio discipline). FALLBACK when no photography exists: abstract B/W fabric silhouettes drawn as layered SVG bézier sweeps — studio-seamless gradient backdrop (#EFEDE9→#C6C3BC with a radial hotspot), 3–5 layered near-black fabric curves (#0F0E0D–#3A3733), 1–2 thin white highlight strokes, one hard skewed cast-shadow shape (#8A867F at 45–55% opacity), and an feTurbulence grain rect (baseFrequency 0.9, opacity 0.10–0.16) — the same grade, drawn. Grain lives INSIDE the frames only; full-page grain is MATIÈRE's plaster.
- BUTTONS: sharp rectangles, Inter 500 caps 11px +0.14em, padding 14–16px 28–32px. Ghost: 1px ink border, ink text. Filled: ink fill, ground text. Hover/focus inverts instantly (≤150ms). The crimson-filled CTA exists at most once per page and counts as its viewport's crimson.
- FORMS: fields as sharp 1px-hairline boxes on ground, 0 radius; labels as locked micro caps at the field's top-left; téléphone input (type="tel") placed first among contact channels — phone-first; select for structured choices; :focus swaps the border to 2px ink. Success state is HONEST and composed: a display-serif "Bien reçu." plus the real next step in body type — no confetti, no checkmark badges. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail, and include one off-canvas decoy input with data-wandit-hp that the page's own script never reads or writes.
- LABELS: section labels are micro caps sitting directly ON a full-width hairline (border-top), left-aligned, with issue meta right-aligned on the same rule.
- CARDS: there are none. A "piece" is photo + lockup on bare ground with at most a hairline above or below. Boxes with backgrounds and paddings around content read as web, not print, and are banned.

## Page chassis
- FIXED OPENING (hero law): the first viewport must contain — the full brand name at display scale, ONE collision (the z-sandwich preferred), ONE ≥12:1 lockup carrying the issue noun, and the viewport's single crimson. Header above it: small serif wordmark left, Inter micro-caps nav right, one hairline under, no blur, no shadow, no fixed chrome required.
- FIXED CLOSING: the contact spread (display headline + phone-first form per the law above), then the colophon footer — the magazine's back page: one hairline, a modest centered or flush-left serif wordmark, tiny credit lines (address · hours · tél · mail as real tel:/mailto: links), no giant footer wordmark (a viewport-filling word is AFFICHE's move).
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: L'ÉDITO (display statement 9 columns wide with a small inset photo breaking the text block and a narrow caption margin-column) · LE DÉFILÉ (the scrubbed showpiece, below) · LA COUPE (offset editorial grid: 12 columns, items spanning 4–6 columns at staggered top offsets of 0/96–160px) · LE CAHIER (full-height 5/7 split spread: photo one side, title + credit rows the other) · L'INDEX (hairline rows: filled numeral + name + one-line description + right meta; row inverts to ink on hover/focus) · LA CITATION (one display pull-quote locked to a tiny source caption and one small photo overlapping its first word).
- Vertical rhythm: section padding clamp(6rem, 14vh, 10rem); content container max 1360px with 24–40px gutters; photos may bleed to the viewport edge; the grid is 12 columns and compositions are asymmetric — a 50/50 split may appear at most once.

## Motion identity
The personality: EDITORIAL SNAPS — the page never slides in, it PRINTS. Plus photo crossfades.
- Entrances: opacity fades ONLY — 0.35–0.55s, power1.out, staggers 50–90ms. NO translateY, no scale, no rotation on entrances; elements appear in place like ink hitting paper.
- Crimson: never animated with a tween. gsap.set on section enter — it is simply THERE (LE MOT ROUGE, below).
- Photo crossfades: 0.5–0.7s, power1.inOut, used between looks and on gallery swaps.
- Hovers: instant inversions and swaps, 120–180ms, with keyboard/touch parity (:focus-visible mirrors :hover); photos may scale 1.02–1.03 max inside their frame.
- THE SCRUBBED SHOWPIECE (one per page, from the défilé family): a pinned stage, pin length 220–300%, where photographs crossfade like runway exits in equal segments while ONE giant display word travels THROUGH the frame between photo layers, and the crimson lands (snaps) on the final look at ~85% progress. Caption lockups snap per segment (no tween). Variants must keep: pin + crossfade + a snap event.
- Gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). Hidden states set ONLY via gsap.set — CSS never hides; with JS dead the page reads fully composed, the showpiece resting on its final look with the crimson landed.
- Mobile (<768px): no pinning; the showpiece renders its final composed look with fade entrances; grid offsets flatten.
- Reduced motion: the complete composed page, zero movement, showpiece at the final look.

## Ban list (world-specific, beyond the global ban list)
- Letterbox bars, champagne-foil metallic small caps, Ken-Burns caption scrubs — that is GÉNÉRIQUE's cinema.
- Words-as-layout with no imagery, alternating black/white section inversion flips, 8–16px underline slabs — that is MANIFESTE's language.
- Floating micro-caps labels on bare ground, the centered plumb line, roman-numeral section markers (I · II · III) — that is ECRIN's whisper.
- Halftone-dot image treatment and masthead furniture (datelines, edition numbers, "suite p.4") — that is GAZETTE's press.
- Boxed drop caps with folio numbers, double-filet rules, the single italic accent word in the accent color — that is VELIN's book.
- Outline/stroked display type, mix-blend-mode difference chrome, telemetry captions — that is CINÉTIQUE's machine.
- Color photography, duotones, sepia or any tinted image treatment — imagery is grayscale, full stop.
- Any border-radius above 0; any box-shadow (soft floating cards are CLAIR's).
- A second accent color, crimson backgrounds larger than a CTA, crimson at reduced opacity, crimson fading in.
- Script or handwritten faces; decorative dingbats.
- Photos in rounded or masked shapes — the rectangle is the only crop.
- More than one full-bleed ink section per page.
- Timid collisions: display type "overlapping" a photo by less than 8% of the photo's width reads as an accident, not a composition.

## LES GESTES (the moves menu)
1. LA COLLISION — the hero handshake: brand name in two stacked display lines, a portrait photo placed so line one passes ABOVE it and line two slips BEHIND its edge (z 3/2/1). The photo must bite 8–18% into the word.
2. LE CADRAGE — a photo frame slices type: an overflow-hidden photo box crops the tops or tails of letters that visibly continue outside it, as if the image were pasted over the word after printing.
3. LE LOCKUP GÉANT — a display word or numeral at 8–12rem with a 10–11px caption bolted to its corner or baseline (≥12:1). The pair is one object: they enter together, align together.
4. LE DÉFILÉ — the showpiece prototype: pinned dark or white stage, looks crossfading in equal scrub segments, one giant word traveling x through the frame between photo layers, crimson snapping onto the final look.
5. LA COUPE — the offset grid: pieces spanning 4–6 of 12 columns, alternating top offsets of 0 and 96–160px, prices in display serif on a hairline under each photo. Never a uniform card grid.
6. LE CAHIER — the split spread: a full-height photo on 5 columns, title + paragraphs + hairline credit rows (label left, value right) on 7. The photo may bleed to the viewport edge.
7. L'INDEX — the services index: hairline-separated rows of filled display numeral + serif name + one body line + right-aligned meta; the row inverts to ink instantly on hover/focus-within.
8. LE MOT ROUGE — the crimson landing: the section's one crimson element is set (never tweened) the instant its section enters — a word turning red like a stamp hitting the page.
9. LA PAIRE — two photos at different scales (roughly 2:1 area) overlapping 10–20% at a corner, one caption lockup serving both; the smaller rides the larger like a tipped-in print.
10. LE CHIFFRE — a giant filled didone numeral (the issue number) as a compositional anchor, cropped by the viewport edge or with a small photo tucked against its counter; caption locked to its foot.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. MAISON RIVE — couture house, "l'archive". Hero: LA COLLISION — the maison's name in two stacked lines, a full-length figure photo biting the second line (z-sandwich), issue lockup at the baseline. Middle: l'édito → défilé → la coupe → le cahier. Showpiece: the canonical DÉFILÉ on an ink stage — four looks crossfade while the collection word slides through between backdrop and figure, crimson landing on look four. Mood: severe, assured, archival.
2. STUDIO CONTRE-JOUR — photographer, "le regard". Hero: LA UNE — one full-bleed photograph edge to edge, the studio name set small-caps across the top edge like a cover masthead (no dateline furniture), a 12:1 issue lockup bottom-left, crimson rule under the name. Middle: la coupe (série grid) → citation → cahier. Showpiece: LA PLANCHE-CONTACT — a pinned contact sheet of nine frames; scrub moves a crimson selector rectangle frame to frame (snapping, never gliding) while the selected frame enlarges by crossfade into the backdrop. Mood: documentary, precise, quiet.
3. NUMÉRO NEUF — cosmetics brand, "l'essence". Hero: L'ÉQUILIBRE — the product photographed dead-center on seamless, the brand name split around it (one word flush-left, one flush-right, baselines offset by 0.5em), a micro caption locked under the left word and a crimson "Nº 9" numeral locked above the right one. Middle: édito → l'index (rituels) → coupe. Showpiece: L'ESSENCE — one photograph stays fixed while giant note-words (iris, cuir, vétiver) crossfade THROUGH it in sequence; the final note snaps crimson. The inverse of the défilé: image still, words moving. Mood: concentrated, olfactory, exact.
4. SALON ROSSI — hair salon, "la métamorphose". Hero: LE CADRAGE — the salon name sliced by two staggered portrait frames whose letters continue between and outside them, caption lockup hanging from the lower frame. Middle: l'index (soins) → cahier → citation. Showpiece: LA LIGNE DE COUPE — a pinned before/after pair occupying one frame; scrub drives a hard vertical seam (a 2px crimson rule riding a clip-path edge) across the image, revealing after over before; caption lockups snap at 0% and 100%. Mood: transformation, sharp, personal.
5. MAISON ORO — jewelry brand, "la vitrine". Hero: LA PAIRE — two photographs at 2:1 scale overlapping at the upper right (macro clasp over full necklace on seamless), the brand name flush-left beneath at display scale, one caption lockup serving both frames, crimson numeral for the collection. Middle: coupe → cahier → édito. Showpiece: LA VITRINE — a pinned 6-piece grid; scrub spotlights one piece at a time (the others crossfade to 15% opacity), its lockup snapping in; the signature piece's price snaps crimson last. Mood: hard light, small objects, high stakes.
6. DROP QUATRE — streetwear drop, "le vestiaire". Hero: LE CHIFFRE — a giant filled "04" filling the left half-viewport, a garment photo tucked into the zero's counter, release lockup bolted to the numeral's foot, crimson rule under the date. Middle: coupe → index (règles du drop) → citation. Showpiece: LE PORTANT — a pinned rail: garment photos slide horizontally past like hangers on a rack (x-translation, no crossfade), each pausing dead-center as its lockup snaps; the last garment's tag snaps crimson. Mood: scarce, fast, disciplined.
7. ATELIER LISERÉ — makeup artist, "le geste". Hero: LA MARGE — a 60%-width portrait photo on the right, the artist's name stacked in two display lines flush-left, a thin margin column of micro captions locked to the photo's left edge, crimson on the second line's ampersand. Middle: index (prestations) → paire → cahier. Showpiece: LES QUATRE GESTES — a pinned stage stepping through a four-step routine in HARD CUTS (steps(1), no crossfade): each step's photo replaces the previous instantly while a step numeral lockup snaps beside it; step four lands with the crimson word "tenue". Mood: close-up, procedural, intimate.
8. BUREAU BLANC — design studio, "la revue". Hero: L'INTERTITRE — a manifesto in three stacked display lines with a small photo punched between lines two and three, cropping the ascenders of line three (the image interrupts the sentence); lockup in the right margin. Middle: cahier → coupe → index. Showpiece: LA REVUE — pinned full spreads (photo + text compositions) crossfade like turned pages while a page numeral ticks by snap at each boundary; the final spread's numeral is crimson. Mood: self-assured, curated, editorial.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: THE COLLISION — if type never truly crosses an image (measure it: 8–18% of the photo's width), the page is a generic lookbook and the world is dead; THE SCALE GAP — the hero display must be genuinely enormous and the lockup ratio must hit 12:1, because timid didone is just a wine label; THE CRIMSON DISCIPLINE — one per viewport, snapped on, roman: the instant a second red appears in a viewport the page becomes a template with an accent color. The cheap details that separate this from a generated page: captions locked within 24px (never drifting), hairlines exactly 1px ink, the grayscale grade identical across every image, prices set in the display serif, the z-sandwich in the hero, and the crimson landing as a set() while everything else fades. When in doubt, make the type bigger and move it 40px further over the photograph — timidity is the only real enemy here.`,
	energy: "medium",
	family: "fashion-editorial",
	fusesWith: ["ecrin", "manifeste"],
	id: "silhouette",
	industries: [
		"cosmetics / skincare brand",
		"fashion boutique",
		"streetwear / drops",
		"multi-product shop",
		"cosmetics brand",
		"makeup artist",
		"hair salon",
		"photographer",
		"videographer / production",
		"jewelry brand",
		"design studio",
	],
	kind: "website",
	mood: ["editorial", "sharp", "parisian", "high-contrast", "assured"],
	name: "Silhouette",
	preview: {
		accent: "#B3122E",
		fontFamily: "Bodoni Moda",
		ground: "#FAFAF8",
		ink: "#0D0D0D",
		sampleWord: "La Mode",
	},
	priceFeel: "premium",
	tagline: "Didone géante contre photo noir et blanc — un seul mot rouge.",
};
