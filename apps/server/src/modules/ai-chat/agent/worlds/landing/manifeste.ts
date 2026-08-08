import type { DesignWorld } from "../types";

/**
 * MANIFESTE — the page that argues.
 * Family: monochrome-noir. Pure black/white typographic manifesto: words ARE
 * the layout at 15–25vw, whole sections flip between pure black and pure
 * white, thick underline slabs are the only decoration, and mid-page the
 * entire page inverts live on scrub (le retournement). Proven against the
 * VERBE. demo (copywriting studio, Paris); every value in the doc shipped
 * there. fusesWith rationale — affiche: the manifesto takes color for event
 * campaigns; fanzine: the protest pair — the manifesto goes underground.
 */
export const manifeste: DesignWorld = {
	avoidFor: [
		"kindergarten / crèche",
		"gelato / desserts",
		"guesthouse / riad",
		"pharmacy",
		"veterinary",
	],
	doc: `# DESIGN WORLD: MANIFESTE — the page that argues

## Philosophy
This page is a MANIFESTO PASTED TO A WALL, not a website — a printed tract blown up to the scale of architecture, read at the distance of a street. Words are not placed ON a layout; the words ARE the layout: each major section is anchored by a word at 15–25vw, and everything else — paragraphs, prices, meta lines, buttons — stands where that word tells it to, aligned to its edges like passers-by to a monument. Its first structural fact: exactly TWO colors exist, #FFFFFF and #000000; every grey on the page is one of the two at an opacity step, never a third hex. Its second structural fact: there is NO imagery — no photography, no illustration, no icons; type carries the entire visual budget (one rare monochrome texture exception, spec in Color physics). Its third structural fact: whole sections FLIP between pure white and pure black, and once per page the flip is performed LIVE as the scrubbed showpiece. The only decoration permitted anywhere is the thick underline slab — an 8–16px rule of currentColor. Radius 0, shadow 0, gradient 0, italic 0, rotation 0. The page does not decorate; it ARGUES: a thesis, an accusation, proofs, a verdict, a signature. Failure modes that are structurally impossible here: a colorful CTA, a pastel mood, a decorative blob, a stock-photo hero, timid type. Self-audit before shipping (count them): zero pixels that are not #FFF, #000 or an opacity step of them; at least one word ≥15vw in the first viewport and at least three sections anchored by a word ≥12vw; at least three ground flips down the page; zero border-radius, zero box-shadow, zero gradients page-wide; every decorative rule measures 8–16px and every functional rule 1–2px, nothing in between; not one italic glyph.

## The variation contract (why two MANIFESTE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Two colors only (#FFFFFF/#000000), greys only as opacity steps, at least three section flips per page.
- ONE type family per site from the register below; words-as-layout scale; the thick underline slab as the ONLY decoration.
- Radius 0 / shadow 0 / gradient 0 / italic 0 / rotation 0, page-wide, no exceptions.
- Hard-cut + word-mass-slide motion; a showpiece from the retournement family (the page inverts exactly once, live, mid-scroll).
- The argument structure: the page prosecutes ONE thesis, from constat to signature.
CLIENT-OWNED — where siblings diverge, decided per brief:
- The family WITHIN the register: Inter Tight (display 800–900) OR Familjen Grotesk (display 700) — one per site, never both.
- THE THESIS — the one-sentence argument the page prosecutes ("tout le monde dit la même chose", "la lumière n'a pas besoin de couleur", "un procès se gagne par écrit"). It chooses the power words, the section order, the flip choreography and the voice.
- The opening ground: white by default; a black opening is allowed if the closing rhythm inverts it back.
- The flip choreography: which sections are black, where the retournement lands (between 40% and 65% of scroll), whether the page closes on the ground it opened on.
- Case strategy: all-caps monument words versus sentence-case bold statements (most builds mix: caps for anchor words, sentence case for theses and proofs).
- The showpiece variant within the retournement family, and which 2–3 gestes are played.
A MANIFESTE page without its thesis is a failure: write the argument as ONE sentence first, then let it choose every word on the page.

## The vibe (voice)
Declarative French with a courtroom cadence. Short sentences that land like verdicts; the period is the house glyph — the wordmark itself ends with one (VERBE., NOIR., DROIT.). The page names a common enemy (jargon, sameness, noise, decoration) and presents the client as the resolution. Register lines:
- "Tout le monde parle. Personne ne dit rien."
- "Écrire court coûte plus cher. Et rapporte plus."
- "Pas de storytelling. Une histoire vraie suffit."
Numbers are stated flat and honest (43 marques, 24 h, 2 400 €). No exclamation marks ever — SIZE does the shouting, punctuation stays calm. No superlatives, no "passion", no "excellence", no fake urgency. The reader is "vous", addressed as an adult about to make a decision.

## Visual signatures
- WORDS AS LAYOUT (owned tic): each major section is anchored by a word or short line at 15–25vw (≤8 glyphs at the top of the range), weight 800–900, line-height 0.82–0.90, tracking −0.02em to −0.045em. Multi-word statement lines run 6–13vw. The anchor word IS the structure: everything else aligns to its left edge, right edge or baseline — nothing floats free. A MANIFESTE word stops where its size says, or crops at the viewport edge; it is never optically fitted to exactly 100vw (that fit is AFFICHE's headline).
- BLACK/WHITE INVERSION FLIPS (owned tic): sections are pure #FFFFFF or pure #000000, cut hard at the boundary — no transition zones, no gradients, no grey buffer sections. Minimum three flips per page; the scrubbed retournement is the ceremonial one.
- THICK UNDERLINE SLABS (owned tic): 8–16px solid rules of currentColor — under a headline's operative word (full word width, offset 0.03–0.08em below the baseline), as a standalone 48–72px × 10–12px bar anchoring section labels, and as the strike-through of le barré. This is the ONLY decoration on the page.
- Two rule registers, nothing between: functional rules (row separators, table frames, form underlines) at 1–2px; decorative slabs at 8–16px. A 4px rule is a failure of nerve — pick a register.
- Opacity steps instead of grey hexes: secondary prose at 55–70% of currentColor; meta and captions at 45–55%; the filigrane ghost word at 5–8%; quiet functional rules at 12–25%. Never a grey hex, never a tinted grey.
- Alignment is axis-hard: every line is flush left or flush right, and alternating the axis line-by-line is a core rhythm. Centered composition is reserved for verdict moments (one or two per page). Nothing rotates, ever.
- Numbered furniture: theses, sections and proofs carry tabular numerals (01, 02, 03) at weight 800 in the same family, usually at 45–60% opacity beside full-strength text.

## Color physics
- WHITE sections: ground #FFFFFF, ink #000000. BLACK sections: ground #000000, ink #FFFFFF. No off-white, no near-black — #111111 or #FAFAF8 are failures, not nuances.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · INK→--primary · GROUND→--primary-foreground · the BLACK ground→--secondary · INK→--accent · ink at 55%→--muted · ink at 18%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every grey or opacity step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Greys exist ONLY as rgba() opacity steps of the section's ink: 0.55–0.70 for secondary prose, 0.45–0.55 for meta, 0.12–0.25 for quiet rules, 0.05–0.08 for the filigrane. Anti-aliasing is the only other grey permitted on the page.
- Ink coverage IS the palette: the page alternates ink-heavy viewports (a black section, a giant word) with air-heavy viewports (white ground, one statement, vast margins). This alternation replaces color contrast entirely.
- The accent budget is ZERO. No accent color, no hover tint, no link color — emphasis is inversion (ground and ink trade places), a slab, or scale.
- TEXTURE EXCEPTION: at most ONE full-black section may carry a monochrome noise texture (inline SVG feTurbulence at 4–6% opacity) — never page-wide (full-page grain is MATIÈRE's plaster), never photocopy/toner artifacts (that grunge is FANZINE's). Most builds should skip it; purity is cheaper and stronger.
- Gradients: zero. If a gradient exists anywhere — including single-color "gradient" hacks — the build has failed.

## Typography system
- ONE family per site, serving both display and body: Inter Tight (display 800–900, body 400–500) OR Familjen Grotesk (display 700, body 400–500). Never two families, never Inter/Roboto/Open Sans (global ban), never a serif, never a mono glyph — not even for prices.
- Scale registers: anchor words 15–25vw; statement lines clamp(2.6rem, 8vw, 8.5rem); thesis and offer rows clamp(1.55rem, 3.4vw, 3.2rem); body 1.05–1.25rem at line-height 1.5–1.6, measure ≤34em; labels 0.78–0.9rem, weight 800, uppercase, tracking +0.02 to +0.06em; meta 0.8–0.9rem at 45–70% opacity.
- Giant lines: line-height 0.82–0.90 for single anchor words; STACKED accusation lines in accented French caps take 0.92–0.95 so Ê/É accents never collide with the line above. Tracking −0.02 to −0.045em; font-variant-numeric: tabular-nums on every numeral on the page.
- Mobile law (≤820px): re-clamp the giants UPWARD — anchor words hold 11–17vw of the small viewport (the shipped hero runs 16.5vw/11.2vw, the showpiece mass 11vw at 390). A mobile MANIFESTE must shout exactly as loud as the desktop one.
- Labels are BOLD and anchored — a 10–12px slab bar beside or above them, or a 2px rule. Never letter-spaced whisper caps floating on bare ground (that whisper is ÉCRIN's; MANIFESTE shouts).
- Italic: never, not one glyph. Emphasis is weight, scale, a slab, or inversion.
- Body copy is flush left, ragged right — never centered, never justified (justified columns are GAZETTE's).
- ARABIC PAIRING: an Arabic build sets display AND body in IBM Plex Sans Arabic (display 700) or Cairo (display 800–900) — same two-color law, same slab law (mirrored: RTL flips the alignment axes and the slab's draw origin), same scale registers.

## Signature art / components (type is the imagery)
There is no drawn art and no photography: the composition of type IS the imagery system. The scenes this world paints are typographic — a duel of two words across a black/white seam, a ghost word at 6% behind a paragraph, a verdict word alone in a black viewport, a crossed-out phrase corrected at four times its size. Every scene is real text in the DOM (screen readers read the argument; nothing meaningful is aria-hidden).
- Buttons: rectangular slabs whose corners consume min(var(--radius), 0px) — radius 0, this world's corners stay cut — filled (ink ground, inverse text) or 2px-outlined; padding 1–1.2em × 1.8–2.2em; weight 800; uppercase or bold sentence case. Hover and :focus-visible: full inversion (background and color trade places), instantaneous or ≤120ms — never a soft fade, never a lift, never a shadow.
- Links: 2px underline in currentColor; hover/focus inverts the link (ink ground, inverse text) with the same hardness. Touch and keyboard receive identical states.
- Rows, not cards: offers, theses and proofs are full-width rows between 2px rules. If a box is unavoidable, it is a 2px border, radius 0, no fill — or a full inversion fill.
- Forms: fields are transparent with a 2px bottom rule in currentColor; labels above, weight 800, uppercase, 0.8rem; keyboard focus thickens the rule to 5px (a state, not decoration — the one legal mid-weight). Phone-first: the tel field (type=tel) sits before email and is the only required contact channel. Select is flat (appearance:none, a real ▾ glyph, radius 0). Submit is a filled slab button. The success state is an honest typographic verdict ("C'est signé.") plus the real next step ("On vous rappelle sous 24 h ouvrées."), in a role="status" region. On valid submit, dispatch the wandit:lead CustomEvent on document with the visitor's fields FLAT in detail (name, phone, email, project, message). One decoy input with attribute data-wandit-hp sits off-canvas (position:absolute; left:-4000px; tabindex="-1"; aria-hidden="true") and is never read, validated or styled by the page's own script.
- Favicon: inline SVG data URI — a black square, the brand's initial plus a period in white at weight 900.

## Page chassis
- Containers: prose measures cap at 34em; grids cap 1280–1400px; anchor words may run to 92–96vw; section padding clamp(5rem, 12vh, 9rem) vertical, clamp(1.25rem, 4.5vw, 4.5rem) horizontal.
- Header: absolute over the opening section, never fixed, no blur bar, no shadow — wordmark (weight 800, ending in its period) left, one real tel link right. This page's chrome is nothing; the words are the chrome.
- FIXED OPENING — LE CRI: the loudest viewport of the page. The brand's name or verb stacked in 1–3 lines, the operative line at 15–25vw carrying the page's first slab; a lede of ≤2 sentences at ≤34em; one slab CTA pointing to the closing form (a real in-page anchor); the fold closed by a meta line (city — métier — one honest number) above or below a 2px rule. Ground white by default.
- FIXED CLOSING — LA SIGNATURE: contact as the act of signing the manifesto. A giant imperative (SIGNEZ., ÉCRIVEZ., PARLONS. — 14–20vw) beside the form spec'd above; then the footer: a monument wordmark cropped by the page's bottom edge (18–25vw with 20–40% of its height cut off) under a one-line colophon of real links (tel, mailto, address). The footer's ground is the OPPOSITE of the signature section's — the page's last flip.
- FREE MIDDLE — compose 3–5 from this vocabulary, no two adjacent alike: le constat (accusation lines alternating flush-left/flush-right) · les thèses (numbered manifesto rows between 2px rules) · le retournement (the showpiece — mandatory, lands at 40–65% of scroll) · l'offre en rangées (service rows that fully invert on hover/focus, price flush right, in the brief's currency) · le barré (before/after proofs with the strike slab) · le verdict (a full-black 100vh viewport, one white word, one line at 60%).

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
Registry personality: HARD CUTS + WORD-MASS SLIDES. Nothing eases in politely; things either SLIDE with authority or simply APPEAR.
- Gate every animation on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Every hidden state is set with gsap.set — NEVER in CSS. With JS dead, the page is a complete, fully-composed static manifesto; the retournement rests in its concluded, inverted state.
- Easing register: expo.out for word-mass slides; hard cuts as timeline .set calls (or 0.01s tweens); power4.inOut ONLY inside the retournement's flip beat. NEVER back/elastic/bounce, no overshoot, nothing longer than 0.9s.
- Durations 0.35–0.7s; staggers 60–110ms. Word-lines slide on x from ±60–90px, the direction matching each line's alignment axis; slabs scale from scaleX:0 with transform-origin on the text's axis over 0.4–0.55s; numerals, meta and small prose hard-cut in.
- Overflow discipline: every section carries overflow:clip (plus overflow-x:clip on html/body) so pre-entrance x-offsets NEVER create horizontal scroll at 390/768/1440 — fix the offsets, keep the clip as law.
- THE SHOWPIECE — LE RETOURNEMENT (one per page, scrubbed, pinned): a statement builds word-mass by word-mass in hard cuts on scrub (pin 100vh, end +=180–240%), then at 50–60% of the timeline the ENTIRE section flips black↔white in ONE beat — an instantaneous set of ground and ink, no crossfade — and the argument concludes inverted. Every section after it continues on the flipped rhythm. Variants stay in the family: the flip may be one hard set, a full-bleed panel that snaps in, or line-by-line inversions before the total flip — but the page MUST invert exactly once, live, mid-scroll.
- Hover: instantaneous inversion swaps (≤120ms); rows invert whole; buttons trade ground and ink; :focus-visible and touch get identical states. Nothing lifts, glows, blurs or casts.
- Reduced motion: no motion at all — the composed page IS the design; the showpiece rests at its conclusion.

## Ban list (in addition to the global list)
- Any third color, tinted grey, off-white or near-black hex — the two-hex law admits no nuance.
- Outline/stroked display type, stroked ghost numerals, mix-blend difference chrome, machine-telemetry captions (SYS.STATUS, FILE 001) — all CINÉTIQUE's language.
- Photography of any kind, and the single crimson accent word over B/W — SILHOUETTE's.
- Colored poster grounds rotating per section, the optically fit-to-100vw headline, and giant punctuation glyphs as section art — AFFICHE's language.
- The exposed page-wide grid with visible column rules, and the one red geometric circle — GRILLE's.
- Floating letter-spaced micro-caps whisper labels, plumb-line hairline ceremonies, roman-numeral serif markers — ÉCRIN's whisper; MANIFESTE shouts.
- One word repeated in escalating rows (the chant stack) — MAILLOT's; a MANIFESTE escalier builds a SENTENCE, a different word per line.
- Broadsheet justified columns, halftone-dot imagery, masthead furniture — GAZETTE's.
- Torn edges, tape strips, misregistered print layers, toner grunge — FANZINE's.
- border-radius above 0, box-shadow anywhere, any gradient, any italic glyph, any rotated text or element.
- A second type family; serif or mono glyphs anywhere, including prices and numerals.
- Grey buffer sections between black and white; sections in any ground that is not one of the two hexes.
- Soft fades as the only entrance; anything that bounces, overshoots, floats or breathes.

## LES GESTES (moves menu)
1. LE CRI — the opening stack: 1–3 lines, the operative word at 15–25vw carrying the page's first slab; the lede and CTA hang from the word's left edge; a meta rule closes the fold. Entrance: lines slide from −x, the slab draws, meta hard-cuts.
2. LE CONSTAT — the accusation: 3–4 lines at 8–14vw alternating flush-left/flush-right down the viewport, one 34em paragraph tucked against the final line's axis. Entrance: alternating ±x slides, one direction per line.
3. LES THÈSES — the numbered argument: 4–6 rows between 2px rules; tabular 01–05 at 45–60% opacity beside sentence-case bold theses at clamp(1.55rem, 3.4vw, 3.2rem); ONE slabbed word per thesis; alternate row indents so the column never reads as a plain list.
4. LE RETOURNEMENT — the showpiece flip (full spec in Motion identity): word-mass builds in hard cuts, the page inverts in one beat, the argument concludes inverted. The page's only scrub.
5. LE BARRÉ — rhetoric by strikethrough: the weak phrase at 45–55% opacity receives a 10–12px slab drawn through its middle (scaleX on entrance), and the correction lands beside or beneath it at 3–4× the size, weight 800. The struck phrase must hold ONE line at every width (shorten the quote, never split the slab across wrapped lines).
6. LE VERDICT — a full-black 100vh interlude: one white word at 20–25vw dead center, one line at 60% opacity beneath. Hard-cut entrance, no scrub. The page's held breath.
7. LE DUEL — the viewport splits vertically, one half white and one half black, a word on each side facing the seam; on mobile the halves stack into two bands. Hovering or focusing either half inverts it.
8. LE FILIGRANE — one giant FILLED word at 5–8% opacity behind a prose section, cropped by the section's edges; the content aligns into its silhouette. Never stroked (stroke is CINÉTIQUE's), never repeated as a pattern.
9. LE CONTREPOIDS — asymmetric balance: a 15–20vw word flush right against a 34em paragraph flush left; a slab bridges the gutter beneath both. The scale gap IS the composition.
10. L'ESCALIER — a sentence broken word-per-line, each line stepping 4→8→12→18vw (up or down), a DIFFERENT word per line, the largest word slabbed. Entrance: steps hard-cut in sequence, the largest line slides.
11. LA RANGÉE QUI S'INVERSE — offer or portfolio rows that invert completely on hover and focus (ground and ink trade in ≤120ms), price or year flush right, 2px rules between rows.
12. LA SIGNATURE — the closing ritual: the giant imperative beside the form, submitting as "signing", the success verdict, then the cropped monument wordmark as the page's final flip.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
1. VERBE. — copywriting studio, Paris (the shipped proof). Thesis: "tout le monde dit la même chose." Hero: le cri — LES MOTS / TRAVAILLENT. stacked at 15.5vw and 10.6vw, slab under TRAVAILLENT. Middle: black constat with alternating-axis lines → white thèses (five numbered rows) → le retournement (VOTRE MARQUE PARLE TROP. builds, flips, ET NE DIT RIEN. concludes with RIEN. at 20vw) → black offer rows inverting on hover with EUR prices → white barré proofs (jargon corrected in plain French). Mood: courtroom with dry wit.
2. NOIR. — photographer's portfolio without photographs on the front page. Thesis: "la lumière n'a pas besoin de couleur." Hero: le duel — LUMIÈRE on the white half, OMBRE on the black, facing the seam. Series index as inverting rows with years flush right; one filigrane section for the artist statement. Showpiece: a retournement built line-by-line — three statements invert individually before the total flip lands on the word NOIR. Mood: gallery silence between shouts.
3. PLAIDOYER — law firm. Thesis: "un procès se gagne par écrit." Hero: le contrepoids — a 34em paragraph of measured counsel flush left against DROIT. at 18vw flush right. Middle: thèses as numbered articles; le barré crossing out legalese and correcting it in plain law; a verdict viewport (GAGNÉ., then "127 dossiers. 9 ans. Une méthode."). Showpiece: a retournement that builds four words slowly and flips on the word VERDICT. Mood: severe, patient, expensive.
4. SOMMET — conference on concise communication. Thesis: "les idées courtes tiennent debout." Hero: l'escalier — the edition theme climbing 4→18vw to the date, largest word slabbed. Program as thèses rows with tabular hours; speakers as inverting rows. Showpiece: a retournement whose flip stamps the keynote's name white-on-black at the beat. Mood: civic urgency.
5. TEMPO — band. Thesis: "le silence entre deux notes." Hero: a black opening verdict — the band's name alone at 22vw white on black, tour meta at the fold (the closing signature is white to return the balance). Dates as inverting rows (ville — salle — date flush right). Showpiece: a retournement that builds a lyric word per beat and drops the flip on the title word. Mood: percussion set in type.
6. SANS DÉTOUR — business consultant. Thesis: "un bon non vaut mieux qu'un mauvais oui." Hero: le filigrane — NON. at 6% opacity behind the opening statement "On vous dira non. Souvent." Middle: constat; offer rows with the day rate flush right; barré of consulting clichés. Showpiece: a retournement whose flip is a full-bleed black panel snapping up at the word ASSEZ. Mood: blunt, likable, hired.
7. MANCHETTE — journalist's portfolio. Thesis: "un fait vérifié vaut mille adjectifs." Hero: la rangée qui s'inverse played as the opening — the published work IS the first viewport: wordmark and a dateline meta line above a 2px rule, then four inverting rows (titre at 6–9vw — média — année flush right), the topmost row slabbed as the manchette; no self-presentation until the constat below. The writer's rules as thèses. Showpiece: a retournement building a famous opening line word-mass by word-mass, flipping on its final period. Mood: newsroom sobriety with zero nostalgia — no columns, no paper (that is GAZETTE's).
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: SCALE (if the anchor word could fit twice across the viewport, it is body text wearing a costume — return it to the 15–25vw register), PURITY (one tinted grey, one 6px radius, one soft shadow, and the manifesto collapses into a template with big fonts), and THE FLIP (the retournement must land mid-scroll, live — a page that merely alternates static black and white sections has skipped its own ceremony). The cheap details that separate it from a generated page: the period after the wordmark, tabular numerals in the theses, opacity-step greys instead of grey hexes, the 8–16px/1–2px double rule law with nothing between, alternating alignment axes, and hover states that INVERT instead of tinting. When in doubt, delete the element — this world gets stronger every time something is removed.`,
	energy: "loud",
	family: "monochrome-noir",
	fusesWith: ["affiche", "fanzine"],
	id: "manifeste",
	industries: [
		"tattoo & piercing",
		"marketing / branding agency",
		"design studio",
		"freelancer portfolio",
		"writer / journalist",
		"architecture portfolio",
		"music / band",
		"lawyer / law firm",
		"business consultant",
		"conference / summit",
		"videographer / production",
		"photographer",
	],
	kind: "website",
	mood: ["loud", "typographic", "radical", "monochrome", "declarative"],
	name: "Manifeste",
	preview: {
		accent: "#000000",
		fontFamily: "Inter Tight",
		ground: "#FFFFFF",
		ink: "#000000",
		sampleWord: "NOIR.",
	},
	priceFeel: "premium",
	tagline:
		"Le manifeste typographique : noir, blanc, et des mots qui frappent.",
};
