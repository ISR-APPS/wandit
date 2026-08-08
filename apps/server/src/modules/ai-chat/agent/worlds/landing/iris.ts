import type { DesignWorld } from "../types";

/**
 * IRIS — the product at night.
 * Fills the dark-product-SaaS genre (Linear/Firstbase territory) in the
 * library. A violet-tinted near-black stage where the client's PRODUCT UI is
 * the only actor: drawn HTML/CSS mock-UI panels lit by ONE soft iris aura.
 * Quiet confidence — a well-run changelog, never a hype site.
 * fusesWith bridges: phosphore (the terminal ships a product — dev-tool
 * brands with CLI souls) · clair (one product, day mode and night mode).
 */
export const iris: DesignWorld = {
	avoidFor: [
		"restaurant (all)",
		"beauty (all)",
		"wedding services",
		"guesthouse / riad",
		"kindergarten / crèche",
	],
	doc: `# DESIGN WORLD: IRIS — the product at night

## Philosophy
This page is A PRODUCT DEMO GIVEN AT MIDNIGHT to one important visitor, not a website. The room is dark, violet-tinted, silent; the product's own screens are the only things that exist, and one soft iris-colored aura behind the hero screen is the only light in the building. Its defining structural fact: the imagery system is DRAWN MOCK-UI — dashboard cards, notification toasts, charts, command bars, status chips — built as real HTML/CSS elements with real invented data, floating in the dark. Never screenshots, never illustration, never 3D renders. Its second structural fact: ONE LIGHT SOURCE — a single soft radial aura behind the hero object is the page's only glow (a second aura at half intensity may exist near the closing CTA; two is the absolute ceiling). Everything else whispers: small type, generous darkness, one accent, air between panels. The page must feel like a well-run changelog — calm, versioned, precise — never a hype site. Structurally impossible failure modes: neon spectacle (light here is soft and single-source), generative canvas art, terminal cosplay, and the gray "dark mode template" (the ground is violet-tinted, never neutral). Self-audit before shipping: exactly one h1; at most 2 radial auras and ZERO other glows; zero <img>/raster/screenshot elements; at least 3 distinct panel species drawn (dashboard, toast, chart, plus command bar or chip rail); every JetBrains Mono glyph lives INSIDE a drawn panel or a chip; zero gradients anywhere except the auras and the one capsule hairline.

## The variation contract (why two IRIS sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Violet-tinted near-black grounds (never pure black, never neutral gray); ivory-violet text.
- Drawn mock-UI panels as the ONLY imagery; real invented data in the page's language and locale.
- The single iris aura: one soft radial glow behind the hero object, max 2 per page, second at half intensity.
- The aurora-hairline capsule: one announcement pill with a 1px gradient border — the only gradient stroke on the page.
- Sora / Instrument Sans register; JetBrains Mono confined to data inside panels, never prose.
- Calm product-logic reveals (toast → panel → chart → counter), 0.5–0.7s power2.out, never a uniform stagger.
- Quiet changelog voice: short declaratives, versions, numbers; zero hype, zero exclamation marks.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The exact hexes inside the registers (ground within #0E0B14–#120E1A, accent within #7C6CFF–#8B7CFF).
- The display face within the register: Sora 600–700 OR Instrument Sans 600 (one per site).
- L'ÉCRAN-MAÎTRE — the one screen the product is proudest of (dispatch board, inbox, payment ledger, uptime monitor, course tracker). It becomes the hero panel, names the showpiece choreography, and decides what every supporting panel shows.
- Hero composition and showpiece choreography, chosen from LES GESTES or invented in their spirit.
- The middle section order, the metrics chosen, the changelog entries, the invented dataset (names, communes, amounts, timestamps).
Name the écran-maître FIRST — it casts every panel on the page.

## The vibe (voice)
Product French with release-note calm. Short present-tense declaratives that state what the product does — never what it promises. Numbers are exact and formatted for the locale ("1 240 colis/jour", "97,4 %"). Version numbers are spoken like proper nouns ("v2.6 — les tournées se planifient toutes seules."). Example register: "Chaque colis sait où il va." · "Pas de promesse. Un tableau de bord." · "L'argent rentre, la nuit aussi." Banned vocabulary: révolutionnaire, incroyable, boostez, exclamation marks, ALL-CAPS shouting, fake urgency. The reader is a professional; the screen does the convincing.

## Visual signatures
- DRAWN MOCK-UI PANELS (owned tic): the product's screens rebuilt as HTML/CSS. Panel ground one step above the page (#171226/#141020 register, 2–6 RGB points up); 1px border rgba(236,234,246,0.09); border-radius 14–18px (hero/showpiece panel 18–20px); inner padding 16–24px; a 1px inset top-edge highlight rgba(255,255,255,0.06). Inner cards step up once more (#1B1530 register, radius 10–12px). Only the HERO panel may carry an ambient shadow: 0 24px 60px rgba(0,0,0,0.35).
- THE SINGLE IRIS AURA (owned tic): one radial-gradient ellipse behind the hero object — lavender #A78BFA at 10–14% alpha at center, transparent by 60–70% radius, 45–60vw wide on desktop (80–90vw at ≤768px), slightly wider than tall. PLACEMENT LAW: the ellipse's bright CENTER sits AT the hero panel's top edge (translate the ellipse up ~55% of its own height) so the crest glows in the darkness above the panel — a center hidden behind the opaque panel reads as an unlit page. It is the page's ONLY light source. A second aura at half intensity (5–7% alpha) may sit behind the closing CTA. Nothing else on the page glows.
- AURORA-HAIRLINE CAPSULE (owned tic): the announcement pill — border-radius 999px, 12–13px text, 1px gradient border built with the padding-box/border-box double-background trick, gradient running #7C6CFF → #A78BFA → rgba(167,139,250,0.15) at ~120deg. The ONLY gradient stroke allowed on the page. One in the hero; one optional reprise in the closing.
- STATUS CHIPS: 999px pills with a 6px round dot (green #3ECF8E or iris) + an 10–11px JetBrains Mono label ("EN LIGNE", "LIVRÉ", "SYNC"). They live inside panels and section labels, and are the page's smallest sign of life.
- SECTION LABELS: Instrument Sans 600, uppercase, 11px, +0.12em tracking, at 65–75% text alpha, ALWAYS preceded by a 6px iris dot (never floating bare on the ground — that whisper belongs to another world).
- CHARTS AS DRAWN SVG: line charts stroked 2px in the accent with an area fill at 6–8% alpha; gridlines rgba(236,234,246,0.05); bar charts 6–10 bars with 3px rounded tops in lavender at 30% alpha with exactly ONE accent bar; axis labels JetBrains Mono 10px. Charts always sit inside a panel.
- Hairlines rgba(236,234,246,0.08–0.12) for every rule and divider; the darkness itself is the layout's main material — panels float in it with generous margins, never edge-to-edge walls.

## Color physics
- GROUND: the #0E0B14/#120E1A register — violet-tinted near-black, NEVER #000, never neutral #111. Sections may alternate between the two register endpoints for rhythm; the difference stays subliminal (≤6 RGB points).
- PANEL GROUNDS: one step up (#141020–#171226), inner cards one more (#1B1530 register). Depth is built by these steps + 1px hairlines, not by shadows.
- TEXT: #ECEAF6 at 100% for headings and key lines; body at 72–80% alpha; captions and labels at 55–70%.
- IRIS ACCENT: the #7C6CFF/#8B7CFF register. Budget: primary CTA fill, chart strokes, one accent word or number per major headline at most, active states, the capsule gradient, focus rings, link color. The accent never floods a section ground.
- SUPPORT LAVENDER: #A78BFA — exists at 10–14% alpha as the aura, at 30% as chart bars, at 100% only in the capsule gradient. Never as text.
- SUCCESS GREEN: #3ECF8E in micro-doses INSIDE mock UI only — status dots, "livré" chips, a positive delta. Never as a page-level accent, never in headlines, never on buttons.
- GRADIENT LAW: gradients exist in exactly two places — the radial auras and the capsule's 1px border. No linear washes on sections, no gradient text, no gradient buttons. Break this and the world collapses into the default AI-startup page.

FIXED TOKEN MAP — GROUND→--background · TEXT→--foreground · IRIS ACCENT→--primary · GROUND→--primary-foreground · PANEL GROUNDS→--secondary · SUPPORT LAVENDER→--accent · text at 72%→--muted · text at 10%→--border · 10px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, aura or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Sora 600–700, letter-spacing -0.02 to -0.035em (the site's one face) — OR Instrument Sans 600 tight as the alternative register, one per site. Hero statement clamp(2.6rem,5.5vw,4.6rem), line-height 1.04–1.12, max 8 words. Section titles clamp(1.7rem,3.2vw,2.8rem). IRIS scale is confident but conversational (~5:1 against body) — the panels are the spectacle, not the type.
- BODY: Instrument Sans 400–500, 15–17px, line-height 1.6–1.7, text columns capped at 34–38rem. Paragraphs short: 2–3 sentences.
- MONO: JetBrains Mono 400–500, 10–13px, ONLY for data inside drawn panels — IDs, timestamps, amounts in rows, chip labels, axis values. Mono NEVER sets prose, captions, headlines or nav; one mono word outside a panel is a leak into another world's territory.
- NUMERALS: metrics get the display face at clamp(2.2rem,4.5vw,3.6rem) with font-variant-numeric: tabular-nums; their units live in small mono chips beside them. Inside panels too: a metric card's big number is display face 600, never mono — any numeral above 13px takes the display face.
- Never italic anywhere. Emphasis is the accent color, a status chip, or nothing.
- ARABIC PAIRING RULE: if the page serves Arabic, display and body both become IBM Plex Sans Arabic (700/600 display, 400/500 body); JetBrains Mono keeps latin digits inside panels; layout mirrors to RTL; the aura, capsule and panel laws are unchanged.

## Signature art / components (the mock-UI system — the craft that carries the world)
THE PANELS ARE THE PHOTOGRAPHY BUDGET SPENT IN CODE. Each panel is a believable screen of the client's product, drawn with the discipline of a real UI:
- DASHBOARD PANEL: a header row (product breadcrumb in 11px mono + one status chip), then a grid of inner cards — metric cards (label, big number, small delta), a list of rows with avatar-dots and mono timestamps, one chart card. Data is REAL invented data in the demo's locale: names, communes, DZD amounts, plausible timestamps — never "Lorem" or "Item 1".
- TOAST: 300–360px wide, panel-ground fill, 1px border, 10–12px radius, an 8px status dot, one bold line + one 70%-alpha line, a mono timestamp right-aligned. Toasts enter by sliding 8–12px from their nearest edge.
- COMMAND BAR: an input-shaped well with a magnifier/chevron glyph, a pre-typed query (static text — it never types itself), a result list where rows highlight sequentially, and a "⌘K" key-chip in the corner.
- CHIP RAIL / STATUS BOARD: rows of status chips, progress bars (2–3px tall, accent on rgba-8% track), toggle pills. Every interactive-looking element inside a panel is drawn honestly but is decorative: panels carry role="img" with a real aria-label describing the screen in the page's language ("Tableau de bord des livraisons : 4 tournées actives…").
- BUTTONS (page-level): primary — accent fill #7C6CFF, ink text #0E0B14, 600 weight, radius var(--radius), padding 0.7em 1.4em; hover brightens to #8B7CFF over 0.2s, no lift, no glow. Secondary — transparent, 1px border rgba(236,234,246,0.14), text #ECEAF6; hover border to 0.28 alpha. Links: accent text, 1px underline on hover only. The 999px pill silhouette is reserved for the capsule and chips — buttons consume var(--radius) directly (the 10px law).
- FORMS: the lead form is drawn AS A PRODUCT PANEL — a "ticket" the visitor opens. Fields are dark wells (#171226, 1px border rgba 0.10, radius 10px), labels above in 12px/600; phone-first (tel input first, inputmode="tel", autocomplete="tel"); a select for structured choice (wilaya, volume/jour); :focus-visible ring 2px #7C6CFF offset 2px. HONEST SUCCESS STATE: the panel flips to a created-ticket card — mono reference (REQ-0482 register), green "Reçu" chip, and a real next-step sentence with a real delay ("On vous rappelle sous 24 h ouvrées."). On valid submit, dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail; include one off-canvas decoy input with data-wandit-hp that the page's own script never touches.
- ::selection: accent ground with ink text. Favicon: inline SVG data URI — a 6px iris dot with a soft lavender halo ring on the ground color.

## Page chassis
- Vertical rhythm: section padding clamp(5rem,10vh,8rem); container max 1140–1240px; panels may extend to 1320px on showpieces; text columns 34–38rem.
- HEADER: wordmark in the display face (17–18px, 600) + 3–4 nav links (14px, 75% alpha) + one primary button (14px). Transparent over the hero; once scrolled past ~40px it takes the ground color solid with a 1px bottom hairline. NO backdrop-blur, ever.
- FIXED OPENING (hero law): the aurora capsule (version or announcement) → the h1 (≤8 words, one accent word max) → one sub-sentence → primary + secondary CTA → THE HERO PANEL: the écran-maître drawn in full, with the single iris aura behind it. The COMPOSITION is client-owned (centered stack with full-width panel below, split with a tilted panel bleeding off-edge, a fanned stack, a bottom-peek — see LES GESTES) but capsule + one aura + hero panel are law.
- FIXED CLOSING: the lead form as the ticket panel (spec above), then a quiet footer — wordmark, 2–3 short link columns at 60% alpha, ONE status chip in mono inside the footer ("Tous les systèmes opérationnels" + green dot), one top hairline, the version number as the last word. The optional second aura at half intensity sits behind the closing CTA, never the footer text.
- FREE MIDDLE (compose 3–5 from this vocabulary, never two adjacent alike):
  · FEATURE SPLIT — 5/7 or 7/5 text column + one panel, alternating sides section to section; the panel demonstrates the sentence beside it.
  · LE FIL DE VERSION — a changelog spine: a left vertical hairline with version dots, entries (v2.4 → v2.6 register) as small cards with dates and one-line changes.
  · METRICS BAND — 3–4 display-face numerals with mono unit-chips, counters ticking on entrance, one hairline above and below.
  · PANEL GALLERY — 2–3 smaller panels in an asymmetric grid (7/5, 8/4, or a 5/4/3 stagger), each a different species (toast queue, chart card, chip board).
  · WORKFLOW RAIL — steps 01–03, each step a short claim + one small panel or toast proving it; steps connected by a hairline, numbers in display face at 40% alpha.
  · QUIET PROOF — one customer sentence at clamp(1.4rem,2.4vw,2rem), name + role in 13px at 65%, beside ONE mini panel showing the exact metric the quote claims. Never a carousel.
- Exactly ONE scroll-scrubbed showpiece per page (seeded below), placed mid-page, the page's held breath.

## Motion identity (GSAP 3 + ScrollTrigger via CDN)
GOVERNING LAW: every hidden state is set via gsap.set, never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). CDN dead → a complete, readable, fully-lit page with every panel composed.
- EASING IDENTITY: power2.out for entrances (0.5–0.7s), power2.inOut for chart draws and crossfades (0.8–1.2s). Translations 12–24px max. Nothing bounces, nothing overshoots, nothing snaps faster than 0.4s. OFFSET LAW: hidden pre-entrance states translate full-width panels VERTICALLY only — an x-offset on a container-width panel widens the document and breaks the zero-overflow law; x-slides live only on elements inside overflow-hidden panels (toasts, rows). Sections trigger at "top 82%" and settle fully composed within ~1.6s; a visible metric never sits at 0 — its counter starts ticking the moment its card lands.
- PRODUCT-LOGIC ORDER (the world's signature): elements enter in the order the PRODUCT would produce them — panel chrome first, then a toast slides in, then cards populate in the UI's reading order (+0.12–0.18s between beats), then the chart line draws (strokeDashoffset, 0.8–1.2s), then counters tick to their value (0.8–1.2s, integer snapping). NEVER a plain uniform stagger over a section — motion here narrates the UI.
- SHOWPIECE SEED — "LA MISE EN PROD": the hero dashboard assembles itself on scrub in a pinned section: (1) empty panel frame with skeleton rows — the frame enters on approach BEFORE the pin engages, never inside the scrub: the pin must never hold an empty viewport → (2) a toast slides in announcing the deploy → (3) cards populate one by one while the skeleton fades out beneath them → (4) the chart line draws WITH its area fill → (5) the status chip flips to "EN LIGNE" and the aura brightens exactly one step (10% → 15% alpha). Choreography is client-owned (assembly, triage, before/after crossfade, a traveling payment — see LES GESTES); the pattern "UI builds itself toward a live state" is law. DIFFERENTIATION LAW: the showpiece écran never repeats the hero panel — it names a DIFFERENT screen ("Mise en production — v2.6", a triage board, a report) with its own title and inner composition, never the hero's metric-trio grid again. On mobile: non-pinned, beats play sequentially on enter.
- HOVERS: 0.18–0.25s ease; panels lift 2px max or brighten their border to 0.16 alpha; buttons shift fill; no glow ramps, no scale beyond 1.02. Keyboard/touch parity always.
- REDUCED MOTION: the page is designed at its final state — dashboard live, counters at value, chart drawn, status green. Composed stills, never blanks.

## Iris ban list (the global ban list applies; in addition)
- Runtime shader/Canvas2D generative art, machine-telemetry voice (SYS.STATUS, FILE 001), outline/stroked display type, and mix-blend-mode difference chrome — that is CINÉTIQUE's language.
- Neon-tube type, electric beam lines, glass panels with glowing borders, and backdrop-blur — that is VOLTAGE's language; iris light is soft, single-source, and never electric.
- Soft-shadow floating cards on light grounds, duotone spot illustrations, and the node-diagram showpiece — that is CLAIR's language; the iris showpiece is UI assembly, never a node graph.
- Prompt-line furniture ($, >, ~), typed-text steps() reveals, blinking cursors, ASCII frames, and mono prose — that is PHOSPHORE's language.
- Chrome/metal text, glossy orbs, specular gloss — AN2000's language.
- Constellation maps and orbital diagrams — OBSERVATOIRE's language.
- Pure #000 grounds or neutral-gray dark mode: the violet tint is the world's skin.
- A second light source of any kind: beams, spotlights, vignette glows, glowing borders, text-shadow halos. One aura (plus its half-intensity echo) is the entire lighting rig.
- Gradient washes on sections, gradient text, gradient buttons — the aura and the capsule hairline are the only gradients in existence.
- Screenshots, browser-frame mockups, macOS traffic-light dots, device mockups, photography of any kind: every screen is DRAWN.
- Grain or noise overlays (plaster is MATIÈRE's) — iris air is optically clean.
- Uniform stagger fade-ups, back.out or elastic easings, entrances faster than 0.4s.
- Placeholder data inside panels ("Item 1", "User A", "$0.00"): every panel row is invented but real.
- Mono type outside a panel; the capsule silhouette (999px + gradient border) on anything but the announcement pill.
- The showpiece panel as a hero lookalike: the hero's screen title or header-row + metric-trio skeleton repeated mid-page.

## LES GESTES (moves menu)
- LA CONSOLE CENTRÉE — hero geste: capsule and headline centered, the hero panel full-width below rising 24px into view, the aura cresting behind the panel's top edge like a moonrise.
- LE BUREAU EN ANGLE — hero geste: text column left (5 cols), hero panel right (7 cols) with a 3–4° perspective tilt, bleeding 8–12% off the right edge; the aura sits behind the panel's on-screen half.
- L'EMPILEMENT — hero geste: three panels fanned with 14–18px offsets and 1–2° rotations, only the top one fully lit and populated; the two behind sit at 60% opacity.
- LE GUICHET — hero geste: a single narrow panel (receipt, ticket, or command bar) peeking from the bottom viewport edge at a slight angle, headline above in the dark; the smallest hero in the library.
- LE FIL DE VERSION — section geste: the changelog spine; version dots pop (scale 0.6→1, 0.3s) as the spine hairline draws downward past them.
- LA RANGÉE DE TOASTS — section geste: a queue of 3 toasts entering one after another (0.5s each, 0.3s apart) to narrate a flow: commande → assignée → livrée.
- LE COMPTEUR DE NUIT — section geste: the metrics band; numerals tick up over 0.8–1.2s while their mono unit-chips fade in 0.2s after each settles.
- LA COMMANDE ⌘K — section geste: the command bar with a static pre-typed query; on scrub or on view, result rows collapse away until one remains and its key-chip lights in the accent.
- LE DOUBLE-ÉTAT — showpiece geste: the same panel in "avant" (dim, three alert chips) and "après" (clean, green statuses); a 1px vertical divider travels across the panel on scrub, revealing après behind it.
- LA MISE EN PROD — showpiece geste: the five-beat assembly described in Motion identity — frame, toast, cards, chart, live; the canonical iris showpiece.
- LE TRIAGE — showpiece geste: a stack of toasts sorts itself on scrub — each flies to its category chip, a counter descends to zero, and an "inbox zéro" status flips green.
- LE SECOND SOUFFLE — closing geste: the half-intensity aura brightens behind the final CTA as it enters, and the capsule reprises with the version number as the page's last quiet word.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- "VERSION 2.6" — a release-night page for a fleet-ops SaaS. Hero: LA CONSOLE CENTRÉE — capsule "v2.6", centered headline, the dispatch dashboard full-width below with the aura cresting behind it. Showpiece: LA MISE EN PROD five-beat assembly ending on "EN LIGNE". Middle: feature split, metrics band, fil de version. Mood: the calm of a deploy that went well.
- "FLOTTE" — a logistics ops platform. Hero: LE BUREAU EN ANGLE — claim on the left, the assignment board tilted 4° and bleeding off the right edge. Showpiece: a kanban panel where order cards migrate column to column on scrub (à assigner → en route → livré), each arrival flipping a chip green. Middle: workflow rail, quiet proof, panel gallery. Mood: a control room at cruising speed.
- "INBOX ZÉRO" — a support/messaging product. Hero: LA RANGÉE DE TOASTS as the hero object itself — headline left, a vertical queue of live toasts arriving on the right, aura behind the queue. Showpiece: LE TRIAGE — toasts sort themselves into category chips while the counter runs to zero. Middle: double-état section, metrics band, fil de version. Mood: the silence after the queue empties.
- "LE RAPPORT DU MATIN" — an analytics product. Hero: L'EMPILEMENT — three report panels fanned, the top one live. Showpiece: the report compiles on scrub — chart draws first, then table rows populate beneath it, then an "exporté" chip stamps in mono with a timestamp. Middle: feature splits alternating, quiet proof. Mood: numbers ready before the coffee.
- "DOUBLE ÉTAT" — a migration/onboarding pitch. Hero: LE GUICHET — only a command bar peeks from the bottom edge under a two-line headline; the sparsest opening in the register. Showpiece: LE DOUBLE-ÉTAT — the divider travels across the client's real "avant" chaos to reveal the "après" board. Middle: workflow rail, metrics band, panel gallery. Mood: before and after, stated without adjectives.
- "LA GARDE DE NUIT" — an uptime/monitoring product. Hero: mirrored split — the status board LEFT with its green dots as the first thing read, claim on the right. Showpiece: an incident resolves on scrub — an alert toast lands, a response timeline fills beat by beat, the chip flips "incident" → "résolu", and the aura brightens its one step. Middle: fil de version, quiet proof, compteur de nuit. Mood: someone is awake so you don't have to be.
- "GUICHET" — a payments/fintech product. Hero: a centered narrow headline with the hero panel as a payment receipt rising bottom-center, slightly rotated. Showpiece: a payment travels on scrub — an amount chip moves across three mini-panels (initiée → validée → versée), each panel lighting as it receives, the last stamping a mono reference. Middle: double-état, metrics band, feature split. Mood: money moving quietly, on time.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the PANELS (they must read as a real product screen someone uses daily — aligned grids, coherent invented data, honest chip states; the moment a panel reads as "gray box with lines", the page is a template), the SINGLE-AURA DISCIPLINE (one soft light source, softly placed — a second glow kills the night, and a flat unlit page kills the product), and the PRODUCT-LOGIC MOTION (entrances that narrate the UI in causal order — one uniform fade stagger and the world's calm turns generic). The cheap details that separate it from a generated page: mono timestamps and locale-formatted amounts inside panels, real commune and person names in the data, the capsule's gradient hairline, 6px status dots, the version number as the footer's last word, and the aura brightening exactly one step when the page's story goes live. When in doubt, put the budget in the écran-maître — in this world, the product IS the poster.`,
	energy: "quiet",
	family: "product-dark",
	fusesWith: ["phosphore", "clair"],
	id: "iris",
	industries: [
		"medical lab / analyses",
		"SaaS product",
		"dev tool",
		"AI product",
		"startup (pre-launch / waitlist)",
		"fintech product",
		"mobile app landing",
		"IT services / agency",
		"online courses / e-learning",
	],
	kind: "website",
	mood: ["nocturnal", "precise", "calm", "confident"],
	name: "Iris",
	preview: {
		accent: "#7C6CFF",
		fontFamily: "Sora",
		ground: "#0E0B14",
		ink: "#ECEAF6",
		sampleWord: "v2.6",
	},
	priceFeel: "premium",
	tagline: "Le produit la nuit : une scène violette, une seule lumière douce.",
};
