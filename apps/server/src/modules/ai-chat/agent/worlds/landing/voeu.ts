import type { DesignWorld } from "../types";

/**
 * VOEU — the blush wedding atelier.
 * Popular wave III (batch 10). Photographic, still, stationery-logic:
 * blush ivory ground, rosewood ink, one rose accent, gold reserved for
 * hairlines only. Owns the script overlay word crossing a photo's edge,
 * the RSVP reply-card block, and the petal drift.
 * Values below are measured from the shipped demo (Le Vœu, Alger).
 * fusesWith: eclat (warm skin-tone photography for the getting-ready story),
 * poudre (bridal beauty rituals in a cooler register), domaine (the venue /
 * estate half of a wedding brief).
 */
export const voeu: DesignWorld = {
	id: "voeu",
	name: "Vœu",
	family: "romantic-celebration",
	tagline: "Ivoire, rose, un filet d'or : le mariage écrit à la main.",
	kind: "website",
	mood: ["romantic", "hushed", "bridal", "photographic", "ceremonial"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"wedding services",
		"event planner",
		"venue / salle des fêtes",
		"photographer (events)",
		"rental (chairs, decor, sound)",
		"DJ / entertainment",
		"photographer",
		"videographer / production",
		"makeup artist",
		"jewelry brand",
	],
	avoidFor: [
		"construction",
		"general contractor",
		"tech-saas",
		"SaaS product",
		"IT services / agency",
		"lawyer / law firm",
		"notary",
		"gym / fitness club",
		"car dealer",
		"spare parts",
		"security company",
		"moving company",
	],
	fusesWith: ["eclat", "poudre", "domaine"],
	preview: {
		ground: "#FAF3EE",
		ink: "#57383E",
		accent: "#C98A8E",
		fontFamily: "Gilda Display",
		sampleWord: "Le Vœu",
	},
	doc: `# DESIGN WORLD: VOEU — the blush wedding atelier

## Philosophy
This page is a WEDDING INVITATION SUITE OPENED FLAT ON A LINEN TABLE, not a website. Everything obeys stationery logic: a mounted photograph, an engraved hairline margin, a tracked capital hung on a rule, a price on leader dots, a reply card you fill in and send back. First structural fact: PHOTOGRAPHY DOES THE EMOTION, TYPE DOES THE WORK — wedding editorial images in one warm grade, type BESIDE them or on a quiet plate, never dimmed-overlay-centred on top. Second: GOLD IS A LINE, NEVER A FILL — every gold moment is 1px wide. Third: ONE SCRIPT WORD PER VIEWPORT, half-hanging off a photograph's edge onto the ground like a name written across a photo corner in ink.

Restraint is the whole trick. The genre fails by sugar: candy pink, bouncing hearts, glitter, three script fonts, a slideshow. VOEU fails INSTEAD by being too still — the correct failure. Nothing bounces, overshoots or pulses; the page breathes at 1.2s. Structurally impossible here: cheap-romantic (rosewood + ivory, not fuchsia + white); illustration-carried (photography or nothing); gold blocks or buttons; a script face setting a sentence.

Self-audit before shipping — count them:
1. Exactly one \`<h1>\`; every photograph carries its own \`<figcaption>\`.
2. Zero gold FILLS — the gold hex appears only on \`border\`, 1px rule \`background\`, \`stroke\`, \`border-bottom: dotted\`.
3. Script instances ≤ 4, never two in one viewport, one word each; ≤ 7 petals on screen, all \`aria-hidden\`, none over body copy or a photograph.
4. One scrubbed showpiece, never parked as a blank plate at a resting scroll position.
5. Ground B used EXACTLY twice, never twice in the last three sections; the double hairline only on reply-card objects, never around a section label.

## The variation contract (why two VOEU sites are siblings, not clones)
WORLD LAW — never renegotiated:
- Photographic imagery only, one mask geometry: square-cornered rectangles (0–2px) with the gold hairline engraved 13px inside the image. No arches, ovals, rounded masks or torn edges.
- Blush-ivory ground family; rosewood ink; ONE rose accent; gold as 1px line only.
- Gilda-register display serif, never italic; ONE script accent word per viewport; a plain humanist sans for body.
- The RSVP reply-card block, the petal drift and the script-across-the-edge word. All three, visibly. Labels always hung on a 34px gold hairline, never bare.
- Veil-lift motion, 1.2s sine. Nothing bounces, overshoots, glows or pulses.
CLIENT-OWNED — where siblings diverge:
- The exact hexes inside the register: ground #FAF3EE / #FBF5F1 / #F9F1EC; liner #F4E8E4 / #F1E4E4 / #EFE6DF; ink #57383E / #4E343C / #5C4038; rose #C98A8E / #C08187 / #D19A9A; gold #B99B6B / #B08F5F / #C0A67A.
- The display face within the register: Gilda Display, Cormorant Upright, Radley (Prata and Marcellus are taken).
- THE VOW NOUN driving the page — le vœu, la promesse, le serment, l'attente, le premier jour.
- The scenes photographed (florals-led vs table-led vs stationery-led), the section order between the fixed opening and closing, which formule is chosen, whether the middle carries a dusk band or a second planche.
A VOEU page with no vow noun is a failure: name it first, then let it name the hero line, the script word, the quote and the closing.

## The vibe (voice)
Warm, exact, unsentimental French. This world sells CALM, not romance — the romance is in the photographs, so the words stay practical. Short declaratives. Real numbers. One honest limit said out loud. No superlatives, no exclamation marks, no "le plus beau jour de votre vie". Shipped lines:
- « Un mariage ne s'improvise pas. Il s'écrit. »
- « Nous commençons entre neuf et douze mois avant la date. Moins, c'est possible ; plus cher, souvent. »
- « Un seul mariage par week-end. Toujours. »
Social proof: ONE static client quote in the display serif on the deep ground, name-and-month attribution. Never a carousel, never stars.

## Visual signatures (measured)
- **THE SCRIPT OVERLAY WORD (owned tic).** One Pinyon word per viewport, half on a photograph and half on the ground — crossing the photo's TOP edge (\`top:0; translateY(-38%)\`) or LEFT edge (\`left:0; translateX(-34%)\`). Never overhang past 40%: Pinyon's box is mostly air, and beyond that the ink stops touching the image. Hero \`clamp(4rem,8vw,7rem)\`, secondary \`clamp(2.2rem,4vw,3.4rem)\`, in rose. Legibility comes from a ground-coloured halo, never a box: \`text-shadow: 0 1px 7px rgba(ground,.9), 0 0 20px rgba(ground,.72)\`.
- **THE RSVP REPLY-CARD BLOCK (owned tic).** A mount-white card (#FDF8F5) on ground A (the liner is spent on the portfolio and the pricing) with a DOUBLE HAIRLINE: two 1px gold rules 5–6px apart (outer border + \`::before{inset:6px}\`), a DISPLAY-face ampersand in rose (\`clamp(3rem,5.4vw,4.4rem)\`) centred above the label, underline-only fields. The double hairline is for reply-card objects only.
- **THE PETAL DRIFT (owned tic).** 30px SVG petals — one asymmetric path in the ROSE plus a 1px ivory vein — at \`opacity:.36\`, ≤7 on screen, \`aria-hidden\`, drifting 150–290px down with +70–160° rotation on scrub 1.1. PAGE GUTTERS only: \`left\` 0.4–1.6% or 95–96.5%, which clears the 1280px content column at every width. Child of the section, never of a padded container; suppressed below 900px. A petal on a photograph reads as a compression artefact.
- **THE ENGRAVED MARGIN.** EVERY photograph carries \`::after{inset:13px; border:1px solid gold@62%}\` — a rule printed inside the image, the way a plate is ruled on invitation stock. No exception: the full-bleed band photograph is ruled like the grid ones. The mask signature; crop corners stay square (0–2px).
- **THE LABEL ON A RULE.** Tracked caps 11px/700/.24em, ink 56%, preceded by a 34px gold hairline (\`gap:14px\`); centred variants get a rule both sides. Never bare.
- **LEADER DOTS.** Any row pairing a name with a value is joined by \`border-bottom: 1px dotted gold\` offset \`translateY(-.34em)\` — the order-of-service device.
- **THE MONOGRAM BREAK.** A full-width gold hairline interrupted at centre by initials in Pinyon (\`clamp(2rem,3.4vw,2.9rem)\`), the halves as \`::before/::after\`. Letters only; never a gem or chevron.
- **THE DEEP PANEL.** One full-bleed band: rosewood panel (38–42%) against a photograph (58–62%), quote in ivory display serif, gold rule, caps attribution. The footer is the second and last deep ground.

## Color physics
- GROUND A — blush ivory, the #FAF3EE / #FBF5F1 / #F9F1EC register; dominant, 6 of 8 sections.
- GROUND B — the envelope liner, #F4E8E4 / #F1E4E4 register, 4–8 RGB points deeper. It appears TWICE and only twice, to set the portfolio and the pricing apart — never as an A/B metronome (two-ground alternation as the section rhythm is MATIÈRE's and is banned here), and never twice inside the last three sections. Count them: three is already a metronome.
- MOUNT — #FDF8F5, one step brighter than ground A, for card objects only (cartons, the reply card): paper laid on paper.
- INK — rosewood #57383E / #4E343C / #5C4038, never black or grey. Alphas: body .74, secondary .56, hairlines .13.
- ROSE (accent) — #C98A8E, pressed #B4757A. Budget: the script words, the primary CTA fill, ONE hero clause, the process numerals, one caps fact per service column, the monogram, focus states. Past seven places, cut.
- GOLD — #B99B6B at 62% for structural rules, 38% for quiet dividers. HAIRLINES AND RULES ONLY: borders, 1px backgrounds, SVG strokes, dotted leaders. A gold fill, button, type or gradient fails this world — including the fill on a drawn petal.

FIXED TOKEN MAP — GROUND A→--background · INK→--foreground · ROSE→--primary · MOUNT→--primary-foreground · GROUND B→--secondary · GOLD→--accent · ink at 56%→--muted · ink at 13%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, halo or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Gradients: none. The only tonal transitions on the page are inside the photographs.
- Photographic grade (LAW): \`filter: brightness(1.02) saturate(0.95)\` on every image, so florals, linen, gold and candlelight sit in one blush envelope. THE WARM-PAIR CORRECTION: a shot list rarely returns at one temperature. Append \`sepia(0.07)\` to that filter on the cool frames only (stone-grey, neutral-cream, sage). Two grade values, never three, and only to close a temperature gap — if a viewer can see two shoots, the page stops being one wedding.

## Typography system
- DISPLAY: Gilda Display (register: Gilda Display · Cormorant Upright · Radley). Weight 400 only. NEVER italic; emphasis is the rose or nothing. Hero \`clamp(2.75rem,6.6vw,5.6rem)\`/1.06, tracking -0.004em. Section titles \`clamp(2.05rem,4.3vw,3.55rem)\`, sub-heads \`clamp(1.4rem,2vw,1.85rem)\`, footer monument \`clamp(3.4rem,9.6vw,7.6rem)\`. Never above 10vw — fit-to-viewport is AFFICHE's, words-as-structure MANIFESTE's.
- SCRIPT ACCENT: Pinyon Script 400, rose, line-height .9. ONE WORD per viewport, four instances per page at most. Never a sentence, label, button, price or caption.
- BODY: Lato 300/400/700 (Karla is domaine's, Mulish onde's; else Hind). \`clamp(1rem,.96rem + .18vw,1.075rem)\`/1.76, max 56ch ledes, 60ch body.
- LABELS: body face 700, caps, 11px, +0.24em, always on a gold rule. CAPTIONS: 10.5px/700/+0.17em caps, ink 56%, on a 22px gold rule, line-height 1.7.
- NUMERALS: prices and step numbers take the DISPLAY face; the currency suffix is body caps 12px/.15em in rose, raised \`vertical-align:.55em\`. No tabular mono — this world does not speak machine.
- ARABIC PAIRING: body and labels in Noto Kufi Arabic or Almarai at the same optical size, the display line in Aref Ruqaa. The script word has no Arabic equivalent — drop it and let the monogram break carry the tic. Never simulate script Arabic with a Latin cursive.

## Signature art / components (photographic art direction is the imagery system)
- SHOT LIST: a florals hero (portrait), a table setting (wide), a stationery flat-lay (portrait), a macro (rings, wax seal, ribbon), a candlelight dusk wide. One shared phrase for every generation: "romantic wedding editorial photography, soft blush and ivory tones, golden natural light, florals and fine table settings, no people, no text". No faces, crowds, confetti or sparklers.
- CROP LAW: portrait 3/4 or 4/5, wide 16/9, macro 1/1. One image per page may bleed to a viewport edge (the hero); the rest sit on the grid. Never 21:9 letterbox or Ken-Burns (generique's), photo-inside-type (elan's) or type colliding over the image (silhouette's).
- CAPTION LAW: EVERY photograph gets a real \`<figcaption>\` in the caption style — portfolio frames carry first names, venue, guest count, month; other frames subject and place. A body paragraph beside an image is NOT a caption: a frame needing a paragraph gets both. Captions are content; they make a portfolio read as real work.
- BUTTONS: corners use min(var(--radius), 0px) — invitation stock is cut square, never rounded. Primary = rose fill, \`#FFF9F6\` text, 19px 34px, 12.5px/700/+0.17em caps, hover deepens to the pressed rose over 0.3s. Ghost = transparent, 1px gold border, ink text, hover swaps both to rose. No shadows or lifts.
- CARTONS: mount ground, 1px gold border, 0 radius, 28–44px padding, a hairline-ruled list, a gold-underlined text link at the foot. The CHOSEN carton gets the reply-card double hairline, a −18 to −34px top offset, and a rose caps flag straddling its top edge. Below 900px the offset collapses to 0 and the cartons keep their printed order — never reorder numbered cartons: II → I → III reads as a bug.
- FORMS: underline-only fields — transparent, \`border-bottom: 1px solid gold@62%\`, 0 radius, focus turns the underline rose; labels above in tracked caps. Phone is \`type="tel" inputmode="tel"\` and sits second; selects for structured choices. One hairline per zone — never rule the form's foot as well; two near-parallel hairlines 40–50px apart read as an accident. On valid submit dispatch \`new CustomEvent("wandit:lead", { detail })\` on \`document\` with the fields flat in \`detail\` plus a \`source\` string, then swap the form for an honest success state — monogram, "Carte reçue.", the callback window, the phone number. One off-canvas decoy input carries \`data-wandit-hp\` (\`left:-9999px\`), never read by the page's own script.
- FAVICON: inline SVG data URI — a rose petal in the accent on the ground over a 1px gold rule.

## Page chassis
- Container 1280px; inset \`--pad: clamp(20px,5vw,68px)\`; rhythm \`--rhythm: clamp(3.6rem,6.4vw,6.4rem)\`. Full-bleed bands carry their own padding and no section rhythm — the band IS the rhythm break. The hero is full width but lands on the container axis: \`padding-left: calc(var(--pad) + max(0px,(100% - 1280px)/2))\`.
- FIXED OPENING (hero law): a static header (wordmark left, tracked-caps nav + phone right, ink hairline under) above an asymmetric split — never 1fr 1fr. Type column 1.1fr: label on a rule → \`<h1>\` in three short lines with one rose clause → lede ≤46ch → two CTAs → three facts on ink hairlines. Photo column 0.9fr, bleeding off the right edge, \`clamp(420px,70vh,660px)\` tall, engraved margin, one-line caption, the script word crossing it.
- FIXED CLOSING: the RSVP reply card (the showpiece) on ground A — the mount card and its drawn gold ring carry the separation — then the deep rosewood footer: wordmark as a monument at \`clamp(3.4rem,9.6vw,7.6rem)\` over a gold rule, three columns (atelier / joindre / rendez-vous), a caps legal line.
- FREE MIDDLE — compose 4–6, never two adjacent alike:
  1. **Colonnes filetées** — 2–4 services in UNEQUAL columns (1.22 / 0.92 / 0.86fr) on FULL-HEIGHT gold rules; the widest is a LEAD column one size up (\`clamp(1.7rem,2.7vw,2.5rem)\` head, 1.06rem body), and each closes on a rose caps fact pushed to a shared baseline (\`margin-top:auto\`) so the hairlines line up into one broken rule. Keep the scale change in the TYPE — a photograph in one column out-talls the others and opens a void. Never icon cards.
  2. **La planche** — the staggered portfolio grid: tall portrait offset down 96px left, wide landscape top-right, square + note beneath.
  3. **Le bandeau du soir** — the deep panel/photograph split carrying the client quote.
  4. **Le déroulé** — a sticky left column against leader-dot process rows.
  5. **Le pli** — photograph left, a vertical gold rule as the fold, a leader-dot price list right, a monogram break closing. **Les cartons** close the middle: 3 price cartons on the liner ground, the chosen one lifted and double-ruled.
- Rhythm inside a section: head → \`clamp(40px,5vw,72px)\` → body grid. Nothing is centred but the reply card.

## Motion identity — VEIL LIFT
Gate everything on \`(window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches)\`. NEVER hide anything in CSS — only \`gsap.set()\` hides. With the CDN dead the page is composed: every rule drawn, every field visible, petals in a believable scatter.
- ENTRANCES (the veil): \`opacity 0 → 1, y 26 → 0, 1.2s "sine.out", stagger 0.09\`, per section at \`top 82%\`. Photographs lift slower: \`y 34 → 0, scale 1.012 → 1, 1.5s sine.out\` at \`top 90%\`.
- THE SCRIPT WORD WRITES ITSELF ONCE: a left-to-right reveal over 1.75s \`power1.inOut\` — \`clip-path: inset(-45% 100% -45% -8%) → inset(-45% -12% -45% -8%)\` (negative insets so swashes are never clipped). The hero word runs on load after 0.45s; later words on their own trigger. Once — no loop, no replay.
- THE SCRUBBED SHOWPIECE — LA CARTE-RÉPONSE S'ASSEMBLE: trigger the card, \`start "top 94%"\`, \`end "top 24%"\`, \`scrub 0.55\`. The outer gold rect draws (\`strokeDashoffset → 0\`, 0 → .46), the inner follows at +0.07, the ampersand fades and scales .9 → 1 at .28, the fields settle (\`opacity 0 → 1, y 16 → 0\`, stagger .032) from .38. The frame is an SVG sized in JS from the card's \`clientWidth/clientHeight\`; the JS-dead fallback is the CSS double hairline, swapped out by a class when GSAP takes over. DO NOT PIN IT — a pinned reply card parks a blank plate at a resting scroll position; the assembly must finish as the card climbs into view.
- SUPPORTING SCRUBS (at most two): the deep-panel photograph settles \`yPercent -3 → 3\` at scrub 0.8 (never a Ken-Burns zoom); the petals drift as specified.
- HOVER: 0.3s colour and border swaps only — no lift, scale or shadow — keyboard parity via \`:focus-visible\` (2px rose outline, offset 3px).
- REDUCED MOTION / no CDN: a designed still — petals at 42% of their drift with rotations applied, the reply card fully ruled, nothing at zero opacity.

## Ban list (in addition to the global ban list)
- GUIMAUVE's blob containers, \`back.out(≥1.7)\` overshoot, squash-and-stretch and candy-stripe dividers. Its pink is candy; ours is bridal and still.
- ECLAT's photo-orbit, capsule glyph-badges and 28–48px deep-rounded warm-grade masks — ours are square-cornered with an engraved gold margin.
- POUDRE's macro interludes, shade-dot rows retinting a swatch panel and oval portrait masks; AQUARELLE's wash grounds, pigment-bloom masks and self-painting underpainting.
- FOLIES' gold sunbursts and fans, ziggurat frames and gem-centred chevron dividers — our monogram break is LETTERS on a rule, never an ornament.
- ORFEVRE's self-drawing hairline engravings, filigree corner flourishes and gilded page-edge line. Our gold draws once, on one object: the reply card.
- VELIN's italic accent word (ours is SCRIPT), its boxed drop cap with a folio number, and its thin+thick double-filet rules — our double hairline is two EQUAL 1px rules, on reply cards only.
- MATIÈRE's arches, swatch cabinet and two-ground metronome; HERBIER's specimen plates, pressed-leaf silhouettes and tied tags (our petals are unlabelled and few); GENERIQUE's 21:9 letterbox, Ken-Burns and foil small caps; ECRIN's bare floating micro-caps (ours sit on a rule) and plumb line; SILHOUETTE's type-over-photo collision; ELAN's photo-through-type masthead.
- DOMAINE's meta hairline strip pinned to a photo's bottom edge and its serif price plate on a photo corner; MAISON's raised caption plinths. Our facts sit on the ground in a divided row, never on the image. Exactly ONE on-image plate is allowed per page — the deep band's caption plate — and only if: one line of caption caps (never specs, never a price), set inside the engraved margin, no shadow, never repeated. Two of them and the tic is theirs.
- PUPITRE's wax-seal crest medallion (wax seals belong in PHOTOGRAPHS, never in drawn UI); GOMMETTE's die-cut sticker halo.
- Banned outright: gold fills and gold type · any gradient · glitter, hearts, doves, rings-as-icons · more than one script word per viewport · script in buttons, labels, prices or captions · countdowns · slideshows · centred long paragraphs · drop shadows on cards.

## LES GESTES (moves menu)
1. **Le carton d'invitation** — the hero as an opened invitation: type column on the left axis, a tall photograph bleeding off the right edge, the script word crossing its top edge, a three-fact meta row closing the column.
2. **Le mot écrit** — the script word writing itself once, left to right, 1.75s power1.inOut. On the hero and twice more at most, always over a different photograph edge.
3. **La marge gravée** — the 13px inset gold rule inside a photograph. Free, and it is what makes a stock-feeling image read as a printed plate. Never skip it.
4. **La planche** — the staggered portfolio: tall portrait offset down, wide landscape above right, square + note beneath. The note beside the square is EXTRA, never the caption. Hang the head's side note on its rule at the title's cap line, never bottom-aligned to a three-line title.
5. **Le bandeau du soir** — the one deep band: rosewood panel against a candlelight photograph (engraved margin included), one client quote in ivory serif, a gold rule, a caps attribution. THE ONE ALLOWED ON-IMAGE PLATE: an ivory caption plate INSIDE the engraved margin at the photo's bottom-left (\`left:13px; bottom:13px\`), gold rule on top, no shadow, one line of caps.
6. **Le déroulé** — leader-dot process rows (numeral, title, dotted rule, duration right, a paragraph under) against a sticky left column ending on a display-serif limit line and a ghost CTA.
7. **Les cartons de formule** — three price cartons; the chosen one lifted, double-ruled and flagged. Prices in the display face, currency in rose caps.
8. **Le pli** — photograph left, vertical gold rule as the fold, leader-dot price list right, monogram break as the closing rule.
9. **La dérive de pétales** — the petal layer in the gutters of one or two sections, drifting on scrub. Child of the SECTION, never of the padded container; every spot in the outer 1.6% / 95%+.
10. **Le monogramme** — a gold hairline broken at centre by two script initials. Once, as a closing rule, never as a section opener.
11. **La carte-réponse et le monument** — the reply card with its scrubbed assembly, then the wordmark as the footer's first and largest element over a gold rule. This is the closing, always.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**1 · « Oui » — l'atelier d'Alger (planner).** Hero: type column left, tall florals portrait bleeding off the right edge, script "Oui" crossing its top edge. Middle: filleted columns → planche → dusk band → déroulé → cartons → pli. Showpiece: the reply card assembling rule by rule. Mood: practical warmth — the photographs are romantic, the words are not.

**2 · « Le domaine des oliviers » (venue).** Hero: one wide landscape band at 68vh, the title on an ivory carton overlapping its bottom-left corner — no split. Middle: capacity on leader dots → seasons → pli. Showpiece: the seating plan drawing itself, round tables arriving one by one in gold hairline. Mood: territorial.

**3 · « Papeterie & calligraphie » (stationer).** Hero: a 2×2 flat-lay grid of stationery crops, title in the empty top-left cell — no dominant photograph. Middle: paper stocks → the pli → a monogram gallery. Showpiece: an envelope flap rotating open on scrub, then the name writing itself. Mood: ink-on-cotton.

**4 · « Fleurs & décor » (florist).** Hero: photo-first and stacked — a wide florals band across the top, the script word crossing its BOTTOM edge, headline beneath. Middle: seasonal columns → planche → cartons. Showpiece: a bouquet building, stems adding from the base, ribbon last. Mood: seasonal, hands in water.

**5 · « Les alliances » (bridal jeweller).** Hero: a triptych — narrow photo strip, wide type column, narrow photo strip, the script word crossing the left strip's inner edge. Middle: metals and carats on leader dots → engraving → pli. Showpiece: two bands sliding into overlap on scrub. Mood: expensive by a millimetre.

**6 · « Le jour J » (premium coordination).** Hero: the timeline IS the hero — leader-dot rows 07:00 to 23:00 above the fold, the title as the first row, a thin 3:1 photo strip along the bottom. Middle: the team → dusk band → cartons. Showpiece: the hours lighting one by one down the rule. Mood: military calm, hour by hour.

**7 · « Nikah » (traditional ceremony).** Hero: photograph full-bleed LEFT, type column right, a vertical gold hairline the page's full height between them as a fold, the script word crossing it. Middle: the two families' programmes → henna evening → cartons. Showpiece: three reply cartons fanning apart on scrub, then settling. Mood: two households, one date.

**8 · « Petit comité » (micro-wedding).** Hero: type only — a four-line display sentence flush left in vast ivory, one 90px script word, no photograph until the second screen. Middle: what fifty guests costs → one planche → the pli. Showpiece: a continuous petal drift crossing the page as section titles pass through. Mood: quiet, deliberate.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or this world collapses into a beige template. **The grade and the engraved margin** — one filter, one 13px gold rule inside every image; without them the photos read as stock and the page as a builder theme. **The gold discipline** — gold is a line, every time; the second a gold fill appears the page becomes a 2009 wedding site. **The stillness** — 1.2s sine veil lifts, one scrub, nothing bouncing; the genre's differentiator is that this one is calm.

The cheap details cost nothing: the 34px rule before every label; dotted leaders between a name and its price; the caption under every photograph naming a real couple, venue and month; the currency suffix raised in rose caps beside a serif numeral; the honest limit in the copy ("un seul mariage par week-end"); the ampersand above the reply card. When in doubt, take something out and lengthen the rule.`,
};
