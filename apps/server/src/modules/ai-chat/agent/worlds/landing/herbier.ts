import type { DesignWorld } from "../types";

/**
 * HERBIER — the pressed-plant archive.
 * The herbarium as a website: chalk paper, green ink, hand-drawn botanical
 * LINE plates numbered and captioned in Latin, pressed-leaf silhouettes at
 * section edges, tied specimen tags for every label and price. Pen, never
 * pigment; drawn, never photographed. Proof build: Cabinet Flore
 * (nutritionist, Tunis) in worlds/herbier/demo/.
 */
export const herbier: DesignWorld = {
	avoidFor: [
		"car dealer",
		"dev tool",
		"streetwear / drops",
		"festival",
		"crossfit / functional",
	],
	doc: `# DESIGN WORLD: HERBIER — the pressed-plant archive

## Philosophy
This page is an HERBARIUM — a naturalist's cabinet of pressed specimens on chalk paper, labeled with scientific tenderness — not a website. Its defining structural facts: every image on the page is a hand-drawn botanical LINE illustration — single-weight pen strokes of green ink on chalk — presented as a numbered specimen plate with an italic Latin caption. Flat single-tone pressed-leaf silhouettes rest at section edges like leaves slipped between pages. Every label, price and badge is a tied specimen tag hanging from a drawn string. Nothing is photographed. Nothing is painted — no washes, no pigment blooms, no watercolor: this world is PEN, never brush. Its charm is the tension between scientific rigor (numbering, Latin binomials, hairline frames, dotted leaders) and botanical tenderness (leaves that unfurl, strings that settle with one sway). Failure modes that are structurally impossible here: the stock-photo wellness hero with a smoothie bowl; the pastel-gradient "natural brand" template; clinical coldness — Latin in this world is an act of love, not of distance. Self-audit before shipping: zero raster img elements; every plant stroke-drawn (fills exist only in pressed silhouettes, seeds and tag shapes); at least three numbered plates with Latin captions; at least one tag with a visibly drawn tie-string; all Latin set in display italic; zero handwriting glyphs; zero gradients anywhere.

## The variation contract (why two HERBIER sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Chalk-paper ground register, green ink, the specimen-plate system, pressed silhouettes, tied tags.
- Pen line only: plant strokes 1.4–2.2px, round linecaps, no shading planes, no washes, no photographs.
- Latin binomial in display italic under every plate; plate numbering wherever the system touches content.
- Grow/unfurl motion — SVG paths growing, leaves unfurling from their joints; nothing bounces, nothing snaps.
- Corners near-square (0–6px radius); the tag's clipped corner is the only shape allowed personality.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes inside the registers below.
- The display face: Lora or Cormorant Infant, one per site.
- THE FLORA — each client is assigned its own plant vocabulary (a nutritionist presses fennel, barley, mint; a hammam presses eucalyptus and laurel; a tea house presses verbena and bergamot) and ONE PLANTE-TOTEM that stars the hero and seeds the showpiece.
- The plate-numbering style (PL. 01 / Planche I / N° 12 — pick one, keep it everywhere), tag geometry within the register, section order beyond the fixed opening and closing, and which gestes play.
An HERBIER page with no plante-totem is a failure: choose the species FIRST — it names the hero plate, the showpiece scene, and half the copy.

## The vibe (voice)
Calm French with a naturalist's precision — short sentences, concrete verbs, species named like old friends. Latin appears in italic and is always grounded by its vernacular, never left as jargon. Example lines: "Le fenouil pousse lentement. Les bonnes habitudes aussi." · "Planche II — Mentha spicata. La menthe du premier rendez-vous." · "Rien n'est interdit. Tout est observé." Banned words: détox, boost, healthy, superaliment. No superlatives, no exclamation marks, no emoji. Numbers stated plainly (75 minutes, 90 TND), promises stated honestly (réponse sous 24 h ouvrées).

## Visual signatures
- THE SPECIMEN PLATE (owned tic): a chalk panel (the #EEEBDD tone sitting on the #F3F1E7 ground) framed by a 1px green-ink hairline at 25–35% opacity, radius 2–4px, inner padding clamp(1.2rem,2.5vw,2rem). Top corner: the plate number in 11px small caps, +0.12em tracking ("PL. 02"). Bottom: the Latin caption in display italic 0.95–1.15rem, vernacular after an em dash ("Mentha spicata — menthe verte"). Center: the drawn plant.
- The drawn plant: green-ink strokes 1.4–2.2px, round linecaps, fill="none"; stems drawn first, leaves as outlines with a single midrib; detail budget ≤8 stipple dots per plate; never crosshatching, never solid dark fills (seeds and berries may fill at 15–25% ink).
- PRESSED-LEAF SILHOUETTES (owned tic): flat single-tone leaf shapes — sage #93A383 at 45–70% opacity, or moss on deep ground — no stroke, no vein detail, rotated −25° to 25°, resting at section edges and behind titles. 3–7 per page. They REST; they never float, never parallax, never cover body text.
- TIED SPECIMEN TAGS (owned tic): a small chalk tag — rectangle with ONE clipped corner (8–10px cut) and a punched eyelet (4–5px ochre ring) beside the cut — hung from a single curved 1.5px ochre string, rotated −6° to +4°. Tags carry labels, prices, credentials, badges: anywhere another world would use a pill, HERBIER ties a tag.
- Dotted leaders (2px dots, ~6px gaps, 30–35% ink) joining term to definition in every index, tariff and hours list.
- Hairline rules that end in a sprout: a 1px ink-25% line whose terminal is a 10–14px two-leaf sprout glyph drawn in moss.
- Depth without shadows: the two chalk tones and the hairlines do ALL the lifting — no box-shadows, no blurs, no overlays.

## Color physics
- GROUND: the chalk register #F3F1E7 / #EEEBDD — the page takes the lighter tone, plates and panels the deeper one, 4–8 RGB points apart. That tiny gap IS the depth system.
- INK: deep green-ink, the #24301F / #202B1C register — never pure black, never neutral grey.
- MOSS (the #4E6839 / #55703E / #5C7742 register): the working accent — CTAs, active and focus states, the one ROMAN moss-colored accent word a headline may carry (upright, never italic — the italic accent word is VELIN's tic), stem highlights, sprout glyphs. Budget: if moss appears more than 5 times in a viewport, prune.
- SAGE (the #8A9B7A / #93A383 / #9CAB8D register): silhouettes, secondary strokes, ghost plate numerals at 12–20% opacity, disabled states.
- OCHRE (the #B0812A / #B98A2F / #C29638 register): STRICTLY the string-and-seal color — tie-strings, eyelet rings, price numerals on tags, at most one underline. Never a background, never a button fill. ≤3 ochre moments per viewport.
- LE SOUS-BOIS: at most ONE full-bleed band of green-ink #24301F per page where text flips to chalk and silhouettes to sage at ~30%; strings stay ochre. Everything else stays chalk.
- Gradients DO NOT EXIST in this world. No washes, no soft radials, no tints that travel. This total flatness is the world's fingerprint — the page must survive printing in three flat inks.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · MOSS→--primary · GROUND→--primary-foreground · deeper chalk→--secondary · OCHRE→--accent · SAGE→--muted · ink at 25%→--border · 3px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, silhouette or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Lora / Cormorant Infant register (one per site), weights 500–600. The italic is a reserved organ for Latin binomials and full pull-quote lines ONLY — never a full paragraph, never navigation, and NEVER a lone accent word inside an otherwise roman headline (that is VELIN's tic). Headline emphasis stays upright: the one accent word a major headline may carry is set roman in moss, same face, same weight.
- BODY: Mulish / Nunito Sans, weights 400/600/700; line-height 1.6–1.75; measure ≤68ch; body size 1–1.0625rem.
- Hero statement: clamp(2.6rem,6.2vw,5.2rem), line-height 1.06–1.14, letter-spacing −0.01em. Section titles clamp(1.9rem,3.8vw,3.3rem). The scale is a reading-room scale (~6:1 hero-to-body) — generous, never billboard.
- Latin captions: display italic 0.95–1.15rem in green-ink, always "Binomial — vernaculaire".
- LABELS: body 700, uppercase, 11–12px, +0.08–0.14em tracking, ON A TAG or beside a plate number — never floating on bare ground (that whisper belongs to ÉCRIN).
- Numerals: prices in display 500 with the currency in 11px small caps; plate numbers in small caps with the period ("PL. 04"); big ghost numerals in sage at 12–20% opacity may sit behind step cards.
- Arabic pairing rule: if the page serves Arabic, display duties go to Noto Naskh Arabic (500–600), body to IBM Plex Sans Arabic (400/600). The Latin binomial stays in the Latin display italic — the caption is a world signature and survives translation.

## Signature art / components
HOW TO DRAW A PLANT (the craft law):
- Construction order: main stem (one confident curved path, base to tip) → side branches at named joints → leaves (outline + single midrib; at least two leaf-shape variants per plate so repetition reads natural) → flowers and fruit (umbel rays with dot tips, ellipse seeds, a circle fruit with a small calyx) → ≤8 stipple dots.
- Stroke: green-ink 1.4–2.2px; filaments, awns and veins may drop to 1–1.2px. Vary leaf angle ±12° and scale 0.8–1.15; never mirror-perfect pairs. A plate that looks like a font glyph has failed.
- Perspective: flat and PRESSED — the plant lies on the paper. No 3D, no cast shadows, no foreshortening.
- Every plate carries role="img" and a real aria-label in the page's language ("Planche botanique dessinée : brin de fenouil avec ombelles").
COMPONENTS:
- Buttons: primary = moss fill, chalk text, radius 4px, padding 0.85em 1.6em, a 4px chalk eyelet dot at the left edge — a tag pressed flat. Hover/focus: fill deepens to green-ink over 220ms, y −1px. Secondary = 1px ink-40% outline with the tag's clipped corner, ink text; hover/focus fills the deeper chalk.
- THE TAG (exact spec): deeper-chalk ground, 1px ink-30% border, clip-path cutting one 8–10px corner, 4–5px ochre eyelet ring beside the cut, string = one cubic-bézier SVG path, 1.5px ochre, 24–60px long, hanging from the eyelet toward whatever the tag is tied to. Text in label style; price tags set the numeral in display 500 ochre.
- FORMS: fields as deeper-chalk boxes, 1px ink-25% border, corners consuming var(--radius) directly (the near-square 3px); labels as small tags above the fields; phone-first (the tel input leads, autocomplete on); a select for structured choices (motif, créneau). Focus: 2px moss ring. Success is honest and drawn: a sprout strokes itself in beside "Bien reçu." plus the real next step in words ("Sarra vous rappelle sous 24 h ouvrées."). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, motif, message }); include one off-canvas decoy input carrying data-wandit-hp that the page's own script never reads, writes or references.
- ::selection: chalk text on moss. :focus-visible: 2px moss outline, offset 3px. Favicon: inline SVG data URI — the two-leaf sprout stroke in moss on chalk.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem,10vh,7.5rem); the sous-bois may compress to clamp(3.5rem,8vh,6rem). Content column 1140–1260px; plates may reach 1360px; only the showpiece may bleed.
- HEADER: wordmark in display 600 with the small sprout glyph + 3–4 links + one tag-CTA (téléphone or rendez-vous). Chalk ground, 1px ink-15% bottom hairline. No blur, no shadow, no shrink tricks.
- FIXED OPENING (hero law): the plante-totem's plate must live in the first viewport. Allowed compositions: the split (headline column 55–60% + tall plate), the plate-as-cover (a full-width plate frame wrapping the title), the double-page spread, the index-as-hero. At least one pressed silhouette at a hero edge; the headline carries one Latin line or ONE roman moss-colored accent word (upright — italic in a headline exists only as a full Latin line). NEVER a centered title–subtitle–CTA stack on bare ground.
- FIXED CLOSING: the contact form set INSIDE a plate frame, numbered as the collection's last plate ("PL. 06 — la dernière planche" register); the practical facts (address, hours, phone) as a tag list or dotted-leader table; then the footer: one sprout-ended rule, the wordmark at clamp(2.4rem,6vw,4.5rem), a tied tag carrying city + year, small print at 12px.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: l'index (dotted-leader list of indications or services, two columns ≥900px, each entry numbered) · la collection (2–4 plates in an OFFSET grid — columns shifted 2–4rem vertically, never a flush equal-height row — with price tags hung on the frames) · la planche pinned showpiece (spec below) · le sous-bois (the one deep band: credentials, manifesto line or pull-quote) · la tige (a drawn stem crossing the section, connecting 3–5 steps at leaf nodes) · la citation (display pull-quote with a Latin line and a rule that grows).

## Motion identity (GSAP 3 + ScrollTrigger; CDN dead → a complete readable herbarium)
THE LAW: hidden states exist only via gsap.set — never in CSS. Gate every animation on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). The SVG markup always contains the FINISHED drawing; JS winds it back (strokeDashoffset = path length, leaves scaled down at their joints), then grows it.
- Personality: GROW / UNFURL. Stems, rules and strings draw via strokeDashoffset (0.8–1.6s, power2.out). Leaves unfurl: scale 0.25→1 with rotation from −16°, transform-origin AT THE STEM JOINT (left center of the leaf group). Tags drop 20px and settle with ONE ±2° sway (sine.inOut, 0.5–0.6s) — one sway, never a pendulum.
- Easing identity: power2.out for growth and rises, sine.inOut for sways and settles; durations 0.7–1.4s; staggers 90–180ms. NOTHING bounces (no back, no elastic), nothing snaps, no overshoot ever.
- Entrances: text rises 24–32px with 100–140ms staggers; a plate enters frame-first (0.4s), then stem draw, then leaves unfurl bottom-to-top, then its tag settles.
- THE SHOWPIECE (exactly one per page, scrubbed): a large plate GROWS across a pinned viewport — stem draws, branches follow, leaves unfurl in botanical order, flowers dot on, then 3–5 labels pin to the joints with their tie-strings drawing in. Desktop ≥900px: pin + scrub 1, 220–280vh of scroll. Below 900px: no pin — the same timeline plays once on entry over 2.5–3.5s.
- Hovers: tags swing ≤3° from their eyelet (200–300ms, sine); plates may breathe a 0.4° sway; leaders and silhouettes never move. Keyboard and touch parity always — focus-visible triggers what hover triggers.
- Reduced motion: the page is the finished herbarium — everything drawn, every tag hung, zero movement. A designed still, not a blank.

## Ban list (the global ban list applies; in addition)
1. Photography of any kind, including "just the hero" — one photo kills the herbarium.
2. Watercolor washes, pigment blooms, painted edges, brush underpainting — that is AQUARELLE's language; HERBIER is pen line, never pigment.
3. Drawn ROOM miniatures, interiors, architecture, arch frames and arch-topped anything — that is MATIÈRE's language; HERBIER draws plants only and its corners stay near-square.
4. The single sumi-e brush stroke — that is WABI's gesture.
5. Handwritten annotations, arrows, any handwriting face (the Caveat register) — that is CARNET's language; HERBIER's warmth is typographic, never scrawled.
6. Die-cut sticker halos and peel-corner hovers — that is GOMMETTE's language.
7. Gradients of any kind, including green-to-yellow "eco" washes.
8. Leaf emoji, leaf icon fonts, clip-art foliage — every leaf is drawn by this world's pen or it does not exist.
9. Full-page grain or noise overlays (plaster grain is MATIÈRE's move).
10. Floating letter-spaced micro-caps on bare ground (ÉCRIN's whisper) — HERBIER labels live on tags.
11. Bounce and overshoot easings, squash-and-stretch (GUIMAUVE's spring).
12. Leaves drifting as background confetti or parallax debris — silhouettes rest between the pages.
13. Wellness-brand vocabulary and imagery: smoothie bowls, lotus poses, "détox" copy.
14. Rounded blob shapes, organic squiggle section dividers.
15. A second deep band — le sous-bois is one held breath per page, wherever the brief places it.
16. One italic accent word set in the accent color inside an otherwise roman serif headline — that is VELIN's tic, and VELIN is a fusesWith neighbor, so the boundary matters doubly. HERBIER's headline accent is a ROMAN moss word; its display italic exists only as a Latin binomial or a full pull-quote line. Boxed drop caps and double-filet rules are VELIN's too.

## LES GESTES (moves menu)
1. LA PLANCHE D'OUVERTURE — hero split: headline column left (55–60%), the tall totem plate right, one silhouette tucked under the headline. On load the plate grows: frame, stem 1.2s, leaves staggered 90ms, tag settles last.
2. L'HERBIER OUVERT — a double-page spread: two plates side by side over a 1px center-fold hairline, folio numbers left and right. Carries avant/après logic without photos (sparse plant / flourishing plant).
3. L'INDEX SEMINUM — the dotted-leader index: entries numbered n° 01…, term in body 700 left, detail right, leaders between; two columns ≥900px. Rows rise 100ms apart.
4. LA COLLECTION — 2–4 offset plates with price tags hung on their frames; column offsets 2–4rem; each plant draws as its plate enters; tags settle with the single sway.
5. LA PLANCHE N°1 — the scrubbed showpiece: the method, menu or programme grows as one large pinned plate; 3–5 tags pin its claims to the stem joints in reading order.
6. LE SOUS-BOIS — the deep green-ink interlude: chalk display line, sage silhouettes at 30%, credentials as a tag stack; entered by a rule that grows across its top edge.
7. LA TIGE — a drawn stem crosses the section (horizontal ≥900px, vertical below) with 3–5 leaf nodes; the stem draws on entry, each leaf unfurls as its step card rises beneath a ghost numeral.
8. LA LOUPE — a 120–160px hairline circle inset showing a 2.5× enlarged fragment of a plate with its own micro-caption; a thin line ties it to the source point.
9. L'ÉTIQUETTE PENDUE — the micro-interaction: any tag on hover/focus swings ≤3° from its eyelet, once, sine.inOut 0.5s. Applies to the nav CTA, price tags, credential tags.
10. LA CITATION LATINE — a pull-quote break: one display line clamp(1.6rem,3.2vw,2.6rem) with its source tied on a tag beneath, preceded by a sprout-ended rule that grows.
11. LE SEMIS — a grid entrance: each item's ghost plate-numeral appears first in sage, then the content rises under it, 140ms apart — the bed sown, then sprouting.
12. LE PLI — a pressed silhouette sits exactly on the boundary hairline between two sections, half in each, like a leaf caught in the fold.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. CABINET FLORE — nutritionist, Tunis. Totem: fennel. La planche d'ouverture with an olive plate beside "La nutrition, observée de près"; showpiece PL. 01 is the fennel of the method, four principle tags pinning to its joints; the sous-bois carries the practitioner's credentials as tags. Mood: consultation calme, science douce.
2. L'INFUSOIR — tea house, Alger. Totem: verbena. Hero: l'herbier ouvert — verbena plate left, the carte's index right over the fold hairline. Showpiece: la tige — one long verbena stem crossing the carte, each leaf node an infusion with its steep-time tag. Motion slowed to 1.4s draws. Mood: vapeur, patience.
3. HAMMAM DES SIMPLES — spa hammam, Marrakech. Totem: eucalyptus. Its one deep band OPENS the page: green-ink hero, chalk type, the eucalyptus plate drawn in sage strokes; the rest of the page stays chalk. Showpiece: the eucalyptus plate where stipple-dot steam rises along the scrub as leaves unfurl. Mood: pénombre végétale.
4. RACINE STUDIO — yoga pilates, Tunis. Totem: papyrus. Hero: plate-as-cover — a full-width plate frame wraps the studio's name, silhouettes at both edges. Showpiece: les quatre stades — the papyrus drawn four times across one pinned spread, graine, pousse, feuille, ombelle, one stage stroking itself in per scrub beat with long still holds between them, each stage tagged with a level of practice. Mood: souffle, régularité.
5. JARDINS DE L'ARIANA — landscaping gardens. Totem: bitter orange. Hero: a panoramic bed — one wide low plate (full-width, ~40vh) where a border of five species stands in a row. Showpiece: the border grows species by species on scrub, each receiving its Latin tag; past gardens shown as la collection. Mood: pépinière fière.
6. PHARMACIE EL AZHAR — pharmacy. Totem: chamomile. Hero: l'index seminum AS the hero — the page opens on the cabinet's index in two dotted-leader columns under a compact title, a small chamomile plate in the corner. Showpiece: la loupe travels — the scrub moves a magnifying circle along the chamomile, revealing enlarged fragments with micro-captions (fleur, feuille, graine). Mood: officine de quartier, sérieux tendre.
7. SOUS LES PINS — camping glamping, Aïn Draham. Totem: Aleppo pine. Hero: a pressed-pine ridge — silhouettes composed as a skyline band above the title, the one variation where silhouettes carry the hero. Showpiece: a pine branch grows and its cones hang in as the three lodges' price tags, each settling with the single sway. Mood: air frais, inventaire de forêt.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the DRAWN PLATES (line quality above all — if the plants read as icon-font clipart the herbarium collapses into a template; the photography budget is spent on paths), the TAG SYSTEM (real strings, real eyelets, one consistent geometry — the tags are what make prices and labels feel collected rather than listed), and GROWTH DISCIPLINE (stems draw, leaves unfurl at their joints, one sway maximum — a single bounce turns the herbarium into a cartoon). The cheap details that separate it from a generated page: plate numbers in small caps, the Latin italic with its vernacular after the em dash, dotted leaders, the ochre string budget, sprout-ended rules, one silhouette caught in a section fold. When in doubt, add a Latin caption, not a decoration — precision is this world's warmth.`,
	energy: "quiet",
	family: "organic-botanical",
	// velin: botanical plates enter the revue — wellness editorial.
	// wabi: the garden meets the still room — retreat brands.
	// eclat: pressed plates warm to studio light — botanical beauty brands.
	fusesWith: ["velin", "wabi", "eclat"],
	id: "herbier",
	industries: [
		"nutritionist",
		"psychology / therapy",
		"physiotherapy / kiné",
		"home care / nursing",
		"general practitioner / cabinet",
		"pharmacy",
		"veterinary",
		"spa / hammam",
		"skincare / esthetician",
		"yoga / pilates studio",
		"landscaping / gardens",
		"grocery / gourmet",
		"tea house",
		"camping / glamping",
		"cosmetics brand",
		"home & decor shop",
	],
	kind: "website",
	mood: ["calm", "botanical", "precise", "tender", "unhurried"],
	name: "Herbier",
	preview: {
		accent: "#55703E",
		fontFamily: "Lora",
		ground: "#F3F1E7",
		ink: "#24301F",
		sampleWord: "Herbier",
	},
	priceFeel: "accessible",
	tagline:
		"Planches botaniques à l'encre verte, étiquettes nouées, calme scientifique sur papier craie.",
};
