import type { DesignWorld } from "../types";

/**
 * HYPERTEXTE — the 1996 document, worn as high style.
 * White ground, system fonts ONLY, blue underlined links with a real
 * visited-purple, visible-border tables as layout, a visitor counter and a
 * "last updated" line. Deliberate anti-design executed with total precision.
 * Proven in worlds/hypertexte/demo (P. OKAFOR, illustrator, London).
 * fusesWith rationale:
 * - phosphore: document meets console — early-computing brands that want
 *   both the page and the terminal.
 * - fanzine: the DIY web zine — underground portfolios that photocopy
 *   their homepage.
 */
export const hypertexte: DesignWorld = {
	avoidFor: [
		"medical (all)",
		"restaurant (all)",
		"travel (all)",
		"beauty (all)",
		"real-estate (all)",
	],
	doc: `# DESIGN WORLD: HYPERTEXTE — the 1996 document, worn as high style

## Philosophy
This page is a DOCUMENT, not a website — an index.html hand-written in 1996 and maintained ever since by someone with perfect taste and no patience for decoration. First structural fact: ZERO WEBFONTS. The system stack sets everything — "Times New Roman"/Georgia for prose and display, "Courier New" for metadata and captions, Arial for table chrome — and a single request to a font CDN is world-death, not a style slip. Second: the chrome palette is FOUR fixed hexes plus browser greys — #FFFFFF ground, #000000 ink, #0000EE unvisited links, #551A8B visited links (with #FF0000 permitted on :active only). ALL chromatic color lives INSIDE the image frames; the page around the work is achromatic plus the link triad. Third: layout is VISIBLE-BORDER TABLES and horizontal rules — no cards, no shadows, border-radius 0 on every element, greys straight from a 1996 browser (#808080 borders, #F0F0F0 wells). Fourth: motion is NONE-BY-DEFAULT — things appear, they never glide; the one animation this world owns is a page LOADING, remembered from a 28.8k modem. The irony only works at 100% conviction: alignment exact, byte counts arithmetically plausible, every browser default executed as a deliberate choice. A sloppy HYPERTEXTE page reads as a broken site; a precise one reads as the most confident page on the internet. This is a portfolio-culture world — the work inside the naked frames carries all the beauty; the page is the shelf, and the shelf is proud of being a shelf. Structurally impossible failure modes: the gradient hero, the webfont pairing, the rounded card grid, the smooth parallax, the stock-photo header.
Self-audit before shipping: (1) network tab shows zero font requests; (2) chrome hue census = white + black + two greys + the link triad, nothing else — and :visited actually renders #551A8B; (3) grep for border-radius and box-shadow returns 0 hits; (4) every content image carries a filename caption with a byte count; (5) every animation ease is "none" or steps() — no power, sine, expo or back anywhere in the file; (6) one h1, and the index links genuinely jump to anchors.

## The variation contract (why two HYPERTEXTE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- System stack only; the four-hex chrome + browser greys; color quarantined inside image frames.
- Blue underlined links, working visited-purple, red :active; underline and bold are the only emphasis mechanisms (italic reserved for titles of works).
- Visible-border tables as layout; hr as the section rhythm; every corner consumes min(var(--radius), 0px) — a document has square corners; box-shadow none; letter-spacing 0 everywhere.
- Web-1.0 chrome furniture: the "last updated" line, the visitor counter, back-to-top arrows, the status bar register.
- Naked image frames with filename captions; none-by-default motion with the single loading showpiece; dual visibility (JS dead = the complete document).
CLIENT-OWNED — where the siblings diverge, decided per brief:
- THE DOCUMENT PERSONA: what this file IS — a personal index.html, a catalogue raisonné, an FTP mirror, a README, a gig archive. The persona chooses the furniture, the section order and the voice.
- The text face register: "Times New Roman" (drier, more 1996) or Georgia (rounder, more magazine) — one per site, never both for prose.
- The ARTWORK PALETTE inside the frames — the only place color exists, so it defines the site's temperature; 4–6 flat colors shared across the plates.
- Density register: compact directory (body 16–17px, cell padding 8–10px, sections at the bottom of the rhythm clamp) or airy monograph (body 18–19px, cell padding 12–16px, top of the clamp).
- Table border register: 1px solid #808080 (browser default) or 2px solid #000000 (hand-ruled) — one per site.
- The counter's number, the update dates, the 88×31 badge texts, which section gets the Courier pre treatment, and the loading showpiece's subject.
A HYPERTEXTE page with no document persona is a failure: name WHAT DOCUMENT this is FIRST, then let it write the page.

## The vibe (voice)
Deadpan, literal, first person, in the demo's language. The register of someone excellent who refuses to advertise: facts, dates, byte counts, prices with no softening. Dry humor lands once or twice per page, always in a subordinate clause, never with an exclamation mark. Superlatives are banned; specificity does their job. Example lines:
- "P. Okafor draws pictures for magazines, publishers and, once, the side of a bus."
- "This page is 412K and loads fine on anything."
- "Rates exclude VAT. Rush jobs +50%, cheerfully."

## Visual signatures
- DEFAULT-WEB FURNITURE (owned tic). Prose in the site's serif at 16–19px / line-height 1.55–1.65, measure 60–75ch, ragged right, letter-spacing 0. Links are #0000EE with the browser's own underline (thickness 1px, offset default), :visited #551A8B — a real feature the visitor discovers, not decoration — and :active #FF0000 for one authentic frame. Hover and :focus-visible flip to the selection state: background #0000EE, text #FFFFFF, instantly, transition: none.
- BORDERED TABLES AS LAYOUT (owned tic). border-collapse: collapse; cells ruled in the site's border register (1px #808080 or 2px #000); th in Arial bold 12–13px on a #F0F0F0 well, typed in caps in the source (never text-transform); td padding 8–16px per density register; optional #F8F8F8 zebra. Tables ARE the grid system: galleries, indexes, price lists and even the hero may be table cells with visible rules.
- WEB-1.0 CHROME (owned tic). The "last updated" line in "Courier New" 12–13px under the masthead, with a real weekday and a time; a visitor counter of individually bordered digit cells (black wells, white Courier digits, a plausible odometer number); back-to-top links typed as "Back to top ↑"; a fixed status bar (24–32px, #F0F0F0, 1px #808080 top rule, Courier 12px, with a small inset progress well) that reads "Document: Done".
- HR AS RHYTHM. Two rules only: the standard rule (border-top: 1px solid #808080) between subsections, and the heavy rule (border-top: 4px double #000000) before each major section. The hr system replaces all section-divider decoration.
- NAKED IMAGE FRAMES (owned tic). Every content image sits in border: 1px solid #000 (or the site's 2px register), background #FFFFFF, padding 0, radius 0, shadow none; beneath it a "Courier New" 11–12px caption in the filename register: "market_11.png — 61,338 bytes — 1200×900 — £120". Bracketed Courier tags [ NEW ] and [ UPDATED 07/26 ] in #0000EE mark fresh rows and plates.
- SCALE DISCIPLINE. The h1 is Times/Georgia bold at clamp(2.4rem, 5vw, 3.8rem); section titles clamp(1.35rem, 2.4vw, 1.9rem). The drama comes from document conviction and the work in the frames, never from viewport-scale type — that is MANIFESTE's language.
- WIN95 BEVELS. Buttons and the counter well use two-tone hard bevels (border: 2px solid; border-color: #FFF #808080 #808080 #FFF; background #F0F0F0; Arial 13px), inverted to inset on :active. Form fields invert the bevel (inset). These are the only "3D" pixels on the page.

## Color physics
- GROUND: #FFFFFF only. Never off-white, never cream, never a tinted paper — warmth belongs to other worlds.
- INK: #000000 for prose and rules; #404040 permitted for secondary Courier metadata.
- BROWSER GREYS (the full chrome allowance): #808080 borders and standard rules, #C0C0C0 bevel mids, #F0F0F0 wells and th grounds, #F8F8F8 zebra. Nothing between these values.
- THE LINK TRIAD: #0000EE unvisited / #551A8B visited / #FF0000 active. Blue means clickable — the single sanctioned non-link blue is the bracketed Courier tag register ([ NEW ], [ UPDATED 07/26 ]); everything else in #0000EE must be a working link. Purple is earned by the visitor, never pre-painted. Red exists only during :active.
- COLOR QUARANTINE: all chromatic color lives inside image frames. The plates share one register of 4–6 flat colors per site (a warm-orange/deep-blue/olive/mustard/brick register is one shipped instantiation); each plate uses 3–6 of them, flat, with zero gradients.
- Gradients do not exist anywhere on the page — not in chrome, not in plates, not in hovers.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · link blue→--primary · GROUND→--primary-foreground · well grey→--secondary · visited purple→--accent · ink at 75%→--muted · ink at 50%→--border · zero→--radius · TEXT + DISPLAY→--font-heading · TEXT + DISPLAY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every browser grey, bevel or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- TEXT + DISPLAY: "Times New Roman", Times, serif — or Georgia, "Times New Roman", serif — one register per site, weights 400/700 only. Italic is reserved for titles of works and publications, cited like a bibliography; never for emphasis.
- METADATA: "Courier New", Courier, monospace — captions, the last-updated line, counters, status bars, byte counts, pre blocks. 11–13px, never sets prose paragraphs.
- TABLE CHROME: Arial, Helvetica, sans-serif — th cells, buttons, form labels. 12–14px bold. Arial never sets prose or headlines.
- Body 16–19px per density register, line-height 1.55–1.65; h1 clamp(2.4rem, 5vw, 3.8rem) bold, line-height 1.05–1.15; section titles clamp(1.35rem, 2.4vw, 1.9rem) bold.
- letter-spacing: 0 on every element — tracking is design, and this world refuses design. Caps are typed in the source where wanted (th, tags), never synthesized with text-transform.
- Arabic pairing rule: an Arabic HYPERTEXTE page keeps the zero-webfont law — prose falls to the system's default Arabic serif via the generic serif keyword; metadata stays "Courier New" for latin digits and filenames; no font CDN even then.

## Signature art / components
- THE PLATES (imagery system): the client's work, drawn as inline SVG in a flat paper-cut register — 3–6 flat colors from the site's artwork register per plate, large simple shapes, no outlines heavier than needed, no gradients, no filters. Perspective flat or gently layered; small black silhouette details (birds, figures, cranes) carry the wit. Each plate reads as a real artwork someone would buy, because inside this austere document the plates ARE the entire visual budget. Every plate carries role="img" and a real aria-label in the page's language.
- FRAMES: naked, per the owned tic — 1px/2px black rule, white ground, Courier filename caption below with byte count, dimensions and price or NFS.
- BUTTONS: Win95 bevels as specified above. Text like "Send", "Enlarge", "Sign" — one verb, no arrows drawn, no icons anywhere on the page (typed characters ↑ → · are the only glyph ornament).
- FORMS: labels in Arial bold 12px above fields; fields with inset bevels (border: 2px solid; border-color #808080 #C0C0C0 #C0C0C0 #808080 — the light edge is #C0C0C0, not #FFF, so the field still reads on the white ground), white field ground, serif 16px input text; phone-first inputs (type="tel" early in the order); a select for structured choices. On valid submit dispatch the "wandit:lead" CustomEvent on document with the visitor's fields flat in detail, plus one off-canvas decoy input with the data-wandit-hp attribute that the page's own script never reads or writes. The success state replaces the form with a plain serif paragraph and a standard hr — a sentence a person would actually write, with a timestamp in Courier.
- THE COUNTER: 6 digits in individual black wells (1px #808080 outer bevel), white Courier bold digits, caption "You are visitor Nº …". On load the last digit may increment once, as a single instant swap.
- 88×31 BADGES: the footer strip of drawn 88×31px bordered badges (1px #000, white or black grounds, Courier/Arial 9–10px text, at most one badge using #0000EE) — "BEST VIEWED WITH EYES", "HAND-WRITTEN HTML" register. Drawn as SVG/CSS, aria-hidden when decorative.
- Favicon: inline SVG data URI — white square, 1px black border, a blue underlined letter.

## Page chassis
- The document column: max-width 920–1080px, left margin ≥ 24px at 390 / auto-centered above 768. Tables and the showpiece may stretch to the full column; nothing bleeds off the page — a document has margins.
- Vertical rhythm: clamp(3rem, 7vh, 5.5rem) between major sections, each boundary marked by the heavy hr; subsections separated by the standard hr at clamp(1.5rem, 3vh, 2.5rem).
- FIXED OPENING — the masthead: h1 name, a one-line factual description, the Courier last-updated line, the counter, and the INDEX — a numbered table of contents of blue anchor links that genuinely jump. Composition of these parts is free (see gestes); their presence is not.
- FIXED CLOSING — the correspondence section: the form (guestbook or "write to me" register) plus plain-text contact details, then the footer: heavy hr, the 88×31 strip, a copyright line spanning the site's whole life ("© 1996–2026"), "Back to top ↑", and the last-updated line repeated.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: the index-of-works table · the loading showpiece · a contact-sheet table of framed plates with mixed colspans · biography prose with press quotes between standard hrs · a rates/price table with real currency · a Courier pre directory listing or changelog.
- The status bar is chrome, not a section: fixed bottom, present on every viewport, "Document: Done" after load.

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs; gate on gsap && ScrollTrigger && !prefers-reduced-motion)
NONE-BY-DEFAULT is the identity: nothing eases, nothing drifts, nothing fades — allowed eases are "none" and steps() ONLY, and opacity is always 0 or 1. Hidden states are set exclusively by gsap.set; with JS dead the document is complete and fully readable.
- ENTRANCES: elements POP — autoAlpha 0→1 with duration ≤0.02s, staggered 60–120ms in document order, so each section renders the way a slow connection rendered HTML: heading, then rule, then rows. Table rows appear row by row at 50–90ms. No movement on any axis, ever.
- PAGE LOAD: the status bar plays the arrival — "Looking up host…" → "Connecting…" → "Transferring data…" → "Document: Done" over 1.2–1.8s while a small inset progress well fills in 6–10 discrete chunks (steps()). The masthead pops in document order during this. The counter's last digit swaps once at the end.
- THE SHOWPIECE — "le chargement" (the one permitted scrub): one large plate LOADS as you scroll, pinned on desktop. Choreography quantized to 20–32 steps (snap the scrub progress): a coarse greyscale block-preview arrives in interlaced bands, then flat color replaces it strip by strip, then the detail layer pops in groups; beneath, a Courier status line counts real-looking bytes ("estuary_04.png — 23,412 of 96,204 bytes (24%) — 3.2K/s") and ends "Done." with the caption popping in. Mobile: un-pinned, the same stepped timeline plays once on enter over 2.5–3.5s.
- HOVERS: instant state swaps (transition: none) — the link selection-flip, the button bevel inversion. Keyboard and touch get identical states via :focus-visible and :active.
- REDUCED MOTION: the complete document, showpiece at its final frame with "Done." printed, status bar reading "Document: Done". No stills missing, nothing blank.

## Hypertexte ban list (in addition to the global one)
- Webfonts of any kind — one fonts.googleapis or fontshare request is failure, not a variation.
- Prompt-line furniture ($ > ~), typed-text steps() character reveals, blinking block cursors, ASCII box-drawing frames, CRT scanlines — that is PHOSPHORE's language; this world is a DOCUMENT, not a console.
- Viewport-scale words-as-layout, black/white section inversions, thick underline slabs — MANIFESTE's language.
- Justified multi-column newsprint, halftone-dot imagery, masthead datelines and jump lines — GAZETTE's language.
- Hard offset shadows, 3–4px solid borders, marker highlights, rotated price-chips — BLOC's language; hypertexte borders are 1–2px and its bevels are grey.
- mix-blend-mode chrome, outline/stroked type, marquees, glyph scramble, sticky card-decks, telemetry voice — CINÉTIQUE's language.
- border-radius above 0; box-shadow anywhere; backdrop-filter; CSS gradients anywhere including plates.
- Any ease other than "none"/steps(); tweened movement on x/y/scale/rotation; opacity values between 0 and 1; smooth-scroll.
- Off-white or tinted grounds; any chromatic chrome beyond the link triad; blue on non-interactive elements.
- letter-spacing or text-transform anywhere; italic outside titles of works.
- Fake brokenness — missing-image icons, 404 pastiche, "under construction" GIF clichés: the document always reads as loaded and working.
- Skeleton shimmer loaders or spinners as loading irony — loading here is BANDS and BYTES, never a spinner.
- Icons, emoji, drawn pictograms in the chrome; ornament is typed characters only.

## LES GESTES (moves menu)
- LA TABLE DES MATIÈRES — the masthead index: a numbered list of blue anchor links that genuinely jump, set as a plain ol or a two-column bordered table. The document's nav IS its contents page; there is no sticky header.
- LE CATALOGUE — the index-of-works table: Nº / italic title / medium / year / plate filename / price. One row wears [ NEW ]. Sortable nothing — order is the artist's order.
- LA PLANCHE-CONTACT — a contact-sheet table of naked framed plates with deliberately uneven colspans (one wide cell, two narrow, then the reverse), each with its filename caption. The gallery as a layout table.
- LE CHARGEMENT — the showpiece: one plate loads under scrub in interlaced bands → color strips → detail pops, with the byte-counting status line. Subject and pass-structure are the build's own.
- LA LIGNE D'ÉTAT — the fixed status bar: load messages on arrival, then "Document: Done", optionally tracking the current anchor ("Document: Done · #plates"). 24px of chrome that dates the page perfectly.
- LE COMPTEUR — the visitor counter: bordered digit wells, a plausible odometer number, one instant last-digit increment on load. Place it in the masthead or the footer, never both animated.
- LE LIVRE D'OR — the correspondence form played as a guestbook: "Sign my guestbook" register, bevel fields, a Send button, the honest success sentence with timestamp.
- LES 88×31 — the footer badge strip: 3–5 drawn 88×31 bordered badges in the world's chrome palette, deadpan texts, at most one in link blue.
- LE JOURNAL — a "What's new" changelog: dated Courier lines, newest first, [ NEW ] on the top entry; the honesty of a maintained page.
- LA FICHE — one work presented as a full record: big naked frame on one side, a bordered metadata table on the other (medium, size, edition, availability, price). The museum label as a section.
- LE MIROIR FTP — a section set as a Courier pre directory listing (permissions, sizes, dates, blue filenames linking to anchors). Archives, discographies and project lists love it.
- LA CITATION — press quotes as plain serif blockquotes with em-dash attributions, separated by standard hrs, no quotation-mark ornaments, no cards.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- "INDEX.HTML" (the London illustrator register): persona = a personal homepage kept since 1996. Hero = a two-cell bordered table: left cell the h1, factual bio line, last-updated line, counter and numbered index; right cell one framed plate with its filename caption. Showpiece = a single large gouache loading in interlaced greyscale bands then color strips, bytes counting beneath. Mood: dry, warm underneath, London-literal.
- "CATALOGUE RAISONNÉ" (printmaker): persona = the complete catalogue of an œuvre. Hero = a full-width bordered masthead table — the artist's name spanning all columns in the caption row, cells beneath holding dates, medium counts and edition totals. Showpiece = the centerpiece print refining through three full-frame quality passes (coarse blocks → flat color → fine detail), the status line counting "scan 2/3". Mood: archival, exact, quietly grand.
- "STUDIO.NET" (two-person design studio): persona = an FTP mirror of the studio's work. Hero = the directory listing itself — a Courier pre of project files with sizes and dates as the first viewport, the studio name a plain h1 above it. Showpiece = the projects table downloading row by row on scrub, each row popping in with its own byte count until the final "12 files — Done." Mood: technical, self-assured, zero adjectives.
- "LA REVUE" (writer/journalist): persona = a collected-articles homepage. Hero = the classic centered homepage — name centered, standard hr, a one-line epigraph, the counter centered beneath. Showpiece = the lead essay arriving screenful by screenful on scrub, a Courier margin marker counting "page 3 of 9" as each block pops. Mood: bookish, plain, faintly amused.
- "GIG ARCHIVE" (band): persona = the band's self-maintained archive. Hero = la fiche — the newest poster in a big naked frame on the right, its bordered metadata table (venue, date, edition of 80, £12) on the left. Showpiece = the discography contact-sheet where each cover loads in quick 4-band interlace, one after another along the scrub. Mood: loyal, sweaty, meticulous.
- "DARKROOM INDEX" (photographer, drawn duotone plates): persona = a contact-sheet logbook. Hero = masthead with the changelog as its right column — dated Courier entries doing the talking. Showpiece = one large plate scanning in from the BOTTOM upward, a status line reading "row 448 of 1200 — scanning…", finishing with the caption and frame popping last. Mood: patient, chemical, precise.
- "PLAN ARCHIVE" (architecture portfolio): persona = a drawings index. Hero = the catalogue table AS the first viewport — project Nº, italic title, scale, year, sheet count — with the practice name set small in the table's caption row above. Showpiece = one drawing loading by layers on scrub: line pass, then hatch pass, then label pass, status line reading "layer 2/3: hatching". Mood: austere, ruled, certain.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails. ONE: the SYSTEM-FONT DISCIPLINE — the entire register collapses with a single webfont; Times at 17px, ruled tables and letter-spacing 0 are the whole costume, and the costume must be worn perfectly straight. TWO: the FURNITURE'S CONVICTION — the counter, the status bar, the byte counts, the visited-purple must all actually work and stay arithmetically plausible; the 2-second read "this is deliberate" lives entirely in these details. THREE: the PLATES — inside this austere shelf the drawn work is the whole visual budget; weak plates make the page a joke about bad websites instead of a confident portfolio. The cheap moves that separate it from a generated page: :active red, the weekday in the last-updated line, [ NEW ] tags that match the changelog dates, the 88×31 badges, the bevel inverting on press, and the status bar quietly reading "Document: Done" — because it is.`,
	energy: "medium",
	family: "web-primitive",
	fusesWith: ["phosphore", "fanzine"],
	id: "hypertexte",
	industries: [
		"artist / illustrator",
		"freelancer portfolio",
		"design studio",
		"writer / journalist",
		"photographer",
		"music / band",
		"videographer / production",
		"architecture portfolio",
		"dev tool",
		"marketing / branding agency",
	],
	kind: "website",
	mood: ["deadpan", "literal", "archival", "confident"],
	name: "Hypertexte",
	priceFeel: "accessible",
	preview: {
		accent: "#0000EE",
		fontFamily: "Tinos",
		ground: "#FFFFFF",
		ink: "#000000",
		sampleWord: "index.html",
	},
	tagline: "Le web de 1996, porté comme une ironie sûre d'elle.",
};
