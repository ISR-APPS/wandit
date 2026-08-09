import type { DesignWorld } from "../types";

export const cartable: DesignWorld = {
	id: "cartable",
	name: "Cartable",
	family: "schoolday",
	tagline: "Seyès paper, red margins and the bright joy of rentrée",
	kind: "cod",
	mood: ["schoolday", "tidy", "cheerful"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["kids & baby", "fashion & apparel", "home & kitchen"],
	avoidFor: ["jewelry & watches", "car accessories", "beauty & cosmetics"],
	fusesWith: ["doudou", "bulle"],
	preview: {
		ground: "#FDFDF8",
		ink: "#1F2430",
		accent: "#D9453A",
		fontFamily: "Fredoka",
		sampleWord: "La rentrée",
	},
	doc: `
CARTABLE — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Cartable is the first morning of la rentrée: a fresh notebook opened flat, seyès lines still perfect, a red margin nobody has crossed yet, a wooden ruler smelling of cedar. This world sells the September market — cartables, trousses, gourdes, uniforms, desk lamps — to parents who feel that particular mix of tenderness and logistics. The page looks like the school supplies it sells: ruled paper grounds, punched cards, ruler dividers, a teacher's red used kindly.

The charm is ORDER. Where a toy world plays and a comic world shouts, Cartable arranges: everything aligned to the ruling, everything labeled like a well-kept copybook. The joy is quiet and real — a crayon-green check, a cheerful product photo on a tidy desk — never sugary, never babyish (that is the nursery's country). Parents buy calm competence; children get the cheerfulness for free.

Copy is written like the first page of the year: neat, encouraging, concrete. "Cartable pèse 780g — le dos de votre enfant vous dira merci." Prices are stated like homework answers: clearly, underlined once. The invisible spine — hook, convince, offer, order form — is the school day: bell, lesson, exercise, and the fiche to fill before the bell rings.

Self-audit before shipping:
- Do sections sit on true seyès ruling (fine blue lines, bolder baselines), visibly aligned?
- Does every card carry its red margin rule and two punched holes on the start side?
- Are the ruler dividers wooden with cm ticks — texture only, never measuring UI elements?
- Is the red used like a kind teacher: margins, one underline, the CTA — nothing else?
- Are photos tidy-desk cheerful, never nursery-pastel, never toy-store loud?
- Is every claim parent-practical (weight, capacity, washability, warranty)?
- Does the form read as a fiche de renseignements and stay thumb-perfect at 390px?
- Zero overflow at 390/768/1440; fully readable with JavaScript off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook, convince, offer, order form — bell, lesson, exercise, fiche.
- Palette: paper #FDFDF8, seyès blue #C7D7EA with baselines #9DB8D6, ink #1F2430, margin red #D9453A, wood #C99B62, crayon green #4E9A51 ≤6%.
- Type: Latin display Fredoka 600 or Baloo 2; body Karla. Arabic display Baloo Bhaijaan 2; body Almarai.
- The three owned tics: seyès-grid grounds, hole-punched margins, ruler dividers.
- Motion identity "recess": 0.35s pops; the red margin rule draws once on the form card.
- Desktop law: centered mobile shell (~455px) on a desk-wood ground.
- Refused blocks: lottery-contest, video-testimonial, press-badges.
- Imagery: tidy-desk daylight photography per Signature Art.

CLIENT-OWNED — re-decided fresh every build:
- Hero composition from the hero menu.
- Block choice within the supported set and the block ORDER — a cartable and a gourde are different lessons.
- Form style from the form menu.
- Where the crayon green appears (checks, one badge, one underline — pick two spots).
- Proof lead: parent reviews, stats-band, or comparison-table.
- Density: a 9-block quick lesson or a 13-block full program.
Every client opens a new copybook — same ruling, new handwriting. Repeating a previous build's hero + block order + form combination means redoing the exercise.

3. VISUAL SIGNATURES

Measured values:
- Grounds: paper #FDFDF8 with the seyès grid (tic): vertical fine lines every 8px at #C7D7EA 40%, horizontal baselines every 32px at #9DB8D6 55%, drawn as a CSS background; grid visible but calm (opacity tuned so body text reads perfectly). Alternate sections may drop the grid for plain paper #FCFBF4. Desk-wood #C99B62 texture band only as the desktop backdrop and one divider zone.
- Ink #1F2430; secondary at 62%.
- Margin red #D9453A: card margin rules, ONE underline per viewport, the CTA fill, form focus states. Crayon green #4E9A51: checkmarks and one badge, ≤6%.
- Display: clamp(26px, 7.5vw, 40px) Fredoka 600, line-height 1.15; Arabic Baloo Bhaijaan 2 at 95%, no tracking.
- Body: clamp(15px, 4vw, 16.5px) Karla, line-height 1.6 aligned to the 32px baseline where possible; Almarai 1.75-1.9.
- Hole-punched margins (tic): every card = white sheet #FFFFFF, 1px #D9E2EE border, radius 8px, a vertical red rule 2px at 44px from the start edge, and TWO punched holes (10px circles, paper-ground colored with a 1px inner shadow ring) vertically spaced in the margin zone. Content begins after the margin. Never spiral coils, never torn edges.
- Ruler dividers (tic): section separators as wooden ruler strips 22px tall — wood fill, cm tick marks (1px ink, every 8px, taller tick every 40px with a small numeral), a subtle bevel line. Horizontal only, full-width, texture not measurement: they never point at or measure UI elements.
- Radii: 8px cards, 6px photos, 999px only for the punched holes and small check chips.
- Shadows: one paper shadow under cards (0 1px 4px rgba(31,36,48,0.10)).
- Spacing: the 32px baseline rules vertical rhythm; sections clamp(56px, 13vw, 80px).

4. COLOR PHYSICS

Ground register: paper white with seyès ruling; plain paper as the rest state; wood as backdrop only. Ink register: #1F2430 full, 62% secondary, never pure black. Accent physics: margin red is the teacher's pen — it RULES margins, underlines one phrase per viewport, fills the CTA and marks focus; it never floods a section and never colors body copy. Crayon green is the reward — checkmarks, one "Approuvé parents" badge, capped at 6%. Seyès blues are structure, never content color. Forbidden: pastels-candy (doudou's register), neon, gradients, black grounds, more than one red underline per viewport, and gold-star clichés (stars are rating glyphs only, in ink). Form errors: the margin red with a gentle message — corrections, kindly.

5. TYPOGRAPHY

Latin stack. Display: Fredoka 600 first — rounded schoolbook warmth with adult discipline; Baloo 2 as second choice. Body: Karla 400/700 — clean copybook hand. Numbers tabular in specs, sizes and prices.
Arabic stack. Display: Baloo Bhaijaan 2 (600); body Almarai 400/700. Arabic display at 95% of Latin clamps; body line-height 1.75-1.9; NEVER letter-spacing on Arabic.
Pairing rule: one display + one body per build; display owns titles, prices and section labels ("LEÇON 2 — LE CONFORT"); body owns everything else. Labels may use small-caps-style Karla 700 at 12px, tracked 0.08em (Latin only). RTL: the red margin and punched holes move to the RIGHT edge of cards; ruler numerals stay Western Arabic; digits Western Arabic; phone LTR-wrapped.

6. SIGNATURE ART AND COMPONENTS

The seyès ground is the world's air: content genuinely aligns to its baselines — headings sit ON lines, cards span exact multiples. The punched-margin card is the vessel: every piece of content is a neat sheet filed in the year's binder. The ruler divider is the furniture: wood, ticks, calm.

Supporting cast: the "étiquette" name-label (a white label with red double-rule top and bottom, like nametags ironed into uniforms) used for section kickers and the brand lockup; crayon-green checkmarks (drawn 2.5px strokes) in benefit lists; the "note du prof" chip (small red-underlined phrase, e.g. "Très bien — 780g seulement"); paperclip glyphs (2px line) allowed as list markers, maximum four; a pencil-line arrow (ink, slightly imperfect stroke) guiding to the form once per page. Icons: 2px line icons from the school desk (backpack, bottle, pencil, clock), max 6.

Imagery. Tidy-desk daylight photography: products on a clean wooden school desk or against paper backgrounds, bright soft morning light, accents of red and blue stationery in frame, everything arranged with visible care; children appear only as hands or from behind (worn backpack), never faces. Color-grade: honest daylight, crisp whites, warm wood. Banned in photos: candy-pastel nursery styling, chalkboards with scribbles, apple-on-desk clichés stacked together, dark moody light, clutter.

7. THE SPINE

Hook, convince, offer, order form — bell, lesson, exercise, fiche. Price placement: FIRST PRICE IN THE HERO, written on an étiquette label ("4 900 DA") with one red underline — the price is homework's clear answer. Sticky CTA: a bottom bar as a slim paper strip with a red CTA slab ("COMMANDER — 4 900 DA"); appears after the hero; tapping scrolls to the fiche. Mobile-first at 390px. Desktop law: CENTERED MOBILE SHELL at ~455px on the desk-wood ground — the copybook centered on the desk.

8. BLOCKS TREATMENT

Supported blocks, dressed by Cartable:
- announcement-bar: a seyès-ruled strip with one line in Karla 700 ("Livraison 58 wilayas — paiement à la livraison"), red rule beneath.
- hero: copybook opening — étiquette brand, product photo on a punched card or clean paper, price label, CTA. See hero menu.
- benefits-icons: a punched card with a checklist — crayon-green checks + short gains aligned to baselines ("780g", "Lavable en machine", "Garantie 12 mois").
- how-it-works-steps: "LEÇON 1/2/3" — three punched mini-cards, each photo + one sentence; ruler divider above the block.
- spec-table: the fiche technique — rows on ruled lines, labels left, values right in tabular numerals; a red underline on the single most parent-relevant row.
- comparison-table: "LE BON CHOIX" — ink-ruled table on a punched card, checks in crayon green, crosses in 62% ink; max two rival columns.
- stats-band: a plain-paper band with three display numbers ("12 000 cartables", "4,8/5", "24-72h") each sitting on a drawn baseline.
- photo-reviews: "MOT DES PARENTS" — punched cards with quotes, name + wilaya, small square photos; a green check "Achat vérifié" chip.
- whatsapp-proof: allowed as printed correspondence — messages retyped neatly on ruled lines with timestamps (never chat-app chrome, never bubbles-with-tails in app colors).
- variant-gallery: colors/sizes as étiquette labels in a row (each label swatched), selected label gets the red underline; feeds the form.
- size-guide: the school chart — a ruled table of age/height/size with a small how-to-measure line; friendly, precise.
- bundle-offers: "PACK RENTRÉE" cards — cartable seul / + trousse / + gourde, the full pack marked with the green badge "Le choix des parents"; feeds the form.
- price-anchor: the exercise corrected — old price struck with one red line, new price large on an étiquette, savings noted as "Économie: 1 600 DA" with a red underline.
- order-steps: the school-day routine — 4 steps on ruled lines with paperclip markers: fiche → appel → livraison → paiement à la porte.
- faq: "QUESTIONS DES PARENTS" — ruled accordion, questions in display 15px, answers in body.
- order-form: see form menu.
- trust-footer: plain paper, brand étiquette, phone large, mentions at 62%.

Refused blocks:
- lottery-contest: school rewards effort, not raffles; a tombola cheapens the copybook.
- video-testimonial: moving pictures shake the ruled calm; parents here read.
- press-badges: no borrowed logos on a copybook; parent words and numbers carry it.

9. HERO MENU

- The First Page: seyès ground, étiquette brand top-left, product photo on a large punched card, price label + red underline, CTA beneath; the canonical opening.
- The Desk Scene: full-width tidy-desk photo, a punched content card overlapping its lower edge with title, price and CTA; ruler divider closing the hero.
- The Checklist Open: hero as a big checklist card — product photo right, three green-checked promises left, price and CTA below. For parents who scan.
- The Étiquette Stack: no photo until section two; a stack of three labels (brand / promise / price) on ruling, CTA beneath; for known brands or text-strong offers.
- The Pack Flat-Lay: the full pack photographed from above on paper, small ink annotations under each item (name only), price label, CTA. For bundles.
- The Fiche Express (RTL builds): mirrored First Page — margin and holes on the right, Arabic étiquettes, same calm.

10. FORM MENU

- La Fiche (single card): one punched card titled "FICHE DE COMMANDE" on an étiquette; fields stacked on ruled lines (nom du parent, téléphone, wilaya, commune, taille/pack); red CTA; reassurance beneath in body ("Paiement à la livraison — appel de confirmation").
- Le Contrôle en Deux Parties (2-step): partie 1 — pack/variant labels; partie 2 — coordonnées; progress as "1/2 → 2/2" in display; the red margin rule draws when partie 2 appears.
- L'Échauffement (hero-echo): a single phone field on a small punched strip under the hero ("On vous rappelle pour tout noter") repeated as La Fiche at the end.
- Le Rappel de la Cloche (sticky-driven): the paper sticky bar is the only CTA; tapping scrolls to La Fiche and focuses the first field.

11. MOTION IDENTITY

Recess. Entrances pop in 0.35s (power2.out) with a 4px settle — supplies placed on the desk. THE signature, once per page: when the form card enters, its red margin rule DRAWS downward (clip-path wipe, 0.5s) — the teacher ruling the page before writing. Checkmarks draw their stroke (0.25s) when benefit lists enter. Ruler dividers and grounds never animate. No loops anywhere. Reduced motion: all static, margin pre-ruled, checks pre-drawn. Banned: bouncing, wobble, parallax, scroll scrubs, confetti, and anything cuter than a checkmark.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics banned by name: carnet's spiral/stitched binding edge, handwritten Caveat annotations and pinned polaroids (Cartable is the pupil's NEAT copybook: printed type, punched holes, zero handwriting); gabarit's dimension lines with arrowheads and title-block cartouches (rulers here are texture, they measure nothing); pupitre's footnote system and wax seals; hypertexte's default-web furniture; bulle's comic panels and speech bubbles; doudou's cloud scallops, balloon numerals and toy-button CTA (the nursery is next door, not here).
Cartable's own temptations, banned: apple-and-chalkboard kitsch, gold stars, more than one red underline per viewport, handwriting fonts anywhere, grid so dark it fights text, childish rounded-everything.
Refused blocks restated: lottery-contest, video-testimonial, press-badges.

13. EXAMPLE VARIATIONS

- "Cartable Robot" — kids & baby. The First Page hero; order: announcement, hero, benefits checklist, spec-table (780g underlined), photo-reviews parents, comparison LE BON CHOIX, bundle PACK RENTRÉE, price-anchor, order-steps, La Fiche form, faq, footer. Signature: margin rule draws on the fiche. Mood: September confidence.
- "Gourde Isotherme École" — kids & baby / home & kitchen. The Checklist Open hero; order: announcement, hero, how-it-works LEÇONS, spec-table, reviews, stats band, variant labels (3 couleurs), price-anchor, L'Échauffement + Fiche, faq, footer. Mood: hydration homework done.
- "Uniforme Primaire" — fashion & apparel, RTL. The Fiche Express hero; order: announcement, hero, size-guide chart, benefits, reviews parents, whatsapp printed correspondence, bundle (2 ensembles), price-anchor, Contrôle en Deux Parties, order-steps, footer. Mood: rentrée bien rangée.
- "Lampe de Bureau Écolier" — home & kitchen. The Desk Scene hero; order: announcement, hero, benefits, spec-table, comparison, reviews, price-anchor, cross-sell? (not supported — instead bundle with ampoule), stats, La Fiche, faq, footer. Mood: devoirs du soir.
- "Trousse Complète 24 pièces" — kids & baby. The Pack Flat-Lay hero; order: announcement, hero, benefits checklist, unboxing-style spec rows, reviews, stats, price-anchor, bundle, Rappel de la Cloche flow, faq, footer. Mood: tout est prêt.
- "Sac à Dos Collège" — kids & baby / fashion & apparel. The Étiquette Stack hero; order: announcement, hero, spec-table, benefits, comparison, reviews, variant labels, price-anchor, La Fiche, order-steps, footer. Mood: grands sérieux.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
