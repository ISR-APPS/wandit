import type { DesignWorld } from "../types";

export const mixtape: DesignWorld = {
	id: "mixtape",
	name: "Mixtape",
	family: "retro-audio",
	tagline: "Tape-deck nostalgia: reels, windows, chunky play keys",
	kind: "cod",
	mood: ["nostalgic", "cool", "plastic", "musical"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["electronics & gadgets", "home & kitchen", "fashion & apparel"],
	avoidFor: ["beauty & cosmetics", "kids & baby", "health & wellness"],
	fusesWith: ["viral", "manette"],
	preview: {
		ground: "#1B1B1F",
		ink: "#F2F2EE",
		accent: "#37C8D6",
		fontFamily: "Righteous",
		sampleWord: "SIDE A",
	},
	doc: `
MIXTAPE — THE TAPE DECK

1. PHILOSOPHY

Mixtape is the bedroom hi-fi of 1994, dusted off and wired to a checkout. Smoked charcoal
plastic, a cyan power LED, the clack of a chunky play key — this world sells nostalgia tech
to people who remember rewinding with a pencil, and to their kids who wish they did. The page
is built like a deck: cards are cassettes, progress is a spinning reel, the CTA is a piano
key you can almost feel resist. But nostalgia is the skin, not the excuse — under the plastic
the funnel is disciplined: real specs (this world respects numbers), honest proof, price
early, form fast. The voice is warm-cool and a little wry: "rembobine tes souvenirs", "Side A:
tes années 90. Side B: ta commande." It never becomes a costume party: two deck colors, one
cream label, plastic textures — restraint keeps the joke elegant. Mixtape sells speakers,
audio gear, retro gadgets, and any object whose best argument is "they don't make them like
this anymore."

Self-audit before shipping:
- Do the cassette-window cards actually SHOW imagery through their reel windows?
- Is exactly ONE reel spinning per viewport — everything else still?
- Does the play-key CTA look mechanically pressable (front face + visible key depth)?
- Are specs treated with datasheet respect inside the retro skin — numbers in mono?
- Two deck colors only (cyan dominant or pink dominant), label cream as the third voice?
- Is the plastic texture felt (subtle noise/mold lines) without becoming grunge?
- Price early, sticky CTA reachable, thumb-sized fields, COD reassurance near the form?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The tape always plays in order.
- Palette registers: grounds #1B1B1F / #26262C; ink #F2F2EE; deck cyan #37C8D6 and tape pink
  #F26D9A (ONE dominant per build); label cream #EFE6C8.
- Type stacks: Latin display Righteous or Audiowide; body Inter; mono Space Mono for
  timestamps and specs. Arabic display Changa; body Almarai.
- The three owned tics: cassette-window cards, reel spinners, play-key CTAs.
- Motion identity "tape roll": 0.4s slides with tape-drag ease; hero reels spin up once.
- Desktop law: centered mobile shell (~450px) on smoke.
- Refused blocks: ingredients-infographic, size-guide, lottery-contest.
- Imagery style: smoky 90s product photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the hero menu.
- Block choice within the supported set, and BLOCK ORDER.
- Form style from the form menu.
- Deck dominance: cyan build or pink build (the other becomes the 10% second voice).
- Which single element spins (hero cassette reels, a progress spool, or the offer's reel).
- Section rhythm: tight EP (8 blocks) or full album (14 blocks).
Every client gets a fresh mix — same deck, new tracklist. A copied build is a bootleg and
fails the contract.

3. VISUAL SIGNATURES

Measured values:
- Grounds: #1B1B1F base, #26262C raised panels, #303038 pressed states. Label cream #EFE6C8
  for cassette labels and ONE relief section per build.
- Ink: #F2F2EE primary, 65% opacity secondary, mono digits full ink.
- Deck colors: cyan #37C8D6 / pink #F26D9A — dominant gets CTAs, LEDs, links; the other
  appears only in the cassette label stripe and small chips (≤10%).
- Display type: clamp(28px, 8vw, 44px) Righteous 400, line-height 1.15; section titles
  clamp(20px, 5.5vw, 28px); body clamp(15px, 4vw, 16px)/1.6 Inter; timestamps/specs in Space
  Mono clamp(13px, 3.5vw, 15px) ("AUTONOMIE 14:00 H").
- Radii: 14px on cassette cards (molded plastic), 8px on panels, 4px on keys.
- Borders: 1px #3A3A44 mold lines on panels; cassette cards carry a 2px #0F0F12 shell edge.
- Shadows: none floating — depth via tone steps and the play-key's pressed face.
- Plastic texture: 3% noise overlay on grounds; a single 1px highlight line along card tops.
- Spacing: sections clamp(56px, 14vw, 84px); dense 12-16px gaps inside decks.
- CASSETTE-WINDOW CARDS (tic): key cards shaped as cassettes — rounded shell, label-cream
  band with a stripe of the dominant color, and a central two-reel window (two circles joined
  by a rounded slot) whose interior is a masked photo. Screws drawn at two corners, 3px.
- REEL SPINNERS (tic): tape spools (spoked circle + tape ring) as loaders, step markers and
  progress; spin 4s linear when active; only one spins per viewport.
- PLAY-KEY CTAS (tic): primary controls as chunky deck keys — top face in dominant color,
  6px darker front face below, 1px seam; on press the face drops 2px and the front face
  compresses. A small ▶ glyph precedes the label.

4. COLOR PHYSICS

Ground register: #1B1B1F → #303038, three steps, smoke never brown. Ink register: #F2F2EE
with opacity steps. Deck physics: choose cyan or pink dominance per build; the dominant owns
CTAs, LEDs, active reels, links; the recessive owns one label stripe and ≤2 chips per
viewport; they NEVER gradient into each other. Label cream #EFE6C8 is paper: cassette labels,
the relief section, spec labels. Forbidden: neon glow effects, chrome, gradients on type or
grounds, pure black, pure white, a third accent, green "in-stock" ticks. Form errors #E2574C,
form-internal only.

5. TYPOGRAPHY

Latin stack. Display: Righteous (400) — rounded 90s confidence; Audiowide as alternate when
the client wants more circuitry in the letterforms (one per build). Body: Inter (400/600).
Mono: Space Mono for timestamps, specs, counters ("00:03:41"). Pairing rule: display for
masthead/section titles/prices; Inter for reading; Space Mono for every number that measures
something.
Arabic stack. Display: Changa (700). Body: Almarai (400/700). Mono numbers stay Latin-script
digits inside LTR spans.
Clamps shared across scripts; Arabic display 92% at the same clamp; Arabic body line-height
1.75-1.9; NEVER letter-spacing on Arabic (Latin caps 0.02-0.06em allowed). Digits: Western
Arabic numerals; phones in LTR spans under RTL; RTL mirrors logical properties, cassette
windows stay symmetric, the ▶ glyph flips to ◀.

Contrast discipline: cream-on-smoke text is reserved for labels and titles; running body
stays #F2F2EE on the two darkest grounds only, and any text over #303038 must be full ink.
The dominant color never types more than five consecutive words — it is an LED, not a pen.
When a build goes pink-dominant, cyan retreats entirely to the hero label stripe and one
chip; the reverse holds for cyan builds. This one-in-charge rule is what keeps the deck
looking engineered rather than themed.

6. SIGNATURE ART AND COMPONENTS

The cassette-window card is the hero container: the product photo lives behind the two-reel
window like a tape you can almost eject. Use it for the hero and at most two more cards
(offer, one proof) — the shape dilutes fast. Reel spinners mark how-it-works steps (static
spools; the active one spins) and the order-steps rail. Play-keys: primary CTA everywhere;
secondary actions are flat cream text-links — never two keys side by side. Supporting cast:
spec plates (raised #26262C panels with mono values), label-cream strips with typewriter-feel
titles, LED dots (2px dominant-color circles) marking active states, and a thin tape-line
divider (a 2px line that loops into a small spool at one end).

The cassette label follows one template page-wide: a cream band, a thin dominant-color
stripe, handwritten-free typed titles (Righteous small, never script), and a mono index
number at the end ("A1", "B2") — sections may carry these indexes as quiet furniture. LED
dots signal state everywhere state exists: active step, selected shell, playing reel; a dot
is 2px, never glows, and turns recessive-color when idle. The tape-line divider may loop
into its spool only at ONE end — a line with two spools is a route, and routes belong to
another world. Panels stack tight like rack units: when two panels touch, they share a
single 1px mold line, never a gap smaller than 12px.

Imagery: smoky 90s audio photography. Charcoal-to-graphite backdrop, hard-ish key light with
a cyan or pink gel edge (match the build's dominant), scattered cassettes and coiled tape as
props, visible plastic sheen and mold lines, slight film grain; product angles frontal and
proud like a catalog shelf. Hands allowed pressing keys, never faces. Banned in photos: neon
signage, vaporwave grids, chrome text props, modern minimal white voids, CRT screens.

7. THE SPINE

Hook, convince, offer, order form — the four tracks, always in order, invisible to the
buyer. Price placement: EARLY IN THE HERO on the cassette label — the hero card's cream label
carries product name + price stripe; no scrolling to learn the number. Sticky CTA: a bottom
deck bar (#26262C, 1px mold line) with mono price at the start side and a play-key at the end
side; visible after the hero, always scrolls to the form. Mobile-first at 390px; desktop is
a CENTERED MOBILE SHELL (~450px) floating on smoke #141418 with a faint tape-line running
down each margin.

8. BLOCKS TREATMENT

Supported blocks, dressed by Mixtape:
- announcement-bar: a thin label-cream strip, ink text, mono delivery promise ("LIVRAISON
  24-72H · COD"), one LED dot.
- benefits-icons: 4-6 chips on raised panels, drawn line icons (waveform, battery, bluetooth
  wave), one-word labels; the lead benefit may sit in a cassette card.
- how-it-works-steps: 3 steps with reel markers — pair, play, party; the active reel spins;
  mono step numbers ("01").
- spec-table: the deck's back panel — mono rows (AUTONOMIE 14 H · BLUETOOTH 5.3 · 30 W),
  hairline #3A3A44 rules, values right-aligned; treated with full seriousness.
- stats-band: a label-cream section with three mono counters (unités vendues, heures
  d'écoute, note) — counts up once.
- photo-reviews: review cards as mini cassette labels — name on the label line, stars as
  LED dots, short text in Inter; one customer photo max per build.
- comparison-table: "BT-90 vs enceinte jetable" — check/cross matrix on a raised panel,
  mono values, no mockery in copy (confidence, not sneering).
- variant-gallery: colorways as cassette shells in a row (cyan shell / pink shell / smoke
  shell), selected shell gets the LED dot; feeds the form.
- unboxing-gallery: "dans la boîte" — flat-lay photo + mono list (câble jack, USB-C, dragonne)
  with tape-line connectors.
- guarantee-seal: a cassette label stamped "GARANTIE 12 MOIS" with a small reel glyph;
  exchange promise in one line; never a wax seal, never a rosette.
- price-anchor: the big label — old price struck in recessive color, new price in display
  type, "économise" line in mono; play-key CTA directly beneath.
- order-steps: 4 reel-marked steps: commande, appel, livraison, paiement à la porte.
- faq: plain hairline accordions, mono Q numbers ("Q1"), Inter answers.
- trust-footer: deck-bottom — smoke ground, phone + WhatsApp huge in mono, "depuis 2019"
  label line, one last tape-line divider.
Refused blocks: ingredients-infographic (nothing to dose), size-guide (nothing to fit),
lottery-contest (a deck is not a casino).

9. HERO MENU

- Face A: the flagship — a giant cassette-window card holding the product photo, label with
  name + price, play-key CTA beneath; reels spin up on load.
- Le Rack: split hero — headline and price stack left, product photo right on a raised
  panel; a small static cassette badge marks the corner; stacks cleanly at 390.
- Rembobine: story-hook hero — one wry nostalgic line in display type ("Ils n'en font
  plus. Nous, si."), product beneath, price on a cream label chip, key CTA.
- La Régie: spec-led hero — product photo above a three-cell mono spec strip (watts, heures,
  connexion), price and key CTA; for gear-heads.
- Double Face: offer-card hero — Side A (the product) and Side B (the bundle/gift) as two
  half-cards, price plaque between them; for builds with a strong second offer.
- Plein Volume: full-bleed photo hero, headline overlaid on the smoke zone, label-chip price
  pinned bottom-start, key CTA riding the first sticky bar appearance.

10. FORM MENU

- La Face B (single card): one raised panel styled as the tape's B-side label — cream header
  strip ("Ta commande"), stacked fields, play-key submit, COD line in mono beneath.
- L'Enregistrement (two-step wizard): step 1 colorway + quantity (cassette shells select),
  step 2 name + phone + city; a reel fills as progress; summary restates mono total.
- L'Éjection Rapide: compact 2-field echo (phone + city) under the hero for the decided,
  full La Face B at the end; echo submit scrolls down.
- Le Comptoir Deck: sticky-bar-driven — the bar's play-key opens the form with the first
  field focused; for short EP builds.

11. MOTION IDENTITY

Tape roll: entrances slide 24-32px with 0.4s power2.out plus a 0.05s linear tail (the
tape-drag). Reels: the signature — the hero cassette's two reels spin up once on load (0 to
4s-linear loop for 2 turns, then stop; under reduced-motion they never move). Play-keys
depress 2px on press with a 0.12s steps(2) clack. Counters count once. NO parallax, no
glow pulses, no marquees, no overshoot. Dual-visibility law absolute: gsap.set only, page
complete without JS.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji-as-design, Poppins-everything,
lorem ipsum, fake trust walls, cookie-cutter icon rows, hero carousels, parallax overuse,
backdrop-blur, back.out overshoot. Neighbor tics banned by name: an2000's chrome text, glossy
aqua orbs and lens flares; huitbit's pixel sprites and game-HUD furniture (no health bars,
no PRESS START); phosphore's CRT scanlines, typed reveals and prompt furniture; turbo's
gauge meters and rocker switches; teleachat's TV bezel and lower-thirds; impact's lime
duotone; manette's RGB conic sweep and chamfers; viral's caption pills and split-screens.
Mixtape's own temptations, banned: vaporwave sunsets, cassette wallpaper patterns, more than
one spinning reel per viewport, chrome or metallic type, "retro" as an excuse for unreadable
contrast. Refused blocks restated: ingredients-infographic, size-guide, lottery-contest.

13. EXAMPLE VARIATIONS

- "BT-90 Boombox" — electronics & gadgets, en-AE. Face A hero (cyan build); order:
  announcement, hero, benefits-icons, spec-table, photo-reviews, comparison-table,
  guarantee-seal, price-anchor, order-steps, order-form (La Face B), faq, trust-footer.
  Reels spin on hero only. Mood: flagship nostalgia.
- "Platine Poche" — electronics & gadgets, mini turntable. Le Rack hero (pink build); order:
  announcement, hero, how-it-works-steps, spec-table, stats-band, photo-reviews,
  guarantee-seal, price-anchor, order-form (L'Enregistrement), faq, trust-footer. Mood:
  collector's joy.
- "Casque Studio 94" — electronics & gadgets. La Régie hero (cyan); order: announcement,
  hero, spec-table, benefits-icons, comparison-table, photo-reviews, unboxing-gallery,
  guarantee-seal, price-anchor, order-form (L'Éjection Rapide), faq, trust-footer. Mood:
  serious listening.
- "Radio Cuisine Rétro" — home & kitchen. Rembobine hero (pink); order: announcement, hero,
  benefits-icons, variant-gallery (3 shells), photo-reviews, stats-band, guarantee-seal,
  price-anchor, order-form (La Face B), faq, trust-footer. Mood: Sunday kitchen.
- "Tee 'Side A'" — fashion & apparel, graphic tee. Plein Volume hero (cyan); order:
  announcement, hero, variant-gallery (colors), photo-reviews, stats-band, guarantee-seal,
  price-anchor, order-form (Le Comptoir Deck), faq, trust-footer. Mood: merch drop, calm.
- "Pack Duo Enceintes" — electronics & gadgets. Double Face hero (pink); order: announcement,
  hero, benefits-icons, spec-table, photo-reviews, comparison-table, guarantee-seal,
  price-anchor (bundle math in mono), order-steps, order-form (L'Enregistrement), faq,
  trust-footer. Mood: party physics.
- "Réveil Flip 84" — home & kitchen, retro flip clock. La Régie hero (cyan); order:
  announcement, hero, spec-table (heures d'autonomie, snooze, luminosité), benefits-icons,
  photo-reviews, unboxing-gallery, guarantee-seal, price-anchor, order-form (La Face B),
  faq, trust-footer. The reel spinner marks the how-it-works-free build's order-steps
  instead. Mood: waking up in 1994, on purpose.
These show the range. NEVER copy one — remix their choices or invent a new variation in the
same spirit.
`,
};
