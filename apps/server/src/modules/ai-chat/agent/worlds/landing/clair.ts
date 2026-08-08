import type { DesignWorld } from "../types";

/**
 * CLAIR — the well-run product company.
 * The factory's ONLY "normal" world: friendly sans, floating cards, blue
 * trust — executed with opinion. Duotone spot illustrations instead of icon
 * rows, a pill-tab switcher instead of a feature grid, one warm counterpoint
 * rationed like sugar, and product diagrams that carry real data. Because it
 * lives closest to the template swamp, the global ban list applies here at
 * DOUBLE strength. Proven values below come from the Fawtara demo build.
 */
export const clair: DesignWorld = {
	avoidFor: [
		"fine dining",
		"jewelry brand",
		"tattoo & piercing",
		"festival",
		"guesthouse / riad",
	],
	doc: `# DESIGN WORLD: CLAIR — the well-run product company

## Philosophy
This page is the FRONT DESK OF A WELL-RUN PRODUCT COMPANY at nine in the morning: clean counter, morning light through big windows, someone competent who answers on the first ring. CLAIR is the only world in the factory allowed to look "normal" — friendly sans, white ground, blue trust, floating cards — and that permission is a discipline, not a holiday. Normal here means every default replaced by a decision: instead of an icon-feature row, duotone spot illustrations with captions; instead of a feature grid, a pill-tab switcher that slides; instead of a stock hero, a floating tableau of the client's ACTUAL product drawn as UI cards with plausible data; instead of a rainbow, one blue family plus one warm counterpoint counted on one hand. Its first structural fact: elevation exists — CLAIR is the only world permitted soft-shadow floating cards, and it spends that privilege on exactly one shadow recipe, never a second. Its second structural fact: the imagery IS the product — drawn diagram cards, plausible numbers, honest statuses; if the pictures could belong to any company, the page has failed. Its third: because CLAIR lives closest to the template swamp, the global ban list applies at DOUBLE strength; one purple gradient, one icon row, one testimonial carousel and the world drowns. Impossible failure modes: the AI-startup gradient wash, corporate-Memphis people with tiny heads, the cookie-cutter hero-features-pricing march played straight. Self-audit before shipping (count them): zero icon-font glyphs and zero emoji; at most 3 warm-counterpoint moments; at least 2 duotone spots AND at least 1 drawn product diagram carrying plausible client data; every shadow on the page traceable to the single two-layer recipe; at most 2 gradients, both from the allowed list; exactly one navy band or none; exactly one h1.

## The variation contract
WORLD LAW — never renegotiated by brief or builder:
- White/near-white ground (#FFFFFF and the #F7FAFD register) with sky pools; ink in the #17263B register; ONE blue trust family; ONE warm counterpoint at three moments or fewer per page.
- The floating-card recipe (radius 16–20px, the exact two-layer shadow below) as the ONLY elevation on the page, only on cards.
- Imagery = duotone spot illustrations + drawn product diagrams. Zero photography, zero icons-as-content, zero people or faces anywhere in the art.
- The radius pair: pills/buttons/tabs/chips consume var(--radius) directly (the 999px pill); cards and fields keep 16–20px. Nothing sharp-cornered, nothing arched.
- Friendly-competent voice; every claim carries at most one real number with a real unit.
- Motion: soft float-ups with slight scale, power2 family, no overshoot ever.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact blue inside the trust register (#2F6BFF / #2456D6 / #1E4FD1 / #3D74FF) and the exact warm inside the #FFB35C / #FFA94D / #F6A23E register.
- The display face within the register: Plus Jakarta Sans or Onest, one per site.
- The CONCEPT VERB that drives the page — facturer, réserver, livrer, encaisser, déclarer — it names the hero claim, the tab labels and the schéma's nodes.
- The spot-scene subjects, the diagram contents (field names, amounts, statuses, dates), the tarifs structure, the section order beyond the fixed opening and closing, and which 2–3 gestes get played.
A CLAIR page whose diagrams could belong to any product has failed. The diagram data is the portrait of THIS client: their currency, their document numbers, their statuses, their city.

## The vibe (voice)
Friendly-competent French (or the brief's language): short declaratives, verbs first, numbers spoken plainly, zero jargon and zero superlatives. The register of a founder who has done the job themselves. Sentences under 14 words; one number per claim maximum; honesty beats promise ("Sans engagement" only if true, then say how to leave). Example lines:
- "Votre première facture part en 90 secondes. La deuxième, en 40."
- "Pas de carte bancaire. Pas de surprise le 30 du mois."
- "On répond en français et en arabe, du dimanche au jeudi, en moins d'une heure."
Microcopy is a feature: field placeholders show real examples, buttons say what happens next ("Être rappelé aujourd'hui", never "Envoyer"), the success state gives a real deadline.

## Visual signatures
- THE FLOATING CARD (OWNED TIC — the only world allowed soft-shadow cards): white #FFFFFF, border-radius 16–20px, border 1px solid rgba(23,38,59,.08), shadow EXACTLY 0 2px 6px rgba(23,38,59,.06), 0 24px 48px -20px rgba(23,38,59,.18). Hover/focus-within: translateY(-4px) and the second layer deepens to -16px spread, 0.25s ease. Cards float on white or sky pools, never on navy. Every card earns its lift by holding product truth — a diagram, a price, a form; decorative empty cards are forbidden.
- DUOTONE SPOT ILLUSTRATIONS (OWNED TIC): SVG scenes in exactly two colors — the page blue as 2.5px round-cap strokes plus sky #D8E7FB flat fills, on white. Objects only (documents, phones, storefronts, ledgers, calculators, parcels) — never people, never faces. Sized 200–320px, one per content moment, each with a sentence-case caption. Slightly geometric, warm, confident; never isometric, never 3D-shaded.
- THE PILL-TAB SWITCHER (OWNED TIC): a 999px container on sky ground holding 3–4 tab pills; the active pill is white and carries the card shadow; panels slide horizontally (x ±32px + fade, 0.45s power2.inOut). It replaces the feature grid — features are told as verbs, one scene at a time.
- SKY POOLS: #D8E7FB / #EAF2FC surfaces with 24–32px radius, inset from the viewport edge by clamp(12px, 2vw, 28px) — pools, not full-bleed stripes. They group stats, the switcher, the closing form.
- PRODUCT DIAGRAMS AS TRUTH: mini-UI cards drawn in HTML/SVG — document numbers (FAC-2025-0413), line items, totals in the client's currency, status chips. Functional chip colors (paid green #1B9E63, overdue red #E05B4B) exist ONLY inside these drawn interfaces at chip scale, never as page decoration.
- DASHED CONNECTORS: 2px dashed #B9CFEA lines relate diagram nodes; the one lit path is solid blue at 3px. Connectors exist only inside diagrams — never as section dividers.
- THE LABEL PILL: section labels are the display face 700, 12–13px, +0.08em tracking, uppercase, blue on a #E5EFFB pill (999px, padding 0.45em 1em). Never floating bare-ground micro-caps.
- THE WARM COUNTERPOINT: an #FFB35C-register marker used at most 3 times per page — a 10px rounded underline sliding under one hero word, a "recommended" flag on one price card, one celebratory moment (success check, diagram end-state). Never as ground, never on text below 18px, never twice in one viewport.

## Color physics
- GROUND: #FFFFFF alternating with the #F7FAFD/#F4F8FC register; the alternation is quiet — sky pools, not ground stripes, do the sectioning work.
- INK: the #17263B register, never pure black. Secondary text is the ink at 66% opacity; hairlines and borders at 8–14%.
- TRUST BLUE: one family per site from the #2F6BFF/#2456D6/#1E4FD1 register (a primary + a deep for hover/gradient). Budget: CTAs, links, active tab text, label pills, spot strokes, the lit diagram path, at most one accent word per headline. Blue is trust — pooling it everywhere bankrupts it.
- SKY: #D8E7FB / #E5EFFB / #EAF2FC as surface pools and spot fills. Sky is the only mid-tone allowed between white and blue.
- WARM COUNTERPOINT: #FFB35C register, ≤3 moments law (see signatures). It exists so the page has a pulse; more than three beats is arrhythmia.
- NAVY: #17263B may ground AT MOST ONE full-width band per page (a quote interlude or the footer) with white type and sky details. Two dark bands make a dark site — that is another world.
- GRADIENTS: exactly two are legal — (a) the primary CTA's vertical blue-to-deep-blue (#2F6BFF → #2456D6), (b) one radial sky halo behind the hero tableau, rgba(216,231,251,.85) fading to transparent by 65% radius. Anything else — and any hue drift toward purple — is a firing offense, double-strength.
- Functional greens/reds live only inside drawn product UI at chip scale (≤12px text), never on the page itself.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · TRUST BLUE→--primary · GROUND→--primary-foreground · SKY→--secondary · WARM COUNTERPOINT→--accent · ink at 66%→--muted · ink at 8%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, pool or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Plus Jakarta Sans or Onest (Google Fonts), weights 600–800, one face per site. Hero statement clamp(2.6rem, 6vw, 4.6rem), line-height 1.04–1.1, letter-spacing -0.02em. Section titles clamp(1.9rem, 3.6vw, 3rem), weight 700–800. Display never drops below 600.
- BODY: Inter or Public Sans, 400/500/600 — body roles ONLY, never display (double-strength global law). 16–18px, line-height 1.6–1.7, measure capped at 62ch. Secondary text = ink at 66%.
- LABELS: display face 700, 12–13px, uppercase, +0.08em tracking, always inside the label pill.
- NUMBERS: display face 700–800 for stats and prices, font-variant-numeric: tabular-nums in tables and diagrams; units and currencies set at 55–65% size in blue.
- Emphasis is weight or the blue accent word — never italic in display, italic allowed only for the single quote geste.
- ARABIC PAIRING RULE: pages serving Arabic set display AND body in IBM Plex Sans Arabic (700/400), keep the identical color and shadow law, mirror the pill-tab slide direction (RTL: panels slide from the left), and keep latin numerals inside diagrams if the client's documents use them.

## Signature art / components
- SPOT CONSTRUCTION: build scenes from rounded rects and simple paths — a storefront with an awningless flat facade, a document with a sky header band and 3–4 line strokes, a phone with a check circle, a ledger with tabbed pages. Stroke: page blue, 2.5px, round caps and joins. Fills: sky only. White interior = paper. Ground each spot on a soft backdrop panel (a #EAF2FC rounded rect, radius 24–28, filling ~90% of the viewBox) so the scene has presence in its column instead of floating small on white; on sky pools the backdrop flips to white. One spot may hide a tiny witty detail (a stamp, a paper plane) — one, not five. Every spot gets role="img" and a real aria-label in the page's language.
- PRODUCT DIAGRAM CARDS: header row (document name 13px 700 + status chip 999px), body rows as label/value pairs or line items, a 1px rgba(23,38,59,.08) divider before the total row, total in display 800 tabular. Data plausible and local: real product names, real amounts with the brief's currency, sequential document numbers, dates within the current quarter.
- BUTTONS: primary = 999px pill, the legal blue gradient, white text, display face 600 at 15–16px, padding 0.85em 1.7em; hover deepens to the deep blue and lifts -1px; active returns to 0. Secondary = white pill, 1.5px border rgba(47,107,255,.35), blue text; hover fills #EAF2FC. Tertiary = blue text link whose arrow slides 4px right on hover/focus. Every CTA names its consequence.
- FORMS: fields inside a floating card; labels above (13px, 600); inputs 1.5px border #D3E1F4, radius 12px, padding 0.8em 1em; :focus = blue border + 3px ring rgba(47,107,255,.22). Phone-first: the tel input leads, with the country prefix as a non-editable chip (+213 register). Selects for structured choices (activité, wilaya). On valid submit, dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail, then show the honest success state IN the card: check mark, the visitor's first name, a real deadline ("On vous rappelle avant 17 h, dimanche à jeudi."). Include one off-canvas decoy input with data-wandit-hp, tabindex="-1", aria-hidden — untouched by the page's own script.
- CHIPS & TRUST LINES: status chips 999px, 11–12px 700; the micro trust line under the hero CTA (13px, ink 60%) states the honest constraint ("Gratuit jusqu'à 20 factures/mois · Sans carte bancaire").
- FAQ: native details/summary rail, 1px hairline bottom borders, a plus glyph rotating 45° when open (0.25s), summary in display 600 17–18px.
- ::selection = the page blue with white text; :focus-visible = 3px rgba(47,107,255,.4) outline, offset 2px. Favicon: inline SVG data URI, blue rounded square + white check.

## Page chassis
- Container 1140–1200px; gutters clamp(20px, 4vw, 48px); section rhythm clamp(4.5rem, 9vh, 7.5rem); the hero holds min-height 82–88vh, never a forced 100vh.
- HEADER: solid white bar (no blur, no shadow until scrolled — then the hairline border only), wordmark + drawn glyph left, 3–4 links center, primary pill CTA right. Mobile: wordmark + CTA only.
- FIXED OPENING (hero law): asymmetric split, 55/45 or 60/40 — headline column with a label pill, an h1 carrying ONE blue accent word and optionally the warm underline marker, sub in ≤2 sentences, primary + secondary CTA, micro trust line; facing it, the FLOATING TABLEAU: one main product-diagram card plus 2 satellite mini-cards at staggered depths over the sky halo, drifting ±10px on scroll. Never a centered headline over a gradient. On mobile the tableau compresses to the main card + one satellite.
- FIXED CLOSING: the lead-form card floating on a sky pool (form law above) with a duotone spot or an honest availability note beside it; then the footer — light ground or THE one navy band: wordmark, city and phone in plain text, 3–5 links, one human line ("Fait à Alger. Hébergé en Algérie." register).
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent sections sharing a layout: the pill-tab switcher · le schéma (the scrubbed showpiece) · the chiffres band (3–4 plain stats on a sky pool) · the steps rail (numbered walk along a dashed connector) · the avant/avec comparator (muted list vs floating card) · la voix unique (ONE customer quote, never a carousel) · the tarifs pair · the FAQ rail.

## Motion identity
Gate every animation on (window.gsap && window.ScrollTrigger && !matchMedia("(prefers-reduced-motion: reduce)").matches). All hidden states set by gsap.set, NEVER in CSS — JS dead must leave a complete readable page.
- THE PERSONALITY: soft float-ups with slight scale. Entrances: opacity 0→1, y 24–32px→0, scale 0.97→1, power2.out, 0.7–0.9s, staggers 90–120ms. Nothing bounces, nothing snaps, nothing overshoots — back/elastic easings are banned (that temperament belongs to GUIMAUVE).
- Micro-moves: 0.25–0.45s, ease or power2.out — card lifts, tab slides (0.45s power2.inOut), arrow nudges.
- THE SCRUBBED SHOWPIECE — LE SCHÉMA: the product's system map, told in two movements. FIRST, before the pin (trigger at top 75%, once): the center node floats in (0.94→1), outer nodes follow with 120ms staggers, dashed connectors fade to 85% — the diagram must stand COMPLETE when the pin engages; a pinned viewport with hidden content is a dead zone and a failure. SECOND, the pinned scrub (desktop only, pin ≈ 1.5–1.8× viewport, scrub 0.6) tells only the lit-path story: a 3px solid blue line draws by strokeDashoffset while a 10px blue dot travels it via getPointAtLength, result chips pop at the receiving nodes (scale 0.92→1), and numbered captions crossfade beneath, one per beat. Mobile: no pin — the map reflows to a vertical rail on a dashed spine and nodes float in on view.
- Hero tableau parallax: satellites drift y ±10–14px, scrubbed, nothing rotates.
- Hovers: always paired with :focus-visible; touch gets the same state on tap. Reduced motion: the page renders fully assembled — schéma complete with its lit path, tabs switching instantly, zero movement.

## Ban list (world-specific, on top of the global list — which applies here at DOUBLE strength)
1. Neon-tube glow, electric beam lines, dark glass panels with glowing borders — that is VOLTAGE's language.
2. Chrome/metal text, glossy aqua orbs, lens-flare sparkles — that is AN2000's language.
3. The exposed page-wide grid rules and the oversized red circle — that is GRILLE's language.
4. Prompt-line furniture, typed-text steps() reveals, ASCII/box-drawing frames — that is PHOSPHORE's language.
5. Purple-to-blue gradients or ANY hue drift off the blue/sky/warm triad — double-strength: instant failure.
6. Icon rows and three-feature-cards-with-icons — features are the switcher, spots, diagrams. Double-strength.
7. Testimonial carousels and logo walls of fake clients — one voice, named, or none. Double-strength.
8. Photography, 3D renders, isometric "corporate Memphis" illustration people — no humans in the art, ever.
9. Backdrop-blur glassmorphism in any form.
10. Dark heroes or a second navy band — one deep moment maximum.
11. Decorative blobs, dot-grid wallpapers, floating shapes without a diagram role.
12. Overshoot/bounce easings (back.*, elastic.*) and squash-and-stretch — GUIMAUVE's temperament.
13. Shadows anywhere outside the card recipe: no text-shadow, no shadowed sections, no glow.
14. Odometer/count-up number tricks — numbers arrive once, plainly.
15. Vague SaaS-speak ("solutions innovantes", "boostez votre productivité") — the voice law forbids it.

## LES GESTES (moves menu)
1. LE TABLEAU FLOTTANT — the hero's product tableau: one main diagram card + two satellite mini-cards (a notification, a mini-stat) at staggered depths over the sky halo, drifting ±10px on scrub. The product sells itself before the first scroll.
2. LE COMMUTATEUR — the pill-tab switcher played as narrative: 3–4 VERBS as tabs (Facturer / Encaisser / Déclarer register), each panel a spot + 3 checked claims + one micro-CTA. Panels slide horizontally.
3. LE SCHÉMA — the scrubbed system map (showpiece law above): nodes, dashed relations, one lit money/data path with a traveling dot and result chips. The client's business drawn as a living diagram.
4. LA BANDE CHIFFRES — a sky pool carrying 3–4 stats in display 800 with units in blue, each with a one-line caption. No counters, no odometers — the numbers just stand there, confident.
5. LE RAIL D'ÉTAPES — 3 numbered steps along one dashed connector that draws in; circled numerals in sky, titles in display 700. Desktop alternates steps above/below the rail; mobile stacks them left-flush.
6. LA PAIRE DE TARIFS — exactly two price cards (never three), the recommended one flagged with the warm counterpoint and lifted 8px; beneath, one honest footnote line ("TVA comprise. Résiliable en un clic. Export de vos données à tout moment.").
7. LA VOIX UNIQUE — one quote, 1.6–2.4rem display 600, a named author with city and shop, set on the page's single navy band with one supporting stat chip. Never a carousel, never three little quote cards.
8. LE COMPARATEUR AVANT/AVEC — two columns: the "avant" list in muted ink with small line-through crosses, the "avec" claims inside one floating card with drawn blue checks. The asymmetry (bare list vs card) is the point.
9. LA CARTE QUI S'ÉCRIT — a diagram card whose rows fade in one by one on scroll (80ms stagger, no typing effect), ending on the total row and a status chip flip. The product demonstrates itself mid-page.
10. LA FAQ PLIÉE — 4–6 details/summary items on hairlines, plus-glyph rotation, answers in ≤3 sentences with one real number each.
11. L'INTERLUDE NAVY — the single deep band: one strong claim in white display 700 + one stat + optionally la voix unique. It resets the eye between two light halves.
12. LE FIL DE CONFIANCE — micro trust lines placed at decision points (under the hero CTA, under the tarifs, in the form card): 13px honest constraints, each ≤8 words.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. LE GUICHET — invoicing SaaS (the Fawtara register). Hero: 55/45 split, headline left, floating tableau right (invoice card + payment notification + mini-chart). Showpiece: le schéma of the money path — boutique → product → client → bank — the payment dot traveling home. Middle: chiffres band, commutateur, comparateur, tarifs pair, navy voix unique. Mood: steady, warm-blooded competence.
2. LA TOURNÉE — delivery/fleet SaaS. Hero inverted: a short wide headline ABOVE, and beneath it a full-width dispatch-board diagram (three columns of mission cards). Showpiece: the dashboard docks — on scrub, scattered mini-cards glide into their board columns and the day's total chip lands last. Motion slightly brisker (0.6–0.7s). Mood: logistics with a clean shirt.
3. LE CABINET — medical-lab / clinic booking. Hero: narrow centered column (the one centered hero CLAIR allows) with a single wide appointment-timeline card below it. Showpiece: the day fills — on scrub, appointment slots populate a timeline card one by one, gaps closing, ending on "Journée complète, zéro téléphone". Slower motion (0.9s), more white, sky pools larger. Mood: calm care.
4. LA RENTRÉE — driving school / language center platform. Hero mirrored 45/55: duotone spot LEFT (a big drawn storefront-school), text right; warm marker on the enrollment date. Showpiece: la progression — a stepped path of lesson nodes connecting toward the exam node, each lighting as the dot passes, the diploma chip arriving warm (one of the page's three warm moments). Mood: encouraging, orderly.
5. L'INVENTAIRE — stock/retail management app. Hero: text over a WIDE tableau strip (five overlapping small product cards fanned horizontally). Showpiece: la mise en ordre — a scrubbed comparator where scattered grey slips align, deduplicate and merge into one clean ledger card, the total appearing last. Middle skips the switcher, plays the rail d'étapes + FAQ. Mood: relief made visible.
6. LA FLOTTE — car rental management. Hero: stat-forward — an oversized number (display at clamp(4rem, 9vw, 7rem), "97 % de flotte occupée") as the visual, headline beneath, one satellite card. Showpiece: la carte qui s'écrit — the rental contract composes row by row and flips its chip to "Signé". Navy interlude carries the voix unique. Mood: operations under control.
7. LE PORTEFEUILLE — fintech / payments product. Hero: 60/40 with the tableau stacked vertically (three thin transaction cards, not one big one), sky halo stronger; the main tableau card is a static two-branch flow diagram — encaissements splitting toward "Compte marchand" and, thinner, toward "Comptabilité". Showpiece: le rapprochement — a scrubbed reconciliation across TWO facing cards: bank-statement lines left, encaissements right; on scrub, matching pairs tick off one by one, a short blue connector drawing at each match, ending on an "Écart : 0,00 DZD" total row and a "Rapproché" chip landing last (pair-matching across two cards — never L'INVENTAIRE's merge of scattered slips into one). Motion crisp (0.6s), blue slightly deeper (#2456D6 primary). Mood: precise, unflashy trust.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: (1) THE DIAGRAM TRUTH — the drawn product cards and the schéma must read like a screenshot of a real product serving THIS client: local currency, plausible names, sequential numbers; generic boxes make CLAIR a template, and a template here is death. (2) SHADOW DISCIPLINE — one recipe, cards only; the moment a section or a button grows a glow, the calm breaks. (3) THE WARM RATION — three moments maximum, placed at decisions; a fourth warm touch and the page stops meaning it. The cheap details that separate CLAIR from a generated page: the label pills, the +213 prefix chip, tabular numerals in every diagram, the dashed-connector language, honest micro trust lines under CTAs, the success state that names a deadline, and captions under every spot. When in doubt, remove one element and make one number truer — clarity is this world's voltage.`,
	energy: "medium",
	family: "corporate-saas",
	// grille: the product grows a spine — enterprise rigor. herbier: health-tech warmth — clinics, wellness apps.
	// iris: sibling product language — the diagrams go cinematic for launch pages. eclat: the product gains a human campaign face — photo warmth for hiring/brand moments.
	fusesWith: ["grille", "herbier", "iris", "eclat"],
	id: "clair",
	industries: [
		"personal trainer / coach",
		"marketing services",
		"university prep / tutoring",
		"SaaS product",
		"mobile app landing",
		"fintech product",
		"AI product",
		"startup (pre-launch / waitlist)",
		"IT services / agency",
		"telecom / ISP",
		"insurance agency",
		"accountant",
		"recruitment / HR",
		"business consultant",
		"medical lab / analyses",
		"pharmacy",
		"dentist",
		"general practitioner / cabinet",
		"specialist (cardio, derma, ophtalmo…)",
		"home care / nursing",
		"optician",
		"physiotherapy / kiné",
		"driving school",
		"language center",
		"online courses / e-learning",
		"moving company",
		"cleaning company",
		"security company",
		"car rental",
		"property management",
		"real estate agency",
	],
	kind: "website",
	mood: ["net", "confiant", "amical", "productif"],
	name: "Clair",
	preview: {
		accent: "#2F6BFF",
		fontFamily: "Plus Jakarta Sans",
		ground: "#F7FAFD",
		ink: "#17263B",
		sampleWord: "Bonjour",
	},
	priceFeel: "accessible",
	tagline:
		"Le produit bien tenu : cartes flottantes, schémas vrais, bleu de confiance.",
};
