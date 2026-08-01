import type { DesignWorld } from "../types";

export const doudou: DesignWorld = {
	id: "doudou",
	name: "Doudou",
	family: "playful-family",
	tagline: "Candy clouds and balloon numbers for little joys",
	kind: "cod",
	mood: ["playful", "tender", "candy", "round"],
	energy: "medium",
	priceFeel: "accessible",
	industries: ["kids & baby", "pets", "home & kitchen"],
	avoidFor: ["jewelry & watches", "car accessories", "electronics & gadgets"],
	fusesWith: ["dar", "bulle", "cartable", "warqa"],
	preview: {
		ground: "#FFF0F4",
		ink: "#503257",
		accent: "#FF7BAC",
		fontFamily: "Baloo 2",
		sampleWord: "Doudou!",
	},
	doc: `
DOUDOU — THE WORLD DOC

1. PHILOSOPHY

Doudou is the word a child gives the thing it cannot sleep without. This world sells small joys to grown-ups by borrowing the visual grammar of the nursery — candy pastels, cloud edges, balloon numbers — while keeping the manners of a serious shop. The trick of Doudou is that the PAGE is the toy: sections end in cloud scallops, step numbers inflate like balloons, the buy button presses like a toy piano key. But the parent holding the phone is the real customer, so under every soft shape sits adult clarity: a legible price, a plain guarantee, delivery answers, a form that takes twenty seconds. Doudou never becomes noise — it is joy with an inside voice. Where a loud promo world squeezes urgency, Doudou squeezes delight: the wish to give the small person in your life one perfect thing. Color is sugar but never acid; motion floats but never bounces off the walls; copy smiles ("pour les petits rêveurs") but answers every practical question a parent has at 11pm. If a block would look wrong printed on a nursery wall, it does not ship.

Self-audit checklist — answer yes to ship:
- Do sections meet in cloud scallops, not straight lines, at least twice?
- Is exactly ONE candy color dominant, with the other two whispering?
- Do the balloon numerals read instantly as numbers, strings and all?
- Does the CTA visibly press down like a toy button when tapped?
- Is every fact a tired parent needs (price, delivery, return, safety) answered without hunting?
- Are decorations flat CSS/SVG art while the product itself stays photographic?
- Is there zero overshoot in motion — floats, not bounces?
- Would the page still feel joyful in grayscale (shapes doing the work)?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook then convince then offer then order form; invisible, absolute.
- Palette registers: pink ground #FFF0F4 and mint-cream ground #EFF9F4 alternating; plum ink #503257; candy register bubblegum #FF7BAC, mint #57C5A0, butter #FFD469 — ONE dominant per build, the other two at 10% or less each.
- Type stacks: Latin display Baloo 2, body Nunito or Quicksand; Arabic display and body Baloo Bhaijaan 2, body alternative Almarai.
- The three owned tics: cloud-scallop section edges, balloon numerals with strings, the toy-button CTA with its darker bottom lip.
- Motion identity: balloon float — scale 0.94 to 1 with fade, sine.out, 0.5s, no overshoot; slow drifting cloud loops; one string-sway signature.
- Desktop law: centered mobile shell ~450px on a cloud-dotted pastel ground.
- Refused blocks: comparison-table, spec-table.
- Art law: decorations (clouds, stars, balloons, confetti-free skies) are flat CSS/SVG; product imagery is photography.
CLIENT-OWNED — re-decided fresh every build:
- Which candy color leads (bubblegum, mint, or butter builds are three different moods).
- Hero composition from the hero menu; block choice and order; form style; proof lead (photo reviews vs video vs chat); how many cloud edges (two to four); density from a quick 7-block page to a full 13-block story.
Each client receives a new sibling from the same nursery — same softness, same shapes — never a clone. Identical hero plus form plus dominant color as a previous build means start again.

3. VISUAL SIGNATURES — measured

- Grounds: #FFF0F4 (pink) and #EFF9F4 (mint cream) alternating by section; the dominant candy color may tint one hero or offer band at 20% mix. Cards are #FFFFFF with radius 22px and a 2px border in the section's candy tint (e.g. #FFD3E2).
- Ink: #503257 for headings and body; #7A5E85 for captions; never pure black.
- Candy accents: bubblegum #FF7BAC (hover #F0619A), mint #57C5A0 (hover #46B18F), butter #FFD469 (hover #F5C74E). Dominant color owns CTA, prices, balloon numerals; the two minors get chips, small icons, one cloud tint.
- Display type: hero H1 clamp(1.9rem, 6.8vw, 2.6rem) in Baloo 2 700, line-height 1.15 (Arabic Baloo Bhaijaan 2, line-height 1.4); section titles clamp(1.4rem, 5vw, 1.85rem). Body clamp(1rem, 2.8vw, 1.0625rem), line-height 1.6 Latin, 1.8 Arabic.
- Radii: cards 22px, buttons 999px, images 18px, chips 999px. Nothing square.
- Cloud-scallop edges: section bottoms cut by an SVG path of 5 to 7 unequal soft bumps (radii varying 30 to 70px) in the NEXT section's ground color — the page reads as stacked clouds. Two to four per page, never between every section.
- Balloon numerals: 56 to 72px tall numbers in Baloo 2 800, filled with the dominant candy color, a 3px white outline, one small white ellipse highlight top-left, and a 24px curly string (SVG path, 2px plum) hanging beneath, tilted 2 to 4 degrees.
- Toy-button CTA: pill, min-height 56px, dominant candy fill, label white 700; its "lip" is a 5px darker same-hue border-bottom (e.g. #E0568D under bubblegum). On press: translateY(3px) and lip shrinks to 2px — the button physically presses. No glow, no gradient.
- Spacing: sections 56 to 80px vertical; scallop overlap adds 24px visual breathing.

4. COLOR PHYSICS

- Ground register (65 to 75%): the two pastel grounds alternating; a build may add ONE deeper pastel band (#FFE4EC or #DFF3EA) for the offer.
- Ink register (~20%): plum #503257 family only. Plum is the adult in the room — it never leaves.
- Candy register (10 to 15% total): one dominant (CTA, prices, numerals, key icons), two minors capped at 10% each (chips, small decorations). Rotating the dominant is the cheapest honest variation lever.
- Support: white #FFFFFF for cards and cloud art; star-shine #FFF9E8 allowed inside night-sky imagery frames only.
- Forbidden: red of any temperature (urgency has no nursery voice — "last pieces" appears, if the client insists, as a butter-yellow chip with a smiling tone), black, gray, neon, brown, purple-blue gradient skies. Dark sections are forbidden — night is depicted inside photos, not as page ground.

5. TYPOGRAPHY

Latin stack: display Baloo 2 (700/800) — round, inflated, warm; body Nunito (400/700) or Quicksand (500/700). Pairing rule: Baloo 2 is non-negotiable for display (it IS the balloon voice); choose Nunito when text runs long (better paragraph rhythm), Quicksand for gift-like short pages.
Arabic stack: display Baloo Bhaijaan 2 (700/800) — the same balloon soul, Arabic-native; body Baloo Bhaijaan 2 (400) or Almarai (400/700). Pairing rule: keep display and body in Baloo Bhaijaan 2 for full roundness unless body text exceeds ~80 words per section — then Almarai carries paragraphs.
Shared clamps: as in section 3; captions 0.8125rem. Weight rules: display never below 700; body 400 with 700 for prices, names, and the CTA label only.
RTL rules: logical properties throughout (padding-inline, margin-inline-start, border-start-end-radius for asymmetric scallop starts); NEVER letter-spacing on Arabic (joining breaks) — tracking belongs to Latin captions only; Arabic body line-height 1.7 to 1.9; digits Western Arabic (0-9); phone numbers wrapped in dir="ltr" spans; balloon numerals use Western digits in both scripts; string tilt mirrors in RTL (tilt toward text start).

6. SIGNATURE ART & COMPONENTS

Cloud-scallop edges (owned): an inline SVG path (not border-radius chains) closing each chosen section, bumps unequal so the edge reads hand-drawn-soft, filled with the next section's ground. At 390px the path spans 100% width, height 34 to 44px. Never used mid-card, never as a top edge and bottom edge of the same section.
Balloon numerals (owned): the counting voice of the page — steps 1-2-3, bundle quantities, "3 couleurs" chips. Built as styled text plus SVG string, or a single SVG per numeral. Strings sway only in the signature moment (see motion). Numerals never exceed four per page — inflation is precious.
Toy-button CTA (owned): every primary action uses it — hero CTA, sticky bar button, form submit. Secondary actions get ghost pills (2px candy border, plum text) that do NOT press. The press is the world's handshake; it must be felt on tap and seen on :active.
Supporting cast: chips are white pills with 2px candy borders; review cards carry a tiny cloud puff at their top-left corner; the sticky bar is a floating pill dock (not full-width) with rounded 999px, dominant-candy CTA inside; form fields are 56px, radius 16px, 2px pastel borders thickening to candy on focus; icons are plump filled-round SVG shapes in the dominant candy with plum details, drawn like sticker-book art but WITHOUT outlines or halos (gommette owns sticker dressing). Flat CSS/SVG clouds and stars decorate grounds at 6 to 10% opacity plum or white.
Imagery: adorable kids-product photography — pastel pink and mint nursery scenes, soft dreamy sidelight, plush and safe textures filling the frame, gentle bokeh star lights when night products call for them; props limited to nursery objects (wooden blocks, knit blankets); grain minimal, contrast soft. People appear as small hands and sleeping profiles, never posed studio faces. Banned in photos: harsh flash, black backdrops, adult-gadget styling, saturated primary-color toy-store chaos.

7. THE SPINE

Hook, convince, offer, order form — always, invisibly. Doudou's price placement: price appears IN THE HERO inside a butter or dominant-candy price bubble (a round chip beside the CTA) — parents refuse mystery. The sticky CTA is the floating pill dock: bottom-centered, slight shadow-less lift, toy-button inside labeled "Je commande" / "أطلبه لطفلي", appearing after 60% of the hero passes, smooth-scrolling to the form. Mobile-first at 390px. Desktop law — centered mobile shell: the ~450px page floats on a pastel ground dotted with flat CSS clouds and tiny stars; the shell has a 24px radius and the ground never scrolls its own content.

8. BLOCKS TREATMENT — supported set

- announcement-bar: a rounded ribbon (not a bar) hanging under the top edge — "Livraison partout en Algérie — payez à la livraison", led by a small flat SVG heart in butter (never an emoji). One line, no rotation.
- benefits-icons: four plump icon chips in a 2x2 grid on white cards, icon in dominant candy, caption in plum; each card corner slightly rounded differently for a hand-made feel.
- how-it-works-steps: THE balloon stage — three steps, each led by a balloon numeral, photo right/text left alternating; strings tilt alternately.
- variant-gallery: color/model choice as candy swatch buttons (28px rounds with 3px white ring when selected) plus a swapping product photo; selection writes into the form.
- unboxing-gallery: "Dans la boîte" — a white card grid, each item a small photo with a plump check; count badge as a small balloon numeral.
- photo-reviews: parent reviews on cloud-puffed cards — name, city, stars as tiny mint hearts (never yellow stars), one honest quote, optional child-with-product photo (face soft-cropped).
- video-testimonial: one muted loop in a rounded 18px frame with a play-pretend cloud badge, caption underneath; poster-first, ≤2MB.
- price-anchor: the price bubble grows into a scene — old price small and struck in plum, new price big in dominant candy, "moins qu'un jouet oublié en une semaine" one-liner, COD restated.
- bundle-offers: 1x/2x cards as gift boxes with ribbon corners (flat SVG ribbon, no halo); duo flagged "Le préféré des jumeaux"; selected box gets the toy-button treatment on its choose chip.
- lottery-contest: "Chaque commande = un ticket" told as a carnival balloon release — prize photo, draw date, past winner first names; kept smiling, one section max.
- guarantee-seal: a round cloud-shaped seal, "Échange 7 jours — sans discussion", plum text on butter tint; sits right before or inside the form.
- order-steps: four steps in one horizontal scroll-free row of mini-cards: remplir, appel, livraison, paiement — each with a plump icon; the call step reassures ("On confirme par téléphone").
- faq: accordion rows with plus signs that rotate to crosses in dominant candy; parent questions first (sécurité, lavable, piles).
- trust-footer: soft plum-on-pastel footer — brand, phone/WhatsApp big, policies, "Fait sourire les petits depuis 2021".

Refused blocks:
- comparison-table: check-cross grids read as playground arguments; Doudou never argues.
- spec-table: cold rows kill the nursery voice — practical facts live inside benefits and faq instead.

9. HERO MENU

- Cloud stage: product photo center on the pink ground, flat clouds behind, name in Baloo above, price bubble + toy-button below; the scallop closes the stage. The world's postcard.
- Price-balloon stack: name, one-line promise, then the price held by a drawn balloon (numeral-style bubble with string), CTA beneath; photo waits for section two. For gift-decided buyers.
- Photo-split: top 55% full-bleed product-in-nursery photo, bottom 45% mint-cream panel with name, two benefit chips, price, CTA; scallop stitches the seam.
- Toy-box offer card: a white 22px-radius card containing photo, price bubble, three plump checks, CTA — the hero as a gift box on the pastel ground.
- Story-hook: opens with one line ("Les nuits de Rayan ont changé.") over a dreamy photo; product revealed under the first scallop with price and CTA. For products that fix bedtime.
- Video hero: muted loop of the product glowing/moving in a rounded frame, name + price bubble + CTA stacked under; poster fallback mandatory.

10. FORM MENU

- The gift-tag card: one white card, fields stacked with visible labels, a small bow at the card's top (flat SVG), toy-button submit; COD line with a plump check under the button. Default.
- Three balloons wizard: three panes counted by balloon numerals 1-2-3 (child's name optional field appears here as "Pour qui?"), two fields per pane, progress shown as inflating dots.
- Hero-echo: a two-field mini gift-tag (name + phone) right under the hero CTA for decided parents, repeated in full at the page end; mini form promises "Rappel en moins d'une heure".
- Dock-driven sheet: the floating pill dock scrolls to a rounded-top sheet at page end; sheet ground is the mint cream, fields identical, seal beside submit.

11. MOTION IDENTITY

Balloon float: entrances scale from 0.94 to 1 with fade, sine.out, 0.5s, stagger 0.08s — everything settles like a balloon reaching the ceiling, NEVER bouncing (no overshoot, no elastic, no back easing; guimauve owns bounce). Decorative clouds drift horizontally in 30 to 45s linear loops at whisper opacity. THE signature moment: when a how-it-works step enters, its balloon numeral floats up 12px into place while its string sways 3 degrees twice (sine.inOut, 1.2s total) — only the numerals get this, once each. The toy-button press is :active CSS (translateY 3px), not GSAP. Reduced motion: all visible, clouds static, no sway. Banned: bounce/overshoot, spin, confetti bursts, parallax, pinned scenes, marquees.

12. BAN LIST

Generic slop: purple-blue gradients on white, glassmorphism, emoji as design system, Poppins-for-everything, lorem ipsum, fake trust badges, cookie-cutter icon-row-with-shadows, hero carousels, parallax overuse, backdrop-blur.
Neighbors' tics, banned by name: guimauve's puffy blob containers, back.out bounce entrances, and candy-stripe divider bars; gommette's die-cut sticker halos and peel-corner hovers; tutti's memphis confetti fields, colored offset shadows, and squiggle underlines; riviera's awning-stripe canopies; bloc's hard offset shadows; huitbit's pixel sprites; dar's daylight beam, voice-note pills, and gingham strips.
Refused blocks restated: comparison-table, spec-table.
House temptations: no rainbow (three candies max, one dominant); no red urgency in any costume; no dark "premium" section; no sticker outlines around anything; no more than four balloon numerals; scallops never on every section.

13. EXAMPLE VARIATIONS

- "Nuno le Nuage" — kids & baby. Cloud stage hero (bubblegum dominant); announcement-ribbon, benefits-icons, how-it-works-steps (3 balloons), variant-gallery (3 couleurs), photo-reviews, price-anchor, bundle-offers, guarantee-seal, order-steps, faq, trust-footer; gift-tag card form. Mood: bedtime magic sold to exhausted parents. Numeral sway carries the signature.
- "P'tit Chef Waffou" — home & kitchen (kids baking set). Toy-box offer card hero (butter dominant); unboxing-gallery first, benefits-icons, video-testimonial (batter loop), photo-reviews, price-anchor, lottery-contest ("gagne un tablier brodé"), order-steps, faq, trust-footer; dock-driven sheet form. Mood: Sunday pancakes chaos, happily contained.
- "Doudou Lapinou" — kids & baby. Story-hook hero (mint dominant, "Le doudou qui ne se perd jamais."); problem-into-benefits told through benefits-icons, how-it-works-steps (2 balloons + tracker card), whatsapp-style parent thread replaced by photo-reviews, bundle duo "jumeaux", guarantee-seal, faq, trust-footer; hero-echo form. Mood: velvet-eared insurance policy.
- "Croquette Tour" — pets. Photo-split hero (butter dominant, cat mid-pounce); benefits-icons, variant-gallery (2 tailles), video-testimonial, price-anchor with per-week math, order-steps, delivery answered inside faq, trust-footer; three balloons wizard. Mood: the cat is the client. Clouds replaced by flat paw-pad dots at ground opacity — same law, new sky.
- "Veilleuse Qamar" — kids & baby. Price-balloon stack hero (bubblegum dominant); how-it-works-steps, unboxing-gallery, photo-reviews with night-photo frames, bundle-offers, guarantee-seal, order-steps, faq, trust-footer; dock-driven sheet form. Mood: rammel of stars over Algiers rooftops, told in French.
- "Bavoir Magique" — kids & baby. Video hero (mint dominant, rinse loop); benefits-icons, variant-gallery (6 motifs as swatches), photo-reviews, price-anchor, bundle trio "la semaine complète", faq, trust-footer; gift-tag card form arriving early right after variants. Mood: laundry day defeated. Scallops at only two seams — the sparse sibling.
- "Tapis d'Éveil Nour" — kids & baby. Cloud stage hero (butter dominant) but text-leading with photo low — proving the same menu item can invert; how-it-works-steps (4 balloons, the maximum), benefits-icons, video-testimonial, price-anchor, guarantee-seal, order-steps, faq, trust-footer; three balloons wizard. Mood: floor-time festival, safety-first captions.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
