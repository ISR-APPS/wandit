import type { DesignWorld } from "../types";

export const bonplan: DesignWorld = {
	id: "bonplan",
	name: "Bonplan",
	family: "dark-hustle",
	tagline: "Midnight deal energy: black, taxi-yellow, prize badges",
	kind: "cod",
	mood: ["hustle", "nocturnal", "prize", "direct"],
	energy: "loud",
	priceFeel: "accessible",
	industries: [
		"electronics & gadgets",
		"home & kitchen",
		"fitness equipment",
		"car accessories",
	],
	avoidFor: ["jewelry & watches", "beauty & cosmetics"],
	fusesWith: ["souk", "tendance"],
	preview: {
		ground: "#0C0C0E",
		ink: "#F5F5F2",
		accent: "#FFCC1E",
		fontFamily: "Cairo",
		sampleWord: "الباك",
	},
	doc: `
BONPLAN — THE MIDNIGHT DEAL PAGE

1. PHILOSOPHY

Bonplan is the page that lights up a phone screen at 23:40, when the day is done and the
scroll is honest. It is the Algerian dropshipper vernacular — black ground, taxi-yellow
shout, centered stack, prize psychology — taken seriously for once and rebuilt with
discipline. The people who invented this look were not designers; they were sellers who
learned that on a dark screen at night, one yellow rectangle reads like a lighthouse. Bonplan
keeps their instinct and removes their noise: zero emoji, zero clip-art, zero rainbow
gradients. One black. One yellow. Drawn glyphs with real geometry. The page behaves like a
game-show host who respects you: it promises a prize, states the price, shows the goods, and
never mumbles.

Everything centers. The buyer holds the phone in one hand, thumb hovering; Bonplan places
every decisive element on that thumb's axis. The product is presented as a PRIZE — not a
catalogue item — framed in its own mini-poster like the featured lot of tonight's draw. Copy
is short, spoken, confident: "الباك كامل. تخلص كي يوصلك." Nothing is whispered, but nothing
is screamed twice either; a hustler who repeats himself loses the room.

Self-audit before shipping:
- Is the page one black river with yellow lights — no second accent hue anywhere?
- Does the hero poster-inset read as a PRIZE card, complete with its own title and CTA?
- Are all icons drawn SVG glyphs — zero emoji, zero pictographic fonts?
- Do the deal tickets stack with punched notches, never looking like receipts?
- Is exactly one element pulsing at any time, and is it a medallion chip?
- Is the price repeated at most three times across the whole page?
- Does the form sit inside 56px+ fields with the yellow submit as the page's largest button?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — invisible, inviolable.
- Palette registers: grounds #0C0C0E to #141416; ink #F5F5F2; taxi yellow #FFCC1E to
  #FFD84A; countdown-digit red #FF4438 capped at 3%; rare white cards.
- Type stacks: Latin display Archivo Black or Anton, body Inter; Arabic display Cairo (900)
  or Changa, body Almarai.
- The three owned tics: poster-in-page inset, deal ticket stack, award medallion chips.
- Motion identity "jackpot pulse": 0.3s power3 pops, one subtle medallion pulse, the
  poster-inset settle on load.
- Desktop law: centered mobile shell, ~440px, on pure black.
- Refused blocks: size-guide, spec-table.
- Imagery: moody dark bundle photography with yellow rim light (spec in Signature Art).

CLIENT-OWNED — re-decided fresh for every client, never copied:
- Hero composition from the hero menu.
- Block choice within the supported set and the block ORDER — a gadget pack and a kitchen
  pack run different convince sequences.
- Form style from the form menu.
- Proof lead: stats-band, photo-reviews or whatsapp-proof — pick what the product earns.
- Which single claim gets the medallion treatment in the hero.
- Ticket count and stacking angle in the offer; section density (a lean 9-block run or a
  full 14-block night market).
Every client gets a new prize night — same stage, different show. A clone is a failed build.

3. VISUAL SIGNATURES

Measured values. Grounds: #0C0C0E base, #141416 raised sections, #1B1B1F cards. Ink #F5F5F2;
secondary ink at 62% opacity. Yellow: #FFCC1E base, #FFD84A hover/highlight end; black text
on yellow always #0C0C0E. Red #FF4438 exists ONLY inside countdown digits and never as a
surface. White cards #FAFAF7 are rare — at most two per page (poster-inset interior and one
proof card).

Type scale: display clamp(30px, 8.5vw, 46px), line-height 1.05, weight 900; Arabic display
at 94% of the Latin clamp, line-height 1.25. Section titles clamp(21px, 6vw, 28px). Body
clamp(15px, 4vw, 16.5px), line-height 1.6 Latin / 1.8 Arabic. Prices: display face,
clamp(26px, 7.5vw, 40px), yellow on black or black on yellow only.

Shapes: cards 14px radius; tickets 10px with punched semicircle notches (10px diameter) cut
into both side edges at mid-height; medallion chips are perfect circles 56-72px; buttons 12px
radius, min-height 54px. Borders: 1px #2A2A2E on resting cards; 2px #FFCC1E on the active
ticket. Shadows: none — depth is tonal steps only, the night has no soft light.

The tics, precisely:
- POSTER-IN-PAGE INSET: a framed card (radius 18px, border 2px #FFCC1E, interior its own
  ground — deep black or rare white) containing product image, its own one-line title, its
  own mini CTA. It floats on the page ground with 20-28px margin on both sides and is the
  hero's centerpiece. It reads as tonight's featured lot.
- DEAL TICKET STACK: offers rendered as horizontal tickets (yellow fill, black ink) stacked
  with 8-12px vertical overlap and alternating ±1.5° rotation; each ticket carries quantity,
  price, and a punched notch pair. The selected ticket straightens to 0° and gains the 2px
  border. Never dashed tear lines, never mono receipt type.
- AWARD MEDALLION CHIPS: circular yellow chips bearing DRAWN glyphs (cup, medal, star,
  laurel — 2px black strokes) plus a 3-5 word claim beneath or beside ("+5000 زبون",
  "الأكثر مبيعاً"). At most three per page; exactly one may pulse.

4. COLOR PHYSICS

Ground register: #0C0C0E to #141416 — the page is one continuous night; sections separate by
a 1px #232327 rule or a tonal step, never by hue. Ink register: #F5F5F2 full, 62% secondary,
40% legal lines. Yellow physics: yellow is LIGHT, not paint — it appears where attention
must land (price, CTA, tickets, medallions, poster frame) and occupies 8-14% of any
viewport. Two yellow elements must never touch; black must breathe between them. Red is a
countdown-only pigment, capped at 3%, forbidden on buttons. Forbidden outright: gradients on
grounds, purple-blue anything, green (no fake "in stock" LEDs), a second accent hue, white
sections, glassmorphism.

5. TYPOGRAPHY

Latin stack: display Archivo Black (the poster voice) or Anton (taller, for long product
names) — one per build; body Inter 400/600; prices and counters in the display face,
tabular numerals. Arabic stack: display Cairo 900 (first choice — its heavy geometry matches
Archivo Black) or Changa 800; body Almarai 400/700. Pairing rule: Cairo pairs with Almarai;
Changa pairs with Almarai; never two display faces in one build.

Clamps are shared across scripts with Arabic display at 94%. Arabic body line-height
1.7-1.9; NEVER letter-spacing on Arabic (Latin caps may take 0.02-0.06em). Digits: Western
Arabic numerals for prices, counts and phone; phone numbers wrapped in an LTR span. RTL:
logical properties everywhere; the centered composition is direction-neutral, but ticket
rotation signs flip, medallion claim text sits on the logical end side, and the poster-inset
mini CTA arrow points to the logical start.

6. SIGNATURE ART & COMPONENTS

The poster-inset is the world's altar: build it as a bordered stage with its own padding
rhythm (20px interior), its product image bleeding to the frame, title in display caps, and
a mini CTA that mirrors the main one. Supporting cast: countdown plaque (black card, yellow
frame, red digits, Arabic labels beneath each digit pair); stat counters in display face
with drawn laurel flanks; order-steps as numbered yellow circles connected by a 1px rule;
FAQ rows with drawn chevron glyphs; the sticky bar as a full-width black strip, 1px yellow
top rule, price left, yellow CTA right (mirrored in RTL).

Imagery: moody dark e-commerce bundle photography — matte black backdrop, the products
arranged as a PRIZE ensemble (fanned, stacked, floating), one hard key light plus a taxi-
yellow rim light from the side, deep shadows, high contrast, slight reflective floor. Props
limited to black and yellow objects. No lifestyle scenes, no daylight, no people beyond an
occasional hand entering frame from the edge. Every asset in a build shares the same black
ground and yellow rim so the page reads as one night shoot. Banned in photos: colored
gradients, neon tubes, confetti, money imagery.

Component measurements, for builders: the countdown plaque runs full card width with four
digit pairs, each pair 40-52px tall in the display face, red #FF4438, labels in Almarai 12px
beneath; the plaque's yellow frame is 2px with 14px radius. Medallion glyph strokes are 2px
black on yellow, drawn inside a 60% safe zone so the circle never feels crowded. The stat
counters sit 28px apart with laurel glyphs 20px tall flanking the center number only. Ticket
notches must cut INTO the fill (transparent semicircles matching the page ground) so the
stack reads die-punched even where tickets overlap. The sticky bar is 64px tall, its yellow
button 44px high with 18px side padding; on screens under 360px the bar drops the price and
keeps only the button. Yellow-on-black focus rings (2px, 2px offset) are the accessibility
signature — every interactive element shows them on keyboard focus. Card padding rhythm:
20px interior on mobile, 24px at shell width; between-section spacing clamp(48px, 12vw,
72px) — the night is dense but never cramped, and two consecutive sections never share the
same card tone.

7. THE SPINE

Hook, convince, offer, order form — in that order, always. Bonplan's price placement: the
price appears IN THE HERO inside the poster-inset (yellow on black), and again on the sticky
bar; the price-anchor block restates it with the savings math. Sticky CTA: the black strip
with yellow button described above, visible from the moment the hero scrolls past, tapping
smooth-scrolls to the form. Mobile-first at 390px: the entire page designed on the thumb
axis. Desktop law: centered mobile shell ~440px on pure #0C0C0E — the phone-shaped prize
page floating in the dark, nothing else on stage.

8. BLOCKS TREATMENT

Supported blocks, dressed by Bonplan:
- announcement-bar: black strip, yellow text, one rotating pair of messages max ("توصيل 58
  ولاية" / "الدفع عند الاستلام"). Never taller than one line.
- hero: poster-inset centerpiece + headline above + medallion chip; price inside the poster.
- countdown: the plaque — black card, yellow frame, red digits, honest expiry line beneath.
- stats-band: three display-face counters with drawn laurel glyphs; counts up once.
- benefits-icons: 4-6 chips, drawn yellow glyphs in circles, one-word labels.
- photo-reviews: dark cards, 1px rule, name + wilaya + drawn stars (never glyph fonts);
  one rare white card allowed for the lead review.
- whatsapp-proof: recreated chat on a dark card — bubbles in #1B1B1F and yellow-tinted
  #2A2513, timestamps, read ticks drawn.
- stock-urgency: a yellow meter draining left-to-right (RTL: mirrored) with "بقي X" label;
  honest numbers only.
- lottery-contest: the draw card — prize named, rule stated ("كل باك = تذكرة"), draw date,
  a medallion chip sealing it.
- bundle-offers: the deal ticket stack itself — 2-3 tickets, per-unit math on each,
  "الأكثر طلباً" on the middle ticket.
- cross-sell: one companion ticket in a smaller size with a checkbox that feeds the form.
- price-anchor: old price struck in ink, new price huge in yellow, savings stated in dinars,
  "تخلص كي توصلك" beneath.
- order-steps: four yellow-numbered circles on a rule: تعمّر الاستمارة، نأكدو بالتيليفون،
  التوصيل، تخلص عند الباب.
- order-form + faq + trust-footer: per the form menu; FAQ 5-6 rows; footer with huge phone
  number, drawn WhatsApp glyph, coverage line.

Refused blocks:
- size-guide: Bonplan sells packs and gadgets, not fitted garments; a size chart would slow
  the night down.
- spec-table: specs are the datasheet world's language; Bonplan states three numbers in
  medallions and moves on.

9. HERO MENU

- The Featured Lot: headline top, poster-inset center (product + price + mini CTA),
  medallion chip overlapping the frame corner. The default prize stage.
- Double Feature: two half-width poster-insets side by side (product solo / pack complete),
  the pack framed in yellow as tonight's pick.
- Countdown Curtain: the plaque sits directly under the headline, poster-inset follows —
  for true deadline drops only.
- Medallion Opener: three medallion chips in a row above the poster-inset carrying the three
  strongest claims; price stays in the poster.
- Chat Teaser: a two-bubble whatsapp exchange ("وصلني الباك، صح يستاهل؟" / "قلتلك!") above
  the poster-inset — proof before promise.
- Ticket-First: the deal ticket stack IS the hero under a one-line headline; the poster-
  inset appears one scroll later. For repeat-audience relaunches.

10. FORM MENU

- The Claim Card: single dark card, yellow-framed header ("استمارة الطلب"), stacked 56px
  fields, yellow submit spanning full width. The default.
- Two-Step Draw: step 1 pick your ticket (bundle), step 2 name + phone + wilaya; progress
  shown as two punched tickets, the completed one straightening.
- Echo Form: a compact phone+wilaya pair right under the hero poster for the decided,
  repeated in full at the page end; the echo submit scrolls to the full form.
- Bar-Driven: the sticky bar is the only CTA until the form; tapping it opens the form
  section with the first field focused.

11. MOTION IDENTITY

Jackpot pulse: entrances pop at 0.3s power3.out (scale 0.96 to 1 + fade); staggers 60-80ms.
Exactly ONE medallion chip may pulse (scale 1 to 1.05, 1.8s yoyo) per page. The signature
moment: on load, the poster-inset lands with a single settle — scale 1.04 to 1, 0.45s,
power3.out — like a card slapped on the table. Countdown digits flip opacity per second, no
3D. Ticket selection straightens rotation in 0.2s. All motion gated on gsap + ScrollTrigger
+ no reduced-motion; with JS off the page is complete and still. Banned: overshoot easings,
marquees, continuous rotation, parallax, glow ramps.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design (hard law here — zero
emoji anywhere, drawn SVG glyphs only), Poppins-everything, lorem ipsum, fake trust logos,
cookie-cutter icon rows, hero carousels, parallax, backdrop-blur, back.out overshoot.
Neighbor tics banned by name: trottoir's receipt rail and courier-label furniture (tickets
are punched coupons, never thermal paper); souk's serrated starburst badges and split-flap
countdown; gloss's vanity-bulb frames (Bonplan's lights are yellow surfaces, never bulb
rows); teleachat's value-stack tower and TV bezel; kenz's spotlight cone; manette's chamfer
panels and RGB; bloc's hard offset shadows; phosphore's terminal furniture. Refused blocks
restated: size-guide, spec-table. Bonplan's own temptations, banned: a second accent color,
red buttons, money/cash imagery, fake countdown resets flagged as real, more than three
medallions, emoji in copy.

13. EXAMPLE VARIATIONS

- "Pack Gamer Nuit Blanche" — electronics & gadgets. Featured Lot hero; countdown, stats-
  band, benefits-icons, photo-reviews, lottery-contest, bundle tickets, price-anchor,
  order-steps, Claim Card form, faq, footer. Mood: tournament night. Signature emphasis:
  medallion pulse on "+3000 لاعب".
- "Cuisine Express" — home & kitchen. Medallion Opener hero (3 claims); benefits, whatsapp-
  proof lead, ticket stack (solo/duo/famille), cross-sell mini-ticket, price-anchor,
  Two-Step Draw form, faq, footer. Mood: midnight meal-prep. Poster settle lands on the
  multicooker glamour shot.
- "Muscu à Domicile" — fitness equipment. Ticket-First hero for a relaunch audience; stats-
  band, photo-reviews, stock-urgency meter, lottery draw card, price-anchor, Echo Form,
  faq, footer. Mood: no-excuses night. Medallion: "يوصلك في 48 ساعة".
- "Roulez Équipé" — car accessories. Double Feature hero (dashcam solo / pack complet);
  benefits, whatsapp-proof, countdown plaque mid-page, ticket stack, order-steps, Bar-Driven
  form, faq, footer. Mood: taxi-driver pragmatism. One medallion only: "ضمان عام".
- "Le Pack Étudiant" — electronics & gadgets. Chat Teaser hero; benefits, stats-band,
  bundle tickets (solo/binôme), price-anchor with per-day math, lottery-contest, Claim Card
  form, faq, footer. Mood: campus hustle. Signature: ticket straighten on select is the
  only rotation on the page.
- "Hiver Chaud" — home & kitchen. Countdown Curtain hero (real season-end date); poster-
  inset, benefits, photo-reviews with one white lead card, stock-urgency, price-anchor,
  Two-Step Draw form, footer. Mood: last-week urgency, honestly stated.
- "Le Duo Bureau" — electronics & gadgets. Featured Lot hero with the rare white poster
  interior; benefits, whatsapp-proof, cross-sell ticket, price-anchor, Echo Form, faq,
  footer. Mood: freelance nights. Medallion pulse on "توصيل غدوة للعاصمة".
- "Pack Auto Secours" — car accessories. Medallion Opener hero (ضمان عام / توصيل 48h /
  +2000 سائق); countdown plaque, benefits, photo-reviews, stock-urgency meter, ticket
  stack solo/complet, order-steps, Claim Card form, faq, footer. Mood: glovebox
  preparedness sold at midnight. Signature: the stock meter is the page's only yellow
  motion after the poster settles.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
