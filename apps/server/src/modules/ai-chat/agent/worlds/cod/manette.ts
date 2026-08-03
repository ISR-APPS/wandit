import type { DesignWorld } from "../types";

export const manette: DesignWorld = {
	id: "manette",
	name: "Manette",
	family: "gamer-arena",
	tagline: "Arena-rig energy with RGB held in borders",
	kind: "cod",
	mood: ["energetic", "angular", "immersive"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["electronics & gadgets", "car accessories"],
	avoidFor: [
		"beauty & cosmetics",
		"health & wellness",
		"jewelry & watches",
		"kids & baby",
	],
	fusesWith: ["circuit", "turbo", "viral", "mixtape"],
	preview: {
		ground: "#0D0D13",
		ink: "#EFEFFA",
		accent: "#8B5CF6",
		fontFamily: "Chakra Petch",
		sampleWord: "GG WP",
	},
	doc: `
MANETTE — THE WORLD DOC

1. PHILOSOPHY

Manette is the arena rig at midnight: a matte-black setup desk, hardware with cut corners, and
color that lives ONLY where the machine breathes — in the light strips. This world sells to the
player: someone who reads latency numbers for pleasure, who respects gear that looks engineered,
and who can smell try-hard cringe from three viewports away. So Manette's law is restraint
inside energy. The page is near-black and disciplined; the RGB exists, but it is CONTAINED —
held inside border rings and light seams, never splashed across text, never fogging the page in
neon haze. Like a good gaming chassis: black metal, cut at 45 degrees, with one animated ring
telling you it's alive.

The second law is respect for the buyer's intelligence. Gamers are the most spec-literate COD
audience in the market. Manette convinces with numbers dressed as equipment — driver size,
battery hours, latency ms — and with the social proof of the squad, not with adjectives. The
voice is confident, quick, a little competitive ("ton setup mérite mieux"), never corporate,
never pretending to be a teenager.

Self-audit checklist — answer YES to ship:
- Is every RGB pixel on the page inside a border ring, seam, or the photography itself?
- Do all cards and buttons share the same chamfer geometry (one cut size, one angle)?
- Could a player quote three hard numbers about the product after one scroll?
- Is text 100% flat color — zero glow, zero gradient fills on type?
- Is there exactly ONE conic sweep visibly animating per viewport?
- Does the page work as pure black-and-violet if every sweep froze?
- Is the voice competitive-friendly without slang overdose?
- Fully readable with JavaScript off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The rig never reorders its boot
  sequence.
- Palette registers: grounds #0D0D13 / #14141C; ink #EFEFFA; RGB (violet #8B5CF6, cyan
  #22D3EE, magenta #F43F5E) ONLY inside conic sweeps and photographic glow; flat violet
  #8B5CF6 as the single text/UI accent.
- Type stacks: display Chakra Petch or Rajdhani; body Inter or Barlow; Arabic display Changa,
  body Almarai.
- The three owned tics: RGB conic border sweep, chamfer panels, loadout chips.
- Motion identity: power-up — 0.3s expo.out slides, slow-rotating sweeps, the form-in-view
  sweep acceleration signature.
- Desktop law: responsive expansion, max 1100px, hero splits into photo + stack.
- Refused blocks: before-after, size-guide, ingredients-infographic.
- Imagery style: esports gear photography on matte black (full spec in Signature Art).

CLIENT-OWNED — re-decided fresh, every build:
- Hero composition from the hero menu.
- Block choice and BLOCK ORDER from the supported set — a headset page and an RGB car-kit
  page run different rundowns.
- Form style from the form menu.
- Proof lead: stats-band or photo-reviews or video-testimonial.
- Which single element carries the hero's conic sweep (photo frame, CTA, or offer panel —
  never more than one in the first viewport).
- Section rhythm: tight esports cuts or a slower cinematic build.

Every client gets a new loadout, never a copy of someone else's save file.

3. VISUAL SIGNATURES

Grounds: #0D0D13 base, #14141C raised panels; a build may push panels to #191926. Ink #EFEFFA;
secondary text ink at 65% opacity. Accent: flat violet #8B5CF6 for links, labels, selected
states. RGB trio (violet #8B5CF6, cyan #22D3EE, magenta #F43F5E) appears ONLY inside conic
sweeps.

Type scale: display clamp(2rem, 8vw, 3.1rem) Chakra Petch 600/700, uppercase, tracking 0.02em;
Arabic display Changa 700 at 92% size, no tracking. Section titles clamp(1.35rem, 5.5vw,
1.9rem). Body clamp(0.95rem, 4vw, 1.05rem), line-height 1.6 Latin / 1.75 Arabic. Spec numerals
clamp(1.5rem, 6vw, 2.2rem) Chakra Petch.

Shapes: THE CHAMFER — one corner cut per element family: cards clip-path a 14px 45-degree cut
on top-right and bottom-left corners (two cuts, diagonal twins); buttons cut 10px on the same
corners; chips cut 6px on top-right only. One cut size per element family, page-wide. Radius
elsewhere: 0 — chamfers replace rounding. Borders: 1px #2A2A38 on resting panels. Shadows:
none — depth comes from panel tone steps, not shadow.

The tics, precisely:
- RGB conic sweep: a 2px border ring built from a conic-gradient (violet, cyan, magenta,
  violet) rotating via a CSS custom-property angle animated by GSAP, wrapped around ONE key
  element per viewport (hero frame, offer panel, or CTA). Rotation 6s linear loop default.
  Under reduced motion the sweep freezes at 30 degrees.
- Chamfer panels: the cut-corner geometry above; the cut edges may carry a 1px violet seam on
  the chamfer line itself (the light escaping the joint).
- Loadout chips: variant options as 64x64 squared slot chips, 6px top-right cut, 1px border;
  the equipped chip gets the violet seam + a small corner check notch; unequipped chips sit
  at 60% opacity. Tapping swaps the hero image where relevant.

Spacing: sections 56-72px vertical padding mobile; panels sit dense inside sections with
12-16px gaps — hardware racked tight.

4. COLOR PHYSICS

Ground register: #0D0D13 to #191926, three tone steps max per build (base, panel, raised);
steps ARE the depth system. Ink register: #EFEFFA full, 65% secondary, 40% only for legal
lines. Accent physics: flat violet #8B5CF6 is the ONLY colored ink — labels, prices may take
it, links take it; a build may swap the flat accent to cyan #22D3EE (then violet leaves text
entirely — one accent, never two). The RGB trio lives exclusively inside conic sweeps and
photography glow; if a sweep color appears as a fill, a text color, or a divider, the build
fails. Forbidden: green (no fake "in stock" neon), red as ground (magenta lives in sweeps
only), white sections (Manette never goes light), pastels, gradients on text or grounds
(the vignette-free black is the brand).

5. TYPOGRAPHY

Latin stack: display Chakra Petch (first — its squared terminals ARE the chamfer language) or
Rajdhani 600/700; body Inter 400/600 or Barlow 400/600. Numbers: font-variant-numeric tabular
for specs and prices. Arabic stack: display Changa 700 (angular, condensed — the Arabic
counterpart of Chakra's geometry); body Almarai 400/700. Pairing rule: display for titles,
labels and numerals; body never bolds above 600.

Clamps shared across scripts (Arabic display 92%); Arabic body line-height 1.75-1.9; NEVER
letter-spacing on Arabic (Latin caps may take 0.02-0.04em). Digits: Western Arabic numerals
for specs, prices, phone; phone wrapped LTR. RTL: logical properties; chamfer cuts mirror
(top-right cut becomes top-left); sweep rotation direction reverses; loadout chip check
notches swap corners.

6. SIGNATURE ART AND COMPONENTS

The conic sweep ring is the world's heartbeat — one per viewport, always circling something
that matters (the product frame, the offer, the CTA). Supporting cast: spec plates (chamfered
panels pairing a Chakra numeral with a unit label — "40h AUTONOMIE", "35ms LATENCE");
squad-review cards (chamfered, gamertag + city + stars, one-line verdicts); seam dividers
(a 1px violet line with a 12px gap-break at its center — the cable gap — between sections);
mission labels (small violet caps tags like "ÉQUIPEMENT", "LE VERDICT DU SQUAD" heading
sections); the CTA — a chamfered slab, violet fill, ink-dark text, 56px min height, the ONLY
filled-accent element at rest; its sweep ring activates on form-in-view.

Imagery: esports gear photography. Matte black setup desk, the product floating or angled on
dark acrylic, violet and cyan LED glow from within the scene (the photography carries the RGB
mood so the UI doesn't have to), dramatic low-key studio, sharp macro passes on textures
(earcup foam, switch caps, cable braid), slight haze acceptable IN PHOTOS only. Consistent
glow hues across all shots of a build. Banned in photos: daylight, white sweeps, hands with
painted nails, faces, visible brand text, rainbow-vomit RGB — two glow hues max. This spec
reproduces for any product: headsets, keypads, car LED kits, dash cams.

7. THE SPINE

Hook, convince, offer, order form — the boot sequence is sacred. Price placement: EARLY-HERO —
the price sits in the hero inside a spec plate (price-as-spec: "12 900 DA" next to "40h"), flat
violet; gamers respect a stated number and distrust hidden ones. Sticky CTA: a floating
chamfered pill, bottom-inline-end, violet fill with the price short-form; it docks after the
hero scrolls past and its ring activates while the form is on screen; tap scrolls to the form.
Mobile-first at 390px. Desktop law: RESPONSIVE EXPANSION — max 1100px; the hero splits
photo-left / stack-right, spec plates rack into rows of four, panels keep their chamfer
geometry at all widths. Manette is the rare COD world that widens, because rigs live on
desktops too.

8. BLOCKS TREATMENT

Supported blocks, dressed:
- announcement-bar: a thin #14141C strip, violet caps micro-text — drop window, free-delivery
  threshold — with the seam divider beneath it.
- spec-table: the core convince block — chamfered datplate rows... no, plates: a grid of spec
  plates (numeral + unit + label), 2 columns mobile / 4 desktop. Hard numbers, no adjectives
  inside plates.
- benefits-icons: mission chips — 4-6 chamfered chips, line icon + two-word label ("SON 7.1",
  "MICRO ANTI-BRUIT"); one row scrollable on mobile.
- variant-gallery: the loadout dock — loadout chips for colors/editions; equipped chip swaps
  the hero/section image and writes the choice into the form.
- stats-band: squad numbers — a panel with three Chakra counters (joueurs équipés, note
  moyenne, wilayas livrées) counting up once, violet labels.
- photo-reviews: le verdict du squad — chamfered cards, gamertag + first name + city, stars
  in flat violet, one-line verdicts ("aucun lag, gg"). Optional setup photos.
- video-testimonial: the product loop inside a chamfered frame wearing the viewport's sweep
  ring; caption as a mission label. Muted, short, poster-backed.
- whatsapp-proof: squad chat — a chamfered dark panel recreating a group-chat thread (drop
  confirmations, "commandé x2"), timestamps, no green branding — bubbles in panel tones.
- price-anchor: the offer plate — a chamfered panel wearing the sweep ring: old price struck
  in 65% ink, real price in Chakra violet at double size, per-week math small ("moins de
  300 DA/semaine"), COD line beneath.
- bundle-offers: duo queue — 1x/2x cards (second unit -20% "pour ton duo"), chamfered,
  equipped-state selection feeding the form.
- countdown: drop timer — a spec-plate row where the numerals ARE the timer (HH : MM : SS in
  Chakra tabular), label "LA FENÊTRE SE FERME"; no flap tiles, no circular dials.
- stock-urgency: a seam-divided line — "restock épuisé à 87%" with a thin violet depletion
  bar; factual, once per page.
- unboxing-gallery: le contenu du colis — a chamfered flat-lay photo + item list with violet
  square bullets, count chip "6 pièces".
- order-steps: la séquence — four chamfered steps: commande, appel de confirmation, livraison
  24-72h, paiement à la réception; step numerals in Chakra.
- faq: chamfered accordion rows, violet plus-mark rotating to close; questions in display
  caps 0.95rem.
- trust-footer: base-tone band — brand tag, phone/WhatsApp in Chakra (tappable), policies at
  40% ink, one last seam divider above.

Refused blocks:
- before-after: gear has no transformation arc — it has specs; the split-photo trope reads
  as cosmetics, not hardware.
- size-guide: one-size equipment; a measurement chart would cosplay apparel.
- ingredients-infographic: molecules belong to labs; Manette's X-ray is the spec plate.

9. HERO MENU

- Boot Screen (price-first stack): mission label "NOUVEAU DROP", product name in Chakra,
  photo on black with its glow, THE spec-plate row (price plate + 2 key specs), CTA. The
  sweep ring lives on the photo frame.
- Split Rig (photo-split): photo inline-start, stack inline-end (name, three plates, CTA);
  on mobile the photo leads full-width. Sweep ring on the CTA here — never two rings.
- Killcam (video hero): the muted product loop in a chamfered ringed frame, name + price
  plate over it, CTA below. For gear that moves (lights, mechanisms).
- Loadout First (variant-led hero): the loadout dock sits directly under the name; equipping
  swaps the hero photo; price plate updates per edition. For multi-edition drops.
- Offer Plate Hero: the price-anchor offer plate IS the hero centerpiece — ring on the
  plate, photo behind at 40% scale-depth. For aggressive price-led drops.
- Squad Story (story-hook): one competitive line ("Ton duo entend tout. Pas toi.") in
  display caps, then photo + price plate + CTA. For pain-point-led sells.

10. FORM MENU

- Terminal Unique (single card): one chamfered panel — mission label "PASSE TA COMMANDE",
  stacked fields (dark inputs, 1px borders, violet focus seam), CTA slab; COD reassurance
  as three micro-plates beneath (paiement à la livraison, 24-72h, retour 7j).
- Checkpoint Wizard (multi-step): three chamfered steps — 1 ton loadout (variant + qty),
  2 tes coordonnées, 3 GG — confirmation recap with price plate; progress as three seam
  segments filling violet.
- Écho Rapide (hero-echo): a 2-field quick panel (téléphone + wilaya) docked under the hero
  plates, repeated full-size at page end; the echo submits by scrolling to the full form
  with fields carried over.
- Dock-Driven: the sticky pill is the sole entry; tapping it slides the form section into
  view with the first field focused. For short cinematic builds.

11. MOTION IDENTITY

Power-up. Entrances: y or x 20px slides, expo.out, 0.3s, stagger 0.05s — hardware clicking
into the rack. Conic sweeps rotate 6s linear, ONE visible per viewport. Counters count once,
fast (0.8s). THE signature scroll moment: while the order form is in view, the CTA/form
sweep ring accelerates from 6s to 1.5s rotation — the rig going hot; no other element may
change speed on scroll. Loadout equips swap images with a 0.15s fade-through-black.
Reduced motion: sweeps frozen at 30 degrees, entrances instant, counters at final value.
Banned: glow pulses on text, parallax, pinning, screen-shake, elastic/back easings, hue-
rotation on grounds, typing effects.

12. BAN LIST

Generic slop: purple-blue gradients on white, glassmorphism, emoji-as-design, Poppins-
everything, lorem ipsum, fake trustpilot walls, cookie-cutter icon rows, hero carousels,
parallax overuse, backdrop-blur.
Neighbors' tics, banned by name: voltage's neon-tube type, electric beam lines and glowing
glass panels; huitbit's pixel sprites and game-HUD furniture — no score counters, no health
bars, no PRESS START, no level-select cards; phosphore's typed-text reveals, prompt-line
furniture and blinking block cursor; an2000's chrome text and glossy orbs; iris's
aurora-hairline capsule (static 1px gradient-stroke pill) — Manette's ring is always an
ANIMATED rotating conic sweep, never a static gradient hairline; maillot's
diagonal slice transitions; circuit's feature leader lines, PCB traces and datasheet strip
(Manette's plates are chunky hardware, never hairline document rows).
Refused blocks: before-after, size-guide, ingredients-infographic.
World temptations, banned: RGB anywhere outside sweeps and photos; two rings in one
viewport; "gamer fuel" clichés and skull iconography; fake FPS counters; Discord-purple
full-bleeds; lens flares; dark-mode gray-on-gray body text below 65% ink.

13. EXAMPLE VARIATIONS

- DROP CASQUE (electronics & gadgets, wireless headset). Boot Screen hero, then
  announcement-bar, spec-table (6 plates), benefits-icons, photo-reviews, price-anchor,
  bundle-offers duo, order-steps, faq, trust-footer. Terminal Unique form. Mood: flagship
  drop night; the hero photo wears the ring, form ring goes hot at the end.
- DOUBLE FILE (electronics & gadgets, gaming keypad + mouse combo). Loadout First hero
  (three editions), then stats-band, spec-table, whatsapp-proof squad chat, unboxing-
  gallery, price-anchor, order-steps, trust-footer. Checkpoint Wizard. Mood: choose-your-
  loadout energy; equips do the theater, sweep stays calm on the offer plate.
- NUIT LED (car accessories, interior LED kit). Killcam hero — the light loop sells it —
  then benefits-icons, variant-gallery (couleurs en loadout chips), video caption
  stats-band, price-anchor, countdown drop timer, order-steps, faq, trust-footer. Écho
  Rapide form. Mood: midnight parking-lot glow; photography carries cyan, UI stays violet.
- VISION ROUTE (car accessories, dash cam). Split Rig hero, then spec-table (capteur,
  angle, nuit), how-it-works via order-steps merged rundown, photo-reviews from drivers,
  unboxing-gallery, price-anchor, stock-urgency, trust-footer. Terminal Unique form. Mood:
  practical operator gear; ring sits on the CTA, page runs quieter, no countdown.
- SQUAD GOALS (electronics & gadgets, controller). Squad Story hero ("Ton pouce mérite
  mieux."), then benefits-icons, spec-table, whatsapp-proof, bundle-offers duo queue,
  price-anchor, order-steps, faq, trust-footer. Dock-Driven form. Mood: competitive banter;
  the dock pill is the page's pulse, stats-band absent.
- FENETRE 48H (electronics & gadgets, mechanical keyboard drop). Offer Plate hero — price
  leads — then countdown timer plates, spec-table, photo-reviews, loadout switches
  (switch types as variant-gallery), unboxing-gallery, order-steps, trust-footer.
  Checkpoint Wizard with timer restated at step 3. Mood: limited window, honest scarcity;
  the offer plate ring is the page's only accelerating element.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
