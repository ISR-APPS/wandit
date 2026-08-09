import type { DesignWorld } from "../types";

/**
 * GÉNÉRIQUE — the cinematic night.
 * Warm near-black, letterboxed 21:9 photography with hard black bars,
 * champagne foil small-caps for names and prices, tiny bottom-left captions,
 * slow Ken-Burns scrubs. The page as a film's first minutes: imagery does the
 * talking, type whispers. Photography is the LAW (ORFÈVRE is the drawn dark
 * sibling — GÉNÉRIQUE never line-draws an object). Values proven against the
 * SABLE demo (rooftop fine dining, Dubai). Doc appended VERBATIM to the
 * builder prompt.
 */
export const generique: DesignWorld = {
	avoidFor: [
		"kids & baby shop",
		"fast food",
		"spare parts",
		"driving school",
		"pharmacy",
	],
	doc: `# DESIGN WORLD: GÉNÉRIQUE — the cinematic night

## Philosophy
This page is THE FIRST MINUTES OF A FILM, not a website: the lights go down and a picture opens. Its first structural fact: PHOTOGRAPHY IS THE LAW — every image on the page is a low-key cinematic photograph, letterboxed at 21:9 between hard black bars; there is no illustration, no drawn art, no icon system, no decorative shape language. The photographs do the talking. Its second structural fact: TYPE WHISPERS — display type is a single 400-weight roman serif in wide-tracked caps, names and prices are set in champagne foil (a metallic gradient that exists ONLY as text fill), and every full-bleed picture carries one tiny bottom-left caption, the way a film prints its location line. Its third structural fact: DARKNESS IS WARM AND VAST — the ground is a warm near-black with a red-brown undertone (never blue-black, never pure #000 except the bars), and content floats in generous emptiness; a GÉNÉRIQUE page shown at 50% zoom is mostly darkness with a few lit windows. Nothing here is fast: entrances exceed a second, pictures breathe on 14–22s drifts, the one scrub is a title sequence. The failure modes 'bright cheerful template', 'gold-sprayed dark theme' and 'flat-lit stock photography' are structurally impossible: light is rationed to one warm key inside the photographs, foil is rationed to a text-fill budget, and any picture that does not obey the grade is cut. Self-audit before shipping:
- ZERO photographs without letterbox bars; every crop is 21:9 (framed stills) or full-bleed between viewport bars; zero portrait crops.
- Champagne foil appears ONLY as text fill (names, prices, act labels), at most 2 foil elements per viewport, never on a surface, border, rule or icon.
- Every full-bleed photograph carries a bottom-left caption of 60 characters or fewer; zero captions elsewhere than bottom-left.
- Ground stays inside the warm-black register (#131011–#1A1512); bars are always darker than the ground; text never reaches pure white.
- Exactly ONE pinned scroll-scrubbed sequence on the page; no tween under 0.9s except hovers; zero bounce or overshoot easings.
- With JS dead the page is fully lit and readable: bars open, first frames composed, all text present.

## The variation contract
WORLD LAW — never renegotiated by brief or builder:
- The warm-black ground register, ivory ink, smoke support, hard-black bars darker than the ground.
- The letterbox law: 21:9 crops with hard black bars — the three owned tics (letterboxed photography, champagne foil small-caps, Ken-Burns caption scrub) are always present.
- The photographic imagery law below, including the grade (one warm tungsten key, true blacks, champagne highlights, 35mm grain) and the caption law.
- Small-caps display culture: one serif display face at weight 400 only — no bold, no italic, anywhere.
- Cinematic slowness: entrances 1.2–1.8s, drifts 14–22s, exactly one pinned scrub of the 'générique' family; nothing snaps, nothing bounces.
- Sections CUT into each other: no dividers, no shape transitions, no ornaments between scenes.
CLIENT-OWNED — where two GÉNÉRIQUE sites diverge, decided per brief:
- Exact hexes inside the registers (ground #131011/#171314/#1A1512; ivory #E8E2D6/#EDE6D8/#E4DDCE; foil endpoints within #C7A87B–#E9DCBE).
- The display face within the register: Marcellus or Gloock — one per site.
- THE FILM NOUN that drives the page — la braise, la table, l'heure bleue, la brume, la cendre — it names the hero picture, the générique's scenes, the captions and the copy's spine.
- WHICH subjects are photographed (the client's actual room, dishes, hands, façade) and the showpiece choreography chosen from the générique family.
- Section order beyond the fixed opening and closing; which gestes are played; the language and currency.
A GÉNÉRIQUE page without its film noun is a failure: name it FIRST, then let it cast the photographs, write the captions and cut the sequence.

## The vibe (voice)
A voice-over, not a brochure: short declarative lines that trust the reader, written like intertitles. The house counts real things — tables, degrees, hours, bottles — and never praises itself: the words 'luxury', 'exclusive', 'indulge', 'elevate' and 'unforgettable' are BANNED (claiming luxury is what plated pages do). Prices are stated whole and calm. No exclamation marks, no questions, no 'discover'. Register examples (demo language English):
- 'Dinner begins when the city lights do.'
- 'Fourteen tables. One fire. The night writes the menu.'
- 'AED 780 — five courses, counted by the kitchen.'
One honest hospitality line near the contact ('We confirm every reservation by phone before 18:00.' register).

## Visual signatures
- THE LETTERBOX (owned tic): every photograph sits between HARD black bars in the #050404–#080606 register — no gradient, no soft edge. Framed stills: aspect-ratio 21/9 with 12–18px bars top and bottom inside a frame whose background is the bar black. Full-bleed scenes: viewport-wide picture between bars of height clamp(20px, 6vh, 52px). The bars are always darker than the page ground so the letterbox reads as a harder black than the night around it. The header LIVES INSIDE the hero's top bar (wordmark left, one action right) — chrome is projection-room furniture, never a floating nav.
- CHAMPAGNE FOIL SMALL-CAPS (owned tic): names, prices and act labels set in the display serif, uppercase, tracking +0.14–0.22em, filled with linear-gradient(105deg, #C7A87B 0%, #E9DCBE 45%, #C7A87B 80%) via background-clip: text. Budget: at most 2 foil elements per viewport. Foil NEVER fills a surface, border, rule, button or icon — it is metal leaf pressed into letters, nothing else. On the hero name the gradient may drift (background-size 200%, background-position eased over 8–12s); elsewhere it holds still.
- KEN-BURNS + CAPTION (owned tic): full-bleed photographs are never static — they zoom scale 1.00 → 1.08–1.14 and/or pan up to 6% (scrubbed in the showpiece, or a 14–22s sine.inOut yoyo drift elsewhere) — and every full-bleed carries a bottom-left caption: body face, 0.66–0.72rem, +0.14em tracking, ivory at 55%, format 'Place — detail' ('The hearth — acacia charcoal, 340°C'), 60 characters max.
- THE CREDIT LINE: people and facts are typeset like film credits — a smoke small-caps role line (0.68rem, +0.18em) above an ivory name/value line; used for staff, practical facts and the footer. Stacked credit pairs, never bio cards.
- HAIRLINES ONLY: 1px rules in ivory at 12–18% opacity are the only borders on the page; every corner consumes var(--radius) directly — this world's radius is zero, everywhere (2px absolute max on form fields); zero box-shadows — darkness needs no shadow.
- THE DIALOGUE LINE: between scenes, one sentence set alone in the display face at clamp(1.5rem, 3vw, 2.5rem), sentence case (the only non-caps display use), line-height 1.4, max 24ch — a line of dialogue, not a heading.
- GRAIN IN THE FRAME: 35mm grain (SVG feTurbulence, baseFrequency 0.9, opacity 0.05–0.08) lives INSIDE letterbox frames only — the film has grain, the theater does not. Never a full-page grain wash.

## Color physics
- GROUND: the warm-black register — #131011 / #171314 / #1A1512. Warm, red-brown undertone; NEVER blue-black (that velvet is ORFÈVRE's), never pure #000 as a page ground. Adjacent sections alternate two grounds 3–5 RGB points apart (#131011 vs #171314): the eye feels the cut without seeing a stripe.
- BARS: #050404–#080606 — always measurably darker than the ground; the letterbox must read as the hardest black on the page.
- INK: ivory #E8E2D6 register (#EDE6D8 / #E4DDCE); body text at 90–92% opacity; pure #FFFFFF never appears.
- SMOKE: #6B625A register for secondary text, credit roles and de-emphasis; captions are ivory at 50–60% opacity, not smoke.
- CHAMPAGNE FOIL: the #C7A87B → #E9DCBE gradient — text fill ONLY, ≤2 elements per viewport, the page's only gradient outside the photographs. Hover may drift its background-position; it never changes hue.
- Gradients as section washes are FORBIDDEN. Light lives inside the photographs. One radial vignette (transparent center → rgba(0,0,0,.45) edges) is allowed INSIDE a letterbox frame to seat a bright picture into the night.
- Success is ivory (the calm answer); error #A65B4B — muted ember, never bright red.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · CHAMPAGNE FOIL→--primary · GROUND→--primary-foreground · alternate GROUND step→--secondary · BARS→--accent · SMOKE→--muted · ivory at 15%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, glint or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: Marcellus or Gloock — ONE per site, weight 400 ONLY. The world never goes bold and never italic; emphasis is scale, foil, or nothing. Display sets uppercase with tracking that widens as size shrinks: hero name clamp(3.4rem, 9vw, 7.5rem) at +0.08–0.12em; section titles clamp(1.9rem, 3.6vw, 3.1rem) at +0.12–0.16em; labels 0.66–0.74rem at +0.18–0.22em. Line-height 1.04–1.1 for caps settings.
- BODY: Questrial 400 or Hanken Grotesk 300–400. 0.95–1.05rem, line-height 1.7–1.8, max 52ch, ragged right. Long paragraphs never center.
- CAPTIONS & LABELS: the body face, uppercase, 0.66–0.74rem, +0.14–0.2em tracking. Captions sentence-cased ('The terrace — 2 a.m.') as the one lowercase micro register.
- PRICES & NUMERALS: the display face in champagne foil small-caps ('AED 780'), currency and figure kept together; no tabular-mono, no superscripts.
- ARABIC PAIRING (this world serves Gulf and Maghreb clients): display pairs with Amiri 400, body with IBM Plex Sans Arabic 300–400. Letter-spacing laws are SUSPENDED for Arabic script (never track Arabic); the foil budget, caption law and letterbox law hold unchanged; mirror caption position to bottom-right in RTL.

## Signature art — the photographic law (imagery system)
GÉNÉRIQUE is a PHOTOGRAPHIC world. Production builds use client photography or generated imagery — always selected, cropped and graded to this law; a photograph that cannot meet the grade is cut, not fixed with an overlay.
- SUBJECTS: plated dishes, candlelit tables, brass and glass details, hands at work, architectural fragments, the night view — fragments and moments, never posed staff, never wide bright rooms, never faces looking at camera.
- LIGHT: ONE warm tungsten key from the side; deep true-black shadows that swallow the frame's edges; faint smoke or steam allowed in the beam. No fill light, no daylight, no flash-even lighting.
- GRADE: warm blacks, champagne-gold highlights, muted saturation, 35mm film grain. Unify client photos with CSS: filter: contrast(1.06) saturate(0.85) sepia(0.12) brightness(0.94), plus the in-frame grain overlay at 0.05–0.08 opacity.
- FRAMING: 21:9 letterbox composition, generous negative space, subject off-center on a third; the darkness inside the frame is part of the composition.
- GENERATION art-direction phrase, reused VERBATIM in every prompt: 'low-key cinematic photograph, single warm tungsten key light from the left, deep black shadows, faint smoke, champagne-gold highlights, 35mm film grain, wide 21:9 composition, generous negative space'.
- NO-ASSET FALLBACK (demos and drafts only): letterboxed 'tableaux' built in CSS/SVG in the same grade — a warm-black base, one radial tungsten pool (rgba of the foil register at 14–30% alpha) from one side, subjects as flat near-black silhouettes (#0A0707–#241C16) against the lit zone, 1px champagne glint strokes where glass or metal catches the key, blurred smoke ellipses at ≤12% alpha, grain on top, the same caption. Tableaux obey every photographic law (one key, off-center subject, 21:9). Each carries role='img' and a real aria-label. Production always upgrades tableaux to photographs.

## Components
- BUTTONS: rectangles, radius 0. Primary: solid ivory fill, warm-black text, small-caps +0.18em, padding 1.05rem 2.6rem; hover/focus dims the fill to #D9D2C2 over 0.3s. Ghost: 1px ivory-18% border, ivory text; hover/focus raises the border to 45% and fills ivory at 6%. Foil never touches a button.
- LINKS: smoke, no underline at rest; on hover/focus the text turns ivory and a 1px ivory underline draws left→right in 0.35s. :focus-visible carries the same state plus a 1px #E9DCBE outline offset 4px.
- FORMS (the reservation scene): fields are bare bottom-hairline inputs — border-bottom 1px ivory-15%, background transparent, ivory text, radius 0; labels above in smoke small-caps 0.7rem; focus lifts the hairline to ivory-70% (never foil — the budget). Phone-first: tel input immediately after the name; selects styled dark with a small inline-SVG chevron. Submit is the primary button. Success state is honest and typeset as a credit: 'Your request is with the maître d'. We confirm by phone before 18:00.' On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields FLAT in detail ({ name, phone, date, guests, note }), plus one off-canvas decoy input with data-wandit-hp (position absolute off-screen, tabindex -1, aria-hidden) that the page's own script NEVER reads or writes.
- CARDS: none — content sits on darkness, separated by space and hairlines; a framed still plus caption plus credit lines replaces every card.
- ::selection — champagne on warm black (background #C7A87B, color #131011). Favicon: inline SVG data URI — warm-black square, two hard-black bars with 1px champagne edge lines, one champagne dot between (the key light in the letterbox).

## Page chassis
- FIXED OPENING — the cold open: a full-viewport (100svh) scene between viewport letterbox bars; the header lives inside the top bar (wordmark small-caps left, one reserve/contact action right); the bottom bar carries a small 'scroll' cue. On the picture: the name in champagne foil plus at most one label and one caption — NEVER a paragraph in the hero. The hero composition (name centered / lower-left / in the bar) is client-owned; the bars, the caption and the foil name are law.
- FIXED CLOSING: the reservation scene (form as specified, split with practical credit lines and one small framed still), then LE CARTON DE FIN — an ending card, not a mega-footer: small foil wordmark or 'FIN', 2–4 credit micro-lines (address, phone, hours), one hairline, the legal line. Nothing else.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike:
  · LE GÉNÉRIQUE — the pinned scrubbed title sequence (mandatory, exactly one, choreography from the gestes).
  · LES ACTES — alternating still/text rows (grid 1.1fr/0.9fr, mirrored row to row), each with a foil act label, a dialogue-scale title and a ≤50ch paragraph.
  · L'INTERLUDE — one full-bleed scene with a single dialogue line and its caption; drifting, never scrubbed.
  · LA FICHE TECHNIQUE — a centered end-credit table, max 560px wide, ONE continuous block (never stretched across viewports): smoke role left, ivory value right, hairlines between rows; foil on the prices only — the ≤2-per-viewport budget governs the table, other numerals set ivory.
  · LE MONOLOGUE — a text-only scene: small label, one large dialogue statement with ONE foil word, a narrow smoke paragraph offset off-axis.
  · LA PELLICULE — a strip of 3–4 framed 21:9 stills with captions, laid as an off-set filmstrip (never a uniform grid).
- RHYTHM: section padding clamp(6rem, 14vh, 10rem); content column max 1200px; text measures max 52ch; full-bleeds bleed edge to edge. Sections CUT — the ground alternation is the only transition.

## Motion identity (GSAP 3 + ScrollTrigger, cdnjs UMD)
GOVERNING LAW: gate ALL motion on (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches). Hidden states are set ONLY by gsap.set — never opacity:0 in CSS. JS dead = a complete, lit, composed page.
- PERSONALITY: cinematic slow drifts + Ken-Burns scrubs. Nothing on this page moves fast: minimum tween 0.9s (hovers 0.25–0.4s exempt); easings power2.out for entrances, power2.inOut for bar moves and crossfades, sine.inOut for drifts, ease:'none' on scrubs (scrub: 1). Overshoot, elastic and bounce easings NEVER.
- ENTRANCES: fade-through-black — text groups rise ≤30px over 1.2–1.6s with 120–180ms staggers; framed stills develop inside their bars (inner layer autoAlpha 0 → 1, scale 1.08 → 1, 1.8s); the hero name settles its letter-spacing from +0.3em to its resting track over 1.6s.
- DRIFTS: every full-bleed breathes — scale 1 ↔ 1.07, 14–22s, sine.inOut, yoyo, infinite. The drift never pauses on hover.
- THE SHOWPIECE — one pinned sequence of the générique family (pin 100svh, end +=260–320%, scrub: 1): 2–4 scenes; per scene a Ken-Burns zoom (scale 1 → 1.10–1.16, ease none) while 2–3 credit lines fade through (each in ~10% of the scene's beat, hold, out), the scene's caption living bottom-left; between scenes the letterbox bars CLOSE to meet at center (scaleY toward 1 of a 50.5vh bar, power2.inOut), the scene swaps under cover, the bars reopen. Choreography variants live in the gestes; ONE per page, always the page's held breath.
- HOVERS: 0.25–0.4s — link underline draws, button fill dims, focus states identical; keyboard/touch parity on every hover interaction; stills do not react to hover.
- REDUCED MOTION: composed stills — bars open, first frames composed with captions and credits visible, zero loops, zero pins.

## Générique ban list (in addition to the global list)
- Gold hairline engravings that draw themselves, filigree corner flourishes, the gilded page-edge line — that is ORFÈVRE's language (the drawn dark sibling; GÉNÉRIQUE never line-draws an object).
- Sunburst/fan crowns, ziggurat frames, chevron-and-gem dividers — that is FOLIES.
- Generative/shader surfaces, machine-telemetry voice, glyph-scramble links, crossing marquees — that is CINÉTIQUE.
- Constellation maps, orbital diagrams, astronomical small-caps captions — that is OBSERVATOIRE (GÉNÉRIQUE's night is photographed, never charted).
- White-void composition, floating micro-caps labels on bare ground, the centered plumb line — that is ÉCRIN.
- Arch geometry, drawn room miniatures, material swatch cabinets — that is MATIÈRE.
- Neon glow, glowing borders, backdrop-blur glass — that is VOLTAGE's; blur exists in GÉNÉRIQUE only as depth-of-field INSIDE a photograph.
- Pure #000 page ground, pure #FFF text, cool/blue grading, daylight photography, flash-even lighting, smiling-staff stock imagery.
- Foil on surfaces, borders, buttons, rules or icons; more than 2 foil elements per viewport.
- Box shadows, glassmorphism, border-radius above 2px, card chrome of any kind.
- Italic anywhere; bold display; a second display weight; letter-spaced Arabic.
- Naked (unbarred) images, portrait crops, image collages or masonry galleries.
- Any tween under 0.9s except hovers; back/elastic/bounce easings; parallax deeper than 6%.
- Section dividers, shape transitions, ornament rows — scenes CUT.
- Fake urgency, countdowns — the night is not in a hurry.

## LES GESTES (moves menu)
- L'OUVERTURE À FROID — hero: full-bleed scene between viewport bars, foil name in the lower-left third above its caption, header in the top bar.
- LE CARTON-TITRE — hero: a hard-black viewport with ONLY the centered foil name and one smoke line; the first photograph waits below the fold and develops as it enters. For houses whose name carries everything.
- LE NOM DANS LA BARRE — hero: the full-bleed picture runs clean; the name sits INSIDE the bottom letterbox bar, small caps foil, left-aligned — the title printed on the film's edge.
- LE GÉNÉRIQUE — showpiece: the canonical title sequence — 2–4 scenes, Ken-Burns zoom per scene, credit lines fading through, bars closing and reopening between scenes.
- LA TOMBÉE DE LA NUIT — showpiece: ONE full-bleed scene graded from dusk to night on scrub (filter brightness 1.15 → 0.9, sepia easing off, the page ground deepening one register step in sync); credit lines mark the hours ('19:00 — doors', '02:00 — last pour').
- LA PELLICULE SCRUBBÉE — showpiece: a horizontal filmstrip of 4–6 framed stills pans on scrub (x-translate inside an overflow-clipped stage), each frame's caption lighting as it crosses center.
- LE PANORAMIQUE — showpiece: one continuous ultra-wide (≥32:9) scene pans slowly across the viewport on scrub, its caption rewriting at 2–3 waypoints — a single take.
- LA PROFONDEUR DE CHAMP — showpiece: one framed scene racks focus on scrub — two stacked crops of the same subject swap blur (filter blur 0 ↔ 6px) and opacity while a dialogue line trades places with a credit line.
- LA CHAMBRE NOIRE — showpiece: a framed print DEVELOPS on scrub — brightness 0.1 → 0.94 and contrast rising to grade, the caption fading in last, like paper in the developer tray.
- LE CHAMP-CONTRECHAMP — section or showpiece: two framed stills face each other across the spread, offset vertically, a dialogue line between them; scrubbed, they alternate presence like conversation cuts.
- LE MONOLOGUE — section: no image; one dialogue statement at clamp(1.6rem, 3.2vw, 2.6rem) with a single foil word, a 40ch smoke paragraph hung off-axis beneath it.
- L'AMORCE — micro: on hover/focus of a link or credit, a second caption line reveals beneath the first (0.3s fade, keyboard parity).
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- SABLE (rooftop fine dining, Dubai — la braise): hero plays L'OUVERTURE À FROID — a terrace-edge table against the lit skyline, foil name lower-left over its caption. Showpiece: LE GÉNÉRIQUE in three scenes — hearth, plate, skyline — credits counting the dinner's acts, bars closing between. Middle: LES ACTES for the tasting menu, LE MONOLOGUE, LA FICHE TECHNIQUE. Mood: ember and glass.
- MAISON NOIR (boutique hotel, Marrakech — la lanterne): hero plays LE CARTON-TITRE — black card, centered foil wordmark, one smoke line ('Nine rooms around a courtyard'); the courtyard picture develops below the fold. Showpiece: LA TOMBÉE DE LA NUIT — the courtyard grades from dusk to lantern-lit night as credits mark the hours. Middle: LA PELLICULE of rooms, LA FICHE TECHNIQUE. Mood: lantern light on zellige kept strictly photographic.
- L'HEURE BLEUE (jewelry brand, Paris — la vitrine): hero is a split screen — a 40% black panel left carrying the name stacked one word per line in foil, a still of a single piece under the key light right. Showpiece: LA PELLICULE SCRUBBÉE — the collection pans as a filmstrip, each piece's name and price lighting in foil at center. Middle: LE MONOLOGUE on the atelier, LE CHAMP-CONTRECHAMP of hand and clasp. Mood: midnight vitrine, metal catching one lamp.
- BRUME (spa & hammam, Geneva — la vapeur): hero floats ONE framed 21:9 still centered in darkness — steam in a tungsten beam — with the name ABOVE the frame and the caption below it. Showpiece: LE PANORAMIQUE — a single ultra-wide of the pool hall pans slowly, its caption rewriting at three waypoints. Middle: LES ACTES as rituals, LA FICHE TECHNIQUE of durations and prices. Mood: steam, stone, held breath.
- VESPER (cocktail bar & venue, London — le comptoir): hero plays LE CHAMP-CONTRECHAMP as an opening — two offset stills (a pour; a face-lit glass) with the foil name set on the diagonal between them. Showpiece: LA PROFONDEUR DE CHAMP — one frame racks focus between the bottle wall and a finished drink while the dialogue swaps. Middle: LE MONOLOGUE on the list, LA PELLICULE of four signatures with prices in foil. Mood: late amber, conversation-level quiet.
- CENDRE (photographer's portfolio, Beirut — la cendre): hero is a near-black viewport with the giant foil name in the top-left and ONE small framed still anchored bottom-right — the photographer's mark, then the work. Showpiece: LA CHAMBRE NOIRE — the signature print develops from black on scrub, caption arriving last. Middle: LA PELLICULE as contact strip, LE MONOLOGUE on method, LA FICHE TECHNIQUE of commissions. Mood: ash silver, developer-tray patience.
- VILLA ONYX (single property showcase, Mykonos — la lune): hero plays LE NOM DANS LA BARRE — the night façade and pool run clean full-bleed; the name sits printed inside the bottom letterbox bar. Showpiece: LE CHAMP-CONTRECHAMP scrubbed — interior and exterior stills alternating presence as dialogue lines trade sides, ending on the pool at moonrise. Middle: LES ACTES as the villa's three levels, LA FICHE TECHNIQUE of capacities and rates. Mood: moonlit stone above dark water.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
GÉNÉRIQUE lives or dies on THREE things at 100%. First, the GRADE: one warm key, true blacks, champagne highlights — a single flat-lit or cool-graded picture breaks the film, and no overlay can save it; cut it instead. Second, the LETTERBOX LAW: every image barred, bars harder than the night, 21:9 without exception — one naked rectangle image and the page becomes a dark template. Third, RESTRAINT: the foil budget held to 2 per viewport and the slowness held above 0.9s — the moment gold spreads or motion hurries, the cinema collapses into a nightclub flyer. The cheap details that separate GÉNÉRIQUE from a generated dark theme cost almost nothing: the bottom-left captions, the credit-line typography, the grain inside the frames, the ground alternation between scenes, the header living in the top bar, the 'FIN' card instead of a footer. When in doubt, remove one element and let the darkness hold the frame — emptiness is this world's production value.`,
	energy: "quiet",
	family: "dark-luxury",
	// orfevre: the engraving meets the photograph — one maison, two nights.
	// folies: the gilded night photographed — luxury hospitality.
	fusesWith: ["orfevre", "folies"],
	id: "generique",
	industries: [
		"fine dining",
		"restaurant (classic)",
		"hotel",
		"single property showcase",
		"property developer / promoteur",
		"real estate agency",
		"aesthetic clinic",
		"spa / hammam",
		"jewelry brand",
		"fashion boutique",
		"photographer",
		"videographer / production",
		"venue / salle des fêtes",
		"event planner",
		"vacation rentals",
		"cosmetics brand",
	],
	kind: "website",
	mood: ["cinematic", "hushed", "nocturnal", "opulent"],
	name: "Générique",
	priceFeel: "premium",
	tagline:
		"Le générique de nuit: photographie letterboxée, chuchotements champagne.",
	preview: {
		accent: "#C7A87B",
		fontFamily: "Marcellus",
		ground: "#131011",
		ink: "#E8E2D6",
		sampleWord: "Minuit",
	},
};
