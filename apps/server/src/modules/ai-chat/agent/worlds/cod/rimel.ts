import type { DesignWorld } from "../types";

export const rimel: DesignWorld = {
	id: "rimel",
	name: "Rimel",
	family: "beauty-editorial",
	tagline: "A glossy magazine beauty page that takes orders",
	kind: "cod",
	mood: ["editorial", "soft", "glamorous"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["beauty & cosmetics", "jewelry & watches", "fashion & apparel"],
	avoidFor: ["car accessories", "fitness equipment", "electronics & gadgets"],
	fusesWith: ["hammam", "gloss", "jihaz"],
	preview: {
		ground: "#FBF1F3",
		ink: "#4A2F3A",
		accent: "#D98A9F",
		fontFamily: "Italiana",
		sampleWord: "Rimel",
	},
	doc: `
RIMEL — THE GLOSSY BEAUTY PAGE

1. PHILOSOPHY

Rimel is the beauty page of a magazine that decided to take orders. Powder-pink paper, a hairline serif that has read Vogue in three languages, photography lit like a February cover story — and, folded into all that glamour, a working COD funnel that asks for a name, a phone, a wilaya. The tension IS the world: editorial restraint holding commercial intent. Where a bazaar page pushes, Rimel curates; where a pharmacy page proves with milligrams, Rimel persuades with texture — a cream smear, a lash curve, a rose-gold cap catching light. The product is the muse; the page is its editorial feature; the price is a caption, confident and small-spoken, because a reader of this magazine does not need to be shouted at. Copy is written like beauty journalism: sensory, precise, a little intimate — "une texture qui fond", "tient jusqu'au soir" — never listicle-hype, never ALL-CAPS promises. The invisible spine (hook, convince, offer, order form) runs beneath every issue: the cover seduces, the feature convinces, the offer is presented like a beauty-box page, and the order form closes as elegantly as a subscription card bound into the magazine. Rimel serves mascara and serums first, but any object of adornment — a pair of gold earrings, a silk scarf — can be its muse.

Self-audit before shipping:
- Does the hero read as a magazine cover or feature opening, not a webshop header?
- Are the blush orbs matte, soft-edged, BEHIND content — never glossy bubbles?
- Is every numeral that structures the page wearing its lash-tick halo?
- Has each product image exactly one shine sweep on first reveal, then stillness?
- Is the gold hairline under 3% of the page — rules and frames only, never fills?
- Could every line of copy appear in a printed beauty column?
- Is the form dressed as a carte — and the COD reassurance still explicit?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook, convince, offer, order form, in that order, invisible.
- Grounds #FBF1F3 / #FFF8F6; ink rosewood #4A2F3A; rose accent #D98A9F; gold hairline #C9A96A at ≤3%; ivory #FFFDFB cards.
- Type stacks: Italiana, Bodoni Moda or Cormorant display; Jost or Mulish body; Amiri display + Almarai body in Arabic.
- The three owned tics: blush orbs, lash-tick halos, shine sweep.
- Motion identity: powder soft — opacity-led 0.7s entrances; one shine sweep per product image, once.
- Desktop law: centered mobile shell, ~470px, with generous ivory margins.
- Refused blocks: lottery-contest, spec-table, comparison-table.
- Imagery: blush-pink seamless, soft diffused light, cream textures, magazine styling.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition (from the hero menu or invented within its law).
- Block choice within the supported set, and block ORDER.
- Form style from the form menu; whether a compact echo exists.
- Proof type: photo-reviews, before-after, or press quotes — choose per product.
- Orb placement and count (2–4 per page), which sections they grace.
- Accent temperature within register (rosier or more nude), where gold rules appear.
- Section density: a single serum can run 8 spare beats; a coffret can run 12.
Every client receives a new sibling — same magazine, new issue. Copying a previous build's hero + block order + form combination fails the contract.

3. VISUAL SIGNATURES

Measured values. Grounds: #FBF1F3 powder base, #FFF8F6 alternate; ivory cards #FFFDFB; no dark sections — Rimel has no night mode. Ink: rosewood #4A2F3A headings, #6B4A57 body, #9A7A87 captions. Rose #D98A9F for CTAs and accents (deepened #C4738A on press); gold #C9A96A exclusively as 1px rules and thin frames, never text longer than a label, never fills. Display clamp(32px, 8.5vw, 50px), line-height 1.12, Italiana's hairline elegance; section titles clamp(22px, 6vw, 32px); body clamp(15px, 4vw, 16.5px), line-height 1.65 Latin / 1.8 Arabic; price as caption clamp(20px, 5.5vw, 28px) in rosewood with a small gold rule above. Radii: 0px on editorial frames and photos (magazine pages have corners), 999px only on pill CTAs and chips — the two shapes never blur together. Borders: 1px #C9A96A hairlines for frames and rules; 1px rgba(74,47,58,0.14) for quiet card edges. Shadows: none; ivory cards separate by tone, not elevation. Spacing: sections at clamp(64px, 16vw, 96px); a 24px baseline grid inside features.

The tics, precisely:
- BLUSH ORBS: 2–4 large radial-gradient discs (240–420px), center rgba(217,138,159,0.22) fading to transparent by 70%, matte and soft-edged, absolutely positioned BEHIND content at section corners; never overlapping text ink, never glossy, never outlined.
- LASH-TICK HALOS: numerals (steps, sections, ranking) set in the display face inside a 1.5px rosewood circle (36–48px), with 5–7 tiny lash strokes (2px, curved, rosewood) radiating from the upper arc only — a wink, not a sunburst. Used wherever a number structures the page.
- SHINE SWEEP: on each product image's first reveal, a soft skewed band (30% width, skewX -18deg, white at 18% opacity, blurred edges) translates across once, 0.9s, ease power2.inOut — the gloss of a page catching light. Once per image, never looping.

4. COLOR PHYSICS

Ground register: #FBF1F3 to #FFF8F6 — alternating creates the page-turn rhythm; both stay within powder warmth, never dropping toward mauve or gray. Ivory #FFFDFB is card stock, reserved for the offer carte and the form. Ink register: rosewood three-step (#4A2F3A / #6B4A57 / #9A7A87) — headings, body, captions; black is forbidden (it bruises the powder). Accent register: rose #D98A9F may warm to #E29CAE or deepen to #C4738A per build — one temperature chosen, held everywhere; coverage ≤10% of any viewport. Gold #C9A96A is jewelry: hairline rules, thin frames, the tiny rule above prices — ≤3% of the page, and NEVER a gradient, NEVER metallic-effect text. Support: form-error rose #C25462 inline only. Forbidden: black, saturated reds, neon anything, cool grays, dark grounds, silver, and a second accent hue.

5. TYPOGRAPHY

Latin stack. Display: Italiana (400) — the masthead voice, hairline and haute; Bodoni Moda (500, tight) when the client's name needs didone drama; Cormorant (500) as the softer third. Body: Jost (300/400) or Mulish (400/600). Pairing rule: ONE display + ONE body per build; display appears in the masthead/product name, section titles, and halo numerals; prices and captions may take display at caption sizes; everything else is body. Latin small-caps labels at 11–12px, letter-spacing 0.18em ("LA FORMULE", "VU DANS").

Arabic stack. Display: Amiri (400) — set with generous size, its elegance replaces Italiana; spacing effects are achieved by scale and whitespace, never tracking. Body: Almarai (300/400). Pairing rule: Amiri + Almarai always; Almarai 700 for the CTA label.

Shared clamps as in Visual signatures; Amiri titles wrap at most twice, then drop a clamp step. RTL rules: logical properties throughout; NEVER letter-spacing on Arabic (small-caps tracking is Latin-only — Arabic labels use Almarai 700 at 12px instead); Arabic body line-height 1.8; digits Western (0-9) in prices and phones, wrapped dir="ltr"; the shine sweep and all x-motion mirror in RTL; lash-tick halos keep their upper-arc ticks (no mirroring — a wink is a wink).

6. SIGNATURE ART & COMPONENTS

Blush orbs are the world's atmosphere — position them at section corners like powder dusted on paper, two minimum, four maximum, always behind content. Lash-tick halos are the world's numbering system: steps in "le rituel", section indices, ranking in bundles — every structural numeral is haloed. The shine sweep is implemented as an overflow-hidden mask over each product image with a translating gradient band, fired once by ScrollTrigger on first reveal.

Supporting cast: the primary CTA is a rose pill (999px radius, ivory text, 54px min-height, full-width on mobile) — "Je commande — paiement à la livraison"; secondary actions are rosewood text links with 1px gold underline offset 4px. The offer lives on a carte — an ivory #FFFDFB panel with a 1px gold hairline frame inset 8px, square corners, product name in display, price caption, one line of what's included. Chips are powder pills with rosewood text ("Livraison 48h", "Paiement à la livraison"). Dividers: a centered 1px gold rule, max-width 96px, with a single 4px rosewood dot at center. Review cards: ivory, square-cornered, the reviewer's initial in a lash-tick halo.

Imagery. One direction for every photograph: the product on a blush-pink seamless or powder-toned silk, soft diffused frontal light (a beauty dish through diffusion — no hard speculars except one controlled highlight), rose-gold or glass props only, cream/product textures smeared or swatched beside the object where the niche allows, styled like a printed beauty editorial: generous negative space, perfect symmetry or confident thirds, fine grain. Faces may appear as partial crops (lips, closed eye with lashes, an earlobe wearing the earring) — never full lifestyle portraits. Banned in photos: white e-commerce seamless, dark moody grounds, neon gels, cluttered flat-lays, stock-smile models. This direction reproduces for any Rimel muse: a mascara, an earring pair, a silk scarf — each shot as the issue's cover object.

7. THE SPINE

Hook, convince, offer, order form — invisible law, always in order. Rimel's price placement: the price appears in the HERO as a caption — small, serif, sure of itself, beneath the product name with its gold rule above; the world's law never hides the price and never inflates it into a badge. The sticky CTA is a slim floating rose pill (bottom center, 90% width max 380px) that appears after the hero and smooth-scrolls to the form; it carries the CTA label and the price at its end edge. Mobile-first at 390px. Desktop law: centered mobile shell — a ~470px column on the powder ground, framed by generous ivory margins and one hairline gold rule far outside the column edges (the magazine's trim marks).

8. BLOCKS TREATMENT

Supported blocks, dressed by Rimel:
- announcement-bar: one powder strip above the cover — 11px rosewood small-caps between two gold hairlines: "PAIEMENT À LA LIVRAISON — 58 WILAYAS".
- problem-solution: the editorial confession — two or three intimate lines on the daily struggle (mascara that flakes, earrings that pinch), turned by one sentence into the product's entrance; set as a pull-quote passage with a partial-crop photo.
- benefits-icons: beauty notes — no icons; 3-4 short lines each opened by a tiny gold rule and a rosewood keyword ("Tenue. 14 heures sans retouche.").
- ingredients-infographic: LA FORMULE — the product annotated like a cover story sidebar: ingredient, percentage, one sensory line each; set on an ivory carte with the product macro beside; halo numerals index the actives.
- how-it-works-steps: LE RITUEL — 3 steps with lash-tick halo numerals, each step a photo crop + one sensual instruction line; the world's most-used convince block.
- before-after: the transformation spread — two square-cornered frames side by side with a gold hairline between, captions in small caps ("JOUR 1 — JOUR 21"), an honesty caption beneath; sliders allowed but restrained.
- variant-gallery: the shade edit — shades/variants as round swatch dots with product-photo swaps; selected swatch gains a gold ring; shade names written like editorial ("Noir Encre", "Brun Louve").
- photo-reviews: courrier des lectrices — ivory cards, reviewer initial in a halo, city in small caps, 2-line quotes chosen for sensory detail; a small rose star row.
- price-anchor: the beauty-box page — the carte carrying old price struck in caption gray, the price in rosewood display, what-you-receive listed with gold-rule bullets, COD line beneath.
- bundle-offers: les coffrets — 1x/2x/3x as three cartes, halo numerals ranking them, "LE CHOIX DE LA RÉDACTION" as the most-popular flag in small caps on the middle carte.
- guarantee-seal: la promesse — one ivory carte, gold hairline frame, the guarantee written as an editor's note with an em-dash signature ("— La Maison Rimel"), COD restated.
- order-steps: 4 haloed steps in one row — commande, appel, livraison 48h, paiement à la porte; one line each.
- faq: les questions — hairline-separated rows, questions in display face at body size, answers in body; thin rosewood chevrons.
- trust-footer: the masthead's last page — brand in display, contact line, policies in captions, "Paiement à la livraison partout en Algérie" closing, one final gold rule.

Refused blocks: lottery-contest (a magazine does not raffle its muse), spec-table (texture cannot be tabulated), comparison-table (Rimel does not argue with other pages).

9. HERO MENU

- The Cover: masthead composition — brand small-caps at top, product name in display as the cover line, the muse photographed center on powder seamless, price caption with gold rule, rose pill CTA; one blush orb behind the upper corner. The default.
- The Feature Opening: photo-split — top 55% a full-bleed editorial photograph (partial-crop face or product-in-texture), below it the powder panel with name, one sensory line, price caption, CTA.
- The Muse Stack: price-first — name, price caption and CTA arrive in the first two beats above the fold with the product below them; for decided-audience builds (restock, famous product).
- The Transformation Cover: before-after hero — the spread (two frames, gold hairline between) IS the opening, name and price captioned beneath; only for niches where transformation is the story (lashes, skincare).
- The Carte Hero: offer-card hero — the ivory carte with gold frame holds product, name, price and CTA as one boxed composition on powder; the beauty-box page as the first thing seen.
- The Gloss Loop: video hero — one muted loop (a swatch being drawn, a lash curling, silk moving) behind the masthead and price caption; poster mandatory; the shine sweep retires in this hero (the loop carries the light).

10. FORM MENU

- La Carte: single ivory card, gold hairline frame — fields with rosewood labels above, 1px quiet borders, 54px heights; rose pill submit; success replaces the carte's face with an order number and "Nous vous appellerons pour confirmer" in the editor's voice.
- Le Rituel d'Achat: three-step wizard with lash-tick halo numerals — votre choix (shade/coffret), vos coordonnées, la confirmation; one field group per step; back/next as text links with gold underlines.
- The Subscription Echo: two fields (name, phone) folded discreetly under the hero price like a bound-in subscription card, plus the full Carte at the end.
- The Summoned Carte: sticky-pill-driven — no form visible until the floating pill is touched; La Carte then reveals at the end and receives focus; for the most editorial builds.

11. MOTION IDENTITY

Powder soft: entrances are opacity 0 to 1 with y:12 to 0, power1.out, 0.7s, stagger 0.1s, at 78% viewport — content settles like powder. The ONE signature scroll moment: the shine sweep — each product image receives its single skewed light-band pass on first reveal; no image sweeps twice. Blush orbs are static (they may drift 6px over 8s ONLY in the hero, sine, imperceptible). CTAs scale 0.98 on press, nothing more. Banned motion: bounces, spins, marquees, parallax, typing effects, looping shines, animated gradients, anything under 0.5s or over 1.2s. Reduced motion: everything visible, sweeps and drifts disabled.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: velin's boxed drop cap and italic-accent-word-in-roman-headline; silhouette's type-over-photo B/W collisions and single crimson accent word; nocturne's champagne-foil metallic small caps; an2000's glossy aqua orbs with specular sheen (Rimel's orbs are matte and never sheened); aquarelle's brush-stroke underpainting and pigment washes; kenz's spotlight cone and gold dust drift; hammam's steam veils and ripple rings. Rimel's own temptations, banned: gold text paragraphs, black ink, glossy orb highlights, more than four orbs, looping sweeps, discount theater (starbursts, slashes, countdown panic). Cross-library: eclat's photo-orbit statement (small photos drifting around a serif claim) and iris's single-aura light source are banned — Rimel's orbs are plural, matte, decorative discs, never photographs and never the page's light. Refused blocks: lottery-contest, spec-table, comparison-table.

13. EXAMPLE VARIATIONS

- Noir Encre (beauty & cosmetics, sérum-mascara, French/Algiers): The Cover hero, editorial confession, LA FORMULE on ivory carte, LE RITUEL (3 haloed steps), courrier des lectrices, price-anchor carte, order-steps, La Carte form, faq, trust-footer. Rose held at #D98A9F; orbs at hero and reviews; sweep emphasized on the hero muse shot.
- Jour 21 (beauty & cosmetics, vitamin-C skincare): The Transformation Cover hero (JOUR 1 — JOUR 21 spread), then LA FORMULE, beauty notes, before-after repeated mid-page with a second pair, photo-reviews, bundle-offers coffrets (1/2/3 months), Le Rituel d'Achat wizard, faq. Accent warmed to #E29CAE; sweep spent on the coffret cartes; the halo numerals carry the whole 21-day narrative.
- Louve (beauty & cosmetics, lipstick trio): The Carte Hero (the coffret as beauty-box page first), the shade edit with round swatches (Noir Encre, Brun Louve, Rose Thé), editorial confession, courrier des lectrices, la promesse, The Subscription Echo form pattern, trust-footer. Deepened rose #C4738A; two orbs only; sweeps reserved for shade-swap images.
- L'Oreille (jewelry & watches, gold-filled earrings): The Feature Opening hero (earlobe crop, partial face), beauty notes rewritten as jewelry notes ("Dorées à l'or fin. Peau sensible bienvenue."), LA FORMULE becomes LES MATIÈRES (gold-fill, hypoallergenic posts) on the carte, photo-reviews, price-anchor, order-steps, The Summoned Carte via floating pill, faq. Gold hairlines carry slightly more presence (still ≤3%); no before-after; the quietest sibling.
- Soie (fashion & apparel, silk scarf): The Gloss Loop hero (silk moving, muted), variant-gallery as the print edit (three prints as swatch dots), editorial confession on maintenance-free elegance, courrier des lectrices, la promesse, price-anchor, La Carte form. Accent nude, orbs at three corners; the loop replaces all sweeps — no image sweeps at all, the permitted minimum.
- Cils de Fée (beauty & cosmetics, lash serum, Arabic RTL): The Muse Stack hero — Amiri name, price caption, CTA above the fold — then LE RITUEL mirrored RTL with halos, before-after spread (١٤ يوم), courrier with Algerian cities, bundle-offers (شهر / شهرين / ثلاثة), Le Rituel d'Achat wizard in Arabic, trust-footer. Almarai body at 1.8 line-height; sweeps mirrored; halo ticks unmirrored.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
