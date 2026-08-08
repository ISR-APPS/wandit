import type { DesignWorld } from "../types";

/**
 * SAUCE — the loud smash-burger counter.
 * Popular wave: the street-food / fast-food landing every burger joint asks
 * for (cream ground, ketchup red, mustard support, punchy food photography,
 * fat condensed display, combos in DZD) — executed at the level they assumed
 * cost 10 000 €. Every value below is measured off the shipped demo
 * (SAUCE!, 12 rue Hassiba Ben Bouali, Alger-Centre).
 *
 * fusesWith rationale:
 *  - bloc: the other loud flat-colour world. Bloc brings its hard graphic
 *    frankness when a client wants "poster" over "appetite"; sauce keeps the
 *    food photography and drops bloc's offset shadows entirely.
 *  - tutti: when the brief is a kids/desserts counter and the page must get
 *    sweeter — tutti's palette energy over sauce's chassis, never its confetti.
 *  - huitbit: the arcade-canteen crossover (game bar, bowling, cinéma snack) —
 *    huitbit's HUD furniture on sauce's menu logic.
 */
export const sauce: DesignWorld = {
	id: "sauce",
	name: "Sauce",
	family: "sauce",
	tagline: "Ketchup, moutarde, crème : le burger se démonte en défilant.",
	kind: "website",
	mood: ["loud", "appetizing", "street", "punchy", "generous"],
	energy: "loud",
	priceFeel: "accessible",
	industries: [
		"fast food",
		"street food / food truck",
		"food delivery brand",
		"pizzeria",
		"gelato / desserts",
	],
	avoidFor: [
		"fine dining",
		"aesthetic clinic",
		"dentist",
		"lawyer / law firm",
		"notary",
		"financial advisor",
		"wedding services",
		"jewelry brand",
	],
	fusesWith: ["bloc", "tutti", "huitbit"],
	preview: {
		ground: "#FFF6E8",
		ink: "#201410",
		accent: "#E8332A",
		fontFamily: "Passion One",
		sampleWord: "SAUCE!",
	},
	doc: `# DESIGN WORLD: SAUCE — the loud smash-burger counter

## Philosophy
This page is a COUNTER AT LUNCH RUSH, not a website. It is loud the way a good street-food place is loud: bright, fast, honest, legible from three metres with a queue behind you. Defining facts. THREE FLAT COLOURS AND NOTHING SOFT — cream, ketchup red, mustard, ink for type; no blur, no glass, no shadow under a card, no rounded corner except the ones sauce itself pours. The FOOD PHOTOGRAPHS DO THE SELLING and prices are typeset at display size, inline, never in a pill: the page reads as a menu board. Every ground change ends in a DRIP hanging into the next colour. Impossible failure modes: a dim "elevated" burger page (this world is DAY and NOISE — the premium night grill is BRAISE's), a headline bigger than the food, a price smaller than a paragraph. Self-audit: zero soft gradients, zero drop shadows, three drip edges or more, one display-face price inside the first viewport, one grade line per photograph, zero unplaced assets.

## The variation contract (why two SAUCE sites never look identical)
WORLD LAW — never renegotiated:
- Flat colour only. Cream ground + ONE hot accent + ONE support accent + ink. No third accent, no blur.
- Photographic imagery, one CSS grade, hard rectangular crops. Drawn art is FURNITURE only (drips, arrows, rules), never an illustration standing in for food.
- Prices in the display face, inline, 1.35–2rem; the currency suffix at 0.52em in the hot accent.
- The drip edge on every ground change; the drive stepper; the ingredient explode as the showpiece when the product has layers.
- FLICK SERVE motion: 0.35s x-flicks alternating per group. No overshoot.
- The page NEVER goes dark: the deepest beat is an accent field, ink is type and footer.
CLIENT-OWNED — where siblings diverge, per brief:
- The exact hexes inside the register (shipped: ketchup #E8332A + mustard #FFC93C; siblings: harissa #D6371F + turmeric #F2B01E, tomato #E23B2E + lime-cream #FFD84D, grill-red #CF2B22 + corn #FFB627).
- The display face WITHIN the register: Passion One, Bowlby One SC, Rubik Mono One (headline-only), Titan One — one per site.
- The PRODUCT NOUN driving the page — le smash, le tacos, la part, le cornet — it names the hero, the explode, the stepper's middle step and half the copy.
- The section order beyond the fixed opening (hero + info band) and closing (form + footer), which photographs bleed which way, which field carries the showpiece.
Name the product noun FIRST, then let it choose the crops and the labels.

## The vibe (voice)
Second-person Algerian-French, short, spoken, zero marketing. The page talks like the guy at the counter who likes his job: "On écrase le steak sur la plaque à 250°, une seule fois, très fort. Croûte dehors, jus dedans." Constraints are said out loud instead of hidden — "Deux sauces par burger, la troisième part dans un petit pot à côté." Honest limits beat promises: "Sept minutes montre en main." Never "expérience culinaire", never "nos chefs passionnés", never an exclamation mark outside the wordmark. One client line, printed once. No countdowns — fake urgency is absolutely banned here because this genre invented it.

## Visual signatures (what makes it instantly recognizable)
- THE DRIP EDGE (owned tic): every boundary where the ground colour changes carries a run of sauce. One SVG band, \`viewBox="0 0 1440 66"\`, \`preserveAspectRatio="none"\`, height \`clamp(30px,4.6vw,66px)\`, at \`top:-1px\` of the LOWER section, filled with the UPPER section's colour. Baseline y=16; ten runs; half-widths 12–28px; depths 21–48px; EVERY run at least 1.65× as deep as it is half-wide — that ratio is the whole tic, a wide shallow run is a tab, not a drop. Each bulb is two cubics: first control point on the run's own vertical at 0.42 of the depth, second on the bottom line inset 14% of the half-width, so it hangs fat and round. Spacing is irregular BY LAW: centre deltas 56–340px, one CLUSTER per variant (edges 28–38px apart) and one BARE STRETCH of 250–300px — evenly spaced runs are a repeating tab rhythm, promenade territory. Three path variants, never the same one twice running.
- THE DRIP AT PHONE WIDTHS: the wide band only holds its shape while \`4.6vw\` is live (≈660–1435px); under that the runs render as icicles. Ship a SECOND \`<svg>\` in the same cap, \`viewBox="0 0 900 66"\`, six runs, same unit ranges, swapped at \`max-width:720px\`.
- THE INGREDIENT EXPLODE (owned tic): ONE product photograph cut into horizontal layers separating vertically on scrub, numbered labels on 9×2px accent leaders. Spec below.
- THE DRIVE STEPPER (owned tic): the order path as 1 · 2 · 3 with fat solid arrows — display numerals at \`clamp(3.4rem,7vw,6rem)\` in the hot accent, step title over a 3px ink rule, two lines of body under. The arrow is one path (\`M0 13 H44 V0 L82 20 L44 40 V27 H0 Z\`), 34–58px wide, aligned to the numeral's middle, rotated 90° when the grid stacks.
- Prices INLINE and huge: \`clamp(1.35rem,2.5vw,2rem)\` display face, unit 0.52em in the accent, \`white-space:nowrap\`.
- Section eyebrow + 4px accent rule: 11px/700/uppercase/.14em over a \`height:4px\` bar, \`width:min(100%,190px)\`, in the section's contrast colour.
- Flat colour plates: combos, notes, info panels, the phone plate — solid rectangles of ink / ketchup / mustard, 16–30px padding, zero radius. Three per section maximum, never all one colour.

## Color physics
- GROUND: warm cream, the #FFF6E8 / #FFF4E2 / #FDF3E3 register — two thirds of the page.
- INK: near-black warm brown, the #201410 / #241713 register, never pure #000. Body 100%, descriptions 72%, hairlines 18–22%.
- HOT ACCENT (the sauce): the #E8332A / #D6371F / #E23B2E register. A GROUND as often as an accent — full-bleed fields are how this world gets its volume.
- SUPPORT ACCENT (the mustard): the #FFC93C / #F2B01E / #FFD84D register. Never the ground of more than one section; it carries one field, the chips, the notes and the numerals on the hot accent.

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · HOT ACCENT→--primary · GROUND→--primary-foreground · INK plate→--secondary · SUPPORT ACCENT→--accent · ink at 72%→--muted · ink at 18%→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every register sibling or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

- Budget per viewport: ONE accent field, three plates, one mustard note. Cream still wins.
- On the hot field type is cream and numerals mustard; on mustard, type is ink and numerals the hot accent. Never accent type on accent ground.
- No colour ever fades into another — not in buttons, overlays or behind photographs. The only soft edges are the drips. Ink is a ground exactly once, in the footer.

## Typography system
- DISPLAY: a fat, tight, cheerful poster face — Passion One / Bowlby One SC / Titan One / Rubik Mono One register, ONE per site, weight 400–700, \`text-transform:uppercase\` at headline sizes, tracking +0.005em. It sets headlines, product names, prices, step numerals, the wordmark — never a paragraph.
- BODY: a plain workhorse sans — Asap / Archivo / Figtree register, \`clamp(15px,1.02vw,17px)\`, line-height 1.55, max 44ch on ledes.
- Hero statement: \`clamp(4.1rem,9.6vw,8.4rem)\` at 0.82. Section titles: \`clamp(2.1rem,5vw,4.6rem)\` at 0.88; beside a large photograph drop to \`clamp(2.2rem,4vw,3.5rem)\` so nothing wraps mid-phrase. 10vw is the hard ceiling — fit-to-viewport caps are AFFICHE's, 15–25vw word-structure MANIFESTE's.
- Labels, eyebrows, micro-captions: body face 700, uppercase, 11px, +0.12–0.14em, never italic. Numerals: display face everywhere, phone numbers included. No monospace — this world does not speak machine.
- ARABIC: display swaps to Cairo Black or Almarai ExtraBold, body to Noto Kufi Arabic; never letterspace or uppercase-transform Arabic; mirror the stepper and the hero split under \`dir="rtl"\`. The drip band is reused unchanged.

## Signature art — the photography law
- IMAGERY IS PHOTOGRAPHIC, always food, always on a solid colour seamless under punchy studio light. Shared art-direction phrase: "bold appetizing fast-food photography, punchy studio light on solid color background, vibrant, melting cheese, no text". Never people eating, never a dim interior, never a text-bearing carton or wrapper.
- THE GRADE IS ONE LINE AND IT IS LAW: \`filter:saturate(1.15) contrast(1.06)\` on every \`img\` and photographic background. No per-image tuning, no overlay, no scrim. Type sits BESIDE a photograph or on a flat plate, never over a darkened one.
- MASK GEOMETRY IS THE HARD RECTANGLE — zero radius, zero border; the only edge treatment is the drip where a section boundary passes (eclat's rounded masks and poudre's ovals are theirs). Photographs bleed to ONE viewport edge at a time, alternating sides down the page: absolutely positioned at \`height:100%\` on desktop, a full-width band under 940px.
- Captions live BELOW the crop or on an ink plate at its lower-left, 11px/700/.11em, saying something true: "Le Double · 2 × 90 g".
- THE ROSTER IS FIVE PHOTOGRAPHS AND ALL FIVE GET PLACED: the product portrait (hero, bleeding to one edge), the full spread (a wide band under the carte, cropped so every object in it survives the band's aspect), the texture macro (opposite edge, beside a numbered list), the drink portrait and the side-dish crop (each beside the price board naming it). An unused asset is a fault. Cropping one asset to stand in for a missing one is a stopgap, never a slot.
- THE SEAMLESS REGISTER: cream, the hot accent itself, or one step off it. A deeper studio red (the #B3221A register) is legal only on a crop that is MOSTLY PRODUCT — zoom in with \`transform:scale(1.2–1.3)\` inside a clipping wrapper, since \`object-fit:cover\` on a wider box just re-fits the frame. A large off-register field beside a cream section is a fourth colour, and this world has three.

## THE INGREDIENT EXPLODE (signature showpiece — mandatory when the product has layers, exact spec)
One photograph, one stack, six layers or fewer.
- Each layer is a \`div\` carrying the SAME image as a background: \`background-size:var(--bw) var(--bh)\`, \`background-position:0 calc(var(--bh) * var(--a) * -1)\`, \`height:calc(var(--bh) * (var(--b) - var(--a)))\`, \`--a\`/\`--b\` being the layer's top and bottom as fractions of the photograph's height (shipped Double: .150/.345/.412/.526/.560/.680/.872). Cut at real anatomical boundaries, never even intervals — a 3% pickle slice beside a 19% bun is what makes it a section drawing.
- Sizes: \`--bw:min(33vw,60vh,470px)\` above 901px, \`min(60vw,300px)\` below; gap \`clamp(13px,3vh,30px)\`.
- Labels sit in the same row at \`left:calc(var(--bw) + 14px)\`, centred on their own layer: display numeral in the support accent + a 10–14px uppercase name under 24 characters, preceded by a 9×2px accent leader. That leader is a \`::before\` on the ANIMATED span, never on the row — on the row it leaves orphan dashes floating beside an un-exploded stack.
- THE STATE IN CSS IS THE EXPLODED ONE — layers carry their gap as \`margin-bottom\`, labels visible with JS dead. The script COLLAPSES the stack (each row translated up by the cumulative gap above it, the stack pushed down by half the spread — so the collapsed stack's optical centre still equals its layout centre) and the scrub re-opens it. That is how this world obeys dual-visibility on its own showpiece. The tweens are \`fromTo\`, never \`.from\`: the trigger runs \`invalidateOnRefresh\` and a \`.from\` re-records its end value from the collapsed state, then dies silently.
- Trigger, above 900px: pin the SECTION, \`start\` a function returning \`"top " + <measured bar height> + "px"\` — the bar grows a second line on phones, so never hard-code 58 twice — and \`end:"+="+innerHeight*1.25\`. Below 901px the section is taller than the screen: pin the STACK instead, \`start:"top 33%"\`, \`end:"+="+innerHeight*0.9\`, so the frame the reader holds is the diagram and not the heading. Both: \`scrub:0.5\`, \`anticipatePin:1\`. Rows tween \`y→0\` over duration 5 at ease "none"; label *i* lands at \`0.55 + i*0.62\` with a 0.8s power3.out x-flick from +26px. Its section is a full-bleed accent field at \`min-height:calc(100vh - <bar>)\`, head and facts left, stack right.

## Components
- BUTTONS: solid rectangles at min(var(--radius), 0px) — this world's corners stay cut, \`padding:14px 22px\`, body face 700 / 14px / uppercase / +0.07em. Three fills: hot accent or ink on cream, support accent on the hot field. Hover and focus: \`translateX(3px)\` over 0.15s plus a colour swap — it slides the way the sauce runs, never lifts, never scales. The ghost variant is type over \`box-shadow:inset 0 -3px 0\` in the accent.
- LISTS: two registers, and a page uses both. THE TABLE — name in the display face, description at 0.9rem ink-72%, price pushed right by \`margin-left:auto\`, rows split by ink-18% hairlines under a 3px ink header rule. THE PRICE BOARD — price FIRST at \`min-width:4.4em\`, name second, no rules. Never the same register in two adjacent sections. A tag ("Piquant") carries WORDS; a price inside a tag is a price-chip, and price-chips are bloc's.
- FORMS: on the hot accent field, no boxes. Each field is a label (11px/700/.12em) over a borderless input with \`border-bottom:3px solid rgba(cream,.5)\` turning support-accent on focus, placeholders at cream-72% (under .70 they wash out and read as disabled); \`type="tel"\` with \`inputmode="tel"\`; two selects; one wide textarea for the order in the customer's own words. On valid submit dispatch \`wandit:lead\` on \`document\` with the fields flat in \`detail\` (nom, tel, heure, mode, commande) and answer in the world's voice — "C'est noté, Nadia. On rappelle sur le 05 55 12 34 56 dans les deux minutes." — in a \`role="status"\` line, never a modal. One off-canvas decoy carries \`data-wandit-hp\`, never read by the script. Validation is spoken, not scolded.
- \`::selection\` cream on the hot accent; \`:focus-visible\` 3px accent outline offset 3px, support accent on accent grounds. Decorative SVG \`aria-hidden\`; the explode stack takes \`role="img"\` with a real aria-label reading its layers top to bottom. Favicon: inline SVG data URI, a hot-accent band with two drips on cream.

## Page chassis
- Container \`width:min(100%,1320px)\`, \`padding-inline:clamp(18px,4vw,44px)\`; section rhythm \`padding-block:clamp(74px,9.5vh,124px)\`. Full-bleed members are direct children of the section, never \`100vw\` elements — the page must not need \`overflow-x:clip\` to survive.
- HEADER: a 58px sticky bar on the ground colour, 2px ink bottom border, display wordmark left (trailing punctuation in the accent), 12px uppercase nav, one accent CTA carrying the real phone number — the order verb may drop out under 860px, the number never does. Under 860px the nav does NOT vanish: it becomes the bar's second line, the same anchors in a horizontally scrollable row bleeding to both viewport edges over a 2px ink-16% rule, bar ~96px. No blur, no shadow, no transparency.
- FIXED OPENING: hero (compositions in the gestes) then the full-width accent INFO BAND — hours, communes served, one honest promise, phone, 11px/700/.12em separated by 7px mustard squares. Its top edge is a drip in the hero's ground colour, so the first drip lands in the first viewport.
- FIXED CLOSING: the commande form on a full-bleed accent field beside a cream info plate — adresse, téléphone, écrire, accès, parking, one drive note on a mustard plate, hours pushed to the foot with \`margin-top:auto\`. Declare that rule ONCE: a second \`.hrs\` block later in the sheet kills it silently and opens a third of the plate as dead cream, and the plate needs enough real lines for the pushed-down hours to read as an anchor rather than a gap. Then the ink footer: wordmark at \`clamp(3.6rem,9.4vw,8.6rem)\`, a four-column contact row over a 2px cream-28% rule, one legal line naming currency and sourcing.
- FREE MIDDLE (compose 4–5, never two adjacent alike): the ruled carte under a food band · the explode field · a macro bleeding to one edge beside a numbered list · the drive stepper · the price board with its own crop · an accent quote band · a mustard sauces field.
- Ground rhythm: cream · cream-with-a-band · ACCENT · SUPPORT · cream · cream · ACCENT · ink. Never two accent fields adjacent, never more than two cream sections running without a photograph or a coloured plate.

## Motion identity — FLICK SERVE
GOVERNING LAW: every hidden state is set in JS, NEVER in CSS. Gate the block on \`(gsap && ScrollTrigger && !prefers-reduced-motion)\`. With JS dead the page is complete: all type visible, the explode already exploded with its labels, every photograph lit.
- Entrances: \`x:±34px, opacity:0 → 0.35s power3.out\`, stagger 0.055, trigger "top 88%". Direction ALTERNATES per group (\`data-fx="l"\` / \`data-fx="r"\`): the page serves left, then right, then left. Nothing moves on y, nothing fades up from 20px.
- Photographs CUT IN: opacity 0 → 1, 0.3s power2.out at "top 92%". No scale, no Ken-Burns, no bloom — generique owns the photo scrub, eclat the 0.96 scale-bloom.
- Exactly ONE scrubbed showpiece. No second scrub, no parallax, no marquee, no loop: with the page still, the page is still.
- Hover / focus: 0.15s, colour swap plus \`translateX(3px)\`, an accent underline growing on nav links; every hover has an identical \`:focus-visible\` state. No overshoot — \`back.out\` is banned wave-wide.
- Reduced motion: the composed still — the exploded diagram, every label present. Never a blank.

## Ban list (in addition to the global list)
- **BLOC's hard offset shadows, 3–4px borders everywhere, rotated price-chips** — prices are typeset inline; the only borders are hairlines and one 3px list rule.
- **GOMMETTE's die-cut sticker halo and peel-corner hover**, **TUTTI's Memphis confetti, colour-clashing shadows and squiggle underlines** — the decoration here is a drip, an arrow, a flat plate.
- **AFFICHE's fit-to-viewport headline caps and poster-colour section rotation** — the ceiling is 10vw, cream wins the page.
- **GUIMAUVE's puffy blobs and back.out(1.7) squash** — hard rectangles, nothing bounces.
- **BRAISE's charcoal slates, ember gradient and smoke path** (this wave) — braise is the premium night grill, sauce the street lunch: no dark page, no fading rule, no smoke.
- **PROMENADE's scalloped awning canopies** — the edges are irregular drips of varying width and depth, never a repeating arc.
- **BOULANGE's shelf line-ups, wheat-stalk divider, floured board** (this wave) — no contact shadows, no drawn produce, no speckle.
- **SILHOUETTE's huge-type-over-photo collision** and **ELAN's photo-through-type masthead** (this wave) — type never overlaps a photograph and never contains one.
- **FORME's odometer digits** and **ALLURE's gauge bars** (this wave) — numbers are typeset once and stay put.
- Also banned outright: \`backdrop-filter\`, border-radius above 0 except the drips, monospace, italic, emoji, icon fonts, dimming overlays on food, testimonial carousels, centred long paragraphs.
- GRADIENTS AND SHADOWS have exactly TWO carve-outs. \`box-shadow\` exists only as an \`inset 0 -2px/-3px 0\` underline rule (ghost buttons, links) — never offset, blurred, soft or under a card. \`linear-gradient()\` exists only to draw the select caret: a two-hard-stop 45°/135° pair at \`background-size:6px 6px\`, two solid triangles with no blend. Anything else that fades or floats a card is out.

## LES GESTES (the moves menu)
1. **LE COMPTOIR** — the hero split: type on the page's left axis, the product photograph pinned to the right viewport edge at full section height (\`width:min(42vw,600px)\`), an ink caption plate at its lower-left; a full-bleed band under the type below 940px. Two rules keep it tight: the price rule under the CTAs carries TWO OR THREE lead prices and runs the full width of the type column (that is what closes the gutter between type and photograph), and the hero holds at \`min-height:min(80vh,780px)\` so the info band's drip lands inside the first viewport instead of a strip of dead ground.
2. **L'EXPLOSÉ** — the layer showpiece, spec above. Once per page, on an accent field, a fiche of three facts and a price under the head.
3. **LE TABLEAU** — the ruled carte: name / description / price rows under a 3px ink header rule, closed by one note over a hairline (provenance, supplements, the honest constraint).
4. **LA PLAQUE** — beside the carte, two or three solid combo plates: title, price, one line of contents, one colour each, 12px gaps.
5. **LE PRIX D'ABORD** — the price board: price first at \`min-width:4.4em\`, name second in the display face, no rules. Shakes, sides, extras; never adjacent to LE TABLEAU.
6. **LE MACRO** — one texture macro (sauce, cheese, sesame, ice) bleeding to a viewport edge at a section's full height, the numbered list beside it.
7. **LE CHEMIN** — the drive stepper, 1 · 2 · 3, the middle step always the choice the customer actually makes (the sauce, the size, the pickup). Balance its head row with an ink phone plate: a mustard 11px line over the number in the display face at \`clamp(1.7rem,3vw,2.5rem)\`, the plate a \`tel:\` link.
8. **LA BANDE-CITATION** — a full-bleed accent band carrying ONE client line in the display face at \`clamp(1.5rem,3.4vw,2.7rem)\`, attribution baseline-aligned far right. The only social proof allowed.
9. **LE BON DE COMMANDE** — the closing form on the accent field, rules instead of boxes, the info plate beside it, the ink MONUMENT footer under it.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
**1 — SAUCE!** (smash burgers, Alger-Centre). Hero: LE COMPTOIR — wordmark and claim on the left axis, the double-burger portrait pinned full-height to the right edge, the red info band drip-cut beneath. Showpiece: the six-layer explode separating VERTICALLY on a ketchup field. Mood: hot, fast, cheerful.

**2 — TACOS BOULEVARD** (tacos français, Oran). Hero: no split — one full-width food band across the top third with a drip bottom edge, claim and two lead prices flush-left on cream underneath. Showpiece: the roll, unwrapped — four crops (galette · viande · sauce · fermé) travelling HORIZONTALLY past a fixed accent reading-line. Mood: late, generous, neighbourhood.

**3 — MHADJEB EXPRESS** (mhadjeb & msemen, Constantine). Hero: three stacked bands, no photograph above the fold — a mustard hours strip, the name at 9vw on cream, a ketchup price shelf at the foot of the viewport. Showpiece: the fold — one square crop quartering itself and fanning open on TWO axes, labels flicking in from alternating sides. Mood: hand-made, quick, proud.

**4 — POULET DORÉ** (fried chicken, Bab Ezzouar). Hero: a centred lockup inside a full-bleed ketchup field, cream type, one tall crop dropping from the top edge in the right third. Showpiece: the bucket fills — six crops DROPPING in one after another to build a stack, each snapping its piece name into place. Mood: family-size, loud, weekend.

**5 — GLACE & CO** (gelato, Béjaïa). Hero: the photograph IS the ground — one full-bleed macro filling the viewport, wordmark and a single price on a flat cream plate lower left. Showpiece: the cone builds — three scoop crops stacking UPWARD while the drip edge grows fatter with each scoop. Mood: sweet, bright, seaside.

**6 — LE CAMION** (food truck & delivery, Aïn Témouchent). Hero: no split anywhere — a full-width mustard fact strip anchored at the very top (communes, créneaux, phone in the display face), claim and two lead prices on cream beneath it, the photograph cropped to a low letter-band across the foot of the viewport and drip-cut into the section under it. Showpiece: the plateau — three crops CONVERGING from three edges into one composed tray shot, each price snapping under its object, the combo total last. Mood: mobile, cheap, well-organised.

These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things must be at 100% or this collapses into "a fast-food template". **THE PHOTOGRAPHY AND ITS GRADE** — one filter line, hard rectangles, one bleeding edge per section, captions that say something true; the moment a photograph takes a dimming overlay with centred white type, the page becomes the thing we are replacing. **THE PRICES** — display face, inline, huge, unit in accent; 15px body prices throw away the genre advantage. **THE FLATNESS** — three colours, no fade, no drop shadow, zero radius; one soft shadow and the world goes soggy. The cheap details cost nothing: drips clustering and thinning so no two runs match, the 7px mustard squares between the band's facts, one honest constraint per section ("deux sauces par burger, pas plus"), the focus rule turning mustard, the explode's labels landing one after another. When in doubt, make the photograph larger and take one plate away — this world's voltage is appetite, not quantity.`,
};
