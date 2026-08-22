# COD Worlds — authored funnels without a house template

## Why

A cash-on-delivery page is not a service landing page and not a product dossier
to admire. It is a pitch the visitor answers on a phone: one physical product,
one persuasive corridor and one embedded order form. Loose art direction tends
to polish away that shape; one fixed template would preserve the shape but make
every seller look identical.

COD worlds separate the two concerns. A shared genre layer owns what makes the
page a working funnel. Authored worlds own how that funnel looks, sounds and
moves. The result can vary radically without losing the order journey.

## What

The library contains 46 `kind: "cod"` worlds under
`apps/server/src/modules/ai-chat/agent/worlds/cod/`. Each is a complete
13-section visual system with a family, compatible fusion partners and a menu
preview (ground, ink, accent, display family and sample word). The barrel
registers all 46 in the global design-world registry.

`blocks.ts` is the single source of truth for a permanent 30-id block
vocabulary. Briefs use these ids for structure; each world's BLOCKS TREATMENT
dresses them:

- Spine: `hero`, `order-form`, `sticky-cta`.
- Persuasion: `announcement-bar`, `problem-solution`, `benefits-icons`,
  `ingredients-infographic`, `how-it-works-steps`, `before-after`, `spec-table`,
  `comparison-table`, `stats-band`, `video-testimonial`, `photo-reviews`,
  `whatsapp-proof`, `press-badges`, `guarantee-seal`.
- Offer: `price-anchor`, `bundle-offers`, `countdown`, `stock-urgency`,
  `lottery-contest`, `cross-sell`.
- Product detail: `variant-gallery`, `size-guide`, `unboxing-gallery`.
- Logistics and trust: `order-steps`, `delivery-map`, `faq`, `trust-footer`.

The three spine blocks always exist. Every other block is a deliberate menu
choice. A world may refuse a block; refusal wins even when that id appears in
the brief, and the builder covers the communication job another way.

The shared COD genre layer accompanies every COD build exactly once. It owns
the hook → convince → offer → form spine, no-navigation law, synchronized price
and CTA cadence, sticky-bar lifecycle, canonical COD form and success state,
honest proof and urgency, photo use, RTL and digit rules, responsive desktop
choices, explicit page density and anti-slop bans. It also bridges each world's
literal hexes, type stacks and radii into the canonical CSS tokens required by
the builder. Worlds dress this law; they do not remove it.

Locale facts are variables, not Algeria baked into the template. The brief
carries the country, phone validation, currency glyph and placement, region
name and options, and delivery fee model. Algeria is the default: phone regex
`/^0[567]\d{8}$/`, DZD (`دج` or `DZD`), 58 wilayas, a commune field, and
separate home and stopdesk fees. Another market replaces those values without
changing the funnel contract.

## How it flows

1. COD mode starts when the composer goal is `cod`, or when the conversation is
   about selling a physical product with delivery. The Brain collects the
   product, offer and price, variants, delivery fees and real photos.
2. It fires one optional multi-select question with at most six relevant
   funnel ideas, in the user's language and with plain labels. Choices come
   from bundles, countdown, before/after, WhatsApp proof, size guide,
   comparison, stock urgency and video proof. The helper says that skipping
   delegates the choice to the AI. Universal blocks such as reviews, FAQ,
   benefits, order steps, guarantee and price anchor are never made busywork.
3. Selected choices become ids in the brief's ordered `SECTIONS`; explicitly
   unselected contested choices stay out unless the user requested them in
   prose. If the question is skipped or dismissed, the AI chooses. In every
   case a world's refused blocks still win.
4. The Brain calls `get_direction_candidates` with `pageKind: "cod"`, the
   business and COD industry hints. The server returns eight freshly shuffled
   worlds, excludes bad fits, caps industry-affine seats at four and tops up
   compatible partners so the menu contains fusion routes when possible.
5. The Brain selects one **base** and two or three **donors** from that menu,
   then writes the brief with ordered block ids, a short/full density decision
   and locale facts. It calls `generate_page` once with `worldIds` in base-first
   order and `pageKind: "cod"`.
6. The builder receives base prompt + genre layer + fusion contract + world
   documents. The base governs palette, type, spine, refused blocks and motion.
   A donor lends at most one or two signatures or component treatments,
   redressed in the base skin. Base wins conflicts; refused blocks are the
   union. The finished page must read as one new pressing, not a patchwork.
7. The generated order form follows the existing `wandit:lead` event contract.
   Canonical `name`, `phone`, `wilaya` and `commune` keys remain first-class;
   the order facts use the canonical extras keys `product`, `quantity`,
   `price`, `delivery` and `total` (promoted into first-class columns by the
   CRM and exports); any other collected value travels under its own extra
   key.

## Deliberately not here (yet)

- **World cooldown:** there is no persisted memory of worlds previously served
  to a seller or vertical. Each menu is randomized independently.
- **Per-block HTML validation:** the genre prompt and world refusals govern
  block output, but no post-generation validator proves that every requested
  block id was rendered correctly.
- **Visual block picking:** the block question uses the existing text
  multi-select request tray. A thumbnail or visual-pick interface is deferred.
- **Lead order database columns:** the promoted order facts (product,
  quantity, price, delivery, total) stay in the lead extras jsonb; the CRM and
  exports recognize them at read time (canonical keys + synonym aliases in
  `@wandit/contracts`), so this feature still adds no dedicated database
  columns or migration for them.
