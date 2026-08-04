import type { DesignWorld } from "../types";

export const teleachat: DesignWorld = {
	id: "teleachat",
	name: "Téléachat",
	family: "tele-shop",
	tagline: "The TV shopping channel, remastered in royal blue and gold",
	kind: "cod",
	mood: ["showman", "glossy", "urgent", "retro"],
	energy: "loud",
	priceFeel: "accessible",
	industries: [
		"home & kitchen",
		"electronics & gadgets",
		"kids & baby",
		"fitness equipment",
		"car accessories",
	],
	avoidFor: ["jewelry & watches", "beauty & cosmetics"],
	fusesWith: ["souk", "scoop", "expo"],
	preview: {
		ground: "#10259E",
		ink: "#FFFFFF",
		accent: "#FFC400",
		fontFamily: "Anton",
		sampleWord: "3× OFFERT",
	},
	doc: `
TELEACHAT — THE WORLD DOC

1. PHILOSOPHY

Téléachat is the 2003 TV shopping channel, remastered. It is 11pm, the studio floor is royal
blue, the host has just sliced a tomato so thin you can read through it, and a gold strap slides
across the bottom of the screen with a number you cannot believe. This world understands one
deep truth of selling: DEMONSTRATION IS THEATER. The product is the star, the page is the
studio, and the buyer is the audience being shown — not told — that the thing works. Where souk
is a street of many voices, Téléachat is one voice with a microphone: composed, rehearsed,
relentlessly enthusiastic.

The remaster matters. We keep the bones of the genre — the studio blue, the gold value straps,
the LIVE urgency, the "but wait, there's more" stacking — and we cut the shame: no chrome
bevels, no lens flares, no screaming 12-color layouts. The palette is disciplined to three
notes (blue, white, gold) plus one red dot. The gloss comes from photography and rhythm, not
from plastic effects. A Téléachat page should feel like prime-time: expensive lighting, cheap
price.

Self-audit checklist — answer YES to ship:
- Does the hero read as a broadcast — bezel, badge, or strap — within one second?
- Is the LIVE dot blinking somewhere in the first viewport, and only ONE dot on the page?
- Does the value-stack tower appear exactly once, at the offer beat?
- Is every gold element about money or prize — never decoration?
- Are demonstrations (close-ups, steps, results) doing the convincing, not adjectives?
- Does the page hold to blue/white/gold + red dot, with zero stray hues?
- Is the page fully readable with JavaScript off, straps parked in place?
- Would this embarrass neither a 2003 producer nor a 2026 art director?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The studio never reorders the show.
- Palette registers: studio blue grounds #10259E to #1B34C4 alternating with white sections;
  ink white-on-blue and #101430-on-white; gold #FFC400; LIVE red #E4002B for the dot and true
  urgency only.
- Type stacks: display Anton or Archivo Black (Latin), Cairo Black (Arabic); body Archivo or
  Public Sans (Latin), Almarai (Arabic).
- The three owned tics: TV bezel frames, lower-third straps, value-stack tower.
- Motion identity: broadcast cuts — straps slide x, power3.out 0.5s; LIVE dot blinks steps(1);
  the one hero-strap signature moment.
- Desktop law: centered mobile shell ~460px inside a subtle studio-vignette ground.
- Refused blocks: whatsapp-proof, size-guide.
- Imagery style: retro TV-studio product photography (full spec in Signature Art).

CLIENT-OWNED — re-decided fresh, every build:
- Hero composition (from the hero menu or a new invention in the same voice).
- Block choice and BLOCK ORDER from the supported set — the show's rundown changes per product.
- Form style from the form menu.
- Proof type rotation: video-testimonial or photo-reviews or stats-band leads.
- Which sections sit on blue vs white; where the single gold strap moments land.
- Channel branding flavor: the fictional channel badge text (TÉLÉ+ 7, CANAL OFFRE, SHOP 5...)
  is invented per client and never reused.

Each client gets a new episode, never a rerun. A clone is a failed build.

3. VISUAL SIGNATURES

Grounds: royal blue #10259E (deep studio) to #1B34C4 (lit studio) — pick one pair per build;
white #FFFFFF sections alternate for reviews, steps, form. Ink: #FFFFFF on blue, #101430 on
white. Gold #FFC400 reserved for price straps, value lines, prize flags. Red #E4002B ONLY the
LIVE dot and one true-urgency line.

Type scale: display clamp(2rem, 8vw, 3.2rem), Anton, uppercase, tracking 0.01em; Arabic display
Cairo 900 at 90% size, NO tracking. Section titles clamp(1.4rem, 5.5vw, 2rem). Body
clamp(0.95rem, 4vw, 1.05rem), line-height 1.6 Latin / 1.75 Arabic. Strap price line
clamp(1.5rem, 6.5vw, 2.4rem).

Shapes: bezel radius 18px (the TV corner), cards 12px, fields 12px, sticky pill 999px. Borders:
bezels take an 8px solid ink-dark frame (#0A1240) with a 2px inner gold keyline. Shadows: one
soft studio glow under bezels only — 0 12px 32px rgba(6,10,60,0.35). Flat elsewhere.

The tics, precisely:
- TV bezel frame: a rounded 18px frame, 8px #0A1240 border + 2px inset #FFC400 keyline, housing
  the hero photo or demo loop. Top-left: channel badge — white pill, blue caps text, invented
  channel name. Top-right: LIVE chip — red dot 8px blinking steps(1) 1s + white caps LIVE.
- Lower-third strap: two stacked decks sliding under a bezel or key visual — deck one gold
  #FFC400 with ink #101430 caps (product name), deck two white with blue caps (price or claim),
  both left-skewed -6deg on their leading edge. Height 34px + 30px.
- Value-stack tower: right-aligned ledger of "worth" lines — each item + gold value, a 2px white
  rule, the crossed total ("valeur totale 1 240 MAD" struck through), then the real price
  double-size in gold inside a white slab. The tower collapses its crossed total with a single
  scale-down beat when it enters view.

Spacing: mobile sections 48-64px vertical padding; the show breathes between demonstrations.

4. COLOR PHYSICS

Ground register: the blue is ROYAL — #10259E floor to #1B34C4 lit wall; a build commits to one
base and may use the other as a section alternate. White sections carry proof and form. Blue
never drops toward navy-black (#0A1240 is border-only) and never brightens toward cyan.
Ink register: pure white on blue; #101430 on white — never gray.
Accent register: gold #FFC400, may warm to #FFB800 in a build; gold = money and prize,
nothing else. If gold appears on a divider with no number nearby, delete it.
LIVE red #E4002B: the dot, and at most one true-urgency text line per page. Red is never a
ground, never a button.
Forbidden: purple, teal, green (even for delivery — Téléachat says FREE in gold), pastels, any
gradient except the single radial studio vignette on desktop ground, black sections.

5. TYPOGRAPHY

Latin stack: display Anton (first) or Archivo Black; body Archivo 400/600 or Public Sans
400/700. Numbers in straps and towers take tabular figures via font-variant-numeric. Arabic
stack: display Cairo 900 (the only Arabic with Anton's shoulders) ; body Almarai 400/700.
Pairing rule: display shouts, body reports — never use Anton/Archivo Black below 1.2rem.

Size clamps shared across scripts; Arabic display at 90% of Latin computed size, line-height
1.3 minimum (Cairo clips ascenders tighter than Anton). Arabic body line-height 1.75-1.9.
NEVER letter-spacing on Arabic; Anton's Latin may take up to 0.02em. Digits: Western Arabic
numerals everywhere (prices, phone, countdown); phone numbers wrapped LTR.

RTL law: logical properties throughout; straps skew mirrors (-6deg becomes 6deg on the leading
edge); the strap slide-in direction reverses; the value tower right-aligns its values to the
inline-start in RTL. Bezel badges swap corners.

6. SIGNATURE ART AND COMPONENTS

The bezel is the world's face: everything important gets framed like a broadcast. Supporting
cast: gold offer slabs (white slab, gold top-bar, price huge); claim chips (white pill, blue
caps text — "VU À LA TÉLÉ", "STOCK LIMITÉ" only when true); step frames (numbered white cards
with a blue numeral coin, used for demonstrations); phone-strap footer (an ink-dark band with
the order phone number in gold Anton, huge and tappable). The CTA: a gold slab button, ink
text, 56px min height, 12px radius, with a subtle white top-edge highlight line (the studio
light) — no bevels, no gloss gradients.

Imagery: retro TV-shopping studio photography. Royal blue seamless sweep background, dramatic
key light + gold-warm rim light, the product elevated on a glossy dark pedestal or held
mid-demonstration by anonymous hands (hands allowed, faces not), macro close-ups of the result
(the thin slice, the clean carpet, the inflated muscle band), high sheen but zero added
lens-flare. Consistent blue backdrop across ALL photos of a build. Banned in photos: daylight
kitchens, pastel sets, lifestyle clutter, visible brand text, faces. Reproduce this spec for
any product in the niches: slicers, gadgets, toys, ab-machines, car kits.

7. THE SPINE

Hook, convince, offer, order form — the rundown never changes, only the segments. Price
placement: Téléachat is a SHOWMAN — the hero shows the price crossed-out ("valeur 799") but the
REAL price is revealed at the offer beat by the value-stack tower; the sticky bar carries the
real price from the moment the hero scrolls past (so the conversion law of early price is
honored by the strap + sticky pair). Sticky CTA: a bottom bar styled as a broadcast strap —
gold deck with ink caps "COMMANDEZ — PAYEZ À LA LIVRAISON" and the price on its trailing end;
tap scrolls to the form. Mobile-first at 390px. Desktop law: centered mobile shell — ~460px
column on a deep blue ground with a single radial vignette (the studio light falling off), the
only gradient this world permits.

8. BLOCKS TREATMENT

Supported blocks, dressed:
- announcement-bar: an ink-dark strip with gold caps text — the "coming up next" line:
  livraison gratuite dès X, offre du jour. One message, no rotation on mobile.
- video-testimonial: THE flagship block — the demo loop inside the full bezel treatment,
  channel badge + LIVE chip, caption strap beneath. If no video, a demo photo sequence takes
  the bezel instead.
- how-it-works-steps: the demonstration segment — numbered step frames with macro photos,
  each step one action sentence. The host's hands do the work.
- benefits-icons: claim chips in a tight two-row wrap — white pills, blue caps, max 6; reads
  as broadcast supers, not icon soup.
- price-anchor: the value-stack tower, full treatment, once per page. Per-day math allowed
  beneath in body type ("moins de 3 MAD par jour").
- bundle-offers: "l'offre s'agrandit" — cards where quantity 2 adds a gift line in gold
  ("+ râpe OFFERTE") and quantity 3 adds free delivery; the gift logic IS the tele-shop move.
- countdown: a strap-styled timer — ink band, gold digits, "l'offre expire" caps label; plain
  digits, no flap tiles (souk owns those).
- stock-urgency: a single white line under the countdown or CTA — "il reste 43 unités du lot
  TV" — restrained, factual, once.
- lottery-contest: the prize segment — a bezel-framed prize photo, "chaque commande participe
  au tirage", draw date in a gold chip. Téléachat loves a tombola done as television.
- photo-reviews: "ils ont appelé" — white cards, viewer name + city, stars in gold, one
  sentence; optional small photo. Reads as call-in testimonials.
- stats-band: a blue band with three gold counters — unités vendues, note moyenne, villes
  livrées — counting up once.
- unboxing-gallery: "tout ce que vous recevez" — the full kit laid out in one bezel-framed
  flat-lay + a count chip ("9 pièces").
- order-steps: four step frames: commandez, on vous appelle, livraison 24-72h, payez à la
  porte — with a phone icon at step two (the confirmation call is reassurance theater).
- trust-footer: ink-dark band, gold phone number huge, channel badge repeated small, policies
  in white 0.8rem.

Refused blocks:
- whatsapp-proof: chat gossip breaks the broadcast frame — testimonials arrive as call-ins,
  never screenshots.
- size-guide: the studio demonstrates universal fit or one-size gadgets; measurement charts
  belong to quieter worlds.

9. HERO MENU

- Plateau Principal (bezel video hero): the demo loop in the full bezel, LIVE chip blinking,
  lower-third strap sliding under it with name + crossed value, gold CTA beneath. The
  signature opening.
- Révélation (price-reveal stack): huge Anton headline, product photo on the blue sweep, the
  crossed "valeur" price only — the real price teased as "révélé plus bas", sticky bar
  carrying it. For maximum theater.
- Duo Démo (photo-split): before-hands / after-result photos side by side inside twin thin
  bezels, strap under the pair, CTA below. The two-camera shot.
- Plateau Objet (offer-card hero): a single white offer slab on blue — product photo, name,
  gift line in gold, CTA — like the end-of-segment recap card opening the show.
- Rappel Enfance (story-hook hero): one warm sentence of the problem ("Vos soirées à éplucher
  ...") over the blue, then the product enters framed; for kids & baby and kitchen builds.
- Compte à Rebours (countdown-crown): the strap timer directly under the headline, bezel photo
  beneath; only for true limited lots.

10. FORM MENU

- Bon de Commande (single card): a white card styled as the on-screen order form — blue
  header strip "BON DE COMMANDE", stacked fields, gold CTA slab, COD line beneath. Default.
- Standard Téléphonique (multi-step wizard): 3 steps framed as the call — 1 votre offre
  (bundle pick), 2 vos coordonnées, 3 confirmation with the value tower restated mini. Step
  header shows a small headset icon.
- Écho Plateau (hero-echo): a 2-field quick strip (téléphone + ville) right under the hero
  bezel — "on vous rappelle" — repeated as the full form at the end.
- Strap-Driven: no inline CTA until the offer beat; the sticky strap is the only door to the
  form. For short, video-led episodes.

11. MOTION IDENTITY

Broadcast cuts. Entrances: straps and cards slide in on x (±60px), power3.out, 0.5s; section
content fades up 16px, 0.4s. The LIVE dot blinks with steps(1), 1s infinite — the only
permanent loop. THE signature scroll moment: on first scroll past the hero, the lower-third
strap slides under the hero bezel once (deck one then deck two, 0.12s apart) — no other
element may use a two-deck entrance. The value tower's crossed total collapses (scaleY 1 to
0.92, 0.2s) as the real price scales up once. Counters in stats-band count once. Reduced
motion: straps pre-parked, dot static red, counters at final values. Banned: crossfades
between sections, parallax, pinning, elastic/back easings, rotation loops, marquees.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji-as-design, Poppins-everything,
lorem ipsum, fake trustpilot walls, cookie-cutter icon rows with drop shadows, hero
carousels, parallax overuse, backdrop-blur.
Neighbors' tics, banned by name: phosphore's CRT scanlines (no fake-TV static, ever);
an2000's chrome text, bevels and aqua orbs; souk's starburst price badges, price-slash X
theater and split-flap countdown; maillot's diagonal slices; cinetique's telemetry voice;
kenz's spotlight cone.
Refused blocks: whatsapp-proof, size-guide.
World temptations, banned: more than one LIVE dot; scanline or static overlays; gold
dividers with no number; fake "call now" phone numbers that go nowhere (the demo number is
honest fiction, formatted real); rainbow confetti at the success state — success gets ONE
gold strap, not a party; red buttons.

13. EXAMPLE VARIATIONS

- MINUIT CUISINE (home & kitchen, 12-in-1 slicer). Plateau Principal hero with demo loop,
  then how-it-works-steps (3 macro demos), benefits-icons, value-stack tower, bundle-offers
  with grater gift, photo-reviews, order-steps, trust-footer. Bon de Commande form. Mood:
  the classic late-night slice-athon; the hero strap is the only two-deck moment.
- LOT DU SAMEDI (electronics & gadgets, steam iron station). Révélation hero — price teased,
  revealed by the tower mid-page — then stats-band, how-it-works-steps, countdown strap,
  stock-urgency line, unboxing-gallery, order-steps, trust-footer. Standard Téléphonique
  wizard. Mood: weekend mega-lot; urgency carried by strap timer, dot blinks in the badge.
- PETIT CHAMPION (kids & baby, learning tablet-toy). Rappel Enfance story hero, then
  benefits-icons, video-testimonial bezel of the toy in use, photo-reviews from parents,
  lottery-contest (draw: family trip), price-anchor tower, order-steps, trust-footer. Écho
  Plateau form. Mood: gentle prime-time family segment; gold reserved for the prize and price.
- ABDO EXPRESS (fitness equipment, ab-roller kit). Duo Démo hero (grip close-up / posture
  result), then how-it-works-steps, stats-band counting reps sold, value tower with training
  poster gift, countdown, photo-reviews, order-steps, faq, trust-footer. Strap-Driven form
  entry. Mood: the sports-hour infomercial; the tower collapse is the page's loudest beat.
- ROUTE PROPRE (car accessories, cordless car vacuum). Plateau Objet hero recap-card, then
  video-testimonial bezel demo in a car seat, benefits-icons, unboxing-gallery (9 pièces),
  price-anchor tower, bundle-offers (2nd for the second car), order-steps, trust-footer.
  Bon de Commande form. Mood: efficient afternoon segment; LIVE chip sits on the demo bezel.
- GRAND TIRAGE (home & kitchen, air fryer). Compte à Rebours hero on a true 72h lot, then
  how-it-works-steps, photo-reviews, lottery-contest (win the year of oil), value tower,
  stock-urgency, order-steps, trust-footer. Standard Téléphonique wizard with the prize
  restated at step 3. Mood: sweepstakes special; countdown strap leads, tower collapse
  arrives late as the closer.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
