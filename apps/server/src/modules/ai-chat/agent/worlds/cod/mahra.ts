import type { DesignWorld } from "../types";

export const mahra: DesignWorld = {
	id: "mahra",
	name: "Mahra",
	family: "modest-chic",
	tagline: "Emerald silk, flowing lines, couture modesty",
	kind: "cod",
	mood: ["poised", "flowing", "jewel-toned"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["fashion & apparel", "beauty & cosmetics", "jewelry & watches"],
	avoidFor: ["electronics & gadgets", "car accessories", "home & kitchen"],
	fusesWith: ["kenz", "jihaz"],
	preview: {
		ground: "#123F33",
		ink: "#F7F2E9",
		accent: "#C9B18A",
		fontFamily: "Italiana",
		sampleWord: "مهرة",
	},
	doc: `
MAHRA — THE JEWEL-TONE ATELIER

1. PHILOSOPHY

Mahra is the atelier where modesty is not a limit but a language. Deep emerald crepe, plum
silk, a single champagne thread — this world sells covered elegance to a buyer who reads
couture the way others read headlines, and who has been served ugliness by every discount
abaya page on the internet. Mahra's answer is poise. The page moves the way good fabric
moves: it settles, it drapes, it never crumples. Where a bazaar page grabs the wrist, Mahra
extends a hand. Copy is dignity itself — measured, feminine, second-person respectful — and
every visual decision protects one idea: the garment is a presence, not a product shot. The
buyer should feel the page was cut and sewn for her, hem finished, threads buried. The
invisible spine (hook, convince, offer, order form) runs under the silk: the hero seduces
with drape, the middle convinces with cut and cloth, the offer arrives like a fitting-room
verdict, and the form closes quietly with the promise that she pays only at her door. Mahra
serves abayas and modest fashion first, then hijab-adjacent beauty and discreet jewelry —
anything worn with intention.

Self-audit checklist — answer yes before shipping:
- Does the hero read as couture presence — cloth, line, air — not a catalog thumbnail?
- Is there exactly ONE dominant jewel ground per build (emerald OR plum), never both fighting?
- Do silk-drape folds mark the section transitions, and does only one of them sway, once?
- Is every numeral and label poised — champagne, small, unhurried?
- Does the abaya outline art appear as drawn line, never as a photo cutout?
- Is the size-guide present and dressed with the same dignity as the hero?
- Could every sentence be spoken softly in a fitting room without embarrassment?
- Zero horizontal overflow at 390 / 768 / 1440, fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook, then convince, then offer, then order form. Invisible, absolute.
- Palette registers: ONE dominant jewel ground per build — emerald #123F33 or plum #3A2140 —
  with ivory relief #F7F2E9; champagne #C9B18A as the only metallic thread.
- Type stacks: display Cormorant (500) or Italiana; body Jost. Arabic display Amiri; body
  Noto Naskh Arabic.
- The three owned tics: silk-drape folds, abaya outline art, clasp-close CTAs.
- Motion identity: silk settle — 0.8s power1 fades with 10px drift; one drape sway, once.
- Desktop law: centered mobile shell, ~470px, resting on the deep jewel ground.
- Refused blocks: lottery-contest, countdown, stock-urgency, comparison-table, before-after.
- Imagery style: premium modest-fashion photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client, never inherited:
- Hero composition, chosen from the hero menu or invented inside its law.
- Block choice within the supported set, and BLOCK ORDER — an abaya page and a shayla-set
  page must not share a sequence.
- Form style from the form menu, and whether a quiet echo form exists near the hero.
- Proof lead: photo-reviews or whatsapp-proof — pick what this clientele trusts.
- The dominant jewel (emerald or plum) and where ivory relief sections fall.
- Section density: a single-abaya page may run 8 poised beats; a capsule collection 13.
Every client receives a new sibling — same atelier, new garment. A build that repeats a
previous hero + form + block order combination has failed the contract.

3. VISUAL SIGNATURES — measured

- Grounds: emerald #123F33 (dominant option A) or plum #3A2140 (option B); deep variant for
  panels: emerald #0D3128 / plum #2E1933. Ivory relief sections #F7F2E9; card ivory #FBF8F1.
- Ink: ivory #F7F2E9 on jewel grounds; #2E2431 on ivory. Secondary text at 78% opacity.
- Champagne #C9B18A: hairline rules (1px), price numerals, clasp hardware, label caps. Never
  paragraphs, never fills, coverage under 6% of any viewport.
- Display type: hero clamp(1.9rem, 7vw, 2.8rem), line-height 1.2 Latin / 1.5 Arabic; section
  titles clamp(1.4rem, 5.2vw, 1.9rem). Body clamp(0.98rem, 4vw, 1.06rem), line-height 1.65
  Latin / 1.85 Arabic. Labels 11px letter-spaced 0.16em (Latin only).
- Radii: 18px on cards and imagery (soft as a rolled hem), 999px on the clasp CTA, 12px on
  form fields. No sharp corners anywhere — Mahra has no edges, only folds.
- Borders: 1px champagne at 45% opacity on ivory cards; no borders on jewel grounds (tone
  steps separate). Shadows: banned — depth comes from ground steps and drape.
- SILK-DRAPE FOLDS (tic): section transitions cut as smooth cloth-fold silhouettes — an SVG
  path of 2-3 overlapping curved folds, 48-80px tall, filled with the departing section's
  ground, a 6% ivory highlight along each fold crest. Never scallops, never drips, never
  paper layers — the curve must read as falling cloth.
- ABAYA OUTLINE ART (tic): single-line garment silhouettes — one continuous 1.5px champagne
  stroke drawing a flowing abaya form — used as section art behind titles (12% opacity,
  240-360px tall) or small as dividers (36px). Never filled, never a photo cutout.
- CLASP-CLOSE CTAs (tic): the primary button is two halves — label half and arrow half —
  separated by a 6px gap that CLOSES like a jewel clasp on press (the halves meet, a 1px
  champagne seam flashes). Resting state: ivory pill halves on jewel ground with champagne
  keyline; pressed: halves joined, ground deepens.
- Spacing rhythm: sections breathe clamp(64px, 16vw, 96px); imagery margins generous — the
  cloth needs air.

4. COLOR PHYSICS

Ground register: the build chooses its jewel — emerald #123F33 (may deepen to #0D3128) OR
plum #3A2140 (may deepen to #2E1933). The unchosen jewel is FORBIDDEN in that build; two
jewels on one page reads as a boutique that cannot decide. Ivory #F7F2E9 carries relief
sections — reviews, size-guide, the form — roughly a third of the page, so the jewel keeps
its depth by contrast. Ink register: ivory on jewel, #2E2431 on ivory, captions #6E6273.
Accent register: champagne #C9B18A only — it may warm to #D4BD96 in highlights, never
brighten to gold (dahab and kenz territory). Support: a rose whisper #C89A9C is permitted
under 3% for feminine punctuation (a single underline, a swatch dot). Form errors: muted
wine #9C4A55, inline only. Forbidden: black, white-white (#FFFFFF reads as screen, not
cloth), saturated brights, gradients (silk is lit, never gradient-painted), silver, and any
second metallic.

5. TYPOGRAPHY

Latin stack. Display: Cormorant (500, its calm contrast suits cloth) or Italiana (the
hairline atelier voice) — ONE per build. Body: Jost (300/400), quiet and geometric. Pairing
rule: display appears in the hero line, section titles, and prices; body carries everything
else; body never bolds above 500.
Arabic stack. Display: Amiri (400/700) — classical dignity for the hero and titles. Body:
Noto Naskh Arabic (400). Pairing rule: Amiri + Noto Naskh always; Almarai (300) may replace
Noto Naskh only when the client's copy runs long and needs a rounder rhythm.
Shared clamps as in Visual Signatures; Arabic display sits ~8% smaller at the same clamp.
RTL law: logical properties everywhere (padding-inline, margin-inline-start, inset-inline-
end); NEVER letter-spacing on Arabic (Latin caps labels only); Arabic body line-height
1.8-1.9; digits Western (0-9) for prices and sizes, wrapped LTR so «520 د.إ» reads as one
unit; x-axis motion flips sign; the clasp CTA's label/arrow halves mirror; drape-fold
highlights keep their light source (top-start).

6. SIGNATURE ART AND COMPONENTS

The three tics are the atelier's signature stitching — silk-drape folds carry the page from
section to section, abaya outline art gives walls their quiet couture drawing, and the
clasp-close CTA makes every press feel like fastening something precious. Supporting cast:
fabric-swatch chips (18px rounded squares of crepe texture with champagne keyline for
variant colors); measurement cards (ivory, 1px champagne border, size table set in Jost with
champagne column rules); review cards on ivory with a thin champagne quote rule and the
reviewer's city in caps; a hem-line divider (1px champagne rule with a tiny thread-knot dot
at the start side) for minor separations inside sections; order-step markers as small
champagne circles numbered in display type. Photography sits in 18px-radius frames, full-
bleed only in the hero.

Imagery. Premium modest-fashion photography: deep emerald (or plum) silk crepe garments on
elegant hangers and draped over forms, ivory studio walls, soft diffused window light from
the start side, plum or emerald accents echoing the build's jewel, occasional champagne
props (a thin bracelet, a clasp). Fabric in motion allowed — never a visible face; crops end
at the chin or shoulders. Textures matter: crepe grain, buried seams, hidden buttons shot
macro. Banned in photos: faces, busy patterns, lace (jihaz's), pearls (loulou's), gold
jewelry walls (dahab's), harsh flash, street context.

7. THE SPINE

Hook, convince, offer, order form — in that order, always, invisibly. Mahra's hero states
the garment, the promise of cut and cloth, and the PRICE — set small but immovable in
champagne display type with the clasp CTA beside it, both inside the first 390x844 viewport.
The sticky CTA is a slim jewel-ground bar, ivory label + champagne price, its button a
miniature clasp; it appears after the hero scrolls past and always leads to the form.
Mobile-first at 390px. Desktop law: centered mobile shell, ~470px, floating on the deep
jewel ground with generous darkness either side — the atelier at night around a lit fitting
room.

8. BLOCKS TREATMENT

Supported blocks, dressed by Mahra:
- announcement-bar: one ivory line on deep jewel — delivery + pay-at-door, a champagne dot
  separator. Never rotates, never blinks.
- problem-solution: the fitting-room truth — two quiet pains (fabrics that crease, cuts that
  cling) then the atelier's answer, set beside a drape photo with an abaya outline behind.
- benefits-icons: 3-4 champagne line icons in ivory circles — cut, cloth, closure, care —
  one word each, never a grid of six.
- variant-gallery: fabric-swatch chips with per-variant drape photos; selected chip closes a
  tiny clasp seam. Feeds the form.
- size-guide: the measurement card — sizes 50-60, lengths in cm, a drawn measuring
  silhouette (outline art, never a photo) showing where to measure.
- unboxing-gallery: what arrives — garment folded in tissue, shayla, care card — shot as a
  quiet flat lay with a champagne keyline frame.
- photo-reviews: 3-5 ivory cards, first name + city, stars as tiny champagne diamonds; one
  customer photo maximum per card, always faceless.
- whatsapp-proof: a single recreated thread on ivory — the "وصلتني اليوم، القماش راقي"
  moment — bubbles rounded 18px, no platform branding.
- guarantee-seal: an ivory card with a drawn clasp glyph — exchange within 7 days, hem
  adjustments noted — sealed with a champagne hem-line rule.
- price-anchor: the fitting-room verdict — price in champagne display, old price (if any)
  struck with a single thin line, payment-at-door restated beneath.
- order-steps: four champagne-numbered circles — choose size, leave name and phone, we call,
  pay at your door. One line each.
- faq: 4-6 questions on ivory, hem-line rules between, answers in two sentences maximum.
- trust-footer: deep jewel ground, the atelier's name in display, phone + WhatsApp, sizes
  reminder, policies — set sparse.
Refused blocks: lottery-contest (a raffle in an atelier is vulgarity), countdown and
stock-urgency (poise does not panic), comparison-table (Mahra does not argue with other
sellers), before-after (a covered woman owes no transformation story).

9. HERO MENU

- The Fitting Room: full-bleed drape photo, title and price on a jewel scrim at the lower
  third, clasp CTA beside the price. The default couture opening.
- The Hanger: product on hanger centered on ivory, jewel band behind the title above,
  abaya outline art faint behind — for builds leading with silhouette.
- The Drape Split: photo start-side 55%, stacked title / cloth story / price / clasp CTA
  end-side; folds carry the seam between them.
- The Swatch Overture: fabric macro fills the hero, garment name small, price and CTA on an
  ivory card overlapping the photo's lower edge — for cloth-first clients.
- The Collection Row: three garments in a quiet row (capsule builds), the featured one
  slightly larger, one price line beneath, single clasp CTA.
- The Outline Statement: the abaya outline drawn large on jewel ground, photo held back to
  section two — for brands whose line IS the argument. Use sparingly.

10. FORM MENU

- The Fitting Card: single ivory card — name, phone, wilaya/emirate, size chips, notes —
  champagne rules between groups, clasp CTA closing it. The default.
- The Two Measures: a 2-step wizard — step one size and variant, step two name, phone,
  city — each step a card that settles in with the silk motion.
- The Quiet Echo: a 2-field whisper (phone + size) under the hero for the decided,
  repeated in full at the page end; the echo scrolls to the full form on submit.
- The Bar Fitting: the sticky bar opens the form section with fields focused — for short
  builds where the page itself is the fitting.

11. MOTION IDENTITY

Silk settle. Entrances: opacity 0 to 1 with 10px drift (y or inline-start x, flipped in
RTL), 0.8s, power1.out, staggered 90ms. The ONE signature moment: a single silk-drape fold
edge sways — rotate 1.5deg about its top, once, 1.2s, sine.inOut — as it enters the
viewport; every other fold is still. Clasp CTAs close in 0.18s on press. No loops, no
parallax, no overshoot, no shine sweeps (rimel's), no Ken-Burns. Under
prefers-reduced-motion: everything static and visible, the clasp closes instantly. All
motion gated on gsap + ScrollTrigger presence; the page reads perfectly without JavaScript.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur (voltage's sanctioned use only), back.out overshoot
(guimauve's). Neighbors banned by name: hikaya's curtain-edge vignettes; jihaz's lace-edge
borders, ribbon-bow seals and lid-lift reveals; gloss's lacquer drips and vanity bulbs;
warqa's fold-crease panels and layer cutouts (paper folds are not silk folds — Mahra's
drape is always a smooth cloth curve, never a creased sheet); silhouette's type-over-photo
collisions and crimson accent; kenz's spotlight cone, gold dust and velvet jewel-box; wax's
print bands; loulou's pearls — NO pearl elements of any kind in Mahra (sibling wall);
eclat's photo-orbit; iris's aura. Mahra's own temptations, also banned: gold instead of
champagne, two jewels in one build, faces in photography, exclamation marks, discount
theater of any kind. Refused blocks: lottery-contest, countdown, stock-urgency,
comparison-table, before-after.

13. EXAMPLE VARIATIONS

- "Soirée d'Émeraude" — fashion & apparel (abaya de soirée). Fitting Room hero; blocks:
  announcement, problem-solution, benefits, variant-gallery, size-guide, photo-reviews,
  guarantee, price-anchor, order-steps, faq, trust-footer; Fitting Card form. Emerald
  dominant, sway on the hero fold. Mood: evening atelier.
- "Prune Capsule" — fashion & apparel (capsule 3 pièces). Collection Row hero; blocks:
  announcement, benefits, variant-gallery, unboxing, whatsapp-proof, price-anchor,
  order-steps, faq, trust-footer; Two Measures wizard. Plum dominant; the sway lands on the
  offer's fold. Mood: quiet collection launch.
- "Crêpe du Vendredi" — fashion & apparel (abaya du quotidien, accessible premium). Drape
  Split hero; blocks: announcement, problem-solution, benefits, size-guide, photo-reviews,
  guarantee, bundle-less price-anchor, order-steps, trust-footer; Quiet Echo form. Emerald;
  sway at the size-guide fold. Mood: everyday dignity.
- "Le Voile de Soie" — beauty & cosmetics (coffret soins hijab: huile + brosse). Swatch
  Overture hero (texture macro); blocks: announcement, benefits, ingredients-free story via
  problem-solution, unboxing, photo-reviews, guarantee, price-anchor, order-steps, faq,
  trust-footer; Fitting Card form. Plum; sway on the unboxing fold. Mood: ritual softness.
- "Fil de Champagne" — jewelry & watches (bracelet discret). Hanger hero (bracelet on
  velvet-free ivory stand); blocks: announcement, problem-solution, benefits, unboxing,
  photo-reviews, guarantee, price-anchor, order-steps, trust-footer; Bar Fitting form.
  Emerald; sway at the price fold. Mood: a thin line of light.
- "L'Atelier Ouvre" — fashion & apparel (nouvelle marque, page manifeste). Outline
  Statement hero; blocks: announcement, problem-solution (the founder's fitting-room
  promise), benefits, variant-gallery, size-guide, whatsapp-proof, guarantee, price-anchor,
  order-steps, faq, trust-footer; Two Measures wizard. Plum; sway on the hero outline's
  fold. Mood: opening night, hushed.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
