import type { DesignWorld } from "./types";

/**
 * MATIÈRE — the sunlit material atelier.
 * Distilled (values and all) from four shipped builds: worlds-demo/matiere
 * (Atelier Louz), matiere-ombra, matiere-fig, matiere-meddah. Every number
 * below was measured across them; none is invented. This is the proven
 * "siblings, not clones" world: four clients produced four visibly different
 * sites from this exact doc. The doc is appended VERBATIM to the builder
 * system prompt.
 */
export const matiere: DesignWorld = {
	avoidFor: [
		"finance",
		"banking",
		"insurance",
		"law",
		"notary",
		"gaming",
		"electronics",
		"logistics",
	],
	doc: `# DESIGN WORLD: MATIÈRE — the sunlit material atelier

## Philosophy
This page is a SUN-WARMED WALL OF MATERIALS, not a website. Everything on it feels touched by hand: lime plaster, terracotta, walnut, woven fiber, brass. Its defining structural fact: the Mediterranean arch is the ONLY geometry — every image mask, frame, divider, button, pill, form field and ornament echoes an arch or a half-circle. Its second structural fact: ZERO photography. Rooms, patios and scenes are built as layered CSS/SVG architectural miniatures — flat planes of wall color, arched openings, pooled light, plant silhouettes, rugs, lamps — like painted maquettes. Warm, generous, slightly imperfect, and deeply local (Maghreb material culture carried with dignity, never as folklore wallpaper). The failure mode "a big stock photo does the visual work" is structurally impossible here; so is cold minimalism. Self-audit before shipping: zero <img> raster elements, zero sharp-cornered media boxes, one grain overlay, at least three drawn scenes, and a page that would still charm printed in flat inks.

## The variation contract (why two MATIÈRE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Arch-only geometry, drawn-miniature imagery, zero photography.
- The chunky low-contrast serif register, NEVER italic anywhere.
- Warm plaster/sand ground family; two alternating grounds; exactly ONE full-bleed deep-companion interlude where ink inverts.
- La matériauthèque (the signature interaction, spec below).
- Soft unhurried motion; 4% grain; nothing bounces, nothing snaps.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The exact hexes inside the warm register (sunlit terracotta / deep sand + oxide / rose + apricot / toasted sand + oxblood are four shipped instantiations).
- The display face WITHIN the register: Young Serif, Zodiak, Gambetta, Recia (one per site).
- The CONCEPT NOUN that drives the page — le Sud, l'ombre, la douceur, le soir — it names the hero scene, the interlude scene, the copy voice and the materiautheque's contents.
- The rooms drawn, the materials in the cabinet, the project names, the scrubbed interlude scene, the section order beyond the fixed opening (hero) and closing (form + monument footer).
A MATIÈRE page with no concept noun is a failure: name it FIRST, then let it choose scenes, materials and words.

## The vibe (voice)
Warm-plain French with a maker's precision. Short declaratives that respect the reader ("Chaque échantillon existe en vrai, sur la table de l'atelier."). Material vocabulary is exact — tadelakt, zellige émaillé, noyer huilé, chaux ferrée — never "des matériaux de qualité". One line of honest hospitality near the contact ("les enfants sont les bienvenus à l'atelier" register). No superlatives, no luxury-speak, no exclamation marks.

## Visual signatures (what makes it instantly recognizable)
- Arch-topped everything: labels and buttons use the var(--radius) action silhouette, while media frames keep sculpted multi-value crowns at 90-340px radii tapering to 10-28px feet (the measured register: 200px 200px 18px 18px · 260px 260px 22px 22px · 120px 120px 14px 14px).
- Drawn miniatures with interior light: every scene contains at least one arched opening GLOWING with a warm gradient (the sun, a lamp, dusk) — light lives INSIDE the drawings, not behind the page.
- The materiautheque cabinet: a large arch-framed panel of six drawn material swatches, each an honest CSS/SVG texture, with name + provenance caption (chaux de Tipaza, émaillé main Tlemcen register).
- Fixed full-page grain at exactly 4% opacity (inline SVG feTurbulence), the cheap move that makes flat color read as plaster.
- Hairlines in ink at 10-15% for rules and frame strokes; brass reserved for hairline moments, medallions, lamp glows and ONE footer rule.
- A giant serif wordmark edge-to-edge as the footer's final scene.

## Color physics (route the brief's palette through the fixed tokens — the physics is law)
FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · ACCENT→--primary · warm ivory→--primary-foreground · GROUND B→--secondary · DEEP COMPANION→--accent · softened ink→--muted · ink at hairline strength→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, brass or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
- GROUND A and GROUND B: two warm plaster/sand tones 4-8 RGB points apart (the #EDE0D2/#E3D0B9 and #E7D4B6/#DCC49F registers). Sections alternate between them; the alternation IS the section rhythm.
- INK: a deep warm brown, never black (the #221710 / #2A1B10 / #33221A register).
- ACCENT: one earth pigment — terracotta, oxide red, apricot, oxblood (the #B8552F / #9E3B2B / #E08A4C / #7E2D26 register). Budget: CTAs, active swatch ring, marquee band, small ornaments, one accent word per major headline at most.
- DEEP COMPANION: one dark warm tone — palm green, indigo night, fig leaf, dusk aubergine (the #274A3A / #22304A / #3E5B3F / #3A2430 register). It exists for exactly ONE full-bleed interlude where ink flips to warm ivory, plus small supporting shapes.
- BRASS: #A87E3F-#B08D57 register, rationed as written above.
- The materiautheque RE-TINTS the page: selecting a swatch reassigns --primary globally to an authored mix between the fixed --primary and --accent poles (~0.6s ease). No material-named color property is introduced. Color is therefore interactive state, not just theme.
- Gradients exist ONLY as light inside drawn scenes (a glowing arch, a dusk sky, a lamp pool) — never as section decoration.

## Typography system
- DISPLAY: a chunky, warm, LOW-CONTRAST serif — Young Serif / Zodiak / Gambetta / Recia register, one per site, chosen by the brief. Weights 500-700. NEVER italic — emphasis is the accent color or nothing. Display only above ~2rem.
- BODY: a plain warm sans (Karla / Figtree / General Sans register), 400/700.
- Hero statement: clamp(2.8rem,7vw,6rem) up to clamp(4.5rem,12vw,7.5rem) for short names; line-height 1.02-1.08. Section titles clamp(2rem,4vw,4.5rem). The 28:1 poster ratio does NOT apply here — MATIÈRE's scale is generous but domestic, ~8:1, because the page is a room, not a billboard.
- Labels: body face 700, uppercase, 11-12px, +0.08-0.12em tracking, ALWAYS inside an arch-topped pill outline — never floating letter-spaced whispers on bare ground.
- Captions under scenes and swatches: body face, sentence case, provenance included ("Tadelakt — chaux ferrée au galet, savon noir.").
- Numerals (prices, m², steps) get the display face with the accent on affixes; no tabular-mono telemetry — this world does not speak machine.

## The drawn miniatures (imagery system — the craft that carries the world)
- Every scene is layered flat construction: wall plane → arched opening with warm gradient light → furniture as simple rounded silhouettes (sofa, low table, vases in 2-3 tones) → textile with drawn stripes → plant silhouette → optional hanging lamp with glow.
- Perspective is FLAT ELEVATION or gentle one-point; never isometric, never 3D shading. Shadows are single flatter-tone shapes, not blurs.
- Furniture and objects reuse the arch: arched sofa backs, half-circle rugs, arch mirrors, arched niches with vases.
- Each project/section gets a DIFFERENT room drawn in the same construction language — repetition of system, never of scene.
- Material swatches are honest textures in CSS/SVG: plaster = soft irregular lighter strokes; zellige = a tile grid with per-tile hue jitter and one glaze highlight; wood = 3-4 grain paths; woven fiber = crosshatch; brass = vertical sheen bands; linen = fine weave lines. Slightly figurative beats photoreal — these are samples on a table, not renders.
- Every scene carries role="img" and a real aria-label describing the room in the page's language.

## LA MATIÉRIAUTHÈQUE (signature interaction — mandatory, exact spec)
An arch-framed cabinet of SIX drawn material swatches beside one large room vignette.
- Selecting a swatch (click, Enter/Space; aria-pressed synced) retints the vignette's wall/floor/textile layers AND the scoped --primary override, both over 0.6-0.7s eased fills; the active swatch gets a var(--primary) ring; a polite aria-live region announces the material.
- Each swatch: drawn texture + name + one-line provenance. The cabinet footer states the honest line: every sample exists physically at the atelier.
- The vignette's SUBJECT is client-owned (salon, patio niche, children's room, dining room are the four shipped ones) — the mechanism is world law.

## Page chassis & structure vocabulary
- Section vertical rhythm: clamp(5rem,11vh,8.5rem) padding register; inner grids cap ~1200-1400px; scenes may bleed.
- Header: serif wordmark with a small arch glyph + arch-pill tél. No blur bars, no shadows.
- FIXED OPENING: an arcade hero — headline + sub + arch CTA on one side, a large drawn arch scene on the other (or a full-width panoramic arcade with the statement above). The hero scene must contain the concept noun made visible.
- FIXED CLOSING: form-as-object inside a large arch frame (numbered/labeled fields, honest animated success state), then the monument footer wordmark over one brass hairline.
- FREE MIDDLE (compose 3-5 from this vocabulary, never two adjacent alike): marquee band of material names with arch separators between hairlines · the materiautheque showpiece · sticky-split projects (scene column pinned, crossfading per beat; 3 projects with m², durée, materials) · the ONE deep-companion interlude with a scrubbed scene · a journey of 3-4 steps hung on a drawn SVG arc that strokes itself in · a pull-quote break in display serif with an accent word.
- THE INTERLUDE SCENE is scrubbed [GSAP]: an arch-shaped sun rising, moucharabieh light-dots sweeping the floor across the day, a nursery mobile balancing, villa windows lighting one by one at dusk — the concept noun animated. One per page, the page's held breath.

## Motion identity (GSAP 3 + ScrollTrigger via CDN; CSS + IntersectionObserver base)
THE GOVERNING LAW: every hidden state is set in JS via gsap.set, NEVER in CSS. Gate the whole animation block on (gsap && ScrollTrigger && !prefers-reduced-motion). CDN dead → a complete, readable, fully-lit static page (scenes pre-composed, real text hard-coded).
- Easing identity: power3.out for entrances, power2.out for supporting moves, power2.inOut for crossfades; CSS transitions 0.25-0.45s ease. NOTHING bounces, nothing snaps, no overshoot.
- Entrances: masked rises with 90-120ms staggers; scene layers arrive back-to-front over ~1.2s.
- Scrubs are slow and few: the interlude scene and the journey arc draw-in; sticky-split crossfades per beat. Mobile: non-pinned simplified fallbacks, scenes pre-drawn, reveals on view.
- Hovers: soft lifts, brass glow intensifying, swatch ring fades — 150-250ms, always with keyboard/touch parity inside @media (hover:hover) discipline.
- The grain never animates. Reduced motion: instant reveals, static interlude at its most composed frame.

## Components
- Buttons: filled pills at border-radius var(--radius) in accent with ivory text, or an outline ghost on the same token-borne silhouette; hover deepens fill, never underlines. The larger architectural frames keep their multi-value sculpted arches.
- Forms: fields inside hairline arch-topped boxes capped at min(var(--radius), 1rem), labels as token-borne arch pills, accent focus ring, phone-first inputs, select for structured choices (commune, type de projet); success state is an honest drawn moment (an arch checkmark, a stamped-note register) with real next-step words.
- ::selection accent on ground; :focus-visible 2px accent outline offset 3px. Decorative SVG aria-hidden; one h1; semantic landmarks.
- Favicon: inline SVG data URI — an arch stroke in the accent on the ground.

## Matière ban list (in addition to the global one)
Photography or photoreal renders · thin/didone/high-contrast serifs · ANY italic character · cream+gold luxury coding · floating letter-spaced micro-labels on bare ground · dark or black heroes (the interlude is the only deep moment) · cold minimalism, glassmorphism, blur panels · sharp-cornered media boxes · isometric or 3D-shaded illustration · box-shadow cards on white · marquees faster than 30s · emoji, icon fonts · machine/telemetry voice (mono captions, SYS labels — that is another world's language).

## Intensity
This world lives or dies on THREE things at 100%: the DRAWN SCENES (a MATIÈRE page with weak or missing miniatures is a beige template — the scenes are the photography budget spent in code), the MATIÉRIAUTHÈQUE actually retinting the world, and the ARCH DISCIPLINE (one straying sharp-cornered frame breaks the spell). The grain, the arch pills, the provenance captions and the brass rationing cost almost nothing and are what separate this from a generated page. When in doubt, add another lamp glow inside a drawing — warmth is this world's voltage.`,
	energy: "medium",
	family: "matiere",
	id: "matiere",
	industries: [
		"interior-design",
		"architecture",
		"crafts",
		"ceramics",
		"furniture",
		"decor",
		"hammam",
		"spa",
		"guesthouse",
		"hotel",
		"riad",
		"bakery",
		"restaurant",
		"wellness",
		"family-services",
	],
	kind: "website",
	mood: ["warm", "tactile", "sunlit", "artisanal", "generous"],
	name: "Matière",
	preview: {
		ground: "#EDE0D2",
		ink: "#2A1B10",
		accent: "#B8552F",
		fontFamily: "Young Serif",
		sampleWord: "La matière",
	},
	priceFeel: "premium",
	tagline:
		"A sun-warmed wall of materials: arches as the only geometry, rooms painted as CSS/SVG miniatures with light glowing inside them, a chunky serif that never whispers, and a cabinet of drawn material samples that re-tints the whole page when touched — the warmth of a real atelier, zero photography.",
};
