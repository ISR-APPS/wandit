import type { DesignWorld } from "../types";

/**
 * OBSERVATOIRE — the night atlas.
 * Deep indigo sky plates, hand-placed starfields, constellation maps whose
 * labeled dots connect the page's content on scrub, dotted labeled orbital
 * diagrams with a moving body, astronomical captions in serif small caps.
 * Wonder with precision; scientific romance. Starlight never glows beyond a
 * 1px halo. Proof build: CAMP ALTAÏR (Sahara stargazing camp, Taghit) in
 * worlds/observatoire/demo/.
 *
 * fusesWith bridges:
 * - atlas: land by day, sky by night — desert expeditions.
 * - generique: the photographed night meets the charted night — premium hospitality.
 */
export const observatoire: DesignWorld = {
	avoidFor: [
		"fast food",
		"garage / mechanic",
		"kids & baby shop",
		"crossfit / functional",
		"cleaning company",
	],
	doc: `# DESIGN WORLD: OBSERVATOIRE — the night atlas

## Philosophy
This page is a PLATE FROM A NIGHT ATLAS — a working sky chart kept by a careful observer — not a website. Its defining structural facts: everything sits on deep indigo plates under a hand-placed starfield; CONSTELLATION MAPS — labeled dots joined by 1px hairlines — connect the page's actual content (offers, nights, steps become stars; the lines between them become the argument); DOTTED ORBITAL DIAGRAMS with a slowly moving body frame prices and programmes as labeled science; and every image, number and name carries an ASTRONOMICAL CAPTION in serif small caps (Décl. −23° 26′ · mag. 0,76 · azimut 214°). The temperament is WONDER WITH PRECISION — the sky amazes, the observer measures. Its one optical law: STARLIGHT NEVER GLOWS BEYOND A 1PX HALO — a named star earns one hairline ring, never a blur (glow is VOLTAGE's electricity). Nothing is generative: every star has authored coordinates in the markup (runtime fields are CINÉTIQUE's). Orbits are labeled science, never chrome decoration (AN2000's rings). Structurally impossible failure modes: the purple-nebula space poster; the NASA-photo hero; the dark-mode SaaS template; astrology kitsch. Self-audit before shipping: zero raster img elements — the page would still read printed in two inks; the halo law held — zero blur radii above 2px, no star above 3px except named stars at 4–5px with their ring; at least ONE constellation visibly connecting ≥4 labeled content nodes; at least ONE dotted orbit with a moving body AND a written period; at least THREE captions carrying real values.

## The variation contract (why two OBSERVATOIRE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Indigo plate register, moonlight ink, starlight accent, faint-violet support; hand-placed starfields with authored coordinates; zero photography, zero generative art.
- The constellation system: dots ARE content nodes, hairlines connect them on scrub, labels are serif small caps. A constellation that decorates without naming content is a failure.
- Dotted orbital diagrams as labeled science: dash 1 6, a moving body, a written period.
- Astronomical captions in the serif's small caps, always carrying a real measured value.
- The 1px halo law; stellar-drift motion (very slow, linear) + constellation connect; nothing bounces, nothing flickers, nothing glows.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside the registers below; the display face (Spectral or EB Garamond, one per site).
- LE CIEL DU CLIENT — the sky concept carrying the content: three real constellations for three nights; one invented constellation charted from the client's values; an orbit family around one center; the night's ephemeris hour by hour; a lunar month of phases. The concept names the hero, the showpiece and half the copy.
- The named stars (real — Altaïr, Véga, Antarès — or invented designations α, β, γ), the horizon silhouette (dunes, ridgeline, rooftops, a bare line), section order beyond the fixed opening and closing, and which gestes play.
An OBSERVATOIRE page with no named sky is a failure: name the stars FIRST — the lines need somewhere to go.

## The vibe (voice)
French in the register of an observation logbook kept by someone in love with the sky — short factual sentences where precision carries the emotion. Example lines: "La nuit tombe à 19 h 42. Le thé est prêt avant les étoiles." · "Véga culmine à 23 h 10. Vous serez encore éveillés." · "Altaïr, de l'arabe al-ṭā'ir, l'oiseau en vol. Elle se lève à l'est, comme vous demain." Numbers are honest and exact (312 nuits claires par an, 52 000 DA); wonder is stated calmly, never exclaimed. Vocabulary is real astronomy — magnitude, déclinaison, azimut, culmination, éphéméride — never "un ciel magique". Star names keep their Arabic etymologies with respect (this sky was charted in Arabic first). No superlatives, no exclamation marks, no emoji, no astrology — this observatory measures.

## Visual signatures
- CONSTELLATION CONTENT MAPS (owned tic): field stars 1–2px circles at 20–70% opacity; CONTENT stars 4–5px filled starlight with a 1px moonlight ring at 2–3px offset (the entire halo allowance); hairlines 1px starlight at 35–55% opacity joining them dot-to-dot; each content star labeled in serif small caps with designation and meaning (α Alt · Nuit 1 — l'arrivée). The lines CONNECT ON SCRUB, segment by segment; each completed figure reveals what it names.
- DOTTED ORBITAL DIAGRAMS (owned tic): ellipses stroked 1px in faint violet #6E7BB0, stroke-dasharray 1 6, round linecaps; a moving body 5–7px in starlight travels the ellipse in a 24–48s linear loop; the diagram is LABELED like a figure — period (T = 29,5 j), apogée/périgée ticks with small-caps captions. Orbits frame content: a price at the focus, services as satellites.
- ASTRONOMICAL CAPTIONS (owned tic): the display serif in small caps (font-variant-caps: all-small-caps), 11–13px, letter-spacing +0.06–0.1em, starlight primary, faint violet secondary; ALWAYS carrying values: "Décl. +8° 52′ · mag. 0,76 · se lève 20 h 04". They sit under headlines, beside stars, on card headers, in the footer. A caption without a value is banned.
- THE 1PX HALO LAW: light is drawn, never bloomed. Named stars get one hairline ring; the moon a flat terminator (two overlapping circles); planet rings are 1px dotted ellipses. No text-shadow, no box-shadow blur >2px, no radial auras.
- HAND-PLACED STARFIELDS: 40–90 stars per sky, authored as explicit cx/cy circles in the markup (never scattered by script); sparse over text zones, denser at edges; sizes 1–2.5px, opacities 0.2–0.7; 6–10 chosen stars twinkle by slow opacity loop, the rest hold still.
- GRATICULE FRAGMENTS: 1–3 declination arcs per decorated section — 1px moonlight at 8–14% opacity, occasionally ticked and labeled (+20°).
- PLATE FURNITURE: plate captions in small caps ("Planche IV — Le Campement"); hairline rules 1px moonlight at 12–18%; the horizon as a silhouette band one step darker than the plate (#0A0F1E register) closing a scene's bottom edge.

## Color physics
- GROUND: the indigo plate register #101830/#0D1428 — two plates alternate 4–8 RGB points apart; the alternation is the section rhythm. The showpiece and one deep band may reach the zenith register #0A1020/#090E1C. The page never turns grey, brown or black.
- INK: moonlight, the #E9EDF7 register — never pure #FFFFFF (pure white is a lamp, not a star). Muted prose at 65–75% opacity.
- STARLIGHT ACCENT: the #A9C6FF register. Budget: named stars and rings, constellation hairlines, links, the primary CTA, one accent word per major headline, focus rings. Starlight never fills an area larger than a button — it is light, not paint.
- FAINT VIOLET SUPPORT: the #6E7BB0 register — orbit dashes, secondary captions, diagram ticks, muted metadata. Never headlines, never body prose.
- HORIZON/SILHOUETTE: the #0A0F1E/#080D19 register for landforms against the sky.
FIXED TOKEN MAP — GROUND→--background · INK→--foreground · STARLIGHT→--primary · GROUND→--primary-foreground · deeper plate→--secondary · FAINT VIOLET→--accent · moonlight at 70%→--muted · moonlight at 15%→--border · 3px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling plate, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
- GRADIENTS exist ONLY as the sky itself: a vertical deepening across a full section (≤10 RGB points) or ONE dawn/dusk horizon band (indigo paling toward #232A4A at a scene's bottom 15%). Never radial, never behind type, never as decoration.
- One shooting star (le passage) may cross once per page: a 1px 60–120px line with a linear-gradient tail — the only moving gradient allowed.

## Typography system
- DISPLAY: Spectral (300–500 — light weights at large sizes, its airiness IS the register) or EB Garamond (400–500), one per site. Hero statement clamp(2.6rem,6.5vw,5.6rem), line-height 1.08–1.2, weight 300–400 — large AND light: the display floats, it never shouts. Section titles clamp(1.8rem,3.6vw,3.1rem), weight 400–500.
- ITALIC is the observer's voice: one poetic aside per section maximum, in the display's true italic. Never navigation, never labels.
- BODY: Karla 300–500; 1–1.0625rem, line-height 1.65–1.8, measure ≤68ch; muted at 65–75% moonlight for long prose.
- SMALL CAPS (the captions, owned): the display serif with font-variant-caps: all-small-caps, 11–13px, tracked +0.06–0.1em. The caption organ ONLY — never buttons, never paragraphs. Greek Bayer designations are EXEMPT: wrap the letter (α, β, γ, δ, ε, ζ) in a span/tspan with font-variant-caps: normal — small-caps that turn β Aql into B AQL name a different star, and this observatory measures.
- NUMERALS: data numerals (hours, prices) in Karla 400–500 with font-variant-numeric: tabular-nums in tables and the ephemeris; STATEMENT numerals (312 nuits claires) in the display at weight 300, clamp(3rem,8vw,6.5rem), units in small caps beside or beneath.
- Hierarchy is scale and light, never weight: the boldest weight on the page is 500 (display) / 600 (Karla, labels only). No 700 anywhere.
- Arabic pairing rule: display duties go to Amiri (400/700 — this sky was first charted in Arabic and Amiri carries that lineage), body to Noto Naskh Arabic (400/600); constellations, orbits and captions survive translation unchanged; small caps duties pass to tracked Amiri at reduced size.

## Signature art / components (the drawn sky — the craft that carries the world)
HOW TO DRAW A SKY (the craft law):
- STARFIELD: author every star as an explicit circle in the SVG (hand-varied cx/cy — clustered then sparse, like a real field; never a grid, never a script scatter). 40–90 per sky, sizes 1–2.5px, opacity 0.2–0.7; keep a quiet zone behind text blocks.
- NAMED STAR: 4–5px filled starlight circle + 1px moonlight ring at radius 7–9px + its small-caps label with real data. 1–3 per sky maximum; the rest stay anonymous.
- CONSTELLATION FIGURE: 3–7 content stars joined by straight 1px hairlines (never curves — the sky is charted with a straightedge); segments 60–260px; the figure's name in small caps at its centroid or brightest star.
- ORBITAL DIAGRAM: an ellipse path (a path, not the ellipse element — the body needs getPointAtLength), 1px violet, dash 1 6; focus marked by a 2px cross-tick or the framed content; apside ticks 4px with captions; the body 5–7px starlight.
- THE MOON: two overlapping circles produce the phase — disc in moonlight at 85%, shadow disc in the plate color carving the terminator. Phases as 12–20px glyphs may serve as list bullets (drawn, never emoji).
- HORIZON: a silhouette band (#0A0F1E register) with a hand-wavered top edge — dunes as overlapping arcs, a ridgeline, rooftops, or a bare line; one warm ember of a camp light (2–3px, #C9A063 at 80%) is the only warm pixel per scene.
- STAR TRAILS: concentric 1px arc fragments (20–60° each) around a pole star, opacity 15–35% — rotation drawn as an exposure, captioned (pose 45 min). Arcs of MOTION, never closed rings (closed decorative rings are AN2000's chrome).
- Every drawn sky carries role="img" and a real aria-label in the page's language.
COMPONENTS:
- BUTTONS: primary = starlight fill #A9C6FF, plate-indigo text, radius var(--radius) (the 3px chamfer — buttons and fields consume var(--radius) directly), padding 0.85em 1.6em, weight 500; hover/focus deepens to the #93B4F5 register and lifts 1px. Secondary = 1px moonlight-40% outline, moonlight text; on hover the outline turns starlight and a 4px star-tick appears at the left edge. No pills, no shadows, no glows.
- CARDS (la fiche d'observation): one plate step deeper than the section, 1px moonlight-15% border, radius 4px, a small-caps header carrying the plate number and a value (Planche II · 3 nuits), facts as rows separated by 1px moonlight-10% hairlines, the price as a statement numeral with DA in small caps. Hover/focus-within: border brightens to starlight-50%, the header star's ring pulses once; 250ms; keyboard and touch parity always.
- FORMS (le registre des nuits): fields on the deeper plate, 1px moonlight-25% border, radius var(--radius), labels in small caps above; phone-first (tel input leads, autocomplete on); a select for the structured choice (formule, période). Focus: 1px starlight border + 2px starlight outline at 3px offset. Success is honest and consigned: "Observation consignée. On vous rappelle avant la nuit prochaine." in an aria-live polite region while one new star inks into a small sky fragment beside the form. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, formule, periode, message }); include one off-canvas decoy input carrying data-wandit-hp that the page's own script never reads, writes or references.
- ::selection: plate-indigo text on starlight. :focus-visible: 2px starlight outline, offset 3px. Favicon: inline SVG data URI — a four-point star in starlight with its 1px ring on the indigo plate.

## Page chassis
- Vertical rhythm: section padding clamp(5rem,12vh,9rem) — the sky needs vastness; the deep band may compress to clamp(4rem,9vh,7rem). Content column 1100–1240px; sky scenes bleed full-width.
- HEADER: wordmark in the display serif with a 4-point star glyph + 3–4 links (Karla 500, 0.9375rem) + one secondary-outline CTA. Transparent over the hero's sky, 1px moonlight-12% bottom hairline after scroll. No blur, no glass.
- FIXED OPENING (hero law): the first viewport must contain a real hand-placed starfield, at least ONE named star with its caption, a headline with at most one starlight accent word, and one hairline element (a constellation fragment or orbit arc) that visibly leads below the fold. NEVER a centered title–subtitle–CTA stack on an empty dark ground. Allowed compositions: la lunette, le zénith, la première étoile (gestes), la conjonction, les trois lunes (variations).
- FIXED CLOSING: le registre des nuits (spec above) beside the practical facts (address, phone, season, access as hairline rows with tabular numerals); then the footer as LA DERNIÈRE OBSERVATION: the horizon silhouette closes the page, the wordmark at clamp(2.2rem,6vw,4.5rem) above it, one final caption giving the place's REAL coordinates in small caps (30° 55′ N · 2° 02′ O — Taghit register), small print 12px at 55% moonlight.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: la carte du ciel (the pinned showpiece) · les fiches d'observation (offer cards, offset columns) · l'orbite (an orbital diagram framing one center) · l'éphéméride (the night hour by hour) · le lever de lune (the one zenith-deep band) · la magnitude (statement numerals row).

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs; CDN dead → a complete, fully-charted sky)
THE LAW: hidden states exist only via gsap.set — never in CSS. Gate every animation on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). The markup always contains the FINISHED chart — constellations connected, labels placed, bodies resting; JS winds it back, then charts it again.
- PERSONALITY: STELLAR DRIFT + CONSTELLATION CONNECT. Two speeds exist: the GEOLOGIC (loops — orbital bodies 24–48s linear, twinkle 3–6s sine at ±0.25 opacity on 6–10 stars, trail arcs 120–240s linear) and the OBSERVED (entrances — slow fades with 12–20px rises, 1–1.2s, power1.out, staggers 120–180ms). Nothing between: no mid-tempo bounces, no snappy reveals. Entrance sequences OVERLAP, never queue: type begins rising ≤0.3s after its trigger while the starfield is still resolving (per-star field staggers ≤8ms), and a hero or chart is fully charted — labels inked — within 3–4.5s. A viewport left empty while beats wait in line is a failure.
- CONSTELLATION CONNECT: hairlines draw dot-to-dot via strokeDashoffset, sequentially — one segment completes before the next begins (0.3–0.5s each in entrance timelines; arc-length fractions in scrubs); the reached star's ring scales 0.6→1 as the line arrives; the label fades in last.
- THE SHOWPIECE (exactly one per page, scrubbed): LA CARTE DU CIEL — a full-bleed sky pinned 250–320vh, scrub 1. Beats: the starfield resolves first (staggered opacity); then each constellation connects dot-to-dot in sequence; as each figure completes, its label inks in and the content it names reveals in a fiche panel. Desktop ≥900px: pin + scrub. Below 900px: no pin — each constellation connects as it enters view, fiches stacked beneath the sky.
- Orbital bodies travel their ellipse via getPointAtLength on a 0→1 progress tween, ease none, repeat -1 — a body that eases is a fake.
- LE PASSAGE: at most ONE shooting star per page — a 1px line crossing 200–400px of sky in 0.7–0.9s, linear, triggered once, never looped.
- HOVERS: named stars pulse their ring once (scale 1→1.5, fade, 0.6s); links underline with a 1px starlight hairline sliding in 250ms; cards brighten borders. All 200–300ms, keyboard and touch parity always.
- REDUCED MOTION: the page is the finished atlas — every constellation connected, bodies resting at their apogee ticks, the moon risen. A composed plate, not a blank.

## Ban list (the global ban list applies; in addition)
1. Neon-tube glow, multi-layer text-shadow, electric beams, glowing-border glass panels, backdrop-blur — VOLTAGE's electricity. One blurred bloom collapses this world.
2. Chrome orbit rings, lens-flare sparkles, glossy orbs, metallic bevels — AN2000's gloss. These orbits are dashed, labeled with periods, and carry a moving body: science, never decoration.
3. Land cartography — contour grounds, passport stamps, dotted travel routes with traveling markers, compass roses — ATLAS's territory. These lines connect stars, never draw a journey across land.
4. Runtime-generative starfields (Canvas2D/shader scatter) and machine-telemetry voice (SYS.STATUS, FILE 001) — CINÉTIQUE's language. Every star has authored coordinates; captions are astronomy attached to content, never interface telemetry.
5. Gold-on-black, self-drawing gold engravings, filigree, gilded edges — ORFÈVRE's maison. No gold in this palette; the one warm ember pixel is a camp light.
6. Photography of any kind — letterboxed 21:9 crops, Ken-Burns scrubs, champagne foil small-caps — GÉNÉRIQUE's cinema. Even the moon is drawn.
7. Prompt lines, typed-text reveals, scanlines, ASCII frames — PHOSPHORE's terminal.
8. The centered plumb line between sections, floating micro-caps without data, centered roman-numeral markers — ÉCRIN's void. This world's captions carry values; its timeline is dotted, off-center, labeled with hours.
9. Astrology: zodiac fortune content, horoscope voice, destiny copy. The register stays observational.
10. Purple-to-blue nebula washes, galaxy images, aurora gradients — the default "space" kit. The sky is flat indigo plates.
11. Radial-gradient atmospheres, glowing moon auras, sun flares. The moon has a flat terminator; light is drawn.
12. Emoji stars, moons, sparkles — every glyph is drawn SVG.
13. Dark-SaaS furniture: gradient borders, glass cards, dot-grid heroes, spotlight cursors.
14. Bounce, overshoot, elastic — the sky drifts and connects; it never springs. No entrance faster than 0.5s except the ring pulse and le passage.
15. Pure #FFFFFF text or #000000 grounds; starlight filling areas larger than a button.

## LES GESTES (moves menu)
1. LA LUNETTE — hero split: headline column 50–55% (title with one starlight word, an italic observer's line, CTA, one caption) beside a drawn sky panel where a named star carries its full caption; a constellation fragment departs the panel toward section 2. On load: sky resolves, then type rises, the star's ring last.
2. LE ZÉNITH — hero variant: the first viewport IS the sky, full-bleed; the client's name sits among the stars as the field's brightest label; the horizon silhouette closes the bottom edge; one graticule arc leads below the fold.
3. LA PREMIÈRE ÉTOILE — hero variant: a nearly empty plate, ONE named star high off-axis with its caption, the headline low on the opposite side; the starfield resolves progressively down the page.
4. LA CARTE DU CIEL — the pinned showpiece (spec in Motion identity): the field resolves, figures connect dot-to-dot, each completed constellation names one piece of content. The page's held breath.
5. L'ORBITE — an orbital diagram framing one center: the price, instrument or promise at the focus; 3–5 satellites sit ON the ellipse as labeled content stars; the body loops 24–48s; apside ticks carry honest values.
6. L'ÉPHÉMÉRIDE — the night hour by hour: an off-center vertical dotted line (1px violet, dash 1 6) carrying 5–7 timed events (19 h 42 — coucher du soleil · 23 h 00 — Saturne au télescope), tabular numerals, rows alternating sides, each tick inking in as it enters.
7. LE LEVER DE LUNE — the zenith-deep band: the moon (flat terminator) rises 40–80px on entrance over a horizon silhouette; one display line of night truth; 2–4 stats as captions. The page's darkest plate.
8. LA MAGNITUDE — statement numerals: 2–4 facts at clamp(3rem,8vw,6.5rem) weight 300, units in small caps (312 nuits claires · classe 1 Bortle), separated by 1px hairlines, rising 150ms apart.
9. LE FILÉ D'ÉTOILES — star-trail arcs rotating imperceptibly (120–240s linear) around a pole star that anchors one composition; captioned as an exposure. At most once per page.
10. LA CONSTELLATION INVENTÉE — the client's own figure: their values or offers become stars (α, β, γ of their name), charted as a NEW constellation with a legend row explaining each star. Their business, written into the sky.
11. LE PASSAGE — the micro-event: one shooting star crosses one section once (spec in Motion identity). Never repeated, never looped — rarity is the point.
12. LE REGISTRE DES NUITS — the closing form as the observatory's logbook (spec in Signature art): small-caps labels, tabular hours, the consigned success state inking one new star.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. CAMP ALTAÏR — camping/glamping, Taghit. Sky concept: three real constellations for three nights. Hero: la lunette — headline left, sky panel right where Altaïr carries its caption (mag. 0,76 · Décl. +8° 52′). Showpiece: la carte du ciel — l'Aigle, le Scorpion and la Lyre connect in sequence, each labeling one night of the programme. Mood: silence saharien, thé et étoiles.
2. HÔTEL LA COUPOLE — hotel, Chréa. Sky concept: one whole night, dusk to dawn. Hero: le zénith — a full-bleed mountain sky, the hotel's name as the brightest label, the cedar ridgeline as horizon. Showpiece: la grande nuit — the ephemeris scrubbed: the plate deepens from dusk to zenith then pales toward the drawn dawn band while timed events ink along the dotted hour line. Mood: altitude, ciel proche.
3. L'ANNÉE LUMIÈRE — psychologue, Alger. Sky concept: one star, then a sky. Hero: la première étoile — an almost empty plate, one named star high right, the promise low left ("On commence par une seule étoile."). Showpiece: l'orbite as the page's center — the therapeutic year as an ellipse, périgée and apogée labeled as the hard and light seasons, four session formats sitting on the path as labeled stars. Mood: calme clinique, nuit apprivoisée.
4. VÉGA JOAILLERIE — jewelry brand, Oran. Sky concept: the necklace is a constellation. Hero: the signature piece drawn as a constellation ACROSS the first viewport — each diamond a content star, the chain the hairline, the clasp the named star (Véga · mag. 0,03). Showpiece: le filé d'étoiles — trails rotate around the maison's pole star on scrub; at three arc-ends a piece's fiche resolves. Mood: nuit précieuse, lumière comptée.
5. ORBITE STUDIO — yoga/pilates, Constantine. Sky concept: the lunar month. Hero: les phases — a row of eight drawn moon phases crowns the viewport above the headline ("La lune fait le programme."). Showpiece: le lever de lune scrubbed — the moon rises through the deep band, its terminator advancing phase by phase, each phase labeling a class intensity. Mood: souffle, marées intérieures.
6. NUIT ZÉRO — startup pre-launch, Alger. Sky concept: the conjunction. Hero: la conjonction — two dotted orbits cross the first viewport, their bodies converging on one labeled point (conjonction — 21 mars, the launch), the waitlist field beneath. Showpiece: la constellation inventée — five capabilities charted dot-to-dot on scrub as a NEW figure, the last segment completing the product's glyph. Mood: veille de découverte.
7. LES NUITS DU SOLSTICE — event planner, Béjaïa. Sky concept: three evenings, three moons. Hero: les trois lunes — the venue's silhouette runs the bottom edge, three moons at different phases above it, one per soirée, each captioned with its date. Showpiece: la voûte — the dome's graticule arcs draw over the silhouette on scrub; along each arc one evening's programme rises with its hour ticks. Mood: solstice, foule chuchotante.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the CONSTELLATIONS MUST NAME CONTENT (a sky that merely decorates is a dark template — the dots are offers, nights, values, and the reader watches the page's argument get charted), the CAPTION DISCIPLINE (every caption carries a real value in real astronomical French — one "ciel magique" and the observatory becomes a mood board), and the RESTRAINT OF LIGHT (the 1px halo law held everywhere — one glowing blur and this becomes a neon poster that belongs to another world). The cheap details that separate it from a generated page: the Arabic etymologies honored in the copy, the moon's flat two-circle terminator, tabular numerals aligning the ephemeris, the real place's coordinates in the footer, the one warm ember of a camp light against all that indigo, "Observation consignée" on the form's success. When in doubt, add a measured value, not a decoration — precision is this world's warmth.`,
	energy: "quiet",
	family: "celestial",
	fusesWith: ["atlas", "generique"],
	id: "observatoire",
	industries: [
		"camping / glamping",
		"hotel",
		"tours & excursions",
		"vacation packages",
		"travel agency",
		"fine dining",
		"psychology / therapy",
		"yoga / pilates studio",
		"jewelry brand",
		"startup (pre-launch / waitlist)",
		"event planner",
		"venue / salle des fêtes",
	],
	kind: "website",
	mood: ["hushed", "precise", "wondrous", "nocturnal", "vast"],
	name: "Observatoire",
	preview: {
		accent: "#A9C6FF",
		fontFamily: "Spectral",
		ground: "#101830",
		ink: "#E9EDF7",
		sampleWord: "Le Ciel",
	},
	priceFeel: "premium",
	tagline:
		"Le ciel nocturne cartographié : constellations reliées, orbites pointillées, précision émerveillée.",
};
