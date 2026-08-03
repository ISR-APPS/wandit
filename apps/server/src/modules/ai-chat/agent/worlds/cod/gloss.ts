import type { DesignWorld } from "../types";

export const gloss: DesignWorld = {
	id: "gloss",
	name: "Gloss",
	family: "bold-glam",
	tagline: "Backstage glam at full wattage — beauty that shouts",
	kind: "cod",
	mood: ["maximal", "hot", "glossy", "showtime"],
	energy: "loud",
	priceFeel: "accessible",
	industries: ["beauty & cosmetics", "fashion & apparel", "jewelry & watches"],
	avoidFor: ["kids & baby", "pets", "car accessories"],
	fusesWith: ["rimel"],
	preview: {
		ground: "#0F0A0E",
		ink: "#FFF6FA",
		accent: "#FF2D8F",
		fontFamily: "Cairo",
		sampleWord: "غلوس",
	},
	doc: `
=== GLOSS — WORLD DOC (kind: cod-page) ===

1. PHILOSOPHY

Gloss is the vanity mirror at showtime. Not the boutique at eleven in the morning — the dressing room at eight at night, four minutes before the curtain, every bulb burning, every surface lacquered black and throwing back hot magenta light. This world sells beauty the way beauty actually gets bought at midnight on a phone in Algiers: loudly, wetly, with total conviction. Where its quiet sister Rimel whispers across blush powder, Gloss shouts across black acrylic. The product is never presented; it PERFORMS. Light is the decoration system — bulbs, glow, specular hits — and liquid is the geometry: edges drip, swatches smear, everything reads freshly applied.

Maximalism is a discipline, not an excuse. Gloss is loud through THREE controlled devices — bulb frames, drip edges, smear bars — repeated with rigor on a strict two-ground rhythm. The moment a build adds a fourth loudness (a gradient wash, a sticker, a starburst) it collapses into bazaar noise and fails. Heat with control: that is the whole craft of this world.

Self-audit checklist — answer before shipping:
- Does the first viewport perform: product, promise, price and CTA under burning bulbs, in one 390px screen?
- Are all three tics present and doing real work — bulbs framing, drips ending sections, smears selecting or dividing?
- Is the page strictly on the two-ground rhythm (lacquer black / magenta field), with at most ONE powder relief section?
- Is every glow warm-white or magenta — no blue, no cyan, no rainbow?
- Does motion ignite (flicker sequences, hard 0.3s entrances) without a single overshoot or shine sweep?
- Is the Arabic display set in Cairo 900 with zero letter-spacing and 1.7+ body leading?
- Would a stranger sort this page from Rimel's blush editorial and Souk's yellow bazaar in two seconds?
- Zero horizontal overflow at 390 / 768 / 1440?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, non-negotiable:
- The selling spine: hook then convince then offer then order form, invisible to the buyer.
- Palette registers: lacquer blacks #0F0A0E to #17101A alternating with hot magenta fields #E5147A to #FF2D8F; ink #FFF6FA; bulb warm-white #FFE9C9 as glow only; cherry #D8123C under 8%; at most ONE powder-pink relief section #FFE3F0.
- Type stacks: Latin display Archivo Black or Big Shoulders Display; body Inter or Barlow. Arabic display Cairo 900 or Changa 800; body Almarai.
- The three owned tics: vanity-bulb frames, lacquer-drip edges, smear swatch bars.
- Motion identity "showtime ignition": bulb flicker sequences, 0.3s power3.out entrances, no overshoot.
- Desktop law: centered mobile shell (~450px) on black lacquer with a faint magenta glow edge.
- Refused blocks: spec-table, comparison-table.
- Imagery style: black-lacquer glam photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client, never copied from a previous build:
- Hero composition (from the hero menu, or a justified new one in-world).
- Block choice within the supported set, and BLOCK ORDER — the convince sequence is rebuilt around this client's product logic.
- Form style (from the form menu).
- Proof type emphasis: photo reviews, WhatsApp threads, stats, or a muted demo loop — pick what the product earns.
- Accent position within the magenta register (#E5147A cool end or #FF2D8F hot end), and whether cherry appears at all.
- Section density: a lean 9-block sprint or a 15-block full show; where the single powder relief lands, if anywhere.
Every client gets a new sibling of this world — same blood, different body. A clone is a failed build.

3. VISUAL SIGNATURES — measured values

- Grounds: #0F0A0E primary lacquer, #17101A raised panels, magenta fields #E5147A→#FF2D8F as full-bleed sections. Powder relief #FFE3F0 (max one section, ink flips to #3A1024 there).
- Ink: #FFF6FA on dark and on magenta; muted #D9B9C8 for secondary lines (never below 60% contrast).
- Vanity-bulb frames (tic): bulbs are 14–18px circles, fill radial-gradient(#FFF3DC 0%, #FFD98F 55%, #B86A1F 100%), each with a 0 0 12px #FFCF7A glow and a 2px #241318 socket ring; spaced 26–34px along the frame edge; unlit state: fill #2A1B20, no glow. Frames run along the top of the hero and around key panels — never around body text.
- Lacquer-drip edges (tic): section bottoms end in an SVG drip path — 4 to 7 uneven drips per 390px, drip length 18–64px, radius 8–12px at the tip, filled with the section's own ground color, ONE 2px white specular curve per drip at 35% opacity. Drips always point down. Never used mid-section, never on the form card.
- Smear swatch bars (tic): horizontal smear strips 48–64px tall with a ragged leading edge (SVG mask), matte fill in the shade's color, labeled in 0.72rem caps — shade name + finish ("عنابي · مات"). Selected state: 2px #FFF6FA outline + a bulb dot at the strip's start. Used as dividers and as variant selectors.
- Display type: clamp(2.1rem, 8.5vw, 3.1rem) mobile hero (Arabic top end 2.8rem); section heads clamp(1.5rem, 6vw, 2rem). Latin display in caps; Arabic display never letter-spaced.
- Body: clamp(0.95rem, 4vw, 1.05rem); line-height 1.55 Latin, 1.75 Arabic.
- Radii: 18px on cards, 999px on CTAs and chips — Gloss is round like a bulb, never sharp.
- Borders: 1px #3A2230 hairlines on lacquer panels; CTA solid magenta fill, ink text #1A0710, no border.
- Shadows: glow only — colored glows (#FF2D8F or #FFCF7A at 20–35%, blur 18–28px) under bulbs, CTAs and the product. No gray drop shadows anywhere.
- Spacing rhythm: section padding-block clamp(52px, 13vw, 84px); drip edges eat 24px of the following section's top.

4. COLOR PHYSICS

- Ground register: lacquer #0F0A0E→#17101A and magenta #E5147A→#FF2D8F alternate as the page's heartbeat — never two magenta sections adjacent, never three lacquer sections adjacent.
- Ink register: #FFF6FA to #D9B9C8. On the powder relief section ink is #3A1024.
- Accent physics: magenta is a GROUND here, not an accent — the accents are light itself: bulb warm-white #FFE9C9 glows and cherry #D8123C moments (stock lines, sale chips) capped at 8% of any viewport.
- Bulb glow is additive light: always warm (#FFE9C9→#FFCF7A), never white-blue.
- Forbidden: gradients between hues (magenta may deepen to #C1046A but never travel toward violet or orange), any blue or cyan, gold, silver/chrome, gray drop shadows, pastel palettes beyond the single powder relief, and pure #000000 (lacquer always keeps a red-plum undertone).

5. TYPOGRAPHY

Latin stack:
- Display: Archivo Black first; Big Shoulders Display (700/800) when the client wants a taller, runway voice. One per build, never mixed.
- Body: Inter (400/600) or Barlow (400/600).
Arabic stack:
- Display: Cairo (900) first choice; Changa (800) alternate — both hold weight against burning bulbs.
- Body: Almarai (400/700).
- Pairing rule: Cairo pairs with Almarai; Changa also pairs with Almarai. Digits: Western Arabic numerals for prices and phone.
Size clamps are shared across scripts; Arabic display caps at 2.8rem where Latin reaches 3.1rem. Weight rules: display never below 700; body never above 600 except prices, which may take the display face.
RTL mirroring: logical properties everywhere (padding-inline, margin-inline-start, inset-inline-end); x-axis motion flips sign; smear bars read from the inline-start (ragged edge on the start side in RTL); NEVER letter-spacing on Arabic — tracking belongs to Latin caps and digits only; Arabic body line-height 1.7–1.9; prices set as an unbreakable LTR unit inside the RTL flow ("4 500 دج").

6. SIGNATURE ART & COMPONENTS

- The bulb frame is the world's crown: a hero crowned by 7–11 bulbs along its top edge (mobile), each igniting in sequence on load. Panel version: bulbs run down ONE side of a lacquer card (3–5 bulbs). Bulbs are drawn in CSS (radial gradients), never emoji, never images.
- The drip edge is the section signature: each lacquer or magenta section may end in melted drips; two consecutive sections never both drip (breathe between performances).
- The smear bar is the interactive signature: shade selection IS a smear; dividers between major beats are unlabeled smears at 24px tall.
- Supporting cast: CTA pills (999px radius, magenta fill, 0 0 24px rgba(255,45,143,.35) glow, pressed state darkens to #C1046A); lacquer cards (#17101A, 1px #3A2230 border, 18px radius); chips (bulb-dot + caps label); mirror stat tiles (numbers in display face with a warm glow text-shadow, max 2 per row); the powder relief section for guarantees or gentle beats.
- Forms: fields 56px min, lacquer ground #17101A, 1px #3A2230 border warming to magenta on focus, labels above in caps, errors in cherry with a flickering bulb dot; success state = the form card's bulb rail fully lit + confirmation in display face.
- Imagery: maximalist glam beauty photography — black lacquered acrylic surfaces, hot magenta gel lighting, wet-look product textures, glowing vanity mirror bulbs in frame or bokeh, hard glossy reflections, editorial drama. Products stand hero-center with mirror reflections; macros show wet texture (smears, drips, loaded applicators); hands allowed with dramatic manicure, faces never. Banned in photos: daylight, white seamless, pastel backdrops, gold props, clinical flat light. Every asset in one build shares this exact lighting story so the page reads as one night backstage.

7. THE SPINE

Hook then convince then offer then order form — invisible to the buyer, law to the builder. Gloss is price-first: the price burns in the hero under the bulbs, set in the display face with a warm glow. The sticky CTA is a full-width magenta bottom bar (64px) carrying label + price, glowing softly; it appears once the hero CTA scrolls off and always smooth-scrolls to the form. Mobile is the canvas at 390px. Desktop law: centered mobile shell — the funnel lives in a ~450px column floating on black lacquer with a faint magenta glow edge (0 0 80px rgba(229,20,122,.18)); the stage does not widen, the house lights just recede.

8. BLOCKS TREATMENT

Supported blocks, dressed by Gloss:
- announcement-bar: a thin lacquer strip with ONE bulb dot and one hot line ("توصيل 58 ولاية — الدفع عند الاستلام"). Never rotates, never blinks.
- variant-gallery: THE smear selector — shades as labeled smear bars, selected smear outlined with a lit bulb dot; feeds the form.
- benefits-icons: 3–5 chips inside a bulb-framed lacquer panel, icon + two-word label, one cherry chip allowed.
- how-it-works-steps: numbered steps as backstage calls — number in display face with warm glow, one sentence each, connected by a thin magenta line.
- before-after: two lacquer panels butted hard, labels as caps chips; the seam is a 2px magenta line. Honest captions, no sliders on mobile.
- photo-reviews: lacquer cards, name + city + stars in warm-white, quote in body face; one review may carry a customer photo in a bulb-cornered frame.
- whatsapp-proof: recreated chat threads on a lacquer card — bubbles keep native shapes but the panel edge takes three bulbs.
- stats-band: a magenta field with 2–3 mirror stat tiles — numbers count up once, glow held.
- stock-urgency: a cherry line + a smear bar that is partially "wiped" — the wiped share shows what is gone. Honest numbers only.
- lottery-contest: the showtime raffle — a bulb-framed card: prize, rule (كل طلب = فرصة), draw date. Bulbs ignite when it enters view.
- bundle-offers: 2–3 lacquer cards (solo / trio), trio flagged بالطقم كامل with a fully lit bulb rail; feeds the form.
- price-anchor: the marquee moment — old price in muted ink struck by a straight 2px cherry line, new price huge in display face with the strongest glow on the page, savings stated in dinars.
- guarantee-seal: on the single powder relief section — a soft card, cherry check, two short lines (exchange window, pay-at-door restated). The page's one exhale.
- order-steps: 4 steps in a row, each a bulb dot + short line (تأكيد بالهاتف، توصيل، الدفع عند الباب).
- faq: lacquer accordion, hairline dividers, magenta plus glyphs.
- trust-footer: lacquer, brand line, phone + WhatsApp as glowing pills, policies in muted ink.

Refused blocks:
- spec-table: Gloss sells desire, not milligrams and millimeters — a spec grid kills the show.
- comparison-table: the mirror admits no rivals; check-cross matrices read as argument, and Gloss never argues.

9. HERO MENU

- Marquee Vanity (price-first stack): bulb frame across the top, product photo center with its reflection, name in display face, price + CTA burning beneath. The default showtime opener.
- Mirror Split: photo panel beside a lacquer text panel (stacks at 390 with the bulb frame bridging both); for products with a strong side profile.
- Swatch-First Hero: the smear selector IS the hero — three giant smears under the headline, price appears on the selected shade; for multi-shade lines.
- Showtime Offer Card: the entire hero as one bulb-framed lacquer card — photo, promise, price, CTA inside; reads as an invitation to the show.
- Backstage Story Hook: a moody vanity scene photo full-bleed, one whispered line ("الليلة، الدور عليكِ"), then the product and price rise under the bulbs.
- Demo-Loop Hero: ONE muted loop (≤2 MB, poster fallback) inside a bulb frame showing application texture; price and CTA beneath. For products that sell by movement.

10. FORM MENU

- Dressing-Room Card (default): one lacquer card with a lit bulb rail across its header, stacked 56px fields, magenta CTA, COD reassurance chips beneath.
- Three-Mirror Wizard: three quick panels — 1 choose shade/bundle (smear selector), 2 name + phone + wilaya, 3 confirm with the total re-lit; progress shown as three bulbs igniting.
- Echo Compact: a two-field teaser (phone + wilaya) directly under the hero for the decided, repeated full-size at the end; the teaser's submit scrolls to the full form.
- Bar-Driven: the sticky magenta bar is the only CTA until the form; tapping it opens the form section with the first field focused. For lean sprint builds.

11. MOTION IDENTITY

Showtime ignition. Entrances: opacity + y:20, power3.out, 0.3s, staggered 0.06s. The signature moment — once per page: the hero bulb frame ignites bulb-by-bulb on load (each bulb a 3-frame steps() flicker, 80ms apart, then held). Panel bulb rails ignite when their panel enters view (same flicker, no re-trigger). Stat numbers count up once, 0.6s. Smear selection swaps outline instantly (no tween). NOTHING overshoots — no back.out, no elastic; nothing sweeps across imagery (the shine sweep belongs to Rimel). Continuous motion is limited to a barely-visible 4s glow breathing on the primary CTA. All motion gated on gsap + ScrollTrigger + no prefers-reduced-motion; reduced-motion shows every bulb lit, everything visible.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: an2000's glossy aqua orbs and chrome bevels; voltage's neon-tube type and glowing glass panels; rimel's blush orbs, lash-tick halos and shine sweep; aquarelle's brush-stroke underpainting; argan's oil ribbon; souk's starburst badges and price-slash theater; kenz's spotlight cone and gold dust drift; doudou's cloud-scallop edges; iris's single radial aura (websites library); eclat's photo-orbit statement (websites library). Gloss's own temptations, also banned: a third ground color, blue-white bulb light, chrome or gold anything, more than one powder relief, drips on consecutive sections, glitter textures, and countdown panic timers dressed as bulbs. Refused blocks: spec-table, comparison-table.

13. EXAMPLE VARIATIONS

- "سهرة" (Sahra) — beauty & cosmetics, a liquid lipstick trio. Marquee Vanity hero; variant-gallery (smear selector), benefits-icons, photo-reviews, stats-band, bundle-offers, price-anchor, order-steps, faq, trust-footer; Dressing-Room Card form. Mood: opening night. Signature emphasis: the fullest bulb ignition in the range — eleven bulbs.
- "Scène" — beauty & cosmetics, a 24h matte foundation. Swatch-First hero (five skin-tone smears); how-it-works-steps, before-after, whatsapp-proof, stock-urgency, price-anchor, guarantee-seal on powder relief, faq, trust-footer; Three-Mirror Wizard. Mood: casting call. Emphasis: smear bars carry the whole selling argument.
- "Loge 5" — jewelry & watches, statement earrings. Mirror Split hero; benefits-icons, photo-reviews with customer photos, stats-band, price-anchor, order-steps, trust-footer — a lean 9-block sprint; Bar-Driven form. Mood: five minutes to curtain. Emphasis: drip edges do the section work; only two bulb moments total.
- "قفطان الليل" — fashion & apparel, an evening kaftan drop. Backstage Story Hook hero; variant-gallery (sizes as smear-labeled chips), photo-reviews, whatsapp-proof, stock-urgency, lottery-contest, price-anchor, faq, trust-footer; Echo Compact form. Mood: the fitting before the wedding night. Emphasis: the lottery card is the brightest panel.
- "Rideau" — beauty & cosmetics, a heated lash curler. Demo-Loop hero (texture loop in the bulb frame); how-it-works-steps, benefits-icons, photo-reviews, stats-band, bundle-offers, price-anchor, guarantee-seal, trust-footer; Dressing-Room Card form reached bar-first. Mood: dress rehearsal. Emphasis: the loop is the only moving image; bulbs stay minimal.
- "عنابي" (Annabi) — beauty & cosmetics, a single-shade icon lipstick. Showtime Offer Card hero; problem-free sprint: photo-reviews, stats-band, stock-urgency, price-anchor, order-steps, faq, trust-footer; Three-Mirror Wizard opened at step 2 (shade fixed). Mood: the classic that needs no menu. Emphasis: one shade, one smear, held like a signature.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
