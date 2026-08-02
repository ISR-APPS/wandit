import type { DesignWorld } from "../types";

export const jihaz: DesignWorld = {
	id: "jihaz",
	name: "Jihaz",
	family: "bridal-gift",
	tagline: "The trousseau chest: ivory lace, satin bows, ceremony",
	kind: "cod",
	mood: ["ceremonial", "tender", "ornate", "ivory"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"home & kitchen",
		"fashion & apparel",
		"jewelry & watches",
		"kids & baby",
	],
	avoidFor: ["electronics & gadgets", "car accessories", "fitness equipment"],
	fusesWith: ["dahab", "rimel", "hikaya", "mahra"],
	preview: {
		ground: "#FCF8F1",
		ink: "#4A3A33",
		accent: "#D9A7B0",
		fontFamily: "Cormorant",
		sampleWord: "جهاز",
	},
	doc: `
JIHAZ — THE TROUSSEAU CHEST

1. PHILOSOPHY

Jihaz is the room where the trousseau is prepared: ivory light, satin folded in tissue, lace
laid flat, a chest that opens once for each guest and closes again with a ribbon. This world
sells the objects a family gathers for a marriage — bedding, towels, gowns, gifts, small gold
— and it sells them the way they are given: as ceremony. Nothing here shouts, because the
occasion itself carries the urgency. A bride's mother does not need a countdown; she needs to
see the weave, the hem, the bow, and to believe the box will arrive intact and worthy of the
day. So the page moves like a ritual: reveal, admire, confirm. Copy speaks with tenderness
and pride — "يليق بليلة العمر" — never with pressure. Prices are spoken plainly and once,
set like an engraved card, because gifts are not haggled in front of guests.

The material law: everything is textile and paper-of-invitation. Grounds are ivory and
champagne, edges are lace, seals are satin bows, reveals are lids lifting off boxes. Where a
promo world stamps, Jihaz ties. Where a bazaar world stacks, Jihaz folds. The invisible COD
spine — hook, convince, offer, order form — runs beneath the ceremony, fully intact: the form
still asks name, phone, wilaya; the reassurance still says pay at the door. Ceremony is the
skin, never an excuse to lose the sale.

Self-audit before shipping:
- Does the hero read as a gift being presented, not a product being pushed?
- Is every lace strip genuinely openwork (perforated pattern), never a plain scallop?
- Are bows drawn satin — two loops, two tails, a knot — and used as SEALS, not confetti?
- Does exactly ONE lid-lift reveal exist, on the offer chest, once?
- Is champagne gold confined to rules and bows, under 4% of any viewport?
- Could every line of copy be spoken aloud at an engagement gathering without embarrassment?
- Is the form dressed as a carte d'invitation while keeping COD reassurance explicit?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, then convince, then offer, then order form. Invisible, inviolable.
- Palette registers: ivory ground #FCF8F1, champagne alternate #F3E8D8; ink #4A3A33; satin
  rose #D9A7B0; champagne gold #CBB07E for rules and bows only; pearl-white cards.
- Type stacks: Latin display Cormorant (500, italic permitted) or Playfair Display; body
  Mulish. Arabic display Amiri; body Almarai.
- The three owned tics: lace-edge borders, ribbon-bow seals, lid-lift reveals.
- Motion identity "ceremony": soft 0.8s power1 fades, one lid-lift, nothing else.
- Desktop law: centered mobile shell, ~470px, on wide ivory ground.
- Refused blocks: countdown, stock-urgency, lottery-contest, comparison-table.
- Imagery: ivory-satin trousseau photography per Signature Art.

CLIENT-OWNED — re-decided fresh for every build, never copied:
- Hero composition, chosen from the hero menu or invented inside its law.
- Block choice within the supported set, and BLOCK ORDER — a bedding chest and a bridal-gown
  page tell different ceremonies.
- Form style from the form menu.
- Proof emphasis: photo-reviews or whatsapp-proof or unboxing — pick what the product earns.
- Accent temperature: satin rose may warm toward blush or cool toward mauve within register.
- Where the single lid-lift lives (offer chest is default; a gown reveal may claim it).
- Section density: a single towel set runs 8 beats; a full trousseau chest can run 13.
Every client receives a new trousseau — same ceremony, different gifts. A clone fails the
contract.

3. VISUAL SIGNATURES

Measured values. Grounds: ivory #FCF8F1 base, champagne #F3E8D8 alternate sections, pearl
#FFFEFA cards. Ink: #4A3A33 headings, #6B584E body, #99857A captions. Satin rose #D9A7B0 for
CTAs and selected states (deepen to #C48F9B on press). Champagne gold #CBB07E exclusively as
1px rules, bow strokes and thin frames — never fills, never text beyond a 12px label.
Display type: clamp(30px, 8vw, 46px), line-height 1.15, Cormorant's long ascenders given
room; section titles clamp(21px, 5.5vw, 30px); body clamp(15px, 4vw, 16.5px) line-height
1.65 Latin, 1.8 Arabic. Prices set in display at clamp(22px, 6vw, 30px) with a 24px gold
rule above, centered. Radii: 14px on cards (soft, boxed like chests), 999px pills only for
small chips; photos square-cornered inside 1px gold frames. Shadows: one whisper only —
0 8px 24px rgba(74,58,51,0.07) under lifted lids and the offer chest; everything else flat.
Spacing: sections clamp(60px, 15vw, 92px); inside cards a 20px rhythm.

The tics, precisely:
- LACE-EDGE BORDERS: section edges carry an SVG lace strip 18-28px tall — a repeating
  openwork motif (pierced circles and petals, actual holes showing the ground beneath), in
  pearl on champagne or champagne on ivory. Never a plain bump row; if the holes disappear,
  it is not lace and it does not ship.
- RIBBON-BOW SEALS: a drawn satin bow (two loops, two angled tails, center knot, subtle
  sheen gradient) sits at the top-center of sealed cards — the offer chest, the guarantee,
  the CTA may carry a miniature. Bows are 36-72px wide, satin rose or champagne gold, max
  three per page.
- LID-LIFT REVEALS: the offer block is drawn as a chest/box; on first entry its lid (top 28%
  of the card) rotates up 24 degrees from the top hinge, once, 0.9s, then stays open. Under
  reduced-motion and no-JS the lid is already open. One lid per page.

4. COLOR PHYSICS

Ground register: #FCF8F1 to #F3E8D8 — the alternation is tissue-paper turning; both stay warm
ivory, never cooling toward gray or dropping below 90% lightness. Pearl #FFFEFA is card
stock reserved for the offer chest, form and review cards. Ink register: #4A3A33 / #6B584E /
#99857A — warm sepia line; pure black is forbidden (it reads funereal on ivory). Accent
register: satin rose #D9A7B0, may drift blushward #E2B4BC or mauveward #C79AA6 — one
temperature per build, coverage under 10% of any viewport. Champagne gold #CBB07E is
jewelry: rules, bow strokes, frame hairlines — under 4% and NEVER a gradient or metallic
text effect. Support: leaf sage #A8B097 allowed once per page for a botanical sprig accent.
Forbidden: black, saturated reds, hot pinks (Gloss territory), cold grays, dark sections of
any kind, silver, and any second accent family.

5. TYPOGRAPHY

Latin stack. Display: Cormorant (500) — engraved-invitation elegance, italic permitted for
one emotional line per page; Playfair Display (500/600) when the client wants firmer
serifs. Body: Mulish (400/600). Pairing rule: one display + Mulish, never two displays.
Small-caps labels 11-12px letter-spaced 0.16em Latin only ("LE TROUSSEAU", "قطعة بقطعة" set
plain). Arabic stack. Display: Amiri (400/700) — its naskh dignity is the invitation voice;
body Almarai (300/400). Amiri pairs only with Almarai. Size clamps shared across scripts;
Arabic display renders ~8% smaller at the same clamp (set top end 42px). Arabic body
line-height 1.75-1.9; NEVER letter-spacing on Arabic. Digits: Western Arabic numerals for
prices and phones; phone numbers wrapped in an LTR span. RTL mirroring: logical properties
everywhere; lace strips and bows are symmetric so they do not mirror; the lid hinge stays on
top; tails of bows may flip.

6. SIGNATURE ART & COMPONENTS

The chest is the master component: a pearl card, 1px gold frame inset 8px, lace strip along
its top inner edge, bow seal at top-center, lid-lift on entry. Offers, gift-set contents and
the final form all may live in chests (only the offer animates). Supporting cast: invitation
cards (pearl, centered, gold rule top and bottom); tissue dividers (a faint champagne fold
line across the ground); sprig accents (one thin sage botanical line drawing per page,
optional); chip buttons (ivory pills, 1px gold border, rose text); the CTA — a satin-rose
pill, pearl text, miniature bow at its start edge, generous 56px height.

Imagery. Trousseau photography on ivory: satin bedding, lace close-ups, folded towels tied
with ribbon, gift boxes with real fabric bows, soft romantic window light from one side,
gentle falloff, no hard shadows. Palette in-frame: ivory, champagne, satin rose, touches of
gold. Styling is abundant but ordered — stacks, folds, nested boxes — never scattered. No
faces; hands allowed wearing simple gold. No text, no logos in frame. For any product in
this world's niches the treatment holds: the object is photographed as a GIFT — wrapped,
tied, nested, presented — under the same ivory romantic light.

7. THE SPINE

Hook, convince, offer, order form — in that order, always. Price placement law: the price
appears in the hero, set small and confident like an engraved line under the product name
(never a starburst, never oversized), and repeats inside the offer chest. Sticky CTA: a slim
ivory bar, gold hairline on top, satin-rose pill "اطلبي الطقم" with price beside it; it
appears after the hero scrolls past and always scrolls to the form. Mobile-first at 390px;
desktop is the centered mobile shell (~470px) floating on wide ivory with generous margins —
the page is a card of invitation on a linen table.

8. BLOCKS TREATMENT

Supported blocks, dressed by Jihaz:
- announcement-bar: one ivory line, gold hairlines above and below, a single fact ("توصيل
  لكل الولايات · الدفع عند الاستلام"). Never rotates, never flashes.
- problem-solution: told as "before the day" worries — التجهيز يرهق — resolved by the
  complete chest; two short scenes, tissue divider between them.
- benefits-icons: 3-5 pearl chips with thin line icons (weave, softness, count, gift-wrap),
  lace strip under the row.
- unboxing-gallery: the chest opened — "داخل الصندوق" grid with piece count badge in a bow-
  sealed corner chip; every piece photographed folded.
- variant-gallery: colorways as fabric swatch squares with 1px gold frames; selected swatch
  gains a miniature bow. Feeds the form.
- size-guide: for gowns/linens — a pearl card table in cm with a gentle "قيسي قبل ما تطلبي"
  note; never a diagram heavy with arrows.
- photo-reviews: guest-book style — name, city, date, two lines of thanks, small photo in a
  gold frame. Three to six entries.
- whatsapp-proof: allowed for reorder messages from mothers; bubbles restyled ivory/rose
  with the platform's shape but Jihaz's colors.
- stats-band: quiet numbers in a champagne band — "عرس مجهز 1200+" — serif numerals, no
  counters racing.
- guarantee-seal: a pearl card sealed with the largest bow on the page: exchange window,
  intact-arrival promise, pay-at-door line.
- price-anchor: the offer chest itself — old price in small struck sepia, new price engraved,
  savings spoken as "هدية منا" — then the lid-lift.
- bundle-offers: chest tiers — "طقم العروسة" vs "الطقم الملكي" — two chests side by side,
  the fuller one bow-sealed and flagged "الأكثر اختيارًا".
- order-steps: four steps as invitation lines with tiny icons: تأكدي الطلب، نتصل بيك،
  التوصيل بعناية، الدفع عند الباب.
- faq + trust-footer: faq as gold-ruled accordion lines; footer ivory with phone, WhatsApp,
  and the promise line, lace strip closing the page.
Refused blocks: countdown (ceremony does not tick), stock-urgency (scarcity is vulgar at a
wedding), lottery-contest (gifts are given, not gambled), comparison-table (a trousseau is
not argued against rivals).

9. HERO MENU

- The Presented Chest: product photographed in/beside an open gift chest, name above, price
  engraved beneath, CTA pill, lace strip at the hero's base. The default ceremony.
- The Flat-Lay Invitation: top-down satin flat lay fills the top 60%, then a pearl invitation
  card overlaps with name, line of promise, price, CTA.
- The Gown Reveal: for apparel — full-height photo right (RTL: left), text column with an
  italic emotional line, price, CTA; the single lid-lift may move here to unveil the photo.
- The Nested Boxes: three stacked boxes (small to large) as a composition photo, headline
  over ivory, price and CTA below — for multi-piece sets.
- The Guest's Glimpse: story-hook hero — one Amiri line ("الليلة تليق بيها كل التفاصيل"),
  small photo in gold frame, price, CTA; quietest option.
- The Swatch Welcome: variant-first hero for fabric-led products — swatch row directly under
  the promise line, price updates per swatch, CTA follows.

10. FORM MENU

- Invitation Card (default): single pearl card, gold rules top/bottom, fields stacked with
  visible labels, bow seal at the top, CTA pill inside; COD reassurance in a sepia line
  directly beneath.
- Two-Page Invitation: a two-step wizard — page one chooses the set/variant (swatches), page
  two takes name, phone, wilaya; progress shown as two small bows (tied = done).
- Chest-Echo: a compact three-field form inside the hero's chest for decided buyers, repeated
  in full at the page end; both validate identically.
- Registry Style: form preceded by a short "لمن الهدية؟" choice (للعروسة / هدية) that only
  changes the success message — the fields remain the COD minimum.

11. MOTION IDENTITY

Ceremony: entrances are 0.8s power1.out fades with 10px rises, staggered 90ms; the page
breathes at the pace of unwrapping. The ONE signature moment is the lid-lift on the offer
chest — 0.9s, top-hinge rotation, once, never looping. Bows do not animate; lace does not
move; nothing pulses. Reduced motion: everything visible, lid open, zero tweens. All motion
gated per DEMO-LAWS (gsap + ScrollTrigger + no reduced-motion preference), gsap.set only for
hiding, page fully readable without JavaScript.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: doudou's
cloud-scallop edges (Jihaz edges are pierced lace, never plain bumps); rimel's blush orbs
and lash-tick halos; velin's double-filet rules; orfevre's filigree corners and gold
engravings; kenz's velvet jewel-box panel; caravane's saddle stitches and rivets; folies'
gold chevrons and sunbursts; gloss's vanity bulbs and drips; dahab's crimson vitrine panels
and per-gram plaques (the gold shop is the sister world — hard wall); warqa's cut-paper
layers (lace is textile openwork, never cut silhouettes). Jihaz's own temptations, banned:
more than three bows per page, gold fills, a second lid-lift, doily-everything, glitter
textures, hot pink, and any urgency device. Refused blocks restated: countdown,
stock-urgency, lottery-contest, comparison-table.

13. EXAMPLE VARIATIONS

- "Sanduq El Aroussa" — home & kitchen (satin bedding chest, ar-DZ). Presented Chest hero;
  announcement, benefits, unboxing-gallery, photo-reviews, guarantee-seal, price-anchor
  chest, bundle chests, order-steps, form, faq, footer. Invitation Card form. Mood: the
  classic ceremony. Lid-lift on the price-anchor.
- "Fouta & Or" — home & kitchen (towel set with gold embroidery). Flat-Lay Invitation hero;
  problem-solution (guests arriving), benefits, variant swatches, whatsapp-proof, stats,
  guarantee, offer chest, form, footer. Chest-Echo form. Mood: warm hospitality; lid-lift
  stays on the offer.
- "Robe de Henna" — fashion & apparel (embroidered gown, fr-DZ). Gown Reveal hero carrying
  the single lid-lift as the photo unveil; size-guide, variant swatches, photo-reviews,
  guarantee, price-anchor (static chest), form, faq. Two-Page Invitation form. Mood:
  couture hush.
- "Taqm Dhahabi" — jewelry & watches (gold-plated wedding set). Nested Boxes hero;
  benefits, unboxing, photo-reviews with guest-book framing, guarantee with the page's
  largest bow, price-anchor chest with lid-lift, form, footer. Invitation Card form. Mood:
  precious and brief — nine beats only.
- "Trousseau Bébé" — kids & baby (newborn gift chest). Guest's Glimpse hero; problem-
  solution (first visits), unboxing with piece count, benefits, whatsapp-proof from new
  mothers, guarantee, offer chest (lid-lift), form, faq, footer. Registry Style form. Mood:
  the softest issue of the world.
- "Swatch Ceremony" — home & kitchen (curtain fabric by meter). Swatch Welcome hero;
  variant-gallery leading, size-guide (measures), photo-reviews, stats band, guarantee,
  price-anchor, form, footer. Two-Page Invitation form. Mood: fabric-first, price per meter
  engraved small.
- "Hadiyya Express" — jewelry & watches (gift under 5000). A lean 8-beat sprint: Presented
  Chest hero, benefits, photo-reviews, guarantee, offer chest with lid-lift, Chest-Echo
  form, faq, footer. Mood: small gift, full ceremony.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
