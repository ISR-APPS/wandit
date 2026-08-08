import type { DesignWorld } from "../types";

/**
 * POUDRE — the cool mauve house of care.
 * Popular wave (batch 10): the modern beauty-brand site — the register a
 * cosmetics label or an institut asks for by name — matured out of its
 * candy phase into a cold, exact, editorial version. Photography is macro
 * texture only; masks are ellipses only; the shade row retints one panel
 * and nothing else. Values below were measured on the shipped demo
 * (Poudre — institut & maison de soin, Hydra, Alger).
 *
 * fusesWith rationale: voeu (shares the still, photographic, ceremonial
 * calm — voeu brings the event, poudre brings the product), catalogue (the
 * quiet retail grid needs poudre's texture register when the object is a
 * cosmetic), eclat (the warm skin world — pairing gives a clinic a cool
 * lab and a warm cabin), onde (the wet ritual house — poudre is its dry,
 * powdered sibling).
 */
export const poudre: DesignWorld = {
	id: "poudre",
	name: "Poudre",
	family: "poudre",
	tagline:
		"Le mauve froid d'une maison de soin : macros de texture, ovales, nuancier.",
	kind: "website",
	mood: ["powdery", "cool", "elegant", "hushed", "exact"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"cosmetics brand",
		"cosmetics / skincare brand",
		"skincare / esthetician",
		"spa / hammam",
		"nails & lashes studio",
		"makeup artist",
		"hair salon",
	],
	avoidFor: [
		"construction",
		"automotive",
		"gym / fitness club",
		"crossfit / functional",
		"martial arts / combat sports",
		"lawyer / law firm",
		"notary",
		"security company",
		"electronics / gadgets",
	],
	fusesWith: ["voeu", "catalogue", "eclat", "onde"],
	preview: {
		ground: "#EFE9EE",
		ink: "#4A3A40",
		accent: "#8B6E9E",
		fontFamily: "Italiana",
		sampleWord: "poudre",
	},
	doc: `# DESIGN WORLD: POUDRE — the cool mauve house of care

## Philosophy
This page is a SWATCH LAID ON A COLD TABLE, photographed at 1:1 and named — not a brand story, not a mood board, but a maison showing what a product is MADE OF before saying what it does. Two structural facts govern everything. First, imagery is MACRO TEXTURE ONLY — crushed powder, a cream swirl, a silk drape, petals on a plane — in diffused studio light, one cool lilac-ivory family; no faces, no lifestyle scenes, no packshots, no props. A delivered packshot stays unused and is NOTED as unused: the TEXTURE IS THE PACKSHOT — a product is presented by the matter it is made of, and the copy says so. Second, every photographic mask is an ELLIPSE — a soft oval, taller than wide — and every other frame is a plain rectangle at 0–2px radius. Nothing between exists: a 24px rounded photo card is an instant failure; an arch is another world's property.
The register is cool, dry, unhurried, slightly clinical: warmth here comes from honesty, never color temperature. Impossible failure modes: it cannot become golden-hour lifestyle (the grade forbids it), sugary (candy pink and blobs are banned), or a supplement-ad grid (no icon cards, no badges). Self-audit before shipping, all countable: (1) three or more oval photo masks, ZERO rounded-rectangle media; (2) one FULL interlude, at most one RULE, both full-bleed; (3) one shade-dot row retinting exactly ONE panel — a second element changing color means the build is wrong; (4) zero italics, script faces, gold, or hex warmer than the ivory register; (5) accent mauve on six inked elements per viewport at most; (6) every price in the display serif at full ink, never mono, and no prose tier under rgba(ink,.78).

## The variation contract (why two POUDRE sites are siblings, not clones)
WORLD LAW — never renegotiated by brief or builder:
- Macro-texture photography only, one shared grade, ellipse masks only.
- Cool lilac-grey ground family; ink is a desaturated plum-brown, never black; the single accent is a COOL mauve.
- The nuancier: one shade-dot row retinting ONE swatch panel, present on every build.
- Thin high-elegance display serif above; plain humanist sans for everything that must be read.
- Powder-settle motion: 1.3s sine, scale 0.98 to 1, nothing bounces, nothing snaps, one scrubbed showpiece.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The exact hexes in each register (the demo runs #EFE9EE / #E4DAE4 / #4A3A40 / #8B6E9E; a colder client takes #ECEAF0 with a #7E6E9B accent, a dustier one #F0EBE9 with #93748C).
- The display face WITHIN the register: Italiana, Tenor Sans, Gilda Display (one per site; never two).
- The SHADE LADDER: how many teintes, their names, their order — the client's identity; six in the demo, four to eight in the register.
- The DRIVING NOUN: la texture, le grain, la lumière du jour, la base — it names the hero line, the interlude captions and the showpiece.
- The macro subjects the client owns, the section order beyond the fixed opening and closing, and whether the middle carries a price list, a shop grid or an ingredient register.
A POUDRE build with no shade ladder is a failure. Name the teintes FIRST; they tell you the palette, the captions and the showpiece.

## The vibe (voice)
Cool, exact, slightly under-sold French. Quantities and origins instead of adjectives. Never "des ingrédients d'exception" — say the percentage and the town. Say what you do NOT do; it is the register's strongest move.
- "Riz broyé fin, argile blanche, iris. Fixe la peau sans la masquer."
- "Nous ne vendons rien à la fin d'un soin. Vous repartez avec le nom des matières, la quantité utilisée, et le droit de réfléchir."
No exclamation marks, superlatives, "révolutionnaire", promises of transformation, or urgency. One dry, almost funny line per page is allowed ("Elle est toujours au catalogue.") — and it must be true.

## Visual signatures (measured, reproducible)
- TEXTURE MACRO INTERLUDES (owned tic): full-bleed cosmetic macros as section dividers, in two registers. FULL: height clamp(280px, 50vh, 500px), one display line right-set at clamp(1.7rem, 3.6vw, 3.2rem) max-width 13ch in ivory #F8F5F8, plus one micro caption. RULE: height clamp(150px, 21vh, 236px), caption only, no headline. One FULL and at most one RULE per page. Legibility is a directional scrim, never a full dim: linear-gradient(to right, rgba(57,44,52,0) 16%, rgba(57,44,52,.30) 50%, rgba(57,44,52,.66) 100%) for right-set type, mirrored for left-set. The scrim sits BELOW the text layer (z-index 1 against 2); painting it over the type is the classic bug.
- SHADE-DOT ROWS (owned tic): 4–8 round buttons, 30px desktop / 27px mobile, gap clamp(.55rem, 1.1vw, .9rem), each filled with its teinte, bordered 1px rgba(74,58,64,.22). The active dot takes scale(1.12) and a double ring: 0 0 0 3px plate, 0 0 0 4px ink. Selecting a dot retints ONE swatch panel over 0.6s cubic-bezier(.4,0,.2,1) and rewrites its name, reference and one-line note. It never retints the page. That panel — LA PASTILLE — is pressed matter, not a paint chip: inset 0 15px 32px rgba(248,245,248,.14) and inset 0 -17px 36px rgba(45,34,41,.21) for the pan edge, plus a feTurbulence grain (baseFrequency .9, opacity .42, soft-light) inside the ellipse only — page-wide grain is matiere's.
- OVAL PORTRAIT MASKS (owned tic): border-radius 50% on aspect-ratio 0.72–0.86 — hero oval 0.74, product ovals 0.86 capped at 318px, register ovals 0.72, the nuancier swatch 0.74 at clamp(150px, 20vw, 278px). Ovals may overlap a section seam or a photo band by 88–160px; that overlap is the world's favourite joint.
- HAIRLINES, NEVER BORDERS: rules are 1px rgba(74,58,64,.17); the world's only box-shadow is on LA PASTILLE, the swatch oval (0 24px 60px rgba(45,34,41,.22) over a 1px ivory ring, because it floats on a photograph). LA PLAQUE, the ivory plate under the type, carries none.
- MICRO-CAPS LABELS: 0.66rem, weight 500, uppercase, letter-spacing 0.24em, in the accent's deep twin, on bare ground — no pill, no rule, no chip.
- SERIF PRICES: every price, duration total and gram weight sits at FULL INK in the display serif at clamp(1.05rem, 1.4vw, 1.3rem), unit in 0.72rem tracked caps underneath. This holds on the showpiece: the shade's price is the plate's strongest line, never a muted run-on; a second figure (refill, deposit) sits beside it in the secondary tier at 0.83rem.
- THE OVAL GLYPH: a 9x13px mauve ellipse before the wordmark, 12x17px in the footer. The only ornament.

## Color physics
- GROUND A: cool lilac-grey, the #EFE9EE / #ECEAF0 / #F0EBE9 register. GROUND B: 8–12 RGB points deeper and slightly more violet, the #E4DAE4 / #E3DEE8 register. Sections alternate A / B; two adjacent A sections is a rhythm fault — insert an interlude or flip to B.
- PLATE: #F7F4F7, used only for the form panel and for plates that sit over photographs (at 0.945 alpha there).
- INK: a desaturated plum-brown, the #4A3A40 / #46383F register. Never black. Text tiers on ground B: full ink for headlines, rgba(ink,.84) for prose (5.3:1), rgba(ink,.78) for secondary and for anything on the ivory plate (4.6:1), rgba(ink,.68) for tracked-caps captions (3.6:1). No sentence sits below .78 — a .40 prose tier ghosts at 2:1 and is a shipping fault.
- ACCENT: one COOL mauve, the #8B6E9E / #7E6E9B / #93748C register, with a deeper twin (#6C5280) that is not only the hover state: every accent role under 0.9rem — micro-caps, duration chips, numerals, shade refs, list links — takes the twin, the base mauve being 3.2:1 at caption sizes. Budget per viewport: micro-caps label, one CTA, active dot ring, one accent word in a statement, product numerals. That is the ceiling.
- DEEP: #392C34, used for the FOOTER band, for photo scrims, and as the safety ground behind a pinned macro — nowhere else. POUDRE has no mid-page inverted interlude; full-page inversion is another world's move.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · ACCENT→--primary · PLATE→--primary-foreground · GROUND B→--secondary · DEEP→--accent · ink at 68%→--muted · ink at 17%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, scrim or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- The shade ladder is a real color system, not decoration. The demo's six: Voile #E7D9E2, Argile #D9C3C8, Iris #B99CC4, Mauve #8B6E9E, Prune #6A4F6B, Ombre #4A3A40 — climbing from ground to ink, the house's origin teinte at position 4.
- GRADIENTS exist in exactly three places: the directional interlude scrims, the 102deg showpiece-stage scrim, and the select arrow's two 5px triangles. Nowhere else — no gradient text, no gradient borders, no glow, no radial aura behind an object.

## Typography system
- DISPLAY: a thin, wide, high-elegance serif — Italiana, Tenor Sans or Gilda Display, ONE per site, weight 400 only. h1 clamp(2.55rem, 5.9vw, 5.3rem), line-height 1.0, letter-spacing -0.004em, max-width 14ch. h2 clamp(1.95rem, 3.9vw, 3.5rem), line-height 1.06. h3 clamp(1.25rem, 1.7vw, 1.6rem). Statement paragraphs may run in the display face at clamp(1.6rem, 2.9vw, 2.75rem) / 1.24, max-width 22ch — the only display prose allowed.
- BODY: a plain humanist sans — Hind, or Commissioner if Hind is taken — weight 300 for prose, 500 for labels and buttons. Size clamp(1rem, .94rem + .22vw, 1.09rem), line-height 1.72. Secondary text 0.93–0.98rem.
- NEVER ITALIC, in either face. Emphasis is the accent color or nothing. NEVER a script face — voeu's. NEVER mono — captions are the sans in tracked caps, not machine type.
- Display type never sets under 0.9rem except prices and numerals; body type never sets a headline.
- Arabic pairing rule: if the page serves Arabic, the display serif steps aside for Amiri (weight 400) at the same clamps minus 8%, body becomes Noto Kufi Arabic 300/500; tracking on Arabic micro-caps drops to 0.08em, and letter-spacing is never applied to Arabic prose.
- Wave law: display type stays at or under 10vw; fit-to-viewport headlines and 15–25vw word-structures belong to other worlds.

## Signature art (photography law) and components
- PHOTOGRAPHY: macro cosmetic texture, one art-direction phrase reused for every asset — "macro cosmetic texture photography, crushed powder and cream swatch, soft mauve and ivory palette, diffused studio light, no text". Subjects: crushed powder burst, cream swirl, silk drape, petal still-life, pressed pigment. No people, no hands, no packaging, no text in frame.
- THE GRADE IS LAW: filter: saturate(.95) brightness(1.03) on every photographic element, no exceptions, so four assets from four sessions sit in one palette. Nothing is desaturated to grey, nothing warmed.
- CROPS: object-position is chosen per placement so an asset never repeats a frame — a band shows the powder line, a product oval a 24%/44% or 44%/55% detail of the same file. Reusing an asset is legitimate; reusing a crop is lazy. The crop is part of the GRADE: an oval landing on a warm fold while its neighbours read cool is re-picked and measured, not eyeballed.
- TYPE ON PHOTOGRAPHY: two forms only — ivory type on a directional scrim (interludes), or ink type on an ivory PLATE (the showpiece). Never centered white type on a full dim.
- CAPTIONS: 0.68rem, tracked 0.19em, uppercase, ivory at .86 over photography with a 0 1px 14px rgba(45,34,41,.5) shadow, or rgba(ink,.68) on ground. They carry a fact, never a mood: "crème riche — quarante minutes de fouet lent".
- BUTTONS: pill — buttons, chips and ghost pills consume var(--radius) directly (the 999px pill) — padding 1.02em 1.9em, 0.86rem uppercase 0.09em tracking weight 500. Filled accent with ivory text, or ghost with a 1px hairline border turning accent on hover/focus. No shadows, no icons, no arrows.
- FORMS: underline-only fields — no boxes. Label above in 0.68rem tracked caps at rgba(ink,.78), never lower: the plate is bright and small tracked caps lose weight on it. Transparent input with a 1px hairline bottom border turning accent on focus; select with a 5px CSS triangle in accent; two columns on desktop, one on mobile, the message field spanning. Phone input is type="tel", inputmode="tel", local placeholder. On valid submit: dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail (the demo sends nom, telephone, rituel, moment, message and the selected teinte), hide the form, reveal an honest success block with a real next step and a callable number. One off-canvas decoy carrying data-wandit-hp sits at left:-9999px, tabindex -1, untouched by the page's script.
- FAVICON: an inline SVG data URI — a mauve ellipse (rx 6.5, ry 9.5) on the ground square.

## Page chassis
- Container: width min(1250px, 100% - clamp(2.5rem, 7vw, 7.5rem)). Section rhythm: padding-block clamp(4.2rem, 9.5vh, 7.5rem), dropping to clamp(3.4rem, 7.5vh, 5rem) under 620px.
- HEADER: sticky, ground A, 1px hairline bottom, no blur, no shadow. Oval glyph + lowercase wordmark in the display face at clamp(1.5rem, 2.1vw, 1.95rem), text nav at 0.87rem, one ghost pill CTA. Under 900px only the wordmark and the CTA remain — no burger.
- FIXED OPENING (hero law): the first viewport holds a texture macro AND an oval AND the display statement. The demo's arrangement — macro band at clamp(178px, 25vh, 288px), then a body of 1fr | clamp(196px, 27vw, 352px), type left, a tall oval hanging off the band at margin-top clamp(-160px, -13vh, -88px) — is one of several legal ones. Under the h1 the type column splits again: a 46ch lede and the CTA pair left, a hairline RAIL of two practical facts right (1px border-left, 0.66rem tracked-caps terms, 0.86rem lines) — without it a wide hero's lower half is an L-shaped void. The hero closes on a hairline meta row: three facts, space-between, 0.76rem tracked caps.
- FIXED CLOSING: a réservation section on ground B at 0.78fr / 1.22fr — heading left over a 2x2 hairline register of coordinates, the ivory form plate right — then a deep #392C34 footer band: oval glyph, wordmark, three coordinate columns, one hairline rule of legal micro-caps.
- FREE MIDDLE (compose 4–6, never two adjacent alike): the statement section (display prose max 22ch + a two-paragraph side column + a three-fact hairline row) · the FULL interlude · the drift row (ovals staggered in y and x) · the NUANCIER showpiece · the minuted list (sticky heading left, hairline rows right: name, duration chip, serif price, one honest line) · the RULE interlude · the material register (2x2 named matters with percentages and origins, one large oval beside) · a shop grid above four references.

## Motion identity — POWDER SETTLE
- Entrance: opacity 0 to 1, y 18 to 0, scale 0.98 to 1, duration 1.3s, ease sine.out, stagger 0.09s, transform-origin 50% 60%, fired once per section at start "top 80%". The hero group runs on load with a 0.12s delay. Nothing else moves.
- Hidden states live ONLY in gsap.set; the CSS never hides content. With JS dead or reduced motion on, the page is fully composed and readable, the showpiece resting on its origin teinte.
- Gate every animation on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches).
- ONE scrubbed showpiece per page, always on a PINNED texture macro: ScrollTrigger start "top top", end "+=" innerHeight * 2.1, scrub true, invalidateOnRefresh true. Inside the pin the scrub drives a discrete state (the shade index: Math.floor(progress * n * 0.999)) and the pinned photo takes a yPercent -3.2 to 3.2 linear drift — the ONLY parallax in the world, never a scale zoom on a full-bleed photo, which is generique's Ken-Burns.
- Micro-interactions: 0.3–0.45s ease on color and border; product ovals scale their image to 1.045 over 0.8s cubic-bezier(.32,.72,.3,1); list rows shift padding-left 0.8rem over 0.45s. Every hover sits in @media (hover:hover) and is either decorative or duplicated by :focus-within.
- Reduced motion: no tweens, transition-duration forced to 0.01ms, the showpiece composed on its origin teinte, dots fully operable by click and keyboard.

## Ban list (in addition to the global ban list)
- eclat's warm-grade photography in 28–48px deep-rounded masks, her photo-orbit statement and her capsule glyph-badges — POUDRE's grade is cool, its masks ellipses.
- guimauve's puffy blob containers, her big back.out overshoot and her candy-stripe dividers. Nothing here overshoots.
- voeu's script overlay word, her RSVP reply-card blocks and her petal drift — POUDRE may photograph petals but never animates them, and never sets a script.
- matiere's material-swatch cabinet that retints the PAGE and her arch-only geometry — our nuancier retints ONE panel, our geometry is the ellipse.
- catalogue's SKU register captions (mono REF / material / price triplets), her seamless-plinth packshots and her hover angle-swap — POUDRE prices are quiet serif, its products shown as matter.
- onde's steam-veil transitions, her pebble-stack glyph and her ritual numerals in circles.
- aquarelle's watercolour washes, pigment-bloom masks and underpainting.
- generique's Ken-Burns scrub and letterbox bars; silhouette's huge-type-over-photo collision; velin's single italic accent word; iris's radial aura behind the hero object; capitale's giant serif pull-figure.
- Gold, brass, terracotta, sand and any warm-brown hex; centered white type on a dimmed photo; box-shadowed white cards; full-page grain; drawn imagery mixed with the macros; before/after sliders; "efficacité prouvée" percentages.

## LES GESTES (the moves menu)
1. LE BANDEAU — a full-bleed macro band of 20–30vh under the header, cropping a texture into a horizontal rule of matter. It opens a page or separates two dense sections.
2. L'OVALE QUI TRAVERSE — an oval overlapping a band edge or a section seam by 88–160px, half on photograph, half on ground. The signature joint; once per screen, never twice.
3. LE NUANCIER — the shade-dot row plus its single swatch panel: dots as buttons with aria-pressed, panel as a large oval or a plate, name plus reference plus one note rewritten on change. Works as a section, a showpiece, or a product-page sidebar.
4. L'INTERLUDE PLEIN — the full texture interlude: 40–52vh, one display line at 13ch on the scrimmed side, one factual caption in the opposite corner. Exactly one per page.
5. LE FILET DE TEXTURE — the rule interlude: 18–24vh of macro, caption only, breaking a long text stretch. The same tic played quietly.
6. LA DÉRIVE — the drift row: three or four product ovals staggered in Y (0 / +4.4rem / +1.8rem) and X (left, centred, right within their columns), so the row reads as powder settling, never a grid of cards.
7. LA PLAQUE — an ivory plate at 0.945 alpha over a pinned or full-bleed macro, holding ink type. The only way ink sits on a photograph here.
8. LE REGISTRE DES MATIÈRES — a 2x2 register of named matters: numeral, name, "usage / percentage" in tracked caps, one line of provenance, each cell opened by a hairline. Beside it one large oval and an honesty note.
9. LA LISTE MINUTÉE — the price list as a hairline table: name in display, duration chip in accent caps, serif price flush right, one honest line beneath. The sticky left column carries the heading plus a practical register (annulation, paiement, accès) so no column dies empty.
10. LES TROIS FAITS — under a display statement, a hairline row of three facts: tracked-caps term, display numeral, one small line. Stood on its side it becomes LE RAIL: two facts stacked behind a 1px border-left, closing the gap between a hero's lede and its oval column.
11. LE MOT DU FOND — the closing deep-plum band: oval glyph, wordmark at clamp(2rem, 4.4vw, 3.4rem), three coordinate columns, one hairline of legal caps. The page's only dark surface.
12. LA FICHE — the underline-only form on its ivory plate, two columns collapsing to one, the coordinates beside it as a 2x2 hairline register.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**1. LA TEXTURE (institut & marque, Alger)** — the shipped demo. Hero: a powder-macro BANDEAU under the header, the statement flush-left below, a two-fact rail beside the CTAs, a tall petal oval hanging off the band's lower edge, a three-fact hairline row closing the screen. Showpiece: a silk macro pins full-bleed while an ivory plate holds the nuancier and six dots cycle the swatch oval one teinte per scrub step. Middle: statement, full interlude, drift row, showpiece, minuted list, rule interlude, register. Mood: cool, exact, faintly clinical.

**2. LE PORTAIL (marque monoproduit, Oran)** — Hero: one oval at 62vh, centred-left, full of cream macro, the statement flush-RIGHT beside it, a vertical hairline rail of three words down the far margin; no band. Showpiece: the pinned macro holds still while ONE oval mask GROWS from 120px to full-bleed across the scrub, the product name crossfading into an ingredient line at 60%. Middle: portal hero, register, showpiece, minuted list, closing. Mood: solemn, monolithic, museum-quiet.

**3. LE NUANCIER D'ABORD (maquillage, Alger centre)** — Hero: no photograph. A huge statement on bare ground, the shade-dot row directly beneath at 34px, the active teinte's name in the accent — the ladder IS the hero. Showpiece: a pinned macro with a vertical LADDER of six small ovals entering one by one on scrub, each captioned with its teinte, until the ladder stands assembled beside the panel. Middle: dot hero, full interlude, showpiece ladder, drift row, register, closing. Mood: confident, retail, dry.

**4. LA PLAQUE BASSE (institut de quartier, Blida)** — Hero: a full-bleed macro at 78vh, an ivory plate hung in the lower-left third carrying the statement, CTAs and hours. Showpiece: the pinned macro holds while a hairline table of the base formula WRITES ITSELF (riz 62%, argile 21%, figue 18%, iris 4%), each rule drawing and its percentage landing on scrub — no rolling digits, no meter rails. Middle: plate hero, minuted list, showpiece formula, rule interlude, register, closing. Mood: neighbourhood, generous, transparent.

**5. LE DIPTYQUE (marque d'huiles, Tizi Ouzou)** — Hero: two ovals of unequal size, a small one high-left and a large one low-right, the statement threaded on one line BETWEEN them; the meta row runs under the small oval only. Showpiece: the same macro in three ovals side by side, their GRADE shifting across the scrub from the cool house grade to a warmer daylight one and back, under "la même poudre, à trois lumières". Middle: diptych hero, statement, drift row, showpiece, full interlude, closing. Mood: comparative, patient, technical.

**6. LA LOUPE (laboratoire & boutique, Constantine)** — Hero: type ABOVE, band BELOW — statement and CTAs on bare ground, a macro band closing the first viewport like a horizon, one oval resting ON the ground above the band rather than crossing it. Showpiece: over a pinned macro an OVAL LOUPE travels down the frame on scrub, showing the same photograph at a tighter crop, the caption changing at four stops. Middle: inverted hero, register, showpiece loupe, minuted list, rule interlude, closing. Mood: curious, instrument-like, precise.

**7. LA COLONNE DE TEINTES (ongles & regard, Hydra)** — Hero: statement block left at 55%, a COLUMN of three small captioned ovals down the right edge — a shade strip rather than a picture. Showpiece: the pinned macro CROSSFADES to a second macro at mid-scrub while the swatch panel retints and the caption swaps from the dry texture to the finished one. Middle: column hero, drift row, showpiece crossfade, full interlude, minuted list, closing. Mood: fast, urban, service-forward.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or the world collapses into a pale template. First, the PHOTOGRAPHY GRADE and its crops: four macro files under one filter in eight framings is what makes the page look shot rather than picked — one ungraded image, or one crop off-grade, and the spell breaks. Second, the NUANCIER must genuinely work: dots clickable, keyboard-operable, scrub-driven, rewriting name, reference and note, retinting one panel and nothing else; a decorative dot row is the difference between a house and a brochure. Third, the ELLIPSE DISCIPLINE — one 16px rounded photo corner anywhere and the page becomes a wellness template.
The cheap details cost almost nothing: the oval glyph before the wordmark, the unit in tracked caps under every serif price, the practical register in the sticky column so no column dies empty, the caption that gives a time ("quarante minutes de fouet lent") instead of a feeling, the deep-plum footer that lands the page like a lid. When in doubt, remove an adjective and add a quantity.`,
};
