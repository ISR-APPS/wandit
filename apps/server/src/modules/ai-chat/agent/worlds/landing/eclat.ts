import type { DesignWorld } from "../types";

/**
 * ÉCLAT — warm skin, soft light.
 * The warm-lifestyle-photography wellness world: premium clinic register,
 * golden-grade photography in deep-rounded masks, a calm chocolat serif,
 * capsule glyph-badges, and the photo-orbit statement. Photography is LAW
 * here — the drawn-art default of the factory is overridden for this world.
 * fusesWith rationale: herbier (the herbarium enters the clinic —
 * natural-medicine brands), clair (clinical trust meets warm skin —
 * health-tech with a human face).
 */
export const eclat: DesignWorld = {
	avoidFor: [
		"dev tool",
		"spare parts",
		"garage / mechanic",
		"crossfit / functional",
		"security company",
		"festival",
	],
	doc: `# DESIGN WORLD: ÉCLAT — warm skin, soft light

## Philosophy
This page is a LATE-MORNING TREATMENT ROOM, not a website: cream walls, one tall window, golden light falling on healthy skin. Warm lifestyle PHOTOGRAPHY does the emotional work — faces with closed eyes, hands applying care, towels and ceramics — all pulled into ONE golden grade and held in deep-rounded masks (28–48px). A chocolat serif speaks calmly over the cream; small capsule badges whisper credentials instead of shouting them; small photos drift around a centered statement like petals around a stem. This is the premium-clinic register: medical trust wrapped in warmth — the page must feel clean enough to trust with your face and warm enough to close your eyes in. Its defining structural facts: photography is LAW (the factory's drawn-art default is overridden — zero drawn scenes, zero illustration); every photograph lives inside a rounded mask and NO photograph ever touches the viewport edge (the cream is the frame, always); every micro-label lives inside a soft capsule. Impossible failure modes: a cold clinical page (steel, white, blue) cannot happen here; a shouting promo page (discounts, countdowns, exclamation marks) cannot happen here; a dark-ground section cannot happen here — ÉCLAT has no night. Self-audit before shipping: (1) every photo mask radius sits in the 28–48px register, zero sharp-cornered and zero fully-circular images; (2) one photo-orbit statement exists with 3–5 drifting photos; (3) zero pure #FFFFFF and zero pure #000000 anywhere on the page; (4) at least 4 capsule glyph-badges across the page and not one floating bare micro-label; (5) at most ONE italic line on the whole page; (6) no photograph touches the viewport edge at 390, 768 or 1440.

## The variation contract (why two ÉCLAT sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Warm-grade photography in deep-rounded masks (28–48px), one consistent golden skin-tone grade across EVERY image, and the permanent cream gutter — photography never bleeds to the viewport edge.
- The cream #F6EDE3/#F2E6D8 ground register, cacao ink #4A3428, cacao-bronze accent #8C5B3F, blush support #E8C9B8.
- Instrument Serif (or Lora) display, roman and calm; Nunito Sans body; ONE italic welcome line maximum per page, never in a headline.
- The photo-orbit statement somewhere on the page (hero or showpiece), the capsule glyph-badges, and bloom-drift motion (slow sine parallax, 1.2–1.6s scale-blooms from 0.96 — nothing snaps, nothing bounces).
- The quiet-confidence voice: no superlatives, no urgency, no exclamation marks.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes inside the registers (a dentist may sit at the paler #F2E6D8 end with blush rationed; a spa may push blush panels warmer and larger).
- The display face within the register: Instrument Serif (sharp, editorial) or Lora 500 (rounder, softer) — one per site, never both.
- The DRIVING WORD that names the page — l'éclat, le rituel, la lumière, le geste, le soin — it chooses the hero claim, the section names, the badges' vocabulary and the showpiece's subject.
- The photography scene list (which treatments, which stills, which portraits), the hero composition (from LES GESTES), the section order beyond the fixed opening and closing, and which single geste carries the scroll showpiece.
An ÉCLAT page without a driving word is a spa brochure: name the word FIRST, then let it choose images and lines.

## The vibe (voice)
Calm, precise, second-person French that treats the reader like a patient already welcomed. Short warm declaratives; medical honesty without jargon walls; the skin is always the subject, never the machine. Example register: "Votre peau sait déjà faire. On l'aide simplement à s'en souvenir." · "Un diagnostic d'abord. Rien ne se prescrit avant de comprendre." · "Ici, on ne promet pas une autre peau — on prend soin de la vôtre." Prices are stated plainly in DZD, framed as care, not offers. One italic welcome line is permitted near the top of the page ("Bienvenue — installez-vous, on s'occupe du reste.") — this is the page's only italic. Never "révolutionnaire", never "offre limitée", never an exclamation mark.

## Visual signatures (what makes it instantly recognizable)
- Warm-grade photography in deep-rounded masks — OWNED TIC: every image sits in a border-radius 28–48px register mask (hero 40–48px, mid photos 32–40px, orbit petals 28–36px); one golden grade unifies all photos (warm skin tones, cream backgrounds, low contrast, subtle film grain). Mixed grades = failed page.
- The photo-orbit statement — OWNED TIC: a centered Instrument Serif claim with 3–5 small rounded photos (96–180px wide) parallax-drifting around it like petals, each on its own sine phase, amplitude 8–20px, period 6–10s. It appears exactly once per page.
- Capsule glyph-badges — OWNED TIC: a tiny petal/asterisk glyph (drawn inline SVG, 12–14px, accent stroke) + a micro-label (Nunito Sans 600, 10.5–12px, uppercase, +0.14–0.18em tracking) inside a soft capsule: blush #E8C9B8 at 55–100% fill or soft cream-white #FBF5EC at 30–60% fill (the quieter variant, and the one used on blush grounds), ringed by a 1px cacao 12–18% hairline; radius 999px, padding 7–9px × 14–18px. They carry credentials, section labels, prices, hours — anywhere a label is needed.
- The permanent cream frame: page gutter clamp(16px, 4vw, 64px) that photography never crosses; content column 1140–1280px.
- Hairlines are cacao ink at 12–16% alpha, 1px, used sparingly (footer top rule, form fields) — the accent #8C5B3F is NEVER a hairline (brass hairlines are MATIÈRE's language, and their brass #A87E3F–#B08D57 register is banned outright).
- Photos may cast ONE soft warm shadow (0 18px 40px rgba(74,52,40,0.12)) because they float and drift; panels and cards NEVER cast shadows — soft-shadow floating cards are CLAIR's tic.
- Numbers set calm: prices and stats in the display serif at 1.4–2rem with DZD as a small capsule suffix — never oversized poster numerals.

## Color physics
- GROUND: the cream #F6EDE3/#F2E6D8 register — peach-warm (velin's vellum is cooler, matiere's sand is pinker; sit between them and warmer). One page may alternate the two creams between sections, 4–8 RGB points apart, or hold a single cream and rhythm with blush panels.
- INK: cacao #4A3428, never black. Secondary text: cacao at 72–80% or #6B4F3F. All-cacao pages read flat — reserve full-strength ink for headlines and leads.
- ACCENT: cacao-bronze #8C5B3F (register #8C5B3F–#7A4C34). Budget: filled CTA capsules, active badge rings, the petal glyphs, at most one warmed word per major headline (roman, colored — NEVER italic: the italic accent word is VELIN's tic), focus rings. Never as hairlines, never as large panel fills.
- BLUSH SUPPORT: #E8C9B8 — capsule fills, soft panels behind forms or treatment cards, at most 2 large blush panels per page. Blush at 40–60% alpha over cream makes the in-between register for hover fills.
FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · GROUND→--primary-foreground · soft cream-white→--secondary · BLUSH SUPPORT→--accent · cacao at 76%→--muted · cacao at 14%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, blush tint or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
- CSS gradients DO NOT EXIST in this world — light lives inside the photographs, not in the stylesheet. The CTA "warming to bronze" is a solid-color transition (#8C5B3F → #7A4C34 over 0.4s), not a gradient. No glows, no auras, no washes.
- Contrast law: cacao on cream ≥ 7:1 for body text; cream text on accent fills ≥ 4.5:1; never set body text on blush below 15px.

## Typography system
- DISPLAY: Instrument Serif 400 (the default — its sharpness keeps the warmth from going soft) or Lora 500 (the rounder alternative). One per site. Roman always; the single italic welcome line is the ONLY italic on the page and it never appears inside a headline (an italic accent word inside a roman headline is VELIN's tic — banned).
- Hero claim: clamp(2.6rem, 6.5vw, 5.6rem), line-height 1.05–1.12, letter-spacing -0.01em. Section titles: clamp(1.9rem, 3.6vw, 3.4rem). The scale is generous but domestic — this page is a room, not a poster; never fit-to-viewport display (AFFICHE's territory).
- BODY: Nunito Sans 400–600, 16–18px, line-height 1.6–1.75, max measure 62ch. Lead paragraphs 18–20px at 500.
- MICRO-LABELS: Nunito Sans 600–700, 10.5–12px, uppercase, +0.14–0.18em tracking, ALWAYS inside a capsule — floating letter-spaced micro-caps on bare ground are ECRIN's tic, banned.
- Numerals: display serif for prices and stats, Nunito Sans for phone numbers and hours. No mono anywhere — this world does not speak machine.
- ARABIC PAIRING (this world may serve Arabic pages): display in Amiri 400, body in IBM Plex Sans Arabic 400–600; keep the same clamps and the same capsule law; in RTL the photo-orbit drift direction mirrors.

## Signature art (the photography law — imagery system)
Photography is LAW: this world's imagery is warm lifestyle clinic photography, generated or supplied, never drawn, never mixed with illustration.
- SUBJECTS: close portraits with healthy skin (eyes closed or looking away, serene — never direct camera eye-contact), hands applying care, treatment moments, soft towels and ceramics, one plant shadow. No clinical equipment close-ups, no syringes, no before/after grids.
- LIGHT: soft golden window light with gentle falloff — one light source, always warm.
- GRADE: warm skin tones, cream backgrounds, low contrast, subtle film grain. Every photo on one page must read as one shoot — if an image's grade fights the set, drop it.
- FRAMING: generous margins inside the frame, subject off-center — the photograph breathes like the page does.
- ART-DIRECTION PHRASE — reuse VERBATIM in every generation prompt: "warm lifestyle photograph, soft golden window light, healthy glowing skin, cream tonal background, low contrast, gentle film grain, serene subject looking away, generous negative space".
- MASKS: rounded-rectangle only, radius 28–48px register (see signatures). Never circles, never letterboxed 21:9 with black bars (GENERIQUE's tic), never irregular painted edges (AQUARELLE's tic), never B/W or desaturated (SILHOUETTE's grade).
- Type never collides with photography: captions live in the cream beside or below a mask, or in a capsule badge overlapping a photo corner by max 50% of the capsule height. Huge display type OVER a photo is SILHOUETTE's collision — banned.

## Components
- BUTTONS: capsules — buttons, chips and capsule CTAs consume var(--radius) directly (the 999px capsule), padding 13–16px × 26–34px. Primary: accent #8C5B3F fill, cream #F6EDE3 text, hover/focus deepens to #7A4C34 with a 1.02 scale over 0.35s. Ghost: 1.5px cacao 25% outline capsule, hover fills blush 50%. Never rectangles, never underline-on-hover as the only affordance.
- FORMS: fields on soft cream-white #FBF5EC, 1px cacao 15% border, radius 16–20px, padding 14–16px; labels as capsule glyph-badges above fields; phone-first (tel input first, type="tel", autocomplete="tel"); a select for structured choice (type de soin, créneau). Focus: 2px accent ring offset 2px. Success state is honest and warm: the panel blooms (scale 0.96→1) into a real next-step line — "Merci. On vous rappelle sous 24h ouvrées pour fixer votre rendez-vous." — no confetti, no checkmark theatrics. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail; include one off-canvas decoy input with data-wandit-hp that the page's own script never touches.
- CARDS/PANELS: flat blush or cream-white fills, radius 24–32px, or hairline-outlined; zero drop shadows (CLAIR owns soft-shadow floating cards).
- ::selection — blush #E8C9B8 ground with cacao text. :focus-visible — 2px #8C5B3F outline, offset 3px. Decorative SVG aria-hidden; photos get real alt text in the page's language; one h1; semantic landmarks.
- Favicon: inline SVG data URI — the petal/asterisk glyph in #8C5B3F on #F6EDE3.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 8rem); content max-width 1140–1280px; the permanent gutter clamp(16px, 4vw, 64px) at every width.
- HEADER: serif wordmark left (1.25–1.5rem), 2–4 plain cacao links, one capsule tel CTA right. Transparent over cream, no blur bars, no shadows, and never an 800px pill nav container (CALDERA's tic).
- FIXED OPENING (hero law): the first viewport always holds (1) the serif claim as the one h1, (2) at least one golden-grade photograph in a deep-rounded mask, (3) one row of 2–3 capsule glyph-badges, (4) one capsule CTA. The COMPOSITION of those four is client-owned — pick a hero geste. The italic welcome line, if used, lives here.
- FIXED CLOSING: "Prendre rendez-vous" — the form on a blush panel beside one serene photograph (never form alone on bare cream), honest practical facts (address, hours, phone as a text link), then a quiet footer: small serif wordmark, capsule badges for credentials, one cacao 12% hairline above. No monument wordmark, no dark footer.
- FREE MIDDLE — compose 3–5 sections from this vocabulary, never two adjacent sections with the same layout skeleton:
  · LES SOINS — treatment cards: photo mask + serif title + one honest line + price with DZD capsule; grid of 3 or an asymmetric 2+1.
  · LE RITUEL — a numbered 3–4 step journey, small photos alternating sides of a center axis, each step one short paragraph.
  · LA PREUVE CALME — credentials band: capsule badges + 2–3 calm stats (années, patients suivis, praticiennes) in display serif.
  · LE VISAGE — practitioner section: portrait mask + name + two lines of real biography + one badge (diplôme, ordre).
  · LA FENÊTRE — one large photo (up to 1360px, still inside the gutter) with a caption capsule at its lower corner — an editorial breath.
  · LA PAROLE — ONE pull-quote from a patient or the practitioner, serif at 1.6–2.2rem, tiny photo beside — never a carousel.

## Motion identity (bloom drift)
GSAP 3.12.x + ScrollTrigger, gated on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). Hidden states set ONLY via gsap.set — CSS never hides; the page reads complete with JS dead.
- EASING: sine.inOut for drifts, power1.out–power2.out for blooms. NOTHING snaps, nothing bounces — back.out and any overshoot are GUIMAUVE's; hard cuts are MANIFESTE's.
- ENTRANCES: gentle scale-blooms from 0.96 + fade, 1.2–1.6s, staggers 120–180ms; translation budget max 24px. Sections bloom as composed groups (photo first, then claim, then badges), not element-by-element rain.
- THE DRIFT: orbit photos and floating photos ride continuous sine parallax, amplitude 8–20px, period 6–10s, each element phase-offset by 0.8–1.5s so no two move together. The drift is idle-state life, not scroll-driven.
- SHOWPIECE (exactly one per page, scroll-scrubbed) — seed: "l'orbite de la peau": the photo-orbit statement pinned for 150–220vh; as the visitor scrubs, the orbiting photos drift ONE position around the claim (position swap along soft arcs, sine.inOut) while the capsule badges bloom in one by one; the sequence ends with the CTA capsule warming to bronze (#8C5B3F → #7A4C34). Variations may re-seat the showpiece on another geste (see EXAMPLE VARIATIONS) but there is always exactly one, always slow, always warm.
- HOVER: photos warm slightly (brightness 1.03, saturate 1.05) and rise 4px over 0.35s; capsules fill blush; every hover has :focus-visible and touch parity.
- REDUCED MOTION: the orbit holds its most composed frame, badges and photos visible, no pin, no drift — a still page that looks art-directed, never blank.
- Mobile: no pinning; the orbit becomes a composed cluster (claim + 3 photos) with drift only; blooms shorten to 0.9–1.1s.

## Ban list (the global ban list applies; these are ÉCLAT-specific)
1. Boxed drop caps, double-filet rules, and the italic accent word inside a roman headline — VELIN's tics.
2. Arch geometry (arch frames, arch pills), plaster grain overlays, and brass hairlines in the #A87E3F–#B08D57 register — MATIÈRE's tics.
3. Letterboxed 21:9 crops with black bars, champagne-foil small caps, Ken-Burns scrubs, and ANY dark ground — GENERIQUE's tics; ÉCLAT has no night section.
4. Watercolor washes and pigment-bloom irregular image masks — AQUARELLE's tics.
5. B/W or desaturated photo grades and type-over-photo collisions — SILHOUETTE's tics.
6. The 800px pill nav container — CALDERA's tic.
7. Puffy blob containers and back.out bounce entrances — GUIMAUVE's tics; nothing in ÉCLAT overshoots.
8. Soft-shadow floating cards — CLAIR's tic; panels stay flat here.
9. Floating letter-spaced micro-caps on bare ground — ECRIN's tic; labels live in capsules.
10. Full-bleed edge-to-edge photography — the cream gutter is law.
11. Circular avatars/photos and sharp-cornered images — only the 28–48px mask register exists.
12. Clinical iconography: crosses, syringes, stethoscopes, before/after sliders, star-rating rows.
13. CSS gradients, glows and auras of any kind — light is photographic only.
14. Fake urgency, discount stickers, countdowns, exclamation marks — the voice never sells.
15. More than one italic line per page; italic in any headline.

## LES GESTES (moves menu)
1. L'ORBITE EN OUVERTURE — the photo-orbit statement AS the hero: centered claim, 3–5 photos drifting around it, badges beneath, CTA under. When played here, the showpiece pins this same scene (hero and showpiece merge).
2. LE PORTRAIT DÉCENTRÉ — split hero: claim + badges + CTA left on cream, one large off-center portrait mask right (55–60% column), a single small photo overlapping the seam by 15–20%.
3. LA COLONNE DE SÉRÉNITÉ — a narrow centered text column (52–58ch) with two photos peeking in from the left and right gutters at different heights, drifting.
4. LE RAIL DES SOINS — treatment cards on a horizontal rail that eases sideways as the section scrolls (scrub-translated, max 30% overflow) — a slow drift, never a marquee.
5. L'ÉCHELLE DES GESTES — the ritual steps hung on a center axis, numbered in serif, small photos alternating sides, each step blooming as it enters.
6. LA FENÊTRE — one big photograph with a caption capsule pinned to its lower-left corner and generous cream above and below — the page inhales.
7. LE DUO PEAU — two photos overlapping by 15–20% at different sizes, one caption block in the cream between them; on scroll the pair exchanges 8–12px of depth drift.
8. LES PÉTALES DE PREUVE — 4–6 capsule badges scattered in an arc around one calm stat or claim, blooming in sequence, petal glyphs rotating 15° as they arrive.
9. LA RESPIRATION — an almost-empty cream band: one serif line, one small drifting photo, nothing else — placed between two dense sections.
10. LE SEUIL — the consultation panel: blush ground, price stated plainly with its DZD capsule, two honest reassurance lines, the CTA capsule warming on hover.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. "LA LUMIÈRE" (aesthetic clinic) — Hero: L'ORBITE EN OUVERTURE — the claim "La peau, en pleine lumière." with four photos in orbit. Showpiece: the canonical orbite de la peau — pinned hero, photos drift one position, badges bloom, CTA warms. Order: hero-orbit → soins grid → rituel → visage → seuil → contact. Mood: the flagship — luminous, ceremonial, the fullest expression of the world.
2. "LE RITUEL" (spa / hammam) — Hero: LE PORTRAIT DÉCENTRÉ — towel-wrapped portrait right, claim left. Showpiece: l'échelle des gestes scrubbed — the center axis draws downward as each of four steps blooms with its photo, ending on the last step's badge. Order: hero-split → respiration → rituel-showpiece → fenêtre → parole → contact. Mood: slow, vaporous, the calmest sibling.
3. "LE SOURIRE" (dentist) — Hero: LA COLONNE DE SÉRÉNITÉ — centered claim about confidence, two photos peeking from the gutters. Showpiece: le rail des soins scrubbed — the treatment rail eases sideways under a pinned title while captions swap. Order: hero-column → preuve calme → rail-showpiece → visage → seuil → contact. Mood: the most medical sibling — blush rationed, paler cream, trust forward.
4. "LES MAINS" (physiotherapy / kiné) — Hero: LA FENÊTRE as opening — one wide photograph of hands at work with the claim set in the cream BELOW it, badges beside. Showpiece: le duo peau scrubbed — two overlapping photos exchange depth while the headline's warmed word shifts from "douleur" to "mouvement". Order: hero-fenêtre → rituel → duo-showpiece → parole → preuve → contact. Mood: tactile, grounded, the most editorial sibling.
5. "LA RACINE" (nutritionist) — Hero: claim on a large blush panel (radius 32px) with a pair of small still-life photos drifting at its right edge — the panel hero. Showpiece: les pétales de preuve scrubbed — six badges bloom in an arc around one number counting gently from 0 to its stat. Order: hero-panel → colonne → soins → pétales-showpiece → parole → contact. Mood: nourishing, botanical-adjacent (stills of ceramics and food, no drawn plants — that would be HERBIER).
6. "LE REGARD" (optician) — Hero: a twin diptych — two portrait masks side by side at different heights, the claim spanning the cream gap between them. Showpiece: the focus pull — pinned diptych where one photo softens (blur 0→4px) as the other sharpens, captions exchanging, ending with both crisp and the CTA blooming between. Order: hero-diptych → preuve → soins → focus-showpiece → visage → contact. Mood: precise, quiet, the sharpest sibling.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: (1) THE GRADE — one golden grade across every photograph; a single cool or contrasty image breaks the room's light and the page collapses into a template with stock photos; (2) THE ORBIT — the photo-orbit statement actually drifting, photos alive on their sine phases; a static orbit is just a collage; (3) THE MASK-AND-GUTTER DISCIPLINE — 28–48px on every image, cream visible on every side of every photo at every width; one full-bleed image and the treatment room becomes a billboard. The cheap details that separate ÉCLAT from a generated page: the petal glyph turning slowly in a badge, the blush ::selection, the DZD set as a small capsule after a calm serif price, the one italic welcome line, the warm shadow only under photos that drift, and the success message that tells the visitor exactly what happens next. When in doubt, add cream, not content — emptiness is this world's light.`,
	energy: "quiet",
	family: "warm-lifestyle",
	fusesWith: ["herbier", "clair"],
	id: "eclat",
	industries: [
		"specialist (cardio, derma, ophtalmo…)",
		"pharmacy",
		"cosmetics / skincare brand",
		"aesthetic clinic",
		"skincare / esthetician",
		"dentist",
		"spa / hammam",
		"nutritionist",
		"hair salon",
		"makeup artist",
		"cosmetics brand",
		"physiotherapy / kiné",
		"nails & lashes studio",
		"general practitioner / cabinet",
		"optician",
		"home care / nursing",
		"psychology / therapy",
	],
	kind: "website",
	mood: ["warm", "serene", "glowing", "trustworthy"],
	name: "Éclat",
	preview: {
		accent: "#8C5B3F",
		fontFamily: "Instrument Serif",
		ground: "#F6EDE3",
		ink: "#4A3428",
		sampleWord: "L'Éclat",
	},
	priceFeel: "premium",
	tagline: "Peau saine, lumière dorée — la clinique premium qui respire.",
};
