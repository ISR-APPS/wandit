import type { DesignWorld } from "../types";

export const warqa: DesignWorld = {
	id: "warqa",
	name: "Warqa",
	family: "papercraft",
	tagline: "Cut paper, fold creases and layered craft",
	kind: "cod",
	mood: ["crafted", "layered", "soft", "inventive"],
	energy: "quiet",
	priceFeel: "accessible",
	industries: ["home & kitchen", "kids & baby", "electronics & gadgets"],
	avoidFor: ["fitness equipment", "car accessories", "jewelry & watches"],
	fusesWith: ["doudou", "crochet"],
	preview: {
		ground: "#F6F3EC",
		ink: "#2B2B33",
		accent: "#E8846B",
		fontFamily: "Sniglet",
		sampleWord: "ورقة",
	},
	doc: `
WARQA — THE CUT-PAPER PAGE

1. PHILOSOPHY

Warqa is a page made with scissors and glue: sheets of tinted paper cut into hills and
windows, stacked so every layer's edge shows, creased where a fold once lived, with little
tabs left on the shapes as if they were paper-doll clothes waiting to be dressed. It is
craft-table honesty applied to selling: nothing glossy, nothing chrome, everything
touchable. The world suits objects that reward gentleness — lamps, nursery things, clever
little gadgets — and buyers who smile at handmade wit. Where other quiet worlds calm with
emptiness, Warqa calms with CARE: each layer deliberately placed, each silhouette cleanly
cut, each crease pressed with a ruler's edge.

The material law is absolute: paper only. Depth comes from stacked cut sheets, never from
shadowscapes; decoration is silhouette, never illustration with outlines; interaction is
folding, tab-dressing, layer-sliding. Photography sits INSIDE cut windows like pictures
glued into a scrapbook made by a careful hand. The voice is a maker's voice — modest,
precise, a little delighted: "طوى، اضغط، ضوّي" — and every claim is concrete because craft
does not exaggerate. The COD spine — hook, convince, offer, order form — is the spine of
the paper book itself: page one hooks, the middle pages convince, the last spread offers,
and the form is a reply card cut to fit its envelope, with pay-at-the-door stated plainly.

Self-audit before shipping:
- Are section boundaries genuine layer-stacks — 2-3 tonal sheet edges visible — never a
  single wavy line?
- Do cards show their fold: one diagonal crease highlight + one lifted corner?
- Are variants dressed with paper-doll tabs (fold-over tabs), never plain chips?
- Do photos live inside cut windows with a visible paper rim?
- Is the layer hue family ONE family (corals OR teals OR ochres) plus kraft?
- Is there exactly ONE fold-lift signature moment, on the offer card?
- Does nothing pretend to be torn, taped, pinned or peeled?
- Zero horizontal overflow at 390 / 768 / 1440; fully readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook, convince, offer, order form — the book reads in order.
- Palette registers: base paper #F6F3EC; ONE layer-hue family per build (e.g. corals
  #E8846B / #F2A98F / #FBD9CB, or teals #4E8F87 / #7FB5AE / #C4E0DC, or ochres); ink
  #2B2B33; kraft #D8C7AC as the back layer.
- Type stacks: Latin display Sniglet or Baloo 2; body Mulish. Arabic display Baloo
  Bhaijaan 2; body Almarai.
- The three owned tics: layer-stack cutouts, fold-crease panels, paper-doll tabs.
- Motion identity "paper theater": tiny layer parallax, one fold-corner lift.
- Desktop law: centered mobile shell (~455px) on base paper.
- Refused blocks: countdown, whatsapp-proof, video-testimonial.
- Imagery style: paper-craft photography per Signature Art.

CLIENT-OWNED — re-decided fresh for every build:
- Hero composition from the hero menu.
- Block choice within the supported set and BLOCK ORDER.
- Form style from the form menu.
- The layer hue family (corals, teals, ochres…) and where kraft shows.
- Which silhouettes the cut edges draw (hills, waves, house roofs, stars) — the cut
  vocabulary belongs to the client's product story.
- Proof emphasis: photo-reviews or stats or unboxing.
Every client's book is cut fresh — same scissors, new shapes. Tracing an old page fails.

3. VISUAL SIGNATURES

Measured values. Base paper #F6F3EC with a barely-there fiber grain (≤3% noise). Layer
sheets in the chosen family: primary #E8846B, light #F2A98F, pale #FBD9CB (coral default);
kraft #D8C7AC appears as the deepest layer. Ink #2B2B33; secondary #565664; captions
#8A8A96. Display type: clamp(28px, 7.5vw, 42px), Sniglet's rounded paper-cut friendliness,
line-height 1.2; section titles clamp(20px, 5.5vw, 27px); body clamp(15px, 4vw, 16.5px),
line-height 1.6 Latin / 1.8 Arabic. Prices clamp(22px, 6vw, 30px) on a small cut-paper
tag shape (rectangular tag with one clipped corner — never a swing tag on string). Radii:
cut paper has soft 6px corners; windows 10px. Layer edges: each stacked sheet shows a 6-14px
edge of the sheet below, cut in a gentle silhouette; edges carry a 1px darker self-tone
line (the cut shadow), NEVER a blurred drop shadow. Fold-crease: a diagonal 1px highlight
+ 1px shade pair across a card corner region, plus one corner visually lifted (a small
folded triangle with its underside in the lighter tone).

Form fields: 54px height, drawn as glued label rectangles — base-paper fill, 1px cut-
shadow line, labels above in secondary ink; focus thickens the cut line to 2px in the
primary tone (no glow); errors speak on a small pale tag beneath the field ("الرقم ناقص")
— never red, the primary tone darkened carries the correction. The sticky bar is 58px
with its silhouette edge adding 8px above.

The tics, precisely:
- LAYER-STACK CUTOUTS: section boundaries built from 2-3 stacked sheet edges (pale over
  light over primary, kraft deepest), each edge a clean cut silhouette 6-14px apart. The
  silhouette vocabulary is client-chosen but consistent page-wide.
- FOLD-CREASE PANELS: content cards rendered as folded-open sheets — one diagonal crease
  (highlight+shade hairlines) and ONE lifted corner (12-20px triangle) per card; lifted
  corners alternate sides down the page.
- PAPER-DOLL TABS: variant/option elements carry 2-3 small fold-over tabs on their top
  edge (8×14px, folded flat in the darker tone); the selected option's tabs fold DOWN
  (visible), unselected tabs stand up (outline). Feeds the form.

4. COLOR PHYSICS

Ground register: base paper everywhere; sections differentiate by which layer tone their
sheet uses — a build maps its funnel beats to depths (hook on pale, offer on primary,
form on kraft, for instance). Ink register: #2B2B33 → #565664 → #8A8A96; pure black
forbidden (ink on paper is soft). Accent physics: the PRIMARY layer tone doubles as the
accent — CTAs, selected tabs, price tags — so the page never imports a foreign accent;
within-register temperature drift allowed (coral may lean peach or clay). Kraft is
structure, never text. Forbidden: any second hue family, gradients (paper is flat),
glossy highlights, drop shadows with blur beyond 0 (cut shadows are 1px lines), black
sections, and metallics.

5. TYPOGRAPHY

Latin stack. Display: Sniglet (800) — rounded like scissor-cut letters; Baloo 2 (700) as
the alternate when more weight is needed. Body: Mulish (400/600). One display + Mulish.
Labels 11-12px uppercase Latin tracked 0.12em. Arabic stack. Display: Baloo Bhaijaan 2
(700) — the rounded Arabic sibling; body Almarai (400/700). Pairing fixed: Baloo Bhaijaan
2 + Almarai. Shared clamps; Arabic display ~8% smaller at top end. Arabic body line-height
1.75-1.9; NEVER letter-spacing on Arabic. Digits: Western Arabic numerals; phone in an
LTR span. RTL: logical properties; lifted corners mirror (alternation preserved); tabs
sit on the top edge in both directions; layer silhouettes are direction-neutral.

6. SIGNATURE ART & COMPONENTS

The master component is the SHEET: everything — cards, tags, buttons, the form — is a cut
sheet with visible edges and honest folds. Components: window frames (photos inside cut
windows with an 8-12px paper rim in the light tone); price tags (clipped-corner cut
tags); tab selectors (paper-doll tabs on variant cards); step sheets (numbered small
sheets for how-it-works, the number inside a cut circle); the reply-card form (kraft
sheet, fields as lighter inset rectangles like glued labels); CTA — a primary-tone cut
pill with a 1px cut-shadow line, text in base-paper color.

Imagery. Paper-craft product photography: the real product photographed among cut-paper
scenery — tinted paper backdrops in the build's hue family, paper shapes (hills, clouds,
stars) physically layered around the object, soft even craft-table light, gentle contact
shadows only. The photo must look staged on a maker's table, not composited. No faces;
hands welcome (they prove the craft). No text or logos in frame. Any product in this
world's niches gets the same treatment: the object as the one real thing in a paper
diorama built for it.

7. THE SPINE

Hook, convince, offer, order form — the book's binding, never reordered. Price placement
law: first price appears in the hero on a cut price tag; the sticky bar repeats it small.
Sticky CTA: a base-paper bar with a primary-tone cut-edge top (a thin layer silhouette),
holding price tag + CTA pill; always scrolls to the form. Mobile-first at 390px; desktop
is the centered mobile shell (~455px) resting on base paper with a faint kraft desk edge
visible at the far margins.

8. BLOCKS TREATMENT

Supported blocks, dressed by Warqa:
- announcement-bar: a slim kraft strip with one line ("التوصيل متوفر · الدفع عند
  الاستلام"), cut straight — the book's bookmark.
- problem-solution: two small scenes on facing sheets — the pain on a pale sheet, the
  answer on the primary sheet — separated by one layer-stack edge.
- benefits-icons: 3-5 cut-silhouette icons (lamp, moon, hand, leaf — solid shapes, no
  outlines) each on a mini sheet with a one-word label.
- how-it-works-steps: step sheets in a row — fold, press, light — each with a cut-circle
  numeral and one sentence; creases alternate.
- spec-table: allowed lightly for gadgets — a kraft sheet with rows as glued label strips,
  values plain; never dense engineering.
- photo-reviews: snapshots glued in windows — name, city, stars as tiny cut stars, two
  lines; 3-5 entries, alternating window tones.
- stats-band: three numbers on one primary sheet — cut-circle frames around each numeral,
  no counters racing (one settle).
- guarantee-seal: the promise sheet — a folded card whose lifted corner reveals the
  guarantee line beneath; exchange window + pay-at-door stated plainly.
- price-anchor: the offer spread — primary sheet, old price on a small pale tag struck
  with one clean cut line, new price on the big tag, savings line; the fold-lift signature
  lives HERE.
- bundle-offers: two stacked-sheet piles — solo vs duo — the duo pile one layer deeper
  (visibly more sheets), flagged "الأكثر اختيارًا"; feeds the form.
- variant-gallery: paper-doll rail — variant cards with tabs, selected tabs folded down;
  feeds the form.
- unboxing-gallery: "in the box" as an exploded flat-lay window — each piece labeled with
  a tiny tag; count badge as a cut circle.
- order-steps: the reply-card ritual: تكتب، نتصل، نوصل، تدفع عند الباب — four mini sheets
  with cut icons.
- faq + trust-footer: faq as sheets that unfold (accordion) with crease lines; footer on
  kraft — phone, WhatsApp, the maker's closing line, deepest layer edge closing the page.
Refused blocks: countdown (paper does not tick), whatsapp-proof (screenshots shatter the
diorama), video-testimonial (nothing moves in a paper book but paper).

9. HERO MENU

- The Diorama: product photo in a large cut window center, layered hills behind (2-3
  edges), name above in display, price tag overlapping the window corner, CTA below. The
  default spread.
- The Pop-Up Book: hero styled as an opened pop-up — product window center with symmetric
  cut shapes rising either side, one promise line beneath, tag + CTA.
- The Fold-Out: split — start-side a folded-open sheet with name, two lines, tag, CTA;
  end-side the photo window; the hero card carries a visible crease.
- The Tab Board: variant-first — the paper-doll rail sits directly under a short headline;
  the window photo swaps per selected tab; tag + CTA follow.
- The Maker's Note: story-hook — one display line on a pale sheet ("مصباح يطوى في جيبك"),
  small window photo, tag, CTA; quietest opening.
- The Shelf Spread: for multi-piece products — pieces in a row of small windows over one
  wide sheet, name above, tag + CTA beneath.

10. FORM MENU

- Reply Card (default): one kraft sheet — fields as glued label rectangles with visible
  labels, submit as the primary cut pill; COD line printed small; the sheet's corner is
  lifted (static).
- Two-Fold Wizard: fold one chooses variant/bundle (tab board), fold two takes name,
  phone, wilaya; progress shown as two crease marks (pressed = done).
- Window Echo: a compact 2-field card under the hero (phone + wilaya) in a small window,
  repeated in full at the end; both validate.
- Envelope Form: the form framed by an envelope-flap silhouette above (cut, not folded
  animation); for gift-led builds; laws unchanged.

11. MOTION IDENTITY

Paper theater: entrances slide layers by 2-6px with 0.5s sine.out (sheets settling on a
table), staggered by depth — pale first, kraft last. The ONE signature moment: the offer
card's lifted corner folds open once (rotateX at the corner, 0.6s) revealing the price
line beneath; static-open under reduced motion. Tabs fold with a 0.3s flap when selected.
Nothing loops, nothing bounces (overshoot banned). Gated per DEMO-LAWS; gsap.set only for
hiding; the book reads perfectly with JavaScript off.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything,
lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels,
parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name:
fanzine's torn edges and tape strips (Warqa cuts clean, never tears); gommette's
die-cut sticker halos and peel-corner hovers (folds are creases, never peels); carnet's
paper-flip motion, spiral binding and pinned polaroids; bloc's hard offset shadows (cut
shadows are 1px self-tone lines); doudou's cloud-scallop edges and balloon numerals;
jihaz's lace openwork (Warqa never perforates patterns); bulle's comic panels and
bubbles; cartable's seyès grids and punched margins. Warqa's own temptations, banned:
mixed hue families, blurred shadows, origami-crane clichés as decoration, more than one
fold-lift, animated page-turns, and any texture that reads as fabric or plastic.
Refused blocks restated: countdown, whatsapp-proof, video-testimonial.

13. EXAMPLE VARIATIONS

- "Orika Lamp" — home & kitchen (foldable origami lamp, fr-MA). Diorama hero (coral
  family); announce, problem-solution, how-it-works (fold/press/light), benefits, spec
  sheet light, photo-reviews, guarantee fold, price-anchor with fold-lift, bundle piles,
  Reply Card, faq, footer.
- "Veilleuse Nuage" — kids & baby (paper-shade night light). Pop-Up Book hero (teal
  family); benefits, how-it-works, photo-reviews in windows, stats sheet, guarantee,
  price-anchor, Tab Board variants (3 shades), Two-Fold Wizard, faq, footer.
- "Kit Mobiles" — kids & baby (paper mobile kit). Maker's Note hero (ochre family);
  unboxing spread (12 pieces tagged), how-it-works, benefits, photo-reviews, guarantee,
  price-anchor, Window Echo + full Reply Card, footer — a gentle 10-beat book.
- "Lanterne Aïd" — home & kitchen (paper lantern set). Shelf Spread hero (coral family);
  benefits, how-it-works, stats, photo-reviews, bundle piles (6 vs 12), price-anchor,
  Envelope Form, faq, footer.
- "Cadre Souvenirs" — home & kitchen (paper photo frames set). Fold-Out hero (teal
  family); benefits, unboxing, photo-reviews, guarantee fold, price-anchor, variant tabs
  (3 tones), Reply Card, footer.
- "Mini Projecteur" — electronics & gadgets (pocket projector styled in paper diorama).
  Tab Board hero (ochre family); spec sheet, benefits, how-it-works, photo-reviews,
  guarantee, price-anchor with fold-lift, Two-Fold Wizard, faq, footer — proof that even
  a gadget can live in paper.
- "Boîte à Recettes" — home & kitchen (recipe card box with dividers). Fold-Out hero
  (coral family); problem-solution (recipes lost in phones), unboxing (box, 40 cards, 6
  dividers each tagged), benefits, photo-reviews, stats sheet, guarantee fold, price-
  anchor, bundle piles (solo vs duo cadeau), Envelope Form, faq, footer. Mood: the
  archivist's issue — the layer silhouettes cut as recipe-card tabs, kraft reserved for
  the form, and the fold-lift revealing "وصفة العايلة محفوظة" under the offer corner.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
