import type { DesignWorld } from "../types";

/**
 * AQUARELLE — the watercolor atelier.
 * Paper-white cotton sheet, translucent turbulence-edged washes breathing
 * behind the content, imagery inside pigment blooms (never rectangles),
 * a brush-stroke underpainting that paints itself beneath titles.
 * Tender, romantic, artisanal — carnet's sibling in the hand-craft
 * family with the opposite material: carnet is pen and paper, aquarelle
 * is pigment and water. Fuses with velin (watercolor florals enter the
 * revue — weddings/beauty) and carnet (pigment meets pen — one atelier,
 * two hands).
 */
export const aquarelle: DesignWorld = {
	avoidFor: [
		"garage / mechanic",
		"dev tool",
		"crossfit / functional",
		"security company",
		"spare parts",
	],
	doc: `# DESIGN WORLD: AQUARELLE — the watercolor atelier

## Philosophy
This page is A SHEET OF COTTON PAPER STILL DAMP FROM THE BRUSH, not a website. Color arrives as water: translucent washes with turbulence-bled edges breathe behind the content, imagery lives inside pigment blooms instead of rectangles, and a brush-stroke underpainting settles beneath the titles like the first pass of a painting. Its first structural fact: TRANSLUCENCY IS LAW — every colored area sits between 25% and 45% opacity, and depth is made by LAYERING washes, never by darkening a fill. Its second: NOTHING COLORED HAS A STRAIGHT EDGE — every wash, bloom and stroke carries an irregular displaced contour; the only rectangles are the sheet itself and the text blocks. Its third: LIGHT IS THE PAPER — highlights are réserves (paper left blank inside shapes), never white paint; the ground shines through everything. The page grows quietly more saturated as it scrolls and holds its deepest pooled moment at the closing CTA. CARNET's sibling in the hand-craft family, opposite material: carnet is pen and paper, aquarelle is pigment and water. Impossible failure modes: an opaque color block; a dark or inverted section; a photo in a rectangle; anything loud, bouncy or urgent. Self-audit before shipping: (1) zero colored areas above 45% opacity larger than a button; (2) zero rectangular edges on imagery or washes — count the blobs, every one displaced; (3) at most ONE script word per viewport, zero script in body, nav or prices; (4) at least three layered drawn scenes with réserve highlights; (5) the final viewport is the page's most saturated — check the closing stack on screenshots; (6) at least 35% of every viewport is bare paper.

## The variation contract (why two AQUARELLE sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- The paper ground register, the slate-violet ink, and the translucency law (area washes 25–45%, never opaque).
- Turbulence-bled edges on all color; pigment-bloom masks on all imagery; the brush-stroke underpainting beneath key titles.
- The type trio register: one calm serif display, one RATIONED script (one word per viewport, max), one light humanist body (faces below).
- Washes-blooming motion: sine easings only, entrances from scale 0.96, nothing faster than 0.45s, no overshoot ever.
- The saturation ramp: the page opens near 25% and closes near 45%; the deepest pooled wash lives behind the final CTA and footer.
- No dark sections, no photography, no cards with shadows. The page is always paper-lit.
CLIENT-OWNED — where siblings diverge, decided per brief:
- THE TWO LEAD WASHES — a pair chosen from the register (powder blue #7FA8C9 · rose #D98CA6 · violet #9B8CC9 · sage #9BB89B); the remaining hues appear at most twice each as minor notes, or not at all; the pair sets the page's temperature.
- The CONCEPT NOUN that drives the page — le muguet, la brume, l'onde, la glycine — it names the hero scene, the showpiece and the copy's central image. An AQUARELLE page with no concept noun is a pastel template: name it FIRST.
- The display face within the register, the exact hex tuning inside each hue's register, which headline word gets dipped in script, the scenes painted, and the section order beyond the fixed opening and closing.

## The vibe (voice)
Tender, precise French — the voice of someone who works slowly by hand and means every word. Short sentences that breathe: "On peint votre journée la plus douce." / "Chaque bouquet est composé le matin même — fleurs de saison, jamais autre chose." / "Dites-nous la date; l'atelier prépare la palette." Prices are honest and carry their condition in the same breath ("à partir de 5 800 $ · huit mois d'accompagnement"). Water-and-pigment vocabulary is exact — lavis, réserve, auréole, nuancier — never "des couleurs magnifiques". No urgency, no superlatives, no exclamation marks anywhere.

## Visual signatures
- WATERCOLOR WASH GROUNDS (owned tic): translucent SVG blobs behind content — an ellipse or irregular path passed through feTurbulence (fractalNoise, baseFrequency 0.012–0.02, numOctaves 3) + feDisplacementMap (scale 70–130 for washes and scenes; 55–65 for small vignettes; detail linework rides its own gentle scale 10–16 filter so strokes stay legible). Fill: a lead hue, primary layer .25–.45, companion layers down to .14 (more water, never more pigment). One to three washes per section, layered in same-hue pairs offset 8–20% so their overlap pools a deeper tone. Washes may bleed past the container to the viewport edge (the hosting section clips its own overflow; never let a section boundary guillotine a wash mid-page — bleed horizontally or end it inside); text never sits on a pool denser than .35.
- L'AURÉOLE (the dried edge): major washes and scene shapes carry one 1.5–2px contour stroke of THEIR OWN hue at 50–60% opacity — pigment gathering at the rim as the water dries. Never a foreign color, never ink, never on small marks.
- PIGMENT-BLOOM IMAGE MASKS (owned tic): every scene and vignette sits inside an irregular 7–9-anchor blob clip passed through the same displacement register — never a rectangle, never a perfect circle. Behind the clip, a paler field of the scene's lead hue at .14–.25 extends 4–10% beyond it.
- BRUSH-STROKE UNDERPAINTING (owned tic): beneath ONE key word (or short phrase) of a major title, a rough-edged brush band — height .55–.75em, width 102–112% of the word, lead hue at .30–.45, with 1–2 dry-brush gaps — that paints itself in left-to-right over 1.1–1.5s as the title enters. One per section maximum.
- L'ÉTIQUETTE TREMPÉE: labels are the body face at 500, 11–12px, uppercase, +.14–.18em tracking, sitting on a small wash dab at .26–.32 — never floating on bare ground (ÉCRIN's), never boxed in a pill. EVERY micro-caps label takes the dab — form labels and contact chits included.
- NUMERAL WASH: large section/step numerals set in the display face, filled with a lead hue at .28–.32, no outline, 4–7rem — pigment poured into the glyph, never a ghost stroke (CINÉTIQUE's).
- LE FILET D'EAU: a 1.5–2px meander line in a lead hue at .40–.50 with a gentle 8–28px waver, threading THROUGH the numerals of a sequence (never through its titles) — flowing water, never dotted (ATLAS's route), never a growing plant path (HERBIER's).
- The paper is FLAT #FBF9F4 — no page-wide grain filter (plaster grain is MATIÈRE's), no paper-texture scan. All texture comes from wash edges and blooms.

## Color physics
- GROUND: the paper register #FBF9F4/#F8F4EC — one hue per site, held page-wide. Section rhythm comes from WASHES, not ground flips; a section may sit on a full-width wash field at ≤.30, never on a solid tinted ground.
- INK: slate-violet, the #3F3A45–#48414F register, never black. All type; interior scene strokes use it at 55–70%.
- THE WASH REGISTER: powder blue #7FA8C9 · rose #D98CA6 · violet #9B8CC9 · sage #9BB89B. TWO leads per site (client-owned pair); the other two hues are minor notes, twice each maximum — EXCEPT inside painted scenes, where foliage and botanical detail may draw on the register freely at scene opacities (scene pigment is not a wash).

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · first LEAD→--primary · GROUND→--primary-foreground · first LEAD at wash strength→--secondary · second LEAD→--accent · ink at 60%→--muted · ink at 16%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, wash or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- WASH LAW (absolute): a wash's primary layer lives at .25–.45 opacity; companion layers may thin to .14; nothing colored ever exceeds .45 over an area larger than a button. Depth = layering: two overlapping .30 washes read as a deeper pool — that is the ONLY way the page darkens.
- PIGMENT CONCENTRÉ (the loaded brush): each lead hue has a concentrated form (the #4A7BA6 · #B65F7E · #71619E · #6E8F6E registers) allowed ONLY on marks — link strokes, auréoles, focus rings, small glyphs, the dipped script word — never an area fill, never a text block, nothing taller than 64px. The primary CTA dab alone DOUBLE-LOADS to the deep register (#35608C · #9E4E68 · #5C4E85 · #55704F) at .90–.95 for button-text contrast — the one place the page approaches full pigment.
- GRADIENTS exist only INSIDE a wash as same-hue radial pooling (center .45 → edge .18). Never linear section gradients, never two-hue gradients, never a gradient on type.
- THE SATURATION RAMP: opening-viewport washes ≈ .24–.30; showpiece and gallery washes ≈ .28–.38; ambient washes beside text zones may stay a step lighter (.18–.26) so copy keeps air; the closing section stacks the page's deepest pooled overlap (.34 + .38 layers reading ≈ .45). Compose it by hand; verify it on the final screenshots.

## Typography system
- DISPLAY: a calm, high-grace serif — Prata / Cormorant Garamond (500–600) / Lora (500) register, ONE per site, always upright: NEVER italic (the script carries all the lean; the italic accent word is VELIN's). Hero statement clamp(2.9rem, 6.5vw, 5.6rem), line-height 1.06–1.14; section titles clamp(2rem, 3.8vw, 3.4rem), line-height 1.1–1.18.
- SCRIPT: Parisienne / Great Vibes register, ONE per site. THE RATION: one word per viewport maximum, 1.3rem minimum, sized 1.1–1.35× its neighboring display type, tinted in a lead hue's concentrated form or ink. Never in body, nav, buttons, prices or forms. The dipped word usually receives the underpainting or a wash dab.
- BODY: Assistant 300–500 (Mulish 300–500 as the register's alternate) — 1–1.1rem, line-height 1.6–1.75, measure ≤60ch, flush left, ragged right. 500 for strong, never 700.
- LABELS: the étiquette trempée spec above. Prices: body face 500 with the condition attached in 300 ("1 900 $ · prise en main un mois avant").
- Running-copy numerals stay in the body face; section and step numerals take the display face as numeral wash.
- ARABIC PAIRING: display → Amiri (400–500); body → Cairo (300–500); the script role RETIRES (ration = zero) — the dipped word becomes an Amiri word on a wash dab. Washes, blooms and motion unchanged; compositions mirror with the text direction.

## Signature art / components
- THE PAINTED SCENES (imagery system): all imagery is drawn watercolor — layered translucent SVG, back-to-front: silhouette washes at .30–.35 → mid shapes at .30–.40 (overlaps pooling naturally) → detail strokes in ink at 55–70%, 1.5–2.25px → ONE auréole on the major shape. Highlights are RÉSERVES: paper left blank inside shapes — never white fills over color. Subjects stay loose (a bouquet is five petal masses and three stems, not forty petals); the water finishes. Every meaningful scene carries role="img" and a real aria-label in the page's language; decorative washes are aria-hidden.
- BUTTONS: primary = LE COUP DE PINCEAU — paper-colored text (body face 500) on a single-layer brush-dab SVG (data URI) in the double-loaded deep register at .90–.95 with irregular edges (the dab IS the shape; buttons and fields use min(var(--radius), 0px) — the water draws the edge, never a rounded corner; NEVER a pale echo layer behind it — it reads as a sticker shadow); hover/focus-visible deepens ~8% (filter brightness .88 register) and scales to 1.02 over 0.3s; active settles to 0.98. Secondary = a text link on a 2px watery underline at 55% that blooms LA GOUTTE behind it on hover (spec in gestes).
- FORMS — L'INVITATION: fields are bare paper over a 2px slightly-wavering painted bottom stroke (lead hue at .55); labels are étiquettes trempées; focus thickens the stroke to 3px and raises a wash dab at .18 behind the field over 0.3s; phone-first (input type="tel" before anything else, local placeholder), a select for the structured choice (lieu, type d'événement). Invalid states say it plainly in ink ("Il nous faut un numéro pour vous rappeler."). Success replaces the form with a painted check blooming in and REAL next-step words ("C'est noté. On vous rappelle sous 48 h — le temps de préparer la palette."). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, date, … }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads, fills or references.
- ::selection: concentrated lead hue ground, paper text. :focus-visible: 2px concentrated-lead outline, offset 3px. One h1; semantic landmarks; keyboard/touch parity on every hover.
- FAVICON: inline SVG data URI — two overlapping translucent blobs in the two lead hues on the paper ground.

## Page chassis
- Vertical rhythm: section padding clamp(5rem, 12vh, 8.5rem) (mobile floor 4rem under 600px — dead zones kill the tenderness); containers 1200–1320px; washes may bleed to the viewport edge, text never leaves the container. html/body carry overflow-x: clip, and every section hosting a bleeding wash clips its own overflow — fix causes, not symptoms.
- HEADER: bare paper, no bar, no blur — display wordmark with a small wash dab behind its initial, body-face nav (real anchors), ONE primary dab CTA. If sticky, it gains a 1px lead-hue rule at 30% once scrolled.
- FIXED OPENING — the hero must contain: (a) the display statement with ONE dipped script word and an underpainting that paints in; (b) at least one pigment-bloom scene OR a full-width layered wash field; (c) two or three honest fact chits as étiquettes trempées (depuis, count, promise register); (d) washes at the OPENING opacity (.24–.30) — the page must visibly have somewhere deeper to go.
- FIXED CLOSING — L'INVITATION (the form, spec above) beside honest contact chits (tel, address, hours), then the monument footer: the wordmark huge in the display face over the page's DEEPEST pooled wash, one script flourish beneath it (the site's last script word), typed links with real hrefs, one modest legal line.
- FREE MIDDLE (compose 3–5 from this vocabulary, never two adjacent sections with the same layout): LES RANGS NUMÉROTÉS offset service rows · LE LAVIS showpiece scrub (one per page) · LES FLORAISONS uneven bloom gallery · LE NUANCIER palette bands · LA DÉMARCHE AU FILET steps on the water line · LA RÉSERVE quiet break.

## Motion identity — L'ÉCLOSION (washes blooming; GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: color BLOOMS — it spreads from almost-there to present, the way a wet brush touches paper. Every hidden state is set via gsap.set, never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). JS dead → the painting is finished: every wash at rest opacity, every scene composed, the showpiece at its most saturated frame.
- EASING IDENTITY: sine.out for entrances, sine.inOut for anything that moves both ways. NOTHING else: no power3 drama, no overshoot (back/elastic is GUIMAUVE's), no steps (FANZINE's and PHOSPHORE's), nothing faster than 0.45s except focus rings.
- ENTRANCES: autoAlpha 0→1 + scale 0.96→1 (transform-origin at the wash's pool side), 0.9–1.5s, staggers 120–180ms in reading order. Washes enter before their content: ground first, figure second, 0.15–0.25s apart.
- THE UNDERPAINTING paints in scaleX 0→1 (origin left; right in RTL) over 1.1–1.5s, starting ~0.2s before its title's text settles.
- AMBIENT BREATH: at most TWO washes per viewport may loop scale 1→1.035, 6–9s, sine.inOut, yoyo — the page breathing, barely.
- SHOWPIECE TYPE — LE LAVIS: ONE pinned scene per page (scrub 0.6–0.9, end +=1800–2400px): a large paper canvas saturates beat by beat — each beat blooms a wash deeper than the last and paints one scene moment in; the final beat pools the overlaps to the page's saturation peak behind the closing line and its CTA. THE FIRST BEAT IS NEVER HIDDEN — it stands painted when the pin begins (no empty canvas viewport) — and the CLOSING LINE + CTA REST AT FULL INK through the whole pin: the scrub drives ONLY their pooled wash and a ≤16px y-settle, never their opacity, so no scroll stop inside the pin shows a half-empty canvas. Mobile <768px: no pin — the beats stack and bloom on view, pre-composed.
- HOVER: blooms deepen ~8% opacity and lift ≤2px, 0.25–0.35s; LA GOUTTE behind text links; :focus-visible mirrors every hover; @media (hover:hover) discipline; touch gets :active parity.
- REDUCED MOTION: the finished painting — all washes at rest, showpiece at its final saturated frame, underpaintings present. A composed still, never a blank.

## Aquarelle ban list (in addition to the global one)
- Spiral/stitched binding edges, handwritten ballpoint annotations, pinned polaroids and sticky notes — that is CARNET's language; aquarelle's hand holds a brush, never a pen.
- Botanical LINE plates with Latin captions, pressed-leaf silhouettes, string-tied specimen tags — that is HERBIER's language, even for a florist: aquarelle paints floral MASS in translucent color, it never pen-draws a specimen.
- Boxed drop caps, double-filet rules, the italic accent word in the accent color — that is VELIN's language.
- Puffy inner-shadow blob containers, candy stripes, back.out bounces — that is GUIMAUVE's; their blobs are inflated plastic, aquarelle's blooms are flat water.
- The opaque sumi-e ink stroke, vertical writing-mode labels, off-axis ma emptiness — that is WABI's; aquarelle's marks are translucent COLOR, and its emptiness is simply paper around a flush-left block.
- Arch-only geometry, 4% plaster grain, the material-swatch cabinet that retints the page — that is MATIÈRE's.
- Floating letter-spaced micro-caps on bare ground — that is ÉCRIN's; aquarelle's labels sit on a wash dab.
- Soft-shadow floating cards — that is CLAIR's; nothing floats here: paper lies flat and drop shadows do not exist.
- Opaque color blocks or panels of ANY size beyond the loaded-brush marks; an area wash above 45% is a broken page.
- Dark or inverted sections, night moods, white type on solid color — the page is always paper-lit.
- Photography, photoreal renders, scanned paper textures, stock watercolor PNGs — every mark is drawn in code.
- Rectangles as image frames, hard-edged section dividers, straight-edged color bands.
- Gold foil, glitter, cream-and-gold luxury coding — this is water, not gilt.
- Drop shadows on type; outline strokes in foreign colors (only same-hue auréoles exist).
- More than one script word per viewport; script in any interactive element.

## LES GESTES (moves menu)
- LE MOT TREMPÉ — the hero's one script word, dipped: tinted in concentrated lead pigment and sitting on the underpainting band; the ration law made visible in the first second.
- LA SOUS-COUCHE — the brush underpainting painting itself in beneath a title's key word, left to right, arriving a beat before the title settles; one per section, never two.
- L'ÉCLOSION FENDUE — hero family: statement and chits on bare paper at left, one large bloom-masked scene at right, two washes breathing behind at different depths.
- LA DOUBLE TREMPE — hero family: a full-width field of the two lead washes overlapping to a pooled third tone, the statement set just off the pool's center, no scene at all.
- LES RANGS NUMÉROTÉS — offers as offset rows: numeral wash on alternating sides, title + honest price + two lines of copy, a small bloom vignette on the far side; never a card grid.
- LES FLORAISONS — the gallery: 3–5 bloom-masked scenes at deliberately different sizes on an uneven grid, display-face names with étiquette captions; one bloom may bleed past the container.
- LE LAVIS — the showpiece: the pinned canvas that saturates beat by beat (mechanism in Motion identity); the scene's content is client-owned, the mechanism is law.
- LE NUANCIER — palettes as painted bands: rows of 3–5 irregular pans at .28–.38 with names and season notes; hovering the row (or focusing its link) deepens the pans ~8%.
- LA DÉMARCHE AU FILET — the process: 3–5 steps hung along a filet d'eau that draws itself across the section, numeral washes marking each stop.
- LA RÉSERVE — the breath: one nearly-bare passage — a single display line, one small wash dab, vast paper — placed between two saturated moments; sparse but flush-left (off-axis emptiness is WABI's).
- LA GOUTTE — micro-interaction: hovering or focusing a text link blooms a small wash drop behind it (scale 0.6→1, to .30 opacity, 0.3s sine.out).
- LA SIGNATURE DE L'ATELIER — the closing: the wordmark monument over the deepest pooled wash, the script flourish blooming in once beneath it.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- STUDIO MUGUET (wedding services, Montréal) — concept noun le muguet; leads powder blue + rose. Hero L'ÉCLOSION FENDUE: statement left with "douce" dipped in script over its underpainting, a bloom-masked bouquet right, two washes breathing. Middle: rangs numérotés → lavis → floraisons → démarche au filet → nuancier. Showpiece LE LAVIS DU JOUR J: the wedding day in three beats — 15 h la cérémonie (blue), 18 h le cocktail (rose), 22 h le bal (the pooled violet) — the CTA surfacing in the final pool. Tender, June-morning mood.
- MAISON GRENADE (patisserie / bakery, Lyon) — noun la grenade; leads rose + violet. Hero LA DOUBLE TREMPE: a full-width rose-violet pooled field, statement just off the pool's center, no scene. Showpiece LE GLAÇAGE: a pinned entremet paints itself LAYER BY LAYER upward on scrub — génoise wash, crème, the glaze pooling last over the top with the page's deepest auréole. Floraisons of vitrine scenes; nuancier of seasonal flavors. Gourmand, patient.
- LÉONIE (photographer (events), Bruxelles) — noun la lumière; leads sage + powder blue. Hero LE POLYPTYQUE: three tall bloom panels side by side (les préparatifs, les vœux, le bal) with the statement running across their tops. Showpiece L'ALBUM QUI SÈCHE: scenes begin as grey-blue ghost washes and saturate ONE BY ONE, left to right, like prints rising in a bath; the last stays deepest. A réserve break, then la démarche au filet. Silvered, luminous.
- THÉ & BRUME (tea house, Annecy) — noun la brume; leads sage + violet. Hero LA RÉSERVE D'ABORD: an almost-bare sheet — a small statement low on the left, a single steam wash curling up from a painted cup at bottom right — the register's quietest opening. Showpiece L'INFUSION: a pinned glass teapot; on scrub the wash diffuses DOWNWARD through the water, tinting from the top, leaves unfurling as pooled edges. The menu as a nuancier of infusions. Hushed, morning-fog.
- CABINET L'ONDE (psychology / therapy, Genève) — noun l'onde; leads sage + powder blue. Hero LE MOT SEUL: a short centered statement with the dipped word, NO scene anywhere in the viewport — one large wash breathing in the top-right corner, chits beneath the statement. Showpiece LES CERNES: four concentric drying rings spread outward around the four practice areas, one ring per beat, the center staying palest — depth without darkness. A réserve between every two saturated sections; the calmest sibling.
- ATELIER PIVOINE (cosmetics brand, Casablanca) — noun la pivoine; leads rose + sage. Hero LE NUANCIER-ROI: the hero IS a swatch row — five painted pans of the collection spanning the first viewport, the statement right-aligned above them, the fifth pan bleeding off the edge. Showpiece LA PIGMENTATION: on a pinned sheet, five swatch strokes paint themselves across one per beat, each naming its ingredient in an étiquette trempée. Floraisons of product scenes; Arabic sister pages follow the Amiri pairing, script retired.
- DUO CÉLADON (event planner, Tunis) — noun le céladon; leads powder blue + sage. Hero LE CARTON: the invitation itself — a bloom-edged paper card centered on the sheet carrying the statement and the script word, washes at two opposite corners of the viewport. Showpiece LE PLAN DE FÊTE: a painted venue plan whose ZONES POOL with wash one per beat — the dance floor, the long tables, the garden — the evening filling with color until the garden holds the deepest pool. Rangs numérotés for the offers; ceremonious, fresh.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the TRANSLUCENCY LAW (one opaque block and the water dries — every area fill 25–45%, depth only by layering), the BLOOM EDGES (one straight-edged image or wash and this is a pastel template — count the displaced contours), and the RATIONS (one script word per viewport, concentrated pigment only on marks — scarcity is what keeps tenderness from turning to sugar). The cheap details that separate it from a generated page: the auréole rim on the big wash, réserve highlights left blank inside shapes, the underpainting arriving a beat before its title settles, la goutte blooming behind a link, and the saturation quietly deepening until the CTA holds the page's darkest pool. When in doubt, add water, not pigment — restraint is this world's voltage.`,
	energy: "quiet",
	family: "hand-craft",
	// velin: watercolor florals enter the revue — weddings/beauty.
	// carnet: pigment meets pen — one atelier, two hands.
	fusesWith: ["velin", "carnet"],
	id: "aquarelle",
	industries: [
		"wedding services",
		"event planner",
		"photographer (events)",
		"makeup artist",
		"nails & lashes studio",
		"skincare / esthetician",
		"cosmetics brand",
		"aesthetic clinic",
		"patisserie / bakery",
		"tea house",
		"artist / illustrator",
		"psychology / therapy",
		"home & decor shop",
		"gelato / desserts",
	],
	kind: "website",
	mood: ["tender", "romantic", "artisanal", "luminous", "quiet"],
	name: "Aquarelle",
	priceFeel: "premium",
	preview: {
		accent: "#7FA8C9",
		fontFamily: "Parisienne",
		ground: "#FBF9F4",
		ink: "#3F3A45",
		sampleWord: "Aquarelle",
	},
	tagline:
		"L'atelier d'aquarelle : lavis translucides, fleurs de pigment, papier qui respire.",
};
