import type { DesignWorld } from "../types";

/**
 * FANZINE — the photocopied protest zine.
 * Toner grain, torn-paper collage, misregistered two-color print, tape
 * strips, ransom-note accents. DIY urgency, anti-polish pride; the page
 * looks hand-assembled at 2am and proud of it. Fuses with huitbit (the
 * zine reviews the arcade — counterculture pair) and manifeste (the zine
 * grows up into a manifesto — type-protest).
 */
export const fanzine: DesignWorld = {
	avoidFor: [
		"medical (all)",
		"notary",
		"financial advisor",
		"wedding services",
		"kindergarten / crèche",
		"aesthetic clinic",
	],
	doc: `# DESIGN WORLD: FANZINE — the photocopied protest zine

## Philosophy
This page is a ZINE, not a website — sixteen A5 pages of fury, cut with a scalpel, glued at 2am, run two hundred times through a dying photocopier and taped together because the stapler broke years ago. Its first structural fact: everything is PASTED. No element simply "sits" in a layout; every card, headline strip, image and label is a piece of paper laid onto the page at an angle from the site's angle set, and it must carry PROOF OF PASTING — a tape strip across a corner, a torn edge, or a deliberate overlap onto its neighbor. Its second structural fact: TWO-INK PRINT PHYSICS — photocopy-paper ground, toner black, one punk-pink spot ink; xerox blue exists ONLY as the misregistration ghost, the second pass of the press that missed. Its third: THRESHOLD IMAGERY — all drawn art is pure toner on paper with zero midtones, because a photocopier knows only black and not-black; shading is coarse hand-hatching, never grays, never dots. Impossible failure modes: a gradient (the machine cannot print one), a soft shadow, a smooth tween, elegant breathing whitespace, tasteful minimalism, an element sitting perfectly straight in a tidy grid. Self-audit before shipping: (1) zero box-shadow, zero blur, zero gradient anywhere in the stylesheet; (2) zero smooth easings — every animation resolves through steps(); (3) every pasted element carries visible proof of pasting; (4) exactly three inks plus paper on the whole page — toner, pink, and blue as ghost only; (5) every display headline carries the misregistration ghost; (6) at least one ransom-note word on the page and never more than three.

## The variation contract (why two FANZINE sites are siblings, never clones)
WORLD LAW — never renegotiated by brief or builder:
- Two-ink physics: photocopy paper ground, toner #141210, one pink spot ink, #3A55D9 reserved for misregistration ghosts only.
- Jitter-cut motion: steps(1–3) easing exclusively, no tween over 0.32s, nothing ever glides. The flyer-collage scrub is the only showpiece type.
- The three owned tics always present: torn-paper edges, misregistered 2-color print, tape strips + ransom-note letters.
- The ANGLE SET: each site picks four angles from −7°…+7° (plus 0°) and reuses ONLY those; nothing on the page rotates outside its set.
- Corners: everything consumes min(var(--radius), 0px) — scalpels cut straight, nothing ever rounds; borders never thicker than 2px; depth is overlap and tape, never shadow.
- Threshold imagery: drawn art in flat toner with paper cutouts and hatch shading; no photography, no midtones.
CLIENT-OWNED — where siblings diverge, decided per brief:
- Exact paper hexes inside the photocopy register (#EFEAE2/#E7E1D6) and the pink within its register (#FF2E88/#F2237A/#FF4E9B).
- The display LEAN: Fjalla-forward (shout-heavy, big condensed caps everywhere) or Special-Elite-forward (typed-heavy, the typewriter does most of the talking). Both faces are always present; the ratio is the client's.
- The CAUSE. Every FANZINE page is AGAINST something — boring skin, silent Tuesdays, bland food, chrome without soul. The cause names the hero shout, the rant, the flyer and the copy voice. A FANZINE page with nothing to be against is a brochure: name the enemy FIRST.
- The angle set's four values, the drawn flash set (which objects get inked), the black-slab count (one or two), the section order beyond the fixed cover and back page, and the showpiece flyer's content.

## The vibe (voice)
Shouted declaratives in caps carried by the display face, typed lowercase asides carried by the typewriter — the editor yells the headline, then mutters the truth underneath. Zero corporate perfume, zero mystery: prices, rules and refusals said out loud. Register examples (demo language English): "SKIN IS THE LAST HONEST PAPER." · "Booked is booked. Flaky is forever." · "We photocopy flyers, not other people's tattoos." One honest concession per page ("Card, cash, no crypto. Tips buy the coffee.") does more than ten adjectives. Exclamation marks: the caps already shout — one per page, maximum.

## Visual signatures
- TORN-PAPER EDGES (owned tic): jagged SVG tears, never smooth waves — 16–26 vertices per viewport width, amplitude 8–20px. Between sections: a full-bleed tear strip 24–44px tall (the next section's ground biting into the previous). On pasted sheets and art frames: one or two torn sides per sheet via clip-path polygon, the other sides scalpel-straight. A tear is a cut made angry — short irregular segments, no two peaks the same height.
- MISREGISTERED 2-COLOR PRINT (owned tic): every display headline carries a ghost duplicate in #3A55D9 at 55–80% opacity, offset 3–5px horizontal / 2–3px vertical (text-shadow: 4px 2px 0 is canon). Drawn art prints twice: a ghost copy of the whole artwork in blue (or pink, one per site for art) offset 3–6px BEHIND the toner layer — paper cutouts inside the black let the ghost show through, exactly like a real misprint. On toner-black slabs the ghost flips to pink at 70%. The blue is NEVER a fill of record: no blue text, no blue buttons, no blue grounds.
- TAPE STRIPS + RANSOM-NOTE LETTERS (owned tic): tape = translucent strips rgba(247,243,234,0.55), 64–120px × 20–30px, both ends clipped jagged, laid at ±35–55° across corners of pasted elements; one pink-tinted variant rgba(255,46,136,0.3) rationed to 1–2 per page. Tape is FANZINE's only fastener — never pins, staples or paperclips (CARNET's). Ransom words: per-letter inline-block spans, backgrounds cycling toner/pink/sheet-white, faces alternating between the shout and the typewriter, per-letter rotation −4°…+4°, padding 0.02em 0.09em. One to three ransom words per page, never a full ransom sentence.
- TONER DUST + ROLLER STREAKS: a fixed full-page overlay of THRESHOLDED black specks (feTurbulence pushed through a discrete alpha transfer so every speck is pure toner, no gray fog) at 5–7% opacity, plus 1–2 solid vertical roller-streak bands rgba(20,18,16,0.03), 60–90px wide, full height. This is photocopier grime — hard specks and streaks, never the soft plaster grain (MATIÈRE's).
- THE Nth-GENERATION COPY: the hero headline and the footer wordmark pass through a displacement filter (feTurbulence + feDisplacementMap, scale 2–4) so edges wobble like a copy of a copy. Those two moments only.
- PASTED-SHEET SURFACES: content blocks sit on sheets one step lighter than the ground (#F7F3EA on #EFEAE2), each rotated from the angle set, each with a 1px toner edge on at most two sides (the scalpel cut) — never a box-shadow, never four neat borders.
- TYPED CHITS: all labels, nav items, prices and captions are Special Elite on small paper chits (sheet ground, 1px ink edge, small rotation), like strips fed out of the typewriter and taped down. Labels never float letter-spaced on bare ground (ÉCRIN's).

## Color physics
- GROUND: the photocopy register — #EFEAE2 (ground A) and #E7E1D6 (ground B). Sections may alternate A/B; pasted sheets are #F7F3EA, one step lighter, so every sheet reads as paper ON paper.
- INK: toner #141210 — never pure #000 (toner is warm), never gray. All body text, all edges, all threshold art.
- SPOT: punk pink, the #FF2E88/#F2237A/#FF4E9B register. Budget: primary CTAs, ransom-letter backgrounds, ONE accent line per black slab, the flyer's loudest chit, 1–2 pink-tinted tapes, numeral accents in lists. Pink text sits on toner or paper, never on blue, never on itself.
- GHOST: #3A55D9 at 55–80% opacity, misregistration layers ONLY — text-shadow ghosts and offset art duplicates. If blue appears at 100% opacity or as a surface, the page is broken.
- TONER SLABS: one or two full-bleed #141210 sections per page where type flips to paper and the ghost flips to pink. The slab is the zine's angriest spread — big type, typed rules, pasted headline STRIPS and tape; never sheet cards or grids.
- GRADIENTS EXIST NOWHERE — not in backgrounds, not in art, not in tape. A photocopier flattens everything it loves. Depth is overlap; light is paper.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · SPOT→--primary · INK→--primary-foreground · pasted sheet→--secondary · GHOST→--accent · toner at 55%→--muted · INK→--border · zero→--radius · SHOUT→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, ghost or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- SHOUT: Fjalla One — condensed caps for headlines, buttons, prices that matter. Uppercase always, tracking 0…+0.02em, line-height 0.92–1.04. Hero statement clamp(2.9rem, 8.5vw, 6.8rem); section shouts clamp(2.2rem, 5vw, 3.8rem); the toner-slab shout may reach clamp(2.4rem, 6vw, 4.6rem). Display never appears under 1.2rem.
- TYPEWRITER: Special Elite — masthead furniture, chits, price lists, form labels, captions, asides. 0.78–1.08rem, never tracked, sentence case or caps, always reading like it was typed on the machine in the corner.
- BODY: Courier Prime 400/700, 1rem–1.05rem, line-height 1.55–1.65, measure ≤64ch, flush left ragged right. (Work Sans 400/600 is the permitted body alternative when a site carries long prose; one body per site.)
- Emphasis is pink, caps, or the ransom treatment — NEVER italic, never underline-as-decoration, never letter-spaced whispers. Never a weight under 400. No serifs anywhere.
- MISREGISTRATION IS MANDATORY on every h-level display line (the text-shadow ghost spec above). A clean headline is a misprint of the world.
- Arabic pairing: shout face Lalezar (or Cairo 900), body Vazirmatn 400/600; the typed voice moves to Vazirmatn 500 on chits. Mirror the angle set and flip ghost offsets to −4px 2px in RTL. Tape, tears and threshold art unchanged.

## Signature art / components
- THRESHOLD FLASH ART: every drawn object (dagger, rose, swallow, snake, bolt, skull, burger, engine — the client's flash set) is flat toner shapes with paper cutouts and 2–4px hand-hatch strokes at ONE angle per object for shading. fill-rule evenodd cutouts are encouraged: the ghost layer beneath shows through the holes, exactly like a misprint. 1–3 colors max per object (toner + paper + one pink moment). No outlines-only art (CINÉTIQUE's stroked language), no dot shading (GAZETTE's), no pixel grids (HUITBIT's).
- ART PRINTS TWICE: each artwork's SVG defines its shapes once and stamps two <use> copies — ghost first (blue/pink, offset 3–6px, 55–70% opacity), toner on top. Every drawn scene carries role="img" and a real aria-label in the page's language; decorative repeats are aria-hidden.
- BUTTONS: pink slabs — Fjalla One caps on #FF2E88, padding 0.85rem 1.5rem, radius 0, rotated from the angle set, transition:none. Hover/focus-visible: the button JITTERS — rotation snaps to a different angle from the set and the blue text-ghost doubles its offset, in one hard step. Active: it snaps to 0° like a hand pressing it flat. Secondary actions are typed chits with a tape strip.
- FORMS: a typed booking sheet on a pasted rotated sheet — labels Special Elite caps above each field, fields are typewriter blanks (transparent ground, 2px toner bottom rule, Courier Prime input text), phone-first (input type="tel" with a local placeholder), structured choices in a select styled as a typed list. Invalid: the rule flips pink + a frank typed line ("Need your number or we can't call you back."). Success: the form sheet is replaced by an honest typed confirmation stating exactly what happens next. On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail ({ name, phone, want, … }), plus one off-canvas decoy input with data-wandit-hp that the page's own script never reads, fills or references.
- THE WORDMARK: footer only — the name huge in Fjalla One paper-on-toner, clamp(3rem, 9.4vw, 8.2rem), pink ghost at 5px 3px, run through the nth-generation displacement filter.
- FAVICON: inline SVG data URI — a toner bolt on the paper ground with one small pink slab, radius 0.

## Page chassis
- Vertical rhythm: section padding clamp(3.5rem, 8vh, 5.75rem) — a zine is DENSE; when two sister sections share one pinboard mood (the flash wall into the line-up), tighten the shared boundary to 2.5–3rem so the collage never opens into a dead band. Containers 1180–1300px; toner slabs and tear strips bleed full width. Every section carries overflow-x: clip so rotated sheets never widen the page at 390/768/1440.
- HEADER: a taped paper strip — wordmark in Fjalla One with the ghost, one typed identity line, nav as typed chits (real anchors), ONE pink CTA. 2px toner bottom rule. Sticky allowed. No datelines, no edition numbers, no weather lines (GAZETTE's masthead furniture).
- FIXED OPENING — THE COVER: the zine's front page. Must contain: the misregistered mega-headline with ONE ransom word; at least one threshold artwork pasted with visible tape; 2–3 typed fact chits carrying honest facts (price floor, hours, the non-negotiable rule); a torn exit into the next section. Two cover families: the SHOUT SPLIT (headline column + taped art column) and the WANTED POSTER (one huge centered artwork with headline strips pasted above and below).
- FIXED CLOSING — THE BACK PAGE: the booking sheet (shout + honest promise beside the typed form), then the toner footer: the wordmark, typed chit links with real hrefs (tel:, mailto:, socials), one honest legal line. The footer tear is the page's last torn edge.
- FREE MIDDLE (compose 3–5 from this vocabulary, never two adjacent sections with the same layout): the FLASH WALL pasted grid · the RANT toner slab · the LINE-UP overlapping index cards · the RATE SHEET rotated price sheet · the FLYER collage scrub (the showpiece, one per page) · the PHOTO-BOOTH strip. Section labels are typed page chits ("PAGE 02 — THE LINE-UP").

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: JITTER CUTS. Nothing tweens smoothly, ever — every animation is 2–3 hard frames, like a flipbook missing pages. Every hidden state is set via gsap.set, never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). JS dead → the zine lies fully assembled, every sheet taped down at its rest angle.
- Easing identity: steps(1), steps(2), steps(3) ONLY. Durations 0.14–0.32s. No power curves, no back, no elastic, no linear glides. If a value changes on screen, it JUMPS there.
- THE STAMP (entrance law): a pasted element appears in one hard cut (autoAlpha steps(1)) while its rotation snaps through 2–3 frames — rest+8° → rest+3° → rest — and scale drops 1.06 → 1 in steps(2). Stagger 60–120ms in reading order. Headlines stamp with an 8px horizontal jolt in steps(2). After landing, transforms are cleared so the CSS rest angle (and the hover jitter) owns the element again.
- SHOWPIECE TYPE — LE COLLAGE (the flyer scrub): ONE pinned scene per page where the studio's flyer assembles in hard cuts on scroll (scrub 0.3–0.5, end +=1600–2200px). Order: base sheet → headline strip → fact chits → artwork → price strip, each stamping in with rotation jitter, each tape strip slapping on ONE BEAT after its sheet (steps(1), 0.15s later), the loudest pink chit slamming LAST. A typed side-rail of process captions (CUT → PASTE → TAPE → COPY ×200) flips pink as each phase passes. Mobile (<768px): no pin — the flyer stamps together on view, pre-composed in CSS.
- HOVER: the JITTER — one hard step to a different angle from the set (buttons also double their ghost offset; cards straighten to 0° and jolt −2px). transition:none; :focus-visible and :active give keyboard and touch the same snap.
- REDUCED MOTION: the fully-pasted page, flyer at its finished frame, captions all pink. A designed still, never a blank.

## Fanzine ban list (in addition to the global one)
- Handwritten annotations, pins, staples, paperclips, spiral binding — that is CARNET's language. FANZINE is toner and tape, not pen and pin.
- Ordered halftone-dot imagery, broadsheet justified columns, masthead dateline/edition furniture — that is GAZETTE's language.
- Hard black offset shadows and 3–4px borders-on-everything — that is BLOC's language; FANZINE's depth is overlap and tape, its edges 1px scalpel cuts.
- Poster-ground section rotation and fit-to-viewport headlines — that is AFFICHE's language.
- Pixel grids, stepped pixel corners, sprite art, game-HUD furniture — that is HUITBIT's language.
- Viewport-scale words as layout structure — that is MANIFESTE's language, even in a fusion.
- Soft full-page grain as material (plaster) — that is MATIÈRE's; FANZINE's toner is thresholded specks and streaks.
- Outline/stroked display type and crossing marquees — that is CINÉTIQUE's language.
- Any smooth easing (power, back, elastic, sine) or any tween over 0.32s.
- box-shadow, text-shadow-as-glow, blur, backdrop-filter, border-radius above 0.
- Gradients anywhere, including inside art and tape.
- Photography, photoreal rendering, gray midtones in art.
- Italics, serifs, font weights under 400.
- Blue as a fill of record (text, surface or button) — blue is the ghost, nothing else.
- More than three ransom words per page; a full ransom sentence.

## LES GESTES (moves menu)
- THE COVER SHOUT — the SHOUT SPLIT cover: misregistered mega-headline with one ransom word on the left, the flagship threshold artwork taped at an angle on the right, fact chits underneath, torn exit at the bottom.
- THE WANTED POSTER — the other cover: one huge centered artwork printed twice (ghost + toner), headline strips pasted above and below it like a reward bill, chits taped to its corners.
- THE FLYER — the showpiece scrub: the studio's next flyer assembles in hard cuts on a pinned board, tapes landing a beat late, the pink chit slamming last, a typed process rail flipping pink phase by phase.
- THE FLASH WALL — the pasted grid: 5–7 threshold artworks on rotated sheets with typed name + price chits, every rotation from the angle set, at least one card overlapping its neighbor, one torn side per sheet.
- THE RANT — the toner slab: a shouted two-to-five-word refusal with a pink ghost, then the house rules typed in paper white, numbered in pink, exactly one pink line for the rule that matters most; close the spread with a two-strip pasted quote (paper strip + pink strip, taped) so the slab's far column never sits empty.
- THE LINE-UP — people or dates as overlapping index cards fanned across the row: threshold portrait mark, typed stats, tape on the top corner; hover jitter-lifts one card a single step.
- THE RATE SHEET — the honest price list typed on one rotated pasted sheet, torn along one edge, taped at two corners: service — dashes — price, deposit and cancellation lines included, the total or floor in pink.
- THE PHOTO-BOOTH STRIP — a vertical strip of 3–4 threshold frames taped beside prose like a booth print, captions typed under each frame; frames stamp in top to bottom.
- THE CUT-UP QUOTE — a two-line pull quote assembled ransom-note style, backgrounds cycling toner/pink/sheet, set between two sections as a breather that still shouts.
- THE CORRECTION — new information typed on a strip and taped OVER the old (the old peeking out 1–2° off underneath) — for changed prices, sold-out flash, moved dates. The zine never reprints; it patches.
- THE STAMP-IN — the entrance law played as a visible rhythm on one key section: sheets land in reading order 80ms apart, tapes following like an echo.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- GUTTER PRESS (tattoo & piercing, London) — COVER SHOUT hero (the SHOUT SPLIT): "SKIN IS THE LAST HONEST PAPER." with HONEST in ransom letters, a dagger-through-rose taped beside it. Flash wall of six one-off designs, toner-slab house rules, line-up of three artists. Showpiece: the December flash-day flyer assembles in the canonical order — base sheet → headline strip → date chit → artwork → price strip. Motion: strict stamp-ins, tapes always a beat late.
- SORE THUMB (music / band, Manchester) — WANTED POSTER hero: the band's threshold group silhouette printed twice, name strips pasted over it. Section order flipped: dates first (LINE-UP as tour cards), then the rant ("QUIET IS A CHOICE. MAKE THE WRONG ONE."). Showpiece: the tour flyer stamps city chits on one by one, sold-out cities patched with CORRECTIONS. Motion counts a 4/4 — stamps land on the beat, 150ms grid.
- GREASE TRAP (street food / food truck, Leeds) — the RATE SHEET IS the hero: the menu typed huge on one giant rotated sheet, prices in pink, a burger threshold-print taped to its corner. Middle: photo-booth strip of the kitchen, cut-up quote ("BLAND IS A CRIME"). Showpiece: tomorrow's pitch flyer assembles in menu order at a lazy 200ms stagger — the slowest build in the family — the CORRECTION taping the new location over the old. Voice all lowercase typed except one shout. The only variation allowed to open on the rate sheet.
- TURPENTINE (artist / illustrator, Glasgow) — Special-Elite-forward portfolio: covers as a FLASH WALL of linocut prints with year chits, prose in Work Sans. Hero: PHOTO-BOOTH strip of four works beside a quiet shout. Showpiece: an exhibition poster assembles from her actual prints — print by print in hanging order, the title strip last. Only one pink moment per viewport — the restrained sibling.
- STATIC (DJ / entertainment, Bristol) — inverted: the page OPENS on a toner slab (cover shout in paper type, pink ghost), paper sections are the interludes. Ransom lineup names, two black slabs. Showpiece: the club-night flyer builds bottom-up — bassline first (price strip), name last. Stamps at a hard 120ms grid, no stagger variance — machine-tight punk.
- CHOP SOCIETY (barber, Hackney) — typed-forward: LINE-UP hero — the three barbers fanned as overlapping index cards under one small typed shout ("WALK IN. SIT DOWN."), tape on every top corner; the price list moves mid-page (RATE SHEET taped beside a drawn mirror). RANT: "YOUR DAD'S BARBER WAS RIGHT." Showpiece: the walk-in Saturday flyer assembles chair by chair with the CUT/PASTE/TAPE rail, stagger loose and human — 60–110ms, never a fixed grid. Corrections patch the waiting-list times weekly.
- KICKSTART (motorcycle shop, Sheffield) — PARTS WALL hero: the flash-wall grid played as the cover — a threshold engine cutaway printed twice at center, typed part-number chits pasted around it, the ransom word KICK on a headline strip across the top row. CUT-UP QUOTE: "CHROME WON'T GET YOU HOME." Showpiece: the swap-meet flyer builds heaviest-first — the engine art stamps before any strip, the date chit slamming last. One pink-tinted tape on the hero only.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the JITTER-CUT DISCIPLINE (steps() everywhere — one smooth fade and the 2am urgency collapses into a template with torn edges), PROOF OF PASTING (every element taped, torn or overlapping — one cleanly floating card and the collage becomes a mockup), and the MISREGISTRATION (the ghost on every headline and behind every artwork — it is the world's signature in one glance). The cheap details that separate it from a generated page: the tape landing a beat after its sheet, one ransom letter set upside-down-ish at +4°, the ghost showing through a skull's eye socket, the roller streak crossing one section, the honest typed concession under the price list. When in doubt, tear it, tape it, and say the price louder — polish is the only thing this world cannot afford.`,
	energy: "loud",
	family: "zine-punk",
	// huitbit: the zine reviews the arcade — counterculture pair.
	// manifeste: the zine grows up into a manifesto — type-protest.
	fusesWith: ["huitbit", "manifeste"],
	id: "fanzine",
	industries: [
		"tattoo & piercing",
		"music / band",
		"festival",
		"DJ / entertainment",
		"streetwear / drops",
		"barber",
		"artist / illustrator",
		"photographer",
		"videographer / production",
		"design studio",
		"fast food",
		"street food / food truck",
		"motorcycle shop",
	],
	kind: "website",
	mood: ["loud", "raw", "DIY", "rebellious", "urgent"],
	name: "Fanzine",
	priceFeel: "accessible",
	preview: {
		accent: "#FF2E88",
		fontFamily: "Special Elite",
		ground: "#EFEAE2",
		ink: "#141210",
		sampleWord: "NO FUTUR",
	},
	tagline:
		"Le fanzine photocopié : collage brut, encre ratée exprès, urgence punk.",
};
