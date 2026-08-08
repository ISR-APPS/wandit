import type { DesignWorld } from "../types";

/**
 * GUIMAUVE — the marshmallow counter.
 * Family: candy-playful. Pastel puffy blobs inflated from the inside,
 * bouncy squash-and-stretch motion (the only world allowed big overshoot),
 * candy-stripe dividers, round everything, MATTE always. Proven against
 * the Chouchou Glaces demo (gelato, Paris); every value in the doc was
 * shipped there.
 * fusesWith rationale — gommette: puff meets sticker, the full kids
 * universe; tutti: the party grows up — teen events.
 */
export const guimauve: DesignWorld = {
	avoidFor: [
		"lawyer / law firm",
		"financial advisor",
		"fine dining",
		"architect (firm)",
		"security company",
		"funeral-adjacent segments",
	],
	doc: `# DESIGN WORLD: GUIMAUVE — the marshmallow counter

## Philosophy
This page is a MARSHMALLOW, not a website — softly inflated, matte, pastel, and openly delighted to see you. Everything on it looks gently pumped full of air: containers are puffy blobs whose depth comes from INSIDE (inset shadows and pillow gradients), never from drop shadows; corners do not exist; colors are sugared pastels that a saturated hue would bruise. Its first structural fact: ROUND EVERYTHING — the minimum radius law (nothing under 24px, most things far above) applies to cards, images, fields, buttons, section edges and the drawn art itself. Its second structural fact: this is the ONLY world in the catalogue allowed BIG OVERSHOOT — back.out(1.7) and beyond (gommette's flat little peel-pops stay under back.out(1.45) and never squash; that bounded exception is named, everything larger is ours) — entrances bounce in on back.out(1.7), hovers squash and stretch like pressed marshmallows, and stillness reads as a held giggle, not silence. Its third structural fact: MATTE ALWAYS — no gloss, no specular highlight, no chrome, no glass; the softness is powdered sugar, not lip gloss. The voice is familial and delighted; the client is a place where children pull their parents by the sleeve. Structurally impossible failure modes: a sharp corner, a black or hard shadow, a glossy sheen, a navy-serious section, a saturated candy-apple red, motion that merely fades. Self-audit before shipping (count them): zero corners under 24px radius page-wide; zero external box-shadows (flat contact ellipses under drawn objects are the only ground shadows); zero hexes outside the pastel registers, and the plum footer is the page's only deep moment; at least THREE distinct blob presets in use, never the same preset on two touching elements; exactly ONE scrubbed showpiece, and every entrance overshoots at least once; at least one candy-stripe divider.

## The variation contract (why two GUIMAUVE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Round everything: 24px minimum radius, blob presets for feature containers; buttons, labels and fields are pills that consume var(--radius) directly (the 999px register).
- Inflation from inside: the double inset shadow + pillow gradient spec (Visual signatures) on every blob and card. External drop shadows are banned; depth is pneumatic, not floated.
- Pastel-only color law inside the registers below; soft plum ink; the plum footer as the single deep moment.
- The three tics: puffy blob containers, back.out bounce + squash-and-stretch (big overshoot above 1.7 is OURS alone), candy-stripe divider bars.
- Matte law: no specular, no gloss, no glass, no blur panels, no chrome.
- Drawn CSS/SVG candy art — zero photography.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- The exact hexes inside each pastel register (a rosier blush, a mintier mint, a peachier butter — see Color physics).
- The display face WITHIN the register: Fredoka OR Titan One (one per site). Body: Nunito OR Quicksand.
- The GOURMANDISE NOUN that drives the page — le câlin, la bulle, le nuage, la récré, la fête — it names the hero scene, seeds the showpiece, flavors the copy and picks the drawn objects.
- The scenes drawn, the products/flavors, the section order beyond the fixed opening (hero) and closing (form + plum footer), which support pastel leads (lilac-led, mint-led, butter-led sites are visibly different siblings), and which 2 to 3 gestes are played.
A GUIMAUVE page without its gourmandise noun is a failure: name it FIRST ("le câlin", "la récré"), then let it choose scenes, section names and words.

## The vibe (voice)
Delighted familial French — short lines that smile, concrete sweetness, zero corporate. Diminutives and doubled affection are welcome (chouchou, doudou, mot doux); exclamation marks are allowed but rationed to one per section. Numbers stay honest and small-scale ("quatorze parfums", "deux tournées par matin"). Register lines:
- "Une boule, deux boules, un bisou."
- "Turbiné ce matin, fondu de bonheur ce soir."
- "Les petits ont leur taille. Les grands ont deux boules d'avance."
Never luxury-speak, never "excellence", never urgency, never baby-talk spelling. The reader is a family, addressed with warmth and respect.

## Visual signatures
- PUFFY BLOB CONTAINERS (owned tic): feature containers use 8-value blob radii from three named presets — B1: 58% 42% 55% 45% / 52% 48% 45% 55% · B2: 45% 55% 48% 52% / 55% 45% 58% 42% · B3: 52% 48% 42% 58% / 48% 52% 55% 45%. Rotate presets; never the same preset on two adjacent elements. Rectangular cards use the squircle register: 32 to 48px radius. Absolute floor anywhere: 24px.
- THE INFLATION SPEC (what makes blobs read as inflated, not flat): every blob and card carries box-shadow: inset 0 10px 22px rgba(255,255,255,0.65), inset 0 -16px 30px rgba(83,59,76,0.10) — light enters from the top, weight pools at the bottom — plus an optional pillow gradient: linear-gradient(180deg) from a tint 4 to 6 RGB points lighter than the base down to the base. Nothing else may gradient. No highlight dot, no specular streak — matte law.
- CANDY-STRIPE DIVIDER BARS (owned tic): 12 to 14px tall bars, border-radius 999px (rounded ends), a chantilly base striped with repeating-linear-gradient(45deg, accent 0 16px, transparent 16px 32px), plus the inflation micro-spec (inset 0 3px 6px white at 60%, inset 0 -4px 8px plum at 12%) so the bar reads as a solid sugar stick, never as floating dashes. They punctuate between sections, underline the wordmark, and cap the showpiece — always horizontal bars, never vertical canopies, never a full striped ground.
- OVERSHOOT AS IDENTITY (owned tic): back.out(1.7) on every entrance — elements arrive like a falling drop, stretched tall-thin (scaleY 1.15 to 1.2 / scaleX 0.86 to 0.9, transform-origin bottom), and settle to 1 through the overshoot; the wide squash (scaleX 1.06 / scaleY 0.94) belongs to presses and landings. A hidden element must never be wider than its layout box (the overflow law — this is WHY the arrival stretches instead of squashing). No other world may bounce LIKE THIS — gommette's small peel-pops (back.out <=1.45, tiny and flat, never squashing) are the single named exception; this world may not NOT bounce.
- Contact ellipses: drawn objects sit on flat ellipses of the ground darkened 6 to 8 RGB points (no blur, no gradient) — the only permitted ground shadow.
- Sprinkle pinches: tiny rounded capsules (8 to 14px long, 999px radius, flat pastel fills, rotated -30 to 30deg) scattered in RATIONED pinches of 5 to 9 around one or two key moments per page. Capsules ONLY — squiggles, crosses, zigzags and half-circles are TUTTI's confetti, banned here.
- Price pastilles: prices sit in small butter-pastel pills (999px, display face 600, plum ink) — never rotated, never clashing (the rotated clashing chip is BLOC's).

## Color physics
- GROUND: the blush register #FFF3F6/#FFEEF2. Sections alternate blush with SUGARED TINTS of the supports — a support pastel mixed to roughly 30 to 40% over blush (the #F3EEFC lilac-veil, #EAF7F1 mint-veil, #FFF6E4 butter-veil registers). Two or three tinted bands per page; adjacent sections never share a ground.
- INK: soft plum, the #533B4C/#5A4053/#4E3847 register — never black, never grey. Body may sit at ink 88 to 94%.
- ACCENT: rose, the #F79AC0/#F291B8/#EF8AB5 register — ONE value per site. Budget: primary CTAs, candy stripes, the active state, one accent word per major headline, small drawn details, ::selection. It never floods a whole section.
- SUPPORTS: lilac #C7B8F5, mint #B8EAD9, butter #FFE3A9 registers (a site may shift each a few points sweeter). They tint section grounds, fill blob cards and drawn art. One support LEADS per site (client-owned) — the others assist.
- CARD SURFACE: chantilly, the #FFFAF8/#FFF8F4 register — never pure #FFFFFF, never pure #000000 anywhere.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT→--primary · INK→--primary-foreground · CHANTILLY→--secondary · the leading SUPPORT→--accent · ink at 90%→--muted · ink at 18%→--border · 999px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, tint or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- PASTEL-ONLY LAW: every hue on the page keeps HSL saturation at or under 75% AND lightness at or above 62%, except plum ink and the accent rose. Saturated candy-apple, neon, primary-school red/blue/yellow: banned.
- THE PLUM FOOTER: the single deep moment — ground flips to the ink-plum register, type flips to blush. No other dark section may exist.
- Gradients exist ONLY as the pillow gradient inside blobs and inside drawn art (a sky, a scoop's soft shading) — never as section decoration, never diagonal washes.

## Typography system
- DISPLAY: Fredoka (500 to 700) OR Titan One (400, its only weight) — one per site, chosen by the brief. Round terminals are the point. NEVER italic (the faces have none; fake obliques are banned) — emphasis is the accent color, a size jump, or nothing.
- BODY: Nunito OR Quicksand, 400/600/700/800. Line-height 1.55 to 1.65.
- Hero statement: clamp(2.9rem, 8.5vw, 6.2rem), line-height 1.02 to 1.08, letter-spacing -0.01em. Section titles: clamp(2rem, 4.5vw, 3.6rem). The scale is generous but domestic — around 7:1 display-to-body; this page is a counter, not a billboard.
- Labels: body face 800, uppercase, 0.72 to 0.8rem, +0.08em tracking, ALWAYS inside a filled pastel pill (butter or mint or lilac, 999px, plum ink) — never floating letter-spaced whispers on bare ground.
- Prices and numerals: display face, 600 register, inside price pastilles; big stat numerals may reach clamp(2.4rem, 5vw, 4rem) inside marshmallow squares.
- One accent word per major headline may take the rose; the rest of the headline stays plum.
- Arabic pairing: if the site serves Arabic, display and body both become Baloo Bhaijaan 2 (rounded Arabic register); the bounce, blobs and pastel law carry the identity; mirror paddings for RTL.

## Signature art / components (the drawn candy world)
- IMAGERY IS DRAWN: layered flat CSS/SVG confections — scoops as circles with one soft same-hue shading crescent (a flatter-tone shape, not a blur), cones as rounded triangles with a criss-cross waffle of 2px strokes, drips as blob-radius teardrops, marshmallows as squircles with the inflation spec, clouds as three overlapping ellipses, cherries with 3px rounded stems. Perspective is FLAT frontal; outlines either none or 3px plum rounded strokes (one choice per site). No 3D, no photoreal, no photography ever.
- Every drawn scene: role="img" + a real aria-label in the page's language; decorative bits aria-hidden="true".
- BUTTONS: 999px pills; primary filled accent rose with plum ink; secondary chantilly fill with 2px plum outline at 30%. Press = squash (scaleX 1.06 / scaleY 0.94, transform-origin bottom, 0.18 to 0.25s). Focus-visible: 3px plum outline offset 3px. Hover never underlines; links in prose underline with 2px rounded rose underline at 45% offset 4px.
- FORMS: fields are chantilly pills (999px, 2px plum-at-18% border; focus swaps to accent + 4px accent-at-25% ring), labels are pastel label-pills above each field, phone-first inputs (type="tel" early in the form), a select for structured choice (parfum, date, formule). Success state is HONEST and drawn: the form swaps for a bouncing marshmallow face + real next-step words ("On vous rappelle avant la prochaine tournée."). On valid submit dispatch the wandit:lead CustomEvent on document with the visitor's fields flat in detail; include one off-canvas decoy input with data-wandit-hp that the page's own script never touches.
- Quote bubbles: customer words live in blob-preset speech bubbles with a round tail circle (30 to 36px, tucked into the blob's lower curve, bottom overlap -6 to -8px), slight rotations (-2 to 2deg), name in a label pill — scattered, never a carousel.
- Favicon: inline SVG data URI — a rose blob with two plum eyes on the blush ground.

## Page chassis
- Vertical rhythm: section padding clamp(4.5rem, 10vh, 8rem); inner grids cap at 1200px (1140px for prose-heavy); showpiece and footer may bleed full-width.
- HEADER: wordmark in the display face (round glyph drawn beside it) + pill nav + one tel pill. Chantilly ground, no shadow, no blur bar.
- FIXED OPENING — the hero law: a big delighted statement (one rose accent word) + label pill + two pill CTAs, facing a drawn hero scene with 2 to 3 satellite gumballs and one sprinkle pinch. The COMPOSITION is chosen from the hero-capable gestes — le comptoir (statement one side, a LARGE pastel blob B1 to B3 holding the confection on the other) is the canonical counter, but le nuage, le ruban qui parle, la vitrine étagée or les mots doux may open the page instead. The gourmandise noun must be visible in the scene. A candy-stripe divider closes the hero.
- FIXED CLOSING: the form-as-invitation (spec above) beside an info blob (address, hours, phone), then the PLUM FOOTER: wavy rounded top edge (SVG, blob curvature), giant display wordmark, hours, pill links.
- FREE MIDDLE (compose 3 to 5, never two adjacent alike, no two sharing a layout): la vitrine — an offset grid of blob flavor/product cards, columns vertically staggered by 1.5 to 3rem · the showpiece scene (Motion identity) · l'atelier — a split of drawn workshop scene + story + marshmallow-square stat row · l'étagère — a menu shelf: drawn signature product beside price rows with soft dashed rules and price pastilles · les mots doux — 2 to 3 scattered quote bubbles · le ruban — a candy-stripe band carrying one claim line between two stripe bars.
- THE SHOWPIECE is scrubbed [GSAP]: one pinned drawn machine-scene that dispenses the offer (the gumball machine is the canonical form — see Motion identity). One per page, the page's burst of joy.

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs; gate everything)
THE GOVERNING LAW: every hidden state is set in JS via gsap.set, NEVER in CSS. Gate the whole animation block on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). CDN dead = a complete, readable page with every scene composed at its landed state.
- Easing identity: back.out(1.7) for entrances (THE signature — no other world squashes and stretches; gommette alone keeps its bounded <=1.45 pops), power2.out for supporting moves, elastic.out(1, 0.4) rationed to one or two jelly moments (CTA wiggle, mascot). CSS transitions 0.18 to 0.3s ease-out.
- Entrances: rise 28 to 40px, arriving stretched (scaleY 1.15 to 1.2 / scaleX 0.86 to 0.9) and settling to 1 on back.out(1.7), 0.55 to 0.8s, staggers 60 to 110ms, transform-origin bottom. Families of cards bounce in as a group. The wide-squash frame lives only inside the settle (the overshoot), never in the hidden state — hidden elements never exceed their layout box.
- THE SHOWPIECE — "la machine à bonbons": a pinned scene (desktop pin, scrub 0.5 to 1; total scroll 220 to 300vh) where a drawn gumball machine dispenses the offer: gumballs (services, flavors, formules) roll out ONE BY ONE — each travels the chute (power1.in), lands with a squash (scaleX 1.25 / scaleY 0.75 then back.out(2) to 1), and its label card inflates beneath (back.out(1.7), 0.35 to 0.4s). Landing slots are visible from the first pinned frame as GHOSTS (cards at 30 to 40% opacity, scale 0.94) so the stage never reads empty; each dispense inflates its card to 100%. The matching ball inside the dome shrinks away as its twin is dispensed — the dome visibly empties. Variants may re-skin the machine (soft-serve swirl building coil by coil, a claw machine, a conveyor of pots) but the grammar — pinned scrub, objects dispensed one by one, squash on landing — is law.
- Mobile (<=768px): no pinning; the machine renders composed and each gumball+label bounces in on view.
- Hovers: squash-and-stretch (0.18 to 0.25s) with keyboard/touch parity (:focus-visible triggers the same state; @media (hover:hover) discipline). Cards may lift 4px maximum — no floating, no shadow growth.
- Reduced motion: everything composed at rest — balls landed, labels visible, zero autoplaying loops; the page reads as a finished candy-shop still.

## Guimauve ban list (in addition to the global one)
- The die-cut sticker halo, peel-corner hover and sticker-sheet section — that is GOMMETTE's language.
- Memphis confetti fields, squiggles, zigzags, crosses, half-circles, colored offset shadows, squiggle underlines — that is TUTTI's party. Our only scatter is the capsule sprinkle pinch.
- Specular gloss, chrome text, aqua orbs, top-edge sheen — that is AN2000. Guimauve is MATTE; one highlight streak breaks the world.
- Awning-stripe canopies and scalloped valance edges — that is PROMENADE. Our stripes are diagonal horizontal divider BARS, never vertical, never architectural.
- 3 to 4px solid black borders, hard offset black shadows, clashing rotated price chips — that is BLOC.
- Soft-shadow floating cards on white — that is CLAIR's tic; our depth is inset, never dropped.
- External box-shadows as depth anywhere (contact ellipses excepted).
- Any corner radius under 24px; any sharp-cornered media box.
- Saturated or neon hues; pure #FFFFFF or #000000; grey.
- Dark sections other than the plum footer; navy, charcoal, "serious" moments.
- Italics or faux-obliques; condensed display faces.
- Photography, 3D renders, glass/blur panels.
- Baby-talk spelling, infantilizing copy, comic-sans-adjacent faces.
- More than one scrubbed scene; bounce on scroll-scrub position (scrub moves are eased on LANDINGS only, never wobbling the scrubbed progress itself).

## LES GESTES (moves menu)
- LE COMPTOIR — hero as a counter: statement left, one giant pastel blob right holding the drawn signature confection, satellite gumballs orbiting at three sizes, one sprinkle pinch. The classic opening.
- LE NUAGE — hero alternative: the headline sits ON a huge cloud blob spanning 70% of the viewport, product scoops peeking from behind its curves; CTAs float on the cloud's lower lobe.
- LA MACHINE À BONBONS — the canonical showpiece: pinned gumball machine dispensing the offer ball by ball, squash on every landing (full spec in Motion identity).
- LE CORNET QUI SE MONTE — showpiece variant: a soft-serve cone builds on scrub, coil by coil (3 to 5 coils, each squashing as it lands), the claim appearing when the cherry drops last.
- LA VITRINE ÉTAGÉE — product grid as offset blob cards: columns staggered 1.5 to 3rem vertically, each card a different blob preset and support pastel, price pastilles bottom-right.
- LE RUBAN QUI PARLE — a claim line set between two candy-stripe bars, the stripes sliding in from opposite sides on entrance (power2.out, 0.6s) before the words bounce in.
- LES MOTS DOUX — 2 to 3 speech-bubble blobs scattered asymmetrically with tiny rotations, tails pointing to name pills; entrance staggered bounce, one bubble arriving late for comic timing.
- LA PESÉE — micro-interaction: tapping flavor gumballs drops them into a drawn cup (max 3), each landing with squash; the total updates in a price pastille. Keyboard operable, aria-live polite.
- LES CARRÉS CHAMALLOW — stats as 3 to 4 marshmallow squares (squircle 36 to 44px radius, inflation spec), big display numerals, one squashing briefly when it enters view.
- LA GOUTTE — section transition: the upper section's ground melts into the next with a single blob-curved SVG edge (one gentle drip lobe, 60 to 120px deep) — used once or twice, never on every seam.
- L'ÉTAGÈRE GOURMANDE — menu as a shelf: drawn sundae or box at left, price rows at right separated by soft dashed rules (2px dashed ink at 15%), each row's pastille bouncing in on view.
- LE CHAMALLOW QUI SALUE — a small drawn marshmallow mascot (squircle, two plum eyes, blush cheeks) appearing at ONE key moment (form success, footer) with an elastic wave — never following the scroll, never repeated.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- LE CÂLIN GLACÉ (gelato, mint-led) — Le comptoir hero: statement + soft-serve cone in a lilac B1 blob; la machine à bonbons dispenses four formules; vitrine étagée of six parfums; mood: tender, creamy, neighborhood-sweet. The shipped Chouchou register.
- LA RÉCRÉ (kindergarten, butter-led) — Le nuage hero: the school name rides a huge cloud, three drawn kids-drawn suns peeking behind; showpiece is le cornet qui se monte re-skinned as a tower of stacked toy blocks (rounded, squashing); les carrés chamallow carry the pedagogy numbers; mood: morning light, crayon warmth, trust.
- LA BULLE (swimming school for kids, mint-led, blue-shifted mint) — hero: the headline floats between drawn bubbles rising from the page bottom; showpiece: a diving board scene where floats/rings dispense onto the water lane by lane; le ruban qui parle carries the safety promise; mood: fresh, buoyant, giggling chlorine.
- LA FÊTE À EMPORTER (event planner for children's parties, lilac-led) — hero: le ruban qui parle opens the page — two candy-stripe bars slide in from opposite sides and the party promise bounces in between them, a garland of round flags (circles only, no triangle bunting) arcing over the CTAs, no blob container in sight; showpiece: a claw machine picks the party formule prizes one by one; la pesée lets parents compose the goûter; mood: confetti-free jubilation, organized joy.
- LES PATTES ROSES (veterinary, blush-led, extra plum) — hero: les mots doux AS the opening — the drawn round puppy stands free on its contact ellipse mid-viewport (no blob container) while three owner quote-bubbles with paw-print name pills bounce in scattered around it, one arriving comically late; the statement rides flush-left beside the scene; showpiece: a treat dispenser drops kibble-gumballs that spell the care services; mood: gentle, reassuring, soft-handed.
- LE DOUDOU SHOP (kids & baby shop, lilac-led) — hero: la goutte melts the header into a shelf scene of drawn plush squircles; vitrine étagée of product families each in its own pastel; showpiece: a conveyor of gift boxes that close their round lids with a squash; mood: nursery calm, cotton, lullaby.
- LA NOTE SUCRÉE (music school for kids, butter-led) — hero: round notes bounce along a drawn 3px rounded staff under the statement; showpiece: a music box crank turns on scrub, dispensing note-gumballs that land on the staff as the course names; l'étagère gourmande becomes the course menu; mood: tinkling, patient, bright.
- LES ONGLES BONBON (nails & lashes studio, rose-led, adult-sweet) — hero: la vitrine étagée IS the hero — an offset grid of shade gumballs (polish swatches at three staggered heights, price pastilles tucked under two) fills the right two-thirds of the viewport while the statement drops in flush-left, no hero blob anywhere; showpiece: a polish bottle tips and a single drip (la goutte) fills the price panel; copy drops diminutives for a wink-sweet adult register; mood: playful-chic, sorbet, Saturday morning.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
This world lives or dies on THREE things at 100%: the INFLATION (a GUIMAUVE page whose blobs are flat pastel shapes with no inset light is a nursery template — the double inset shadow is the world's whole physics), the BOUNCE (every entrance must overshoot; a fade-up GUIMAUVE is dead on arrival — motion IS the sugar), and the PASTEL DISCIPLINE (one saturated hue or one glossy highlight and the page turns into a candy-crush ad). The cheap details that separate it from a generated page: contact ellipses under every drawn object, the sprinkle pinch placed at exactly one or two moments, price pastilles instead of naked numbers, the plum footer's wavy edge, ::selection in rose, and the label pills that never float naked. When in doubt, round it more, puff it more, and let it bounce once more — softness is this world's voltage.`,
	energy: "medium",
	family: "candy-playful",
	fusesWith: ["gommette", "tutti"],
	id: "guimauve",
	industries: [
		"gelato / desserts",
		"patisserie / bakery",
		"fast food",
		"kids & baby shop",
		"kindergarten / crèche",
		"swimming school",
		"dance studio",
		"nails & lashes studio",
		"tea house",
		"veterinary",
		"music school",
		"food delivery brand",
		"event planner",
		"grocery / gourmet",
	],
	kind: "website",
	mood: ["sweet", "playful", "familial", "pastel", "bouncy"],
	name: "Guimauve",
	preview: {
		accent: "#F79AC0",
		fontFamily: "Fredoka",
		ground: "#FFF3F6",
		ink: "#533B4C",
		sampleWord: "Miam !",
	},
	priceFeel: "accessible",
	tagline:
		"La joie guimauve : pastels gonflés, rebonds moelleux, rayures bonbon.",
};
