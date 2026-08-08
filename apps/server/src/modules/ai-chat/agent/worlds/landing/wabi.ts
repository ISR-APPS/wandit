import type { DesignWorld } from "../types";

/**
 * WABI — the still room.
 * Japandi stillness as luxury: warm greige ground, ONE opaque sumi-e ink
 * stroke as the page's single gesture, vertical writing-mode labels hung on
 * hairlines, content deliberately off-center inside vast asymmetric emptiness
 * (ma). The page breathes once — a two-second scrubbed ink reveal — and then
 * holds. Proof build: Studio Sakina (yoga / pilates, Casablanca) in
 * worlds/wabi/demo/.
 */
export const wabi: DesignWorld = {
	avoidFor: [
		"festival",
		"kids & baby shop",
		"car wash & detailing",
		"fast food",
		"spare parts",
	],
	doc: `# DESIGN WORLD: WABI — the still room

## Philosophy
This page is a STILL ROOM, not a website. A room with greige walls the color of raw linen, one object placed exactly where it should be, and a single brush gesture drying on the wall — everything else is ma: emptiness that is not absence but attention. Its defining structural facts: the whole page carries exactly ONE large sumi-e ink stroke (the gesture — horizontal sweep, falling stroke, ensō, ridge — chosen per client, drawn once, never repeated); small labels hang VERTICALLY on hairlines like scrolls; and no section ever centers its content — every block sits deliberately off-axis with at least a third of its width left as continuous, inhabited emptiness. Stillness is the luxury being sold. The page breathes once — the gesture draws itself in a two-second breath — and then holds still for the rest of the visit. Warm and textured where ECRIN is white and jeweled; silent where MANIFESTE shouts. Failure modes that are structurally impossible here: the crowded feature grid, the symmetric centered hero, the gradient wash, the page that never stops moving. Self-audit before shipping: exactly one brush gesture page-wide (its group holds ≤4 INK paths — ground-colored dry streaks and the taper overlay ride inside the same group); ≤3 indigo moments; zero centered primary content (one short interlude line is the only exception); zero border-radius above 2px, zero box-shadows, zero gradients; at least two vertical writing-mode labels hung on hairlines; the page still composed if printed in two flat inks.

## The variation contract (why two WABI sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Greige ground register, charcoal ink (never black), the ≤3-moment indigo budget, clay as the quiet second neutral.
- ONE gesture per page, opaque ink, brush-roughened edges — never two strokes, never translucent.
- Vertical writing-mode labels on hairlines; off-center ma composition; hairlines as the only borders.
- Radius 0 (2px max on inputs), no shadows anywhere, no gradients anywhere, no photography, no dark sections.
- Motion is one slow breath: a single scrubbed 2-second ink reveal, then stillness.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The exact greiges inside the register and where the ground shifts (at most twice down the page).
- The display face within the register: Zen Old Mincho or Shippori Mincho (one per site).
- THE GESTURE ITSELF — its form (couché, tombé, ensō, diagonal, ridge…), its trajectory, and where on the page it lives.
- The CONCEPT NOUN that names the page — le souffle, le vide, l'aplomb, la lenteur — it chooses the gesture's form, the tokonoma scene, the copy's verbs.
- The three indigo moments (the canonical trio is seal + one accent word + one filled CTA, but the client may spend them elsewhere).
- The seal's mark, the drawn scene subjects, the section order beyond the fixed opening and closing.
A WABI page whose gesture could belong to any brand has failed: the concept noun draws the stroke.

## The vibe (voice)
Short declaratives with room around them. Verbs of breath and placement: respirer, déposer, tenir, laisser. Numbers stated plainly, prices without ceremony. Never an exclamation mark, never a superlative, never "une expérience unique". Example lines (French demo register): "Respirez. Le reste attend." · "Une salle, huit tapis, la lumière du matin." · "Nous commençons à l'heure. Nous finissons dans le calme." One honest domestic line near the contact — the tea served after class, the ten minutes of quiet before — is worth more than any slogan.

## Visual signatures
- THE SUMI-E STROKE (owned tic): one SVG gesture group of 1–4 paths, main stroke 56–90px wide at 1440, charcoal at 0.90–0.95 — OPAQUE ink, never translucent. Edges roughened by an feTurbulence + feDisplacementMap filter (baseFrequency ~0.012 0.05, numOctaves 3, scale 10–16) applied ONLY inside gesture and scene groups, never as page texture. Inside the stroke: 1–3 ground-colored dry-brush streaks 3–8px wide riding its trajectory; at the tail, a 20–32px taper overlay and at most one thin flick. The stroke sits behind or beside the name — never on top of body text.
- VERTICAL LABELS (owned tic): 10–11px, uppercase, +0.25–0.32em tracking, writing-mode: vertical-rl, ink at 55–70%, hung on a 1px hairline (ink at 15%) that runs 80–220px past the text. One to two per viewport, always in a margin the content left empty.
- OFF-CENTER MA (owned tic): a 12-column mental grid; primary content occupies ≤7 columns; ≥4 contiguous columns stay EMPTY per section — the empty side may hold one vertical label or the seal, nothing else. The loaded side alternates down the page. Nothing centers except one optional interlude line.
- Hairlines: 1px, ink at 12–18% — they underline titles, rule table rows, frame the tokonoma and carry labels. They are the page's only borders; caps labels always touch one (a rule below or a line beside — never floating on bare ground).
- THE SEAL: a 26–40px square, 1.5–2.6px stroke or flat fill, indigo or ink, holding an abstract two-stroke mark or the client's initial — never decorative kanji. Beside the hero name it hangs slightly above the baseline (translateY ≈ −0.5em), like a stamp pressed after the signature.
- WASHI GROUND: laid-line paper texture — repeating-linear-gradient, 1px ink lines at 2–3% opacity every 3–4px, one direction only. Never turbulence grain (that is plaster, MATIÈRE's).
- Radius 0 everywhere (inputs may reach 2px); zero box-shadows page-wide; corners are corners.

## Color physics
- GROUND: the greige register — #EAE4D8 / #E5DFD1 / #E8E1D3. A page keeps ONE dominant ground and may shift to a sibling tone at most twice down the page (the room's light changing) — never a strict A/B alternation rhythm, and never an inverted dark section: WABI never goes dark.
- INK: #2E2A24, never #000. The gesture at 0.90–0.95; running text at 0.78–0.88; titles at 0.92; hairlines at 0.12–0.18.
- INDIGO #4A5578: at most THREE moments per page. Canonical trio: the seal, one accent word inside a display quote, one filled CTA. Interaction states (focus ring, ::selection, hover underline) are also indigo and do not count against the budget. An indigo surface may never be wider than a button.
- CLAY #A8968A: captions, meta lines, the moon/stone shape inside drawn scenes, secondary hairline accents. Never terracotta-saturated (that warmth is MATIÈRE's register), never a fill wider than ~240px.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · INDIGO→--primary · GROUND→--primary-foreground · sibling greige→--secondary · CLAY→--accent · ink at 60%→--muted · ink at 15%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every greige sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Gradients: none, anywhere, ever. Light inside drawn scenes is a flat clay or pale-greige shape (#CDBFAF register), not a glow.

## Typography system
- DISPLAY: Zen Old Mincho OR Shippori Mincho, weights 400–500 ONLY. Never 600+, never italic, never uppercase. Tracking +0.02–0.08em. Display appears above ~1.6rem only.
- BODY: Zen Kaku Gothic New OR Albert Sans, weights 300/400 (500 for rare emphasis). 15–16.5px, line-height 1.9–2.1, measure 30–40ch — running text never spans wide; the measure IS the ma.
- Hero name: clamp(3.2rem, 9.5vw, 8rem), line-height 0.95–1.05, weight 400.
- Section titles: clamp(1.8rem, 3.4vw, 3rem), ≤6 words. Quotes: clamp(1.6rem, 3vw, 2.6rem), line-height 1.5.
- Numerals (prices, hours, counts) set in the display face 400 with clay affixes ("MAD", "min", "h") in the body face at 11–12px.
- Uppercase exists ONLY in vertical labels and tiny hairline-touching captions (10–11px, +0.25em). Never in titles, buttons or navigation.
- Arabic pairing (Maghreb clients): display Amiri 400 (or Noto Naskh Arabic 500), body IBM Plex Sans Arabic 300/400, tracking 0 for Arabic. writing-mode vertical is Latin-only — in Arabic the label lies horizontal in the mirrored margin on the same hairline.

## Signature art / components
- DRAWN SCENES: sumi-e miniatures — 5–12 brush paths maximum, the same displacement filter as the gesture, subjects from the still-room shelf: a branch, a reed, a mountain line, a water line, a seated figure, a teapot, one stone. ONE flat clay shape allowed per scene (moon, sun, stone). Scenes live in the TOKONOMA: a tall hairline-framed niche, aspect between 3/4 and 3/5, never full-bleed. Each carries role="img" and a real aria-label in the page's language. Never botanical plate captions, never Latin (HERBIER's), never more than one scene per two sections.
- BUTTONS: body face 400, 13–15px, sentence case, inside a 1px ink hairline box, padding 0.9em 2.2em, radius min(var(--radius), 0px) — radius 0, the still room's corners stay corners. Hover/focus fills ink with ground text over 0.4s. ONE button per page may be indigo-filled — it costs an indigo moment.
- LINKS: bare at rest; a 1px underline draws left→right in 0.35s on hover AND :focus-visible.
- FORMS: underline fields, no boxes — 1px ink/30% bottom border, focus thickens to 2px indigo; labels 11px tracked caps sitting on the field's hairline; phone-first (tel before message); selects styled identically. Success state: a small ink check stroke (same brush filter) draws itself in ~1.2s beside honest words with a real promise ("Nous vous rappelons avant demain soir."). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail; keep one off-canvas decoy input data-wandit-hp that the page's own script never reads or writes.
- TABLES (horaires, tarifs): hairline-ruled rows only, 1.4–1.8em vertical padding, labels in tracked caps, values in the display face. No zebra stripes, no cells with fills.
- Favicon: inline SVG data URI — greige square, one charcoal brush stroke, one small indigo seal square.

## Page chassis
- Container 1280px max; side padding clamp(1.25rem, 4vw, 4.5rem); section vertical padding in the clamp(5.5rem, 13vh, 9.5rem) register. Emptiness is the budget: when a section feels thin, add space, not content.
- HEADER: no bar, no blur, no background — wordmark (display 400, 1.3–1.5rem) left; 3–4 real anchor links + telephone right, 13px body face. It sits on the ground and scrolls away.
- FIXED OPENING — the hero IS the showpiece: a pinned viewport (140–180% scroll) where THE GESTURE draws itself once, scrubbed. At rest the stroke's ATTACK (its first 25–30%) is already inked, starting inboard of the viewport edge and aimed at the name — the brush has touched the paper before the visitor moves; the first viewport never shows a blank wall. The name in display 400 placed off-center (never centered), one vertical label in the empty margin, the seal near the name, one line of sub-copy, one hairline CTA — all present at rest via the arrival breath. After the pin releases, the page never pins again.
- FIXED CLOSING: contact section — underline-field form beside honest practical facts (address, phone, hours, the tea line) — then a footer: wordmark at clamp(2.2rem, 5vw, 4rem) beside the seal, one hairline, one line of small print. No sitemap walls, no social grids.
- FREE MIDDLE (compose 3–5 from the vocabulary, never two adjacent alike): le couloir (off-axis manifesto block) · les tatamis (2:1 panel grid on hairline joints) · le tokonoma (niche scene + display quote) · l'engawa (a hairline-ruled table band: schedule, menu, hours) · le jardin sec (a sparse row of drawn stones marking steps or offers) · le silence (a near-empty interlude: one line, 50–70vh of ground).

## Motion identity — one slow breath
Registry law: WABI's motion personality is a SINGLE 2-second ink reveal, then stillness. Gate every tween on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Dual-visibility law: hidden states exist ONLY via gsap.set — CSS never hides anything; with JS dead the page is complete, gesture fully drawn.
- Easings: sine.out, sine.inOut and power1.out ONLY. No overshoot, no elastic, no steps, no snap.
- Entrances: opacity 0→1 with y 8–14px maximum, 1.2–1.6s, staggers 0.15–0.25s, at most 4–5 staggered elements per section, triggered once at start "top 82–88%". The hero copy (kicker, name, sub, CTA) arrives together in one arrival breath on load (~1.5s, stagger 0.2s). Deep sections may skip entrances entirely — stillness is allowed.
- THE SHOWPIECE ("le trait"): the hero pins with scrub: 1; the gesture draws via stroke-dashoffset from its pre-inked 25–30% attack — main stroke over the first ~70% of the timeline (dry streaks riding in sync), taper at ~64%, flick at ~82%; the scroll hint fades in the first 10%. Dash craft: set stroke-dasharray to pathLength+12 and hidden offset to pathLength+15 — with real margins on both ends the displacement filter can never leak a start or end tip. Under 768px: no pin, and a mobile-composed gesture SVG replaces the desktop one — it draws ONCE on load over 2–2.4s (sine.inOut) and never again.
- Hovers: 0.3–0.5s fills and underline draws; nothing changes position on hover; keyboard/touch parity mandatory.
- Nothing loops. Nothing parallaxes. The stroke never redraws, never reverses past zero on scroll-up jitter (scrub absorbs it).
- Reduced motion: no pin, no tweens, gesture pre-drawn — the composed still page IS the design, not a degraded one.

## Ban list (in addition to the global ban list)
1. The plumb line, floating letter-spaced micro-caps on bare ground, roman-numeral section markers — that is ECRIN's language; WABI's labels are vertical, hairline-hung, its emptiness asymmetric and warm.
2. Arch geometry, arch pills, feTurbulence full-page plaster grain, the terracotta register, the material cabinet — that is MATIÈRE's language.
3. Botanical specimen plates, Latin captions, pressed-leaf silhouettes, tied specimen tags — that is HERBIER's language.
4. Translucent watercolor washes, pigment-bloom image masks, script faces — that is AQUARELLE's language; WABI ink is opaque or absent.
5. Viewport-scale words-as-layout and black/white section inversion — that is MANIFESTE's language; WABI never shouts and never goes dark.
6. A second brush gesture anywhere on the page — two strokes is a failed audit, not a variation.
7. Centered or symmetric hero and section compositions (one short centered interlude line is the only exception).
8. Decorative kanji or katakana, red-circle flag motifs, bamboo/cherry-blossom clipart, gongs, "zen" stock iconography — faux-japonisme is the cheapest failure.
9. Any dark, inverted or black section; any ground outside the greige register.
10. Border-radius above 2px, any box-shadow, any gradient, any backdrop-blur.
11. Photography or photoreal rendering.
12. back/elastic/bounce easings, parallax layers, floating idle loops.
13. A red or crimson seal — crimson is SILHOUETTE's accent; WABI's seal is indigo or ink.
14. A fourth indigo moment, or indigo fills wider than a button.
15. Pattern fills, glazed tile grids (ZELLIJ's), confetti, marquees.

## LES GESTES (moves menu)
- LE TRAIT COUCHÉ — the horizontal gesture: one sweep crossing the pinned hero at 35–55% height, tail settling in the emptiness beside the name. The default and calmest form.
- LE TRAIT TOMBÉ — the falling gesture: a vertical stroke pouring down one edge of the hero, the name set beside it (or vertical along it); the stroke's foot lands where the first section begins.
- L'ENSŌ — the brush circle, drawn 80–92% closed (never sealed), off-center; the name or one word sits at its opening. The gesture spends its whole budget here: no other stroke.
- LE TOKONOMA — the alcove: one tall hairline-framed niche holding a 5–12-stroke ink scene, a display quote beside it with the page's accent word. The room's single ornament.
- LES TATAMIS — the mat grid: 2–5 content panels in 2:1 tatami proportions on 1px hairline joints (a 2fr/1fr row above a 1fr/2fr row), unequal on purpose; panels hold numbered offers or practices.
- L'ENGAWA — the veranda band: a full-width hairline-ruled table (schedule, menu, hours) with tracked-caps labels left and display-face values right; the page's most structured moment.
- LE JARDIN SEC — the dry garden: 3–5 drawn stones (flat clay shapes with one ink brush shadow-stroke each) spaced UNevenly along one hairline, each naming a step or principle. Never evenly distributed.
- LA MARGE HABITÉE — the inhabited margin: the section's empty third holds exactly one vertical label on its hairline, or the seal — proof the emptiness is intentional.
- LE SILENCE — the near-empty interlude: 50–70vh of ground carrying one short display line, off-axis or (the single permitted exception) centered. Place it between the two densest sections.
- LE SCEAU — the seal move: the 26–34px square mark closes the hero name, stamps the form's success state, and signs the footer — same mark, three appearances, one indigo moment if colored.
- LA PESÉE — the weighing: two unequal columns (5/7 or 4/8) where the small column carries the title and the wide one a single paragraph plus one fact row — never two paragraphs of equal weight.
- LE THÉ — the domestic close: one honest hospitality line set small near the contact form ("le thé est prêt" register), body 300, clay ink. Costs nothing, sells the room.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- SOUFFLE — yoga studio. Hero: the name in the lower-left quarter, kicker caps above it on a hairline, the TRAIT COUCHÉ sweeping from upper-left and settling its taper in the vast right emptiness where one vertical label hangs. Showpiece: the horizontal stroke draws across the pinned hero from its pre-inked attack, the taper flicking out beside the label. Middle: pesée manifesto → tatami practices → tokonoma quote. Mood: 7 a.m., the mat still cool.
- ENSŌ — therapy practice. Hero: an 88%-closed ensō right-of-center, the practice's name small at its opening, left half of the viewport empty except the seal. Showpiece: mid-page, a pinned interlude where the ensō re-inks around a one-line promise — the hero circle is static, already dry; the breath happens at the page's heart. Mood: the door closed, the hour protected.
- CASCADE — spa / hammam. Hero: the TRAIT TOMBÉ pouring down the left edge, the name set VERTICALLY (writing-mode) beside the stroke, horizontal sub-copy low-right. Showpiece: the vertical stroke pours downward through the pinned hero, its foot landing exactly on the first section's title hairline. Mood: warm water heard through a wall.
- KINTSUGI — architect firm. Hero: the name split in two masses, upper-left and lower-right, a diagonal channel of pure ground between them; no stroke visible yet. Showpiece: at the pinned projects interlude, one thin diagonal stroke crosses the channel and joins the halves of the studio's claim — the repair is the gesture, and it carries the indigo accent word. Mood: what was broken, held better.
- THÉIÈRE — tea house. Hero: a tall tokonoma niche on the right holding a drawn teapot with one flat clay steam-stone, the name tiny at the upper-left, the center left empty. Showpiece: a single steam stroke rises inside the pinned niche while the menu's first hairline rows settle beneath — the gesture lives in the alcove, not across the viewport. Mood: the first pour.
- TATAMI — pilates studio. Hero: the viewport itself divided into four tatami panels by hairline joints; the name occupies one panel, one panel holds a vertical label, two stay empty. Showpiece: further down, the gesture appears as a single tapering baseline stroke sweeping beneath the pinned schedule band, underlining the week in one breath. Mood: alignment, counted quietly.
- JARDIN — nutrition / retreat. Hero: the name low center-left with sub-copy hanging under its final letter; a drawn branch enters from the top-right corner, already dry. Showpiece: the pinned JARDIN SEC — a wide dry-brush stroke rakes horizontally behind three clay stones as each stone's principle fades in; the rake is the page's one gesture. Mood: a week with less, felt as more.
- MONTAGNE — fine dining. Hero: the name in the upper-right quarter above a low two-path mountain ridge spanning the lower third, a clay moon flat in the sky's emptiness. Showpiece: the ridge draws at the pinned tasting-menu opening — two strokes of the same gesture group — while the moon translates 40px upward, the page's only moving object. Mood: nine services, no noise.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: THE GESTURE (stroke craft above all — a timid, vector-clean or translucent stroke kills the page; the displacement roughening, dry streaks and taper are not decoration, they are the entire imagery budget), THE MA (measured emptiness — the ≥4-empty-columns law is the difference between a still room and an under-designed template; if every section fills its width, the world has collapsed), and THE STILLNESS (one breath, then hold — a page that keeps animating past its 2-second reveal is not WABI, it is a screensaver). The cheap details that separate it from a generated page: vertical labels actually hung on their hairlines, the seal recurring in exactly three places, clay affixes on display numerals, the tea line near the form, hairlines at 15% never 40%. When in doubt, remove the element and keep its space — in this world, deletion is a design move.`,
	energy: "quiet",
	family: "japandi",
	// herbier: the garden meets the still room — retreat brands.
	fusesWith: ["herbier"],
	id: "wabi",
	industries: [
		"yoga / pilates studio",
		"psychology / therapy",
		"physiotherapy / kiné",
		"spa / hammam",
		"skincare / esthetician",
		"interior design / home staging",
		"architect (firm)",
		"single property showcase",
		"home & decor shop",
		"tea house",
		"fine dining",
		"personal trainer / coach",
		"nutritionist",
		"martial arts / combat sports",
	],
	kind: "website",
	mood: ["still", "warm", "spare", "deliberate"],
	name: "Wabi",
	preview: {
		accent: "#4A5578",
		fontFamily: "Zen Old Mincho",
		ground: "#EAE4D8",
		ink: "#2E2A24",
		sampleWord: "Ma",
	},
	priceFeel: "premium",
	tagline: "La pièce silencieuse : un seul trait d'encre, le vide qui respire.",
};
