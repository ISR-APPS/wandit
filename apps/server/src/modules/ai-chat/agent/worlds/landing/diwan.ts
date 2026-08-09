import type { DesignWorld } from "../types";

/**
 * DIWAN — the illuminated salon.
 * Family: heritage-ornament. Andalusi-Ottoman craft heritage carried with
 * dignity: engraved arabesque frames in strict mirror symmetry, eight-point
 * star seals, illuminated section openers, gilded rules on ivory. Ornament is
 * FRAME, never wallpaper. Proven against the Riad Nour demo (guesthouse /
 * riad, Marrakech, MAD, French); every value in the doc was shipped there.
 * fusesWith rationale — zellij: the frame meets the tile, the full riad
 * language; generique: the salon at night — palace dining photographed.
 */
export const diwan: DesignWorld = {
	avoidFor: [
		"dev tool",
		"SaaS product",
		"crossfit / functional",
		"car wash & detailing",
		"fast food",
	],
	doc: `# DESIGN WORLD: DIWAN — the illuminated salon

## Philosophy
This page is AN ILLUMINATED PAGE HUNG IN A RECEPTION SALON — the frontispiece of a manuscript enlarged to the size of a wall, receiving the visitor the way a Maghrebi house receives a guest: with a threshold, a seal, and silence. Andalusi-Ottoman craft heritage is carried with dignity, never as folklore. Its first structural fact: ORNAMENT IS FRAME, NEVER WALLPAPER. Every arabesque on the page exists as a border, a corner flourish, a medallion, a rule or a seal placed AROUND content — no motif ever repeats as a background texture, a pattern fill or a decorative field. The ration is the respect. Its second structural fact: STRICT MIRROR SYMMETRY. Every ornamental composition passes the fold test — reflect it across its vertical axis and nothing changes. Content layout may be asymmetric (offset panels, margin columns); ornament never is. Its third structural fact: POLYCHROME ENGRAVING — all imagery is stroke-drawn SVG in ink, madder and teal linework with gold rationed to rules, beads and seals; flat inks only, zero photography, zero gradients, zero shadows. Its fourth: the EIGHT-POINT STAR (two interlaced squares) is the world's only badge — bullet, knot, seal; no other glyph system exists. Structurally impossible failure modes: orientalist pattern-wallpaper; metallic-gradient "luxury hotel" kitsch; tessellated tiles (that is ZELLIJ); arches as geometry (that is MATIÈRE); a photograph doing the visual work. Self-audit before shipping (count them): every ornament passes the fold test; zero repeated/tiled motif fills page-wide; gold appears ONLY on rules, knots/medallions/star glyphs and at most ONE accent word per page; madder never appears outside SVG ornament linework; border-radius 0 and box-shadow none page-wide; every section title is crowned by an illuminated opener.

## The variation contract (why two DIWAN sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Ornament-as-frame with strict mirror symmetry; the fold test on every composition.
- The three tics: arabesque mirror frames, the eight-point star glyph, illuminated section openers.
- The registers below: ivory grounds, warm ink, deep teal, flat saffron-gold, madder-in-linework-only.
- Serif-only typography: display Amiri or Marcellus, body Lora or Source Serif 4; radius 0 everywhere; no shadows, no gradients.
- Symmetric unfoldings from center as the motion personality; openers lead their titles.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- Exact hexes inside the registers (a warmer ivory, a deeper teal, a rosier madder).
- The display face WITHIN the register: Amiri OR Marcellus (one per site).
- The SALON CONCEPT that names the page — la maison qui reçoit, la table du soir, le jour des noces, la parure — it chooses the gold word, seeds the sceau's promise, names the sections and tunes the voice.
- Ornament density (which corners get the full flourish vs the diamond reduction), the showpiece variant (le sceau, l'enfilade, or ONE invented variant in the same symmetric-unfolding grammar), whether the one deep-teal panel exists, section order beyond the fixed opening and closing, which 2–3 gestes are played.
A DIWAN page without its salon concept is a failure: name it FIRST ("la maison qui reçoit"), then let it choose the promise, the gold word and the rooms.

## The vibe (voice)
Dignified French hospitality — unhurried, concrete, quietly proud. Short declaratives that receive the reader rather than sell to them; house vocabulary is exact (le patio, la fontaine, le tadelakt, le gant de kessa, le thé à la menthe), numbers written plainly (sept chambres, 350 MAD, 45 min). Register lines:
- "Sept chambres autour d'un patio. Le thé est servi à l'heure où la lumière descend."
- "On ne visite pas un diwan — on y est reçu."
- "La porte est basse : on entre en baissant la tête, on ressort en la portant haute."
No superlatives, no exclamation marks, no "luxe", "prestige" or "excellence"; no urgency. English or Arabic builds keep the same temperature.

## Visual signatures
- ARABESQUE MIRROR FRAMES (owned tic): a 1px ink hairline box (ink at 40–50%) carrying polychrome corner ornaments 56–110px wide — a gold diamond seated on the corner, a madder vine scrolling along each edge ending in a volute curl, teal split-leaves off the vine, a small madder volute with a center dot on the corner diagonal, terminal gold dots — each corner drawn once and mirrored (top-right is top-left flipped; each corner is itself symmetric across its 45° diagonal). An optional top-center medallion masks the border on an ivory tab. The grand frame is rationed to its two stations — the hero (when le frontispice is played) and the showpiece — at most TWO per page, never elsewhere; a frameless hero leaves the showpiece frame alone on the page. Every other panel takes the diamond reduction: 9–12px gold-stroked diamonds masking the four corners, nothing more.
- EIGHT-POINT STAR GLYPH (owned tic): two overlapped squares, one rotated 45°, stroke gold 1.5–2px, fill none — at 9–11px as list bullet, 12–16px as divider knot between carte entries and fold facts, 120–160px as the footer seal. It is the ONLY bullet/badge glyph on the page.
- ILLUMINATED SECTION OPENERS (owned tic): above every section title, a beaded medallion (34–48px) centered on a 1px gold rule with diamond finials at both outer ends; the rule halves extend OUTWARD from the medallion on entrance; a small-caps kicker sits between opener and title. Rule halves clamp(64px, 11vw, 170px) each.
- THE BEADED MEDALLION: 16 gold beads r 2–2.5 on a r 50 ring, a teal circle r 43–44 at 1.5px, the eight-point star inscribed (gold stroke, ground-colored fill), a madder center dot r 3. Never rayed, never lobed like a sunburst — beads, circle, star, dot.
- Polychrome linework discipline: main strokes 1.5–2px, detail 1px; madder #8C3B2E for vines and center dots, teal for leaves, gold for diamonds/beads/rules, ink for frames — always FLAT color.
- Small-caps labels 0.72–0.8rem, +0.14 to +0.18em tracking, weight 600 — ALWAYS anchored: flanked by star knots, seated on a gold rule, or heading a hairline; never floating on bare ground.
- Hairlines in two registers: quiet 1px ink at 12–18% (row separators, panel inner rules), structural 1px ink at 35–50% (frames, form fields). Every element consumes min(var(--radius), 0px) — DIWAN's corners stay square, everywhere.

## Color physics
- GROUND: the ivory register — #F6EFE0 with #F2E9D4 as its softer companion. Sections shift softly between them (one or two deeper bands per page, like a change of paper); NEVER a strict two-ground alternation crowned by a single dark inverted interlude — that chassis is MATIÈRE's.
- INK: warm dark brown, the #33261A/#2E2317 register — never black. Body may sit at ink 90–95%.
- TEAL: #0F6B5C primary, #14574B deep. Budget: primary CTA fill, hover fills, links, small-caps kickers, carte prices and timeline hours, leaf linework, and at most ONE full-bleed deep panel per page (le panneau de nuit) where the ground goes #14574B, ink flips to ivory and rules go gold. Teal never sets running prose on ivory.
- GOLD: flat #D9A441 (the #D9A441/#C9963B register). Budget: rules and finials, beads, diamonds, star glyphs, and ONE accent word per page inside a display headline. Never a paragraph color, never a ground, and NEVER a gradient — metallic gradient text is GENERIQUE's champagne foil.
- MADDER: #8C3B2E — exists ONLY inside ornament linework (vines, scrolls, center dots). Never text, never ground, never a button.
- Gradients do not exist. Box-shadows do not exist. Depth is made with hairlines, soft ground shifts, and the frames themselves.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · TEAL→--primary · GROUND→--primary-foreground · GROUND's softer companion→--secondary · GOLD→--accent · ink at 50%→--muted · ink at 16%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, ground shift or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Amiri (400/700) OR Marcellus (400) — one per site. Masthead clamp(3.4rem, 8.5vw, 7rem), line-height 1.02–1.12; section titles clamp(2rem, 4.4vw, 3.5rem); letter-spacing normal (Amiri) or +0.01em (Marcellus). Never faux-bold Marcellus; never italic display — emphasis is the one gold word.
- BODY: Lora OR Source Serif 4, 400/500/600, 1rem–1.06rem, line-height 1.65–1.75, measure 56–66ch, ragged right.
- SMALL CAPS: the body face uppercase per the label law above — nav, kickers, buttons, form labels, table heads.
- Numerals and prices: the display face, with the currency in body small caps ("1 500" display + "MAD la nuit" small); no tabular mono, ever.
- Italic: one-line captions and the colophon closing line only; never headlines, never body paragraphs.
- ARABIC / RTL LAW: on Arabic pages Amiri sets BOTH display and body (Marcellus never touches Arabic); html dir="rtl"; letter-spacing 0 on Arabic script always; small caps become size + color shifts; the mirror frames need no change (symmetry is bidirectional) but offset layouts flip; naskh body line-height 1.8–1.9.
- HARD RULES: never a sans-serif, never a monospace glyph anywhere — including form controls (style inputs with the body serif explicitly).

## Signature art / components
- THE ORNAMENT LEXICON — drawn ONCE as SVG symbols in a hidden defs block, reused via <use>, recolored through CSS custom properties: (a) the eight-point star (two rects, one rotated 45°); (b) the beaded medallion (spec above); (c) the corner flourish (gold corner diamond + madder edge-vine with curl + two teal leaves + gold terminal dots, one edge drawn then mirrored across the corner diagonal with transform="matrix(0,1,1,0,0,0)"); (d) diamond finials (7–9px gold-stroked squares rotated 45°); (e) the sprig (a vertical madder vine of 5–7 alternating teal leaves with a gold diamond head and gold dots, 340–420px tall, used ONLY in mirrored flanking pairs). All stroke-based, flat fills only, no filters. Composed ornaments are aria-hidden; a framed hero composition may carry role="img" with a real aria-label naming the house.
- BUTTONS: small caps inside a 1px ink box, radius 0, padding 0.85–0.95em 1.6–1.8em, a 9–10px star glyph before the label; hover/focus-visible fills teal #0F6B5C with ivory text over 0.3s ease; the primary CTA may start teal-filled. Gold never fills a button.
- LINKS: ink text with a 1px gold underline that grows from CENTER outward on hover/focus-visible (background-size 0→100%, background-position center, 0.3s) — even hovers unfold symmetrically.
- PANELS: 1px ink-35% boxes with the diamond-corner reduction, a small-caps header seated on a quiet hairline, radius 0, no shadow.
- CARTES/TABLES: entries in a ≤680px column under their opener; rows separated by a centered 12px star knot or a quiet hairline; price right-aligned in the display face.
- FORMS (le registre): full 1px hairline boxes (ink at 40%), radius 0; labels in small caps above each field with a tiny star; focus swaps the border to 2px teal; phone-first (type=tel, inputmode=tel, autocomplete=tel, immediately after the name); one select for the structured choice (chambre, occasion, formule); one textarea. SUCCESS STATE is the sealed note: the form is replaced by a star seal and "Votre demande est reçue. La maison vous rappelle avant ce soir." inside the same framed panel, announced via aria-live="polite". On valid submit dispatch on document the CustomEvent "wandit:lead" with the visitor's fields FLAT in detail ({ nom, telephone, chambre, message }). Include ONE off-canvas decoy input with attribute data-wandit-hp (position:absolute; left:-9999px; tabindex=-1; aria-hidden=true) that the page's own script never reads and never blocks on.
- ::selection is teal ground with ivory text; :focus-visible is a 2px teal outline offset 3px. Decorative SVG aria-hidden; one h1; semantic landmarks. Favicon: inline SVG data URI — the gold eight-point star on ivory.

## Page chassis
- Vertical rhythm: section padding clamp(5rem, 11vh, 8.5rem); the showpiece gets a full viewport. Container max 1200px, padding-inline clamp(1.25rem, 4vw, 3rem); the grand frame may reach 1320px; cartes cap at 680px; prose at 60–66ch.
- HEADER: a slim in-flow bar — wordmark with a small star glyph left, 3–4 small-caps anchor links + phone right, a quiet hairline below. Never sticky-blurred, never shadowed. ≤640px the nav drops to its own single row under wordmark + phone.
- FIXED OPENING — LE FRONTISPICE (or the SEUIL NU variant): the grand mirror frame around a place line in small caps seated on a gold rule, the masthead (the one h1) at clamp(3.4rem, 8.5vw, 7rem), the statement carrying the page's one gold word, one CTA; at the fold, 3 facts separated by star knots.
- FIXED CLOSING: LE REGISTRE (practical column + the framed form), then LE COLOPHON: a full-width gold rule with a center knot, the great star seal (120–160px), small-caps columns (adresse, téléphone, heures), and one italic closing line.
- FREE MIDDLE: compose 3–5 sections from the gestes vocabulary; never two adjacent sections sharing a layout skeleton; every section title crowned by its illuminated opener; at most ONE deep-teal panel per page.

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
THE GOVERNING LAW: hidden states are set ONLY by gsap.set in JS, never in CSS — script dead, the page is a complete illuminated document. Gate everything on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion).
- Personality: SYMMETRIC UNFOLDINGS FROM CENTER. Everything opens the way the ornament is built — from the axis outward. Opener rules scale from 0 at the medallion side (left half origin right, right half origin left), 0.9s power2.out; medallions arrive scale 0.55→1 with rotate −45°→0 (the star turning into its seat), 0.9–1.1s power3.out; mirrored pairs (corners, sprigs, flanking columns) arrive SIMULTANEOUSLY or stagger from the center: stagger { each: 0.1–0.14, from: "center" }.
- Titles: masked line-rise (yPercent 110→0 inside overflow:hidden), 1.0s power2.out, AFTER their opener has unfolded (opener leads by 0.25–0.4s). Prose and facts: autoAlpha 0→1 + y 24–30→0, 0.9s, staggers 100–140ms.
- THE SHOWPIECE — LE SCEAU (one per page): a pinned viewport (+=220–280%, scrub 0.5–0.7). Beat 1: the medallion turns in at the frame's center (scale 0.5→1, rotate −45°→0). Beat 2: it RISES to its seat on the top border while the four border lines extend from their centers outward (top/bottom scaleX, left/right scaleY, all transform-origin center). Beat 3: the four corner flourishes arrive together (scale 0.6→1 + autoAlpha). Beat 4: the section's promise appears inside as masked lines (2 max, display face clamp(2.2rem,5.6vw,5rem)) with its sub-line, then a held closing beat (~15% of the scrub), the completed seal filling its min(64vh,560px) frame. VARIANT — L'ENFILADE: one pinned frame holds still while its content (room, offer, date, piece) crossfades per beat. A build may instead invent ONE named variant in the same grammar (a pinned frame, rule or medallion choreography unfolding symmetrically from its center). One showpiece per page, never two. Mobile ≤767px: NEVER pin; the same timeline plays once as a 1.4–1.8s entrance on scroll into view, and the frame hugs its content (height auto) instead of holding a viewport.
- Hovers 0.3s: the center-out gold underline, teal button fills, panel corner diamonds turning teal. Keyboard parity via :focus-visible always; touch gets the resting state, nothing hidden behind hover.
- FORBIDDEN MOTION: bounce/elastic/back overshoot, parallax drift, letter-by-letter typing, random jitter, marquees, and strokeDashoffset self-tracing lines (ORFÈVRE's move — DIWAN unfolds by scale and mirrored arrival, never by tracing).
- Reduced motion: everything printed at rest; the sceau fully drawn with its promise legible — a composed still, never a blank.

## Ban list (world-specific, beyond the global list)
1. Tessellated star-and-polygon tile bands, glazed-tile cards with grout gaps and hue jitter, tile-chip navigation — that is ZELLIJ's language (available only through the curated fusion).
2. Arch-only geometry (arch frames, arch pills, arch buttons), drawn room miniatures with light glowing in arched openings, the material-swatch cabinet, and the strict warm double-ground alternation with ONE deep-companion inverted interlude — that is MATIÈRE's language. DIWAN's corners are square, its geometry rectilinear.
3. Gold sunburst/fan motifs with radiating rays, stepped ziggurat frames and borders, gold chevron dividers with a center gem — that is FOLIES' language. DIWAN's medallions are beaded circles around a star, never rayed crowns.
4. Gold hairline engravings of objects on BLACK that draw themselves on scroll, filigree corner flourishes on double-hairline gold frames, the gilded page-edge line — that is ORFÈVRE's language. DIWAN lives on ivory, never traces strokes, and its frames are single-hairline polychrome.
5. Passport stamps and postmarks, dotted travel routes that draw across sections, compass roses — that is ATLAS's language.
6. Ornament as wallpaper: any repeating arabesque background, tiled motif, patterned fill behind text — the one unforgivable DIWAN sin.
7. Photography and raster imagery of any kind (photography enters only via the GENERIQUE fusion, letterboxed under that world's law).
8. Metallic or gradient gold text and foil small caps — GENERIQUE's champagne foil; DIWAN's gold is flat #D9A441.
9. Heraldic wax-seal crests — PUPITRE's medallion; DIWAN's only seal is the geometric eight-point star.
10. Boxed drop caps with folio numbers, paired thin+thick double-filet label rules — VÉLIN's furniture; DIWAN's rules are single and gold with diamond finials.
11. Floating letter-spaced micro-caps on bare ground, the centered plumb line, roman-numeral section markers — ÉCRIN's language; DIWAN's labels are always anchored to ornament.
12. Border-radius anywhere; box-shadows; backdrop blur; glassmorphism.
13. Purple, blue, cool greys, black grounds; and the cream+gold-ONLY "luxury hotel template" coding — the teal and madder polychromy in the linework IS the heritage; a page whose ornament is all gold has failed.
14. Italic display type; more than one gold word per page; gold paragraphs.
15. Any ornament whose mirror twin is missing — asymmetric flourish is a defect, not a flourish.

## LES GESTES (moves menu)
1. LE FRONTISPICE — the canonical hero: the grand mirror frame around place line, masthead, statement with the gold word, CTA; three facts separated by star knots at the fold. Vary the corner density and fact count.
2. LE SEUIL NU — the typographic hero: no full frame; one large illuminated opener crowns the masthead alone on vast ivory, statement below, a mirrored sprig pair flanking. For names strong enough to stand alone.
3. LE SCEAU — the pinned showpiece: the grand frame unfolds outward from its center medallion; the section's promise appears inside as it completes (spec in Motion identity). The default showpiece.
4. L'ENFILADE — the pinned frame whose content crossfades per beat: rooms passing like doors along a corridor; the ornament holds still, only words and prices change. Use INSTEAD of le sceau, never both.
5. LES PANNEAUX — offset framed panels (rooms, offers, salons): 2–4 hairline boxes with diamond corners on a 12-column grid, deliberately offset (one pushed down 3–5rem), each with a small-caps header on a hairline, star-bullet facts, a display-face price.
6. LA CARTE DU DIWAN — the tariff/menu column ≤680px under its opener; entries separated by 12px star knots; prices right-aligned in the display face; mirrored vertical sprigs flanking on desktop.
7. LE PANNEAU DE NUIT — the ONE deep-teal moment: a full-bleed #14574B field with gold diamond corners and gold rules, ivory text — for the hammam, the dinner, the evening. At most one per page; never the hero.
8. LES HEURES — the day's timeline on one long gold rule with star knots; entries alternate above/below the rule on desktop, stack along a vertical rule on mobile; knots pop from the center outward.
9. LE MÉDAILLON PARLANT — a pull quote seated under a large beaded medallion, mirrored sprigs flanking, attribution in small caps on a hairline. One per page; the breathing move.
10. LA QASIDA — the margin-verse layout: a narrow ornamental margin column (star bullets, small-caps dates and notes) beside a wide prose column — the story-of-the-house move.
11. LE REGISTRE — the fixed closing form played as a guest register in a framed panel beside the practical column (spec in Signature art).
12. LE COLOPHON DU SALON — the footer: full-width gold rule with center knot, the great star seal, small-caps columns, one italic closing line.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
No two share a hero composition or a showpiece choreography.
- "RIAD NOUR" — guesthouse / riad, Marrakech. Hero LE FRONTISPICE: the grand mirror frame around place line and masthead. Then les panneaux offset for three rooms with MAD prices, la carte for the table, LE SCEAU played straight mid-page — the frame unfolds OUTWARD from its center medallion, promising the silence of the médina — le panneau de nuit for the hammam, les heures, le registre. Amiri, unfolds at 1.0s. Mood: the house that receives.
- "LA TABLE DU VERGER" — fine dining. Hero LE SEUIL NU, typographic: one large opener crowns the masthead alone on vast ivory, mirrored sprigs flanking. La carte central, then showpiece L'ENFILADE in its held frame — the ornament stays still while the services (déjeuner, dîner, salon) CROSSFADE per beat; le médaillon parlant carries the chef's line before le registre. Marcellus, slower (1.2s), rarest gold. Mood: candlelit precision.
- "LES NOCES D'ARGAN" — wedding services. Hero: no frame — the day itself: the couple's names as a mirrored masthead pair, and at the fold LES HEURES as the hero's rail (15 h — la cérémonie, 19 h — le dîner, minuit — la porte). La qasida tells how the family receives. Showpiece LE SCEAU DE L'ALLIANCE: the frame's two halves each carry one family name and draw INWARD, clasping at the center medallion where "une seule journée, tenue comme une maison" appears. Softest staggers, 140ms. Mood: ceremonial tenderness.
- "DAR SOULTANE" — single property showcase. Hero LA QASIDA: masthead high in the wide column, the deed's figures (m², étages, année) star-bulleted in the ornamental margin, one long vertical gold rule, no frame. Les panneaux as the salons, then showpiece L'ENFILADE DES PORTES: per beat two ivory door-leaves fold shut to the frame's center line and reopen on the next room, m² in the display face. La carte becomes la fiche; le panneau de nuit for the terrace at dusk. Mood: a deed read aloud.
- "LE SALON QOBBA" — tea house. Hero LA CARTE D'ABORD: a small wordmark, then the tea carte itself opens in the first viewport under one large illuminated opener — origins, star knots, honest prices before any statement. Showpiece LA QOBBA: a pinned scene where three concentric beaded rings expand outward from the star center, one ring per beat, the hour of tea appearing between them. Le médaillon parlant, les heures of service closing. Densest knots, smallest frames. Mood: an afternoon that lasts.
- "PARURE" — jewelry brand. Hero: asymmetric composition, symmetric ornament — tiny masthead high-left, ONE grand-framed jewel-box panel low-right as the hero's frame station. Showpiece LA VITRINE: a deliberately small held frame at center where one piece per beat TURNS IN like the medallion (scale 0.55→1, rotate −45°→0), carat notes unfolding in mirrored qasida margins; the gold word is the collection's name. Near-silent motion, micro-unfolds. Mood: a vitrine at closing time.
- "MAISON KENZA, TRAITEUR" — traiteur / catering. Hero LES PANNEAUX D'ABORD: masthead centered, and the three formules already at the fold as offset framed panels with per-person prices — commerce received at the door. Showpiece LE CHEMIN DE LA COMMANDE: a pinned VERTICAL gold rule descends beat by beat (J−2 la commande, J−1 la cuisine, J le service), knots popping from the center, each step's panel unfolding alternately left and right in mirrored pairs. Le registre with an occasion select. The most practical sibling. Mood: a kitchen with manners.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
DIWAN lives or dies on THREE things at 100%: the ORNAMENT QUALITY (corners and medallions must read as drawn by a steady hand — consistent stroke widths of 1.5–2px main and 1px detail, symmetric to the pixel, polychrome per the law; one clumsy scribbled corner and the page becomes a restaurant-menu template), the FRAME DISCIPLINE (ornament only as frame, rule, knot and seal — the moment a motif repeats as texture, the world collapses into orientalist wallpaper), and the OPENERS actually leading every section, unfolding center-out before their titles rise. The cheap details that separate it from a generated page: the beaded rims, diamond finials on every rule end, the madder dot at each medallion's heart, star knots between carte entries, the one gold word chosen with taste, and the fold test passed everywhere. When in doubt, remove ornament and add ivory — in this world the dignity is in the ration.`,
	energy: "quiet",
	family: "heritage-ornament",
	fusesWith: ["zellij", "generique"],
	id: "diwan",
	industries: [
		"guesthouse / riad",
		"hotel",
		"restaurant (classic)",
		"fine dining",
		"tea house",
		"traiteur / catering",
		"spa / hammam",
		"wedding services",
		"venue / salle des fêtes",
		"event planner",
		"travel agency",
		"tours & excursions",
		"vacation packages",
		"jewelry brand",
		"home & decor shop",
		"patisserie / bakery",
		"single property showcase",
	],
	kind: "website",
	mood: ["heritage", "maghrebi", "ornate", "dignified", "hushed"],
	name: "Diwan",
	preview: {
		accent: "#0F6B5C",
		fontFamily: "Amiri",
		ground: "#F6EFE0",
		ink: "#33261A",
		sampleWord: "Le Diwan",
	},
	priceFeel: "premium",
	tagline:
		"Le salon enluminé : cadres d'arabesques, sceaux d'étoiles, or rationné.",
};
