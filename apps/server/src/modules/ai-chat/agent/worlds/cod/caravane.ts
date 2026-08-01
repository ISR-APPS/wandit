import type { DesignWorld } from "../types";

export const caravane: DesignWorld = {
	id: "caravane",
	name: "Caravane",
	family: "heritage-craft",
	tagline: "Artisan heritage in leather, amber and kilim",
	kind: "cod",
	mood: ["heritage", "crafted", "warm", "nomadic"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["jewelry & watches", "fashion & apparel", "home & kitchen"],
	avoidFor: ["electronics & gadgets", "fitness equipment", "car accessories"],
	fusesWith: ["kenz", "wax"],
	preview: {
		ground: "#F1E4CE",
		ink: "#3A2A1A",
		accent: "#B4622D",
		fontFamily: "Aref Ruqaa",
		sampleWord: "Tiswa",
	},
	doc: `
CARAVANE — THE ARTISAN'S CARAVAN

1. PHILOSOPHY

Caravane sells objects that took time. A cuff hammered over three days, babouches stitched by a hand that learned from another hand, a teapot whose spout was shaped before the buyer was born. The page therefore behaves like the goods: warm, textured, unhurried, carrying its lineage on its surface. Sand-colored grounds stand for the road; one dark leather interlude stands for the night camp; copper and brass stand for the firelight on the goods. Persuasion here is provenance — WHO made it, FROM what, HOW long it took — told in short passages and craft close-ups, never in discount theater. The buyer should feel they are not shopping but being received: shown the materials, told the story, offered tea, and only then shown the price, which is firm because the labor was real. The selling spine runs underneath untouched — hook, convince, offer, order form — but Caravane walks it like a souk merchant of the old school: dignity first, warmth always, the order form offered as an agreement between people. Copy speaks in the first person plural of a workshop ("we tan", "we hammer", "نحن ننسج") and names places: Tiznit silver, Sahara amber, Middle Atlas wool. Nothing is "premium"; things are "made properly", and the difference is the whole world.

Self-audit before shipping:
- Does every section surface at least one MATERIAL (leather grain, weave, hammered metal)?
- Is there exactly ONE dark leather interlude, and does it feel like nightfall, not a theme toggle?
- Do the kilim bands read as woven textile strips, not tiled mosaics?
- Is provenance named with real places and real durations somewhere above the offer?
- Are stitches dashed and rivets small — craft details, not cartoon borders?
- Does the price stand firm — no slashes, no countdowns, no panic?
- Is the form dressed as a stitched agreement with COD reassurance beside it?
- Zero horizontal overflow at 390 / 768 / 1440; page fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook, convince, offer, order form, in order, invisible.
- Sand ground register #F1E4CE (±6 hex warmth), ONE #2B1D12 leather interlude, ink #3A2A1A on sand and ivory #F3E9D6 on dark; copper #B4622D, brass #C29A4B, indigo #34557E capped at 8%.
- Type stacks: Amiri (700) or Cormorant SC display with Mulish or Karla body; Aref Ruqaa or Amiri display with Almarai or Noto Naskh Arabic body in Arabic.
- The three owned tics: kilim bands, saddle-stitch cards, tifinagh accents.
- Motion identity: ember fade — warm fades with 16px directional drift, 0.8s, power2.out; the kilim band's clip-path wipe is the signature.
- Desktop law: centered mobile shell, ~460px, on a woven-texture sand ground.
- Refused blocks: countdown, lottery-contest, spec-table, comparison-table.
- Imagery: warm amber side light on real materials, artisan macro, kilim props.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition (from the hero menu or invented within law).
- Block choice within the supported set, and block ORDER.
- Form style from the form menu; whether a compact echo exists.
- Proof type: photo-reviews, quiet stats, or a maker's-word passage — one per build.
- Where the dark interlude falls (story, offer, or proof — one place only).
- Accent rotation: copper-led or brass-led, indigo's single appearance.
- Section density and rhythm: a cushion set may run 12 blocks, a cuff may run 8.
Each client receives a new sibling — same caravan, different night's camp. Reusing a previous build's hero + block order + form combination breaks the contract.

3. VISUAL SIGNATURES

Measured values. Grounds: sand #F1E4CE, warmer pocket #EDDcbc permitted for cards (use #EDDCBC), dark interlude #2B1D12 exactly once; card ivory #F7EFDE. Ink #3A2A1A on sand; on the interlude, ivory #F3E9D6. Copper #B4622D for CTAs and key accents, hover/darkened #9E5526; brass #C29A4B for rivets, small labels, thin rules; indigo #34557E only once per page (a label, a line of trim, a selected state). Display clamp(30px, 8vw, 46px), line-height 1.2; section titles clamp(22px, 6vw, 30px); body clamp(15px, 4.1vw, 16.5px), line-height 1.7 Latin / 1.85 Arabic; price clamp(26px, 7vw, 38px) in ink with a brass rule beneath. Radii: 6px on cards, 8px on buttons and fields — softened like worn leather, never pill-round. Shadows: one warm low shadow permitted on stitched cards — 0 2px 10px rgba(58,42,26,0.12) — nothing floats higher.

The tics, precisely:
- KILIM BANDS: horizontal strips 18–28px tall of flat woven diamond/lozenge geometry (SVG repeat: lozenges in copper, brass, indigo, ink on sand), used as section borders — under the hero, above the offer, at the footer. Flat textile color, visible "weave" via 1px row offsets; NEVER glazed, never grouted, never star-and-polygon tessellation.
- SADDLE-STITCH CARDS: cards edged with a dashed stitch line (2px dashes, 4px gaps, brass or ink at 60%) inset 8px from the card edge, plus 3px brass rivet dots at the four corners. The stitch is the border; the card itself has no solid outline.
- TIFINAGH ACCENTS: amazigh-geometry glyph marks (the yaz ⵣ silhouette and kin — drawn as clean SVG strokes, 2px weight) used as bullets, list markers and small dividers, in copper or brass, 14–18px, always geometric and respectful — ornament, never pretend-language sentences.

4. COLOR PHYSICS

Ground register: #F1E4CE sand base with permitted drift to #EDDCBC in card pockets — the page reads as one continuous sun-warmed material. The interlude register #2B1D12 appears ONCE, full-bleed, as nightfall: story, offer, or proof lives there in ivory; a second dark section is forbidden. Ink register: #3A2A1A to #4A3624 on sand; #F3E9D6 to #D9CBB2 on the interlude. Accent physics: copper #B4622D carries action (CTAs, links, the sticky bar's button) at up to 10% of a viewport; brass #C29A4B carries craft detail (rivets, rules, small caps labels) at up to 5%; indigo #34557E is the traveler's thread — exactly one appearance per page, ≤8% of one section, or absent. Forbidden: pure white grounds, pure black, saturated reds/yellows (souk's register), glazed tile multicolor, pastels, and any gradient except the interlude's soft vignette edges.

5. TYPOGRAPHY

Latin stack. Display: Amiri 700 — its calligraphic serifs carry the caravan's voice even in Latin; Cormorant SC as the alternative when the client's product name needs engraved small caps (TISWA, AZUR). Body: Mulish (400/600) or Karla (400/700) — plain, warm, legible. Pairing rule: Amiri display + Mulish body is the house default; Cormorant SC + Karla for builds with Latin-heavy naming. Letter-spacing 0.12em on Latin small-caps labels only.

Arabic stack. Display: Aref Ruqaa (700) — the ornate header voice; Amiri (700) when Ruqaa's flourish overwhelms a long title. Body: Almarai (400/700) or Noto Naskh Arabic (400). Pairing rule: Aref Ruqaa headlines + Almarai body for retail warmth; Amiri + Noto Naskh for heirloom gravity.

Shared clamps as above; Aref Ruqaa titles drop one clamp step when exceeding two lines. RTL rules: logical properties everywhere (padding-inline-start, inset-inline-end); NEVER letter-spacing on Arabic; Arabic body line-height 1.85; digits Western (0-9) for prices and phones, wrapped dir="ltr"; the kilim wipe and all x-drifts mirror direction in RTL; tifinagh glyphs do not mirror (they are symbols, not arrows).

6. SIGNATURE ART & COMPONENTS

The kilim band is built as an inline SVG pattern strip — lozenge rows in copper/brass/indigo/ink — placed as full-width section borders; its arrival is the page's signature motion (a continuous clip-path wipe along the reading direction). Saddle-stitch cards hold everything precious: offers, reviews, the form — dashed stitch inset, corner rivets, warm low shadow. Tifinagh accents replace every generic bullet: benefits, list items, step markers.

Supporting cast: buttons are copper blocks, 8px radius, ivory text, with a 1px brass inner keyline on hover/press; secondary buttons are stitched — transparent with the dashed stitch border. Fields are ivory #F7EFDE with a 1px solid #C9B896 border (bottom edge 2px, underline-weighted) and 8px radius, 54px min-height. Chips: small sand lozenges with brass text ("الدفع عند الاستلام", "Handmade"). Dividers between passages: a short brass rule with one tifinagh mark centered. Price tags: ink numerals over a small brass rule — never badges, never bursts.

Imagery. One direction for every photograph: real materials close enough to touch — hammered silver, amber beads, grained leather, wool weave — lit by warm amber side light (a low sun through a workshop door), on aged leather, raw wood or sand-toned cloth, with kilim textile visible as a prop in wider shots; artisan hands mid-work are welcome and encouraged; macro detail shots carry the conviction. Grain fine and warm; shadows long and soft. Banned in photos: studio white sweeps, cool daylight, glossy acrylic props, lifestyle-apartment scenes, anything that looks mass-produced. This direction reproduces for any Caravane product: a teapot, a satchel, a cushion set — each shot as goods worth carrying across a desert.

7. THE SPINE

Hook, convince, offer, order form — the invisible law, in that order, always. Caravane's price placement: the price appears in the HERO, set quietly in ink over a brass rule beneath the product name — a fair price stated once, without theater; the world's law forbids hiding it for a reveal. The sticky CTA is a sand-toned bottom bar with a copper "اطلب الآن / Order" block at the reading end and the price at the start; it arrives after the hero and smooth-scrolls to the form. Mobile-first at 390px. Desktop law: centered mobile shell — a ~460px column on a woven-texture sand ground (the kilim pattern at 4% opacity, tiled), the shell edged by a single brass hairline.

8. BLOCKS TREATMENT

Supported blocks, dressed by Caravane:
- announcement-bar: a thin sand strip between two brass hairlines — "توصيل لكل الإمارات — الدفع عند الاستلام" — one message, no rotation.
- problem-solution: dressed as THE ORIGIN — not pain but longing: two lines on machine-made sameness, then the workshop's answer; set as a passage with a macro photograph and one tifinagh divider.
- benefits-icons: craft virtues — 3-4 lines each led by a tifinagh mark: "فضة تيزنيت الخالصة", "Stitched, not glued", "Ages with you"; no icon circles.
- ingredients-infographic: MATERIALS & PROVENANCE — the object annotated with its matter: silver purity, amber origin, hide and tannage, wool source; each material a small stitched chip with place name; the block that does Caravane's heaviest selling.
- how-it-works-steps: THE MAKING — three or four steps of craft (cast, hammer, engrave, polish) with duration captions ("ثلاثة أيام على النول"); numerals in brass, steps separated by short kilim ticks.
- variant-gallery: the trader's spread — variants laid as objects on cloth, each a stitched card thumbnail; selected variant gains the indigo thread (its one appearance) or a copper rivet highlight.
- size-guide: for cuffs and babouches — a stitched card holding a simple cm table and a "measure like this" line drawing in 2px copper strokes.
- unboxing-gallery: WHAT ARRIVES — cloth pouch, certificate of the maker, the object; one composed flat-lay plus an inventory list with tifinagh bullets.
- photo-reviews: travelers' words — quotes on stitched cards, name + city in brass small caps ("Fatima — Sharjah"), a small brass star row; customer photos framed with the stitch when present.
- guarantee-seal: THE MAKER'S WORD — a stitched card carrying a signed-feeling statement: "If the work disappoints you, return it within seven days. You pay only when it is in your hands." No badge art beyond one tifinagh mark.
- price-anchor: the agreement — price in ink over the brass rule, one line of what the labor included, the COD line beneath; on interlude builds this block lives on the dark ground in ivory.
- order-steps: the caravan route told plainly — four brass-numbered steps: your order, our call, the road (2–4 days), payment at your door.
- faq: stitched rows — questions in Amiri, answers in body ink; brass chevrons; six questions maximum.
- trust-footer: the camp at night — on sand: brand line, phone and WhatsApp contact, policies, "صنع يدوي — يد واحدة، قطعة واحدة" as the closing line, above a final kilim band.

Refused blocks: countdown (time made this object; time will not threaten its buyer), lottery-contest (a workshop is not a raffle), spec-table (materials are provenance, not specifications), comparison-table (handmade does not argue with factories).

9. HERO MENU

- The Maker's Table: photo-split — top 55% a full-bleed workshop shot (hands, tools, the object mid-making), bottom a sand panel with name, provenance line, price over brass rule, copper CTA. The default.
- The Heirloom Stack: centered — small brass caps ("HANDMADE IN TIZNIT"), product name in display, the object photographed on cloth, price, CTA, a kilim band closing the viewport.
- The Night Market: the hero opens ON the dark leather interlude (its single use) — ivory name, warm-lit product, price in brass; the page rises into sand at the second section like dawn on the road.
- The Trader's Card: offer-card hero — one large saddle-stitch card holds product image, name, price and CTA together; sand ground visible around it; for offer-forward builds.
- The Weaver's Loop: video hero — a muted loop of hands at the loom or hammer at the metal behind name and price; poster first; for builds with strong craft footage.
- The Provenance Scroll: story-hook — opens with one line ("Three days on a loom. Yours in three more.") over a wide material macro, product and price arriving in the second beat.

10. FORM MENU

- The Stitched Agreement: one saddle-stitch card holds the full form — ivory fields, brass rivets at the card corners, copper submit block reading "أرسل الطلب — الدفع عند الاستلام". Success: the card restitches into a thank-you with order number and "we will call you".
- The Caravan Stages: a three-step wizard named like a journey — your piece (variant/size), your details, the agreement — steps marked by small kilim ticks; one field group per stage.
- The Hero Echo: name + phone and a copper block directly under the hero price for decided buyers; the full Stitched Agreement waits at the end.
- The Summoned Trade: sticky-bar-driven — no visible form until the bar's copper block is touched; the Stitched Agreement then reveals at the page's end and receives focus.

11. MOTION IDENTITY

Ember fade: elements fade in warmly with a 16px drift along the reading direction (x:16 LTR, x:-16 RTL), power2.out, 0.8s, stagger 0.1s, triggered at 78% viewport. The ONE signature scroll moment: each kilim band reveals via a continuous clip-path wipe along the reading direction (0.9s, power2.inOut) as it enters — the loom laying the band. No other loops, no bounces, no parallax; photographs never move. Sticky bar fades in over 0.5s. Reduced motion: all visible, bands whole, nothing drifts.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: diwan's arabesque ornament frames, eight-point star glyphs and illuminated section openers; zellij's tessellated glazed-tile bands and tile-chip navigation; atlas's dotted travel routes, passport stamps and topographic contours; herbier's tied specimen tags; chantier's steel-plate corner bolts; kenz's velvet jewel-box panel, spotlight cone and gold dust. Caravane's own temptations, banned: tile-by-tile reveals (the wipe is continuous), pretend-tifinagh sentences (marks are ornament, never fake words), souk-style price theater, more than one dark interlude, and "premium" as a word. Refused blocks: countdown, lottery-contest, spec-table, comparison-table.

13. EXAMPLE VARIATIONS

- Tiswa (jewelry & watches, silver-amber cuff, English/Dubai): The Maker's Table hero, then origin passage, MATERIALS & PROVENANCE (Tiznit silver, Sahara amber), THE MAKING with duration captions, travelers' words, price-anchor on sand, order-steps, The Stitched Agreement form, faq, trust-footer. Copper-led; indigo spent on the selected size chip. Kilim wipes emphasized at hero and offer.
- Dar Nou (home & kitchen, brass teapot set): The Trader's Card hero carrying the set and price together, unboxing-gallery (pot, glasses, tray), MATERIALS (hand-spun brass, walnut handle), photo-reviews, THE MAKER'S WORD, The Caravan Stages wizard (set size → details → agreement), trust-footer. Brass-led accents; the dark interlude hosts the origin story mid-page; nine sections, dense with objects.
- Khatwa (fashion & apparel, leather babouches): The Night Market hero on the interlude, rising to sand for THE MAKING (cut, stitch, burnish), size-guide stitched card, variant-gallery spread (honey / ink hides), travelers' words, price-anchor, The Hero Echo form pattern. Copper-led, indigo absent. Signature wipe reserved for the single band above the offer.
- Assarag (home & kitchen, wool kilim cushions): The Weaver's Loop video hero, then origin passage, MATERIALS (Middle Atlas wool, vegetal dyes), variant-gallery of three weaves, unboxing (two covers, no fillers, honesty line), quiet stats as proof ("40 weavers, one cooperative"), price-anchor, The Summoned Trade via sticky bar, faq, trust-footer. The most textile build: bands at three stations, all wiping on entry.
- Izli (jewelry & watches, amber prayer beads, Arabic RTL): The Heirloom Stack hero, MATERIALS & PROVENANCE, THE MAKING, travelers' words with Gulf cities, price-anchor on the dark interlude, order-steps, The Stitched Agreement, trust-footer. Aref Ruqaa headlines; drifts mirrored right-to-left; brass-led with a single indigo thread under the hero name.
- Aghbalu (fashion & apparel, woven satchel): The Provenance Scroll hero ("Two hands. Eleven days. One bag."), benefits as craft virtues, MATERIALS, photo-reviews with customer photos in stitched frames, unboxing-gallery, price-anchor, The Caravan Stages wizard, faq. Copper-led; the interlude hosts the proof section; band wipe emphasized only at the footer — the quietest sibling.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
