import type { DesignWorld } from "../types";

/**
 * PHOTOGRAPHE — the dark film portfolio.
 * Popular wave: the photographer's site everyone has seen (near-black gallery,
 * masonry grid, film furniture, EXIF captions) built with real editing
 * discipline. Values measured on the shipped demo (Yacine R., Alger).
 * fusesWith rationale: silhouette (the same dark editorial air, but she is B/W
 * fashion and type-over-photo — we stay colour and never collide type with
 * image), studio (the creative-portfolio neighbour: her index rows, our film
 * furniture), voeu (weddings shot on film — her script and paper meet our
 * frame numbers).
 */
export const photographe: DesignWorld = {
	id: "photographe",
	name: "Photographe",
	family: "photo-portfolio",
	tagline:
		"Galerie noire, planches contact, chips EXIF : le portfolio argentique.",
	kind: "website",
	mood: ["dark", "filmic", "documentary", "precise", "unsentimental"],
	energy: "medium",
	priceFeel: "premium",
	industries: [
		"photographer",
		"photographer (events)",
		"videographer / production",
		"freelancer portfolio",
		"artist / illustrator",
		"architecture portfolio",
		"music / band",
		"writer / journalist",
		"design studio",
	],
	avoidFor: [
		"medical",
		"dentist",
		"aesthetic clinic",
		"general practitioner / cabinet",
		"lawyer / law firm",
		"notary",
		"accountant",
		"financial advisor",
		"insurance agency",
		"fintech product",
		"kindergarten / crèche",
	],
	fusesWith: ["silhouette", "studio", "voeu"],
	preview: {
		ground: "#101010",
		ink: "#ECECEA",
		accent: "#9A9A9A",
		fontFamily: "Syne",
		sampleWord: "ƒ/2.8",
	},
	doc: `# DESIGN WORLD: PHOTOGRAPHE — the dark film portfolio

## Philosophy
This page is a LIGHT TABLE in a dark room, not a website. The screen is near-black so the photographs are the only colour; everything else — type, rules, plates, sprockets — is grey or paper-white, never a brand hue. First: THE PHOTOS ARE THE PALETTE. Choose the images first; the page is the furniture that carries them. Second: FILM FURNITURE IS THE ORNAMENT. Sprocketed strips, frame numbers (21 · 21A · 22), EXIF chips, grease marks, roll metadata — the objects a working photographer touches, drawn in CSS, never clip-art icons. Third: EDITING IS THE ARGUMENT. A roll gives thirty-six frames and the photographer prints three; the page must show that arithmetic, because the discipline is the product. Two failure modes become impossible: the slideshow (no carousel, no lightbox, no autoplay) and the mood board (nothing floats unlabelled). Self-audit before shipping, all countable: (1) exactly three non-photographic values — ground, ink, grey — plus their two hairline dilutions, no fourth hue; (2) sprockets inside the first viewport at 390 AND at 1440; (3) every photograph carries a permanent number or caption AND a focusable EXIF chip; (4) zero corner radius above 2px, media included; (5) exactly ONE scrubbed scene; (6) zero entrance tweens; (7) the kept-frames count is ONE number — circles = margin = lead.

## The variation contract (why two PHOTOGRAPHE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Near-black ground, paper-white ink, one grey; the photographs supply all colour. No duotone, no monochrome conversion, no colour overlay.
- Film furniture as the ornament system: sprocket edges, frame numbers, EXIF chips, roll metadata. At least two of the three owned tics per page.
- Square geometry: radius 0–2px on frames, plates, buttons, fields. No rounded photo masks.
- The shutter-cut motion identity: entrances are one-frame cuts, the scrubbed drift is the only continuous motion, the EXIF chip is the only eased transition.
- One CSS grade law on every image: all photos sit in one bath.
- Type never sits on top of a photograph — beside it, under it, or on the film base.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The exact ground inside the near-black register (#101010 / #0E0E0E / #121110) and the paper white inside the ink register (#ECECEA / #F1F0EC / #E7E7E4).
- The display face (Syne or Golos Text) and the mono (Space Mono or Martian Mono).
- THE ROLL — the driving concept: a named body of work (la Casbah, le littoral, les noces, le labo, la nuit). It decides the images, the section titles, the frame numbering and the voice.
- The hero composition, the showpiece choreography, the middle section order, whether the page carries paper print plates (the shop) or none (the pure portfolio).
A PHOTOGRAPHE page with no named roll is a stock gallery: name it FIRST, then let it choose the frames.

## The vibe (voice)
Plain French, technical, never lyrical about itself. The photographer explains method, not feelings: what film, what light, how many frames kept. Numbers are specific — "trente-six vues par bobine, aucune rafale", "j'en tire trois", "3 sur 36". One line of working humility ("De dos, à distance, sans direction."). No "capturer l'instant magique", no exclamation marks, no superlatives. Section titles are short declaratives with a full stop: "Ce qu'on garde, ce qu'on jette." · "Le mur de tirages."

## Visual signatures (measured)
- **TIC ① CONTACT-SHEET STRIPS.** A film-base band (#0B0B0B) with sprocket holes along both edges: a 26×16px repeating tile carrying a 16×9px rounded rect (rx 2.5) in #282826, repeat-x, bands flush top and bottom at 16px, base padding-block 21px. Frames are 3:2, width clamp(126px,14.4vw,196px), separated by 5px of bare base; each carries its number as a .6rem mono plate in the base corner. The rail scrolls horizontally (overflow-x:auto, scrollbars hidden) and is CUT by the viewport edge — a roll always continues off-frame. Vertical variant: a 16×26px tile with a 9×16px hole, sprockets on both flanks, three square frames stacked inside.
- **TIC ② EXIF CHIPS.** Every photograph's metadata as a mono plate: \`ƒ/2.8 · 1/250 · ISO 400 · 35 mm\`, .62rem, tracking .07em, ink on rgba(11,11,11,.86) with a 1px rgba(236,236,234,.22) border, 5px 9px padding, bottom-left inside the frame at 10px inset. On pointer devices it rests at opacity 0 / translateX(-10px) and slides in over 0.18s cubic-bezier(.2,.7,.2,1) on hover or focus — the page's ONLY eased transition; where there is no hover it is permanently visible. The values must be plausible for the picture: fast shutter for the sea, 1/60 at ƒ/1.4 for the café interior.
- **TIC ③ MASONRY DRIFT.** Three gallery columns inside a fixed clipped window travelling at different speeds as you scroll — the page's one scrubbed scene. Spec in Motion identity.
- **The grease-pencil mark.** Kept frames are circled by a hand-drawn SVG **path**, never a rect: a wobbling loop in a 100×66 viewBox (\`preserveAspectRatio="none"\`) whose start and end overshoot each other where the crayon closes, straddling the frame edge from \`inset:-6px\`, rotated .6–.9° and mirrored (\`scaleX(-1)\` / \`scaleY(-1)\`) per instance so no two marks repeat. Stroke ink 4px \`vector-effect:non-scaling-stroke\`, round caps, 72% opacity, plus an ink-on-ground tag ("À TIRER", .5rem, .12em) at the frame's top-right. A clean rectangle reads as a mat, not a crayon. Never more than three per sheet, and exactly as many as the margin counts.
- **Paper plates.** The only light surfaces are prints: a photo inside a paper margin (background ink, padding 9px 9px 0), format, edition and price printed on the paper in ground-coloured type. Nothing else may be white.
- **Hairlines.** rgba(236,236,234,.14) for rules, rgba(236,236,234,.30) for a button or field frame. Panels sit at #161616 on #101010 — a 6-point step, felt but never announced.
- **Section feet.** A hairline, two mono facts and one link ("TROIS SÉRIES OUVERTES · 478 VUES TIRÉES DEPUIS 2019" / "DEMANDER UNE SÉRIE COMPLÈTE →") close a section instead of leaving air. A section ending on a full-bleed showpiece gets no foot: its facts move UP into the head as a third mono column on a hairline, bottom-aligned with the h2.

## Color physics
FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · GROUND→--primary-foreground · PANEL→--secondary · FILM BASE→--accent · ink at 75%→--muted · ink at 14%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.
- GROUND: the near-black neutral register — #101010 / #0E0E0E / #121110. Neutral is law: no blue-black, no warm charcoal — any cast tints the photographs by contrast.
- PANEL: ground +6 points (#161616 register) for alternating sections. Rhythm is ground → panel → ground; never two panels in a row.
- FILM BASE: ground −5 points (#0B0B0B register), reserved for strips, sheets and the footer leader. The darkest value on the page; it always means "film".
- INK: paper white, the #ECECEA / #F1F0EC register. Body prose runs at #B4B4B0 so headlines stay the brightest text.
- ACCENT: GREY #9A9A9A — and grey is the whole budget: kickers, mono meta, captions, one word of a headline at most. There is no third colour. A client who wants "their blue" gets it in the photographs (a boat, a shutter, a wall) or not at all.
- GRADIENTS: none, anywhere. The only tonal transitions are inside the photographs.
- The 3% grain is localised to photographs; the ground stays flat. Full-page plaster grain is MATIÈRE's.

## Typography system
- DISPLAY: **Syne** 700/800 (ALT **Golos Text** 700/800 for a quieter voice). Sizes: h1 clamp(2.5rem,5.2vw,4.5rem), h2 clamp(2rem,3.9vw,3.5rem), h3 clamp(1.16rem,1.55vw,1.5rem); line-height 1.02–1.04; letter-spacing −.028em (−.045em on the footer wordmark). Display never runs past 10vw and never sits over a photograph. NEVER italic — emphasis is the grey, or nothing.
- BODY: **Sofia Sans** 400/500 (ALT **Rethink Sans**), clamp(1rem,.94rem + .28vw,1.12rem)/1.62, measure 46–56ch, colour #B4B4B0. The lead paragraph runs clamp(1.06rem,.98rem + .42vw,1.26rem) at full ink, max 46ch.
- MONO / EXIF: **Space Mono** 400/700 (ALT **Martian Mono**). It owns everything a machine would print: kickers (clamp(.62rem,.72vw,.7rem), tracking .16em, uppercase, grey), EXIF chips (.62rem, .07em), frame numbers (.6rem, .12em), captions (.66rem, .05em), roll metadata, prices' units, buttons (.68rem, .14em, uppercase) and form labels (.6rem, .13em). Mono NEVER sets prose longer than a line and never runs above 1rem.
- Section indices are mono, inline in the head ("03 — PLANCHE CONTACT"), never a rail that fills as you scroll (CAPITALE's spine).
- Numerals: prices and formats take the display face (48 000 DZD, 60 × 90 cm); apertures and shutter speeds are always mono with the ƒ glyph and the fraction (ƒ/2.8 · 1/250).
- Arabic pairing: Syne and Space Mono carry no Arabic. Display becomes **Noto Kufi Arabic** 700, body **IBM Plex Sans Arabic** 400/500; mirror the grid for RTL but keep frame numbers and EXIF values LTR inside their plates.

## Signature art — the photography law and the components
- **Art direction (one phrase, reused in every image brief):** "35mm film aesthetic photography, natural light, city streets and quiet moments, subtle grain, muted colour, no identifiable close faces, no text." Colour negative film — this world is COLOUR (B/W fashion is SILHOUETTE's). Every emulsion the page NAMES must be colour (Portra 400, Ektar 100, Gold 200, Superia 400, Cinestill 400D) — never HP5 or Tri-X in the stock rule or the equipment list. Faces turned away, in profile or out of focus: the subject is light, not personality.
- **The grade (law, applied to every \`img\`):** \`filter: contrast(1.04) saturate(.92)\` and a grain overlay on the frame's \`::after\` — an inline feTurbulence SVG (baseFrequency .86, 2 octaves) tiled at 160px, \`opacity:.03\`, \`mix-blend-mode:overlay\`, \`pointer-events:none\`. The grain is INSIDE photographs only. On hover/focus the grade CUTS brighter — \`contrast(1.1) saturate(1) brightness(1.08)\`, \`transition:none\` — like a print stepping under a stronger lamp.
- **Masks:** rectangles only, radius 0–2px, ratios from the camera: 3:2 for strips and sheets, 4:5 and 3:4 for portraits, 5:4 and 16:10 for landscapes, 1:1 for the vertical strip. No deep-rounded masks (ECLAT's), no 21:9 letterbox (GÉNÉRIQUE's).
- **Caption law:** under a photograph, one mono rule: place-in-ink and date-in-grey as ONE left group ("**Fenêtre, Bab El Oued** — mars 2024"), the roll pushed far right ("Bobine 041"); never a third cell floating between them. Inside a photograph only two things are permitted: the frame number plate and the EXIF chip.
- **Buttons:** square (they consume min(var(--radius), 0px) — this world's corners stay cut), 14px 22px, mono .68rem/.14em uppercase, \`transition:none\`. Primary is filled ink with ground text, INVERTING to outline on hover/focus; ghost is a hairline that fills ink on hover/focus. The inversion is instant — a shutter, not a dimmer.
- **Forms (the fixed closing):** fields on the panel are \`background:#101010\`, 1px hairline, 13px 14px padding, radius 0, no transition; focus swaps the border to full ink in one frame. Labels are mono uppercase above the field. Phone-first: a \`tel\` input with \`inputmode="tel"\` in the first row, a \`select\` for the shoot type, one open field asking the real question ("Ce que vous voulez garder"). On valid submit, dispatch the \`wandit:lead\` CustomEvent on \`document\` with the visitor's fields flat in \`detail\`; include one off-canvas decoy input carrying \`data-wandit-hp\` the page's own script never touches. The success state is CUT in: fields removed, a hairline-framed plate stating the real next step ("Je réponds sous 24 h").
- **Cards:** no shadowed cards. A "card" is a frame in a strip, a photograph with a caption rule under it, or a paper plate. Nothing floats.

## Page chassis
- Container 1360px, gutter clamp(20px,4.4vw,56px), section rhythm clamp(4.6rem,9.2vh,7.4rem) — tightened to clamp(3.2rem,6.4vh,5rem) on both sides of a ground→panel junction, so no dead band opens at a section boundary. Full-bleed elements (strips, the drift window) align their inner padding to the container edge with \`max(var(--gut), calc((100% - 1360px)/2 + var(--gut)))\`.
- HEADER: sticky, solid ground (never translucent or blurred), min-height 66px (58px under 560px): wordmark in display + a mono descriptor ("photographe · Alger"), mono nav, a mono tel plate that inverts on hover. Its bottom hairline appears as a class toggle after 70px of scroll — a cut, not a fade. Under 820px the inline nav is REPLACED, never merely hidden: a second mono row in the same sticky header, five .58rem links spread edge to edge on a hairline, \`scroll-margin-top\` raised to 112px. A phone that reaches a section only by scrolling the whole page has failed.
- FIXED OPENING — the hero law: the first viewport must contain (a) the claim in display type, (b) ONE photograph presented as an object with its number and caption, (c) film furniture — a strip, a sheet or a vertical band. Claim and photograph never overlap. The composition varies (see LES GESTES); those three ingredients are law and must ALL sit inside the 390×844 fold: under 900px the photograph moves onto film base (#0B0B0B, padding 14/20/12px, vertical sprocket bands on both flanks) and the stock rule holds ONE line. A hero with no film furniture is a generic dark portfolio.
- FIXED CLOSING: the contact section on the panel — a mono facts column (atelier, téléphone, courriel, délai, déplacements) beside the form — then the footer: a 44px film-leader band with sprockets on both edges, the wordmark at clamp(2rem,6.2vw,5rem), the roll's closing line ("Fin de pellicule · Alger, 2025") in mono at the right.
- FREE MIDDLE — compose 4–6, never two adjacent alike: **la planche contact** (8–12 frames, grease marks, the metadata margin lifted level with the head so the sheet runs the container's full width) · **les séries** (2–4 photographs at staggered vertical offsets, a title/period rule and two lines of prose each) · **le mur** (the drift showpiece, closing its section flush) · **à propos** (a tall photograph beside the method text, closed by a mono equipment list in two columns) · **le témoignage** (one static client quote in display 600 at clamp(1.5rem,3.3vw,2.7rem), max 26ch, a vertical film strip beside it — never a carousel) · **les tirages** (paper plates, bottom-aligned at unequal widths 1.42fr / 1.1fr / 1fr, prices in DZD) · **la bande** (a strip as a divider).
- Vertical offsets are how this world breathes: series cards sit at 0 / clamp(24px,5vw,64px) / clamp(10px,2.4vw,30px); print plates align on their BOTTOM edge so their tops make a staircase. Never a row of equal boxes.

## Motion identity — SHUTTER CUT
GOVERNING LAW: every hidden state is set in JS via \`gsap.set\`, never in CSS; the whole block is gated on \`(window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches)\`. With the CDN dead the page is complete, lit and readable.
- **Entrances are CUTS, not tweens.** Hide a group with \`gsap.set(items,{opacity:0})\`, then reveal it with a timeline of \`.set()\` calls spaced 0.045s apart — frames landing one after another on a light table. No y-offset, no scale, no fade; each reveal lasts one frame. Groups fire on \`ScrollTrigger\` at \`start:"top 84%"\`, \`once:true\`; hero and strip fire on load at 0.12s and 0.40s.
- **The one continuous motion — MASONRY DRIFT (showpiece).** A window of height clamp(560px,102vh,1000px) (min(66vh,560px) under 760px) with \`overflow:clip\`, holding three columns (two under 760px, the third hidden) of 6 photographs each at alternating 3:4 and 3:2 ratios, gap clamp(10px,1.4vw,20px). Each column is taller than the window; the animation moves it INSIDE its own overflow so a gap is impossible at any width: measure \`slack = column.scrollHeight − window.clientHeight\`, then travel from −slack×0.08 to −slack×0.80 (column 1), −slack×0.72 to −slack×0.06 (column 2 — it climbs the other way), −slack×0.20 to −slack×0.98 (column 3), each capped at 520px of travel, \`ease:"none"\`, \`scrub:0.5\`, \`invalidateOnRefresh:true\`, trigger start "top bottom" end "bottom top". The result: three rolls sliding past each other on a light table. Never pin, never parallax the whole page.
- **Hover.** Everything cuts (grade, button inversion, link fill, header hairline) except the EXIF chip, which slides 10px and fades in over 0.18s. That single exception is the world's one soft gesture; spend it nowhere else. Every hover state has a \`:focus-visible\` twin, and every frame that reveals a chip carries \`tabindex="0"\` — strips, sheets, series, prints, the vertical band. ONE exemption: the drift columns, \`aria-hidden\` inside a \`role="img"\` window that carries the single real label — decoration inside a labelled image is not a tab stop.
- Easings allowed: none for entrances (cuts), \`none\` for the scrub, \`cubic-bezier(.2,.7,.2,1)\` for the chip. No overshoot, no bounce, no power-ease entrances.
- Reduced motion: skip the whole block. The columns render at their natural position, every frame visible, the composition complete — a still contact sheet, not a blank page.

## Ban list (in addition to the global list)
- SILHOUETTE's huge-type-over-photo collision, her crimson word and her black-and-white fashion law — photographe is COLOUR film and type never touches an image.
- GÉNÉRIQUE's 21:9 letterbox crops, Ken-Burns drifts and foil/gold ornament.
- STUDIO's index rows with the floating hover thumbnail, her lowercase wordmark with the trailing period, her meta ledger columns (année/rôle/portée).
- CINÉTIQUE's mix-blend-mode difference chrome, glyph-scramble links, rotated crossing marquee strips and corner registration ticks with plus marks.
- GAZETTE's halftone screens; CAPITALE's navy duotone plates and 01→05 index spine; ELAN's photo-through-type (background-clip:text); ECLAT's 28–48px deep-rounded warm masks; CATALOGUE's seamless-plinth product photography with its hard contact shadow and SKU captions; MATIÈRE's full-page plaster grain and arch geometry.
- Any colour that is not ground, ink or grey — no gold "premium" thread, no brand blue, no accent CTA.
- Duotones, monochrome conversions, colour overlays, vignettes or dimming scrims on photographs; the grade is the only treatment.
- Carousels, lightboxes, autoplay slideshows, hover zoom, watermarks scrawled across photographs.
- Rounded media (>2px), soft shadows, glass panels, floating unlabelled shapes.
- Fade-up entrances, staggered slide-ins, overshoot easings, any looping ambient animation.
- Italic anything; mono setting prose; display over 10vw; emoji or icon fonts.

## LES GESTES (moves menu)
- **LA BANDE** — a full-bleed contact-sheet strip at the spec above, a three-line mono label at the head of the rail, cut by the viewport edge. Under a hero, or as a divider.
- **LA PLANCHE** — the full contact sheet: 2–3 rows of four 3:2 frames, each row its own sprocketed strip, the sheet in a hairline box on film base; three frames circled in grease pencil with an "À TIRER" tag; the metadata margin beside the head, not the sheet.
- **LE MUR** — the drift window: three clipped columns at different speeds. One per page.
- **LE DIPTYQUE** — two frames of the same ratio side by side, a single 5px gutter, a vertical sprocket band between them; the caption belongs to the pair, not to each frame.
- **LA BANDE VERTICALE** — three square frames stacked on film base with sprockets on both flanks, clamp(140px,15vw,196px), a margin note beside a quote or a paragraph. Under 820px it rotates to a horizontal strip of three.
- **LA CHUTE DE PAPIER** — the paper print plate: photograph inside an ink-white margin, format and edition in mono, price in display, all in ground-coloured type on the paper. The page's only light object; two to four per page at three ratios (4:5, 1:1, 5:4) and three widths, bases on one line so their tops make a staircase. Their focus ring inverts to ground — ink on paper is invisible.
- **LE CADRE ÉPINGLÉ** — one photograph as an object: 4:5 or 3:4, number plate top-right, caption rule beneath split place / date / roll, the claim set BESIDE it in the dark.
- **LE PIED DE SECTION** — the mono foot: a hairline, two facts left, one link right that inverts to ink on hover. It ends a section instead of trailing off.
- **LA MARGE** — roll metadata as a dt/dd column: bobine, pellicule, développement, vues gardées, statut. Grey labels, ink values, no borders.
- **LE COMPTEUR** — frame numbering as furniture: 21 · 21A · 22 across a strip, 12 → 15A down a sheet, section indices as "03 —". Numbers must be plausible for a real roll.
- **LE GRADE AU SURVOL** — hover or focus a frame: the print steps brighter in one frame (contrast 1.1 / saturate 1 / brightness 1.08) while the chip slides in. The page's only pointer motion.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- **LA PLANCHE** (film portfolio, Alger — the reference build). Hero: a 1.12/0.88 split, the claim in three display lines with the last word in grey, a 4:5 portrait at right carrying its number, a full-bleed eight-frame strip pinned to the hero's bottom edge. Showpiece: the three-column drift, columns 1 and 3 descending, column 2 climbing against them. Mood: quiet, documentary, unsentimental.
- **CHAMBRE NOIRE** (development lab, Oran). Hero: no split — one landscape photograph full-bleed across the top 62vh with nothing on it; the claim, hours and CTA BELOW it on bare ground between two hairlines, frame numbers ticking down the left margin. Showpiece: le révélateur — a pinned 4:5 frame whose filter walks from \`brightness(.15) contrast(3) grayscale(1)\` to the world grade on scrub, its chip typing itself in steps. Mood: patient, chemical, technical.
- **DEUX SÉANCES** (portrait studio, Constantine). Hero: a diptych — two 3:4 frames with one vertical sprocket band between them, the studio name in mono in the left margin, the claim under the pair. Showpiece: la loupe — a rectangular magnifier travelling across a static six-row sheet on scrub; what falls under the glass sits at full grade with its EXIF on the loupe's rim, everything outside holds at 30% brightness. Only the window moves. Mood: methodical, human, close.
- **REPORTAGE 24×36** (photojournalist, Béjaïa). Hero: the roll comes first — a twelve-frame strip across the very top, the claim left, a mono dateline right ("BÉJAÏA · 14.03 · 3 BOBINES"). Showpiece: l'avance du film — the strip steps sideways one whole frame at a time on scrub (snapped, never smooth), the counter climbing 01 → 36 while the centred frame is marked. Mood: urgent, factual, on assignment.
- **NOCES** (wedding photographer, Tlemcen). Hero: three modules bottom-aligned on one baseline — a vertical strip of three square frames, the claim, a 4:5 portrait — read left to right like a roll being loaded. Showpiece: le fil de séchage — prints pegged to one wire above the names; on scrub the slack tightens, the line rising ~90px while each print straightens from its own tilt to level. Mood: warm inside the dark, tender without one script letter.
- **ATELIER DE TIRAGE** (fine-art print shop, Alger). Hero: one large paper print plate off-centre on the near-black ground — the viewport's only light surface — the claim in the dark beside it, the edition line printed on the paper. Showpiece: le mur d'accrochage — a scrub racking a bottom-aligned row of plates from 30 × 40 to 60 × 90, each size cutting the price to its new DZD figure. Mood: material, expensive, hands-on.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world collapses into "a dark website". FIRST, THE EDIT: eight great frames beat twenty good ones, and the page must state its arithmetic (36 → 3). A gallery that dumps every image the client owns has failed, whatever the CSS does. SECOND, THE FILM FURNITURE: sprocket holes at the right pitch, frame numbers that could belong to a real roll, EXIF values that match their pictures — get a number wrong and a photographer sees it in two seconds. THIRD, THE CUT: no fades, no easing on entrances, so the single scrubbed drift reads as the deliberate exception it is. The cheap details that separate this from a generated dark portfolio: three grease circles ⇒ "3 sur 36" in the margin ⇒ "j'en tire trois" in the lead — one number said three times; "Bobine 041" pushed to the far right of a caption rule; the ƒ glyph typed properly; paper plates as the page's only white; the strip cut by the viewport edge so the roll obviously continues. When in doubt, remove a photograph and add a number.`,
};
