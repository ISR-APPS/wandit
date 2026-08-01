import type { DesignWorld } from "../types";

export const hikaya: DesignWorld = {
	id: "hikaya",
	name: "Hikaya",
	family: "melodrama",
	tagline: "Series-finale romance: teal night, subtitles, rose gold",
	kind: "cod",
	mood: ["romantic", "cinematic", "warm", "dramatic"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["home & kitchen", "jewelry & watches", "beauty & cosmetics"],
	avoidFor: ["fitness equipment", "electronics & gadgets", "car accessories"],
	fusesWith: ["kenz", "jihaz"],
	preview: {
		ground: "#0F2A2E",
		ink: "#F6EEE3",
		accent: "#D8A48F",
		fontFamily: "Playfair Display",
		sampleWord: "حكاية",
	},
	doc: `
HIKAYA — THE SERIES FINALE

1. PHILOSOPHY

Hikaya is the last episode of the series the whole family watched: a midnight-teal room,
candlelight on copper, a line of dialogue that everyone will quote tomorrow. This world
sells objects that belong in that scene — coffee sets, jewelry, perfume for the vanity —
to the audience that lives for the drama: romance without irony, warmth without noise.
The page tells a story in episodes. Sections are numbered like a season; the important
sentences are staged as subtitles, centered on their own dark strips, as if translated
from a beloved foreign drama; the hero is framed by soft velvet curtains parting on the
product. Nothing rushes. Melodrama's secret is patience: the pause before the confession
sells harder than any siren.

The voice is the narrator's — intimate, slightly heightened, addressed to the viewer:
"في كل بيت، حكاية… وحكايتك تستاهل فنجان يليق بيها". Claims stay concrete under the
velvet: copper thickness, piece counts, delivery days. The COD spine — hook, convince,
offer, order form — is the plot armature: the hook is the cold open, the convincing is the
season, the offer is the finale, and the form is the happy ending, with pay-at-the-door
spoken like a promise kept.

Self-audit before shipping:
- Do the important lines live on subtitle strips — centered, two lines max, on their own
  dark bands, never printed over photographs?
- Are sections numbered as episodes with the small clapperboard glyph?
- Do velvet curtain vignettes frame ONLY the hero's side edges — soft, dark, asymmetric?
- Is the palette held to teal night + candle cream + rose gold, with brass as hairlines?
- Does exactly ONE signature moment exist (the subtitle strip's two-line stagger)?
- Could every headline be spoken by a series narrator without a smile of irony?
- Is the form staged as the finale — and the COD reassurance still plainly stated?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form. The season airs in order.
- Palette registers: teal night grounds #0F2A2E→#143C40; candle ink #F6EEE3; rose gold
  #D8A48F; deep rose #B3576B under 8%; brass hairlines #A98A5B.
- Type stacks: Latin display Playfair Display (600) or Cormorant; body Mulish. Arabic
  display Amiri (700); body Noto Naskh Arabic.
- The three owned tics: subtitle strips, episode chips, curtain-edge vignettes.
- Motion identity: drama fades — 0.9s, 12px rises; the subtitle two-line stagger is the
  only signature.
- Desktop law: centered mobile shell (~465px) on teal night.
- Refused blocks: lottery-contest, stock-urgency, spec-table.
- Imagery style: candlelit romantic still life per Signature Art.

CLIENT-OWNED — re-decided fresh for every build:
- Hero composition from the hero menu.
- Block choice within the supported set and BLOCK ORDER — every product deserves its own
  season arc.
- Form style from the form menu.
- Proof lead: photo-reviews, whatsapp-proof or video-testimonial — whichever witnesses the
  romance best.
- Episode count and numbering rhythm (every section or only the majors).
- Accent temperature: rose gold may warm toward copper or soften toward blush within
  register.
Every client gets a new season — same theater, different story. Reruns are failures.

3. VISUAL SIGNATURES

Measured values. Grounds: #0F2A2E base, #143C40 raised sections, #0B2023 the deepest band
(one per page). Ink: candle #F6EEE3 headings, #D9CDBC body, #B3A794 captions. Rose gold
#D8A48F for CTAs, links, episode numerals (press state #C89480); deep rose #B3576B reserved
for one emotional accent per viewport; brass #A98A5B strictly 1px hairlines and frames.
Display: clamp(30px, 8vw, 46px), Playfair's contrast given air, line-height 1.18; section
titles clamp(21px, 5.5vw, 29px); body clamp(15px, 4vw, 16.5px), line-height 1.65 Latin /
1.85 Arabic. Subtitle strips: text clamp(17px, 4.5vw, 20px) italic-permitted Latin, plain
Amiri Arabic, centered, max two lines. Radii: 12px cards; photos square inside 1px brass
frames. Shadows: none — depth is tonal (the three teal steps); candlelight glow is done
with soft radial warm gradients behind key objects, max two per page. Form fields: 54px,
raised-teal ground, 1px brass border warming to rose gold on focus (2px, no glow), labels
above in parchment; errors in deep rose with a narrator's correction ("الرقم مش كامل يا
فندم"). The sticky bar is 60px on deepest teal; its price debut is this world's law, so
the bar exists from the first scroll and never hides.

The tics, precisely:
- SUBTITLE STRIPS: a full-width band in #0B2023, 20px vertical padding, centered text in
  candle ink with the translated-drama cadence; a 1px brass rule floats 6px above and
  below the text. Used for the hook line, the turning point, and one review quote — three
  per page maximum. Never overlaid on imagery; the strip IS the stage.
- EPISODE CHIPS: small chips marking sections — a drawn clapperboard glyph (two-tone slate,
  8px) + «الحلقة ٢» in caption size, rose gold on teal. Numbering may skip minor beats but
  never repeats.
- CURTAIN-EDGE VIGNETTES: soft velvet drape silhouettes (two or three lobed folds, deep
  #0B2023 at 85% opacity fading inward) hugging the hero's left and right edges only,
  10-16% of viewport width each side, asymmetric by design. Never on other sections, never
  as letterbox bars above/below.

4. COLOR PHYSICS

Ground register: the three teal steps are the lighting plot — base scene, raised scene,
deepest night; a build chooses where its deepest band falls (usually the offer or the
final form). Ink register: candle → parchment → smoke (#F6EEE3/#D9CDBC/#B3A794); pure
white is forbidden (candles do not burn white). Accent physics: rose gold #D8A48F is the
romance metal — CTAs, numerals, key links; it may warm to copper #CE9070 or soften to
blush #E0B3A2, one temperature per build. Deep rose #B3576B appears once per viewport at
most: an accent word, a single heart-adjacent line, a price underline. Brass #A98A5B is
frames and rules only. Forbidden: gold (that is other worlds' vault money), silver, neon,
cool grays, letterbox black bars, gradients on text, and any second hue family (no blues,
no greens beyond the teal grounds themselves).

5. TYPOGRAPHY

Latin stack. Display: Playfair Display (600) — the series-title serif; Cormorant (600) as
the softer alternate. Body: Mulish (400/600). One display + Mulish per build. Italic is
permitted ONLY on subtitle strips and one emotional line. Arabic stack. Display: Amiri
(700) — the drama's calligraphic dignity; body Noto Naskh Arabic (400/600), Almarai (400)
acceptable as body alternate for colder builds. Amiri pairs with Noto Naskh by default.
Shared clamps across scripts; Arabic display ~8% smaller at the top. Arabic body
line-height 1.8-1.9; NEVER letter-spacing on Arabic; tracking allowed on Latin small-caps
labels only (0.14em). Digits: Western Arabic numerals for prices/phones (ج.م formatted
"1 450 ج.م" with an LTR span around digits); episode numerals may use Arabic-Indic ٢/٣ in
chips only. RTL: logical properties; curtains stay on both edges; subtitle strips are
symmetric; clapperboard glyph flips.

6. SIGNATURE ART & COMPONENTS

The stage set: hero framed by curtain vignettes with a warm radial candle-glow behind the
product. Components: episode chips; subtitle strips; scene cards (teal-raised cards, 1px
brass frame, 12px radius) for benefits/reviews/offer; the finale chest — the offer as the
deepest-band section with the price staged center like a title card; cast list — reviews
formatted with the reviewer's name in display as a credit; CTA — rose-gold pill, teal
text, 56px, with a 1px brass outer ring.

Imagery. Candlelit romantic still life: objects on dark wood or velvet, midnight-teal
backdrop, one warm candle-side light, soft shadows, copper and rose-gold reflections,
a velvet drape edge allowed in frame. Styling is intimate — steam from a poured coffee,
a ribbon undone — never staged sterile. No faces; hands allowed in soft focus. No text or
logos in frame. Any product in this world's niches is photographed as a scene from the
series: the object mid-story, warm, longing, precious.

7. THE SPINE

Hook, convince, offer, order form — the four-act season, invisible and locked. Price
placement law: the price does NOT appear in the hero; it debuts on the sticky bar (present
from the first scroll) and is staged fully in the finale (price-anchor) — the world's one
sanctioned suspense. The sticky CTA is a slim deepest-teal bar with brass top hairline:
price in rose gold + "اطلبي الطقم" pill; always scrolls to the form. Mobile-first 390px;
desktop is the centered mobile shell (~465px) on wide teal night with faint candle-glow
at the shell's back.

8. BLOCKS TREATMENT

Supported blocks, dressed by Hikaya:
- announcement-bar: a whisper above the curtains — one candle-ink line on deepest teal
  ("توصيل لكل المحافظات · الدفع عند الاستلام"), brass hairline beneath.
- problem-solution: the cold open — two aching lines on a subtitle strip (the pain), then
  the scene card where the product enters; episode chip «الحلقة ١».
- benefits-icons: 3-5 scene cards with thin brass-line icons (cup, flame, ring, drop) and
  short vows; never a six-pack grid.
- how-it-works-steps: the ritual in 3 scenes — numbered with episode chips, each a photo +
  one sentence.
- before-after: allowed as "قبل الحكاية / بعدها" paired photos in brass frames with a
  timeframe caption; reserved for beauty builds.
- photo-reviews: the cast — name in display (credit style), city, stars as small brass
  asterisk-stars, two lines of testimony; one may be elevated onto a subtitle strip.
- whatsapp-proof: letters from viewers — chat bubbles restyled teal/candle inside a scene
  card; timestamps kept.
- video-testimonial: the trailer — ONE muted loop or poster in a brass frame with a
  one-line caption; obeys the ≤2MB poster law.
- stats-band: quiet season numbers — "عائلة اختارت الطقم 3200+" in candle ink on the
  deepest band, no racing counters (a single settle per number).
- guarantee-seal: the vow — a scene card with a brass double-hairline frame and the
  promise: exchange window, arrival intact, pay at the door. No badges, no medals.
- price-anchor: the finale title card — deepest band, curtains absent, old price small and
  struck in smoke ink, new price center-stage in display, one deep-rose underline; the
  page's emotional peak.
- bundle-offers: two chest cards — "طقم الحكاية" / "طقم العمر" — the fuller flagged with a
  rose line "اختيار العائلات"; feeds the form.
- order-steps: the happy ending in 4 beats: تطلبي، نتصل، نوصل بعناية، تدفعي عند الباب —
  each with a thin icon and a soft line.
- faq + trust-footer: faq as brass-ruled accordions voiced by the narrator; footer on
  deepest teal — phone, WhatsApp, the series' closing line, tiny credits type.
Refused blocks: lottery-contest (love is not a raffle), stock-urgency (panic breaks the
spell), spec-table (the drama never reads a datasheet aloud).

9. HERO MENU

- The Cold Open: curtains part on the product in candle-glow, series-title name above, one
  subtitle-strip hook line beneath, CTA; price withheld (sticky carries it). The default.
- The Title Sequence: full-bleed photo top 55% with curtain edges, then a deepest-teal
  title card with name, one vow line, CTA.
- The Confession: story-hook — a two-line subtitle strip opens the page BEFORE any photo,
  then product in a brass frame, CTA; for products with a known ache.
- The Cast Reveal: variant-led — three objects staged in one candlelit scene, chips to
  choose, chosen one steps into the glow; CTA follows.
- The Trailer: video/poster hero in a brass frame with curtains, one caption line, CTA;
  for products that move.
- The Locket: split — photo end-side, start-side a stack of name, episode chip «الحلقة ١»,
  two vows, CTA; the most conventional, kept for restrained builds.

10. FORM MENU

- The Finale Card (default): one scene card on the deepest band — big labeled fields,
  rose-gold submit pill, COD vow beneath; episode chip reads «الحلقة الأخيرة».
- Two-Act Form: act one chooses the set/variant (chest cards), act two takes name, phone,
  governorate; progress shown as two clapperboards (closed = done).
- Echo of the Vow: a compact 2-field form directly under the hero for the already-devoted,
  repeated in full at the finale; both validate identically.
- The Letter: form styled as a reply card — fields framed by brass rules, submit reads
  "أرسلي الطلب" — for gift-led builds; laws unchanged.

11. MOTION IDENTITY

Drama fades: entrances 0.9s power1.out with 12px rises, staggered 120ms — scenes dissolve
in, nothing snaps. Curtains and glows are static. The ONE signature moment: subtitle
strips reveal line 1, then line 2 (0.5s apart), once per strip. Numbers settle once, no
counting races. Reduced motion: all visible, no tweens. Gated per DEMO-LAWS; gsap.set
only for hiding; the season is fully readable with JavaScript off.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name:
nocturne's letterboxed 21:9 bars, Ken-Burns scrubs and bottom-left photo captions (Hikaya
stages text on strips, never on photos); teleachat's TV bezel and lower-third straps;
kenz's spotlight cone and gold dust; cinetique's telemetry voice; impact's workout SET
labels (episode chips are drama voice, never gym voice); scoop's cover-line stacks;
jihaz's lace and bows; oud's note pyramids and flacon watermarks; hammam's steam veils.
Hikaya's own temptations, banned: subtitle strips over photographs, more than three
strips, curtains beyond the hero, letterboxing of any kind, golden glitter, violin-emoji
sentimentality in copy, and any urgency mechanics. Refused blocks restated:
lottery-contest, stock-urgency, spec-table.

13. EXAMPLE VARIATIONS

- "Fanajin El Mosalsal" — home & kitchen (copper coffee set, ar-EG). Cold Open hero;
  announce, problem (subtitle), benefits scenes, how-it-works, photo-reviews (cast),
  stats, guarantee vow, finale price-anchor, bundles, order-steps, Finale Card form, faq,
  footer. Signature strip on the hook.
- "Khatem El Wa3d" — jewelry & watches (promise ring). The Confession hero; benefits (3
  vows), photo-reviews with one elevated strip, guarantee, finale anchor with deep-rose
  underline, Two-Act Form, faq, footer — a taut 9-beat episode.
- "Parfum El Ghorba" — beauty & cosmetics (nostalgic perfume). Title Sequence hero;
  problem-solution, before-after (evening scent), whatsapp-proof letters, stats,
  guarantee, finale anchor, Echo of the Vow + full form, footer. Copper-warmed accent.
- "Sahra Set" — home & kitchen (tea glasses + tray). Cast Reveal hero; variant chips,
  benefits, video-testimonial trailer, photo-reviews, guarantee, finale, bundle chests,
  The Letter form, faq, footer. Blush-softened accent.
- "Taqm El Omr" — jewelry & watches (full gold-plated set). The Locket hero; benefits,
  unboxing-free (scenes instead), photo-reviews, stats, guarantee vow, finale anchor,
  bundles, Finale Card, footer. Deepest band reserved for the finale only.
- "Warda W Sham3a" — beauty & cosmetics (candle + rose oil duo). The Trailer hero (poster
  frame); how-it-works ritual, benefits, photo-reviews, guarantee, finale, Echo of the
  Vow, faq, footer. The quietest season, episodes numbered on majors only.
- "Miraya El Sabah" — home & kitchen (ornate vanity mirror). Title Sequence hero; problem
  (the rushed morning), benefits scenes, photo-reviews with the elevated strip carrying a
  viewer's letter, stats, guarantee vow, finale anchor with the deep-rose underline on
  "تستاهلي", bundles (mirror vs mirror + tray), Two-Act Form, faq, footer. Mood: the
  spin-off season — morning light written in the same teal night, curtains at their
  narrowest, episodes counted ١ through ٥ across the majors only.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
