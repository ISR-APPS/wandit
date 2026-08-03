import type { DesignWorld } from "../types";

export const expo: DesignWorld = {
	id: "expo",
	name: "Expo",
	family: "showroom",
	tagline: "Showroom clarity: energy labels and shelf tags",
	kind: "cod",
	mood: ["retail", "bright", "practical", "trusted"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["home & kitchen", "electronics & gadgets", "health & wellness"],
	avoidFor: ["fashion & apparel", "jewelry & watches"],
	fusesWith: ["teleachat", "circuit", "telj"],
	preview: {
		ground: "#FCFCFD",
		ink: "#17202A",
		accent: "#1B67D0",
		fontFamily: "Archivo",
		sampleWord: "Classe A",
	},
	doc: `
EXPO — THE APPLIANCE FLOOR

1. PHILOSOPHY

Expo is the big-brand showroom on a Saturday morning: white floors, straight aisles, a
salesman who knows the wattage by heart and a price tag that hides nothing. This world sells
appliances and practical machines the way good retail does — with CLARITY as charisma. No
theater, no dark rooms: bright even light, honest photography, and the two most trusted
graphic objects in retail as its signature voice: the ENERGY LABEL (those A-to-G colored
arrows every household reads fluently) and the SHELF TAG (big price, per-unit line, reference
number). Expo speaks fluent household economics: consumption, capacity, warranty, price per
liter. Its wit is quiet and physical — sections plug into each other with a drawn cord and
socket, because in this world everything WORKS. The voice is the good salesman's voice:
concrete, unhurried, never pushy — "8 litres, la famille entière", "classe A, ta facture le
sent." Expo is where a serious purchase feels safe to make from a phone.

Self-audit before shipping:
- Do energy-label bars rate real qualities (silence, consommation, vitesse) with honest
  letters — never fake A+++ on everything?
- Are shelf-tag prices complete: big price, per-unit or per-portion line, small ref?
- Does ONE cord-and-socket join appear between two sections that logically connect?
- Is the photography bright, even, appliance-true — zero moody shadows?
- Could the buyer answer capacity, power, warranty and delivery after one scroll?
- Is the page free of urgency theater — confidence instead of countdowns?
- Price early, sticky CTA reachable, fields ≥52px, COD reassurance near the form?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The aisle leads to the register.
- Palette registers: grounds #FCFCFD / floor gray #EFF1F3; ink #17202A; brand blue #1B67D0;
  energy ramp green #2FA84F → red #E23B2E (labels only); price orange #F27E12 (tags only).
- Type stacks: Latin display Archivo (900) or Inter (900); body Inter. Arabic display Cairo;
  body Almarai.
- The three owned tics: energy-label bars, shelf-tag prices, plug-and-socket joins.
- Motion identity "showfloor": 0.35s slides; label arrows grow once.
- Desktop law: responsive expansion, max 1120px.
- Refused blocks: lottery-contest, whatsapp-proof, before-after.
- Imagery style: bright showroom photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER — a fryer aisle differs from a
  vacuum aisle.
- Form style from the form menu.
- Proof lead: photo-reviews or stats-band or press-badges (certifications) per product.
- Which qualities get energy-label ratings (3-5 per build) and the single socket-join
  placement.
- Section rhythm: quick errand (8 blocks) or full showroom tour (14 blocks).
Every client gets a new aisle, never a photocopy of the last flyer. Clones fail.

3. VISUAL SIGNATURES

Measured values:
- Grounds: #FCFCFD page, #EFF1F3 floor-gray sections (alternating), cards #FFFFFF with
  1px #DFE4EA borders.
- Ink: #17202A primary, #5A6672 secondary; blue #1B67D0 for CTAs, links, active states.
- Energy ramp: A #2FA84F, B #7DBA3C, C #C9CE30, D #F2C21C, E #F29A1C, F #ED6A22, G #E23B2E —
  used ONLY inside label bars. Price orange #F27E12 lives ONLY on shelf tags.
- Display type: clamp(28px, 8vw, 44px) Archivo 900, line-height 1.1; section titles
  clamp(20px, 5.5vw, 28px); body clamp(15px, 4vw, 16px)/1.6; tabular numerals everywhere
  numbers compare.
- Radii: 8px cards, 4px tags and labels, 999px only on the sticky pill.
- Borders: 1px #DFE4EA everywhere structure needs it; label bars carry a 1px ink outline.
- Shadows: none — retail light is even; separation by border and floor-gray.
- Spacing: sections clamp(52px, 13vw, 80px); grids gap 16/24.
- ENERGY-LABEL BARS (tic): left-pointing arrow bars in the EU-label ramp, stacked A-to-G
  style — each rates a REAL quality ("SILENCE — A", "CONSOMMATION — B") with the letter in a
  white chip at the arrow's tip. 3-5 per build, always together in one labeled panel.
- SHELF-TAG PRICES (tic): the price presented on a drawn shelf-rail tag — white tag, 1px
  ink border, price huge in ink, per-unit line beneath in #5A6672 ("2 112 DA / litre" or
  "56 DA / repas"), small ref code corner ("RÉF. AF-8L-24"), price-orange corner triangle.
- PLUG-AND-SOCKET JOINS (tic): ONE place per page where a drawn cord leaves a section's
  bottom edge and plugs into a socket at the next section's top — the page literally
  connected. 2px ink cord, simple two-pin socket.

4. COLOR PHYSICS

Ground register: #FCFCFD ↔ #EFF1F3 alternation is the aisle rhythm. Ink register: #17202A /
#5A6672. Blue physics: #1B67D0 is the single brand voice — CTAs, links, selected states,
section eyebrows; may deepen to #1450A8 on press; never fills grounds. Energy ramp: sacred
to labels — if a ramp color appears outside a label bar, the build fails. Price orange:
sacred to shelf tags. Forbidden: black, gradients, dark sections, pastel washes, glassy
effects, any second brand hue. Form errors #D64541, form-internal only.

5. TYPOGRAPHY

Latin stack. Display: Archivo (900) — retail-poster muscle with engineering calm; Inter
(900) as alternate when the client wants pure neutrality. Body: Inter (400/600), tabular
numerals ON for every spec and price. Pairing rule: display for headline, section titles,
tag prices; Inter for all else; label letters (A-G) in Archivo 900.
Arabic stack. Display: Cairo (800). Body: Almarai (400/700). Pairing fixed.
Clamps shared; Arabic display 92%; Arabic body line-height 1.75-1.9; NEVER letter-spacing
on Arabic (Latin caps 0.02-0.05em). Digits: Western Arabic numerals; units always stated
(L, W, kg, دج); phones in LTR spans under RTL; logical properties throughout; label arrows
flip direction under RTL (point toward the reading start).

6. SIGNATURE ART AND COMPONENTS

The energy-label panel is Expo's trust engine: one bordered panel titled "FICHE ÉNERGIE" (or
Arabic equivalent) holding 3-5 rated bars — place it where a spec-heavy world would put its
table's emotional peak. Shelf tags carry EVERY price on the page (hero, bundles, cross-sell)
— price never floats naked. The single socket-join connects the two most logically-linked
sections (e.g. how-it-works → spec-table). Supporting cast: white cards with 1px borders;
blue eyebrow labels ("AISLE 04 · CUISSON"); check rows for included items; a floor-line
divider (1px with a 4px gray baseboard) between major zones; the CTA a blue block button,
full-width, square-cornered but for 8px.

Imagery: bright appliance-showroom photography. White-to-pale-gray seamless, even shadowless
lighting, the machine frontal and three-quarter like a catalog; in-use shots on clean
counters with real food results (golden fries, fresh juice) under the same bright light;
detail macros of panels and baskets. Hands allowed operating controls, never faces. Banned
in photos: moody shadows, colored gels, lifestyle clutter, dark kitchens, lens flares.

Number discipline: every figure on the page carries its unit and its context — never "8L"
alone but "8 L — la famille entière"; never watts without what they cost ("2000 W · ~9 DA
la soirée"). When two numbers could be compared, Expo compares them itself before the buyer
must. Reference codes appear on every tag because retail memory works by ref; the same ref
reappears in the form summary, closing the loop between aisle and register.

7. THE SPINE

Hook, convince, offer, order form — the aisle order, invisible and locked. Price placement:
EARLY IN THE HERO — the hero carries the first shelf tag under the headline; a buyer who
reads nothing else still leaves knowing the price and the per-use math. Sticky CTA: a white
bottom bar with 1px top border — shelf-tag mini (price + ref) at the start side, blue pill
"Commander — paiement à la livraison" at the end side; appears after the hero, scrolls to
the form. Mobile-first at 390px; desktop is RESPONSIVE EXPANSION to max 1120px — the fiche
énergie and spec-table sit side-by-side, proof goes two-up, the socket-join cord stretches.

8. BLOCKS TREATMENT

Supported blocks, dressed by Expo:
- announcement-bar: white strip, 1px bottom border, ink text — "Livraison 58 wilayas ·
  Paiement à la livraison · Garantie 12 mois", one blue plug glyph.
- benefits-icons: 4-6 white cards, drawn line icons (drop, timer, leaf, shield), one-line
  labels; the panel's title row may carry a small A-chip when a benefit is energy-rated.
- spec-table: the fiche technique — bordered rows, tabular values with units, ref codes;
  sober and complete (capacité, puissance, dimensions, poids, garantie).
- how-it-works-steps: 3-4 numbered steps in white cards (remplir, régler, lancer); step
  numbers in blue squares; ends at the socket-join when adjacent to specs.
- stats-band: floor-gray band, three counters (familles équipées, wilayas, note moyenne) in
  Archivo 900, counts once.
- comparison-table: "AirFry XXL vs friture classique" — check/cross matrix with honest rows
  (huile utilisée, odeurs, nettoyage, coût/mois); never mocks, just measures.
- photo-reviews: white cards, name + city + purchase date, stars as blue squares, practical
  quotes ("la facture d'huile a disparu"); one kitchen photo per 2-3 reviews.
- press-badges: certification row — CE, ISO, "garantie constructeur" chips as bordered
  badges; never invented awards.
- guarantee-seal: a bordered white panel — shield icon, "12 mois pièces et main d'œuvre ·
  échange sous 7 jours", SAV phone line beneath.
- price-anchor: the full shelf tag at maximum size: old price struck in gray, new price
  huge, per-use math line, savings chip in price orange; blue CTA beneath.
- bundle-offers: capacity or quantity packs as side-by-side cards, each with its OWN complete
  shelf tag (retail never merges tags); the better per-unit math gets a small "meilleur
  prix/L" chip in price orange; selection feeds the form.
- cross-sell: "complète ton aisle" — one accessory card with its own mini shelf tag and a
  checkbox that feeds the form total.
- order-steps: 4 blue-numbered steps: commande en 1 minute, appel de confirmation, livraison
  à domicile, paiement à la réception.
- faq: bordered accordions, practical questions (consommation réelle, bruit, SAV, retour).
- trust-footer: floor-gray, showroom identity line, phone + WhatsApp large, horaires,
  "depuis 2016 · 58 wilayas livrées." A last mini shelf tag may restate the offer beside the
  contact block, ref included, so the floor's final aisle still shows a price.
Refused blocks: lottery-contest (a showroom doesn't raffle trust), whatsapp-proof (retail
proof is reviews and certifications, not chat screenshots), before-after (machines
demonstrate, they don't transform selfies).

9. HERO MENU

- L'Allée Centrale: product large on white, headline above, first shelf tag + blue CTA
  beneath, three benefit chips in a row — the default aisle end-cap.
- La Fiche Vitrine: split hero — photo left, right column stacks headline, three mini
  energy bars, shelf tag, CTA; the spec-forward opening.
- La Démo: in-use photo hero (machine working, results visible), headline overlaid on the
  bright zone, shelf tag pinned bottom-start, CTA in the first sticky appearance.
- Le Duo Capacité: two capacity variants side by side (5L / 8L) as cards with their own
  tags; headline above, chooser feeds the form; for capacity-led products.
- Le Prix d'Appel: price-first — the shelf tag HUGE at top (the flyer move), product photo
  beneath, three check rows, CTA; for aggressive offers.
- L'Étage Résultat: result-first — golden-fries macro leads, headline promises the outcome,
  product inset in a bordered card with tag + CTA.

10. FORM MENU

- Le Bon de Commande (single card): white bordered card, blue header strip ("Commande —
  paiement à la livraison"), stacked fields, shelf-tag summary at top, blue submit.
- L'Allée en 2 Temps (two-step wizard): step 1 modèle/capacité + accessoire (cards with mini
  tags), step 2 nom + téléphone + wilaya; a blue progress bar of two segments; summary
  restates the tag total.
- L'Écho Rapide: compact 2-field echo (téléphone + wilaya) under the hero, full Bon de
  Commande at the end; echo submit scrolls down.
- La Caisse: sticky-bar-driven — the bar's pill opens the form with the first field focused;
  for short flyer builds.

11. MOTION IDENTITY

Showfloor: motion behaves like good retail staff — present, efficient, never performing.
Nothing on this floor blinks, pulses or begs; things arrive, align, and stand straight.
Entrances slide 20px with 0.35s power2.out, 60ms staggers, everything settling
flat and stable. The ONE signature moment: energy-label arrows GROW from the reading start
to full width (0.5s each, 80ms stagger, once) when the fiche énergie enters. Shelf-tag
prices fade in complete (no count-ups — retail prices don't perform). The socket-join cord
draws its short path once (0.4s) as the join scrolls into view. NO loops, no parallax, no
pulses, no overshoot. Reduced-motion: all static, labels full, cord connected. gsap.set
only; the page reads perfectly without JS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji-as-design, Poppins-everything,
lorem ipsum, fake trust walls, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur, back.out overshoot. Neighbor tics banned by name: circuit's feature leader
lines, PCB traces and datasheet strip (Expo tables are retail fiches, never engineering
annotation); teleachat's TV bezel, lower-thirds and value-stack tower; remede's dosage bars
(energy bars are RATINGS with letters, never ingredient fills — restated); trottoir's
courier labels and barcodes; scoop's corner flash ribbons; turbo's gauges and rockers;
souk's starbursts. Expo's own temptations, banned: fake A+++ everywhere (ratings must vary
honestly), urgency mechanics, dark "premium" sections, decorative wattage lightning bolts,
price without per-unit math. Refused blocks restated: lottery-contest, whatsapp-proof,
before-after.

13. EXAMPLE VARIATIONS

- "AirFry XXL 8L" — home & kitchen, fr-DZ. L'Allée Centrale hero; order: announcement,
  hero, benefits-icons, how-it-works-steps, (socket-join), spec-table, energy panel inside
  benefits? no — fiche énergie as its own beat after specs, comparison-table, photo-reviews,
  press-badges, guarantee-seal, price-anchor, cross-sell, order-steps, order-form (Le Bon de
  Commande), faq, trust-footer. Mood: family upgrade, zero doubt.
- "Aspirateur Cyclone 2200" — home & kitchen. La Fiche Vitrine hero; order: announcement,
  hero, spec-table, (socket-join), how-it-works-steps, stats-band, photo-reviews,
  guarantee-seal, price-anchor, order-form (L'Allée en 2 Temps), faq, trust-footer. Mood:
  Saturday errand done right.
- "Extracteur Vital" — health & wellness. L'Étage Résultat hero (juice macro); order:
  announcement, hero, benefits-icons, how-it-works-steps, spec-table, photo-reviews,
  press-badges, guarantee-seal, price-anchor, cross-sell (bouteilles), order-form (L'Écho
  Rapide), faq, trust-footer. Mood: health as home economics.
- "Clim Mobile 9000 BTU" — electronics & gadgets. Le Prix d'Appel hero; order: announcement,
  hero, spec-table, fiche énergie beat, comparison-table (vs ventilateur), photo-reviews,
  guarantee-seal, price-anchor, order-steps, order-form (La Caisse), faq, trust-footer.
  Mood: summer solved.
- "Machine Expresso Bar" — home & kitchen. La Démo hero; order: announcement, hero,
  how-it-works-steps, (socket-join), spec-table, stats-band, photo-reviews, guarantee-seal,
  price-anchor, cross-sell (capsules), order-form (Le Bon de Commande), faq, trust-footer.
  Mood: café at home, receipts to prove it.
- "Duo Blender 5L/8L" — home & kitchen. Le Duo Capacité hero; order: announcement, hero,
  benefits-icons, spec-table, photo-reviews, guarantee-seal, price-anchor (both tags),
  order-form (L'Allée en 2 Temps), faq, trust-footer. Mood: pick your size, keep your
  Saturday.
- "Chauffage Céramique 2000W" — home & kitchen, winter aisle. La Fiche Vitrine hero; order:
  announcement, hero, spec-table, fiche énergie beat (SILENCE — A, CONSOMMATION — C stated
  honestly), how-it-works-steps, (socket-join into) photo-reviews, guarantee-seal,
  price-anchor with per-soirée math, bundle-offers (1 pièce / pack chambre+salon),
  order-form (Le Bon de Commande), faq, trust-footer. Mood: December handled, facture
  respected.
These show the range. NEVER copy one — remix their choices or invent a new variation in the
same spirit.
`,
};
