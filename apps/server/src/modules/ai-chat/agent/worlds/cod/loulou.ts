import type { DesignWorld } from "../types";

export const loulou: DesignWorld = {
	id: "loulou",
	name: "Loulou",
	family: "pearl-gulf",
	tagline: "Nacre light and graded pearls of the Gulf",
	kind: "cod",
	mood: ["pearlescent", "heritage", "serene"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["jewelry & watches", "beauty & cosmetics", "fashion & apparel"],
	avoidFor: ["electronics & gadgets", "home & kitchen", "car accessories"],
	fusesWith: ["kenz", "dahab"],
	preview: {
		ground: "#F7F5F0",
		ink: "#23312E",
		accent: "#BFA05C",
		fontFamily: "Cormorant Garamond",
		sampleWord: "لولو",
	},
	doc: `
LOULOU — THE PEARL DIVER'S INHERITANCE

1. PHILOSOPHY

Before oil, the Gulf's fortune came up on one held breath. Loulou sells with that
inheritance: nacre whites, sea-green depths, and the patience of a diver who knows the best
oyster is opened last. This world is the counter of a Doha pearl house — daylight through
muslin, strands laid straight on cloth, a certificate signed by hand. Nothing floats,
nothing glows theatrically; value here is GRADED, not shouted. The page persuades the way a
jeweler does: it lays the strand flat, lets the luster speak, states the origin, and only
then names the price. Underneath runs the same COD spine as every world — hook, convince,
offer, order form — walked at tide speed: the hero shows the piece and its price plainly,
the middle proves luster and lineage, the offer arrives with its certificate, and the form
closes with payment at the door, as tradition prefers. Copy is serene, exact, respectful —
the voice of inheritance, never of promotion. Loulou serves pearls first, then quiet
beauty and elegant dress — anything whose argument is luster.

Self-audit checklist — answer yes before shipping:
- Do pearls appear STRUNG or GRADED — never scattered like pebbles, never floating?
- Is every pearl-strand rule laid perfectly straight, horizontal, at section boundaries?
- Is the nacre sheen subtle — a whisper of blush/mint/sky under 8% — never chrome?
- Does the sea-green hold its depth (#143C3C), reserved for interludes and ink moments?
- Is the certificate present wherever authenticity is claimed?
- Could the whole page be read aloud in a pearl house without one embarrassing word?
- Is gold thread confined to 4% — clasps, a rule, price numerals?
- Zero horizontal overflow at 390 / 768 / 1440, fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. In order, invisibly.
- Palette registers: pearl #F7F5F0 grounds with deep sea-green #143C3C sections; ink
  #23312E; nacre sheen pastels at ≤8% opacity; gold thread #BFA05C at ≤4%.
- Type stacks: display Cormorant Garamond or Marcellus; body Jost. Arabic display Amiri or
  Reem Kufi; body Noto Naskh Arabic.
- The three owned tics: laid pearl-strand rules, nacre-sheen cards, pearl-gradation rows.
- Motion identity: pearl roll — 0.6s gentle eases; the gradation row rolls in once.
- Desktop law: centered mobile shell, ~465px.
- Refused blocks: lottery-contest, countdown, stock-urgency, spec-table, whatsapp-proof.
- Imagery style: gulf pearl photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER — a necklace page and a
  pearl-cream page must not share a sequence.
- Form style from the form menu, and whether a quiet echo exists.
- Proof lead: photo-reviews or certificate-forward guarantee — choose per clientele.
- Where the sea-green interludes fall (one or two per build).
- Section density: one strand may run 8 serene beats; a parure 12.
Every client receives a new sibling — same waters, different dive. Repeating a previous
hero + form + block order combination fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: pearl #F7F5F0 base, warm variant #F3F0E8; sea-green interludes #143C3C (one to
  two per build, offer and/or provenance); card surface #FCFBF7.
- Ink: #23312E on pearl; pearl ink on sea-green is #F0EDE5. Secondary #5A6560; captions
  #8C948F.
- Gold thread #BFA05C: price numerals, clasp glyphs, one hairline rule per viewport at
  most; cap 4%.
- Nacre sheen: a soft iridescent wash on card surfaces — layered radial tints of blush
  #E8C8C8, mint #C8E0D4 and sky #C8D6E4, each at 4-8% opacity, angled 120deg apart — the
  effect of tilting shell in light. Never on text, never above 8% per tint, never chrome or
  specular.
- Display type: hero clamp(1.9rem, 7vw, 2.7rem), line-height 1.2 Latin / 1.5 Arabic;
  section titles clamp(1.4rem, 5vw, 1.85rem); body clamp(0.98rem, 4vw, 1.05rem), line-height
  1.65 Latin / 1.85 Arabic; price clamp(1.5rem, 6vw, 2.1rem) in gold thread.
- Radii: 16px cards, 999px only on pearls themselves and the CTA (a strand-smooth pill),
  10px fields.
- Borders: 1px #E2DDD0 on pearl cards; sea-green sections borderless. Shadows banned — the
  sheen is the only surface event.
- LAID PEARL-STRAND RULES (tic): section dividers as a strand of drawn pearls laid straight
  — 9 to 15 circles, 8-12px, pearl fill with a single top-start highlight dot each, knotted
  gaps of 3px, a thread hairline visible between; perfectly horizontal, centered, never
  hanging, never curved.
- NACRE-SHEEN CARDS (tic): as measured above; applied to review cards, the offer card and
  the certificate.
- PEARL-GRADATION ROWS (tic): progress and steps as pearls sized small to large — 8, 12,
  16, 22px — completed steps full pearl, pending steps outlined; the row reads start to end
  (mirrored in RTL).
- Spacing rhythm: sections clamp(64px, 16vw, 96px); strands given clear water above and
  below (min 28px).

4. COLOR PHYSICS

Ground register: pearl #F7F5F0 to #F3F0E8 — always warm, never clinical white. Sea-green
#143C3C is the depth the pearls came from: one or two interlude sections, ink moments, the
sticky bar. Ink register: #23312E / #5A6560 / #8C948F on pearl; #F0EDE5 on depth. Accent
physics: gold thread #BFA05C is the clasp of the page — prices, one rule, small glyphs;
4% cap, and it never becomes dahab's abundant gold or kenz's engraved metallic. Nacre
tints exist only as surface sheen, never as type or fills. Form errors: muted coral
#B05A4E inline. Forbidden: black, chrome and specular whites (an2000's), crimson (dahab's
vitrine), turquoise brights, gradients outside the three nacre tints, silver, and any
second metallic.

5. TYPOGRAPHY

Latin stack. Display: Cormorant Garamond (500/600) — its fine contrast is nacre itself;
Marcellus as the alternative for rounder builds. Body: Jost (300/400). Pairing rule: ONE
display + Jost; display carries hero, titles, prices; Jost carries argument and form;
labels 11px caps tracked 0.15em (Latin only).
Arabic stack. Display: Amiri (400/700) for classical builds, Reem Kufi (500) when the
client is contemporary; body Noto Naskh Arabic (400). Pairing rule: Amiri with Noto Naskh,
or Reem Kufi with Noto Naskh; never mix the two displays.
Shared clamps as measured; Arabic display ~8% smaller. RTL law: logical properties
throughout; no letter-spacing on Arabic ever; Arabic body line-height 1.8-1.9; digits
Western, prices wrapped LTR («1 150 ر.ق» as one unit); gradation rows and strand highlights
mirror to keep the light top-start; x-drift flips sign.

6. SIGNATURE ART AND COMPONENTS

The strand is the world's signature made literal: laid pearl-strand rules divide the page
the way strands divide a jeweler's cloth. Nacre-sheen cards carry everything precious —
reviews, the offer, the certificate. Pearl-gradation rows measure steps and progress the
way a house grades a harvest. Supporting cast: the certificate card (pearl ground, 1px gold
rule top and bottom, hand-set serial line, sea-green signature stroke); clasp glyphs (a
tiny gold hook-and-eye) marking guarantees; a muslin-texture band (2% noise on pearl) for
the announcement; oyster-free provenance blocks — text set on sea-green with a single laid
strand beneath the title; review stars as five 6px pearls, filled by rating. Photography
sits in 16px frames or bleeds within the hero only.

Component measurements, for the builder's hand: strand rules center on a 44px band — pearls
8-12px with 2px highlight dots at 10 o'clock (2 o'clock in RTL), thread hairline 1px at 30%
ink; the certificate card holds 24px padding, its gold rules exactly 1px at full #BFA05C,
serial line set in 11px caps tracked 0.2em (Latin only), signature stroke a single 2px
sea-green path; nacre sheen layers are radial gradients 140% of card size, centers offset
to three corners; gradation rows sit on a shared baseline so pearls grow upward from it;
review pearls-as-stars are 6px with 3px gaps. Copy register: the voice inherits, never
insists — sentences average ten words; the words luster, grading, certificate and door
appear once each per page at most; prices are stated as fact ("the set is 1 150"), never
as opportunity; the second person is reserved for the fitting moments (how it closes at
your neck) and the doorstep promise. Nothing is ever "limited"; scarcity belongs to the
sea, not the page.

Imagery. Gulf pearl photography: real strands and studs on nacre-white grounds, deep
sea-green silk as the only prop color, soft diffused daylight as through muslin, luster
highlights kept honest, macro on surface overtones. Compositions are LAID — pieces
arranged flat, strands straight, gradations ordered small to large. A wearing shot crops
chin-down. Banned in photos: faces, black velvet (kenz), crimson velvet (dahab), scattered
loose pearls (they read as pebbles — hammam's), underwater scenes, divers, chrome
surfaces, any second jewelry metal dominating.

7. THE SPINE

Hook, convince, offer, order form — the dive, the ascent, the opening, the sale. Price
placement: IN THE HERO, gold-thread numerals beneath the piece's name, stated once and
plainly (no strike theater unless the client insists; then a single thin line through the
old price). Sticky CTA: a sea-green bar, pearl-ink label, price in gold, the button a
pearl-smooth pill; appears after the hero, leads to the form. Mobile-first at 390px.
Desktop law: centered mobile shell ~465px on the pearl ground, quiet water either side.

8. BLOCKS TREATMENT

Supported blocks, dressed by Loulou:
- announcement-bar: one muslin-textured pearl line — delivery + payment at the door — a
  tiny clasp glyph as separator. Static, serene.
- problem-solution: the inheritance paragraph — why plated fades and luster does not — set
  against a laid-strand photo; one strand rule beneath the title.
- benefits-icons: 3-4 lines with small pearl bullets — luster, grading, certificate,
  clasp — ledger-set, never icon circles.
- variant-gallery: strand lengths and stud options as nacre-sheen chips with per-variant
  laid photos; the chosen chip gains a gold clasp glyph. Feeds the form.
- size-guide: necklace lengths drawn as concentric laid strands (40, 45, 50cm) with a
  chin-down photo reference; lengths in Western digits.
- unboxing-gallery: the presentation — sea-green box, muslin pouch, certificate — one
  quiet flat lay with a numbered manifest.
- photo-reviews: 3-4 nacre-sheen cards, first name + city, pearl-star rating, two
  sentences; at most one faceless customer photo.
- guarantee-seal: the certificate card itself — authenticity, exchange within 7 days,
  luster guarantee — closed with the clasp glyph in gold.
- price-anchor: the verdict — piece name in display, gold price, payment-at-door line, a
  laid strand rule above; sheen on the card, lamp-free.
- order-steps: a pearl-gradation row of four — choose, leave name and phone, our call,
  payment at your door — each pearl annotated in one line.
- faq: 4-6 questions on pearl ground, strand-rule separators every second item, answers
  serene and short.
- trust-footer: sea-green depth — the house name in display, phone + WhatsApp, certificate
  note, policies in pearl ink.
Refused blocks: lottery-contest (heritage is not raffled), countdown and stock-urgency
(the tide does not haggle), spec-table (luster is not a datasheet), whatsapp-proof (this
house corresponds on paper).

9. HERO MENU

- The Laid Strand: full-bleed photo of the strand laid on nacre, title and gold price on
  the pearl margin beneath, pill CTA. The default.
- The Gradation: the pearl-gradation row IS the hero art — small to large across the
  viewport — with the piece photo beneath; for grading-first houses.
- The Certificate Open: hero split — piece photo start-side, certificate card end-side
  with the price on it; authenticity-led builds.
- The Depth Rise: sea-green hero, the piece photographed on green silk, pearl-ink title,
  price in gold; the page rises into pearl ground after.
- The Chin-Down: the wearing shot (faceless) full-bleed, title low, price and CTA on a
  nacre card overlapping the photo edge.
- The Parure Row: three pieces laid in a row (necklace, studs, bracelet), featured one
  centered, single price line for the set; capsule builds.

10. FORM MENU

- The Ledger of the House: single pearl card — name, phone, city, length/variant chips —
  hairline underlines, clasp-glyph submit. The default.
- The Two Tides: 2-step wizard — first the piece (variant, length), then the coordinates;
  a gradation row tracks the two steps.
- The Quiet Echo: phone + city beside the hero price for the decided, full ledger at the
  end; echo submit scrolls to the ledger.
- The Bar Clasp: the sticky bar opens the ledger with fields focused; for single-piece
  builds.

11. MOTION IDENTITY

Pearl roll. Entrances: opacity with 10px drift, 0.6s, sine.out, staggered 100ms; strand
rules fade in whole (never pearl-by-pearl — that is the gradation's privilege). The ONE
signature moment: the pearl-gradation row rolls in pearl-by-pearl — each pearl scaling
0.6 to 1 with 80ms stagger, once, on entry. Nacre sheen is static (no shimmer loops). No
parallax, no overshoot, no Ken-Burns, no sway. Reduced motion: all static and complete.
All motion gated on gsap + ScrollTrigger; the page reads fully without JavaScript.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur (voltage's only), back.out overshoot (guimauve's). Neighbors banned by name:
an2000's chrome text, glossy aqua orbs and specular sheen (nacre is matte whisper, never
gloss); jihaz's lace edges, ribbon bows and lid-lift reveals; mahra's silk-drape folds and
abaya outlines (sibling wall — no cloth-fold edges here); fanous's hanging lantern strings
and tassel fringes (Loulou's strands LIE FLAT, never hang); kenz's spotlight cone, gold
dust and velvet jewel-box; dahab's crimson vitrine panels, per-gram plaques and scale
chips; hammam's pebble stacks and ripple rings (pearls are strung or graded, never piled);
eclat's photo-orbit; iris's aura. Loulou's own temptations, banned: underwater imagery,
oyster-opening reveals (too close to jihaz's lid-lift), shimmer animation on sheen, more
than one gold rule per viewport, teal brights. Refused blocks: lottery-contest, countdown,
stock-urgency, spec-table, whatsapp-proof.

13. EXAMPLE VARIATIONS

- "Le Fil de Doha" — jewelry & watches (collier de perles de culture). Laid Strand hero;
  blocks: announcement, problem-solution, benefits, size-guide, unboxing, photo-reviews,
  guarantee-certificate, price-anchor, order-steps, faq, trust-footer; Ledger form.
  Gradation roll on order-steps. Mood: the house's front counter.
- "Grades du Golfe" — jewelry & watches (parure graduée). Gradation hero; blocks:
  announcement, benefits, variant-gallery, photo-reviews, guarantee, price-anchor,
  order-steps, trust-footer; Two Tides wizard. The hero row IS the signature roll. Mood:
  harvest sorted at dawn.
- "Certificat d'Abord" — jewelry & watches (studs, authenticity-led). Certificate Open
  hero; blocks: announcement, problem-solution, unboxing, photo-reviews, guarantee,
  price-anchor, order-steps, faq, trust-footer; Bar Clasp form. Roll lands on order-steps.
  Mood: signed before shown.
- "Crème de Nacre" — beauty & cosmetics (crème visage aux extraits de perle). Depth Rise
  hero; blocks: announcement, problem-solution, benefits, photo-reviews, guarantee,
  price-anchor, order-steps, faq, trust-footer; Quiet Echo + ledger. Roll on the benefits
  pearls. Mood: the luster ritual.
- "Portée Simplement" — fashion & apparel (robe de soirée perle, faceless). Chin-Down
  hero; blocks: announcement, benefits, variant-gallery, size-guide, photo-reviews,
  guarantee, price-anchor, order-steps, trust-footer; Ledger form. Roll on variant chips.
  Mood: worn, not shown off.
- "La Parure Héritée" — jewelry & watches (set complet, flagship). Parure Row hero;
  blocks: announcement, problem-solution, benefits, variant-gallery, unboxing,
  photo-reviews, guarantee, price-anchor, order-steps, faq, trust-footer; Two Tides
  wizard. Roll on the parure row itself. Mood: three generations at the counter.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
