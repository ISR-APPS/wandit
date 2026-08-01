import type { DesignWorld } from "../types";

export const dahab: DesignWorld = {
	id: "dahab",
	name: "Dahab",
	family: "gold-souk",
	tagline: "The gold-shop window: crimson velvet, price per gram",
	kind: "cod",
	mood: ["abundant", "golden", "traditional", "warm"],
	energy: "medium",
	priceFeel: "premium",
	industries: ["jewelry & watches", "fashion & apparel", "beauty & cosmetics"],
	avoidFor: [
		"electronics & gadgets",
		"car accessories",
		"fitness equipment",
		"pets",
	],
	fusesWith: ["jihaz", "kenz", "fanous", "loulou"],
	preview: {
		ground: "#6E1420",
		ink: "#F8F0E0",
		accent: "#D4A946",
		fontFamily: "Cinzel",
		sampleWord: "ذهب",
	},
	doc: `
DAHAB — THE GOLD-SHOP WINDOW

1. PHILOSOPHY

Dahab is the vitrine on the gold street: crimson velvet boards crowded with chains, the
day's per-gram rate chalked proudly by the door, a scale that everyone trusts more than any
slogan. Where Kenz whispers over ONE jewel in the dark, Dahab celebrates ABUNDANCE in warm
light — sets and trays, pieces beside pieces, wealth you can compare and hold. This world
sells gold-culture jewelry (plated sets, chains, wedding parures) to buyers who shop the way
the gold souk taught them: rate first, weight second, karat third, sentiment always. So the
page leads with the numbers this market respects — «سعر الغرام اليوم», «21 قيراط · 8غ» — and
dresses them in velvet and brass. Density is a feature: a Dahab page may show twelve pieces
where Kenz shows one. But density is composed, never cluttered: velvet panels organize
abundance the way a jeweler's tray does. The voice is the shop's matron — warm, exact,
slightly ceremonial: «الذهبة هذي تليق لليلة العمر». Trust is the whole game: rates, weights,
certificates, exchange promises, stated plainly.

Self-audit before shipping:
- Does a per-gram ticker plaque appear early — the market's handshake?
- Is every piece weighted and karated in scale-weight chips (never vague "high quality")?
- Are velvet panels CRIMSON and abundant (multiple pieces) — never near-black single-jewel
  boxes?
- Does cream relief separate the crimson sections so the velvet never fatigues?
- Is the photography warm boutique light on red velvet — zero spotlight-in-darkness?
- Gold used as metal (rules, chips, ornament) — never as paragraph text color?
- Price early, sticky CTA reachable, fields ≥52px, COD reassurance near the form?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — the shop's ritual, unbroken.
- Palette registers: crimson grounds #6E1420 → #8A1B28; cream relief #F8F0E0; ink cream on
  red, #3A1216 on cream; gold #D4A946; deep shadow #3F0C13.
- Type stacks: Latin display Cinzel or Marcellus; body Mulish. Arabic display Aref Ruqaa or
  Amiri; body Noto Naskh Arabic.
- The three owned tics: per-gram ticker plaques, crimson-velvet vitrine panels, scale-weight
  chips.
- Motion identity "vitrine glide": 0.5s velvet-smooth slides; per-gram digits count once.
- Desktop law: centered mobile shell (~465px) on deep crimson.
- Refused blocks: lottery-contest, countdown, whatsapp-proof, spec-table.
- Imagery style: warm gold-boutique photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER — a wedding parure and a daily
  chain deserve different ceremonies.
- Form style from the form menu.
- Proof lead: photo-reviews or stats-band (years, brides served) per client.
- Velvet density (how many pieces per panel) and where cream relief breathes.
- Section rhythm: an intimate 9-block visit or a full 13-block vitrine tour.
Every client gets a new tray arrangement — same velvet, new pieces. Clones tarnish.

3. VISUAL SIGNATURES

Measured values:
- Grounds: crimson #6E1420 primary, #8A1B28 raised panels, #3F0C13 shadowed footer; cream
  relief #F8F0E0 sections (min two per page — the breathing rule).
- Ink: cream #F8F0E0 on crimson; #3A1216 on cream; secondary at 75%.
- Gold #D4A946: hairline rules (1px), chips' borders, ornament, prices on cream; NEVER body
  text, never paragraph fills; may deepen to #B8923B on press.
- Display type: clamp(26px, 7.5vw, 40px) Cinzel 600 Latin / Aref Ruqaa 400 Arabic,
  line-height 1.25; section titles clamp(20px, 5.5vw, 27px); body clamp(15px, 4vw,
  16.5px)/1.7 Mulish, Arabic 1.85 Noto Naskh.
- Radii: 6px velvet panels (trays have edges), 999px chips, 10px photos.
- Borders: 1px gold keylines on velvet panels; 1px #E7D9BE on cream cards.
- Shadows: none — velvet absorbs light; depth via crimson steps.
- Spacing: sections clamp(56px, 14vw, 88px); tray grids gap 12-16px (abundance sits close).
- PER-GRAM TICKER PLAQUES (tic): a gold-keylined crimson plaque — «سعر الغرام اليوم» label,
  the rate large with currency, date line small; appears in the announcement zone and again
  beside the price-anchor. Digits count up ONCE on first view.
- CRIMSON-VELVET VITRINE PANELS (tic): velvet-textured boards (subtle 4% noise + darker
  crimson vignette edges) holding MULTIPLE jewelry photos in tray grids (2-6 pieces),
  each piece on its own velvet cell with a 1px gold keyline.
- SCALE-WEIGHT CHIPS (tic): cream pills carrying a small drawn balance-scale glyph + the
  facts: «21 قيراط · 8غ» / "plaqué or 21K · 8 g" — pinned to every piece and the offer.

4. COLOR PHYSICS

Ground register: crimson #6E1420 → #8A1B28, footer shadow #3F0C13; crimson may never exceed
three consecutive sections — cream relief #F8F0E0 must interleave. Ink: cream on crimson,
wine-ink on cream. Gold physics: metal, not paint — rules, keylines, chip borders, ornament,
price numerals on cream; ≤8% of any viewport; never gradiented, never glow. Forbidden:
black grounds, spotlight vignettes, pink/rose drift, silver (this shop sells gold), neon,
gradients, a second accent hue. Form errors #C24A3E on cream, form-internal only.

5. TYPOGRAPHY

Latin stack. Display: Cinzel (600) — engraved-capital dignity for names and prices;
Marcellus as the softer alternate. Body: Mulish (400/700). Pairing rule: ONE display +
Mulish; display for masthead, section titles, prices, piece names; Mulish for reading.
Arabic stack. Display: Aref Ruqaa (400) — the goldsmith's signboard voice; Amiri as the
quieter alternate. Body: Noto Naskh Arabic (400/700). Pairing fixed per build.
Clamps shared; Arabic display at 95% (Ruqaa carries visual weight); Arabic body line-height
1.8-1.95; NEVER letter-spacing on Arabic (Cinzel caps may take 0.06em). Digits: Western
Arabic numerals for rates, weights, phones; rates formatted with currency after in RTL
(«12 500 دج») inside LTR spans; logical properties everywhere; tray grids mirror; the
balance-scale glyph is symmetric.

6. SIGNATURE ART AND COMPONENTS

The vitrine panel is the shop window: use one as the hero's stage and one or two more for
collections/variants — each a velvet board where pieces sit in gold-keylined cells with
their scale-weight chips. The per-gram plaque opens the page (announcement zone) and
returns beside the offer — rate consistency IS the trust. Weight chips ride every piece
photo. Supporting cast: gold hairline rules with a tiny diamond-dot center (4px rotated
square — an ornament, never folies' chevron-gem dividers); cream certificate cards with
gold keylines; bust photos in 10px-radius frames; the CTA a gold-bordered crimson button
with cream text (gold fill reserved for ONE final CTA at the form).

Ornament is rationed like the metal itself: the diamond-dot rule appears between major zones
only (three per page maximum); tray cells hold 1:1 photos so pieces compare honestly; and
the gold-filled CTA exists exactly once, at the form — every earlier CTA is crimson with a
gold keyline, so the final button lands like the clasp closing. The per-gram plaque never
changes its number between its two appearances — consistency is the tic's entire meaning —
and its date line always carries today's weekday in the demo's language. Weight chips round
to the gram and never invent decimals; when a set's pieces sell separately, each cell's chip
carries its own weight and the tray footer sums them, checked against the set price line.

Imagery: warm gold-boutique photography. Crimson velvet boards and busts, abundant gold
pieces arranged in trays, warm tungsten-leaning light with soft highlights on the metal,
gentle depth of field, macro details of clasps and links; gift boxes in crimson with gold
ribbon. Hands allowed presenting trays, never faces. Banned in photos: black backgrounds,
single-spotlight drama, blue-cold light, mirrors with reflections of the shop, silver
pieces mixed in.

Abundance has grammar: trays hold odd counts (3 or 5 cells) because odd arrangements read as
curated; a 2-cell tray reads as comparison and is reserved for bundle-offers. Cream sections
carry at most one gold ornament each — relief means rest. And the matron's voice keeps its
arithmetic: whenever a price appears, its weight stands within thumb's reach, because in
this market a number without grams is just noise.

7. THE SPINE

Hook, convince, offer, order form — the visit's ritual, invisible and fixed. Price
placement: EARLY — the per-gram plaque sits in the announcement zone BEFORE the hero
(rate first, like the street), and the set's full price appears in the hero with its
weight chip; nobody scrolls to learn what gold costs today. Sticky CTA: a crimson bottom
bar with a 1px gold top rule — set name + price at the start side, gold-keylined pill at
the end side («اطلبي الطقم»); appears after the hero, scrolls to the form. Mobile-first at
390px; desktop is a CENTERED MOBILE SHELL (~465px) on deep crimson #571019 with faint
velvet vignettes.

8. BLOCKS TREATMENT

Supported blocks, dressed by Dahab:
- announcement-bar: the per-gram plaque compressed to a strip — rate + date + «الدفع عند
  الاستلام»; gold keyline below.
- benefits-icons: 4 cream chips with drawn glyphs (scale, certificate, gift box, exchange
  arrows) — craft facts, not marketing adjectives.
- variant-gallery: the tray — a vitrine panel where each piece of the set (chain, earrings,
  cuff) sits in its own cell with weight chip; tapping highlights the cell's gold keyline;
  feeds the form when pieces sell separately.
- size-guide: chain lengths and ring sizes on a cream card — a drawn chain with length
  marks (40/45/50 cm) and a "how to measure at home" line.
- unboxing-gallery: «علبة ليلة العمر» — the crimson gift box, ribbon, certificate card and
  pouch, photographed open; one line per item with gold dot bullets.
- photo-reviews: cream cards, women's first names + city, warm short quotes («لبستها في
  عرس أختي، الكل سقسى منين»), stars as small gold diamonds; worn-photos welcome (no faces).
- stats-band: crimson band, three cream numbers — سنين في الصنعة، عرايس فرحو، ولايات نوصلو.
- guarantee-seal: the certificate card — gold-keylined cream panel: «شهادة طلاء 21 قيراط ·
  تبديل خلال 7 أيام»، مع خط SAV; never a rosette, never wax.
- price-anchor: the rate plaque returns beside the set's tag: old price struck in cream 60%,
  new price in display type with weight chip, «الغرام يطلع، سعرنا ثابت هذا الأسبوع» honesty
  line.
- bundle-offers: «القطعة وحدها / الطقم كامل» — two tray cards with weight chips and prices;
  the full set carries a gold corner ornament; feeds the form.
- order-steps: 4 steps with gold numerals — تطلبي، نأكدو بالتليفون، توصلك في علبتها،
  تخلصي عند الباب.
- faq: cream accordions — الطلاء يدوم قداه؟ كيفاش نحافظ عليها؟ التبديل؟
- trust-footer: shadow crimson #3F0C13, shop identity, phone + WhatsApp large, «وزن مضبوط،
  كلمة مضبوطة».
Refused blocks: lottery-contest and countdown (gold keeps its dignity), whatsapp-proof
(this market's proof is worn photos and certificates, not chats), spec-table (weights live
on chips, not engineering rows).

9. HERO MENU

- La Vitrine Pleine: the hero IS a vitrine panel — the full set arranged on velvet, name in
  display type above, weight chip + price + CTA beneath; the shop window itself.
- Le Buste: single bust photo leading (the set worn on a velvet bust), price and weight chip
  overlaid on the crimson zone, CTA beneath; for hero pieces.
- La Parure Comptée: piece-count hero — the set's pieces in a row of velvet cells (3-5),
  each with its weight chip, total price beneath; abundance as argument.
- Le Taux du Jour: rate-first hero — the per-gram plaque LARGE at top, then the set photo
  and price; for rate-sensitive weeks.
- L'Écrin Ouvert: the open gift box as hero photo, set nestled inside, «جاهزة للهدية» line,
  price + CTA; for wedding-gift builds.
- La Main Tendue: presentation hero — a hand offering the tray toward the camera, headline
  over cream, price chip pinned; warmest composition.

10. FORM MENU

- Le Registre (single card): cream card, gold keyline, crimson header strip («طلب الطقم»),
  stacked fields, the gold-filled CTA (its one appearance), COD line beneath.
- La Pesée (two-step wizard): step 1 piece/set choice on tray cells + size, step 2 name +
  phone + wilaya; progress as two balance pans that level; summary restates weight + price.
- L'Écho de la Vitrine: compact 2-field echo (phone + wilaya) under the hero for decided
  brides, full Registre at the end.
- Le Comptoir Doré: sticky-bar-driven — the bar's pill opens the form focused; for short
  builds.

11. MOTION IDENTITY

Vitrine glide: entrances slide 20px with 0.5s power1.out — velvet-smooth, no bounce ever.
The ONE signature moment: the per-gram plaque's digits COUNT UP once on first view (0.8s,
tabular, then still forever — including its second appearance, already settled). Tray cells
fade in with 60ms staggers; gold keylines draw nothing (they simply appear — orfevre owns
self-drawing gold). Weight chips settle with a 2° tilt correction. NO loops, no sparkle
particles, no parallax, no overshoot. Reduced-motion: everything static and complete.
gsap.set only; the page reads perfectly without JS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji-as-design, Poppins-everything,
lorem ipsum, fake trust walls, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur, back.out overshoot. Neighbor tics banned by name: kenz's spotlight cone,
gold-dust drift and near-black velvet jewel-box (Dahab velvet is CRIMSON and plural —
restated); orfevre's self-drawing engravings, filigree corners and gold-leaf edge;
caravane's saddle stitches and kilim; jihaz's lace edges and ribbon bows; folies' gold
chevron-with-gem dividers; hikaya's curtains; fanous's tassels and lanterns; nocturne's
foil small-caps. Dahab's own temptations, banned: gold text paragraphs, sparkle overlays,
black-velvet drama, "luxury" adjectives replacing weights, mixing silver, urgency
mechanics. Refused blocks restated: lottery-contest, countdown, whatsapp-proof, spec-table.

13. EXAMPLE VARIATIONS

- «طقم ليلة العمر» — jewelry & watches, ar-DZ. La Vitrine Pleine hero; order: announcement
  (rate strip), hero, benefits-icons, variant-gallery (tray), unboxing-gallery,
  photo-reviews, guarantee-seal, price-anchor (rate returns), bundle-offers, order-form
  (Le Registre), faq, trust-footer. Mood: wedding-week certainty.
- «سلسلة يومية 45cm» — jewelry & watches. Le Buste hero; order: announcement, hero,
  size-guide, benefits-icons, photo-reviews, guarantee-seal, price-anchor, order-form
  (L'Écho de la Vitrine), faq, trust-footer. Mood: everyday gold, souk honesty.
- «باروير العروسة» — jewelry, full parure. La Parure Comptée hero; order: announcement,
  hero, variant-gallery, stats-band, photo-reviews, unboxing-gallery, guarantee-seal,
  price-anchor, order-form (La Pesée), faq, trust-footer. Mood: the tray that ends the
  search.
- «هدية عيد الأم» — jewelry gifting. L'Écrin Ouvert hero; order: announcement, hero,
  unboxing-gallery first, benefits-icons, photo-reviews, guarantee-seal, price-anchor,
  order-form (Le Registre), faq, trust-footer. Mood: the box does the talking.
- «أسبوع الثبات» — rate-led promo. Le Taux du Jour hero; order: announcement, hero,
  bundle-offers early, variant-gallery, photo-reviews, guarantee-seal, price-anchor,
  order-steps, order-form (Le Comptoir Doré), faq, trust-footer. Mood: rate confidence.
- "Caftan Boutons Dorés" — fashion & apparel. La Main Tendue hero; order: announcement,
  hero, benefits-icons, size-guide, photo-reviews, guarantee-seal, price-anchor, order-form
  (La Pesée), faq, trust-footer. Mood: dressed in the shop's gold light.
- «عطر الذهب» — beauty & cosmetics, amber perfume in a gilded flacon. Le Buste hero (the
  flacon on velvet); order: announcement (rate strip stays — the shop's identity), hero,
  benefits-icons, unboxing-gallery, photo-reviews, stats-band, guarantee-seal, price-anchor
  (per-ml line replacing per-gram on the tag, plaque unchanged), order-form (Le Registre),
  faq, trust-footer. Mood: the boutique's own scent, sold with the same scales.
These show the range. NEVER copy one — remix their choices or invent a new variation in the
same spirit.
`,
};
