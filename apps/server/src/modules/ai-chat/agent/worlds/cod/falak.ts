import type { DesignWorld } from "../types";

export const falak: DesignWorld = {
	id: "falak",
	name: "Falak",
	family: "mystic-night",
	tagline: "Celestial calm: moons, crystals and violet night",
	kind: "cod",
	mood: ["mystical", "nocturnal", "serene"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["jewelry & watches", "beauty & cosmetics", "health & wellness"],
	avoidFor: ["electronics & gadgets", "car accessories", "kids & baby"],
	fusesWith: ["kenz"],
	preview: {
		ground: "#17122B",
		ink: "#EDE9FA",
		accent: "#8E6CF0",
		fontFamily: "Marcellus",
		sampleWord: "فلك",
	},
	doc: `
FALAK — THE CELESTIAL COUNTER

1. PHILOSOPHY

Falak sells under a violet sky. It is the world of things bought for meaning as much as
matter — moonstone bracelets, sleep rituals, evening oils — presented with the hush of an
observatory and the intimacy of a bedside table. The page is night, but a NAMED night:
deep violet, not black; amethyst, not neon; silver hairlines, not chrome. Nothing here
glows electrically. Light arrives the way it does after midnight — as phases, facets and a
single thread of smoke rising from an incense stick someone lit an hour ago.

Falak persuades by slowing the buyer down. Long fades, generous emptiness, copy that
speaks in low tones: "حجر يهدّي البال، ويكمل معاك الليل." Claims stay poetic but honest —
this world never promises healing, it promises ritual. Where Kenz seals one treasure in a
vault of black and gold, Falak lays its objects under the open sky and lets the buyer feel
the orbit of a nightly habit forming. The moon strip says: this is a cycle you will keep.

Self-audit before shipping:
- Is the night violet (#17122B-#1F1840) — never black, never navy?
- Do moon-phase strips divide the page's chapters, and does exactly one fill stepwise?
- Is every key image or card held in a crystal-facet frame with hairline facets?
- Do smoke threads stay single 1-2px lines — never fog, never gradients of mist?
- Is amethyst the only saturated color, silver the only metal?
- Does the copy promise ritual and craft — never cures, never powers?
- Form fields 56px+, labeled, with a hushed success state?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — constant as an orbit.
- Palette registers: grounds #17122B to #1F1840; ink moonlight #EDE9FA; amethyst #8E6CF0;
  silver hairlines #B9B4CE; one deep-teal support #1E4B4B at 6% or less.
- Type stacks: Latin display Cormorant Garamond (500) or Marcellus, body Jost; Arabic
  display Amiri, body Noto Naskh Arabic.
- The three owned tics: moon-phase strips, crystal-facet frames, smoke threads.
- Motion identity "lunar drift": 1.2s sine fades; the one stepwise moon-fill signature.
- Desktop law: centered mobile shell ~460px on deep night.
- Refused blocks: comparison-table, spec-table, lottery-contest.
- Imagery: mystical night still-life photography (spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice and ORDER within the supported set — a bracelet's night differs from an
  oil's night.
- Form style from the form menu.
- Proof lead: photo-reviews or whatsapp-proof, chosen by audience.
- Facet-frame geometry (pentagon, hexagon or irregular gem) — one silhouette per build.
- Where the smoke threads rise; section density (a sparse 8 or a layered 12).
Every client receives a new night sky — same moon, different constellation of blocks. A
clone fails the contract.

3. VISUAL SIGNATURES

Measured values. Grounds: #17122B base, #1F1840 raised sections; cards #221A44 with 1px
#3A2F63 borders. Ink #EDE9FA; secondary 65%; captions 45%. Amethyst #8E6CF0 for CTAs,
accents, selected states (hover deepens to #7A58DB). Silver #B9B4CE strictly for 1px
hairlines, facet lines and small caps labels. Deep teal #1E4B4B only as tiny leaf/steam
notes, 6% cap.

Type: display clamp(28px, 8vw, 44px) Cormorant Garamond 500 or Marcellus 400, line-height
1.15; Arabic display Amiri at 96% clamp, line-height 1.4. Section titles clamp(20px,
5.5vw, 27px). Body Jost clamp(15px, 4vw, 16.5px) line-height 1.65; Arabic body Noto Naskh
1.85. Small-caps silver labels 11-12px, 0.16em tracking (Latin only). Prices in display
face, ink — amethyst is action, never money.

Shapes: facet frames are the geometry law — clip-path polygons of 6-9 sides with 1px
silver facet lines crossing the corners; standard cards keep 12px radius; buttons are
soft slabs 10px radius, amethyst fill, 54px min. Shadows: none; night has depth through
tone. Decorative silver dots (2px stars) rationed to 5 per viewport maximum — accents,
never constellation patterns, never connected.

The tics, precisely:
- MOON-PHASE STRIPS: section dividers as a centered row of 5-7 moon glyphs (new to full
  to new), 14-18px, silver strokes with the current phase filled ink-bright; ONE strip
  per page fills phase-by-phase when it enters (steps(5-7), once).
- CRYSTAL-FACET FRAMES: imagery and key cards cut into the build's gem silhouette with
  1px silver facet lines radiating from 2-3 corner points; the frame never rotates and
  never glows.
- SMOKE THREADS: single 1.5-2px silver-violet wavy paths rising vertically between or
  beside sections, drawn as strokes (SVG), connecting a section's end to the next
  section's title area; maximum two visible per viewport; they draw upward ONCE per
  page (the hero's thread) and otherwise stand still.

4. COLOR PHYSICS

Ground register: the two violets alternate as sky and horizon; a build may not introduce
a third ground. Ink register: moonlight three steps. Amethyst physics: it is the world's
single saturation — CTAs, links, the filled moon, facet-corner points; 10% viewport cap;
never a text block, never a ground. Silver is line, not surface: any silver area wider
than 2px fails. Teal is a scent: one pinch per page. Forbidden: black, navy blue, gold
(that is Kenz's metal), neon anything, gradients except the two-stop ground shift between
the violets, warm hues entirely.

5. TYPOGRAPHY

Latin stack: display Cormorant Garamond 500 — wide, luminous — or Marcellus for a more
lapidary voice; body Jost 300/400. Arabic stack: display Amiri 400/700 — its classical
naskh carries the mystic register without ornament; body Noto Naskh Arabic 400. Pairing:
one display per build; small-caps labels always Latin-tracked, Arabic labels sized up
instead (never letter-spaced).

Clamps shared (Arabic display 96%). Arabic body line-height 1.8-1.9. Digits: Western
Arabic numerals; prices grouped with thin spaces; phone LTR-wrapped. RTL: logical
properties; moon strips read right-to-left (new moon starts at the right); smoke threads
mirror to rise along the logical start edge; facet frames are symmetric and need no
mirroring.

6. SIGNATURE ART & COMPONENTS

Supporting cast: silver hairline rules (1px) under section titles; ritual-step numerals
in small facet frames; review cards as night cards with a 2px star glyph and the buyer's
city in small caps; the sticky CTA as a slim night bar — 1px silver top rule, price in
ink, amethyst button. The moon strip may double as a progress cue in multi-step forms
(phase fills per step).

Imagery: mystical night still-life photography — deep violet backdrop (matching #17122B
to #1F1840), objects lit by a cool moon-white key from high side, amethyst and clear
crystals as props, a SINGLE thin incense smoke line allowed in hero shots, silver trays
and dark velvet as surfaces, deep soft shadows. Hands only, no faces; skin rendered cool.
Every asset shares the violet backdrop so the page reads as one long exposure. Banned in
photos: candles-and-bokeh clichés, tarot cards, golden hour warmth, fog machines.

Component measurements, for builders: facet frames are built as clip-path polygons of 6-9
points with the two or three "cut origin" corners marked by 3px amethyst points; facet
lines (1px silver at 35% opacity) connect origin corners to 2-3 opposite vertices — never
a full web. Moon glyphs: 14-18px circles; waxing states drawn by an offset inner circle
mask; the filled phase uses ink #EDE9FA at full. Smoke threads: SVG paths 1.5-2px, 3-4
gentle bends over 240-400px height, stroke silver-violet #8E7BC9 at 55%; the drawn thread
uses strokeDashoffset for its single rise. The slim night bar: 60px, 1px silver top rule,
amethyst button 42px with 16px padding. Cards pad 20px; sections space clamp(64px, 16vw,
96px) — the night breathes wider than any other loud-market world. Focus rings: 2px
amethyst, offset 2, on every field and chip. The form success state: a night card with a
full-moon glyph (finally filled), order number in display face, and the line "نتصل بيكِ
بهدوء للتأكيد" — even confirmation whispers.

Copy register: Falak speaks in low light — short declaratives, sensory nouns, no
exclamation marks anywhere on the page. Claims name materials and rituals, never powers:
"حجر قمر حقيقي، يتلبس في الليل" passes; anything promising energy fields or healing fails
the build. Arabic is the world's first tongue — classical enough for dignity, soft enough
for a bedside; French builds keep the same hush ("Pierre de lune véritable. Portée la
nuit."). Prices are stated once per beat, never repeated in the same viewport; urgency
vocabulary (vite, الحقي, dernier) is banned outright — the night is patient, and the page
must be too.

7. THE SPINE

Hook, convince, offer, order form — the constant orbit. Price placement: Falak is a
premium quiet world — the price appears in the HERO, small-spoken under the title (ink,
clamp 22-30px), and again on the sticky bar; the price-anchor block restates it beside
the guarantee. Sticky CTA: the slim night bar described above. Mobile-first 390px.
Desktop law: centered mobile shell ~460px floating on the deep-night ground, a thin
silver hairline framing the shell 24px outside its edge.

8. BLOCKS TREATMENT

Supported blocks, dressed by Falak:
- announcement-bar: one whispered line on the deeper violet — "توصيل لكل الإمارات · الدفع
  عند الاستلام" — silver text, no icons.
- hero: facet-framed product image, title, one poetic line, small price, amethyst CTA;
  the hero smoke thread rises beside the frame.
- problem-solution: two night cards — the restless evening, then the ritual answer; a
  think-quiet tone, no drama.
- ingredients-infographic: for oils/rituals — the stones or essences listed with silver
  hairline leaders to a facet-framed detail image (component names + origin, no
  percentages theater).
- how-it-works-steps: the ritual in 3 steps, each numbered in a small facet frame with
  one sentence — "البسيها في الليل" energy.
- benefits-icons: 3-5 silver line glyphs (moon, stone, sleep) with two-word labels; no
  chips, glyphs float on night.
- photo-reviews: 3-4 night cards, name + city small caps, drawn silver stars, one
  facet-framed customer photo allowed.
- whatsapp-proof: a single recreated thread on a night card, bubbles in #221A44 and
  #2A2153 — for younger mystic audiences.
- stats-band: three modest counters in display face ("+4000 ليلة هادئة") — counts fade
  in, no rolling.
- variant-gallery: stone/scent variants as small facet-framed swatch images with names;
  selected facet's corner points turn amethyst; feeds the form.
- bundle-offers: solo / paire / rituel complet as three night cards, per-unit line,
  amethyst frame on the recommended; feeds the form.
- price-anchor: old price struck in caption silver, new price in ink display, one line of
  per-night math ("أقل من قهوة في الليلة"), COD line.
- guarantee-seal: a facet-framed seal — silver moon glyph, "تبديل خلال 7 أيام"، one
  honest sentence; never circular text.
- order-steps + order-form + faq + trust-footer: per form menu; FAQ rows separated by
  hairlines; footer with phone, drawn moon mark, coverage line.

Refused blocks:
- comparison-table: check-cross grids are daylight logic; Falak never argues against
  rivals.
- spec-table: dimensions belong to datasheet worlds; stones are told by origin, not
  millimeters.
- lottery-contest: prize wheels break the night's dignity.

9. HERO MENU

- The Night Altar: centered facet-framed product, title above, poetic line + price + CTA
  beneath, smoke thread rising on the start side. The default.
- Crescent Split: image frame offset to one side, text column beside it (stacks on
  mobile); the moon strip sits directly under the hero.
- Ritual Opener: three small facet frames (stone, wrist, pouch) in a row under the title
  — the ritual glimpsed before the promise.
- Phase Hero: the moon-phase strip IS the hero's underline, title and price above, image
  below — for cycle-framed products (sleep, monthly rituals).
- Whisper Proof: one review line in display face with silver quote marks above the
  altar frame — trust before promise.
- Twin Stones: two facet frames side by side (product / its stone macro), price beneath
  the pair — for material-led jewelry.

10. FORM MENU

- The Night Card: a single #221A44 card, silver hairline header ("اطلبي سوارك"), stacked
  56px fields, amethyst submit. The default.
- Phase Steps: two steps (choice, coordinates) with the moon strip as progress — phases
  fill as steps complete.
- Echo Whisper: a compact phone+city pair under the hero for the decided, full Night
  Card at the end.
- Bar-Driven: the slim night bar is the only CTA until the form section opens focused.

11. MOTION IDENTITY

Lunar drift: entrances are 1.2s sine fades with at most 10px rise; staggers 120ms;
nothing ever pops. The signature: ONE moon-phase strip fills phase-by-phase (steps(n),
0.15s per phase) when it first enters. The hero smoke thread draws upward once (1.6s,
sine.inOut) on load. Facet frames and everything else stand still. All gated on gsap +
ScrollTrigger + no reduced-motion; with JS off the moon strip shows its final phase and
the page is complete. Banned: pulsing, floating loops, parallax, glow ramps, star
twinkle, rotation of any kind.

12. BAN LIST

Generic slop: purple-blue gradients (the violet is tonal, not a gradient show),
glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos,
cookie-cutter icon rows, hero carousels, parallax, backdrop-blur, back.out overshoot.
Neighbor tics banned by name: observatoire's constellation maps, orbital ellipses and
astronomical captions (silver dots stay unconnected and unlabeled); kenz's spotlight
cone and gold dust; manette's chamfer panels and RGB sweeps; hammam's steam veils (smoke
is a LINE, never fog); voltage's neon glow; fanous's lantern strings and crescent
finials (the sibling festive night — hard wall: Falak has no lanterns, no crescents, no
tassels); gloss's bulbs; oud's note pyramids and bloom corners. Refused blocks restated:
comparison-table, spec-table, lottery-contest. Falak's own temptations, banned: healing
claims, tarot iconography, gold accents, more than two smoke threads per viewport,
connected star patterns.

13. EXAMPLE VARIATIONS

- "Bracelet Pierre de Lune" — jewelry & watches. Night Altar hero; problem-solution
  (سهر وقلق), how-it-works ritual, photo-reviews, variant stones, price-anchor,
  guarantee, Night Card form, faq, footer. Hexagon facets. Smoke: hero only.
- "Rituel Sommeil" — health & wellness. Phase Hero (cycle framing); ingredients
  (lavande, camomille), ritual steps, whatsapp-proof, bundle rituel complet,
  price-anchor, Phase Steps form, faq, footer. Pentagon facets. Moon strip doubles as
  form progress.
- "Huile de Minuit" — beauty & cosmetics. Crescent Split hero; ingredients with hairline
  leaders, benefits glyphs, photo-reviews, price-anchor with per-night math, guarantee,
  Echo Whisper + Night Card, faq, footer. Irregular gem facets.
- "Paire Améthyste" — jewelry & watches. Twin Stones hero; stats-band, photo-reviews,
  bundle paire, guarantee, Bar-Driven form, faq, footer. Hexagon facets. Second smoke
  thread beside the bundle.
- "Coffret Lune & Encens" — health & wellness. Ritual Opener hero; how-it-works,
  whatsapp-proof, variant scents, price-anchor, guarantee, Night Card form, faq, footer.
  Pentagon facets. The strip sits mid-page between proof and offer.
- "Sautoir Sélène" — jewelry & watches. Whisper Proof hero; benefits glyphs,
  photo-reviews with one facet-framed customer photo, price-anchor, guarantee, Night
  Card form, faq, footer. Irregular facets; sparsest build — 8 blocks, vast night.
- "Anneaux de Pleine Lune" — jewelry & watches. Phase Hero framing a 28-night promise;
  variant stones (moonstone / améthyste / onyx), stats-band, whatsapp-proof, bundle
  paire, price-anchor, guarantee, Phase Steps form, faq, footer. Hexagon facets; the
  moon strip doubles as both hero underline and form progress — the page's cycle told
  twice, drawn once.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
