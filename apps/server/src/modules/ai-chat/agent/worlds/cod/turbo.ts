import type { DesignWorld } from "../types";

export const turbo: DesignWorld = {
	id: "turbo",
	name: "Turbo",
	family: "motor-garage",
	tagline: "Pit-lane torque: carbon, gauges and the red line",
	kind: "cod",
	mood: ["mechanical", "torqued", "nocturnal"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["car accessories", "electronics & gadgets"],
	avoidFor: ["beauty & cosmetics", "kids & baby", "jewelry & watches"],
	fusesWith: ["manette", "bivouac"],
	preview: {
		ground: "#101114",
		ink: "#EEF0F3",
		accent: "#E11D2E",
		fontFamily: "Saira Condensed",
		sampleWord: "REDLINE",
	},
	doc: `
=== TURBO — WORLD DOC (kind: cod-page) ===

1. PHILOSOPHY

Turbo is the pit-lane workbench at two in the morning. Carbon on the walls, one red work light, tools that have real weight, and a mechanic who answers every question with a number. This world sells the driver's kit — boosters, dash cams, inflators, scanners — to people who trust torque, not adjectives. Its persuasion instrument is the GAUGE: every claim that can be measured is shown as a needle sweeping to its value. Amps, hours, bars, days of stock — if it matters, it has a dial.

Turbo never sees daylight. The page is a night garage: carbon darks, steel structure, and one hue of authority — the red line. Red is not decoration here; it is the threshold marker, the pinstripe, the needle, the moment the engine catches. Voice is the mechanic's voice: short declaratives, numbers first, zero flattery, one dry joke allowed per page at most. Where Manette plays and Circuit lectures, Turbo TORQUES: it demonstrates force, then hands you the form like a work order.

Self-audit checklist — answer before shipping:
- Does the first viewport state what it is, its headline number, its price and its CTA — with one gauge already alive?
- Is every measurable claim rendered as a gauge or a mono value — no vague adjectives standing alone?
- Are all three tics working: gauges sweeping, carbon-twill panels with the red pinstripe, rocker switches for options?
- Is red under 10% of any viewport, amber under 5% and only inside gauges?
- Are there ZERO light sections — no white, no daylight anywhere?
- Do needles sweep power4.out with no overshoot, and does exactly one hero gauge rev on load?
- Would a stranger sort this page from Manette's RGB arena and Circuit's white lab in two seconds?
- Zero horizontal overflow at 390 / 768 / 1440?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, non-negotiable:
- The selling spine: hook then convince then offer then order form, invisible to the buyer.
- Palette registers: carbon grounds #101114 to #16181D; ink #EEF0F3; red-line #E11D2E to #FF2A3C; steel #3A3F47 for structure; amber #FFB020 inside gauges only, under 5%. No light sections, ever.
- Type stacks: Latin display Saira Condensed (700/800) or Oswald; body Inter or Barlow; mono IBM Plex Mono for digits and units. Arabic display Changa (700); body Almarai.
- The three owned tics: gauge meters, carbon-twill panels, rocker-switch selectors.
- Motion identity "rev & settle": needle sweeps power4.out, 0.35s x-slide entrances, no overshoot.
- Desktop law: responsive expansion, max 1100px.
- Refused blocks: lottery-contest, size-guide, before-after.
- Imagery style: night-garage photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client, never copied from a previous build:
- Hero composition (from the hero menu, or a justified new one in-world).
- Block choice within the supported set, and BLOCK ORDER — rebuilt around this product's proof logic.
- Form style (from the form menu).
- Which claims become gauges (pick the 3–5 that matter for THIS product) and the hero's headline number.
- Accent position within the red register and whether amber appears at all.
- Section density: a lean 9-block job or a 15-block full service.
Every client gets a new sibling of this world — same blood, different body. A clone is a failed build.

3. VISUAL SIGNATURES — measured values

- Grounds: #101114 primary, #16181D raised sections, #1B1E24 cards. Steel #3A3F47 for rules, borders, inactive states.
- Ink: #EEF0F3 headlines and values; #9AA1AB secondary lines (60% cap of text).
- Gauge meters (tic): circular dials 96–140px — a 270° tick ring (28–40 ticks, 1.5px, steel; every 5th tick 2.5px ink), a needle (2px, #E11D2E, center cap 8px steel) sweeping from -135° to its value, the value itself in IBM Plex Mono 700 centered beneath with its unit in 0.7rem caps, and the top 15% of the ring hatched red — the red line zone. Amber #FFB020 may tint the 70–85% zone. Gauges carry stats, stock, savings, capacity.
- Carbon-twill panels (tic): cards with a woven carbon texture (repeating 45° twill via layered linear-gradients, 6–8px weave pitch, #14161A on #101114 — visible but quiet), edged by ONE red pinstripe: 3px solid #E11D2E along the inline-start edge only. Radius 6px. No other edge decoration.
- Rocker-switch selectors (tic): options as chunky skeuomorphic rockers — 64×36px tracks, steel body #3A3F47 with a 1px #52585F rim, the toggle a 30px squared cap that physically tips (rotateX feel via translate + shadow); armed state: cap tips forward, track floods #E11D2E, a mono "ON" appears; off state shows "OFF" in muted ink. Used for cross-sell arming and option choices.
- Display type: clamp(2.2rem, 9vw, 3.3rem) mobile hero, condensed caps, line-height 0.95; section heads clamp(1.5rem, 6vw, 2.1rem).
- Body: clamp(0.95rem, 4vw, 1.05rem), line-height 1.55; mono values 1.1–1.4rem with units at 0.7rem caps.
- Radii: 6px cards, 4px fields, 999px only on the sticky bar's CTA.
- Borders: 1px #2A2E35 on cards beneath the twill; focus rings red.
- Shadows: none but depth — panels darken toward their base (inset gradient); the only glow allowed is a 12px red halo on an armed rocker and on the red-line zone of a maxed gauge.
- Spacing rhythm: section padding-block clamp(56px, 14vw, 88px); gauge clusters gap 20px.

4. COLOR PHYSICS

- Ground register: #101114→#16181D. Sections alternate inside this register; the shift is felt, not seen. No light sections — Turbo never sees daylight.
- Ink register: #EEF0F3→#9AA1AB. Headline numbers always full ink.
- Red-line register: #E11D2E→#FF2A3C. Hard cap 10% of any viewport. Red belongs to: needles, pinstripes, the red-line zone, armed rockers, the CTA, struck old prices. Red is never a text color for sentences.
- Amber #FFB020: gauge warning zones only, under 5%. Never a text color, never a chip.
- Steel #3A3F47: unlimited structural use — rules, tick rings, switch bodies, inactive states.
- Forbidden: any blue or cyan (that is Manette's and Circuit's territory), white or light-gray grounds, gradients between hues, chrome/metal text, RGB rainbows, yellow hazard pairings, and pure #000000 (carbon always keeps a blue-black undertone at #101114).

5. TYPOGRAPHY

Latin stack:
- Display: Saira Condensed (700/800) first; Oswald (600/700) alternate. One per build.
- Body: Inter (400/600) or Barlow (400/500).
- Mono: IBM Plex Mono (500/700) for every digit that measures something — gauge values, specs, prices may take display OR mono but the choice is consistent page-wide.
Arabic stack:
- Display: Changa (700) — condensed energy that matches Saira.
- Body: Almarai (400/700).
- Pairing rule: Changa with Almarai; keep IBM Plex Mono for digits and units (Western Arabic numerals).
Size clamps shared across scripts; Arabic display caps at 3.0rem where Latin reaches 3.3rem. Weight rules: display never below 600; units always 0.7rem caps with 0.08em tracking (Latin/digits only).
RTL mirroring (Arabic builds): logical properties throughout; the carbon panel's red pinstripe sits on the inline-start edge; gauges keep their -135°→+135° sweep direction (physics does not mirror) but value/unit blocks align inline-start; x-motion flips sign; NEVER letter-spacing on Arabic; Arabic body line-height 1.7–1.9; prices as unbreakable LTR units.

6. SIGNATURE ART & COMPONENTS

- The gauge cluster is the world's centerpiece: 2–3 gauges in a row on a carbon panel, needles sweeping in a 0.12s stagger when the cluster enters view. The HERO gauge is larger (140px) and revs once on load — the page's opening growl.
- Carbon-twill panels carry everything card-shaped: benefits, reviews, offer. The red pinstripe always on the inline-start edge — one stripe, one direction, page-wide.
- Rocker switches arm decisions: cross-sell, option A/B, bundle upgrade. Flipping one updates the order summary total in mono immediately.
- Supporting cast: the work-order card (form dressed as fiche d'intervention: a steel header strip with a mono reference number, stacked fields below); mono spec rows (label left, value+unit right, hairline steel rules); the red-line CTA (full-width, #E11D2E, condensed caps label, darkens to #B5121F pressed); tick-ring dividers (a short horizontal run of gauge ticks marking section changes); struck prices (old price in mono struck by a single 2px red line, never doodled).
- Forms: fields 56px, ground #1B1E24, 1px #2A2E35 borders, red focus ring, labels above in caps; errors in red with a mono code style ("ERR: رقم غير صالح" / "ERR: numéro invalide"); success state = the work-order card stamps "COMMANDE REÇUE" in a red outlined mono chip + order number + call-to-confirm line.
- Imagery: rugged automotive garage photography — matte black workbench surfaces, carbon-fiber textures, deep red accent lighting, chrome tool bokeh, dramatic low-key light, engine-bay atmosphere. The product sits on the bench or in the bay, lit by one red-tinted key light; macros show clamps, ports, textures; gloved hands allowed, faces never. Banned in photos: daylight, showroom white, blue neon, lifestyle smiles. One build = one night in one garage — every asset shares the same darkness and the same red.

7. THE SPINE

Hook then convince then offer then order form — invisible to the buyer, law to the builder. Turbo is price-early with a number-first hook: the hero states the headline figure (2000 A, 4K, 150 PSI), the price sits directly beneath it in mono or display, and the CTA follows inside the first viewport. The sticky CTA is the red-line bottom bar: 60px, carbon ground with a 2px red top edge, price at the inline-start, a red CTA block at the inline-end; it appears after the hero and always smooth-scrolls to the work-order form. Mobile is designed at 390px. Desktop law: responsive expansion — the page widens to max 1100px, gauge clusters go three-across, the hero splits photo/copy; it must feel like the same garage with more bench space, never a different room.

8. BLOCKS TREATMENT

Supported blocks, dressed by Turbo:
- announcement-bar: one carbon strip, mono text, one red tick ("COD · 58 wilayas · 24–72 h"). Static, no rotation.
- stats-band: the gauge cluster — 2–3 dials whose needles sweep on entry; values in mono, units in caps. The world's proudest block.
- benefits-icons: carbon-twill cards, 2×2 on mobile, line-icon + three-word label; no more than one card mentions the red line.
- how-it-works-steps: "3 gestes" — numbered steps on one carbon panel, numbers in display face, a thin steel line linking them; each step ends with a time or a number ("60 secondes", "1 bouton").
- spec-table: mono rows on hairline steel rules — label, value, unit; groups separated by a tick-ring divider. Turbo's spec table is dense and proud (this is NOT circuit's airy datasheet strip — no leader lines, no blue).
- photo-reviews: twill cards with the pinstripe, name + quartier + stars, quotes that talk work ("36 dépannages avec, jamais lâché"); one customer photo allowed in a plain 6px-radius frame.
- comparison-table: the workshop verdict — three mono columns (TURBO / câbles / remorquage) with check-cross marks in red/steel; max 5 rows, every row a measurable fact.
- guarantee-seal: a twill card with a large mono "12" (months) inside a tick ring, two short lines; pay-at-door restated beneath.
- stock-urgency: stock as a GAUGE — the needle sits at what remains, red-line zone = almost gone; caption in mono ("Reste 23 / 150"). Honest values only.
- cross-sell: the rocker moment — companion product on a twill card, its price in mono, armed by flipping the switch; the order total updates instantly.
- price-anchor: old price struck by one straight red line, new price huge, per-use math in mono ("11 900 DA · 4 ans de dépannages"); one gauge may show the savings percent.
- unboxing-gallery: "dans la caisse" — contents as a mono checklist beside the kit photo, count badge in a tick ring.
- order-steps: 4 steps in mono with red tick marks: formulaire, appel de confirmation, livraison 24–72 h, paiement à la porte.
- faq: carbon accordion, steel hairlines, red plus glyphs; answers keep numbers first.
- trust-footer: carbon, brand line, phone + WhatsApp as steel pills with red icons, policies muted.

Refused blocks:
- lottery-contest: a garage does not raffle; prizes undermine the mechanic's word.
- size-guide: nothing here has a fit — measurement lives in the spec table.
- before-after: torque is proven by gauges and demonstrations, not by paired photos; transformation theater belongs to other worlds.

9. HERO MENU

- Pit Board Split (default): photo of the product on the bench beside (stacked at 390: above) the name, headline number, price and CTA — with the hero gauge revving beside the number.
- Gauge-First Stack: the 140px hero gauge IS the opening image — it revs to the headline figure, product photo follows, then price and CTA. For products whose number is the story.
- Workbench Offer Card: the entire hero as one twill card with the pinstripe — photo, promise, price, CTA, one small gauge in the corner. Reads as a work order handed to you.
- Ignition Story Hook: full-bleed engine-bay photo, one mechanic's line ("Une panne n'attend pas le dépanneur."), then product, number, price, CTA rise from below.
- Torque Demo Hero: ONE muted loop (≤2 MB, poster fallback) of the product working, framed in carbon with the pinstripe; number, price, CTA beneath. For gear that sells by motion.
- Kit-Grid Hero: the full kit laid out top-down as the hero image, each piece tagged by a mono number that keys to a list beneath; price and CTA close the viewport. For multi-piece sets.

10. FORM MENU

- Fiche d'Intervention (default): one work-order card — steel header with mono reference ("BON Nº TS-2481"), stacked 56px fields, red-line CTA, COD reassurance in mono beneath.
- Two-Stage Ignition: stage 1 arms the options (rockers: bundle, cross-sell), stage 2 takes name + phone + wilaya; progress shown as two gauge dots filling. For builds with options that matter.
- Bar-Driven: the red-line bottom bar is the only CTA until the form; tapping opens the work-order card with the first field focused. For lean jobs.
- Echo Compact: a two-field quick order (phone + wilaya) right under the hero for the stranded-in-a-parking-lot buyer, repeated full-size at the end. Turbo's most honest form: emergencies are its market.

11. MOTION IDENTITY

Rev and settle. Entrances: x:±24 slides (direction-aware, sign flips in RTL), power4.out, 0.35s, staggered 0.08s. The signature moment — once per page: the HERO gauge revs from zero to its value on load (needle sweep 0.9s power4.out, mono value counting in sync). Other gauges sweep when their cluster enters view, staggered 0.12s, never re-triggering. Rocker switches tip in 0.15s with a single mechanical settle (no bounce). Struck prices draw their red line 0.3s on entry. NOTHING overshoots — needles stop dead at their value; no elastic, no back.out, no wobble. No loops except a 2s subtle pulse on the red-line zone of a maxed stock gauge. All motion gated on gsap + ScrollTrigger + no prefers-reduced-motion; reduced-motion shows needles parked at their values, page fully readable.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: chantier's steel plates with corner bolts, hazard stripes and stencil-spray caps; huitbit's game-HUD furniture (no score counters, no health bars, no PRESS START); manette's RGB conic sweep, chamfer panels and loadout chips; circuit's feature leader lines, PCB trace dividers and datasheet strip; trottoir's chevron rails and courier-label furniture; observatoire's orbital diagrams; impact's plate-stack markers and workout-set labels; caravane's saddle stitches and rivets. Turbo's own temptations, also banned: blue "tech" accents, chrome text, flame/speed-line clichés, a second accent hue, gauges for unmeasurable claims (trust is not a dial), skeuomorphic leather or wood, and daylight photography. Refused blocks: lottery-contest, size-guide, before-after.

13. EXAMPLE VARIATIONS

- "Dépanneuse" — car accessories, a 2000 A jump starter. Pit Board Split hero; stats-band (three gauges), benefits-icons, how-it-works-steps, spec-table, photo-reviews, comparison-table, guarantee-seal, cross-sell (compressor on a rocker), price-anchor, order-steps, faq, trust-footer; Fiche d'Intervention form. Mood: 2 a.m. rescue. Emphasis: the hero gauge revs to 2000 A — the loudest needle in the range.
- "Œil de Nuit" — electronics & gadgets, a 4K dash cam. Torque Demo hero (night-road loop); benefits-icons, spec-table, photo-reviews, stats-band (two gauges: heures d'autonomie, jours de boucle), stock-urgency gauge, price-anchor, faq, trust-footer; Bar-Driven form. Mood: silent witness. Emphasis: gauges stay small; the loop carries the proof.
- "150 PSI" — car accessories, a cordless tire inflator. Gauge-First Stack hero (needle to 150 PSI); how-it-works-steps, benefits-icons, photo-reviews, comparison-table (vs station, vs pied), guarantee-seal, price-anchor, order-steps, trust-footer; Echo Compact form. Mood: parking-lot emergency. Emphasis: the echo form near the hero — this buyer is stranded NOW.
- "Diagnostic" — electronics & gadgets, an OBD2 scanner. Workbench Offer Card hero; spec-table, how-it-works-steps, photo-reviews (mécanos), stats-band, unboxing-gallery, price-anchor, faq, trust-footer; Two-Stage Ignition form (stage 1 arms the pro-cable option). Mood: the mechanic's secret. Emphasis: mono everywhere — the wordiest mono build in the range.
- "Convoi" — car accessories, a roof cargo bag set. Kit-Grid hero; benefits-icons, spec-table (volumes, sangles), photo-reviews, guarantee-seal, cross-sell (sangles extra via rocker), price-anchor, order-steps, faq, trust-footer; Fiche d'Intervention reached bar-first. Mood: road-trip loadout. Emphasis: the kit grid does the desire work; only two gauges on the page.
- "Nuit Blanche" — electronics & gadgets, a rechargeable work light. Ignition Story Hook hero; stats-band (lumens gauge, autonomie gauge), benefits-icons, photo-reviews, stock-urgency gauge, bundle duo via rocker, price-anchor, faq, trust-footer; Two-Stage Ignition form. Mood: the bay at midnight. Emphasis: light itself photographed as the subject — the red garage cut by one white beam.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
