import type { DesignWorld } from "../types";

export const tendance: DesignWorld = {
	id: "tendance",
	name: "Tendance",
	family: "startup-pop",
	tagline: "The friendly violet shop: airy, rounded, bilingual",
	kind: "cod",
	mood: ["friendly", "fresh", "rounded", "commercial"],
	energy: "medium",
	priceFeel: "accessible",
	industries: [
		"fashion & apparel",
		"electronics & gadgets",
		"home & kitchen",
		"kids & baby",
	],
	avoidFor: ["jewelry & watches"],
	fusesWith: ["bonplan", "circuit", "nadhara"],
	preview: {
		ground: "#FFFFFF",
		ink: "#17151F",
		accent: "#6C3EF4",
		fontFamily: "Bricolage Grotesque",
		sampleWord: "جديد Drop",
	},
	doc: `
TENDANCE — THE FRIENDLY VIOLET SHOP

1. PHILOSOPHY

Tendance is the other native language of Maghreb e-commerce: not the midnight bazaar but the
bright morning shop — white air, one confident violet, corners rounded like worn sea glass,
and a headline that switches script mid-sentence because that is exactly how its buyers
speak. "تألق بأفضل T-Shirt قطني" is not a design gimmick; it is Algiers talking. Tendance
takes the Shopify-theme vernacular that a thousand young sellers copied badly and rebuilds
it with care: real spacing rhythm, one accent obeying real rules, photography that breathes,
and the countdown exiled to a slim ribbon where urgency belongs — present, never hysterical.

The world's feeling is trust through friendliness. Nothing sharp, nothing dark, nothing
shouting. Cards round at 16-20px, buttons round fully, photography sits in soft-cornered
frames on white. The violet is a brand hug, not an alarm. Copy is upbeat and concrete —
fabric weight, wash count, delivery days — because the friendly shop still answers like a
professional. If Bonplan is the night hustler, Tendance is the cousin with the clean
boutique and the polite WhatsApp replies.

Self-audit before shipping:
- Does the hero headline code-switch scripts with the Latin product name in violet?
- Is the countdown ONLY in the top ribbon — nowhere in the page body?
- Is every corner radius from the sanctioned pair (16-20px cards / full-round pills)?
- Is violet under 12% of any viewport, with lilac panels carrying the rest?
- Do variant photo-cards ride one horizontal rail with corner color dots?
- Are there zero pins, zero tape, zero polaroid captions on any tilted photo?
- Form fields 56px+, labels visible, success state in the shop's friendly voice?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — invisible and absolute.
- Palette registers: grounds #FFFFFF and #F4F3FE; ink #17151F; violet #6C3EF4 to #7C4DFF;
  lilac panels #E9E4FF; success green confined to the form.
- Type stacks: Latin display Bricolage Grotesque or Archivo 800, body Inter; Arabic display
  Cairo 800, body Almarai.
- The three owned tics: code-switch headline, photo-card variant rail, top countdown ribbon.
- Motion identity "spring clean": 0.35s power2.out rises; the accent word lands last.
- Desktop law: responsive expansion, max 1080px.
- Refused blocks: lottery-contest, delivery-map.
- Imagery: clean white-studio product photography (spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set and block ORDER — apparel leads with variants,
  gadgets lead with benefits.
- Form style from the form menu.
- Proof lead: photo-reviews, stats-band or before-after — whichever the product earns.
- Which single Latin word carries the code-switch in the headline.
- Accent temperature within the violet register; lilac panel density; section count (a
  crisp 9 or a generous 13).
Every client opens a new shop window — same street, different vitrine. A clone fails.

3. VISUAL SIGNATURES

Measured values. Grounds: #FFFFFF primary; #F4F3FE alternate sections; lilac #E9E4FF for
feature panels and chips. Ink #17151F headings, #4A4656 body, #8B8698 captions. Violet
#6C3EF4 (may warm to #7C4DFF per build — one value held everywhere): CTAs, the code-switch
word, links, selected states, corner dots. Success green #1FA05C only inside form
validation.

Type scale: display clamp(30px, 8vw, 46px), weight 800, line-height 1.12; Arabic display at
95% clamp, line-height 1.3. Section titles clamp(20px, 5.5vw, 27px). Body clamp(15px, 4vw,
16.5px), line-height 1.62 Latin / 1.85 Arabic. Price clamp(24px, 6.5vw, 34px), ink — never
violet (violet is action, not money).

Shapes: cards and photo frames 16-20px radius; buttons and chips fully rounded pills,
min-height 54px; the top ribbon is square-edged (it is furniture, not a card). Borders: 1px
#E4E1F0 on white cards; variant rail cards 2px violet when selected. Shadows: a single
sanctioned soft shadow 0 6px 24px rgba(23,21,31,0.07) on the hero photo card and form card
ONLY — everything else separates by ground tone.

The tics, precisely:
- CODE-SWITCH HEADLINE: one Latin word — the product name or its category — embedded inside
  the Arabic (or French) display headline, set in violet, same weight and near-equal optical
  size (Latin at 96% of the Arabic display size on the same line). Never italic, never a
  different family: the switch is script and color only.
- PHOTO-CARD VARIANT RAIL: variants presented as a horizontal scroll rail of rounded photo
  cards (120-150px wide), each with a 14px color dot pinned in the top corner and a one-word
  label beneath. Selected card lifts its border to 2px violet; the rail feeds the form.
- TOP COUNTDOWN RIBBON: a 36-42px full-width strip pinned at the page's very top (above the
  announcement content, or merged with it), violet ground, white plain digits "05 : 42 : 18"
  with a short label. No flip animation, no boxes per digit, and NO other countdown anywhere.

4. COLOR PHYSICS

Ground register: pure white carries the shop; #F4F3FE sections give page rhythm every 2-3
blocks; lilac #E9E4FF appears as panels and chips inside sections, never as a full-bleed
ground. Ink register: three steps only. Violet physics: violet is ACTION — buttons, the
code-switch word, selection, the ribbon; it never colors body text, never grounds a section,
and stays under 12% of a viewport. Forbidden: black sections, gradients (the violet is flat),
a second accent hue, warm neutrals (Tendance is cool-aired), red urgency anywhere outside
form errors #D6455D.

5. TYPOGRAPHY

Latin stack: display Bricolage Grotesque 700/800 (first choice — its quirky counters carry
the friendly voice) or Archivo 800; body Inter 400/600. Arabic stack: display Cairo 800 —
its geometric roundness mirrors Bricolage; body Almarai 400/700. Pairing rule: one display
per build; the code-switch word always uses the LATIN display face inside the Arabic
headline.

Clamps shared across scripts (Arabic display 95%). Arabic body line-height 1.7-1.9; NEVER
letter-spacing on Arabic; Latin labels may take 0.04em. Digits: Western Arabic numerals;
prices grouped with thin spaces; phone numbers in LTR spans. RTL: logical properties
throughout; the variant rail starts from the logical start edge and scrolls toward the end;
ribbon digits keep LTR order inside an RTL sentence; x-entrances flip sign.

6. SIGNATURE ART & COMPONENTS

Supporting cast around the tics: benefit chips as lilac pills with 2px violet drawn icons
(cotton, wash, truck, shield); review cards white with 1px border, name + city + violet
stars (drawn); order-steps as a vertical line of numbered violet circles; size selector as
pill chips (S M L XL) feeding the form; the sticky CTA as a floating full-round violet pill
(bottom inset 16px) with label + price. The announcement content (free delivery line) sits
in a white strip directly under the countdown ribbon.

Imagery: clean apparel/product e-commerce photography — pure white or #F6F5FB studio
ground, soft even light with gentle product shadow, products folded/arranged with retail
precision, violet props used sparingly (a folded band, a small block) to echo the accent.
For apparel: torso-crop or back-view wearing shots only, no faces. Every asset shares the
same white air and soft shadow so the rail reads as one shoot. Banned in photos: dark moody
grounds, neon gels, cluttered lifestyle scenes, filters that tint the whites.

Component measurements, for builders: the countdown ribbon is 36-42px tall, violet ground,
digits in the body face at 15-16px with 600 weight, separators as thin colons — never boxes;
it stays position:fixed at the top and the announcement strip scrolls away beneath it. Rail
cards: 120-150px wide, 4:5 image, 14px color dot inset 8px from the top corner, label 13px
beneath the card; the rail pads 20px at both ends so the first and last cards never kiss the
viewport edge; scroll snapping is proximity, never mandatory. Benefit pills: 44-48px tall,
icon 20px at 2px stroke, lilac #E9E4FF fill, ink text. The two sanctioned shadows share one
value (0 6px 24px at 7% ink) — a third shadow anywhere fails the audit. Section spacing
clamp(56px, 14vw, 88px); inside cards, a 16/24/32 spacing scale. Focus states: 2px violet
ring with 2px offset on every field, chip and pill. The success state replaces the form card
entirely: a lilac panel, violet check circle (drawn), order number in display face, and the
promise line "نتصلو بيك اليوم للتأكيد" in body.

Copy register: Tendance writes like a helpful shop assistant who grew up online — short
sentences, concrete facts, a light smile, never hype. Arabic builds mix MSA structure with
everyday vocabulary ("قطن 100%، يتغسل ميات مرة ويبقى شباب"); French builds stay warm-neutral
("Coupe droite, coton peigné, lavable en machine"). Numbers are always specific: grams,
washes, days. Exclamation marks are rationed to one per page. The single Latin code-switch
word is chosen for recognition value — the product name, or the category word buyers
actually search.

7. THE SPINE

Hook, convince, offer, order form — always. Price placement: the price appears in the hero
directly under the code-switch headline (ink, large), and again on the sticky pill; the
price-anchor block restates it with the old price struck. Sticky CTA: the floating violet
pill, present after the hero, scrolling to the form. Mobile-first at 390px. Desktop law:
responsive expansion to max 1080px — hero splits into photo left / stack right, rails
breathe wider, the ribbon spans full width.

8. BLOCKS TREATMENT

Supported blocks, dressed by Tendance:
- announcement-bar: the white strip under the ribbon — one calm line ("توصيل لكل الولايات ·
  الدفع عند الاستلام").
- hero: code-switch headline, sub-line, price, CTA pill, hero photo card (the one soft
  shadow), 2-3 micro-trust chips.
- variant-gallery: the photo-card rail — colors or models with corner dots; apparel adds a
  size pill row beneath.
- benefits-icons: 4-6 lilac pills with drawn violet icons and short labels.
- how-it-works-steps: three numbered violet circles on a vertical rule with one sentence
  each — for gadgets and kits.
- before-after: two rounded photo cards side by side with small corner labels — soft proof
  for textile/care products.
- photo-reviews: 3-5 white cards, buyer name + city + drawn stars, one photo card among
  them; "طلب مؤكد" chip in lilac.
- stats-band: a lilac panel with three ink counters (clients, wilayas, note moyenne).
- size-guide: a clean bordered table in a lilac panel with a one-line measuring tip —
  apparel builds only.
- bundle-offers: 2-3 rounded cards (solo / duo / famille), per-unit line, "الأكثر مبيعاً"
  violet chip on one; feeds the form.
- cross-sell: one companion photo-card with a pill checkbox that adds it to the order.
- price-anchor: old price struck in caption gray, new price large in ink, savings chip in
  lilac, COD line beneath.
- order-steps: four steps with drawn icons: الطلب، التأكيد بالهاتف، التوصيل، الدفع عند
  الاستلام.
- order-form + faq + trust-footer: per form menu; FAQ 5-7 rounded rows; footer white with
  violet phone pill, socials as drawn glyphs, coverage line.

Refused blocks:
- lottery-contest: raffles are night-market psychology; the friendly shop sells product,
  not tickets.
- delivery-map: a map is logistics theater; Tendance states delivery in one honest line
  and moves on.

9. HERO MENU

- The Vitrine: headline (code-switch), sub-line, price, CTA, then the hero photo card full
  width below. The default morning-shop opener.
- Split Vitrine: photo card left, stack right (desktop); stacked with photo first on
  mobile — for products with one strong glamour angle.
- Rail-First: the variant photo-card rail sits directly under a short headline — color-led
  products (apparel, cases) where choice IS the hook.
- Proof Opener: a single review card (with buyer photo) above the headline — for relaunches
  where trust leads.
- Bundle Vitrine: the bundle cards ARE the hero under the headline; price shown per-unit —
  for consumables and duos.
- Chip Parade: benefit pills stacked above the photo card, headline between — for technical
  products needing three quick claims first.

10. FORM MENU

- The Boutique Card: one white card (the second sanctioned shadow), stacked 56px fields,
  variant/size summary chips at top, violet pill submit. The default.
- Two-Step Fitting: step 1 choose variant + size (rail + pills), step 2 coordinates;
  progress as two violet dots.
- Echo Pill: a compact phone-only pill form under the hero ("نتصلو بيك") plus the full
  Boutique Card at the end.
- Bar-Driven: the sticky pill is the only CTA until the form section, which opens focused.

11. MOTION IDENTITY

Spring clean: entrances rise 16px with fade, 0.35s power2.out, staggers 70ms. The variant
rail glides with momentum (native scroll, no hijack). Signature moment: in the hero
headline, the Arabic words settle first and the violet Latin word slides in LAST (0.3s,
from the logical end side) — the code-switch lands like a wink, once. Ribbon digits tick
by opacity swap. Selected states transition 0.2s. All gated on gsap + ScrollTrigger + no
reduced-motion; page complete with JS off. Banned: overshoot, parallax, marquees, card
tilts on scroll, continuous loops of any kind.

12. BAN LIST

Generic slop: purple-blue gradients on white (the violet is FLAT — any gradient fails the
build), glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos,
cookie-cutter icon rows with drop shadows, hero carousels, parallax, backdrop-blur,
back.out overshoot. Neighbor tics banned by name: velin's italic accent word (the
code-switch is script+color, never style); carnet's pinned polaroids — any tilted photo
carries no pin, no tape, no caption; clair's soft-shadow floating cards (Tendance permits
exactly two sanctioned shadows) and pill-tab switcher; souk's split-flap; doudou's
toy-button lip; gloss's smear bars; iris's aurora-hairline capsule and mock-UI panels;
bonplan's poster-inset and ticket stack. Refused blocks restated: lottery-contest,
delivery-map. Tendance's own temptations, banned: violet body text, violet section grounds,
more than one countdown, badge clutter, English words beyond the single code-switch term.

13. EXAMPLE VARIATIONS

- "COMFY Rentrée" — fashion & apparel. Rail-First hero (3 colorways); size-guide, benefits
  pills, photo-reviews, stats-band, bundle duo, price-anchor, Boutique Card form, faq,
  footer. Mood: fresh cotton morning. Signature: code-switch word "COMFY" lands last.
- "Écouteurs GO" — electronics & gadgets. Chip Parade hero; before-after (silence test as
  photo pair), photo-reviews, cross-sell (étui), price-anchor, Two-Step Fitting form, faq,
  footer. Mood: commute-ready. Rail absent — variants are one color.
- "Kit Bébé Douceur" — kids & baby. Vitrine hero; benefits, photo-reviews with parent
  photos, bundle famille, order-steps, Echo Pill + Boutique Card, faq, footer. Mood: soft
  trust. Lilac panels denser, violet quieter.
- "MIXIO Cuisine" — home & kitchen. Split Vitrine hero; how-it-works-steps, benefits,
  stats-band, cross-sell (gobelet), price-anchor, Bar-Driven form, faq, footer. Mood:
  practical bright. Ribbon carries a real weekend deadline.
- "Pack Duo Sport" — fashion & apparel. Bundle Vitrine hero; size-guide, benefits,
  photo-reviews, price-anchor, Boutique Card form, faq, footer. Mood: training partners.
  Code-switch word: "DUO".
- "Chargeur TURBOGO" — electronics & gadgets. Proof Opener hero; benefits, stats-band,
  bundle solo/duo, price-anchor, Two-Step Fitting, faq, footer. Mood: reliability first.
  The single review card opens the page; ribbon digits are the only urgency.
- "Plaid Nuage" — home & kitchen. Vitrine hero; before-after (salon refresh), benefits,
  photo-reviews, cross-sell (housse), price-anchor, Echo Pill + Boutique Card, faq,
  footer. Mood: cocooning. Violet warmed to #7C4DFF.
- "Veilleuse Bébé WIFI" — kids & baby. Split Vitrine hero; how-it-works-steps, benefits,
  whatsapp-proof (parents group chat), stats-band, bundle duo chambre, price-anchor,
  Bar-Driven form, faq, footer. Mood: nursery-tech reassurance. The code-switch word is
  "WIFI"; the rail is absent and the lilac panels carry the calm.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
