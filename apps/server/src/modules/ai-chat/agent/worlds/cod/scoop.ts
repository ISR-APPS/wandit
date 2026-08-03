import type { DesignWorld } from "../types";

export const scoop: DesignWorld = {
	id: "scoop",
	name: "Scoop",
	family: "tabloid-cover",
	tagline: "A tabloid cover that takes orders before the ink dries",
	kind: "cod",
	mood: ["sensational", "print", "punchy"],
	energy: "loud",
	priceFeel: "accessible",
	industries: [
		"beauty & cosmetics",
		"home & kitchen",
		"electronics & gadgets",
		"health & wellness",
	],
	avoidFor: ["jewelry & watches"],
	fusesWith: ["teleachat"],
	preview: {
		ground: "#FFFFFF",
		ink: "#0E0E10",
		accent: "#E4002B",
		fontFamily: "Passion One",
		sampleWord: "SCOOP !",
	},
	doc: `
SCOOP — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Scoop is the glossy tabloid front page that decided to sell one product instead of one scandal. White paper, black ink, scandal red, cover yellow — the palette of every kiosk on earth — arranged with the confidence of an editor who knows exactly which three words make a hand reach for the rack. The product is the exclusive. The price is the headline. The proof is the "TESTÉ POUR VOUS" column. And the order form is the coupon page readers used to cut out with scissors.

This world is loud like print is loud: through hierarchy, boxes and angles — never through glow, animation spam, or bazaar clutter. Every element is a piece of cover furniture: a kicker in a box, a circle inset promising more inside, a corner ribbon shouting the discount. The page must look ART-DIRECTED, with the deliberate imbalance of a good cover: one dominant image, one dominant number, satellites around them. If everything shouts, nothing sells; Scoop shouts in exactly three places per viewport and whispers the rest.

The invisible spine — hook, convince, offer, order form — is the editorial flow: cover, feature, offer page, coupon. Copy is headline French (or headline Arabic): short declaratives, numbers first, quotation marks used like weapons ("Mes cheveux ? Enfin lisses."). No irony about the product itself — the tabloid is sincere about its scoop.

Self-audit before shipping:
- Does the hero read as a magazine COVER — masthead-ish brand, cover lines, one dominant image?
- Are the cover-line kickers angled and boxed, never flat plain text?
- Is there at least one circle inset with a label, and does it point somewhere real?
- Are corner flash ribbons carrying the promo, not starbursts or badges?
- Are red, yellow and cyan within their caps (red dominant, yellow boxes, cyan ≤6%)?
- Does every angle sit between -3° and +3° — energetic, never messy?
- Is the form dressed as a coupon and still fully thumb-usable at 390px?
- Zero overflow at 390/768/1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook, convince, offer, order form — cover, feature, offer, coupon.
- Palette: white #FFFFFF ground, ink #0E0E10, scandal red #E4002B, cover yellow #FFD400 (boxes and ribbons only), cyan #009FE3 at ≤6% for kickers.
- Type: Latin display Passion One or Anton or Archivo Black; body Inter. Arabic display Cairo Black; body Almarai.
- The three owned tics: cover-line stacks, circle insets, corner flash ribbons.
- Motion identity "front-page slap": 0.3s slaps with 1-2° rotation settle; cover-lines stagger once around the hero.
- Desktop law: centered mobile shell (~450px) on press-room gray #ECECEC.
- Refused blocks: ingredients-infographic, delivery-map.
- Imagery: punchy white-studio flash photography per Signature Art.

CLIENT-OWNED — re-decided fresh every build:
- Hero composition from the hero menu.
- Block choice and ORDER within the supported set — a beauty scoop and a kitchen scoop paginate differently.
- Form style from the form menu.
- Which words become cover lines (3-5 per build, never more).
- Proof lead: before/after pair, tested column, or stats-band.
- Density: an 8-block special edition or a 13-block full issue.
Every client gets a new edition — same paper, new front page. Copying a previous build's hero + block order + form combination is a pulped print run.

3. VISUAL SIGNATURES

Measured values:
- Ground: #FFFFFF sections separated by 6px ink rules or yellow band dividers (16px). Press-gray #ECECEC only as desktop backdrop.
- Ink #0E0E10 for display and body; secondary at 60%.
- Red #E4002B: the dominant accent — masthead accents, price numerals, ribbons, CTA fill. Yellow #FFD400: kicker boxes, highlight bars behind words, corner ribbons alternate red/yellow. Cyan #009FE3: small kickers only ("EXCLUSIF"), never fills wider than 120px.
- Display: clamp(34px, 9.5vw, 54px) Passion One (or Anton), line-height 0.98, caps; prices to clamp(40px, 12vw, 64px). Arabic display Cairo Black at 90% clamp.
- Cover-line stacks (tic): 3-5 short kickers in boxed caps — box padding 6px 12px, ink box with white text or yellow box with ink text, each rotated between -3° and +3°, stacked with 6-10px gaps around the hero image's edges. One kicker may carry cyan.
- Circle insets (tic): 96-140px circles, 3px ink border, containing a photo detail, with a small label plate attached at the bottom edge ("AVANT / p.2", "زووم"). Max two per page.
- Corner flash ribbons (tic): 45° ribbons clipped across card/hero corners, red or yellow, display type 12-14px, e.g. "PROMO -34%". One per card maximum.
- Radii: 0px — print has corners. Circles are the only curves (insets, coupon punch-holes).
- Borders: 3px ink on feature boxes; 1px ink on table rules; the coupon uses a dashed 2px ink border (scissors line).
- Shadows: none. Print is flat.
- Spacing: tight editorial — sections clamp(48px, 12vw, 72px); inside features, an 8px baseline.

4. COLOR PHYSICS

Ground register: white only; the page is paper. Ink register: #0E0E10 full and 60%. Accent physics: red is the loudest voice and must appear in the hero, the price and the CTA; yellow exists ONLY inside boxes, bars and ribbons — never as free text color, never as a section ground wider than a band; cyan is a garnish (≤6% of any viewport) reserved for one kicker and one link style. Forbidden: gradients, gold, pastels, gray grounds on mobile, photographic duotones, and any fourth hue. Form errors: the red itself, with a bold ink message — the tabloid does not whisper corrections.

5. TYPOGRAPHY

Latin stack. Display: Passion One (700/900) first — round-shouldered tabloid punch; Anton when the client wants harder condensation; Archivo Black as the third. Body: Inter 400/600, tight leading (1.45) — newspaper economy. Numbers: display face for prices and stats, tabular Inter for tables.
Arabic stack. Display: Cairo Black (900); body Almarai 400/700. Arabic display at 90% of Latin clamps; line-height 1.7-1.85 body; NEVER letter-spacing on Arabic (Latin kickers track 0.06em).
Pairing rule: one display face per build. Display owns: cover lines, prices, section headers, ribbon text. Body owns paragraphs and forms. Quotation marks in display pull-quotes are oversized (1.4em) and red. RTL: kicker boxes stack from the right, ribbons flip corners, circle-inset labels attach bottom-right; digits Western Arabic; phone LTR-wrapped.

6. SIGNATURE ART AND COMPONENTS

The cover-line stack is the voice of the kiosk: boxed kickers angled around the dominant image — "TESTÉ", "ÇA MARCHE", "-40% CE SOIR". The circle inset is curiosity: a detail crop or before-state in a bordered circle with its label plate, promising more further down (and the page delivers where the label says). The corner flash ribbon is the deal: diagonal, cropped, unmissable, never more than one per card.

Supporting cast: the masthead lockup (brand name in display caps with a red underline slab and a tiny "ÉDITION SPÉCIALE" line); yellow highlight bars behind key phrases (like a marker through newsprint); the "TESTÉ POUR VOUS" column header style (ink box, white text); pull-quotes with giant red quotation marks; the dashed-border coupon; page-number footers ("p.2 / L'OFFRE") as section markers — a wink of pagination without gazette's masthead furniture. Icons: none; print uses words.

Kiosk construction rules: the dominant image occupies 55-70% of the hero's area and every satellite (kickers, price, inset) touches or overlaps its edge — cover furniture never floats in isolation. Each viewport carries at most THREE shouting elements (one red, one yellow-boxed, one angled); everything else sets flat and quiet at 0°. The 6px ink section rules are the fold lines of the paper: they run full-bleed, and no section may open without one. When two boxed kickers stack, their angles must oppose (+2° over -2°) so the stack reads pinned, not sliding.

Imagery. Punchy white-studio flash photography: the product shot on seamless white with direct flash confidence — crisp edges, true colors, slight hard shadow; detail crops for circle insets; before/after pairs shot identically (same angle, same light) for honesty; hands allowed, faces never. Color-grade: clean whites, saturated product color, no warmth filters. Banned in photos: moody shadows, lifestyle interiors, golden hour, marble-and-eucalyptus styling — the kiosk shelf has no mood lighting.

7. THE SPINE

Hook, convince, offer, order form — cover, feature, offer page, coupon. Price placement: FIRST PRICE ON THE COVER (hero) as a red display numeral inside the cover composition — a tabloid never hides the number that sells. Sticky CTA: a bottom bar styled as a folded paper strip — white, 3px ink top border, red CTA slab "JE COMMANDE — 39 €", always reachable, scrolls to the coupon. Mobile-first at 390px; desktop law: centered mobile shell (~450px) floating on press-gray #ECECEC with a subtle page edge — the cover on the kiosk shelf.

8. BLOCKS TREATMENT

Supported blocks, dressed by Scoop:
- announcement-bar: an ink strip with white display text, one line ("LIVRAISON 48H — PAIEMENT À LA RÉCEPTION"), a thin yellow rule beneath.
- hero: the cover — masthead, dominant image, cover-line stack, red price, CTA. See hero menu.
- before-after: the tabloid's favorite proof — two identical-framed photos side by side, ink-boxed, labels "AVANT"/"APRÈS" in yellow boxes, honest timeframe caption. A circle inset may preview it earlier.
- photo-reviews: the "ILS ONT TESTÉ" column — quotes with giant red quotation marks, name + city in caps, no stars; one review may live in a circle inset.
- stats-band: a yellow band with three ink display numbers ("12 400 VENDUES", "4,8/5", "48H").
- how-it-works-steps: numbered like a recto feature — 1/2/3 in red circles, one photo per step, captions in body.
- comparison-table: "LE MATCH" — ink-ruled table, check marks as red ✓ boxes, rival column in 60% ink.
- countdown: a red band "DERNIÈRE HEURE" with mono digits; honesty line beneath; never in the hero.
- stock-urgency: a kicker box "PLUS QUE 47" angled beside the offer; honest only.
- price-anchor: the OFFER PAGE — old price struck with a red slash bar, new price giant, savings in a yellow box, corner ribbon on the block.
- bundle-offers: two/three boxed editions (SOLO / DUO / FAMILLE), the featured box gets the ribbon; per-unit line in body.
- cross-sell: a small boxed "ET AUSSI" item with checkbox, feeding the coupon total.
- guarantee-seal: a boxed statement "SATISFAITE OU ÉCHANGÉE — 7 JOURS", ink box, yellow bar under the key words; no medallions.
- order-steps: "COMMENT ÇA MARCHE" — four short lines with red numbers, one rule between each.
- faq: "COURRIER DES LECTRICES" — questions in display 15px, answers in body, 1px rules.
- order-form: the coupon — see form menu.
- trust-footer: ink band, brand line, phone huge, mentions in 60%.

Refused blocks:
- ingredients-infographic: lab diagrams belong to the pharmacy page, not the front page; Scoop proves with tests and testimonies.
- delivery-map: geography is not news; "58 wilayas / toute la France" is one kicker.

9. HERO MENU

- The Front Page: dominant product photo right, masthead top, cover-line stack down the left edge, red price bottom-left, CTA beneath — the canonical cover.
- The Exclusive: full-width photo, cover lines angled across its top corners, price in a red box overlapping the photo's bottom edge, one circle inset teasing the proof.
- The Double Scoop: two stacked photos (product + result), kickers between them, price and CTA on a white band beneath.
- The Interview: a giant pull-quote as the hook ("« Enfin lisses. »"), small product photo beside it, cover lines above, price and CTA below — for products sold by one sentence.
- The Chiffre Choc: the price as the masthead-sized element, product photo small and angled with a ribbon, kickers around; for aggressive offers.
- The Une Arabe (RTL builds): mirrored Front Page with kickers stacking from the right and the masthead reading right-to-left.

10. FORM MENU

- The Coupon (single card): dashed 2px border, two punched circles on the top edge, "BON DE COMMANDE" header in an ink box, stacked fields, red CTA slab; COD reassurance printed under the button in body 60%.
- The Two-Page Spread (2-step): page 1 — edition/bundle boxes; page 2 — nom/téléphone/région; pagination "p.1 → p.2" in display type.
- The Hotline Echo (hero-echo): a one-field strip under the hero ("Votre numéro — on vous rappelle") boxed in yellow, repeated as the full Coupon at the end.
- The Kiosk Bar (sticky-driven): the folded-paper sticky bar is the only CTA until the coupon; tapping scrolls and focuses the first field.

11. MOTION IDENTITY

Front-page slap. Elements enter in 0.3s (power3.out) with a 1-2° rotation settling to their final angle — the sound of a page slapped on a counter. The SIGNATURE moment, once per page: the hero's cover-line stack slaps on kicker-by-kicker (0.07s stagger) after the masthead appears. Circle insets pop with a tiny 0.96→1 scale. Ribbons do not animate. Nothing loops. Reduced motion: all print pre-settled at final angles. Banned: parallax, floats, scroll scrubs, typewriters, blinking anything.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics banned by name: gazette's broadsheet justified columns, halftone-dot imagery and masthead dateline/edition furniture (Scoop is a COVER, never an inside page); grille's single oversized red circle anchor (Scoop's circles are small, bordered, photographic and labeled); souk's serrated starbursts and price-slash theater; affiche's fit-to-viewport headline and poster-ground rotation; bulle's speech bubbles and panels; velin's boxed drop caps; teleachat's TV bezel and value-stack tower.
Scoop's own temptations, banned: more than five cover lines, angles beyond 3°, a second circle pair, yellow as text color, cyan fills, italic body, exclamation marks in more than TWO places per page.
Refused blocks restated: ingredients-infographic, delivery-map.

13. EXAMPLE VARIATIONS

- "Lissea Exclusif" — beauty & cosmetics. The Front Page hero; order: announcement, hero, before-after (with hero circle inset pointing to it), ILS ONT TESTÉ reviews, stats yellow band, price-anchor offer page, bundle SOLO/DUO, countdown band, coupon form, faq, footer. Signature: cover-line slap. Mood: kiosk classic.
- "AirChaud 3000" — home & kitchen. The Chiffre Choc hero; order: announcement, hero, how-it-works recto, comparison LE MATCH, reviews, stock kicker, price-anchor, cross-sell ET AUSSI, Two-Page Spread form, footer. Mood: price war edition.
- "Brosse Vapeur Une Arabe" — beauty & cosmetics, RTL. The Une Arabe hero; order: announcement, hero, before-after, reviews column, stats band, price-anchor with ribbon, countdown, Coupon form, faq, trust-footer. Mood: kiosk Cairo.
- "Gadget du Siècle" — electronics & gadgets. The Exclusive hero; order: announcement, hero, stats band, how-it-works, comparison, reviews, price-anchor, bundle, Kiosk Bar form flow, faq, footer. Mood: tech scandal.
- "Cure Detox Vérité" — health & wellness. The Interview hero (pull-quote led); order: announcement, hero, ILS ONT TESTÉ, before-after, guarantee box, price-anchor, order-steps, Hotline Echo + Coupon, faq, footer. Mood: témoignage choc.
- "Spécial Rentrée" — home & kitchen. The Double Scoop hero; order: announcement, hero, benefits as boxed kickers wall, reviews, stats, bundle FAMILLE push with ribbon, price-anchor, Coupon form, footer. Lean special edition. Mood: family issue.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
