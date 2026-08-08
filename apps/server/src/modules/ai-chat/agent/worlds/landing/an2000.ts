import type { DesignWorld } from "../types";

/**
 * AN 2000 — millennium optimism in chrome and sky.
 * The retro-y2k world: aqua sky-gradient grounds (this world's licensed
 * exception), CSS chrome text and buttons with multi-stop silver bevels,
 * glossy orbs with specular sheen, chrome orbit rings with lens-flare
 * sparkles. SPECULAR always: this world reflects light, never emits it
 * (voltage glows, guimauve is matte). Proven by the Nova Mobile demo
 * (eSIM travel data, Amsterdam, EUR, English).
 */
export const an2000: DesignWorld = {
	avoidFor: [
		"notary",
		"fine dining",
		"guesthouse / riad",
		"funeral-adjacent",
		"general contractor",
	],
	doc: `# DESIGN WORLD: AN 2000 — millennium optimism in chrome and sky

## Philosophy
This page is THE MORNING OF JANUARY 1st, 2000 — the future arriving on time, and it is friendly. A soft aqua sky fills every ground; polished chrome objects float in it and REFLECT it — this world never emits light. There are no glows, no beams, no neon halos — only specular highlights, silver bevels, glossy tops and one lens flare. Its defining structural facts: (1) the ground is a vertical sky gradient — the one world where a soft gradient ground is LAW, not a violation, licensed only inside a locked blue corridor; (2) every signature object is drawn in CSS/SVG as chrome or gloss — multi-stop silver bevels on type and buttons, glossy aqua orbs with a top-edge specular ellipse, chrome orbit rings; (3) zero photography, zero raster imagery, zero texture grain — this world is POLISHED, never tactile. Impossible failure modes: a dark page (there is no night in AN 2000 — the deepest allowed sky stop is #B7D4EC); a matte page (if nothing gleams in the first viewport, the world is dead); a purple-blue AI gradient wash (the corridor forbids it structurally). Self-audit before shipping: count at least SIX specular highlights across the first two viewports; zero img elements; every gradient's hue between 195 and 215, with at most 2 bubblegum moments as the only exceptions; exactly one lens-flare sweep; at least one chrome-clipped display line above the fold; zero box-shadow with a chroma color (shadows are ink-blue at 22% opacity or less).

## The variation contract (why two AN 2000 sites are siblings, not clones)
WORLD LAW — never renegotiated by brief or builder:
- Sky-gradient grounds, vertical only, hue locked 195–215, lightness never below the #B7D4EC floor.
- The chrome recipes (silver clip on display type, capsule buttons, bezels) and the glossy-orb recipe, exactly as specified below.
- Specular-not-emissive: highlights, sheens and flares only; no outer glows of any color, ever.
- Michroma/Gruppo uppercase display register; Exo 2 body.
- Motion personality: glossy zooms + orbit loops; one scrubbed showpiece; one flare sweep.
- Bubblegum #F27BC1 rationed to two moments maximum; drawn imagery only.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact sky stops inside the corridor (dawn-pale #F4FAFE→#E2F0FA vs fuller #EAF4FB→#CFE6F6 — different mornings).
- The display face WITHIN the register: Michroma (dense, mechanical, confident) or Gruppo (thin, airy, dreamy) — one per site, never both as display.
- The ORBITAL CONCEPT: what the orbs ARE for this client — destinations, coins, pearls, lenses, satellites, molecules. The concept names the hero object, the showpiece, the captions and the copy metaphors. An AN 2000 page with anonymous decorative bubbles is a failure: name what orbits FIRST.
- Hero composition, section order beyond the fixed opening/closing, the choice of scrubbed showpiece from LES GESTES, and where the two bubblegum moments land.

## The vibe (voice)
The register is a friendly launch announcement from a future that arrived on schedule. Short declaratives, second person, light wonder, zero irony and zero fear-selling. Example lines (the demo's language is English):
- "The sky is the network."
- "Land connected. Tokyo, Tangier, Tulum — one plan, one sky."
- "This is the future we were promised. It installs in ninety seconds."
Never say "revolutionary", "seamless", "unleash" or "game-changing". No exclamation marks in body copy; one is permitted per page, in a chip. Prices are stated plainly in the local currency, next to the thing they buy.

## Visual signatures (owned tics — reproduce these exactly)
- CHROME TEXT (owned tic): display lines clipped to a 7-stop vertical silver gradient — linear-gradient(180deg, #FDFEFF 0%, #EFF5FA 20%, #C9D6E3 38%, #8FA6B8 50%, #DFEAF3 56%, #AFC2D2 78%, #F4F9FD 100%) — via background-clip: text with transparent color, finished with filter: drop-shadow(0 1px 0 rgba(255,255,255,.85)) drop-shadow(0 3px 8px rgba(20,38,75,.22)). The hard #8FA6B8 midline at 50% is the horizon reflected in the metal; without it the text reads gray, not chrome. Reserved for: one hero display line, prices, big stats, and the footer monument — always at 2rem or larger. Below ~1.4rem the silver clip is illegible: small chrome wordmarks (the nav logo, in-screen logos) take the GUNMETAL variant instead — linear-gradient(180deg, #8FA6B8 0%, #5F7A93 32%, #14264B 50%, #3D5378 62%, #8FA6B8 100%), same clip, drop-shadow(0 1px 0 rgba(255,255,255,.7)). Body text is never chrome.
- CHROME BUTTONS (owned tic): capsules — buttons, chips and pills consume var(--radius) directly (the full 999px pill), background the SOFT-HORIZON gradient — linear-gradient(180deg, #FAFDFF 0%, #DEE9F1 46%, #C3D3E1 52%, #EBF2F8 100%) — border 1px solid rgba(20,38,75,.28), box-shadow inset 0 1px 0 #FFFFFF, inset 0 -2px 4px rgba(20,38,75,.14), 0 4px 12px rgba(20,38,75,.16). The hard #8FA6B8 horizon is FORBIDDEN on buttons and chips — at small sizes it reads as a strikethrough behind the label (measured failure); it lives only in chrome TEXT and porthole bezels. Label in ink, display face, 11–13px, +0.14em tracking, uppercase. Hover/focus-visible/active: a specular band (a 40%-wide white gradient stripe skewed 18–24°) sweeps across in 0.5–0.7s. The primary CTA is the aqua glossy variant: same geometry, body radial-gradient(circle at 32% 25%, #FFFFFF, #A8D8F8 22%, #58B6F0 55%, #2E86CC 100%), label #FFFFFF.
- GLOSSY ORBS (owned tic): circles built as radial-gradient(circle at 33% 28%, #FFFFFF 0%, #CFEAFB 16%, #79C4F4 45%, #2E86CC 78%, #1B5E9E 100%), plus a ::before specular ellipse (left 18%, top 8%, width 48%, height 30%, border-radius 50%, white fading to transparent) and box-shadow inset 0 -10px 18px rgba(255,255,255,.35), 0 10px 24px rgba(20,38,75,.18). Silver variant swaps the body for the chrome stops; pearl variant for #FFFFFF/#E9F2F9/#C9D6E3. Orbs are buttons, feature icons, price bubbles, planets — always with the sheen, never flat.
- CHROME ORBIT RINGS + LENS-FLARE SPARKLES (owned tic): SVG ellipses, stroke a linear silver gradient (#F4F9FD→#8FA6B8→#E6EFF6), stroke-width 2.5–3.5, rx:ry between 1:0.30 and 1:0.42, tilted −18° to +22°, always AROUND a glossy hero object. Sparkles are 4-point stars (two crossed tapered lozenges, white core, faint #58B6F0 tips), 12–28px, placed ON ring edges and chrome letter corners; 3–6 per page, popping (scale 0→1, power2.out, 0.35s) at composition moments. At least one hero sparkle pops DURING THE LOAD-IN (as the hero settles, ~1.1–1.3s in) and STAYS LIT — the hero law's sparkle must exist in the live state at load, never only mid-scrub. The flare is ONE white diagonal band (rotate 20–26°, width 130% of its scene) that sweeps across the hero object exactly once per page. Rings are jewelry, never science: no labels, no dots, no coordinates.
- BEZEL PORTHOLE PANELS: this world's card. Wrapper with 2px of the chrome gradient as its background (the bezel), inner surface radius 24–40px filled linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.66)) over the sky, plus one inset top highlight. Shadow: 0 12px 32px rgba(20,38,75,.12) maximum. Never a flat white card, never backdrop-blur.
- CAPSULE CHIPS: labels, tags and small data live in chrome capsules, 999px radius, 10–12px display-face uppercase, +0.14–0.2em tracking; a featured chip may take the aqua glossy body. Chips never float as bare letter-spaced text on ground.
- HAIRLINES: rgba(20,38,75,.14) at 1px for rules, connectors and dividers; a chrome gradient hairline (2px) marks the nav bottom and the footer top.

## Color physics
- GROUND: the sky corridor. Every section ground is a VERTICAL gradient between stops picked from the #F4FAFE / #EAF4FB / #E2F0FA / #D6E9F6 / #CFE6F6 / #C6E0F2 register; lightest stop on top (light comes from the sky). Adjacent sections shift their stop pairs so the page breathes light→fuller→light; the deepest floor is #B7D4EC and it may appear only once, mid-page. Hue stays 195–215 — no purple drift, no teal drift.
- INK: deep blue #14264B, never black. Secondary text #3D5378. Ink on the sky must always clear 7:1 on body sizes.
- CHROME: the #EFF5FA / #C9D6E3 / #8FA6B8 stop family, used ONLY inside the chrome recipes above — chrome is a material, not a paint; no flat element is ever colored #8FA6B8.
- ACCENT: aqua #58B6F0. Budget: the primary CTA body, one featured chip per section maximum, link color, focus ring, sparkle tips, small meters. Aqua never covers a section ground.
- BUBBLEGUM: #F27BC1, rationed to ≤2 moments per page (a "most popular" chip, a sunset horizon band, one accent word). Raw #F27BC1 is allowed only on SMALL elements (chips, one word); across a wide band it must soften to the #F2B3DA/#EFA3D2 haze register (the measured sunset peak) or it reads hot-magenta, not dawn. It may gradient only toward white or toward the sky-pink #F6DFEE/#F9D3E8 — NEVER toward blue or violet (that adjacency is the vaporwave cliché and it is banned).

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · specular white→--primary-foreground · fuller sky stop→--secondary · BUBBLEGUM→--accent · secondary-text ink→--muted · ink at 14%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, sheen or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- GRADIENT LAW: gradients exist as (1) section-ground skies, (2) chrome/gloss material recipes, (3) the single sunset moment. Nowhere else — no gradient borders, no rainbow text, no radial washes behind sections.
- SHADOWS: always rgba(20,38,75, .10–.22), always downward, blur ≤32px. Colored shadows are emission and emission is banned.

## Typography system
- DISPLAY: Michroma or Gruppo (Google Fonts), ONE per site, always uppercase, weight 400 (both are single-weight). Michroma is EXTREMELY wide (~1em average advance): the hero rides clamp(2.05rem, 4.6vw, 4rem) and holds only ~13 characters per 535px column — break headlines into 2–4 SHORT stacked lines rather than shrinking the size; section titles clamp(1.45rem, 3vw, 2.4rem), tracking +0.02–0.08em. Gruppo is thin and airy — it may ride larger, clamp(2.8rem, 8.5vw, 7rem), tracking +0.06–0.16em. Display line-height 1.04–1.18. Whichever face is not chosen for display may serve as the label/chip face.
- BODY: Exo 2, weights 300–600, 1rem–1.125rem, line-height 1.6–1.75, max measure 34em. Emphasis is weight 600 or the aqua accent — display faces never set body copy, body face never sets the wordmark.
- NUMERALS AND PRICES: display face with the chrome clip; currency affixes at 50–55% size, top-aligned. Big stats ride clamp(3rem, 9vw, 7.5rem). CURRENCY GLYPH LAW: Michroma and Gruppo have no usable euro glyph — every currency symbol is set in Exo 2 weight 600 (a small span inside the display lockup); never let the display face render a currency sign.
- ITALIC: never in display. Exo 2 italic is allowed for at most one attribution line per page.
- LABELS: 10–12px uppercase, +0.14–0.2em tracking, ALWAYS inside a capsule chip — never floating on bare ground (that whisper is ECRIN's).
- ARABIC PAIRING RULE: if the page serves Arabic, display becomes Zain 700/800 or Cairo 800 (chrome clip still applies), body becomes Cairo or Tajawal 300–600; letter-spacing drops to 0 everywhere (Arabic is never tracked), the airy feel moves into word-spacing 0.06–0.1em and line-height 1.9; capsules and chrome behave identically, direction rtl.

## Signature art / components (the imagery system — all drawn, no photography)
- The world's imagery is CSS/SVG chrome-gloss OBJECT MAKING: orbs (recipes above), capsule pods, chrome rings, 4-point sparkles, horizon lines (1px hairline with a paler sky below), drawn device mockups, drawn UI vignettes. Perspective is frontal and floaty — objects hang in sky above a soft ink-blue shadow, never grounded, never isometric, never 3D-engine renders.
- DRAWN DEVICES: phones/screens are rounded rectangles (radius 36–48px) wrapped in a 3–4px chrome bezel, screen filled with the sky gradient carrying a tiny drawn UI: one big number, one arc meter (SVG stroke arc in aqua on a hairline track), one capsule button. Every drawn scene carries role="img" and a real aria-label in the page's language.
- ORB ICONOGRAPHY: feature icons are glyphs INSIDE glossy orbs — a globe of two crossed meridian arcs, a signal of three nested arcs, a download arrow, a checkmark — drawn as 2px rounded ink strokes on the orb's upper-left, below the specular ellipse. Never icon fonts, never emoji, never pixel grids.
- BUTTONS: chrome capsule (secondary) and aqua glossy capsule (primary), recipes above; text links are ink with a 1px aqua underline that thickens to 2px on hover/focus.
- FORMS: fields are capsule inputs (999px radius, white at 85% over the sky, 1px rgba(20,38,75,.28) border, inset 0 1px 0 #FFF), labels as small capsule chips above, focus ring 2px #58B6F0 offset 2px. Phone-first: the tel input leads, inputmode and autocomplete set. Selects for structured choices (destination, plan). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail, then show an honest success state: a chrome-ring check orb, a plain next step ("Your QR code is on its way — installing takes about ninety seconds."), no confetti. Include one off-canvas decoy input with attribute data-wandit-hp that the page's own script never reads, writes or styles.
- FAVICON: inline SVG data URI — a glossy aqua orb with a white specular dot on the #EAF4FB sky.

## Page chassis
- FIXED OPENING (hero law): the first viewport must contain, together: one chrome-clipped display line, one named glossy hero object (a giant orb, an orb system, a fleet), at least one chrome orbit ring, at least one sparkle VISIBLE AT LOAD in the live state (a scrub may add sparkles later but may never hide them all at load; when the stage restacks below the fold under 1024px, a sparkle pinned to a chrome letter corner of the display line carries the law), and the lightest sky stop at the very top. The nav is a full-width bar (no pill container) on near-solid sky rgba(244,250,254,.96) WITHOUT blur, chrome-hairline bottom edge, gunmetal wordmark left, 3–5 real anchor links, one chrome capsule CTA right.
- FIXED CLOSING: the lead form inside a large bezel porthole panel (form law above), then the monument footer — the wordmark chrome-clipped at clamp(4rem, 17vw, 13rem) over the page's deepest allowed sky, one chrome hairline above it, legal line in 12px Exo 2.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent sections with the same skeleton:
  · LA VOLÉE DE CAPSULES — a chip cloud: 12–24 chrome capsules (destinations, features, sizes varied 0.9–1.3×), 1–2 featured in aqua gloss, beside a sticky rail title.
  · L'ESCALIER — 2–4 steps as bezel porthole cards descending a diagonal, orb icons on top edges, one chrome swoosh underlay connecting them.
  · LA VITRINE À BULLES — offers/prices as capsule cards each crowned by a docked glossy orb, vertical offsets staggered ±2rem, chrome prices.
  · LE PANNEAU APPAREIL — a drawn device center-stage with 3–4 capsule callouts hairline-connected around it (callouts stack below on mobile).
  · L'HORIZON ROSE — the rationed interlude: a wider sky band whose base gradients into bubblegum, a pale sun orb sitting ON the horizon hairline, one short display quote. This spends a bubblegum moment.
  · LA COURSIVE FAQ — questions as capsule accordion rows (native details/summary), chrome plus-glyph rotating 45° when open, answers in body face.
- RHYTHM: section padding clamp(4.5rem, 10vh, 8rem); tighten the seam around a staircase section to clamp(2.5rem, 6vh, 4.5rem) so its diagonal void does not become a dead zone — and park 1–2 sparkles plus one small pearl orb in that void. Inner containers 1140–1280px; showpiece scenes and the horizon band may bleed full-width. Never two adjacent stacked-center-text sections.
- MOBILE DISCIPLINE: every grid child gets min-width: 0 — nowrap capsule chips otherwise force track growth past 390px (measured failure). Orbit captions restack as a static chip row under the stage; staircase offsets flatten to a single column.

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs; gate everything)
GOVERNING LAW: every hidden state is set via gsap.set, NEVER in CSS — with scripts dead the page is complete, readable and composed (orbs parked at their designed positions, captions open, flare resting as a faint 25% sheen). Gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion).
- PERSONALITY: glossy zooms + orbit loops. Entrances: scale 0.93→1 with autoAlpha, power3.out, 0.7–0.9s, staggers 80–120ms. Nothing bounces (overshoot is GUIMAUVE's), nothing flickers (VOLTAGE's), nothing steps (HUITBIT's).
- IDLE LOOPS: hero orbs bob ±5–8px on sine.inOut 4–6s alternating; one small satellite orb may circle its ring continuously at 28–40s linear. Loops are few and slow.
- THE SCRUBBED SHOWPIECE: exactly one per page, chosen from the scrub gestes (l'orbite, le rack focus, la goutte de mercure, le relais, le polissage). The seed: L'ORBITE — the hero's orb system pinned for ~150–180% scroll; on scrub the feature orbs travel their chrome rings, EACH PAUSING AT APOGEE to open its caption chip; the lens flare sweeps once in the final third; a sparkle pops as each caption lands — except the load-lit hero sparkle, which RE-GLEAMS (scale 1→1.35→1) at its caption and never returns to zero, so the hero law holds at every scrub position. Below 1024px: no pin — orbs sit at apogee, captions stack statically, idle loops only.
- HOVERS: the specular sweep (0.5–0.7s band across chrome), orb scale to 1.04 with shadow deepening, chip border sharpening — 150–250ms ease, always with keyboard (:focus-visible identical) and touch (:active) parity.
- REDUCED MOTION: the composed still — orbs at apogee, captions open, rings static, flare at rest, no loops. Never blanks.

## Ban list (with the global ban list)
- Neon-tube type, colored glow shadows, electric beam lines, dark glass panels with glowing 1px borders, and ANY backdrop-blur — that is VOLTAGE's language. AN 2000 reflects, never emits: if a box-shadow has chroma, delete it.
- Matte puffy blob containers, inner-shadow "inflation", back.out bounce entrances, squash-and-stretch, candy-stripe dividers — GUIMAUVE's language.
- Soft-shadow floating trust cards on flat white, duotone spot illustrations, pill-tab feature switchers — CLAIR's language.
- Pixel sprites, stepped pixel corners, game-HUD furniture — HUITBIT's language. Never draw a QR as a pixel grid.
- Labeled orbital ellipse diagrams, dotted orbits with moving bodies presented as astronomy, coordinate captions — OBSERVATOIRE's language. Your rings are decorative chrome jewelry.
- Difference-blend chrome, outline/stroked type, sticky card-decks, telemetry voice, rotated crossing marquees, glyph scramble, generative canvases — CINÉTIQUE's language, all of it.
- The 800px pill nav container and halftone-dot gradient hero — CALDERA's; AN 2000's nav is a full-width bar.
- Photography, stock renders, 3D-engine gloss, Apple-style product shots — all imagery is hand-built CSS/SVG.
- Dark or night sections of any kind; ink-colored grounds; "dark mode" toggles.
- Purple/violet anywhere; pink-to-blue gradients (vaporwave); hue outside 195–215 except the two bubblegum moments.
- Grain, noise, paper texture, torn edges — AN 2000 is factory-polished.
- Serif faces in any role; Inter/Roboto/Open Sans anywhere.
- Arch-topped frames (MATIÈRE's geometry) — AN 2000's curve is the capsule and the circle, never the arch.
- Skeuomorphic leather/wood/brushed-metal panels with bolts (CHANTIER owns steel plates) — chrome lives in type, buttons, bezels and rings only, never as big background slabs.

## LES GESTES (moves menu)
- L'ORBITE — the seeded showpiece: pinned hero orb system, feature orbs traveling chrome rings on scrub, apogee caption stops, one flare sweep.
- LE COUP DE FLARE — the page's single lens-flare pass: a white diagonal band sweeps a chrome object in 0.9–1.2s while 2–3 sparkles pop on its edges. Spend it on the object that matters most.
- LA VITRINE À BULLES — pricing/offers as capsule cards crowned with docked glossy orbs, staggered vertically; the featured card takes the aqua orb and (optionally) one bubblegum chip.
- LE PORTHOLE — one giant bezel porthole panel (radius 32–48px) hosting the form, a drawn scene or a stat cluster; the bezel catches a specular sweep when it enters.
- LA VOLÉE DE CAPSULES — the chip cloud: chrome capsules at varied sizes carrying real data, 1–2 aqua glossy featured ones.
- L'ESCALIER — steps as porthole cards descending a diagonal with orb icons and one chrome swoosh underlay; entrances cascade down the stairs 120ms apart.
- LE MIROIR — the monument wordmark: chrome-clipped display at 12–17vw as the footer (or, inverted, as a bottom-anchored hero), receiving one slow specular sweep when scrolled into view.
- L'HORIZON ROSE — the sunset interlude (chassis spec): the sun orb half-clipped on its horizon hairline, one display quote above. One per page maximum; spends a bubblegum moment.
- LE RACK FOCUS — scrub showpiece: 3–5 soft out-of-focus sky discs sharpen and converge into one crisp glossy orb as you scroll; captions resolve after the image does.
- LA GOUTTE DE MERCURE — scrub showpiece: liquid-metal blobs (chrome-filled circles) slide and merge into the wordmark or a hero glyph, sparkle popping at the weld points when assembly completes.
- LE RELAIS — scrub showpiece: a small capsule or orb hops along chrome arcs between 3 content anchors (masts, cities, steps), each landing opening a stat chip with a sparkle.
- LE POLISSAGE — scrub showpiece: one wide specular band sweeps across a row of pearls/orbs; each orb gleams as the band crosses it and reveals its caption in sequence.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- NOVA MOBILE (the shipped demo — eSIM travel data, Amsterdam): orbital concept "destinations". Hero: copy left, the pinned orb system right — an aqua planet in two tilted chrome rings, three destination orbs. Showpiece: l'orbite — orbs travel to apogee on scrub, captions opening one by one, flare in the final third. Middle: chip cloud, staircase, bubble pricing, phone panel, pink-horizon quote. Mood: clear morning, packed suitcase.
- LUMEN OPTICS (optician): concept "the lens". Hero: one GIANT centered glossy lens-orb holding the wordmark, headline split above and below, one wide ring threading behind. Showpiece: le rack focus — blurry sky discs sharpen inside the lens on scrub, then eye-test chips resolve. Mood: crisp clinical brightness.
- CLOUDPAY (fintech product): concept "coins". Hero: a full-width horizon panorama — the headline ON the horizon hairline, a fleet of small silver coin-orbs at varied depths. Showpiece: "la fontaine" (le relais reworked) — coin-orbs hop chrome arcs into a drawn card slot, a chrome counter rolling up as each docks. Mood: playful trust, allowance-day lightness.
- ORBITA LEARN (online courses): concept "the sunrise". Hero: a diagonal composition — display words stacked on a rising baseline, a pale sun orb cresting its top end, course chips below. Showpiece: "le lever" — the sun orb climbs the diagonal on scrub, the sky warms one register stop, chips lighting as its line reaches them. Mood: dawn of a semester.
- PING (dev tool): concept "mercury". Hero: bottom-anchored — the chrome wordmark monumental at the viewport's BASE (le miroir inverted), short copy top-left, vast sky between. Showpiece: la goutte de mercure — liquid chrome blobs pour down and weld into the wordmark, sparkles at the joints. Mood: quiet confidence, tool-as-object.
- PEARL DENTAL (dentist): concept "pearls". Hero: asymmetric two-column — a tall porthole appointment card left, headline upper right over five clustered pearl orbs. Showpiece: le polissage — a slow specular band crosses the pearl row, each orb gleaming and opening a care caption. Mood: clean gleam, kind clinic.
- SKYLINE ISP (telecom): concept "the relay". Hero: a drawn pale-blue skyline across the viewport base, the headline chrome in the sky above, one satellite orb mid-crossing a long flat ring. Showpiece: le relais — a signal capsule hops mast to mast along chrome arcs, each hop popping a sparkle and a coverage chip. Mood: civic future, the city online by morning.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: (1) THE CHROME MUST READ AS CHROME — the full 7-stop recipe with the hard #8FA6B8 horizon line and the drop-shadow finish; flatten it and the world collapses into a gray template. (2) THE SKY DISCIPLINE — vertical gradients inside the corridor, lightest at top, breathing between sections; one rogue flat-white or dark band and the morning is gone. (3) SPECULAR-NOT-EMISSIVE — one colored glow anywhere and you are a cheap voltage. The cheap details that separate this from a generated page: sparkles placed on actual edges (ring rims, letter corners); the flare spent on the most important object; prices set in chrome; the sun orb half-clipped by its horizon hairline; capsule chips carrying real data; the success state that tells the visitor exactly what happens next. When in doubt, add one more specular highlight — reflection is this world's warmth.`,
	energy: "medium",
	family: "retro-y2k",
	// clair: trust meets optimism — consumer apps · huitbit: the 2000s console — gaming brands
	fusesWith: ["clair", "huitbit"],
	id: "an2000",
	industries: [
		"car dealer",
		"mobile app landing",
		"telecom / ISP",
		"SaaS product",
		"electronics / gadgets",
		"AI product",
		"startup (pre-launch / waitlist)",
		"fintech product",
		"online courses / e-learning",
		"multi-product shop",
		"optician",
		"dentist",
		"dev tool",
	],
	kind: "website",
	mood: ["optimistic", "glossy", "airy", "utopian"],
	name: "An 2000",
	preview: {
		accent: "#58B6F0",
		fontFamily: "Michroma",
		ground: "#EAF4FB",
		ink: "#14264B",
		sampleWord: "an 2000",
	},
	priceFeel: "accessible",
	tagline: "L'an 2000 tel qu'on l'a rêvé : ciel, chrome, bulles.",
};
