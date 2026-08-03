import type { DesignWorld } from "../types";

export const atay: DesignWorld = {
	id: "atay",
	name: "Atay",
	family: "mint-tea",
	tagline: "Mint, brass and a high golden pour of hospitality",
	kind: "cod",
	mood: ["ceremonial", "minted", "golden", "hospitable"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["home & kitchen", "jewelry & watches", "health & wellness"],
	avoidFor: ["electronics & gadgets", "car accessories", "fitness equipment"],
	fusesWith: ["dar", "hammam", "fanous"],
	preview: {
		ground: "#EAF3E7",
		ink: "#17352A",
		accent: "#C08A3E",
		fontFamily: "Reem Kufi",
		sampleWord: "أتاي",
	},
	doc: `
ATAY — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Atay is the Moroccan tea ceremony at golden hour: the brass teapot lifted high, the thin
amber arc falling perfectly into a small glass, mint bruised just enough, the tray engraved by
somebody's grandfather. This world sells hospitality objects — tea sets, trays, serveware,
gifts of welcome — and it sells them the way tea is offered: without hurry, with pride, to a
guest who matters. The page is a سدّر ceremony: each section is presented like a glass passed
with the right hand, and the buyer is never rushed toward the form — they arrive there the way
a guest accepts a third glass, because refusing would be a shame.

The palette is the ceremony itself: mint milk and deep mint for the leaves, brass for the
pot, amber for the tea in its glass. The voice is hospitable and exact — measurements exist
(6 كيسان، صينية 40 سم) but they are spoken like family facts, not specifications. Everything
generic is banished: no urgency theater, no countdowns, no comparisons. Atay convinces by
making the buyer FEEL the ceremony they are about to own. The spine — hook, convince, offer,
order form — pours in order: the arc catches the eye, the craft convinces, the offer is the
tray presented, and the form is the guest saying yes.

Self-audit checklist — answer YES to ship:
- Does the hero glow golden-hour — brass warm, mint fresh, the pour visible or promised?
- Is the price stated with dignity in the first viewport, near the CTA, no theater?
- Does exactly ONE pour-arc draw itself, at the offer, and nowhere else?
- Are tea-glass rows doing the work of every step and rating — never plain bullets or stars?
- Do brass-tray circles hold the offer or key content — engraved edge visible?
- Is the copy hospitable Darija-inflected Arabic (or warm French) with zero promo shouting?
- Fully readable with JavaScript off, zero overflow at 390 / 768 / 1440?
- Could a stranger sort this from the warm-home world and the spa world in two seconds?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook, then convince, then offer, then order form. Invisible, inviolable.
- Palette registers: mint milk #EAF3E7 grounds with deep mint #1F5F4A sections; ink #17352A;
  brass #C08A3E; amber #C46A1F; linen white #FFFDF6.
- Type stacks: Latin display Marcellus or Cormorant, body Mulish; Arabic display Reem Kufi or
  Amiri, body Almarai.
- The three owned tics: pour-arc motifs, tea-glass rows, brass-tray circles.
- Motion identity: ceremonial pour — 0.7s gentle fades; ONE pour-arc draw at the offer.
- Desktop law: centered mobile shell, ~460px, on mint milk.
- Refused blocks: lottery-contest, countdown, spec-table, comparison-table.
- Imagery style: golden-hour tea-ceremony photography (full spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu, or invented inside the ceremony.
- Block choice within the supported set and BLOCK ORDER — a full tea set and a honey gift box
  are served differently.
- Form style from the form menu.
- Proof lead: photo-reviews or the artisan's origin story — one pours first.
- Where the deep-mint sections fall (one to three), and which content earns the tray circle.
- Density: an intimate 8-block serving or a full 12-block ceremony.
Every client receives a new sibling — same ceremony, different house. Repeating a previous
hero + block order + form combination fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: mint milk #EAF3E7 base; softened alternate #E2EEDF; deep mint #1F5F4A sections
  (one to three per page) with linen text; linen white #FFFDF6 cards.
- Ink: #17352A headings, #33523F body, #6B8073 captions on mint milk; on deep mint, linen
  #FFFDF6 headings with #CBDCC9 body. Pure black never appears.
- Brass #C08A3E: prices, CTAs, tray edges, the pour-arc; hover deepens to #A87430. Amber
  #C46A1F: tea-glass fills and small warm highlights only — never text.
- Display type: hero clamp(1.75rem, 6.8vw, 2.6rem), line-height 1.18 Latin / 1.38 Arabic;
  section titles clamp(1.35rem, 5vw, 1.85rem); body clamp(0.98rem, 4vw, 1.06rem) line-height
  1.65 / 1.85; prices clamp(1.4rem, 6vw, 2.1rem) in brass.
- Radii: cards 14px, fields 12px, chips 999px; the tray circle is, naturally, a circle.
- Borders: 1px solid rgba(23,53,42,0.14); brass keylines 1px rgba(192,138,62,0.5) reserved
  for tray circles and the offer. Shadows: a single soft breath, 0 6px 20px rgba(23,53,42,
  0.08), cards only.
- Spacing: sections 64 to 92px vertical on mobile — ceremony needs air; deep-mint sections may
  run closer, 56 to 72px.

The tics, precisely:
- POUR-ARC MOTIFS: a thin arc (1.5 to 2px stroke, brass) rising steeply and falling into its
  target — drawn as a single quadratic path with a slight steam waver (2 to 3px amplitude) in
  its upper third. Small pour-arcs (40 to 80px) may connect a section label to its content as
  static furniture, two per page maximum; THE pour-arc (140 to 220px) lives at the offer and
  is the only one that animates, drawing from pot-spout origin to glass-rim target.
- TEA-GLASS ROWS: steps, ratings and progress as rows of small tea-glass silhouettes (18 to
  26px tall — a waisted glass with a foot), amber-filled when active or earned, outlined in
  ink at 40% when pending. A 4-of-5 rating is four filled glasses; step two of three is two
  amber glasses and one waiting.
- BRASS-TRAY CIRCLES: round content containers drawn as a tray seen from above — a circle
  with a 1px brass keyline, an inner engraved ring (dashed-free: a second solid ring at 85%
  radius, 0.75px), and a subtle radial brass sheen at 6% opacity. The offer, a portrait of
  the artisan product, or the guarantee sits inside. One to two trays per page; the tray
  never spins.

4. COLOR PHYSICS

Ground register: mint milk #EAF3E7 to #E2EEDF carries most of the page; deep mint #1F5F4A to
#1A5342 sections hold the ceremony's shade — the offer or the origin story lives there. The
order form always sits on mint milk with a linen card.
Ink register: #17352A to #6B8073, a leaf-slate scale; warm grays banned.
Accent physics: brass #C08A3E is the pot — prices, CTAs, arcs, tray lines — capped at 10% of
any viewport. Amber #C46A1F is the tea — it lives INSIDE glasses and small highlights, capped
at 5%, and never sets type.
Support: linen #FFFDF6 cards are free. Forbidden: bazaar red-yellow, blue of any kind, pink,
purple, black grounds, gradients beyond the tray's 6% sheen, and lace or doily whites (that
ornament belongs elsewhere).

5. TYPOGRAPHY

Latin stack: display Marcellus (400 — its Roman calm carries ceremony) or Cormorant 500 for a
softer serif build; body Mulish 400/600. Pairing rule: one display + Mulish; display sets the
hero, section titles and prices; Mulish explains.
Arabic stack: display Reem Kufi (500/600) — geometric hospitality, the house voice — or Amiri
400 when the client's brand is classical; body Almarai 300/400/700. Pairing rule: Reem Kufi +
Almarai default; Amiri + Almarai for heritage builds.
Shared clamps as above; Arabic display at 94% of the Latin ceiling, line-height 1.38 minimum;
Arabic body 1.75 to 1.9. NEVER letter-spacing on Arabic; Latin small-caps labels (LE RITUEL,
الطقس in its own line) may take 0.06em at 11 to 12px.
Digits: Western Arabic numerals for prices and counts in both scripts; phone numbers wrapped
LTR. RTL: logical properties everywhere; pour-arcs mirror so the pot pours from the start
side; tea-glass rows fill from the start; x-slides reverse.

6. SIGNATURE ART AND COMPONENTS

The tics are the service. The pour-arc is generosity made visible — the higher the pour, the
greater the honor, and the page pours highest at its offer. Tea-glass rows replace every cold
UI meter with hospitality: progress is glasses served, rating is glasses emptied. Brass-tray
circles present — whatever sits on the tray is being OFFERED, and the buyer knows it.

Supporting cast: linen cards with the single soft shadow; mint-sprig-free dividers (a plain
1px ink rule at 14% — greenery lives in photos only); brass chip labels (كيسان ٦، نحاس مطروق)
with the engraved double-ring edge motif shrunk to pill scale; the sticky bar as a deep-mint
band with linen text and a brass button; a hospitality line under the CTA ("الدفع عند
الاستلام، والتقدير قبل كل شيء").

Imagery: golden-hour Moroccan tea-ceremony photography. Brass teapot lifted mid-pour, the
amber arc caught sharp against soft depth; engraved trays, small glasses, fresh mint and a
sugar loaf as props; warm side-light with honeyed shadows; hands serve without faces. Banned
in photos: café-menu styling, teabags, mugs, marble minimalism, cold studio light. The
palette must be IN the frame: mint, brass, amber, linen.

7. THE SPINE

Hook, convince, offer, order form — served in order, invisible. Price appears in the HERO,
set in brass with quiet confidence — a guest is told the truth immediately. The sticky CTA is
a deep-mint band with the price always visible and a brass button; tapping pours the page
down to the form. Mobile-first at 390px. Desktop law: centered mobile shell — the page holds
~460px on a wide mint-milk ground, like a tray carried through a riad; the ground may carry
one faint oversized tray-ring at 3% opacity, fixed.

8. BLOCKS TREATMENT

Supported blocks, dressed by Atay:
- announcement-bar: one linen line on deep mint — delivery cities, COD, تغليف الهدية مجاني;
  a small tea-glass as separator.
- problem-solution: the hollow-hospitality pain (ضيوف بلا طقم يليق، صينية مستعارة) told softly
  on mint milk, answered on deep mint with the set gleaming; two beats, no shame theater.
- benefits-icons: 4 to 5 linen chips with 2px glyphs (pot, glass, tray, flame) — one line
  each, hospitality-first wording.
- how-it-works-steps: the ritual in 3 gestures (غسل بالنعناع، التخمير، الصبة العالية) marked
  by a tea-glass row filling step by step.
- ingredients-infographic: for consumable builds (tea, mint blends, honey) — origin and notes
  on a linen card with brass chips; for sets it becomes the craft card (نحاس مطروق يدويًا،
  نقش فاسي).
- unboxing-gallery: what the courier presents — بريق، ٦ كيسان، صينية، علبة هدية — each piece
  photographed on the tray and named in a brass chip.
- photo-reviews: linen cards, reviewer name and city (مراكش، فاس، الرباط), ratings as amber
  tea-glass rows; one photo of a served table per two reviews.
- guarantee-seal: a brass-tray circle holding the promise — تبديل خلال ٧ أيام، نحاس أصلي —
  with the pay-at-the-door line beneath.
- price-anchor: old price struck softly in ink 55%, new price in brass, the per-guest math
  offered gently ("أقل من ٧٠ درهم للضيف الواحد"); presented inside or beside a tray circle.
- bundle-offers: solo set vs set + توابع (سكر، نعناع مجفف، كيسان إضافية) as two linen cards;
  the fuller tray earns the brass keyline; feeds the form.
- variant-gallery: engraving or size choices as linen cards with brass chips; selected card
  gains the engraved double-ring edge.
- order-steps: 4 steps with tea-glass markers (اطلب، نتصل بك، التوصيل، الدفع عند الباب);
  the confirmation call framed as courtesy.
- faq: mint-milk rows, brass chevrons; entretien du cuivre, delivery time and return questions
  mandatory.
- trust-footer: deep mint ground, linen text, phone and WhatsApp large, the host's line
  ("الأتاي فرض، والضيف عزيز") and legal quiet beneath.

Refused blocks:
- lottery-contest: hospitality is never a raffle; a prize wheel would empty every glass.
- countdown: ceremony has no timer; urgency insults the guest.
- spec-table: measurements live in craft cards and chips; an engineering grid chills the tea.
- comparison-table: a host never argues against another house's tray.

9. HERO MENU

- La Haute Pourée (full-bleed): the pour photograph full-width, title and price on a linen
  panel at the lower third, a small static pour-arc linking kicker to title.
- Plateau Présenté (offer-card): the hero is one brass-tray circle holding the set's photo,
  with title above, price and CTA below — the offer made in the first breath.
- Sedder Split: photo left (set at golden hour), stack right — kicker, title, craft chip,
  price, CTA; stacks at 390px with the tray circle waiting below.
- L'Invitation (story-hook): a kicker of welcome (الليلة عندكم ضياف؟), the title answers with
  the set, photo beneath, price and CTA on linen.
- Geste d'Artisan (craft-first): the engraving macro opens the page, the artisan's line under
  it, then title, price, CTA; for heritage builds.
- Le Cadeau (gift-first): the boxed set photographed sealed, تغليف مجاني chip, title, price,
  CTA; for gifting seasons.

10. FORM MENU

- Carte d'Hôte (single card): one linen card — name, phone, city select, engraving/size row as
  brass chips, brass submit; the hospitality line beneath.
- Écho du Premier Verre (hero-echo): two fields under the hero for the already-convinced,
  repeated in full at the end; the mini pours into the full on submit.
- Deux Services (2-step wizard): coordinates first, delivery and gift-wrap second; progress as
  two tea-glasses filling.
- Barre du Plateau (sticky-driven): the deep-mint band is the only CTA until the form; tapping
  focuses the first field.

11. MOTION IDENTITY

Ceremonial pour: entrances are gentle fades with 10 to 14px rises, 0.7s, sine easing, staggers
at 140ms — nothing in a ceremony hurries. The ONE signature scroll moment: at the offer, THE
pour-arc draws itself (1.1s) from spout to glass, the steam waver settling last. Tea-glass
rows fill glass by glass (0.25s each) as their step enters. Trays and rings never rotate.
Banned motion: loops, bouncing, overshoot, parallax, shimmer sweeps, spin of any kind. Under
prefers-reduced-motion: everything visible and still, the arc pre-drawn, glasses pre-filled.
All motion gated on gsap + ScrollTrigger; content never hidden in CSS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-for-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics, banned by name: riviera's painted ceramic plaques; dar's gingham hems and
daylight beam (the home sibling — Atay is ceremony, not kitchen morning); argan's oil ribbon
and crushed-spice swatches; hammam's pebble stacks and ripple rings; fanous's lantern strings
and tassel fringes; herbier's botanical plates and pressed leaves (mint lives in photographs
only, never as drawn sprigs); atlas's dotted routes (the pour-arc is a POUR — it begins at a
spout and ends in a glass, never connects locations).
Own temptations, also banned: mint-leaf clip-art, mosaic-tile borders, arabesque frames,
teapot mascots, and the pour-arc multiplied into decoration.
Refused blocks restated: lottery-contest, countdown, spec-table, comparison-table.

13. EXAMPLE VARIATIONS

- "طقم الساحة الكامل" — home & kitchen. Plateau Présenté offer-card hero; announcement-bar,
  problem-solution, unboxing-gallery, photo-reviews, guarantee-seal, price-anchor, bundle-
  offers, order-steps, faq, trust-footer; Carte d'Hôte form. Mood: the family's first proper
  سدّر. Signature: THE pour-arc crowns the price.
- "بريق فاسي منقوش" — home & kitchen. Geste d'Artisan craft-first hero; ingredients-
  infographic as craft card, photo-reviews, variant-gallery (نقش), price-anchor, guarantee-
  seal, order-steps, faq, trust-footer; Deux Services wizard. Mood: heritage bought once.
- "هدية العيد الجاهزة" — home & kitchen. Le Cadeau gift-first hero; unboxing-gallery, photo-
  reviews, guarantee-seal, price-anchor, order-steps, faq, trust-footer; Écho du Premier
  Verre form. Mood: the gift that ends the search.
- "أتاي وأعشاب الجبل" — health & wellness. L'Invitation story-hook hero; ingredients-
  infographic, how-it-works-steps, photo-reviews, bundle-offers, price-anchor, order-steps,
  faq, trust-footer; Carte d'Hôte form. Mood: the evening infusion, honored.
- "صينية العروس الفضية" — jewelry & watches. Sedder Split hero; problem-solution, unboxing-
  gallery, photo-reviews, guarantee-seal, price-anchor, order-steps, trust-footer; Barre du
  Plateau sticky-driven form. Mood: the tray that enters the trousseau.
- "كيسان مذهّبة ٦" — home & kitchen. La Haute Pourée full-bleed hero; benefits-icons, photo-
  reviews, variant-gallery, price-anchor, guarantee-seal, order-steps, faq, trust-footer;
  Écho du Premier Verre form. Mood: six small honors for the table.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
