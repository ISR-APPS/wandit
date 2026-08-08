import type { DesignWorld } from "../types";

/**
 * CHANTIER — the worksite that carries its own weight.
 * Concrete grounds, bolted steel plates, stencil caps with spray edges,
 * hazard-stripe accents, heavy-drop motion. Honest muscle for trades that
 * build, fix, move and secure. Fuses with gabarit (plan meets site — one
 * construction brand, two registers) and bloc (the worksite opens a shop —
 * hardware, spare parts).
 */
export const chantier: DesignWorld = {
	avoidFor: [
		"aesthetic clinic",
		"wedding services",
		"patisserie / bakery",
		"yoga / pilates studio",
		"jewelry brand",
	],
	doc: `# DESIGN WORLD: CHANTIER — the worksite that carries its own weight

## Philosophy
This page is a WORKSITE, not a website. Every surface is a real material: raw concrete grounds, brushed steel plates fastened with visible corner bolts, paint pushed through a stencil, safety tape stretched across an edge. Its first structural fact: NOTHING FLOATS. Every element is bolted, stamped, stacked or dropped into place — weight is the design system, and gravity is the animation engine. Its second structural fact: the 45° hazard stripe (ink/amber) is the only diagonal that exists; everything else is plumb and level. Its third: zero photography, zero gloss — machines and structures are drawn as flat silhouettes, and the amber is safety paint, not gold. Impossible failure modes: an ethereal fade, a card hovering on a soft shadow, pastel timidity, luxury whisper, decorative blur. The page must feel LOAD-BEARING — trusted like a scaffold that doesn't wobble. Safety-amber warmth keeps it human: this is muscle with a handshake, never menace. Self-audit before shipping: (1) zero box-shadow with blur anywhere in the stylesheet; (2) every steel plate shows exactly 4 corner bolts; (3) 3–5 hazard bands on the page, never more; (4) every display title is stencil caps through the spray filter; (5) no element enters by floating UP — everything drops or stamps; (6) a verifiable number (year, m², count, insurance n°) readable in the first viewport.

## The variation contract (why two CHANTIER sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- Concrete double ground; bolted brushed-steel plates as the card system; 2px ink borders as the frame weight.
- Stencil caps + spray-edge filter on display titles; Oswald subheads; never italic anywhere.
- Hazard-stripe bands at 45°, ink/amber, budget 3–5 per page — the only diagonal on the page.
- Heavy-drop motion: fall, land, ONE dead rebound. Nothing floats, nothing glides up, nothing overshoots elastically.
- Exactly ONE ink slab interlude (le bitume) where text flips to concrete and amber does the counting.
- Foreman voice with real numbers and one honest concession per page.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact hexes inside the registers (concrete #D9D6D0/#CFCCC5, amber #E89B05–#FFAD1F, steel #9DA2A8 family).
- The display face within the register: Saira Stencil One OR Big Shoulders Stencil — one per site, never both.
- The CONCEPT NOUN that drives the page — le gros œuvre, la tournée, le parc, le pont, le périmètre, la baie — it names the hero scene, the showpiece machine and the copy voice.
- The machines and structures drawn (crane, pipes, breaker panel, duct, car lift, fence), the showpiece's LIFT type, the stamp vocabulary (LIVRÉ, POSÉ, VÉRIFIÉ, SOUS GARANTIE), and the section order beyond the fixed opening and closing.
A CHANTIER page whose showpiece machine could be swapped for a generic animation is a failure: the machine must be the client's actual trade at work.

## The vibe (voice)
Site-foreman French: short, load-bearing sentences, numbers said precisely, zero perfume. Register examples: "On coule, on monte, on livre. Dans cet ordre." · "Devis sous 48 h, chiffré ligne par ligne — pas au doigt mouillé." · "0 accident en 2025. On compte ça aussi." Dates, tonnages, m² and delays are spoken like measurements, never rounded for effect. ONE honest concession per page ("On a livré un chantier avec 11 jours de retard en 2022. On l'écrit aussi.") builds the trust ten adjectives can't. Exclamation marks: zero — a stencil already shouts. Never "leader", never "excellence", never "clé en main" without the line-by-line proof beside it.

## Visual signatures
- STENCIL + SPRAY (owned tic): all display titles in stencil caps pushed through an SVG spray filter — feTurbulence type="fractalNoise" baseFrequency 0.8–0.9, numOctaves 2, feDisplacementMap scale 4–7 (5 is canon). Applied ONLY to display titles ≥1.5rem and to stamps; body text never touches the filter. Stamps (LIVRÉ, REÇU, POSÉ) are stencil caps in amber or ink, rotated −4°…−2°, with a 2px same-color border box, sprayed.
- HAZARD BANDS (owned tic): repeating-linear-gradient(45deg, ink 0 12px, amber 12px 24px); thickness register 6px (CTA edges) / 8px (page top, seams) / 12px (footer gate). Placement budget 3–5 per page: page top edge, primary CTA bottom edge, one section seam, the footer gate. Stripes may slide 24px via background-position over 0.2s linear on hover/active — this band is the ONLY place 45° exists (diagonal SECTION cuts are MAILLOT's language).
- STEEL PLATES + BOLTS (owned tic): panels on linear-gradient(180deg,#A9AEB4,#9AA0A6 45%,#ACB1B7) — brushed means stops ≤8 RGB points apart, never chrome; 2px solid #6E747B border; border-radius 0–3px; four corner bolts as 7–9px radial-gradient discs (dark core #565C63, light rim #C6CBD0) inset 12–14px from each corner (small chips: 6–7px discs inset 9px). Text on steel is ink. The plate is the ONLY container allowed any gradient.
- FLAT SILHOUETTE ART: machines and structures drawn as flat SVG silhouettes — ink masses + steel fills + 1–2 amber accents per scene (a cabin, a hook, a gyrophare), no outline strokes around fills, no isometric, no 3D shading. Buildings in straight elevation.
- STAMPED FURNITURE: zone labels ("ZONE 04", "RÉF B-204") in Oswald 600 uppercase 11–13px on small plate chips or amber tags; the pour seam between sections is a 2px ink rule or a hazard band, never a soft gradient.
- PRESSED HOVERS: interactive elements press DOWN 2px on hover/focus, 3px on active — on a worksite, weight answers your hand; nothing ever lifts toward the cursor.

## Color physics
- GROUND A and GROUND B: two raw concretes 6–10 RGB points apart, the #D9D6D0/#CFCCC5 register. Concrete changes ONLY at a visible pour seam — the 2px ink rule or hazard band where one pour stopped and the next began; consecutive sections may share a pour. Joint-by-joint sequencing, never a decorative A/B alternation (that warm double-ground formula is MATIÈRE's). Never pure white, never warm cream.
- INK: #1C1C1A — borders, body text, silhouette masses, the header bar. Never softened to gray for text.
- AMBER: safety paint, the #F2A007 register (#E89B05–#FFAD1F). Budget: hazard stripes, the primary CTA fill, ONE accent word per major title, stamps, the counters on the ink slab, 1–2 accents inside each drawn scene. Amber NEVER glows — no text-shadow, no halo (glow is VOLTAGE's language); it is opaque paint on a dry wall.
- STEEL: the #9DA2A8 register (#8F959B–#ACB1B7) for plates, silhouette fills, secondary chips. Border steel #6E747B.
- LE BITUME: the asphalt slab, poured ONCE per page, its edges seamed like any pour — the ink-ground interlude where text flips to concrete white (#E8E5DF register) and the numbers go amber. A faint formwork texture is allowed there: repeating-linear-gradient(90deg, transparent 0 118px, rgba(232,229,223,0.05) 118px 120px).
- Gradients exist ONLY as brushed steel (≤8 RGB delta between stops). Every other surface is flat. No alpha layering except the formwork texture above and native focus rings (style them anyway).

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · AMBER→--primary · INK→--primary-foreground · GROUND B→--secondary · STEEL→--accent · ink at 55%→--muted · INK→--border · 2px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, register or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Saira Stencil One (single 400 weight — set it big, never bold it) or Big Shoulders Stencil 600–700. ONE per site. Always uppercase. Stencil never below 1.5rem — small stencil is illegible and reads as decoration.
- SUBHEADS: Oswald 500–600, uppercase, tracking +0.02–0.06em. Oswald owns card titles, nav, phase names, form labels.
- BODY: Barlow or Saira, 400/600/700. 1rem–1.0625rem, line-height 1.55–1.65, measure ≤64ch, always flush left. Body is never uppercase.
- Hero statement: the clamp(2.9rem, 6–8.5vw, 5.7–7rem) register, line-height 0.95–1.02. Section titles: clamp(2rem, 4.6vw, 3.8rem). Scale ratio hero:body ≈ 7:1 — readable from across the street.
- LABELS: Oswald 600, uppercase, 11–13px, tracking +0.08em, ALWAYS on a plate chip, an amber tag or inside a 2px-bordered box — never floating letter-spaced whispers on bare ground (that is ÉCRIN's language).
- NUMERALS: big counters (≥2.4rem) in the stencil display face, amber on ink, ink on concrete; small numerals (specs, dates) in Oswald 600. Tabular alignment for spec columns.
- NEVER italic. Emphasis is the amber word, the stamp, or nothing. Never a serif. Weights under 400 don't exist here.
- Arabic pairing: no Arabic stencil exists — display becomes Changa 700–800 (or Cairo 800), where WEIGHT and amber do the shouting and the spray filter still applies; body IBM Plex Sans Arabic 400/600. Hazard stripes mirror to −45° in RTL; bolts and plates are direction-neutral.

## Signature art / components
- DRAWN SCENES: each site draws its OWN trade — tower crane over a scaffolded elevation, pipe column, breaker panel, duct run, two-post car lift, fence line. Construction: flat ink masses first, steel fills second, 1–2 amber accents last. Straight-on elevation, no perspective tricks. Every scene carries role="img" and a real aria-label in the page's language; decorative repeats are aria-hidden.
- BUTTONS: primary = amber slab, ink Oswald 600 uppercase, padding 14–18px block / 24–32px inline, corners consuming var(--radius) directly (the 2px chamfer — never above 3px anywhere), 2px ink border, a 6px hazard band fused to its bottom edge. Hover/focus-visible: stripes slide 24px + the button presses down 2px (0.15–0.2s); active presses 3px. Secondary = 2px ink border on concrete, same press. Full keyboard/touch parity.
- CARDS: steel plates per the owned tic — art zone, Oswald title, Barlow spec line, spec chips, and where earned a sprayed stamp (LIVRÉ 2024) rotated −3°. Tags sit INSIDE the plate's top-left, never overlapping edges (the overlapping chip is BLOC's move).
- LE BON DE MISSION (form law): fields are 2px ink-bordered boxes on a lighter concrete fill (#E4E1DB register), 12–14px padding, labels in Oswald 600 uppercase 12px above the field — never placeholder-as-label. Phone-first: input type="tel" with a local placeholder; structured choices (commune, type de travaux) in a bordered select. Invalid: 3px amber left border + a frank message ("Il manque votre numéro — on ne peut pas rappeler sans."). Success: the plate re-stamps itself — sprayed REÇU. + one honest next step with a real time ("On vous rappelle avant demain 18 h."). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, commune, projet }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads, fills or references.
- ::selection amber ground / ink text. :focus-visible 3px solid amber outline offset 2px; on amber or ink grounds the outline flips to ink or concrete respectively.
- FAVICON: inline SVG data URI — a hazard-striped square with a 3px ink frame on concrete.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 7.5rem); containers 1180–1360px; scenes, seams and the footer gate bleed full width. Sections with off-stage entrances carry overflow-x: clip locally — never rely on the html clip alone.
- HEADER: an ink bar 64–76px — the site hoarding. Stencil wordmark in amber, Oswald nav links, one tel: chip. An 8px hazard band runs across the very top of the page. Sticky allowed.
- FIXED OPENING — LA PALISSADE (hero law): the first viewport states the trade, the proof and the CTA. Invariants: at least two verifiable facts on plate chips (year founded, chantiers livrés, décennale n°) in viewport one, ONE amber word in the headline, and a drawn element of the client's actual trade visible. Canonical families: LE PANNEAU DE CHANTIER (split: stencil claim + facts + CTA on one side, a drawn site scene on the other) and LE PORTAIL (a full-width drawn site elevation with a bolted notice plate carrying the claim and CTA). Any geste may be PROMOTED to the opening — a plate grid, a tool wall, a billboard claim over a skyline frieze — as long as the invariants hold; siblings must not share a hero composition.
- FIXED CLOSING: le bon de mission (split: honest promise + contact plates on one side, the steel-plate form on the other), then the GATE footer: the wordmark in stencil edge-to-edge at the clamp(3.4rem, 14–17.5vw, 12–15rem) register, one full-width 12px hazard band, contact chips with real hrefs (tel:, mailto:), one honest legal line (RC, NIF, adresse).
- FREE MIDDLE (compose 3–5 from this vocabulary, never two adjacent sections with the same layout): le bardage (bolted plate grid of projects/services on a 12-col irregular grid, spans 7/5 alternating) · le phasage (planning bars with dates and amber fills) · le bilan (the ink-slab interlude with stencil counters) · la signalétique (drawn sign panels on posts carrying guarantees) · le parc (machine silhouettes row with capacity specs) · la réception (a handover checklist that stamps itself). Section labels are numbered plate chips ("04 — LE PHASAGE").

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: gravity. Every hidden state is set via gsap.set, never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). JS dead → the site stands complete, every plate bolted in place, stamps visible.
- LA CHUTE (entrance law): elements DROP from −40…−90px in 0.35–0.5s power2.in (an accelerating fall), land, then ONE dead rebound of 4–6px over 0.16–0.2s power1.out — and stop. Opacity rides only the first 0.12s of the fall. Staggers 70–110ms, reading order — a delivery being unloaded, not a ballet. NEVER back.out, never elastic, never squash-and-stretch (that overshoot language is GUIMAUVE's).
- LE TAMPON: stamps arrive by scale 1.5→1 in 0.16–0.2s power3.in, keeping their −4°…−2° resting rotation — a stamp hit, felt more than seen.
- SHOWPIECE — THE LIFT SCRUB: one pinned machine scene per page where the client's machine MOVES A LOAD into place (le portique: a gantry crane hooks a plate, lifts it, travels, lowers it onto its socle; siblings lift cars, assemble pipes, close gates). Scrub 0.5–0.8, end +=1500–2000px, ease none inside the timeline; the load's landing keeps the one-bounce; the scene ends with a sprayed stamp and a one-line caption that rides INSIDE the pinned block (never below it — no dead band may trail the scrub); the caption sits flush left against a 2px ink left rule — never centered, nothing floats unanchored. Behind the machine, one quiet depth plane: a distant flat site elevation (buildings, cabin, stacked barriers) in the #C8C5BE–#B0ADA6 register. Mobile <768px: no pin — the scene arrives pre-composed and its parts drop in on view; the stamp stamps on view, placed clear of the load.
- COUNTERS: values count with snap: 1 over 0.8–1s power1.in — accelerating like a filling hopper — then the unit chip drops in a beat later.
- BARS: phasage fills grow scaleX from 0, transformOrigin left, 0.6–0.8s linear — a pour, not a spring.
- HOVER: the pressed hover only (down 2px, stripes slide), 0.15–0.2s, keyboard and touch parity. No scale-ups, no color fades longer than 0.2s, no floats, no glows.
- REDUCED MOTION: the composed page — showpiece at its final landed frame, stamps visible, counters at final values, bars filled. A designed still, never a blank.

## Chantier ban list (in addition to the global one)
- Hard black offset shadows, 3–4px borders on everything, clashing rotated price-chips — that is BLOC's stall language; CHANTIER's depth is the plate, not the shadow.
- Dimension lines with arrowheads, title-block cartouches, red-pencil markup, graph-paper grounds — that is GABARIT's drawing board; CHANTIER is the SITE, not the plan.
- Diagonal slice section transitions, giant jersey numerals, chant stacks — that is MAILLOT's language; our 45° lives only inside hazard-stripe bands.
- Machine-telemetry voice (SYS.STATUS, coordinates), outline/stroked type, crossing marquees, difference chrome — that is CINÉTIQUE's language.
- Torn-paper edges, misregistered print layers, tape strips — that is FANZINE's language.
- back.out bounce entrances and squash-and-stretch hovers — that is GUIMAUVE's language; our settle is one dead rebound, then stillness.
- Neon glow, multi-layer text-shadow on amber — that is VOLTAGE's language; safety paint is matte.
- Soft-shadow floating cards on white — that is CLAIR's language; nothing floats here.
- Photography, photoreal render, isometric or 3D-shaded illustration.
- Blur of any kind: box-shadow blur, backdrop-filter, glassmorphism.
- Gradients outside brushed steel plates; pastels; desaturated "industrial chic" beige.
- Italic characters; border-radius above 3px; pills of any kind.
- Floating loops, parallax drifts, slow ambient motion — a parked machine does not sway.
- More than one ink slab; more than five hazard bands; stencil below 1.5rem.

## LES GESTES (moves menu)
- LE PORTIQUE — the lift scrub played as a gantry crane: hook descends to a bolted plate, lifts it off its stack, travels the girder, lowers it onto a stenciled socle; chains slack, one rebound, sprayed POSÉ. — the canonical showpiece.
- LE PANNEAU DE CHANTIER — hero family: stencil claim with one amber word + fact plates + CTA on the left, the drawn site elevation with crane on the right; the 8px hazard band runs above everything like site tape.
- LE PORTAIL — hero family: a full-width drawn elevation of the client's site; centered on it, a bolted notice plate carries name, claim and CTA — the page opens like arriving at the gate.
- LE BARDAGE — projects or services as bolted steel plates on an irregular 12-col grid (7/5 then 5/7 spans), each with silhouette art, specs in Oswald chips and a sprayed status stamp; plates drop in reading order.
- LE PHASAGE — the planning: 4–6 phase rows (name, dates, weeks), each a 2px-bordered track whose amber fill pours in on view; the current phase carries a small EN COURS tag.
- LE BILAN — the ink slab: a load-bearing statement on the left, a 2×2 grid of stencil counters on the right (chantiers, m², ans, accidents), formwork texture behind; includes the page's honest concession line.
- LA SIGNALÉTIQUE — guarantees as drawn site signs on posts: a triangle, a square and a rectangle panel (décennale n°, délais + pénalités, devis 48 h), each dropping onto its post with the one-bounce.
- LE PARC — the machine row: 3–4 flat silhouettes of the fleet or tool set, each with a capacity spec underneath ("Grue 40 m — 2,4 t en bout de flèche"); silhouettes drop in with 90ms stagger.
- LA RÉCEPTION — the handover checklist: real inspection lines that stamp themselves VÉRIFIÉ one by one on scrub or on view; the last line is the client's signature moment (the CTA).
- LE COUP DE TAMPON — the micro-interaction: any section may earn ONE sprayed stamp that hits (scale 1.5→1, power3.in) when its proof scrolls into view — LIVRÉ on a project, 0 ACCIDENT on the bilan.
- LA BENNE — services tipped in: a row of service plates dropping in sequence with 110ms stagger and randomized fall heights (−50/−70/−60px), like a skip being emptied — for pages with many small services.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- AXE BTP (general contractor, Algiers) — LE PANNEAU DE CHANTIER hero, the vertical split: stencil claim "ON CONSTRUIT CE QUI TIENT." with TIENT in amber + fact plates + CTA on the left, drawn crane-and-scaffold elevation on the right; everything drops in reading order. Showpiece: LE PORTIQUE — the gantry crane hooks the project plate, lifts, travels the girder, lowers it onto its stenciled socle, POSÉ. Middle: bardage of delivered projects → phasage → bilan on ink. Mood: the flagship — foreman calm, every number verifiable.
- SARL FLUX (plumber, Sétif) — LE PORTAIL hero: a full-width drawn building CUTAWAY exposing its riser column, with one bolted notice plate in the lower-left corner carrying claim and tel CTA. Showpiece: LA COLONNE — the water column assembles floor by floor on scrub, each pipe section dropping and sealing with an amber joint, VÉRIFIÉ stamped at the top. Middle: benne of interventions (fuite, chauffe-eau, colonne, débouchage) → signalétique → réception checklist. Mood: urgency handled calmly; the tel: CTA rides the header.
- BENALI ÉLEC (electrician, Oran) — plate-grid hero (a promoted bardage): the first viewport IS the grid of intervention plates (dépannage, tableau, mise aux normes) with the claim spanning two cells and facts on a third; plates land with tight 70ms stagger. Showpiece: LE TABLEAU — a drawn breaker panel whose switches snap ON one by one on scrub, each labeling a service, ending on the CONFORME stamp. Middle: bilan → phasage of a mise-aux-normes. Mood: precise, snappy, zero glow — mechanical clicks.
- CLIM ATLAS (HVAC, Algiers) — LA BÂCHE hero, the billboard: the stencil claim runs edge-to-edge at full clamp across the top, the two fact plates ride a single hazard band beneath it, and a drawn rooftop-unit skyline sits as a low frieze at the viewport's foot. Showpiece: LA GAINE — duct sections bolt together left to right across the pinned viewport, air-arrow chips dropping at each junction, ending SOUFFLÉ. Middle: parc of units with BTU specs → signalétique (garantie compresseur) → réception. Mood: cool trade, warm amber; the phasage shows a 2-day install honestly.
- LES COSTAUDS (moving company, Constantine) — tall-facade hero: a drawn seven-floor facade holds the RIGHT EDGE of the viewport full height while claim, fact plates and CTA descend the left side like floors, meeting the street line at the bottom. Showpiece: LE MONTE-MEUBLE — the furniture lift climbs the facade on scrub, its platform carrying a crate plate window by window to the 7th floor, LIVRÉ at the top. Middle: benne of formulas (studio, F3, bureaux — prices in DA) → bilan → réception. Mood: the strongest voice of the family; one concession about stairs.
- GARAGE HAMDI (mechanic, Blida) — tool-wall hero (a promoted parc): a full-viewport drawn pegboard of tools with the claim stenciled directly on the wall between them and the CTA hanging as an amber tag on its hook; tools drop onto their pegs one by one. Showpiece: LE PONT — a drawn car rises on a two-post lift as you scrub while inspection lines stamp themselves VÉRIFIÉ underneath, ending on the forfait révision plate and its DA price. Middle: bardage of forfaits → signalétique (pièces d'origine, délai tenu) → bilan. Mood: honest garage — the price is on the wall.
- ACIER GARDE (security company, Algiers) — closed-gate hero: a full-width drawn double gate fills the viewport, the claim painted in stencil ACROSS both leaves, the CTA bolted on as the gate's notice plate; on load the two leaves slide shut and meet with the one-bounce. Showpiece: LE PÉRIMÈTRE — fence posts drop one by one on scrub, mesh draws between them, the gate closes, SITE SOUS PROTECTION stamps. Middle: signalétique (agrément n°, rondes, PC 24/7) → bilan with a 0-intrusion counter → réception. Mood: the most ink-forward sibling; amber rationed to stamps and stripes.
- ALU BAIE (aluminum & glass, Annaba) — monumental-plate hero: ONE oversized bolted steel plate centered in the viewport carries name, claim, mm specs and CTA like a giant site sign, flanked by two narrow drawn window-wall strips; the plate lands first, its bolts "tighten" (opacity steps) after. Showpiece: LA BAIE — the frame assembles member by member on scrub, the glazing slides in, the amber joint seals the edge, POSÉ. Middle: bardage of profiles with mm specs → phasage (prise de cotes → fabrication → pose) → bilan. Mood: the finest lines of the family — steel hairlines, same gravity.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the STEEL PLATES (brushed gradient + four bolts + 2px border — one flat gray rectangle without bolts and the whole site becomes a template), the DROP (power2.in fall + one dead rebound, ≤0.5s — one floaty fade-up and gravity is dead), and the STENCIL+SPRAY titles (clean-edged stencil reads as a font choice; sprayed stencil reads as paint on concrete). The cheap details that separate it from a generated page: the hazard stripes sliding under a pressed CTA, the stamp keeping its −3° after it hits, the bolt highlights catching "light" on every plate corner, the honest concession line in the bilan, the unit chip dropping a beat after its counter stops. When in doubt, add weight and take away shine — this world convinces by standing still.`,
	energy: "loud",
	family: "industrial",
	// gabarit: plan meets site — one construction brand, two registers.
	// bloc: the worksite opens a shop — hardware, spare parts.
	fusesWith: ["gabarit", "bloc"],
	id: "chantier",
	industries: [
		"rental (chairs, decor, sound)",
		"general contractor",
		"renovation / remodeling",
		"plumber",
		"electrician",
		"painting & finishing",
		"aluminum & glass",
		"HVAC / climatisation",
		"carpentry / woodwork",
		"moving company",
		"security company",
		"cleaning company",
		"garage / mechanic",
		"spare parts",
		"car wash & detailing",
		"motorcycle shop",
		"driving school",
		"property developer / promoteur",
		"commercial real estate",
	],
	kind: "website",
	mood: ["loud", "load-bearing", "honest", "industrial", "amber-warm"],
	name: "Chantier",
	priceFeel: "accessible",
	preview: {
		accent: "#F2A007",
		fontFamily: "Saira Stencil One",
		ground: "#D9D6D0",
		ink: "#1C1C1A",
		sampleWord: "CHANTIER",
	},
	tagline: "Le chantier à l'écran : acier boulonné, pochoir, ambre sécurité.",
};
