import type { DesignWorld } from "../types";

/**
 * HUIT-BIT — the arcade cabinet.
 * Family: pixel-arcade. Strict 8px grid, sprite art drawn in code, game-HUD
 * furniture, motion in sprite steps — steps(8), never smooth. Nostalgia
 * executed with craft discipline. The doc is appended VERBATIM to the
 * builder system prompt.
 *
 * fusesWith rationale:
 * - phosphore: the terminal walks into the arcade — one machine culture,
 *   two screens (command line meets cabinet).
 * - voltage: arcade night — gaming venues where the cabinet glow meets
 *   the neon sign outside.
 */
export const huitbit: DesignWorld = {
	avoidFor: [
		"aesthetic clinic",
		"notary",
		"wedding services",
		"spa / hammam",
		"financial advisor",
	],
	doc: `# DESIGN WORLD: HUIT-BIT — the arcade cabinet

## Philosophy
This page is an ARCADE CABINET, not a website: a dark violet machine in a dark room, marquee lit coin-yellow, one game running inside it. First structural fact: a STRICT 8px PIXEL GRID governs everything — spacing steps, border weights, corner staircases, sprite cells. Nothing is ever rounded, blurred, feathered or soft: a curve is a staircase, a shadow is a darker row of pixels, a gradient is a dither band. Second structural fact: ALL imagery is sprite art drawn on that grid — CSS box-shadow pixel stacks or SVG rect mosaics with shape-rendering: crispEdges — zero photography, zero smooth vector illustration, zero emoji-as-art. Third structural fact: MOTION MOVES IN FRAMES. Every animation advances in visible steps — steps(8) is the house pulse — the way a sprite walks, a score rings up, a cursor blinks. The reference is real 1985 arcade hardware, and real hardware could not fade, could not blur, could not overshoot. The failure modes "dark landing page with a pixel font pasted on" and "purple SaaS template wearing a retro sticker" are structurally impossible here: the grid, the sprites and the stepped motion make the page a MACHINE, not a theme.
Self-audit before shipping (all countable): (1) grep the CSS — zero border-radius above 0, zero blur(), zero backdrop-filter, zero text-shadow, zero linear-gradient; (2) every frame, button and field corner is a stepped clip-path whose steps are multiples of 8px; (3) at least THREE distinct multi-color sprites drawn on the grid, each with role="img" and a real aria-label; (4) one LIVE HUD cluster — a score counter that actually counts and a PRESS START line blinking at 530ms per phase; (5) zero smooth ease names in the motion code (no power, sine, expo, back, elastic) — every tween is steps(n) or snapped linear; (6) no Press Start 2P line longer than 24 characters.

## The variation contract (why two HUIT-BIT sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- The 8px grid: stepped pixel corners on every frame, button and field; every frame, button and field resolves its corners through min(var(--radius), 0px) — this world's corners stay cut; zero blur, zero gradient (dither checkers do the gradient's job).
- Sprite-only imagery, drawn in code on the grid, always depicting the client's actual subject matter.
- steps() motion — the 8-frame sprite step is the world's heartbeat; nothing tweens smoothly, nothing bounces.
- The arcade-violet night ground register with the coin-yellow accent discipline.
- Game-HUD furniture present and working: score counter, hearts or coins, PRESS START blink, level-select cards.
- Press Start 2P / Silkscreen display (rationed hard) + Space Mono body.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The GAME GENRE that skins the page: side-scrolling platformer, top-down RPG map, versus fighter, item shop, handheld console, puzzle grid. The genre chooses the hero composition, the showpiece choreography and the copy metaphors.
- The exact hexes inside each register; whether sprite red or sprite green leads as the semantic second color.
- The sprites drawn: mascot, items, scenery, machines — the client's world pixelated, never generic space invaders pasted onto a pizzeria.
- Display lead: Press Start 2P (heavier, louder, shorter lines) or Silkscreen (lighter, friendlier, longer lines allowed).
- The HUD stats chosen (SCORE, COINS, HP, LEVEL, COMBO, 1UP), the section order beyond the fixed opening and closing, and which 2–3 gestes are played.
A HUIT-BIT page whose sprites could be swapped onto any other business unchanged is a failure: draw the client's world in pixels FIRST, then build the machine around it.

## The vibe (voice)
Arcade-cabinet English (or the brief's language, same register): HUD lines in caps, body copy in plain confident sentence case, numbers everywhere. Game vocabulary maps to REAL business facts and never lies — the menu is a LEVEL SELECT, prices ring up like scores, booking is PLAYER 1 START, the FAQ is a HOW TO PLAY. Register examples: "INSERT COIN. FREE PLAY ALL NIGHT." · "STAGE 2: TWELVE KEG LINES." · "NEW HIGH SCORE — table booked. See you Friday." Rules: at most one exclamation mark per section; no leetspeak, no ironic distance — the machine is played completely straight; every caps line stays under 24 characters; the facts (prices, hours, counts) carry the charm. The continue-screen countdown trope may appear ONLY as looping aria-hidden set-dressing — it never attaches to an offer, a price or availability (fake urgency stays banned).

## Visual signatures
- STEPPED PIXEL CORNERS (owned tic): every frame, button, card and field cuts its corners as an 8px staircase via clip-path. Two registers — single step: polygon(0 8px, 8px 8px, 8px 0, calc(100% - 8px) 0, calc(100% - 8px) 8px, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 8px), 0 calc(100% - 8px)) — and double step (16px+8px staircase) for hero frames and showpiece panels. Store both as custom properties; reuse everywhere. CONSTRUCTION LAW: a clip-path SEVERS any CSS border at every corner step, so a thin border + cut renders as four floating strokes. Any visible thin bezel (2–4px chips, ghost buttons, coin frames, success cards) is built TWO-LAYER: the element's background IS the bezel color, an inset ::before (inset = bezel weight, same cut, isolation:isolate on the host, z-index:-1 on the pseudo) paints the fill, content above. State swaps flip the layer colors instantly — never a border-color transition. Only dark 4px panel borders on dark grounds may keep single-element borders (their corner gaps read as pixels, not breaks).
- 8px-GRID SPRITES (owned tic): 16×16 to 32×24 cell art, 2–5 palette colors per sprite plus a 1-cell outline in the pit tone #0E081F. Built either as one box-shadow stack on a var(--px)-sized div (--px between 4px and 8px per placement) or as SVG rects on an integer viewBox with shape-rendering: crispEdges. Minimum three sprites per page; every sprite depicts the client's subject.
- GAME-HUD FURNITURE (owned tic): a persistent or recurring HUD strip — SCORE with leading zeros (000450), a heart or coin row of 16×16 sprites, HI-SCORE label, LEVEL indicator — set in Press Start 2P at 0.6–0.75rem. PRESS START blinks at 530ms per phase, hard on/off, no fade.
- THE CABINET EDGE: depth without shadow — panels and buttons carry a solid darker BOTTOM band of 6–8px (a border-bottom in the tone's shade, e.g. coin #FFD23F over #C99B23). On :active the band collapses to 2px and the element translates down 4px: the arcade-button press. Never a dual-axis offset shadow (that is BLOC's tic) and never any blur.
- DITHER BANDS: transitions between ground tones use 2–3 rows of 8px checkerboard dither (repeating-conic or two layered SVG rect rows) — the only "gradient" this world knows.
- HAIRLINES DON'T EXIST: rules and borders are 2px minimum, usually 4px, in ink #F2F0FF at full opacity or in the panel shades. Pixels are never translucent.
- LEADING-ZERO NUMERALS: every count, price total and stat renders arcade-style — 000012 CABINETS, £06.50 stays £6.50 in shop rows but stat counters pad to six digits.

## Color physics
- GROUND: the arcade-violet night register #191036 / #150C2E, alternating per section; the PIT #0E081F for the showpiece scene, sprite outlines and the footer. The alternation plus a dither band between tones IS the section rhythm.
- PANELS: the raised register #241847 / #2A1D52 / #3A2B6E — cards, HUD chips, level tiles. Panels sit on ground with a 2–4px ink or shade border, never a shadow.
- INK: #F2F0FF for text; support grey-violet #B9B4D6 for secondary copy only — never for HUD lines.
- COIN YELLOW #FFD23F (shade #C99B23) is THE accent. Budget: CTAs, score numerals, active states, the blink line, one accent word per major headline, sprite gold. If a viewport is more than ~10% coin, mute something.
- SPRITE RED #FF5757 (shade #C13B45) and SPRITE GREEN #43D66C (shade #2C9B4E): SMALL doses with game semantics only — hearts and SOLD OUT in red, 1UP and success and OPEN in green. Never section grounds, never paragraphs, never both leading at once: the brief picks one to dominate.
- Gradients, glows, translucency and blur DO NOT EXIST. Light is a lighter pixel; shade is a darker pixel; between two tones sits a dither. ::selection is coin on violet.
FIXED TOKEN MAP — GROUND→--background · INK→--foreground · COIN YELLOW→--primary · PIT→--primary-foreground · PANELS→--secondary · the leading sprite color→--accent · support grey-violet→--muted · INK at 100%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, shade or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Press Start 2P (400 — its only weight), rationed like sugar: headlines of 1–3 short lines, max 24 characters per line, line-height 1.4–1.5, letter-spacing 0.02em. H1 register clamp(1.5rem, 4.5vw, 3.25rem); H2 register clamp(1.2rem, 3vw, 2.1rem). Alternative display: Silkscreen (400/700) for friendlier builds and mid-length lines — the brief picks ONE lead, the other may serve sub-display duty (stat labels, card titles).
- BODY: Space Mono 400/700, 1rem/1.65, measure 46–60ch, sentence case. Space Mono never sets display sizes above 1.5rem.
- KICKERS / HUD LABELS: Press Start 2P at 0.6–0.75rem, +0.12em tracking, coin yellow, uppercase.
- NEVER italic anywhere — pixels do not slant. Emphasis is coin color, 700 weight, or caps. Never letter-space Press Start 2P beyond 0.04em (it shatters).
- Arabic pairing (if the world serves an Arabic page): Press Start 2P and Space Mono have no Arabic — display becomes Noto Kufi Arabic 700 (geometric Kufi reads pixel-adjacent), body becomes IBM Plex Sans Arabic 400/700; mirror the HUD for RTL; the grid and corners are unchanged.

## Signature art / components
- SPRITE CONSTRUCTION: define the pixel map first (16×16 default; 24×16 or 32×24 for hero mascots). CSS route: a var(--px) square div whose box-shadow list places every pixel at calc(col * var(--px)) calc(row * var(--px)) 0 0 color; wrap in a sized container. SVG route: viewBox="0 0 16 16", one rect per pixel run, shape-rendering="crispEdges", scale freely. Every sprite: role="img" + real aria-label in the page's language ("Pixel-art pint of pale ale"). Subjects come from the brief: the mascot, the product, tools of the trade, scenery tiles (clouds, hills, bricks), a flag, a coin (4-frame spin cycle).
- BUTTONS: coin-yellow fill, pit-violet text, single-step corners, 6px #C99B23 bottom edge, Press Start 2P 0.7rem label; hover is an INSTANT inverse swap (violet fill, coin text, coin 2px border) — 0ms or one 80ms steps(1) hold, no transition curve; :active presses down 4px. Ghost variant: transparent fill, 2px ink border, ink text.
- LEVEL-SELECT CARDS (HUD furniture): panel ground #241847, double-step corners, a sprite thumbnail, STAGE numbering (STAGE 1-1), Silkscreen title, Space Mono stats, difficulty as 1–3 heart or star sprites, price as score. Locked/available states allowed when honest (COMING SOON = locked, padlock sprite).
- HUD CHIPS: micro labels in Press Start 2P 0.6rem inside single-step boxes with 2px borders — the world's only label form; never floating letter-spaced whispers on bare ground.
- FORMS: the high-score entry. Fields as single-step boxes with 3px ink bezels, panel fill, Space Mono input text — inputs/selects/textareas cannot take pseudo-elements, so wrap each in a .px-box (display:block; background: the bezel color; the cut; padding:3px) and cut the control inside it; labels above in Press Start 2P 0.6rem coin; :focus-within swaps the box background to coin (instant). Phone-first: tel input first or most prominent; selects for structured choices (date, party size). Honest success state: a NEW HIGH SCORE screen — the visitor's name slots into a 3-row high-score table, a green 1UP sprite pops, and a real next step is stated ("We call back within 24h. CONTINUE?"). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail; include one off-canvas decoy input with data-wandit-hp that the page's own script never touches.
- :focus-visible: 3px solid coin outline, offset 3px (the one un-stepped rectangle — accessibility outranks the grid). Decorative sprites aria-hidden; one h1; semantic landmarks.
- FAVICON: inline SVG data URI — a coin or invader sprite in coin yellow on #191036.

## Page chassis
- Container: max-width 1200px, padding-inline clamp(1rem, 4vw, 3rem). Section rhythm: padding-block clamp(4.5rem, 10vh, 7.5rem). Showpiece and footer may bleed full-width.
- HEADER: the HUD bar — wordmark (sprite glyph + name) left, nav and a live score counter right; solid ground fill (no translucency, no blur), 2–4px bottom border. May be sticky only as a solid bar.
- FIXED OPENING — the TITLE SCREEN law: the hero is the game's attract mode. It must contain the wordmark at display scale, at least one hero sprite, one HUD element, and the PRESS START CTA blinking at 530ms. Composition varies by geste (centered stack, item-shop split, level-grid, versus halves…) but those four ingredients are law. The hero states the business plainly in one Space Mono line — the machine never hides what it does.
- FIXED CLOSING: the CONTINUE? section — headline "CONTINUE?" register, the high-score entry form, honest contact facts (phone, address, hours as an OPENING TIMES table); then the GAME OVER footer: pit ground #0E081F, giant wordmark, credits-roll styled links, © line as "CREDITS".
- FREE MIDDLE (compose 3–5, never two adjacent sections with the same layout): level-select grid of offers · the pinned showpiece (le niveau) · HUD stat band with counting scores · versus/roster section (mirrored player-select columns) · item shop (menu/prices as sprite rows with coin prices) · tournament ladder (events/schedule as bracket or schedule table) · cutscene strip (3–4 sprite panels telling the story).

## Motion identity (GSAP 3.12 + ScrollTrigger via cdnjs UMD)
GOVERNING LAW: gate every animation on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Hidden states set ONLY via gsap.set — never opacity:0 in CSS; with JS dead the page is a complete, readable, fully-drawn machine.
- EASE LAW: the house ease is steps(n) — "steps(8)" for entrances, steps(2)–steps(4) for blinks and swaps. Linear is allowed ONLY as a scrub's spine, and every scrubbed position snaps to the 8px grid (snap or a rounding modifier). No power, sine, expo, back, elastic — one smooth tween breaks the machine.
- ENTRANCES: the sprite pop — elements arrive over 0.3–0.6s in 6–8 visible frames, translating 24–48px VERTICALLY in stepped increments; staggers 60–120ms. Horizontal entrance offsets are banned: pre-entrance x-shifts on full-width blocks widen the document and break the zero-overflow law. HUD counters boot by counting up with snap: 1. Section headlines may swap on like a screen refresh (one-frame appear after a 2-frame delay) — never a fade.
- BLINKS: 530ms per phase, hard on/off (steps(1) alternation) — PRESS START, the continue arrow, active card cursors.
- THE SHOWPIECE — LE NIVEAU (seed): ONE pinned, scroll-scrubbed game scene expressing the client's world. Canonical form: a side-scrolling pixel level traverses over 2.5–3.5 viewport-heights of scrub — scenery layers parallax at 0.25/0.5/0.75 of scroll speed (positions snapped to 8px), a sprite walks in a 2–4 frame cycle, collects the offer's items (each pickup blinks out and rings the HUD score +100 with a stepped count), and reaches a flag or door at the CTA. The genre may reskin the choreography (climb, insert, assemble, traverse a map) but there is exactly ONE showpiece per page. Mobile: shorter traverse or a non-pinned auto-stepping version. Reduced motion: the level rendered as its most complete still — all items collected, score final, flag raised.
- HOVERS: instant state swaps with keyboard/touch parity — no transition curves, no lifts, no glows. A card's cursor sprite (▶ drawn as pixels) appears beside the hovered/focused item in one frame.
- The score never lies: counters count to REAL numbers from the copy.

## Ban list (the global ban list applies; these are HUIT-BIT-specific)
- Prompt-line furniture ($, >, ~), blinking block cursors, typed-text steps() reveals for headings, ASCII/box-drawing frames, CRT scanline vignettes — that is PHOSPHORE's language (huitbit steps MOTION, never types TEXT).
- Neon-tube glow, multi-layer text-shadow, electric beam lines, dark glass panels, backdrop-blur — that is VOLTAGE's language.
- Chrome/metal bevels, glossy aqua orbs, lens flares, specular highlights — that is AN2000's language.
- Torn-paper edges, misregistered print layers, tape strips, ransom-note letters — that is FANZINE's language.
- Memphis confetti fields, colored offset shadows, squiggle underlines — that is TUTTI's language.
- Dual-axis hard offset shadows on interactive elements — that is BLOC's tic; huitbit depth is the bottom cabinet edge only.
- ANY border-radius, ANY blur, ANY gradient, ANY translucency below 100% opacity (dither is the only tonal transition).
- Smooth easing of any kind; overshoot; parallax that drifts un-snapped.
- CRT skeuomorphism: screen curvature, chromatic aberration, phosphor glow, vignettes.
- Photography, smooth vector illustration, emoji as sprites, isometric or voxel 3D — this world is flat 2D sprite art only.
- Terminal faces (VT323 and kin) — the terminal voice belongs elsewhere.
- Skeuomorphic cabinet textures: wood grain, realistic joysticks, plastic renders.
- Fake game mechanics tied to urgency or scarcity (countdowns on offers, "3 lives left" pricing).
- Synthwave sunset palettes (pink-cyan grids, horizon suns) — different decade, different world.

## LES GESTES (moves menu)
- L'ÉCRAN TITRE — the centered title-screen hero: wordmark stack, mascot sprite below, PRESS START blinking, a © attract-mode line at the bottom edge like real cabinet copy. The classic opening; play it straight.
- LE LEVEL SELECT — offers as a grid of stage cards with STAGE numbering, sprite thumbnails, difficulty hearts and honest locked states. Works as hero (the grid IS the opening) or as the first middle section.
- LE NIVEAU — the canonical showpiece scrub: pinned side-scroller, walking sprite, item pickups ringing the score, flag at the CTA. Own it fully or reskin its choreography to the genre.
- LE COMBAT DE BOSS — a versus section: two mirrored player-select columns (two offers, two rooms, two plans) with pixel portraits and stat bars compared honestly. RED vs GREEN semantics allowed here.
- LA BOUTIQUE D'OBJETS — the item shop: menu or pricing as sprite rows behind a counter — item sprite, name, coin-price, one SOLD OUT tag if true. Prices ring up on hover/focus.
- LE COMPTEUR — a HUD stat band: 3–4 leading-zero counters (years, seats, cabinets, gigs) counting up in stepped snaps when scrolled into view.
- LE PALMARÈS — the high-score table: facts, reviews or milestones as RANK / NAME / SCORE rows in Space Mono, top row in coin. Kills the testimonial carousel forever.
- LA PIÈCE INSÉRÉE — the coin micro-interaction: the primary CTA drops a 4-frame spinning coin sprite into a slot and ticks the HUD coin counter +1. One per page, on the most important action.
- LE 1UP — the success toast: a green 1UP sprite pops in one frame with a short message (form success, copied phone number). Blinks twice, stays.
- LE WARP ZONE — section transitions as dither checker bands, or a drawn pipe/door sprite that anchors a jump-link to a deeper section.
- LA CINÉMATIQUE — the cutscene strip: 3–4 sprite panels in a row telling the story (origin, process, team) with one-line captions — the about section as intermission.
- LA CONSOLE PORTABLE — content framed inside a drawn handheld-console sprite whose screen swaps states on interaction (d-pad steps through offers, screens, menus).
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- BONUS STAGE (arcade bar, Manchester) — Hero: the full title screen, centered wordmark stack over a marquee frame, mascot below, PRESS START blinking, HUD bar live above. Showpiece: the canonical side-scroller — the mascot walks the basement, collects token, pint, pizza-slice and cassette sprites, score rings +100 each, reaches the BOOK A BOOTH flag. Mood: loud night-out warmth, coin yellow leading, red hearts in the HUD.
- COMBO (pizzeria) — Hero: item-shop split — left-aligned display "COMBO" with a Space Mono promise, right a 24×24 pizza sprite spinning in 4 frames over a counter panel; coin counter top-right. Showpiece: the assembly line — a pinned vertical build where topping sprites drop onto the pizza frame-by-frame as you scrub, each landing ringing ORDER UP on the HUD, oven door closing at the CTA. Mood: greedy, fast, green 1UP on order success.
- CARTOUCHE (electronics / gadgets shop) — Hero: the level-select hero — the opening IS a 2×2 grid of cartridge cards (categories as game carts, labels drawn as sprites), wordmark small at top-left in the HUD. Showpiece: the insertion — a cartridge slides INTO a drawn console dock in stepped frames on scrub, power LED flips green, a boot screen types nothing but SWAPS through three product screens frame by frame. Mood: precise, collector-clean, green LED semantics.
- HAUT SCORE (coding bootcamp) — Hero: split hero — left the promise in Silkscreen with an XP bar filling in 8 chunks, right a live high-score table whose top row reads YOU? Showpiece: the climb — a pinned vertical platformer where a sprite ascends platforms labeled with course modules, a LEVEL UP flash at each landing, graduation flag at the top by the apply CTA. Mood: earnest, encouraging, progress made visible.
- DEUX JOUEURS (DJ / entertainment duo) — Hero: the versus hero — two mirrored half-screens in player-select framing, red sprite portrait vs green sprite portrait, names in Press Start 2P, SELECT YOUR PLAYER as the sub-line. Showpiece: the crowd equalizer — a pinned scene where rows of pixel crowd sprites assemble and pogo in steps while a fader sprite travels a timeline of the night (doors, first set, peak, encore), each stop opening a HUD chip. Mood: sweaty, rhythmic, the loudest sibling.
- NIVEAU 99 (streetwear / drops) — Hero: the NOW LOADING hero — a giant 8-chunk loading bar filling to a REAL drop date, wordmark above-left, one garment sprite waiting at the bar's end. Showpiece: the mystery block — a pinned ?-block struck on scrub, cycling item sprites in visible frames, landing on the drop piece as its price rings up on the HUD; no fake scarcity anywhere, the date is real. Mood: cocky, rationed, coin yellow on near-black violet.
- PIXEL FEST (festival) — Hero: the overworld hero — the grounds drawn as a top-down RPG map sprite (stages, food, gates as tiles), the festival name in a HUD dialog box at the bottom edge. Showpiece: the map walk — a sprite travels the map's dotted path on scrub, pausing at each stage tile to open a dialog chip with that stage's lineup, ending at the ticket booth tile by the CTA. Mood: bright chaos held by the grid, red and green both rationed to map semantics.
- APPUI START (mobile app landing) — Hero: the handheld hero — a drawn handheld-console sprite centered, the app's first screen rendered as pixels inside its screen, tagline set left of it in Space Mono with one coin word. Showpiece: the d-pad demo — pinned, each scrub beat presses a drawn button on the console and SWAPS the screen to the next app state in one frame, six states to the store badges. Mood: playful product confidence, the quietest sibling.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the 8px DISCIPLINE (one rounded corner, one blur, one gradient and the machine is broken — grep before shipping), the SPRITE CRAFT (real multi-color sprites of the client's actual world, with outlines and shading rows — colored squares are not sprites, and the sprites ARE the photography budget spent in code), and the STEPPED MOTION (a single smooth ease reads instantly as fake; frames are the world's fingerprint). The cheap details that separate it from a generated page: leading-zero counters that count to real numbers, the 530ms blink, dither bands between grounds, the cabinet-edge press on buttons, the coin drop on the primary CTA, HUD chips instead of floating labels, and aria-labels that describe each sprite honestly. When in doubt, draw one more sprite — pixels are this world's warmth.`,
	energy: "loud",
	family: "pixel-arcade",
	fusesWith: ["phosphore", "voltage"],
	id: "huitbit",
	industries: [
		"DJ / entertainment",
		"venue / salle des fêtes",
		"festival",
		"electronics / gadgets",
		"multi-product shop",
		"streetwear / drops",
		"fast food",
		"pizzeria",
		"coding bootcamp",
		"music / band",
		"dev tool",
		"mobile app landing",
	],
	kind: "website",
	mood: ["loud", "nostalgic", "playful", "precise"],
	name: "Huit-Bit",
	preview: {
		accent: "#FFD23F",
		fontFamily: "Press Start 2P",
		ground: "#191036",
		ink: "#F2F0FF",
		sampleWord: "INSERT COIN",
	},
	priceFeel: "accessible",
	tagline:
		"La borne d'arcade : pixels au cordeau, HUD de jeu, nostalgie disciplinée.",
};
