import type { DesignWorld } from "../types";

/**
 * VOLTAGE — the electric night.
 * The LIT dark world: blue-black ground, neon-tube type with a white-hot
 * core, electric beam lines, smoked-glass panels with glowing edges.
 * Proven in worlds/voltage/demo (NIGHTSHIFT, night detailing, Algiers).
 * fusesWith rationale:
 * - huitbit: arcade night — gaming venues and retro-gaming brands that want
 *   the neon facade outside and the pixel machines inside.
 * - maillot: neon fight night — combat-sports events where the jersey
 *   numerals and diagonal slices step into the electric dark.
 */
export const voltage: DesignWorld = {
	avoidFor: [
		"notary",
		"kindergarten / crèche",
		"wedding services",
		"guesthouse / riad",
		"pharmacy",
		"psychology / therapy",
	],
	doc: `# DESIGN WORLD: VOLTAGE — the electric night

## Philosophy
This page is a FACADE ON A NIGHT STREET AT 2 A.M., not a website. The city is asleep, the business is not: its sign burns, current hums in the lines, and everything the visitor sees is lit by sources the page itself has drawn. First structural fact: PERMANENT NIGHT — the ground is blue-black in every section, there is no light mode, no white card, no dawn. Second: LIGHT IS EMITTED, NEVER REFLECTED — every bright element is a source with visible geometry (a tube, a beam, a pool of glow); nothing shines by mirror or bevel, and a generic "dark theme" is structurally impossible here because dark themes have no light sources. Third: the TWO-NEON LAW — exactly two neon hues per site, chosen once, spent with a budget; a third hue never exists. Fourth: panels are SMOKED GLASS, edge-lit by their own glowing 1px borders — this is the only world in the catalog allowed backdrop-filter blur, and it pays for the privilege by never letting glass go milky or white. VOLTAGE is glossy showmanship with cyber precision — the LIT dark world; the austere dark (generative canvases, telemetry captions, outline type) belongs to CINÉTIQUE and is banned by name below. Its impossible failure modes: the daylight corporate page, the flat gray developer dark-mode, the purple-blue AI gradient wash (the two neons NEVER blend in one gradient), and timid glow (a sign at 40% is a dead sign — off or blazing, nothing between).
Self-audit before shipping: (1) count neon hues — exactly two, and no gradient anywhere contains both; (2) count light sections — zero; (3) every glow on the page traces to a drawn source: a tube lockup, a beam line, a glass border or a light pool; (4) at most one white-hot tube lockup per viewport; (5) zero photographs, zero raster images; (6) backdrop-filter appears only inside glass panels.

## The variation contract (why two VOLTAGE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Blue-black ground register, night in every section, ice text.
- The two-neon law and the neon budget (primary carries ~80% of the light, secondary is punctuation).
- The neon-tube type recipe, electric beam lines, smoked-glass panels with glowing 1px borders (the three owned tics, specs below).
- Power-on surge motion: flicker-in then steady glow ramp; nothing bounces, nothing floats aimlessly.
- Drawn night scenes (CSS/SVG silhouettes rim-lit by the neons), zero photography.
- Dual visibility: JS dead = the street fully lit, every sign on, every word readable.
- The fixed closing: the page ends FULLY LIT — the complete sign lockup burning over the contact form.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- THE PAIR: two hues from the register cyan #00E5FF / magenta #FF3DDB / lime #B6FF3D / violet #9D5CFF / orange #FF7A2F. Shipped pairings: cyan+magenta (the classic electric night), lime+violet (acid club), orange+cyan (garage forecourt), cyan+violet (deep tech). Pairs closer than 60° of hue angle are forbidden — that kills magenta+violet (48°) and lime+orange (59°); the two hues must read as two.
- THE SIGN: every VOLTAGE page is a named establishment whose enseigne drives everything — the wordmark treatment, the scenes drawn, the copy voice, the showpiece route. Name the sign FIRST; a VOLTAGE page without an establishment behind it is a mood board.
- The display face within the register: Chakra Petch (600/700) or Audiowide (single 400, sized up ~15% to compensate) — one per site.
- The scenes drawn (what the neon rim-light reveals), the showpiece's route and beats, the section order beyond the fixed opening and closing, and where the secondary hue's rationed moments are spent.

## The vibe (voice)
Night-confident French (or the brief's language): short assured declaratives from someone who works while you sleep, showman's swagger held by exact numbers. Claims carry units and true figures; superlatives are replaced by specifics; one dry wink allowed per page, never more. No exclamation marks — a neon sign does not shout, it burns steadily. Example lines:
- "La ville dort. Votre carrosserie, non."
- "Ouvert quand tout ferme. 22h — 06h, sept nuits sur sept."
- "Chaque micro-rayure meurt sous 6 000 lumens."

## Visual signatures
- NEON-TUBE TYPE (owned tic). Key display words are lit tubes: color #F6FBFF (the white-hot core) with a same-hue shadow stack — 0 0 2px hue, 0 0 10px hue at 90%, 0 0 28px hue at 55%, 0 0 72px hue at 25%. The DIM register (secondary sign level): the hue itself as color, only the 10px and 28px layers at half opacity. The OFF register: color rgba(220,232,255,0.22), no shadow — a glass tube with no current, waiting. Budget: one white-hot lockup per viewport, one tube word per section title; body text NEVER glows.
- ELECTRIC BEAM LINES (owned tic). 2px lines of pure hue with box-shadow 0 0 8px hue at 80% and 0 0 24px at 35%. A SURGE is a white-hot segment (12–18% of the line's length, linear-gradient through #FFF) traveling the line. Beams underline headlines (36–120px dashes), divide sections, and run the page's spine. Budget: one ambient looping surge maximum per page; every other surge is scroll-driven.
- SMOKED-GLASS PANELS (owned tic — backdrop-blur allowed ONLY here). background rgba(14,17,34,0.55–0.7), backdrop-filter blur(12–16px) saturate(120%), border 1px in the hue at 35–55% opacity, outer box-shadow 0 0 24–40px hue at 8–14%, radius 14–18px. The light lives in the EDGE: no white sheen, no specular highlight across the face — mirror-gloss is AN 2000's language, and milky frosted-white glass does not exist at night.
- DRAWN NIGHT SCENES: objects are near-black silhouettes (#11121E register) revealed by neon rim-light — a 1.5–2.5px stroke of the hue along the upper contour with an SVG glow filter — standing on wet-floor reflections (the object flipped, blurred 5–8px, faded to 10–18% opacity, masked out by 60% of its height).
- LIGHT POOLS: radial-gradient ellipses of hue at 10–20% opacity anchored UNDER signs and scenes — glow falls downward onto the floor, never floats free.
- CAPSULE TUBES: CTAs, chips and pills consume var(--radius) directly — the fully round 999px capsule, a bent neon tube — 1px hue border, inset 0 0 12px hue at 15%, never a filled rectangle.
- ICE TEXT: #DCE8FF for display and headings, body prose at 78–88% opacity of it. Pure #FFF exists only inside tube cores and beam surges.

## Color physics
- GROUND: blue-black register — #0A0A14 (A) and #0D0D1A (B), alternating per section; the alternation is felt as a change of night air, not a stripe. A third, deepest tone #07070E may ground full-bleed scenes and the closing. Never pure #000 (this night has blue in it), never gray.
- INK (text): ice #DCE8FF. Body at 0.78–0.88 opacity; captions at 0.55–0.65. No warm whites — heat comes from the neons.
- PRIMARY NEON: ~80% of the light budget — the wordmark, beams, glass borders, CTAs, section-title tube words, focus rings.
- SECONDARY NEON: punctuation, rationed to 3–5 moments per page — one accent word in the hero, the featured card's sign and border, one claim band, the form's success state. Spent everywhere, it becomes wallpaper; the ration IS the glamour.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · PRIMARY NEON→--primary · white-hot core→--primary-foreground · GROUND-B→--secondary · SECONDARY NEON→--accent · ice at 60%→--muted · ice at 25%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, glow or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- THE HUES NEVER BLEND: no gradient contains both neons; they meet only side by side, as two signs on one street. Hue-to-hue gradient washes are the fastest route back to the generic AI page and are banned outright.
- GRADIENTS exist only as light: beam surges (hue through #FFF along the line), light pools (radial hue to transparent), and scene skies (vertical #07070E to #10142A register). Never as section ground washes, never on type except the tube recipe.
- Honest dark contrast: body ice-on-ground holds ≥ 10:1; hue-colored text under 1.5rem is forbidden (neon is for display, not paragraphs).

## Typography system
- DISPLAY: Chakra Petch 600/700 (Google Fonts) or Audiowide 400 — one per site — ALWAYS uppercase at display sizes, tracking +0.02–0.06em. Chakra Petch is the precision cut; Audiowide is the rounder americana tube. Never italic; slant is not voltage.
- BODY: Manrope 300–600. Base 1–1.06rem, line-height 1.6–1.75, measure 58–68ch. Weights: 300 for lead paragraphs at 1.15–1.25rem, 400–500 prose, 600 for emphasis and labels.
- SIZE REGISTER: hero sign clamp(2.9rem, 9.4vw, 8.4rem) at line-height 0.95–1.05 (set it full-container-width above the split when the name is long — the billboard cut); section titles clamp(2rem, 4.5vw, 3.6rem); stat numerals clamp(2.2rem, 4.6vw, 4.2rem) in the display face; labels 0.7–0.78rem Manrope 600 uppercase, tracking +0.22–0.3em, in primary hue at 85% or ice at 55%, usually preceded by a 24–36px beam dash.
- NUMERALS AND PRICES: display face, with the currency unit in Manrope at 45–55% size ("24 000 DA" — the DA in body face, ice 60%). Numbers are part of the show: sized like signs, never like footnotes.
- HARD RULES: the display face never sets body text; Manrope never exceeds 1.3rem; no third typeface; no outline/stroked type ever (CINÉTIQUE's material); body text never receives text-shadow.
- ARABIC RULE: Chakra Petch and Audiowide have no Arabic. Arabic pages set display in Tajawal 700/900 (uppercase has no meaning — weight and scale do the shouting) and body in Tajawal 300–500; the tube shadow recipe applies unchanged to Arabic glyphs; direction flips to rtl and the page spine moves to the RIGHT edge.

## Signature art / components
- SCENES: every page draws 2–4 night scenes in the rim-light system — the establishment's object (a car, a machine, a stage, a barbell) as a flat near-black silhouette, its upper contour traced by a glowing hue stroke, standing in a light pool with a wet-floor reflection. Construction order: sky plane, ground line, silhouette, rim stroke with an SVG feGaussianBlur glow (stdDeviation 3–6), pool, reflection. Flat side elevation or gentle front view; never isometric, never 3D-shaded. Every scene carries role="img" and a real aria-label in the page's language.
- THE SIGN LOCKUP: the establishment's name as neon-tube type, optionally inside a 2px hue-stroked capsule or rectangle frame (the sign's armature), with a small mounting detail (two 6px screws or a hanging bar in ice at 20%) — a sign is HARDWARE, not floating text.
- BUTTONS: capsule tubes. Primary: 1px primary-hue border, inset glow, white-hot text with the small tube stack; hover/focus plays LE COURT-CIRCUIT (spec in motion) and widens the outer glow to 32px. Secondary: ice 30% border, no glow at rest, charges to hue on hover/focus. Identical treatment for :focus-visible and touch active; links underline with a 1px beam that surges once on hover.
- FORMS: the control panel — fields on smoked glass, each a borderless input on a 1px ice-25% baseline that snaps to primary hue on focus (caret-color hue); labels in the label register above; PHONE FIRST (type="tel" before email). Selects for structured choices. Submit is a primary capsule tube. Success state is honest and lit: the panel's border flips to the secondary hue and prints real next steps ("Reçu. On vous rappelle avant 22h ce soir.") in an aria-live region — no confetti, no modal. On valid submit dispatch the "wandit:lead" CustomEvent on document with the visitor's fields flat in detail, and keep one off-canvas decoy input carrying data-wandit-hp that the page's own script never reads, writes or mentions.
- CARDS: glass panels (spec above) with a DIM-register sign as title; the featured card's sign and border switch to the secondary hue. Card content: Manrope list with beam-dash markers (a 14px hue dash, never bullets, never icons).
- FAVICON: inline SVG data URI — a lightning bolt or the sign's initial stroked in the primary hue on #0A0A14.

## Page chassis
- FIXED OPENING — L'ALLUMAGE: the first viewport turns the sign on. Ground at its deepest, the establishment's sign lockup flickers to white-hot within 1.2s of load, one line of ice sub-copy, one primary capsule CTA plus one secondary, a glass chip stating the honest facts (hours, quartier, phone), and the page's first drawn scene or a beam crossing under the sign. One accent word in the hero may burn in the secondary hue.
- FIXED CLOSING — LA SOUS-STATION: the contact section as the building's control room — form-on-glass beside the establishment's coordinates (address, phone, hours in the label register), the sign lockup FULLY LIT above (both hues present, the page's brightest moment), then a slim footer: real in-page anchor links, one legal line at ice 45%. The page ends at maximum light — the inverse of a fade-out.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: LE COMPTOIR (stat band on a glass strip) · LA VITRINE (glass card grid, one featured in the secondary) · LE CIRCUIT (steps hung on the spine beam) · LE TUNNEL (full-bleed drawn scene interlude) · L'INTERRUPTEUR (before/after reveal) · LA HAUTE TENSION (edge-to-edge claim band with a beam striking through). Exactly ONE scroll-scrubbed showpiece per page (motion law below).
- RHYTHM: section padding clamp(5rem, 12vh, 8.5rem); content grids cap 1200–1320px with clamp(1.25rem, 5vw, 4rem) side padding; scenes and claim bands may bleed full-width. Grounds alternate A/B per section.
- MOBILE: the spine beam moves to 12–16px from the edge and content clears it; scenes recompose to portrait crops; glass panels stack with 16px gutters; the hero sign drops to clamp(2.6rem, 11vw, 4rem) and never wraps mid-word.

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs UMD)
GOVERNING LAW: every hidden or unlit state is set via gsap.set (or a JS-applied class), never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). CDN dead = the street fully lit and still.
- The personality is POWER-ON SURGES: elements do not fade in, they are SWITCHED ON — a flicker (2–3 opacity dips inside 0.35–0.5s: 1 → 0.25 → 1 → 0.5 → 1) then a glow ramp to steady over 0.4–0.7s. Structural content (paragraphs, cards) enters with autoAlpha + 20–28px rise on expo.out, 0.6–0.9s, staggers 70–120ms; only SIGNS and beams flicker. Flicker never exceeds 3 dips, never plays on elements larger than 25% of the viewport, and never loops.
- THE SHOWPIECE — LA DÉCHARGE: one beam travels the page's spine on scrub (scaleY from the top, transform-origin top, scrub 0.8–1.2), a white-hot tip leading it; as the tip passes each section, that section's sign flickers from OFF to LIT (once, then it stays burning). The décharge ends at the closing CTA with everything alight. Route and beats are client-owned; the mechanism is law. This is the page's only scrub.
- CONTINUOUS BUDGET: at most ONE ambient loop — a slow surge running a single beam (8–14s linear) or the hero pool breathing at ±4% opacity (6s sine). Never both.
- HOVER — LE COURT-CIRCUIT: a 180ms micro-flicker (brightness 0.75 → 1.15 → 1) then the glow widens; transform stays at zero — voltage moves light, not position. Keyboard :focus-visible and touch active get the identical circuit.
- REDUCED MOTION: no flicker, no scrub, no loops — every sign steady at full glow, the spine beam drawn complete, scenes at their most composed frame. The night, already on.

## Ban list (the global ban list applies; in addition)
1. Runtime generative Canvas/shader imagery — CINÉTIQUE's; VOLTAGE draws its night in CSS/SVG.
2. Machine-telemetry voice (SYS.STATUS, FILE 001, coordinate captions) — CINÉTIQUE's; this world speaks showman French, not sensor poetry.
3. Outline/stroked display type and difference-blend chrome — CINÉTIQUE's.
4. The sticky card-deck (covered cards receding) — CINÉTIQUE's.
5. Prompt-line furniture, typed steps() text, block cursors, CRT scanlines or vignettes — PHOSPHORE's; VOLTAGE has no terminal.
6. Chrome/metal bevel text, glossy specular orbs, orbit rings and lens-flare sparkles — AN 2000's; VOLTAGE emits light, never mirrors it. No white sheen crosses any surface.
7. Pixel sprites, 8px-grid art, stepped pixel corners, game-HUD furniture — HUITBIT's.
8. Constellation dot-and-line diagrams, dotted orbital ellipses, astronomical captions — OBSERVATOIRE's; beams connect nothing, they carry current.
9. A third neon hue, or any gradient blending the two neons — the two-neon law is absolute.
10. Light or gray sections, white cards, milky frosted glass — this world has no day.
11. backdrop-filter outside glass panels; glassmorphism-as-decoration on random rectangles.
12. Matrix glyph rain, RGB-split glitch text, chromatic aberration, hacking-costume decoration.
13. Strobe loops and flickers that never settle; any flash sequence beyond 3 dips.
14. Neon on everything: if every word glows, nothing does — the tube budget is law.
15. Purple-to-blue gradient hero washes (the global ban, restated because this world is where builders reach for it).

## LES GESTES (moves menu)
1. L'ALLUMAGE — the load-in: page lands at deepest dark, the sign flickers to white-hot in ≤1.2s, sub-copy and CTAs switch on 90ms apart, the first beam draws across. The whole page is lit before the first scroll.
2. LA DÉCHARGE — the spine scrub (THE showpiece): the beam travels the page's vertical spine, its tip charging every section sign it passes; the route (left edge, center, mirrored rtl) and beat count are client choices.
3. LE COMPTOIR — the stat band: 3–4 display-face numerals on one glass strip, one numeral spending a secondary-hue moment, unit words in body ice below.
4. LA VITRINE — the card row: 3 glass panels with DIM signs; the featured one burns secondary with a wider glow; on hover each plays le court-circuit.
5. LE CIRCUIT — steps hung on the spine: numbered nodes (12px hue dots with pools) connected by the beam, content cards alternating sides on desktop, times or step names in the label register.
6. LE TUNNEL — the full-bleed interlude: a drawn scene of receding neon frames (4–6 concentric strokes shrinking to the establishment's object at center), the deepest ground, one caption line.
7. L'INTERRUPTEUR — before/after: two drawn states of the same scene under a draggable divider (a vertical beam as the handle; range-input driven, keyboard native); OFF state matte and dim, ON state rim-lit and pooled.
8. LA HAUTE TENSION — the claim band: one uppercase line at clamp(2rem, 5vw, 4rem) running edge-to-edge with a horizontal beam striking through it mid-height; the line's key word is a tube, the rest ice.
9. LE COURT-CIRCUIT — the hover circuit: 180ms brightness dip-spike-settle plus glow widening; applied to buttons, cards and nav links; never moves the element.
10. LA VEILLEUSE — the ambient loop: one slow surge patrolling a single beam (8–14s, linear) — the page's pilot light, proof the current never stops.
11. LE COMPTE À REBOURS DU SOIR — the hours chip: a capsule tube stating tonight's real hours ("22h — 06h · Bir Mourad Raïs"), pinned near the hero CTA; honesty as ornament.
12. LE DOUBLE FOND — the ground swap: one section drops to #07070E and bleeds full-width for the scene or claim moment, the night getting deeper before the closing lights.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. PLEINE CHARGE — a crossfit box in Oran, lime+violet. Hero: a full-viewport sign WALL — the name stacked in three lines filling the viewport height, line two burning violet, tonight's WOD on a glass chip bottom-right. Showpiece: a pinned vertical voltage gauge that fills as you scrub, arcing a spark to reveal each of the four programs at 25/50/75/100%. Mood: acid, sweaty, disciplined.
2. SIGNAL — a telecom/ISP, cyan+orange. Hero: a narrow left column holding a drawn antenna mast emitting concentric arc pulses, headline and offer filling the right two-thirds. Showpiece: a horizontal beam crosses a drawn city skyline scene, lighting each district's windows as coverage arrives, ending on the price capsule. Mood: infrastructural, confident, municipal night.
3. DROP 03 — a streetwear drop, magenta+lime. Hero: a centered plinth scene — the product silhouette under a single hanging tube, the collection name arcing BEHIND the object in dim register. Showpiece: a pinned vitrine where each scrub beat kills all light for 200ms then re-lights one product alone on the plinth — a blackout between every drop. Mood: nocturnal retail theatre.
4. MAINLINE — an AI SaaS, cyan+violet. Hero: headline flush-left at 9vw with a beam underline that surges once, a tilted glass dashboard panel floating right at 6° with its border charging on load. Showpiece: a drawn circuit-board path where data pulses travel from three input nodes through the product's glass panel to one output, each pulse switching on a feature caption. Mood: precise, humming, server-room night.
5. OCTOGONE — a fight-night promoter, orange+cyan. Hero: a neon octagon frame centered, event date as tube type inside it, the headline split above and below the frame. Showpiece: a pinned round-counter — scrubbing counts rounds 1 to 5, each round flickering a fighter card pair on with the corner hues swapping sides. Mood: adrenal, ceremonial, ringside.
6. FRÉQUENCE — a club-night series, magenta+cyan. Hero: a full-bleed equalizer of vertical neon bars spanning the viewport, the series name knocked out across them in ice. Showpiece: the equalizer scrubs through the lineup — bars choreograph down to silence then spike to spell each act's name in lit bars, one act per beat. Mood: loud, rhythmic, 3 a.m.
7. COURANT — an EV-charging startup, lime+cyan. Hero: a top/bottom split — the number "480 kW" as a tube numeral filling the top half, the drawn car-and-charger scene grounded below it. Showpiece: a charging cable draws itself from plug to port on scrub, then the battery gauge blooms segment by segment to full, the CTA lighting with the last segment. Mood: clean current, quiet power, highway night.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the TUBE CRAFT (the white-hot core + layered same-hue glow, with its off/dim/lit registers — flat colored text with one blurry shadow is a costume, not a sign), LA DÉCHARGE actually charging the page section by section (a static beam is a border, not a current), and the TWO-NEON DISCIPLINE (the third hue, or one cyan-to-magenta gradient, and the page collapses into the generic AI dark). The cheap details that separate it from a generated page: the sign's mounting screws, the wet-floor reflections under scenes, the light pools falling downward, the hours chip stating true hours, and the secondary hue held back until it matters. When in doubt, turn something OFF — a night street is mostly dark, and that is why the signs win.`,
	energy: "loud",
	family: "neon-tech",
	fusesWith: ["huitbit", "maillot"],
	id: "voltage",
	industries: [
		"car wash & detailing",
		"car dealer",
		"garage / mechanic",
		"electronics / gadgets",
		"telecom / ISP",
		"AI product",
		"SaaS product",
		"mobile app landing",
		"startup (pre-launch / waitlist)",
		"gym / fitness club",
		"crossfit / functional",
		"martial arts / combat sports",
		"DJ / entertainment",
		"festival",
		"venue / salle des fêtes",
		"streetwear / drops",
	],
	kind: "website",
	mood: ["electric", "nocturnal", "glossy", "precise"],
	name: "Voltage",
	preview: {
		accent: "#00E5FF",
		fontFamily: "Chakra Petch",
		ground: "#0A0A14",
		ink: "#DCE8FF",
		sampleWord: "VOLT",
	},
	priceFeel: "premium",
	tagline: "La nuit électrique : enseignes néon, faisceaux et verre sombre.",
};
