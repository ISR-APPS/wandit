import type { DesignWorld } from "../types";

export const fanous: DesignWorld = {
	id: "fanous",
	name: "Fanous",
	family: "festive-night",
	tagline: "Emerald night, glowing lanterns, the gifting month",
	kind: "cod",
	mood: ["festive", "warm", "familial", "night"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"home & kitchen",
		"health & wellness",
		"kids & baby",
		"jewelry & watches",
	],
	avoidFor: ["fitness equipment", "car accessories", "electronics & gadgets"],
	fusesWith: ["dar", "dahab", "atay", "zman"],
	preview: {
		ground: "#0E2E25",
		ink: "#F7EFDC",
		accent: "#E0A93E",
		fontFamily: "Scheherazade New",
		sampleWord: "فانوس",
	},
	doc: `
FANOUS — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Fanous is the Ramadan balcony an hour after maghrib: emerald night air, lanterns strung on cords, gold tassels stirring, the table set and the family near. This world sells the gifting month — dates and coffee boxes, decor, family presents, Eid jewelry — with the warmth of hospitality rather than the noise of promotion. It is festive the way a well-kept home is festive: a few precious ornaments placed with love, light that glows instead of shines, generosity felt in the spacing.

The discipline: Fanous is a NIGHT world with a soft heart, and it must never collapse into its neighbors. It is not the jewel vault (no spotlight drama), not the cosmic counter (no moons-as-system, no crystals), not the ornament palace (no arabesque frames, no eight-point stars, no tiles). Its entire decorative vocabulary is three things — hanging lanterns, tassel fringes, crescent finials — and the restraint is what keeps the night elegant. One lantern string per page. Tassels where a panel deserves celebration. A small crescent capping each chapter like a minaret's finial.

Copy speaks like a host: generous, unhurried, plural-warm ("يجمعكم الخير", "لمّة العيلة"). Numbers stay honest and few. The invisible spine — hook, convince, offer, order form — is the evening itself: the balcony draws you in, the table convinces, the gift is offered, and the order is taken quietly before the tarawih.

Self-audit before shipping:
- Is there exactly ONE lantern string, hung high, lamps ornate (never round bulbs)?
- Do tassel fringes edge only the panels that deserve celebration (max three)?
- Does every section title wear its small crescent finial — and nothing else ornamental?
- Zero arabesque frames, zero star grids, zero tiles, zero moon sequences?
- Is the gold register warm and rationed (lantern gold + glow), never metallic-text flooded?
- Does the page feel like an invitation rather than a sale — while price stays early and clear?
- Is the form as gentle as a host writing your name — and fully valid at 390px?
- Zero overflow at 390/768/1440; readable with JavaScript off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook, convince, offer, order form — balcony, table, gift, order.
- Palette: emerald nights #0E2E25→#154434; cream ink #F7EFDC; lantern gold #E0A93E; warm glow #FFD9A0; berry #8E3B4A ≤6%.
- Type: Latin display Marcellus or Cormorant; body Mulish. Arabic display Reem Kufi or Amiri; body Almarai.
- The three owned tics: lantern strings, tassel fringes, crescent finials.
- Motion identity "lantern sway": 1s fades; lamps sway ±2° slow loops; string lights up lamp-by-lamp once on load.
- Desktop law: centered mobile shell (~460px) on emerald night.
- Refused blocks: comparison-table, spec-table, stock-urgency.
- Imagery: emerald-night gifting photography per Signature Art.

CLIENT-OWNED — re-decided fresh every build:
- Hero composition from the hero menu.
- Block choice within the supported set and the block ORDER — a dates box and an Eid bracelet host different evenings.
- Form style from the form menu.
- Which three panels earn tassel fringes.
- Proof lead: photo-reviews, whatsapp-proof, or stats-band.
- Density: an intimate 8-block evening or a 12-block full celebration.
Every client receives a new evening — same month, different gathering. Repeating a previous build's hero + block order + form combination extinguishes the lantern.

3. VISUAL SIGNATURES

Measured values:
- Grounds: emerald #0E2E25 base, #154434 raised sections; a deep-night interlude #0A211B allowed once. Cream relief panels #F7EFDC with emerald ink for the offer and form.
- Ink: cream #F7EFDC on emerald; emerald #14382E on cream; secondary at 68%.
- Lantern gold #E0A93E: finials, tassels, key numerals, CTA fill; warm glow #FFD9A0 strictly as radial light behind lantern lamps and one hero glow; berry #8E3B4A for tiny accents (a date, a ribbon line) ≤6%.
- Display: clamp(27px, 7.5vw, 42px); Arabic display Reem Kufi (500) or Amiri (700) at full clamp, line-height 1.35; Latin display Marcellus at 95%. No letter-spacing on Arabic ever.
- Body: clamp(15px, 4vw, 16.5px); Almarai line-height 1.8; Mulish 1.6.
- Lantern strings (tic): ONE cord (1.5px cream at 40%) swagging across the hero's top, hanging 3-5 fanous silhouettes (drawn 2px stroke, ornate waisted profiles with crown and base ring, 34-52px tall, alternating sizes); each lamp holds a warm-glow radial fill (#FFD9A0 at 25-45%). Lamps sway ±2° slowly. Never round bulbs, never fairy dots.
- Tassel fringes (tic): a row of drawn tassels (gold thread head + skirt, 18-26px) hanging from a panel's bottom edge on a 2px gold rule; used on maximum three panels per page (hero panel, offer, one proof).
- Crescent finials (tic): a small crescent (14-18px, gold, tips up-left in LTR / up-right in RTL) capping section titles, centered above the title with a 1px gold stem of 10px. One per section title, nowhere else.
- Radii: 10px panels, 999px only on small chips.
- Borders: 1px gold at 35% on cream panels; none on emerald sections.
- Shadows: none; light is glow, not shadow.
- Spacing: generous — sections clamp(64px, 16vw, 96px).

4. COLOR PHYSICS

Ground register: the emerald pair with one deep-night interlude; cream panels reserved for the offer and the form (the two moments the host writes). Ink register: cream on emerald, emerald on cream, 68% secondary. Accent physics: lantern gold is ornament and emphasis — finials, tassels, one numeral per viewport, the CTA; the warm glow exists only as light INSIDE lamps and one hero halo behind the product (radial, soft, honest); berry is a garnish. Forbidden: metallic gradient text, silver, neon, cold blues, black grounds, red urgency, and any second ornament system. Form errors: berry #8E3B4A, form-internal, phrased kindly.

5. TYPOGRAPHY

Arabic-first stacks. Arabic display: Reem Kufi (500) for modern-geometric builds or Amiri (700) for classical warmth — ONE per build; body Almarai 400/700, line-height 1.75-1.9; NEVER letter-spacing on Arabic. Latin stack: display Marcellus (or Cormorant 600) at 95% of Arabic clamps; body Mulish 400/600.
Pairing rule: display owns titles, the price numeral and the CTA; body owns everything else. Small labels: Almarai 700 at 12px (Arabic) / Mulish 700 tracked 0.06em (Latin only). Digits: Western Arabic numerals for prices and phones (Arabic-Indic ٠١٢ allowed ONLY in decorative dates, e.g. "رمضان ١٤٤٧", never in prices); phone numbers LTR-wrapped. RTL is the native direction: crescents tip up-right, lantern cord swags right-to-left, tassels unaffected; LTR builds mirror cleanly.

6. SIGNATURE ART AND COMPONENTS

The lantern string is the world's welcome: one cord, a few ornate lamps, real glow — hung across the hero and nowhere else. The tassel fringe is celebration earned: panels that carry the offer or the family's words receive their gold fringe. The crescent finial is the chapter mark: small, exact, devotional without preaching.

Supporting cast: the gift-ribbon divider (a thin gold double line with a tiny bow knot at center) between major zones, twice per page maximum; date-and-coffee spot illustrations FORBIDDEN — photography carries food; the "ضيافة" chip (cream pill, emerald text) for micro-trust items ("توصيل قبل رمضان مضمون"); the price presented on a cream gift-tag shape with a gold cord hole; CTA as a gold slab with emerald text. Icons: 2px line icons only where logistics demand (phone, delivery), max 4 — the night prefers words.

Imagery. Emerald-night gifting photography: products on dark green cloth or wood, ONE warm light source glowing (lantern light, candle warmth), gold accents catching it, dates/coffee/gift boxes styled with hospitality; hands offering or arranging allowed, faces never; compositions calm and abundant, never cluttered. Color-grade: deep emerald shadows, honeyed highlights, true gold (never yellow-neon). Banned in photos: fairy-light bokeh walls, mosque-postcard clichés, crescent props in frame (the crescent lives in the UI, not the photo), daylight scenes. Every photo on one page shares the same single light source direction — the balcony has one lantern, and the whole evening obeys it.

7. THE SPINE

Hook, convince, offer, order form — balcony, table, gift, quiet order. Price placement: FIRST PRICE IN THE HERO on the gift-tag (a host states the gift's worth without embarrassment). Sticky CTA: a slim emerald bar with a gold CTA ("اطلب هديتك — 14.5 د.ك") appearing after the hero, scrolling to the form. Mobile-first at 390px. Desktop law: CENTERED MOBILE SHELL (~460px) floating on the emerald night with a faint warm glow halo behind the shell — the lit balcony seen from the street.

8. BLOCKS TREATMENT

Supported blocks, dressed by Fanous:
- announcement-bar: an emerald strip, cream text, one hospitable line ("توصيل لكل الكويت قبل رمضان — الدفع عند الاستلام"), thin gold rule beneath.
- hero: the balcony — lantern string above, product in warm glow, gift-tag price, CTA. See hero menu.
- problem-solution: "قبل العزومة" — two gentle pain lines (last-minute gifting stress) flipping to the prepared-host feeling; small photos, much air.
- benefits-icons: a cream panel (tassel-worthy) with 3-4 gains in Almarai + tiny gold markers ("تمر فاخر مختار حبة حبة").
- how-it-works-steps: "ثلاث خطوات للعزومة" — three steps, crescent-finialed mini-titles, one photo each.
- unboxing-gallery: "ماذا في الصندوق" — the box contents in a calm grid, each item named in cream captions; count chip "٧ قطع" (decorative Arabic-Indic allowed here as ornament? NO — use 7; the rule stands).
- photo-reviews: "كلام العائلات" — cream cards, quotes, name + city, no stars (hearts neither): a small gold tassel marks the best one.
- whatsapp-proof: allowed as retyped hospitality messages on emerald ("وصلت الهدية قبل الإفطار، الله يبارك") with timestamps; no app chrome.
- stats-band: three cream numerals on emerald ("+4000 عائلة", "24-48 ساعة", "4.9/5") with gold rules between.
- guarantee-seal: a cream panel with the gift-ribbon divider above: "وصل مثل الصورة أو نبدله قبل العيد" + exchange window; no medallions, no seals-as-stamps.
- price-anchor: the gift moment — old price small and struck in 68%, new price large on the gift-tag, "توفير" line in gold; tassel fringe on this panel.
- bundle-offers: "هدية العيلة / هدية الجيران" — two box sizes as cream cards, the family box marked with a small crescent-topped label; feeds the form.
- cross-sell: one companion gift line ("+ فانوس صغير للأطفال — 2.5 د.ك") with a soft checkbox.
- order-steps: four hospitable steps: تطلب → نتصل → نوصل قبل الإفطار → تدفع عند الباب.
- faq: "أسئلة الضيوف" — emerald accordion, gold plus markers, kind answers.
- order-form: see form menu.
- trust-footer: deep-night interlude, brand line, phone large in gold, WhatsApp, mentions at 68%.

Refused blocks:
- comparison-table: a host never ranks gifts against rivals at the table.
- spec-table: hospitality is not a datasheet; contents are told in the unboxing, warmly.
- stock-urgency: scarcity panic profanes the month; dates and honesty suffice.

9. HERO MENU

- The Balcony: lantern string across the top, product photo in warm glow center, gift-tag price, CTA — the canonical evening.
- The Set Table: full-width iftar-table photo, a cream panel (tasseled) overlapping its base with title, tag price and CTA; lantern string above the photo.
- The Offered Gift: hands offering the box photographed center, lantern string high, price tag beside the hands, CTA beneath; for gift boxes.
- The Crescent Address: text-led — a crescent-finialed headline ("رمضان يجمعكم"), two lines of host copy, small product photo, tag price, CTA; for brands with a voice.
- The Glow Portrait: the product alone against deep night with its honest glow halo, string above, price and CTA below; for single precious objects (Eid jewelry).
- The Eve Countdown: the ONLY hero allowed a date line ("يصلكم قبل ٢٧ رمضان" — written, not ticking); product + tag + CTA; for deadline-real gifting. No timers.

10. FORM MENU

- The Guest Book (single card): a cream panel titled "سجّل طلبك" with a crescent finial; fields stacked (الاسم، الهاتف، المحافظة، العنوان), gold CTA; reassurance beneath ("نتصل للتأكيد — الدفع عند الاستلام"). Tassel fringe allowed here as the third celebrated panel.
- The Two Evenings (2-step): evening 1 — choose the box (bundle cards); evening 2 — the guest book fields; progress as two small crescents filling gold.
- The Host's Echo (hero-echo): a single phone field on a slim cream strip under the hero ("نتصل بك بعد الإفطار") repeated as the full Guest Book at the end.
- The Lantern Bar (sticky-driven): the sticky bar is the only CTA; tapping scrolls to the Guest Book and focuses the name field.

11. MOTION IDENTITY

Lantern sway. Entrances are 1s cream fades (sine.out) with at most 10px rise — night air, not machinery. The lamps sway ±2° in slow 5-6s loops (transform-origin at the cord) — the ONLY loops on the page. THE signature, once: on load, the lantern string lights up lamp-by-lamp (each glow fades in over 0.4s, staggered 0.25s). Tassels never animate; finials never animate; the gift-tag settles 4px on entry. Reduced motion: lamps lit and still, everything pre-settled. Banned: sparkle particles, twinkling, floating ornaments, parallax, scroll scrubs, and any timer tick.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics banned by name: gloss's vanity-bulb frames (round bulbs are the vanity's; lanterns are ornate and waisted); falak's moon-phase strips, crystal-facet frames and smoke threads (one crescent finial is Fanous's entire lunar vocabulary — never sequences); diwan's engraved arabesque frames, mirror-symmetric ornament and eight-point stars; zellij's tessellated tile bands and glazed chips; kenz's spotlight cone, gold dust drift and velvet jewel-box; dahab's per-gram plaques and crimson vitrines; dukkan's pompom garlands (tassels are fringe on rules, never pompoms on strings); dar's daylight beam (Fanous has no daylight).
Fanous's own temptations, banned: fairy-light spam, more than one lantern string, metallic gradient calligraphy, mosque silhouettes, timers of any kind, and religious text as decoration (hospitality, not scripture, carries the page).
Refused blocks restated: comparison-table, spec-table, stock-urgency.

13. EXAMPLE VARIATIONS

- "صندوق العيلة الرمضاني" — home & kitchen. The Set Table hero; order: announcement, hero, unboxing, benefits (tasseled), photo-reviews, whatsapp hospitality, bundle عائلة/جيران, price-anchor (tasseled), order-steps, Guest Book form, faq, footer. Signature: string lights lamp-by-lamp. Mood: the prepared host.
- "طقم قهوة العيد" — home & kitchen. The Offered Gift hero; order: announcement, hero, problem-solution (ضيوف مفاجئون), unboxing, reviews, stats, price-anchor, cross-sell فناجين إضافية, Two Evenings form, faq, footer. Mood: كرم هادئ.
- "سوار العيد" — jewelry & watches. The Glow Portrait hero; order: announcement, hero, benefits (few, precious), photo-reviews, guarantee, price-anchor, Host's Echo + Guest Book, faq, footer. Intimate 9-block evening. Mood: هدية غالية.
- "بكج عناية رمضان" — health & wellness. The Crescent Address hero; order: announcement, hero, how-it-works (سحور/إفطار ritual), benefits, reviews, whatsapp, bundle, price-anchor, Guest Book, order-steps, footer. Mood: راحة الشهر.
- "فانوس الأطفال الموسيقي" — kids & baby. The Balcony hero; order: announcement, hero, benefits, unboxing, reviews (أمهات), stats, price-anchor, cross-sell بطاريات؟ no — cross-sell كتيب حكايات, Lantern Bar flow, faq, footer. Mood: فرحة الصغار.
- "توزيعات العيد ٥٠ قطعة" — home & kitchen. The Eve Countdown hero (written date); order: announcement, hero, unboxing grid, benefits, reviews, guarantee, bundle 50/100, price-anchor, Two Evenings, footer. Mood: العيد منظم.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
