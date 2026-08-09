import type { DesignWorld } from "../types";

export const bivouac: DesignWorld = {
	id: "bivouac",
	name: "Bivouac",
	family: "outdoor-trail",
	tagline: "Trailhead gear: canvas, carabiners, ember light",
	kind: "cod",
	mood: ["rugged", "warm", "outdoor", "ready"],
	energy: "medium",
	priceFeel: "accessible",
	industries: [
		"fitness equipment",
		"electronics & gadgets",
		"car accessories",
		"home & kitchen",
	],
	avoidFor: ["beauty & cosmetics", "jewelry & watches", "kids & baby"],
	fusesWith: ["impact", "turbo", "bahr"],
	preview: {
		ground: "#EFE6D2",
		ink: "#26221B",
		accent: "#E0662C",
		fontFamily: "Staatliches",
		sampleWord: "CAMP",
	},
	doc: `
BIVOUAC — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Bivouac is the trailhead depot an hour before sunset: sand-colored canvas, pine shadow, gear that clips, straps and folds, and one ember-orange light warming the whole scene. This world sells equipment for people who leave the city on Friday — lanterns, tents, coolers, straps, boots — and it earns their trust the way good gear does: by looking field-tested, not fashion-shot. Everything on the page has the material logic of a pack: fabric panels, webbing edges, clipped tags, sewn patches. If an element couldn't survive being strapped to a roof rack, it doesn't belong here.

Bivouac is rugged-WARM. It is not the gym (no grit, no sweat, no shouting lime), not the garage (no carbon, no gauges), and absolutely not a map (no routes, no compasses, no contour romance — the trail is felt through material, never drawn as geography). The mood is the calm competence of someone checking the knots twice. Copy is practical and warm: short sentences, verifiable claims ("14 heures d'autonomie. Testée sous la pluie."), an invitation rather than a dare.

The invisible spine — hook, convince, offer, order form — is the packing ritual: see the gear, trust the gear, get the price, give your wilaya. Nothing on the page delays that ritual for decoration's sake.

Self-audit before shipping:
- Do the cards read as rip-stop fabric with webbing edges, not as flat rectangles?
- Are labels and badges CLIPPED (carabiners) or SEWN (patches), never floating?
- Is ember orange under 10% of every viewport — a campfire, not a wildfire?
- Zero map language: no routes, no pins, no compasses, no contours anywhere?
- Do sand and pine sections alternate with clear material difference?
- Is every claim concrete and field-verifiable in one line?
- Is the form as easy to fill with cold thumbs as a good buckle is to close?
- Zero overflow at 390/768/1440; page fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook, convince, offer, order form. The pack order never changes.
- Palette: sand #EFE6D2 and pine #2F4A3A grounds; ink #26221B; ember #E0662C ≤10%; khaki #8A845E; webbing black details.
- Type: Latin display Staatliches or Oswald; body Barlow. Arabic display Changa; body Almarai.
- The three owned tics: rip-stop texture panels, carabiner tags, canvas patch badges.
- Motion identity "packed & clipped": 0.35s drops with strap-settle; carabiner tags clip on once.
- Desktop law: responsive expansion, max 1080px.
- Refused blocks: lottery-contest, whatsapp-proof, before-after.
- Imagery: dusk-warm outdoor gear photography per Signature Art.

CLIENT-OWNED — re-decided fresh every build:
- Hero composition from the hero menu.
- Block choice within the supported set and the block ORDER — a lantern and a cooler pack differently.
- Form style from the form menu.
- Which sections take pine grounds (one to three per build).
- Proof lead: photo-reviews, stats-band, or video-testimonial.
- Density: a lean 9-block day-hike or a 13-block expedition.
Every client gets freshly packed gear — same depot, different load-out. A repeated hero + block order + form combination is a failed inspection.

3. VISUAL SIGNATURES

Measured values:
- Grounds: sand #EFE6D2 base; pine #2F4A3A sections (1-3 per build) with cream ink; a khaki #8A845E band allowed once as a divider zone.
- Ink: #26221B on sand; #F2EBDA on pine; secondary at 65%.
- Ember #E0662C: CTAs, active states, one highlighted stat, the lantern glow accents. Hard cap 10% per viewport.
- Display: clamp(28px, 8vw, 44px) Staatliches caps, line-height 1.05, tracking 0.02em; Arabic Changa 700 at 92%, no tracking.
- Body: clamp(15px, 4vw, 16.5px) Barlow, line-height 1.6; Almarai 1.75-1.9.
- Rip-stop panels (tic): cards carry a subtle rip-stop grid texture (4-6% opacity crosshatch, 8px cell) on sand-tone fill #F4EDDC, edged top and bottom by a 6px webbing strap band (flat black or khaki with visible stitch dashes in thread cream). Radius 6px. No other card treatment exists.
- Carabiner tags (tic): labels/badges hang from a drawn aluminium carabiner (28-36px, 2.5px stroke, gate visible) clipped to the panel's webbing edge; the tag itself is a rounded rectangle 4px radius with a punched hole. Used for prices on cards, section labels, guarantee chips.
- Canvas patch badges (tic): claims rendered as embroidered-style patches — oval or shield, canvas fill #E7DCC2, merrowed border (4px dashed-loop edge in ember or pine), stitched-look caps text. Used for guarantee, "TESTÉ ATLAS", stats highlights. Max three per page.
- Radii: 6px panels, 4px tags, 999px never (no pills — gear is not candy).
- Borders: webbing bands as described; 1.5px ink hairlines on tables.
- Shadows: one soft contact shadow under panels (0 2px 8px rgba(38,34,27,0.12)) — gear sits on the table, it does not float.
- Spacing: sections clamp(56px, 14vw, 88px); panel grids gap 14px.

4. COLOR PHYSICS

Ground register: sand #EFE6D2→#F4EDDC and pine #2F4A3A→#37564A. The alternation is the trail rhythm: open clearing, under the trees. Ink register: #26221B / cream #F2EBDA on pine; 65% secondary. Accent physics: ember #E0662C is firelight — CTAs, the active bundle, one stat, lantern-glow touches in imagery; it never grounds a section and never colors body text. Khaki #8A845E is structural (bands, straps, muted labels). Forbidden: neon anything, lime (impact's), carbon black grounds (turbo's), sky-blue cheerfulness, gradients except the photographic dusk itself, and every mapping color code. Form errors: #B3402A, form-internal.

5. TYPOGRAPHY

Latin stack. Display: Staatliches first — condensed, stamped, quartermaster confident; Oswald as alternative for longer product names. Body: Barlow 400/600 — legible with cold hands. Numbers tabular for specs and prices.
Arabic stack. Display: Changa 700; body Almarai 400/700. Arabic display at 92% of Latin clamps; body line-height 1.75-1.9; NEVER letter-spacing on Arabic (Latin caps may track 0.02-0.05em).
Pairing rule: one display + one body per build. Display owns section titles, prices, patch text, tag labels. Body owns paragraphs, specs, forms. RTL: webbing edges and carabiner clips mirror to the right edge; digits Western Arabic; phone numbers LTR-wrapped.

6. SIGNATURE ART AND COMPONENTS

The rip-stop panel is the world's material truth: every card is fabric with webbing. The carabiner tag is its jewelry: prices and labels CLIP to things, with the little aluminium gate drawn honestly. The canvas patch is its medal: guarantees and proof stitched on like summit patches on a pack.

Supporting cast: strap-buckle dividers (a webbing line with a drawn side-release buckle at its center) between major zones — used twice per page maximum; spec rows as stitched lists (dash-stitch rule between rows); the CTA as an ember slab with a subtle strap-stitch border; quantity steppers styled as strap adjusters. The lantern-glow motif: on pine sections, one warm radial ember glow may sit behind the product image (small, honest, never a spotlight cone). Icons: 2px-stroke line icons from the gear world only (tent, flame, battery, drop), max 6 per page.

Assembly rules: a rip-stop panel never sits directly on another panel — panels rest on grounds, with the webbing edges doing the separating; carabiner tags always clip to a webbing edge or a strap line, never to bare ground (a clip needs something to bite); patches never overlap photos. When a pine section follows a sand section, the ruler of hierarchy flips with it — cream display on pine must be one clamp step smaller than ink display on sand, so the night sections read as interludes, not competitors.

Imagery. Dusk-warm outdoor gear photography: products on canvas, wood, or forest ground at golden-blue hour; one warm light source (lantern or fire glow) against cool pine shadow; textures visible — rip-stop weave, webbing, brushed aluminium; hands in work gloves allowed, faces never; the campsite is tidy, the gear is the hero. Color-grade: warm ember highlights, cool green-blue shadows, true material color. Banned in photos: maps and compasses as props, studio white seamless, urban interiors, HDR crunch, artificial neon.

7. THE SPINE

Hook, convince, offer, order form — see it, trust it, price it, order it. Price placement: FIRST PRICE IN THE HERO on a carabiner tag clipped to the hero panel — the price hangs on the gear like in a real depot. Sticky CTA: a bottom strap-bar (webbing texture, ember CTA "COMMANDER — 190 MAD"), always reachable after the hero, scrolls to the form. Mobile-first at 390px. Desktop law: RESPONSIVE EXPANSION to max 1080px — panels form 2-3 column grids, the hero splits photo/content; the depot has room on a big table.

8. BLOCKS TREATMENT

Supported blocks, dressed by Bivouac:
- announcement-bar: a khaki webbing strip, cream caps text ("LIVRAISON 58 WILAYAS — PAIEMENT À LA LIVRAISON"), stitch dashes along its edges.
- hero: product on sand or pine, price on a clipped tag, patch badge for the key claim, CTA slab. See hero menu.
- benefits-icons: rip-stop panels in a 2-col grid, each with one line icon + one concrete gain ("14h d'autonomie").
- how-it-works-steps: 3 steps as a strap sequence — buckle divider between steps, each step photo + one sentence ("Déplie. Charge au soleil. Éclaire.").
- spec-table: stitched list rows — spec name left, value right in tabular numerals, dash-stitch rules; a carabiner tag holds the table's title.
- stats-band: a pine band with three cream display numbers, one in ember ("12 000+ campeurs", "14h", "4,8/5").
- photo-reviews: review cards as rip-stop panels, name + city + a patch-style "ACHAT VÉRIFIÉ" mini-badge; customer photos square, 6px radius.
- video-testimonial: one poster-framed muted loop inside a rip-stop panel with webbing top/bottom; caption beneath ("Sous la pluie à Chréa — 0 souci.").
- guarantee-seal: the canvas patch, full size — "ÉCHANGE 7 JOURS / GARANTIE 12 MOIS" stitched circle-shield; one warm sentence beside it.
- price-anchor: the depot slate — old price on a crossed-out tag, new price big in display, savings on a small patch; per-use math in body ("~6 MAD la nuit éclairée").
- bundle-offers: pack cards — SOLO / DUO CAMP (x2), the value pack wears the ember tag "LE PLUS PRIS"; feeds the form.
- cross-sell: one clipped add-on panel ("+ Mousqueton lampe porte-clés — 45 MAD") with a checkbox styled as a small buckle.
- stock-urgency: one honest tag line ("Reste 62 lampes avant rupture saison") clipped near the offer; no meters, no drama.
- order-steps: 4 steps with line icons: formulaire → appel → livraison 24-72h → paiement à la porte; buckle divider above.
- faq: stitched accordion — question in display 15px, dash-stitch rules, answers in body.
- order-form: see form menu.
- trust-footer: pine ground, brand line, phone huge, WhatsApp line, mentions at 65%.

Refused blocks:
- lottery-contest: raffles are carnival noise; the trail rewards preparation, not luck.
- whatsapp-proof: chat screenshots feel indoor; proof here is field photos and stitched badges.
- before-after: gear either works or it doesn't — there is no transformation to stage.

9. HERO MENU

- The Depot Table: product photo on sand, price tag clipped top-right of the panel, patch badge lower-left, title + one claim line above, CTA below.
- The Pine Clearing: full-bleed dusk photo on a pine ground, lantern glow behind the product, sand content panel overlapping the photo's base with tag + CTA.
- The Load-Out: hero as a labeled flat-lay — the kit photographed from above, 3 carabiner tags annotating pieces, price and CTA beneath. For multi-piece kits.
- The Claim Patch: a giant canvas patch carries the promise ("14H DE LUMIÈRE"), product photo beside/beneath it, tag price, CTA; for gear with one killer spec.
- The Strap Split: photo left / content right split (stacks on mobile), webbing strap running the seam, tag price on the strap; desktop-forward composition.
- The Night Test: pine ground, the product photographed lit at night as proof, one stat in ember, tag price, CTA; for lights and power gear.

10. FORM MENU

- The Registration Card (single card): one rip-stop panel, webbing header "BON DE COMMANDE" with a carabiner, stacked fields (nom, téléphone, wilaya/région, commune), ember CTA; COD reassurance stitched beneath.
- The Two-Checkpoint (2-step): checkpoint 1 — pack choice (SOLO/DUO) + variant; checkpoint 2 — coordinates; progress as two buckle icons closing.
- The Basecamp Echo (hero-echo): a compact phone+wilaya strip clipped under the hero ("On confirme par appel"), repeated as the full Registration Card at the end.
- The Strap Bar (sticky-driven): the sticky strap-bar is the sole CTA; tapping scrolls to the form and focuses the name field.

11. MOTION IDENTITY

Packed & clipped. Entrances drop 20px in 0.35s (power3.out) with a 2-3px settle — gear placed on the table, strap tightened. THE signature, once per page: carabiner tags clip on as their section enters — a small rotate from -8° to 0° with a 1-frame gate-close feel (0.3s). Patches and panels fade-drop without rotation. The lantern glow (if present) breathes in a slow 4s loop at ±4% opacity — the only loop allowed. Reduced motion: everything static, tags pre-clipped, glow steady. Banned: parallax, scroll scrubs, bouncing, spins, and any easing tail longer than 0.35s.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics banned by name: atlas's dotted travel routes, passport stamps, topographic contours and compass roses (the FULL mapping language is dead here); chantier's steel plates with corner bolts, hazard stripes and stencil spray; impact's lime duotone grain, workout-set labels and plate-stack markers; turbo's carbon-twill panels, gauge meters and rocker switches; caravane's kilim bands and saddle-stitch cards (Bivouac stitches are webbing and merrowed patch edges, never leather saddle rows); herbier's tied specimen tags (tags here CLIP with carabiners, never tie with string).
Bivouac's own temptations, banned: fake summit romance (no Everest talk for a picnic lamp), ember floods, more than three patches, decorative knots, camo patterns, and any map-shaped ornament.
Refused blocks restated: lottery-contest, whatsapp-proof, before-after.

13. EXAMPLE VARIATIONS

- "Lampe Bivouac" — electronics & gadgets. The Night Test hero; order: announcement, hero, stats pine band, benefits panels, how-it-works straps, spec-table, photo-reviews, guarantee patch, bundle DUO CAMP, price-anchor, cross-sell mousqueton, Registration Card form, faq, footer. Signature: tags clip on; lantern glow loop. Mood: dusk competence.
- "Glacière 25L Routarde" — home & kitchen / car accessories. The Depot Table hero; order: announcement, hero, benefits, spec-table (72h de froid), video-testimonial, reviews, price-anchor with per-trip math, stock tag, Two-Checkpoint form, order-steps, footer. Mood: road-trip ready.
- "Kit Rando Atlas" — fitness equipment. The Load-Out hero (3 tags annotating bâtons/sac/gourde); order: announcement, hero, how-it-works, benefits, reviews, guarantee patch, bundle packs, price-anchor, Basecamp Echo + full form, faq, footer. Mood: checklist calm.
- "Hamac Forêt" — home & kitchen. The Pine Clearing hero; order: announcement, hero, benefits, spec-table (200kg testés), photo-reviews, stats band, price-anchor, cross-sell sangle, Registration Card, order-steps, footer. Mood: sieste méritée.
- "Batterie Solaire 20K" — electronics & gadgets / car accessories. The Claim Patch hero ("20 000 mAh AU SOLEIL"); order: announcement, hero, spec-table, how-it-works, stats, reviews, guarantee, price-anchor, Strap Bar form flow, faq, footer. Mood: energy independence.
- "Tente 4 Saisons عائلية" — fitness equipment, RTL build. The Strap Split hero mirrored; order: announcement, hero, benefits, spec-table, reviews, video-testimonial, guarantee patch, bundle, price-anchor, Registration Card RTL, faq, footer. Mood: family basecamp.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
