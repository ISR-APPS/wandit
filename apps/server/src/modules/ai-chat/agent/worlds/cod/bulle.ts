import type { DesignWorld } from "../types";

export const bulle: DesignWorld = {
	id: "bulle",
	name: "Bulle",
	family: "comic-pop",
	tagline: "A comic strip that sells: bubbles, panels, speed lines",
	kind: "cod",
	mood: ["playful", "punchy", "drawn", "fun"],
	energy: "loud",
	priceFeel: "accessible",
	industries: ["kids & baby", "home & kitchen", "pets"],
	avoidFor: ["jewelry & watches", "beauty & cosmetics", "car accessories"],
	fusesWith: ["doudou"],
	preview: {
		ground: "#FFF9EE",
		ink: "#101014",
		accent: "#FF3355",
		fontFamily: "Bangers",
		sampleWord: "POW !",
	},
	doc: `
BULLE — THE COMIC STRIP THAT SELLS

1. PHILOSOPHY

Bulle turns the funnel into a bande dessinée. The page is an issue: paper ground, inked
panels with visible gutters, speech bubbles doing the talking, speed lines doing the
shouting. Photography is allowed — encouraged — but it lives INSIDE drawn furniture: a
product photo sits in a panel like a pasted cel, a price arrives in a spiky bubble, a
doubt gets a cloudy think-bubble and an answer pops it. The child sees an adventure; the
parent sees clarity — because comics are the oldest interface on earth: read the panels in
order, follow the bubbles, arrive at the end.

The discipline is INK. Everything drawn uses the same 3px black line — bubbles, panel
borders, arrows, glyphs. Color pops inside the ink like a well-printed page: one dominant
pop color per build, two supporting ones rationed to cameos. No halftone dots, no pixel
art, no cut-out chaos — Bulle is a CLEAN modern comic, closer to a European album than a
xeroxed zine. The voice is onomatopoeic but literate: it says "POP !" once at the right
panel, not on every scroll.

Self-audit before shipping:
- Does every drawn element share the same 3px ink line?
- Do bubbles carry the page's key numbers (price, savings, delivery days)?
- Is there exactly ONE speed-line burst moment, at the offer?
- Is one pop color clearly dominant, the other two under 10% each?
- Do panels keep visible gutters and read in strict order (RTL-aware when Arabic)?
- Are photos always inside panels or bubbles — never floating naked?
- Form fields 56px+, labeled, with a drawn success panel ("C'EST COMMANDÉ !")?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — the strip's plot, never reordered.
- Palette registers: paper #FFF9EE; ink #101014 at 3px; pop trio #FF3355 / #29C4F2 /
  #FFCB2E with ONE dominant per build; halftone forbidden.
- Type stacks: Latin display Bangers or Luckiest Guy, body Inter; Arabic display Lalezar,
  body Almarai.
- The three owned tics: speech-bubble callouts, speed-line bursts, panel-grid sections.
- Motion identity "panel snap": 0.25-0.3s expo pops with 1° settle; one burst flash.
- Desktop law: centered mobile shell ~460px on paper with a faint panel grid.
- Refused blocks: press-badges, size-guide.
- Imagery: bright playful product photography (spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice and ORDER within the supported set — a toy's plot differs from a kitchen
  gadget's plot.
- Form style from the form menu.
- Which pop color dominates; where the two cameos appear.
- Proof lead: photo-reviews or whatsapp-proof; bubble density (chatty issue vs sparse
  album).
- Which single beat earns the speed-line burst.
Every client gets a new issue — same series, different adventure. A clone fails the
contract.

3. VISUAL SIGNATURES

Measured values. Paper ground #FFF9EE; panel interiors #FFFFFF or a pop color at 12%
tint. Ink #101014: 3px borders on panels and bubbles, 2px on small glyphs, 1px never
(too thin for the language). Pop trio: #FF3355 rouge-pop, #29C4F2 cyan, #FFCB2E soleil —
dominant one on CTAs, bubbles' fills stay white or paper except ONE accent bubble per
section.

Type: display clamp(30px, 8.5vw, 48px) Bangers (Latin) with +0.02em tracking, line-height
1.05; Arabic display Lalezar at 92% clamp, no tracking, line-height 1.3. Section titles
clamp(20px, 6vw, 28px). Body Inter clamp(15px, 4vw, 16.5px), line-height 1.6 / Almarai
1.8 Arabic — bubble text NEVER in display face beyond 6 words. Prices in display face
inside bubbles, clamp(24px, 7vw, 38px).

Shapes: panels 6px radius (album corners), gutters 10-14px paper; bubbles are hand-round
ellipses/rects with 3px ink and a drawn tail (round tail = speech, cloud bumps = thought,
spiky = shout); buttons are ink-bordered slabs 10px radius, dominant-pop fill, 54px min.
Shadows: none — ink does the separating. Tilt: panels may tilt ±2° at section breaks
(never mid-flow).

The tics, precisely:
- SPEECH-BUBBLE CALLOUTS: prices, benefits, review quotes and objections ride in bubbles
  with correct tails pointing to their source (product, buyer avatar circle, or
  off-panel). Shout bubbles (spiky) are rationed to two per page: price reveal and one
  climax.
- SPEED-LINE BURSTS: radiating 2-3px ink lines from behind the product, clipped inside
  the panel; used at ONE beat only (the offer or hero climax), flashed once on entry.
- PANEL-GRID SECTIONS: each section is 1-3 panels with visible gutters; one panel per
  section may break the grid (tilt 2° or bleed past a gutter edge). Reading order is
  strict: top-to-bottom, start-to-end (mirrored under RTL).

4. COLOR PHYSICS

Paper is the page; panels are white or lightly tinted rooms on it. Ink is absolute — one
black, no grays for lines (text may use #4A4A52 for long body). Pop physics: the dominant
color owns CTAs, the two shout bubbles, panel tints and glyph accents (max 25% of a
viewport); cameo colors appear as single accents per section (a tail, a star, a chip),
each under 10%. Forbidden: gradients anywhere, halftone-dot textures, brown/beige murk,
black panels, neon glows, a fourth pop color.

5. TYPOGRAPHY

Latin stack: display Bangers (first — its shout is the brand) or Luckiest Guy (rounder,
for younger products); body Inter 400/600 for everything longer than a bubble. Arabic
stack: display Lalezar — its chunky vernacular energy is the Arabic Bangers; body Almarai
400/700. Pairing rule: display for titles, bubble headlines and prices; body for
sentences; never mix the two display faces.

Clamps shared (Arabic display 92%). Arabic body line-height 1.7-1.9, no letter-spacing on
Arabic ever; bubble tails flip sides under RTL and panels read right-to-left. Digits:
Western Arabic numerals; phone in LTR span. Onomatopoeia stay Latin script even in Arabic
builds ("POP !", "TAC !") — they are drawings, not words.

6. SIGNATURE ART & COMPONENTS

Supporting cast: avatar circles (3px ink, flat pop fill) for reviewers; drawn stars
(5-point, ink + soleil fill) for ratings; arrow doodles (2px, one curl max) guiding
between panels; prices always bubble-borne; numbered panel
badges (ink circle, white numeral) for steps; the sticky CTA as an ink-bordered slab bar
with the dominant pop fill and a tiny bubble tail pointing down at the form.

Imagery: bright playful product photography — clean paper-white or pop-tinted seamless,
hard cheerful light, dynamic 3/4 angles, props in the build's pop colors, real product
sharpness (the drawings are the frame, the photo is the proof). Kids' products may show
children's HANDS only, never faces. Every asset shares the same seamless style so panels
feel printed in one issue. Banned in photos: moody shadows, bokeh soup, lifestyle
clutter, anything that fights the ink.

Component measurements, for builders: bubble geometry follows print craft — speech bubbles
are ellipses or rounded rects (14px radius) with tails 18-26px long, drawn as part of the
same 3px path; think-bubble trails are three shrinking circles (10/6/3px); shout bubbles
carry 8-12 spikes of uneven length so they read hand-inked. Panel gutters: 10px mobile,
14px at shell width; a full-bleed panel may swallow its side gutters once per page. Avatar
circles are 44px with 3px ink and flat pop fill; drawn stars 16px with soleil fill and ink
outline. The sticky slab bar is 60px tall, ink-bordered top edge (3px), its bubble tail
12px, dominant-pop fill with ink text — black text always, white never (print logic).
Section spacing clamp(44px, 11vw, 68px) — issues are dense. Numbered panel badges: 28px
ink circles, white numerals in body face 700. Focus rings: 3px ink offset 2px (the ink IS
the focus language). The form success panel is a full-width panel with a spiky "تم الطلب!"
bubble, order number in display face, and a drawn confetti-free star pair — celebration in
ink, never particle systems.

Copy register: Bulle's narrator is the album's caption box — playful, brisk, precise. The
bubbles speak like characters (a doubt, a cheer, a parent's relief), while captions carry
the facts (contenance, matière, délai). One joke per page maximum; the strip is funny by
rhythm, not by clowning. Arabic builds keep bubble lines under six words and let Lalezar's
weight do the laughing; French builds may run a longer caption under a panel but never
inside a bubble. Onomatopoeia are art assets, drawn large and placed like stamps — "POP !"
at the straw's first use, "TAC !" at the lid's click — never sprinkled as punctuation.
RTL craft: in Arabic issues the entire strip mirrors — panels read right to left, tails
flip, tilted panels lean the opposite way, and the speed-line burst radiates from the
logical start corner; a mirrored issue must feel originally drawn that way, not flipped
by machine.

7. THE SPINE

Hook, convince, offer, order form — the plot in four acts. Price placement: first price
arrives in the HERO inside a spiky shout bubble tied to the product panel; the sticky bar
repeats it. Sticky CTA: the slab bar with bubble tail, present after the hero, scrolls to
the form. Mobile-first 390px. Desktop law: centered mobile shell ~460px on paper ground
printed with a faint (4% ink) empty panel grid — the issue floating on its own artboard.

8. BLOCKS TREATMENT

Supported blocks, dressed by Bulle:
- announcement-bar: a thin ink-bordered strip like an issue header — "توصيل 58 ولاية"
  left, "الدفع عند الاستلام" right (one line, paper ground).
- hero: 1-2 panels: product photo panel + headline above, price shout-bubble overlapping
  the panel corner, CTA slab beneath.
- problem-solution: two panels: gray-day photo panel with a cloudy think-bubble
  ("توسّخ الدفتر؟"), then product panel with a speech bubble answering; the turn of the
  page IS the solution.
- benefits-icons: a row of small square panels, each a drawn 2px glyph + one word; one
  panel tinted in the dominant pop.
- how-it-works-steps: three numbered panels in strip order, photo or glyph inside, one
  bubble per panel with a single sentence.
- photo-reviews: panels with avatar circle + speech bubble carrying the quote, name +
  city in caption strip beneath; drawn stars.
- whatsapp-proof: a panel containing a simplified chat — bubbles keep the world's 3px
  ink (chat as comic, not as phone UI).
- stats-band: one wide panel, three ink numerals with soleil star accents, counts up
  once.
- variant-gallery: color variants as small panels with a color-dot corner badge;
  selected panel's border goes dominant-pop; feeds the form.
- bundle-offers: 2-3 ticket-shaped... no — 2-3 PANELS side by side (solo/duo/famille),
  per-unit price in a small bubble each, "الأفضل" shout on one; feeds the form.
- cross-sell: a half-width panel with the companion product and a checkbox drawn as an
  ink box that gets a hand-drawn check.
- price-anchor: a full-width panel: old price in a popped (deflating) bubble, new price
  in the page's second shout bubble, savings caption.
- order-steps: four mini-panels: استمارة، مكالمة، توصيل، الدفع عند الباب — each a glyph +
  word.
- order-form + faq + trust-footer: per form menu; FAQ as Q-bubbles (think) and A-bubbles
  (speech); footer as the issue's back cover — ink strip, phone huge, drawn socials.

Refused blocks:
- press-badges: borrowed-authority logos break the fiction; the strip proves itself.
- size-guide: fitted-garment charts have no panel; Bulle sells objects, not tailles.

9. HERO MENU

- Splash Page: one big product panel, headline across the top, price shout-bubble on the
  panel corner, CTA beneath. The classic issue opener.
- Two-Panel Gag: setup panel (problem photo + think bubble) then payoff panel (product +
  speech bubble) side by side; price rides the payoff.
- Bubble Parade: headline, then three stacked bubbles (benefit, benefit, price-shout)
  tail-tied to one product panel on the side.
- Strip Opener: three small panels in a row like a daily strip (see it, use it, love it),
  price bubble under the third.
- Variant Cover: the variant panels ARE the hero under a shout headline — for color-led
  products.
- Chat Cold-Open: a whatsapp-proof panel opens the page ("وصلتني اليوم! ولدي فرحان بيها")
  before the product splash.

10. FORM MENU

- The Order Panel: one big ink-bordered panel titled by a speech bubble ("سجّلي الطلب!"),
  stacked 56px fields, dominant-pop slab submit. The default.
- Two-Page Spread: step 1 variant/bundle panels, step 2 coordinates panel; progress as two
  small panel badges.
- Echo Bubble: a compact phone+wilaya bubble-form under the hero, full Order Panel at the
  end.
- Bar-Driven: the sticky slab is the only CTA until the Order Panel, which opens focused.

11. MOTION IDENTITY

Panel snap: panels pop in at 0.25-0.3s expo.out with a 1° rotation settle; bubbles pop
0.05s after their panel (scale 0.9 to 1); staggers 60ms. The signature: ONE speed-line
burst flashes behind the product when the offer beat enters — lines scale out once, 0.4s,
then hold. Counts count once. Nothing loops. All gated on gsap + ScrollTrigger + no
reduced-motion; the page is a complete printed issue with JS off. Banned: overshoot
bounce, parallax, marquees, shake/wiggle loops, typewriter effects.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design (drawn glyphs only —
an emoji in a bubble fails the build), Poppins-everything, lorem ipsum, fake trust
badges, cookie-cutter icon rows, hero carousels, parallax, backdrop-blur, back.out
overshoot. Neighbor tics banned by name: gazette's halftone-dot image treatment (no dot
screens ever); huitbit's pixel sprites and HUD; fanzine's torn edges, tape and ransom
letters; souk's serrated starbursts (shout bubbles are drawn, never sticker-serrated);
affiche's giant punctuation-as-graphic; tutti's memphis confetti and squiggles; doudou's
cloud-scallop edges and balloon numerals; bonplan's medallions and tickets. Refused
blocks restated: press-badges, size-guide. Bulle's own temptations, banned: more than
two shout bubbles, halftone textures for "authenticity", gray panel interiors, ink
thinner than 2px, English onomatopoeia overload (two per page max).

13. EXAMPLE VARIATIONS

- "Gourde Héros" — kids & baby. Splash Page hero; problem-solution (bouteille renversée),
  benefits panels, variant cover row, photo-reviews, bundle duo, price-anchor, Order
  Panel form, faq, footer. Dominant: rouge-pop. Burst: at the price-anchor.
- "Lunch Box Mission" — kids & baby. Two-Panel Gag hero; how-it-works, benefits,
  whatsapp-proof, cross-sell (gourde), price-anchor, Two-Page Spread form, faq, footer.
  Dominant: cyan. Burst: hero payoff panel.
- "Doseur Magique" — home & kitchen. Strip Opener hero; benefits, stats-band,
  photo-reviews, bundle solo/duo, price-anchor, Echo Bubble + Order Panel, faq, footer.
  Dominant: soleil. Burst: stats-band entry.
- "Kit Croquettes Malin" — pets. Bubble Parade hero; problem-solution (gamelle renversée),
  benefits, photo-reviews (avatars pattes), price-anchor, Order Panel, faq, footer.
  Dominant: rouge-pop. Burst: solution panel.
- "Tapis Puzzle Géant" — kids & baby. Variant Cover hero (4 couleurs); benefits,
  whatsapp-proof, bundle famille, order-steps, Bar-Driven form, faq, footer. Dominant:
  cyan. Burst: bundle reveal.
- "Brosse Vapeur Chrono" — home & kitchen. Chat Cold-Open hero; how-it-works strip,
  benefits, stats-band, price-anchor, Order Panel, faq, footer. Dominant: soleil.
  Burst: how-it-works finale panel.
- "Fontaine Chat Zen" — pets. Splash Page hero variant (tilted panel); benefits,
  photo-reviews, cross-sell (filtres), price-anchor, Two-Page Spread, faq, footer.
  Dominant: cyan. Burst: at the hero.
- "Veilleuse Conteuse" — kids & baby. Two-Panel Gag hero (chambre noire / chambre
  étoilée); how-it-works strip, benefits, whatsapp-proof, variant covers (3 héros),
  bundle duo frère-sœur, price-anchor, Order Panel, faq, footer. Dominant: soleil.
  Burst: the payoff panel; the page's second shout bubble holds the bundle price.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
