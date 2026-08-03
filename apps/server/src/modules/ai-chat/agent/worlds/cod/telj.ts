import type { DesignWorld } from "../types";

export const telj: DesignWorld = {
	id: "telj",
	name: "Telj",
	family: "frost-cool",
	tagline: "Ten degrees colder: frost corners and ice-blue relief",
	kind: "cod",
	mood: ["cold", "crisp", "relieving"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["electronics & gadgets", "home & kitchen", "car accessories"],
	avoidFor: ["beauty & cosmetics", "jewelry & watches", "fashion & apparel"],
	fusesWith: ["expo", "circuit"],
	preview: {
		ground: "#F2F8FB",
		ink: "#123240",
		accent: "#2E9BC6",
		fontFamily: "Chakra Petch",
		sampleWord: "تلج",
	},
	doc: `
TELJ — THE WORLD DOC (kind: cod-page)

1. PHILOSOPHY

Telj means snow, and this world has one job: make a buyer sweating through an Algiers canicule
FEEL ten degrees colder before they reach the order form. It sells the machinery of relief —
portable coolers, fans, climatiseurs, car vents, anything that turns July down. The page
itself is the product demo: glacial whites, ice-panel blues, frost blooming in the corners,
imagery that arrives fogged like a freezer door just opened and clears to crisp. Heat is the
villain and it is never shown; Telj wins by contrast — the page is the cold room the buyer
steps into.

The voice is crisp and factual, short sentences with the confidence of a thermostat: numbers
first (لترات، سرعات، ساعات), promises measured, no bazaar sweat. But Telj is not a laboratory —
it is RELIEF, and relief has feeling: the copy lets the buyer taste the first cold minute
("من 38 إلى 24 في ربع ساعة"). The selling spine — hook, convince, offer, order form — runs
like a cooling cycle: shock of cold at the hero, the physics in the middle, the offer as the
room settling, the form as the thermostat set and forgotten.

Self-audit checklist — answer YES to ship:
- Does the first viewport feel physically colder — glacial ground, frost corner, fogged image
  clearing?
- Is the price plainly stated in the first viewport with the CTA beside it?
- Do frost crystals grow ONLY from panel corners, never as full-frame snowflake wallpaper?
- Has the fog-clear wipe fired exactly once, on the hero, and nowhere else?
- Do icicle fringes edge at most three key panels, teeth irregular, translucency visible?
- Are the cooling numbers (لتر، سرعة، م²، ساعة) carrying the argument in every convince block?
- Fully readable with JavaScript off, zero overflow at 390 / 768 / 1440?
- Could a stranger sort this from the sea world and the white-lab world in two seconds?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The selling spine: hook, then convince, then offer, then order form. Invisible, inviolable.
- Palette registers: glacial ground #F2F8FB, ice panels #DCEEF7, ink #123240, ice blue
  #2E9BC6, deep cold #0F5E7E, frost-white overlays.
- Type stacks: Latin display Archivo 800 (tight) or Chakra Petch 600, body Inter; Arabic
  display Cairo, body Almarai.
- The three owned tics: frost-crystal corners, fog-clear wipe, icicle fringes.
- Motion identity: cold snap — 0.3s crisp slides; ONE fog-clear on the hero.
- Desktop law: responsive expansion, max 1080px.
- Refused blocks: lottery-contest, whatsapp-proof, press-badges.
- Imagery style: cool-tech photography with real frost and condensation (spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu, or invented inside the cold.
- Block choice within the supported set and BLOCK ORDER — a room cooler and a car fan cool
  different pains.
- Form style from the form menu.
- Proof lead: stats-band, photo-reviews, or the comparison against costlier cold.
- Which panels earn icicle fringes (one to three), and where the deep-cold band falls.
- Density: a quick 8-block chill or a full 13-block heatwave survival plan.
Every client receives a new sibling — same cold, different summer. Repeating a previous
hero + block order + form combination fails the contract.

3. VISUAL SIGNATURES — measured

- Grounds: glacial #F2F8FB base; ice panels #DCEEF7 for cards and alternate sections; ONE
  deep-cold band #0F5E7E per page (the offer or the stats moment) with frost-white text.
- Ink: #123240 headings, #35566B body, #6E8A9A captions; on deep cold, #F2F8FB headings and
  #BFDCEA body. Pure black is banned — cold is blue, not black.
- Ice blue #2E9BC6: prices, CTAs, active states, crystal strokes. Hover deepens to #2384AB.
- Display type: hero clamp(1.85rem, 7.2vw, 2.8rem), line-height 1.12 Latin / 1.32 Arabic;
  section titles clamp(1.4rem, 5.2vw, 1.95rem); body clamp(0.97rem, 4vw, 1.05rem) line-height
  1.6 / 1.8; numeric spec moments clamp(1.4rem, 6vw, 2.1rem) in the display face, tabular.
- Radii: 8px on cards and fields — machined, not pillowy; chips 999px; the sticky bar squared
  at 8px.
- Borders: 1px solid rgba(18,50,64,0.14); ice panels may add an inner 1px frost keyline
  rgba(255,255,255,0.6). Shadows: none — cold air is clear; separation is tonal.
- Spacing: sections 56 to 76px vertical on mobile; the deep-cold band runs tighter, 44 to 60px.

The tics, precisely:
- FROST-CRYSTAL CORNERS: dendritic ice growth drawn as SVG — a main branch 60 to 110px with
  4 to 7 side needles at 55 to 65 degrees, stroke 1.5px, color #2E9BC6 at 30 to 45% opacity
  with white highlights at 20%. Anchored INTO two opposite corners of key panels (start-top
  and end-bottom), growing inward, cropped by the panel edge. Maximum four crystal corners
  per viewport; never on body-text paragraphs, never as free-floating snowflakes.
- FOG-CLEAR WIPE: the hero image begins under a frost-white overlay (rgba(242,248,251,0.92))
  with 8px blur, and clears ONCE — a 0.9s wipe from the start edge, like breath fading off a
  freezer door — leaving the product crisp. This is the page's only reveal of its kind; all
  other imagery loads clear. Under reduced motion the image is simply crisp.
- ICICLE FRINGES: a row of translucent icicle teeth hanging from a panel's bottom edge —
  irregular triangles 10 to 26px long, widths 8 to 16px, fill rgba(220,238,247,0.85) with a
  1px #2E9BC6 edge and one white glint per third tooth. One to three fringed panels per page,
  reserved for the coldest claims (the offer, the deep-cold stats band).

4. COLOR PHYSICS

Ground register: #F2F8FB to #E8F2F8; ice panels #DCEEF7 to #D2E8F3. The page is 80% light —
cold is bright. ONE deep-cold band #0F5E7E per page maximum; a second turns relief into night.
Ink register: #123240 to #6E8A9A, a blue-slate scale; warm grays are banned.
Accent physics: ice blue #2E9BC6 owns money and action — prices, CTAs, selected states — plus
the crystal strokes. Cap 12% of any viewport. Deep cold #0F5E7E is a ground, never a text
accent on light.
Support: frost white overlays and keylines are free but must stay translucent — solid white
boxes are banned. Forbidden: warm anything (coral, amber, wood), bazaar yellow-red, purple,
green (this is ice, not menthol), black grounds, and chrome metallics.

5. TYPOGRAPHY

Latin stack: display Archivo 800 set tight (letter-spacing -0.01em) for the engineered build,
or Chakra Petch 600 when the client's product is gadget-flavored; body Inter 400/600. Pairing
rule: one display + Inter; the display face also sets all spec numerals, tabular.
Arabic stack: display Cairo 700/800 — its cool geometry matches Archivo; body Almarai 400/700.
Shared clamps as above; Arabic display at 92% of the Latin ceiling, line-height 1.32 minimum;
Arabic body 1.75 to 1.9. NEVER letter-spacing on Arabic (Latin caps labels may take 0.06em).
Digits: Western Arabic numerals in both scripts for litres, speeds, hours, prices; phone
numbers in an LTR span. RTL: logical properties everywhere; frost corners mirror (start-top
becomes the right-top), the fog wipe clears from the start edge, icicle rows are symmetric,
x-slides reverse.

6. SIGNATURE ART AND COMPONENTS

The tics are the climate. Frost corners certify a panel as COLD — the offer card, the tank
photo, the stats band grow crystals where they touch the frame, as if the page's own
temperature is doing it. The fog-clear is the handshake: one breath, wiped, and the product
stands in crisp air. Icicles mark the coldest shelf — the buyer learns to read them as
"maximum chill here".

Supporting cast: ice-panel cards with the frost keyline; spec chips (a number + unit in an
ice pill); temperature-delta chips ("38° → 24°") with the arrow in ice blue; a droplet-free
condensation hint allowed ONLY inside photography, never as UI texture; the sticky bar as a
glacial band with an ice-blue squared button. Iconography in 2px strokes: fan blades, tank,
plug, snow asterisk used sparingly as a bullet (max size 12px, never decorative wallpaper).

Imagery: cool-tech product photography in a glacial white studio. Real ice cubes, visible
frost on surfaces, condensation droplets ON THE PRODUCT, blue cold-light accents from one
side, crisp clean styling with hard focus. Mist appears as a directional stream from the
product's vent — never ambient fog. Hands allowed, no faces. Banned in photos: beach or sea
context (that is another world's water), warm kitchen wood, sunset light, people fanning
themselves theatrically.

7. THE SPINE

Hook, convince, offer, order form — the cooling cycle, in order, invisible. Price appears in
the HERO in ice blue beside the CTA — relief buyers compare prices against electricity bills
and rival clims, so the number leads. The sticky CTA is a glacial band, bottom-fixed, price
always visible, squared ice-blue button; tapping snaps the page down to the form. Mobile-first
at 390px. Desktop law: responsive expansion to max 1080px — the hero splits image-beside-
stack, spec rows go two-column, frost corners scale with their panels.

8. BLOCKS TREATMENT

Supported blocks, dressed by Telj:
- announcement-bar: one glacial line — delivery promise, COD, "التوصيل قبل نهاية الأسبوع
  الحار" when true; a snow asterisk as separator.
- problem-solution: the heat named in numbers (38°، ليل بلا نوم) on glacial ground, answered
  by the product on an ice panel with its first frost corner; two beats, no melodrama.
- benefits-icons: 4 to 6 ice chips with 2px glyphs — قوة، هدوء، خزان، حمل — one line each.
- spec-table: allowed and encouraged — rows on an ice panel with display-face values, tabular,
  units always (لتر، م²، ديسيبل، واط); the panel earns a frost corner.
- stats-band: the deep-cold band — three or four frost-white numerals (سرعات، ساعات، لتر)
  counting once; icicle fringe beneath if this is the page's coldest claim.
- how-it-works-steps: 3 steps (املأ، شغّل، ابرد) with snow-asterisk markers and a temperature-
  delta chip on the last step.
- comparison-table: vs الشراء الأكبر (سبليت) and vs الصيف بلا شيء — rows of cost, install,
  mobility with check and cross in ice blue and slate; the honest math of relief.
- photo-reviews: ice cards, reviewer name and wilaya, the temperature drop they report quoted
  in the display face; one or two photos of the unit at home.
- variant-gallery: sizes or tank capacities as ice cards with spec chips; selected card gains
  the frost corner.
- bundle-offers: unit vs unit + قوالب ثلج إضافية; the bundle wears the icicle fringe; feeds
  the form.
- cross-sell: ice-pack blocks or a car adapter as a checkbox card with ice-blue price.
- price-anchor: old price struck in slate, new price large in ice blue, the electricity-bill
  math beside it ("أقل من 9 دج للساعة"); sits on the fringed offer panel.
- guarantee-seal: an ice roundel with a snow asterisk center — ضمان المحرك 12 شهر, exchange
  window, pay-at-the-door restated.
- order-steps: 4 steps to the door with snow-asterisk markers; the confirmation call promised
  plainly.
- faq: glacial rows, ice chevrons; consumption, noise, water-fill and return questions
  mandatory.
- trust-footer: deep-cold ground, frost-white text, phone and WhatsApp large, one final icicle
  fringe closing the page.

Refused blocks:
- lottery-contest: relief is not a raffle; heat-struck buyers need certainty, not tickets.
- whatsapp-proof: chat theater warms the page with noise; Telj proves with degrees and photos.
- press-badges: borrowed logos add heat, not cold; the spec table is the authority.

9. HERO MENU

- Porte du Congélateur (full-bleed): the product full-width under the fog, price and CTA on a
  glacial panel at the lower third; the fog-clear IS the reveal.
- Choc Thermique (split): image left (fogged, clearing), stack right — kicker with the
  temperature delta, title, two spec chips, price, CTA; stacks at 390px.
- La Fiche Froide (offer-card): the hero is one ice panel with frost corners — product, promise,
  spec row, price, CTA inside; glacial all around.
- Nuit à 24° (story-hook): kicker names the sleepless night, title answers with the number,
  fogged image beneath clearing to the unit by the bed.
- Ligne de Gel (price-first): the price enormous in ice blue, icicle fringe under it, product
  beneath; for aggressive-offer builds.
- Plein Été (stats-first): the deep-cold stats band opens the page under a minimal title; for
  spec-led gadgets.

10. FORM MENU

- Fiche Thermostat (single card): one ice panel — name, phone, wilaya select, capacity row,
  ice-blue submit; COD reassurance beneath with a temperature-delta chip.
- Écho Rapide (hero-echo): two fields under the hero for the overheated-and-decided, repeated
  full-size at the end.
- Deux Cycles (2-step wizard): coordinates, then delivery and variant; progress as two snow
  asterisks filling.
- Barre Froide (sticky-driven): the glacial band is the only CTA until the form; tapping
  focuses the first field and the form's frost corner grows once.

11. MOTION IDENTITY

Cold snap: entrances slide 20 to 28px at 0.3s with a crisp ease-out and no tail — the click of
a thermostat. Staggers 70 to 100ms. The ONE signature scroll moment is the hero's fog-clear
wipe (0.9s, once); nothing else fogs, blurs or melts. Frost corners appear by simple fade at
their panel's entrance (0.25s). Counters rise once in the deep-cold band. Banned motion:
loops, pulsing, overshoot, parallax, snowfall particle systems, rotation. Under prefers-
reduced-motion: everything visible, image crisp, crystals present. All motion gated on gsap +
ScrollTrigger presence; content never hidden in CSS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-for-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot.
Neighbor tics, banned by name: fanous's tassel fringes (icicles are ice teeth, never textile);
circuit's PCB traces and feature leader lines; hammam's steam veils (Telj's fog is a ONE-TIME
wipe, never ambient softness); falak's crystal-facet frames and smoke threads; bahr's foam
crests and buoy markers (the warm-water sibling — hard wall); an2000's chrome; kenz's gold
dust.
Own temptations, also banned: snowflake wallpaper, penguin mascots, gradient "freshness"
swooshes, frozen-food-aisle price stickers, aurora effects, and fog used anywhere but the
single hero wipe.
Refused blocks restated: lottery-contest, whatsapp-proof, press-badges.

13. EXAMPLE VARIATIONS

- "مبرّد الصالون 6L" — home & kitchen. Porte du Congélateur hero; announcement-bar, problem-
  solution, spec-table, stats-band, photo-reviews, bundle-offers, price-anchor, guarantee-
  seal, order-steps, faq, trust-footer; Fiche Thermostat form. Mood: the living room wins
  July.
- "Clim Portable Studio" — electronics & gadgets. Choc Thermique split hero; benefits-icons,
  spec-table, comparison-table (vs split), photo-reviews, price-anchor, order-steps, faq,
  trust-footer; Deux Cycles wizard. Mood: cold without the installer.
- "Ventilateur Voiture 12V" — car accessories. Ligne de Gel price-first hero; benefits-icons,
  how-it-works-steps, spec-table, photo-reviews, cross-sell (adaptateur), guarantee-seal,
  order-steps, trust-footer; Écho Rapide form. Mood: the taxi's summer armistice.
- "Glacière Électrique 20L" — home & kitchen. La Fiche Froide offer-card hero; stats-band,
  benefits-icons, variant-gallery (capacités), photo-reviews, price-anchor, order-steps,
  delivery-note in faq, trust-footer; Barre Froide sticky-driven form. Mood: cold that
  travels.
- "Brumisateur Terrasse" — home & kitchen. Nuit à 24° story-hook hero; problem-solution,
  benefits-icons, spec-table, photo-reviews, bundle-offers, price-anchor, guarantee-seal,
  order-steps, faq, trust-footer; Fiche Thermostat form. Mood: the courtyard reclaimed.
- "Mini-Frigo Bureau" — electronics & gadgets. Plein Été stats-first hero; benefits-icons,
  spec-table, photo-reviews, cross-sell (blocs de glace), price-anchor, order-steps, faq,
  trust-footer; Écho Rapide form. Mood: six cans at 4 degrees, always.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
