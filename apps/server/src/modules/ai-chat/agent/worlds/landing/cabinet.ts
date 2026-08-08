import type { DesignWorld } from "../types";

/**
 * CABINET — the dark-green law library.
 * Popular wave: the prestige "cabinet d'avocats" site every legal, notarial and
 * accounting client already has in mind — deep green, brass, cream serif, quiet
 * authority — executed at the level they assumed cost 10 000 EUR, and stripped
 * of the genre's dust (no stock handshake, no gavel, no scales-of-justice icon).
 *
 * NO PHOTOGRAPHY BY WORLD LAW. The imagery budget is spent on drawn restraint:
 * dossier-tab geometry, brass hairlines, the screwed nameplate, and clause
 * furniture. worlds/cabinet/demo/assets/ does not exist and must not.
 *
 * fusesWith rationale: capitale (the navy boardroom sibling — same institutional
 * gravity, opposite ground and different furniture), pupitre (shares the
 * hairline discipline and the numbered-authority voice, lends its academic
 * cadence without its footnotes), velin (lends editorial serif calm to a
 * cabinet page that needs to read like a publication rather than a practice).
 *
 * Demo: Benyahia & Associés, avocats au barreau d'Alger — FR copy, DZD fees.
 */
export const cabinet: DesignWorld = {
	id: "cabinet",
	name: "Cabinet",
	family: "law-heritage",
	tagline:
		"Le vert profond du cabinet : onglets de dossier, laiton plat, Caslon.",
	kind: "website",
	mood: ["authoritative", "discreet", "heritage", "precise"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"lawyer / law firm",
		"notary",
		"accountant",
		"financial advisor",
		"business consultant",
		"insurance agency",
		"translation office",
		"recruitment / HR",
	],
	avoidFor: [
		"kindergarten / crèche",
		"kids & baby shop",
		"street food / food truck",
		"gelato / desserts",
		"DJ / entertainment",
		"festival",
		"tattoo & piercing",
		"streetwear / drops",
	],
	fusesWith: ["capitale", "pupitre", "velin"],
	preview: {
		ground: "#16241C",
		ink: "#EDE6D6",
		accent: "#A98B4F",
		fontFamily: "Libre Caslon Text",
		sampleWord: "Maître",
	},
	doc: `# DESIGN WORLD: CABINET — the dark-green law library

## Philosophy
This page is an OPEN FILING DRAWER in a dark-green room, not a website. The metaphor is literal and decides everything: content arrives as files, files carry tabs, tabs ride a rule, and the house rules are numbered like articles of a contract. First structural fact: the manila folder-tab is the world's ONLY non-rectangular geometry — nav, section heads, cards and the form are tab-topped, and nothing is arched, scalloped, pill-shaped or blobby. Second: NO PHOTOGRAPHY, ever. The genre's stock imagery — handshakes, gavels, columns, a suit at a window — is what makes cheap law sites cheap; that budget goes into brass hairlines, a screwed nameplate and drawn SVG dossiers. Third: brass is FLAT — a plate and a hairline, never a glow, never a self-drawing engraving, never a gradient.

"A template with a green tint" is impossible because the content is literally organised as clauses and files; "fusty" is prevented by scale — the serif reaches clamp(2.4rem, 5.6vw, 4.7rem) and the drawer opens across a full pinned viewport. Drafted, not decorated.

Self-audit — six countable checks:
1. Rules: every hairline exactly 1px, at most ONE thicker mark (the 3px considérant bar), zero paired rules.
2. Tabs: at least three tab-topped objects (nav, section head, one card or the form).
3. Articles: numbering unbroken from Art. 1 upward, none skipped, none reused, the last closing the footer.
4. Nameplates: at least one full-size brass plate; every plate carries exactly four screw heads.
5. Cream interludes: one or two, never zero.
6. Loops: zero — nothing pulses, breathes or glows.

## The variation contract (why two CABINET sites never look identical)
WORLD LAW — never renegotiated:
- Deep-green ground family, cream ink, ONE flat brass accent. No photography, ever.
- Tab geometry as the only shaped form; 1px as the only rule weight; the 0/2/4/6px radius register.
- Clause furniture (Art. n — …) as the way structured content is organised; the four-screw brass nameplate as the identity object.
- x-only entrances at 0.8s power2.inOut. No overshoot, no bounce, no loop. One or two cream interludes.
CLIENT-OWNED — where siblings diverge:
- The exact hexes in the green register (#16241C/#1A2A21 · #16241C/#1E3127 · #142019/#1B2A22) and brass within #A2854A–#B49560.
- The display face within the register: Libre Caslon Text, PT Serif or Newsreader — one per site.
- The DRIVING NOUN — le dossier, l'acte, la clause, le délai, le renvoi. It names the hero object, the showpiece, the vocabulary and the section titles. A CABINET page without one is a failure: name it FIRST.
- Whether the identity object is a horizontal drawer, a vertical stack, an opened chemise, or a wall of door plates.
- The section order beyond the fixed opening (tab-railed masthead) and closing (folder form + monument footer).

## The vibe (voice)
Sober professional French, drafted rather than written: short declaratives that commit to something checkable, plus a willingness to state what the firm will NOT do. Vocabulary is exact (convention d'honoraires, diligence, mise en état, honoraire de résultat plafonné), never softened into "solutions juridiques sur mesure". No superlatives, no exclamation marks, no promise of victory. Three lines in register:
- "Un dossier bien tenu vaut la moitié d'une plaidoirie."
- "Nous répondons sous quarante-huit heures ouvrées, y compris pour vous dire que rien n'a bougé."
- "Ce formulaire ne vaut pas consultation et ne crée aucune relation client. N'y écrivez rien de confidentiel."

## Visual signatures (the owned tics, described precisely enough to reproduce)
- **DOSSIER TABS (owned tic).** A trapezoid with a flat top: clip-path polygon(0 100%, 10px 0, calc(100% - 10px) 0, 100% 100%). Heights by role — 32px card, 34px nav, 38px section head and form, 46px hero rail; padding 16–26px. The 1px brass edge: the tab's background IS the hairline colour, an absolute ::before at inset 1px 1px 0 1px carrying the fill. Inactive: ground fill, brass text 11px / +0.15em / uppercase. ACTIVE: solid brass with #16241C text. Every tab sits ON a rule at margin-bottom:-1px, never floating.
- **CLAUSE FURNITURE (owned tic).** Structured content is numbered as articles; the clause head is a baseline flex row: "Art. n" (sans 600, 11px, +0.16em, brass, tabular) — a brass em-dash — the title in display serif at clamp(1.15rem, 1.5vw, 1.42rem) — then a 1px brass rule filling the line (flex:1 1 2rem, translateY(-6px), transform-origin left). Body under it at 62ch; below 720px the rule wraps full-width beneath the title. Numbering runs unbroken: Art. 1–4 house rules, Art. 5 fees, Art. 6 the form's disclaimer, Art. 7 the footer mentions.
- **BRASS NAMEPLATE, FOUR SCREW HEADS (owned tic).** Solid #A98B4F, radius 2px, padding 1.2–1.9rem × 1.6–3rem; name in display serif 700 at #16241C, sub-line in rgba(22,36,28,.78) at 10.5px / +0.16em. Four screws: 8px circles (6px on the small plate) inset 9px (7px) from each corner, filled #7A6130, each with a 1px #4E3F1E slot rotated −32deg. Exactly four, always. The only filled-brass surface besides the primary button and the active tab; it recurs at three scales — identity, door, micro.
- **THE DRAWN DRAWER (the hero's SVG object).** An ENCLOSURE first — a #101A14 box with 14px walls around a #0A120E interior — because stacked sheets without walls read as a bar chart. FOUR files, never five: three seated, 30px faces alternating #1B2C23 / #21332A, 14px gutters of drawer ground between them, each narrower than the file in front (a taper, never a shared baseline); plus ONE file OUT at #2C4436 with a 38px face, riding over the drawer's left wall and lying across its front rail, tab filled brass. Tabs 32px tall, 52px wide, in three CUT POSITIONS ordered right, left, centre, then left again on the file that is out — never a monotonic march, which is exactly what turns notches into a staircase and the object into a bar chart. Strokes #A98B4F at 0.42 (0.62 on the file that is out); a 60×6px brass handle.
- Rules: 1px, brass at 34% for structure and 16% inside lists and clause stacks; the one exception per page is the 3px × clamp(44px,5.6vw,92px) considérant bar. Card stock: every panel gets box-shadow: inset 0 1px 0 rgba(237,230,214,.05) and radius 0 6px 2px 2px.
- Labels NEVER float on bare ground: a label lives in a tab, on a plate, right after an Art. marker, or HEADING A 1PX HAIRLINE — the fourth form opens the letterhead grid, the procedure rail and the access note. In a definition list every dt takes its own brass-16% top rule, the first inheriting the list's brass-34% rule instead: never two rules at one edge. (Floating micro-caps on bare ground are ECRIN's.)

## Color physics
- GROUND A (the room): #16241C / #142019, a deep slightly warm green-black — hero, showpiece, contact.
- GROUND B (the raised file): #1A2A21 / #1B2C22, 4–7 RGB points lighter. Alternates with A to mark section rhythm; also fills folders and form bodies. RECESS: #101A14 — footer and any panel set INTO the page.
- INK: warm cream, #EDE6D6 / #E9E1CF. Never white. Body at 72%, captions and meta at 52% — but on GROUND B that tier LIFTS TO 60%, because 52% cream on #1A2A21 measures 4.37:1 and fails AA (on A it clears at 4.52). The headline's trailing soft word sits at 56%.
- ACCENT BRASS: #A98B4F, hover #C4A467, screws and shade #7A6130. Budget: active tab, primary button, plate fills, hairlines, Art. markers, figures, cross-reference links. Never a headline word, never a wash, never larger than a plate.
- CREAM INTERLUDE: ground #F0EAD9, ink #1E2A22, brass DEEPENED to #7A6130 for text (#A98B4F fails contrast on cream). Filled plates keep #A98B4F.
- ZERO gradients anywhere, including the drawn objects: depth is flat fills and dark gutters, never blends.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · ACCENT BRASS→--primary · GROUND A→--primary-foreground · GROUND B→--secondary · RECESS→--accent · ink at 52%→--muted · brass at 34%→--border · 2px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, hairline or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Libre Caslon Text (400/700) / PT Serif (400/700) / Newsreader (300–500) — ONE per site. Hero clamp(2.4rem, 5.6vw, 4.7rem) / 1.05 / −0.018em. Section titles clamp(1.9rem, 3.3vw, 2.9rem) / 1.10. Showpiece panel titles clamp(1.7rem, 3vw, 2.55rem) / 1.12. Client quote clamp(1.42rem, 3.5vw, 3.05rem) / 1.24. Footer monument clamp(2.2rem, 8.8vw, 6.4rem) — the vw term is steep so the name fills the line on a 390px phone. Display-to-body ratio ~4.5:1: a drafted document, not a billboard. Never above 10vw.
- BODY: Work Sans (400/500/600), clamp(1rem, 0.96rem + 0.22vw, 1.0625rem) / 1.62, measure 62–68ch. The sans NEVER sets a headline; the serif NEVER sets a label or a field. LABELS ("brass small-caps"): Work Sans 600, 10.5–11px, uppercase, +0.16em, brass.
- NUMERALS: display serif with tabular-nums for fees, dates, counts and article numbers; the currency or unit suffix drops to the sans at 10px / +0.14em in brass ("12 000 DZD", "18 000 DZD / h"), thousands on a non-breaking space.
- ITALIC LAW: italic only for Latin locutions in body copy and one emphasised verb in the client quote. Never in a headline: that lockup is VELIN's.
- ARABIC PAIRING: Arabic headings in Amiri, the same brass small-caps labels, the tab clip-path mirrored so the notch leads from the right, clause numbering in Eastern Arabic numerals.

## Signature art & components (the drawn system)
- IMAGERY IS DRAWN, NEVER PHOTOGRAPHED. Permitted objects: the drawer, the nameplate, tab rails, hairline ledgers, one small SVG folder glyph as the wordmark. Objects are FILLED flat shapes with 1px brass strokes; they arrive by sliding, never by drawing themselves.
- BUTTONS: primary is solid brass, consuming var(--radius) directly (the 2px chamfer), 1rem × 1.7rem, sans 600 / 11.5px / +0.15em uppercase in #16241C, hover #C4A467. Ghost is transparent with a 1px brass-34% border going full brass on hover/focus. No underline CTAs, no icon buttons.
- CARDS (the folder): tab top-left, ground-B body, 1px brass-16% border, radius 0 4px 2px 2px, inset top highlight, a 9px hairline chevron rotated 45deg at the right edge going full brass when current. The active folder takes ground #1F3227, a brass-34% border and a solid brass tab. LE RENVOI: cross-reference links in brass with a 1px brass-16% underline filling on hover/focus.
- FORMS (la chemise): an open folder, a 38px tab naming the request riding the top edge of a ground-B body, 1px brass border, radius 0 6px 2px 2px. Fields transparent with a 1px brass-34% bottom rule only, labels above in brass small-caps, focus taking the rule to full brass. Phone-first tel input with inputmode, a select for the matter, one question the genre never asks and should ("La partie adverse est-elle déjà représentée ?"), and an honest disclaimer beside the submit stating what the form is NOT. On valid submit dispatch wandit:lead on document with the visitor's fields flat in detail, and keep one off-canvas decoy input carrying data-wandit-hp that the page's own script never reads. Success replaces the form with a real reference number, a callback delay, and what will not be asked.
- FOOTER: the name at monument scale over a 1px brass rule, a four-column practical grid, then the final clause (Art. n — Mentions) carrying registration, insurance and the fee-freedom statement. FAVICON: inline SVG data URI, a brass folder outline on #16241C.
- Accessibility floor: one h1, semantic landmarks, :focus-visible 2px brass offset 4px, ::selection brass on ground (deep brass on cream), decorative SVG aria-hidden, the drawn drawer carrying role="img" with a real French aria-label, keyboard and touch parity on every hover.

## Page chassis
- Container min(1280px, 90vw). Section rhythm clamp(4.5rem, 9vh, 7.5rem); scroll-margin-top 5rem.
- HEADER: sticky, ground A, 1px brass bottom rule, wordmark plus folder mark left, nav as small dossier tabs sitting ON the rule with the CTA tab filled brass, phone in display serif right. No blur, no shadow. Below 980px the tabs retire, the phone stays.
- FIXED OPENING — the tab-railed masthead: two columns, minmax(0,1fr) plus a clamp(17rem, 26%, 23rem) right rail. Left: eyebrow on a short brass rule, statement, lead, two CTAs, one Art. 1 teaser with a cross-reference. Right rail, justify-content:space-between so it stretches to the type's height: letterhead (1px-topped label/value grid — address, hours, registration), the drawn drawer, the nameplate, a meta line. The hero ends flush (padding-bottom 0) on a full-bleed rail of large tabs naming the practice areas, riding the rule that opens the next section. The first viewport holds statement, plate, drawn object and rail.
- FIXED CLOSING: the folder form beside a practical column (address, phone, hours, on-call line, access note, a micro nameplate for floor and door), then the footer.
- FREE MIDDLE — compose 3–5, never two adjacent alike: the clause stack (sticky lead column beside Art. n rows) · the pinned drawer showpiece · the door-plate roster with a hairline collaborator ledger · the fee ledger beside a numbered procedure rail, closed by a recessed convention block · the considérant (one client quote beside a hairline figures column) · a tab-index strip of cities, languages or matters.
- Every section opens with a head: one 38px tab riding a full-width 1px brass rule, plus a right-aligned 12px note naming the clause range ("Art. 1 à Art. 4 — nos règles internes"); below 720px the row stays nowrap and the note drops to 10.5px, where it may wrap to two right-aligned lines with the rule staying clear beneath them.
- SOCIAL PROOF LAW: exactly ONE static client quote per page, opened by the 3px brass bar, attributed to a role and a sector rather than a portrait. No carousels, no logo walls.

## Motion identity — DOSSIER SLIDE
Gate everything on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Only gsap.set hides — no hidden state in CSS. With the CDN dead the page is a complete document.
- THE AXIS LAW: entrances travel on X only — paper slides in a drawer, content never rises from below. Left-column elements from x −26 to −36, right-rail from x +26 to +34. Below 1025px every positive ENTRANCE offset flips negative and scales to 0.62, so a narrow viewport can never be pushed sideways; the showpiece's own forward slide is exempt because it is scoped to ≥981px, where the right column still exists.
- Easing power2.inOut, 0.75–0.95s, stagger 0.05–0.10s: slow in, slow out, a drawer on runners. Deliberately NOT grille's expo.out snap against a visible column grid: cabinet is symmetric, unhurried, grid-free.
- The hero plays one timeline with −0.45s to −0.75s overlaps: eyebrow, letterhead, statement, drawer, lead, buttons, nameplate, clause (rule drawing scaleX 0→1 over 0.7s), meta, rail tabs at 0.06s stagger. Clause rows slide in and their em-dash rules draw left to right at 0.7s; numerals arrive with their row and never count up.
- HOVER: a tab is pulled UP out of the drawer, translateY(−3px) over 180ms — the only vertical motion in the world. Everything else changes colour, never position; focus gives the identical state. NOTHING LOOPS: no CTA pulse, no glow ramp, no breathing decor, no marquee.
- THE SCRUBBED SHOWPIECE — LE TIROIR, exactly one per page: the section pins for 3.4 viewport heights at scrub 0.7. Phase A (first ~22%): tabs fan out of a perfect stack, each travelling from x = −i × 26 to 0 at 0.05s stagger, and the first folder slides 34px forward. Phase B: at ~15.6% intervals the current folder returns to x 0 while the next slides to x 34 and takes the brass tab; the outgoing panel leaves on x −34, the incoming arrives from x +40, both 0.4–0.5s power2.inOut. A counter reads the index in display serif beside "SUR 05 — <la matière>" in brass small-caps. The pinned frame is min-height 100vh, padding-bottom clamp(2rem,7vh,5rem) so the composition sits above centre, clear of the header.
- MOBILE (≤980px): no pin. The drawer stays a compact index of five files, the panels follow in flow separated by 1px brass rules, each sliding in on x; tapping a file scrolls to it. The stacking CSS is scoped to (min-width: 981px) so a phone never receives it.
- REDUCED MOTION / NO JS: the drawer is composed OPEN — index left, all five panels legible right. A designed still, never a blank.

## Ban list (the global ban list applies in full; in addition)
1. PUPITRE's footnote system (superscript numerals with footnotes over a short rule), its thin-thick-thin Oxford double-rule frames, and its wax-seal / crest medallion — BY NAME. Cabinet has one rule weight and no seal.
2. ORFÈVRE's gold hairline SVG engravings that draw themselves on scroll, its filigree corner flourishes, its gold-leaf page-edge line — BY NAME. Cabinet's brass objects are FILLED and arrive by sliding; strokeDashoffset draw-on of metal is orfèvre's.
3. CAPITALE's navy-duotone photography plates, its giant serif pull-figure over a hairline base rule, its 01→05 index spine filling as sections pass — BY NAME. One proximity is real: cabinet's showpiece rail IS a 01→05 column advancing as the pin scrubs — defensible only as folder CARDS with tab geometry whose brass tab fills on the current file, never a hairline spine with a progress rule running down it. Figures obey a ceiling: never above clamp(2rem, 3.4vw, 2.9rem), never anchoring a section, always inside a clause row, a ledger row or a fact column.
4. VELIN's boxed drop cap with folio number, its italic accent word in the accent colour inside a roman headline, its double-filet rules — BY NAME.
5. DIWAN's arabesque frames, eight-point star and illuminated medallions; FOLIES' gold sunbursts, ziggurat frames and gem chevrons. Brass here is furniture, never ornament.
6. MATIÈRE's arch geometry and 4% full-page grain; CINÉTIQUE's telemetry voice (FILE 001, SYS.STATUS) and registration ticks; GRILLE's exposed column rules, red circle and expo.out snap; CLAIR's soft-shadow floating cards.
7. Photography of any kind, and the genre's clip-art: gavels, scales, columns, crests, handshakes, suited silhouettes.
8. Gradients anywhere — washes, metal sheens, "gold" fills. Brass is one flat hex. Also: glow, bloom, text-shadow, blur, backdrop-filter, glassmorphism.
9. Rules of any weight but 1px, apart from the single 3px considérant bar. Paired, doubled and dotted rules: banned.
10. Border-radius above 6px (the tab clip-path excepted) and the default card look — 8px radius plus soft shadow.
11. Overshoot, elastic, bounce and back easings; any looping animation — pulse, breathe, flicker, marquee, spin.
12. Y-axis entrances on content; fade-up-from-20px in any form.

## LES GESTES (the moves menu)
1. **LE TIROIR** — the pinned showpiece: five files left, one detail panel right; tabs fan out of a stack, then each file slides 34px forward as its panel changes on x.
2. **LA PLAQUE** — the hero built around the nameplate at architectural scale: a physical object, not a logo. Full column width, four screws reading clearly.
3. **LES ARTICLES** — content as Art. 1 → Art. n rows. For house rules, guarantees, methodology, mentions — anything a client would skim.
4. **LE PARAPHE** — the cream interlude: one full-bleed #F0EAD9 section, ink inverted, brass deepened to #7A6130. The page's exhale; at most twice.
5. **LE BARÈME** — the fee ledger: name, one honest note, the amount in display serif with a brass sans suffix, on 1px rules; below 720px the amount drops under the name. Publishing prices IS the differentiator.
6. **LA PORTE** — the roster as door plates: a brass plate per person (min-height 6.6rem, serif name, small-caps role) over a factual paragraph — bar year, specialities, languages. No portraits.
7. **LE CONSIDÉRANT** — the client quote at clamp(1.42rem,3.5vw,3.05rem) opened by the 3px brass bar, attribution on a rule beneath, a hairline figures column beside it.
8. **LA CHEMISE** — the contact form as an open folder: tab on the top edge, bottom-ruled fields, honest disclaimer, honest success state.
9. **LE RENVOI** — cross-reference links between clauses ("Voir aussi Art. 1"), brass with a hairline underline filling on hover. Two or three per page.
10. **LE SOMMAIRE COULISSANT** — a horizontal strip of large tabs (practice areas, cities, languages) riding a boundary rule, sliding in on x at 0.06s stagger. Best as the hero's closing edge.
11. **LE PIED DE DOSSIER** — the footer monument: the name at display scale over one brass rule, the practical grid, then the final numbered clause carrying the mentions.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**LE CABINET D'ALGER** (avocats généralistes). Hero: the fixed masthead played straight — statement and an Art. 1 teaser left, letterhead / drawer / nameplate down the right rail, closing on a rail of five practice-area tabs. Showpiece: LE TIROIR, files sliding forward in turn. Mood: sober, dense, checkable.

**NOTARIAT MERAD** (notaire, Constantine). Hero: the plate ALONE — one nameplate centred at 62% width on near-empty green, the statement set small BENEATH it, hierarchy inverted. Showpiece: L'ACTE — a deed assembling on scrub hairline by hairline, signature rules and date last. Vertical build, no fan. Mood: ceremonial.

**FIDUCIAIRE BOUKHARI** (expert-comptable, Oran). Hero: a split drawer — left third a recessed #101A14 column of six stacked tabs as an index, right two-thirds the statement opening onto Art. 1. Showpiece: LE BARÈME QUI SE REMPLIT — each ledger row's rule drawing left to right, the amount wiping in behind. Mood: transparent, numerate.

**CHAMBRE & ASSOCIÉS** (conseil aux entreprises, Alger). Hero: the tab rail IS the hero — a viewport-wide row of five 46px tabs, one filled brass and open, its content filling the field below. Showpiece: LA CHEMISE QUI S'OUVRE — one folder's cover slides left on scrub, the mandate list arriving item by item. Mood: decisive.

**CABINET SEDDIKI** (droit social, Annaba). Hero: the cream one — the page OPENS on the #F0EAD9 interlude in green ink, deep green arriving at section two; the nameplate a tall spine at the right edge. Showpiece: LE DOSSIER QUI S'ÉPAISSIT — sheets sliding in from the right, stacking at 6px offsets until the tab reads "clos". Mood: procedural.

**MAÎTRE HADDAD** (droit de la famille, Tlemcen). Hero: the clause AS the hero — no display headline; Art. 1 set at display scale, the plate shrunk to a top-left mark. Showpiece: LES ONGLETS QUI DÉFILENT — an index strip of nine questions travelling sideways on scrub while the answer panel crossfades, nothing pinned. Mood: human, unfrightening.

**ASSURANCES BELKACEM** (assurance, Sétif). Hero: SINGLE COLUMN, no rail — the guarantee table full-bleed, the statement set as its first row so type and data share one grid. Showpiece: LA COMPARAISON — two folders sliding apart symmetrically on scrub, the rows of two formules appearing as they part. Mood: practical, comparative.

**OFFICE DE TRADUCTION ASSERMENTÉE** (Alger). Hero: three brass nameplates (FR / AR / EN) stacked at 12px offsets like plates on a door, a medium statement beneath. Showpiece: LA COLONNE JUMELLE — parallel text where each right-column line slides in on x as its left counterpart brightens. Nothing pinned. Mood: exact, bilingual.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails. FIRST, TAB DISCIPLINE: one rectangular nav item, one pill, one arch, and the drawer metaphor collapses into a green template — every announcing element is tab-topped or it does not exist. SECOND, CLAUSE NUMBERING: unbroken from Art. 1 to the footer, carrying REAL commitments (a response delay, a fee cap, a right to the file); decorative article numbers over marketing copy are worse than none. THIRD, the BRASS RATION: active tab, primary button, plates, hairlines, Art. markers, figures — nowhere else. The moment brass becomes a background, the site becomes the cheap gold-and-black lawyer page we are replacing.

The cheap details cost almost nothing: four screw heads with rotated slots; the 1px inset highlight that makes flat colour read as card stock; the section note naming the clause range; the tab pulling up 3px on hover; a fee ledger publishing real DZD amounts; a form that says what it is NOT. When in doubt, remove a decoration and add a fact — this world's voltage is credibility.`,
};
