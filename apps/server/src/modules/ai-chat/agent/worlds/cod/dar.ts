import type { DesignWorld } from "../types";

export const dar: DesignWorld = {
	id: "dar",
	name: "Dar",
	family: "warm-trust",
	tagline: "The honest family home that sells by daylight",
	kind: "cod",
	mood: ["warm", "honest", "familial", "daylit"],
	energy: "quiet",
	priceFeel: "accessible",
	industries: ["home & kitchen", "kids & baby", "health & wellness", "pets"],
	avoidFor: ["electronics & gadgets", "jewelry & watches"],
	fusesWith: [
		"doudou",
		"argan",
		"khodra",
		"fanous",
		"crochet",
		"jnina",
		"qahwa",
		"atay",
	],
	preview: {
		ground: "#F8F1E5",
		ink: "#3B2C21",
		accent: "#C4633D",
		fontFamily: "El Messiri",
		sampleWord: "الدار",
	},
	doc: `
DAR — THE WORLD DOC

1. PHILOSOPHY

Dar is Arabic for house, and this world sells the way a good house welcomes: door open, kettle on, nothing to hide. It is the page a neighbor forwards to her sister with the message "this seller is serious." Every decision breathes late-morning daylight — the hour when a home is honest, dishes drying, sun crossing the counter. Dar never shouts, never counts down, never pretends stock is running out. Its persuasion is domestic evidence: the voice note from a real customer, the product on a real counter, the price said plainly the way a shopkeeper who knows your family says it. Warmth here is not decoration; it is the argument. The buyer Dar convinces is careful with money and tired of circus pages — she scrolls slowly, reads reviews twice, and orders when the page feels like a recommendation instead of an ambush. So Dar's job is to feel pre-recommended: sand-warm grounds instead of white glare, terracotta instead of alarm red, photographs lit like her own kitchen at 11am. The page should feel handed over, not served — a bon de commande passed across a table.

Self-audit checklist — answer yes to ship:
- Does the hero feel like daylight in a real home, not a studio or a showroom?
- Is the price stated plainly in the first viewport, with no starburst, no slash theater?
- Could a cautious mother read every block and never feel pushed?
- Is one daylight beam present, sweeping the hero once and only once?
- Do the proof blocks sound like neighbors — names, quartiers, voice notes — not testimonials from nowhere?
- Are the gingham hem strips the only patterned element on the page?
- Are all touch targets thumb-big, all fields labeled, the COD promise beside the form?
- Would this page still convince with animations off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, never re-decided:
- The selling spine: hook then convince then offer then order form, invisible but absolute.
- Palette registers: sand grounds #F8F1E5 to #F3E9D9; coffee ink #46362A to #3B2C21; terracotta accent #C4633D to #D07A50; leaf-green support #7C8A5A capped at 5%; card white #FFFDF8.
- Type stacks: Latin display Fraunces or Lora or Bitter with body Karla or Nunito Sans or Source Sans 3; Arabic display El Messiri or Cairo with body Almarai or IBM Plex Sans Arabic.
- The three owned tics: the daylight beam, voice-note proof pills, gingham hem strips.
- Motion identity: morning settle — fades that rise 24px on power2.out, 0.7 to 0.9s; one beam sweep; no other loops, no overshoot ever.
- Desktop law: centered mobile shell, a ~460px card resting on the warm sand ground.
- Refused blocks: lottery-contest, stock-urgency, comparison-table.
- Imagery style: warm home photography, late-morning window light, terracotta and cream styling, soft film grain.

CLIENT-OWNED — re-decided fresh for every client, no exceptions:
- Hero composition (choose from the hero menu or invent within it).
- Block choice within the supported set, and the order those blocks run.
- Form style (from the form menu), and where the form first appears.
- Proof type emphasis: voice notes, written reviews, or family photos — pick a lead.
- Accent placement: where terracotta lands (CTAs and prices always; beyond that, rotate).
- Section density and rhythm: an airy five-block page or a full twelve-block dossier.
Two Dar pages must read as siblings raised in the same house — same light, same manners — never as photocopies. If a new build matches a previous one's hero plus form plus block order, start over.

3. VISUAL SIGNATURES — measured

- Grounds: page base #F8F1E5; alternate sections shift within the register to #F5EDDE or #F3E9D9. Cards sit on #FFFDF8 with a 1px border of #E8DCC8 and radius 14px. No shadows deeper than 0 2px 10px rgba(70,54,42,0.07).
- Ink: headings #3B2C21, body #46362A at 90% opacity feel (use #55443A), captions #8A7663.
- Terracotta: CTAs and prices #C4633D, hover deepen to #B05633, tints for chips at #F3D9CB.
- Display type: clamp(1.75rem, 6.2vw, 2.5rem) for the hero H1, line-height 1.15 Latin / 1.35 Arabic; section titles clamp(1.35rem, 4.8vw, 1.8rem). Body: clamp(1rem, 2.8vw, 1.0625rem), line-height 1.65 Latin, 1.8 Arabic.
- Radii: cards 14px, buttons 12px, form fields 12px, voice-note pills 999px. Nothing sharp-cornered except the gingham strips.
- The daylight beam: one diagonal linear-gradient band, 120 to 160px wide, rotated -18deg, from rgba(255,214,150,0) through rgba(255,219,163,0.5) to rgba(255,214,150,0); it crosses the hero from the top corner and reappears at up to two section heads at 25% strength. Never more than one beam per viewport.
- Voice-note pills: 999px pill, #FFFDF8 fill, 1px #E8DCC8 border; inside sit a 34px terracotta play disc (triangle glyph), 24 to 32 waveform bars 2px wide with heights 4 to 18px in ink at 35% opacity, and a duration caption ("0:27") in 13px. A tiny name-and-quartier line sits under the pill.
- Gingham hem strips: height 10 to 14px, a two-tone vichy check built from repeating-linear-gradients of terracotta #C4633D at 18% and cream #F8F1E5, 8px squares. Used as full-width section dividers only — maximum three per page.
- Spacing rhythm: sections breathe 64 to 88px vertical padding on mobile; content column has 20px side padding at 390px.

4. COLOR PHYSICS

- Ground register (60 to 75% of any viewport): #F8F1E5 to #F3E9D9. Never pure white pages; white exists only as the #FFFDF8 card surface.
- Ink register (15 to 25%): #46362A to #3B2C21, softened to #55443A for paragraphs, #8A7663 for whispers.
- Accent register (8 to 12%): terracotta #C4633D to #D07A50. It owns prices, primary CTAs, the play discs, checked states. It never floods a section background.
- Support: leaf green #7C8A5A at 5% or less — a checkmark, a "متوفر" note, one guarantee icon. Alert red is forbidden; errors use deep terracotta #A34A2B.
- Section logic: alternate sand tones; one deeper-warm interlude allowed per page (a #EFE3CF band for the guarantee or reviews). No dark sections — Dar has no night.
- Forbidden colors: alarm red, promo yellow, cold blues, purples, neon anything, black (#000) — the darkest allowed value is #3B2C21.

5. TYPOGRAPHY

Latin stack: display Fraunces (600, soft optical warmth) or Lora (600) or Bitter (600); body Karla (400/700) or Nunito Sans (400/700) or Source Sans 3 (400/600). Pairing rule: one serif display plus one round-humanist body — never two serifs, never display-weight body text.
Arabic stack: display El Messiri (600/700 — warm, rounded terminals, domestic dignity) or Cairo (600); body Almarai (400/700) or IBM Plex Sans Arabic (400/600). Pairing rule: El Messiri display with Almarai body is the house default; Cairo display only when the client name sets very long words.
Shared size clamps (both scripts): hero H1 clamp(1.75rem, 6.2vw, 2.5rem); section titles clamp(1.35rem, 4.8vw, 1.8rem); body clamp(1rem, 2.8vw, 1.0625rem); captions 0.8125rem. Arabic display sits ~10% smaller at the same clamp thanks to taller glyphs — never compensate by inflating.
Weight rules: display 600 to 700 only; body 400 with 700 reserved for prices and names. No thin weights — thinness reads cold in this house.
RTL rules: build with logical properties (margin-inline-start, padding-inline, inset-inline-end) so the page mirrors cleanly; never letter-space Arabic text (it breaks the joining) — tracking is Latin-only; Arabic body line-height 1.7 to 1.9; digits are Western Arabic numerals (0-9) for prices and phone numbers, with dir="ltr" spans around phone numbers so they read correctly.

6. SIGNATURE ART & COMPONENTS

The daylight beam (owned): implemented as an absolutely positioned gradient band behind hero content, overflow clipped by the section. On load, GSAP slides its background-position or translateX across once (1.6s, power2.inOut), then it rests. At section heads it is static, 25% opacity, and shorter. It is light falling into a room — it must never look like a spotlight or a glare sticker.
Voice-note proof pills (owned): the proof block dressed as a stack of two to four voice messages. Each pill: play disc, waveform bars, duration, then "أم يوسف — باب الوادي" style attribution. Tapping toggles a fake played state (bars tint terracotta up to a stop point). These are theater, not audio — no sound ever ships.
Gingham hem strips (owned): the fabric edge of the tablecloth. They divide major movements of the page — after the hero, before the offer, before the footer. Never as borders on cards, never vertical.
Supporting cast: buttons are full-width terracotta slabs (min-height 54px, radius 12px, 700 weight label, subtle darkening on press — no lift, no glow). Chips are sand-tinted pills with 1px borders. Cards are #FFFDF8 with the 1px crumb border. Icons are 1.75px-stroke rounded-line icons in ink, never filled, never duotone. The wilaya select and inputs are 56px tall with visible labels above, terracotta focus ring 2px.
Imagery: warm home photography — the product on a lived-in counter or table, late-morning window light raking from one side, terracotta/cream/olive-wood styling props, folded linen, soft film grain, gentle depth of field. Backgrounds are real rooms softly blurred, never seamless studio sweeps, never pure white cutouts, never black. People appear as hands and home life, not faces in studio. Banned in photos: neon rim light, glossy gradients, floating-in-void compositions, obvious AI sheen.

7. THE SPINE

Hook, then convince, then offer, then order form — in that order, always, and invisible to the buyer. Dar's price placement: the price appears IN THE HERO, plainly, next to a small struck old price at most — "12 900 دج" said the way a shop says it, no theater. The sticky CTA is a bottom bar: sand ground, 1px top border, a full-width terracotta button labeled "اطلبي الآن — الدفع عند الاستلام" (or its French equivalent), appearing after the hero scrolls past and smooth-scrolling to the form. Mobile-first at 390px: one column, thumb-reach CTA inside the first viewport. Desktop law — centered mobile shell: the page lives in a ~460px card centered on the sand ground, the ground faintly showing the daylight beam; no responsive re-layout.

8. BLOCKS TREATMENT — supported set

- announcement-bar: a quiet sand strip above the hero, ink text, one line — "التوصيل لكل الولايات — الدفع عند الاستلام". No rotation, no blinking.
- problem-solution: two short pain scenes told domestically (the old pot burns the bottom; dinner late again), then the turn, then the product photographed mid-use. Text-led, one photo.
- benefits-icons: four line-icon chips on cards in a 2x2 grid, each icon in terracotta, label in ink, one-line caption. Never a 3-column shadow row.
- how-it-works-steps: three steps as numbered sand cards, numerals in Fraunces/El Messiri terracotta, one photo per step where it helps.
- unboxing-gallery: "ماذا يصل معك" — a flat-lay photo plus a checklist of contents with leaf-green checks; count chip "7 قطع".
- whatsapp-proof: THE signature — dressed entirely as voice-note pills (see tics), two to four stacked, attributed by first name and quartier.
- photo-reviews: review cards on #FFFDF8, name + city + date, stars drawn as small terracotta rounds (not yellow stars), text kept to two honest sentences; optional customer photo with rounded corners.
- price-anchor: a plain-spoken beat — old price small and struck, new price large in terracotta, one line of per-day math ("أقل من قهوتين في الأسبوع"), COD restated beneath.
- bundle-offers: two or three stacked full-width cards (not columns) — single, duo "للعائلة", trio; per-unit price falls; chosen card grows a terracotta border and a leaf check. Feeds the form silently.
- guarantee-seal: a soft rounded-rectangle card with a thin gingham hem along one edge, the leaf-green check, and two short lines ("يوصل سالم، وإلا نبدلوه" / the 7-day exchange fact). Never circular text, never a rotating badge — text on a circle belongs to other worlds.
- order-steps: four steps with rounded line icons — fill, call, delivery, pay at door — the call step named warmly ("نتصل بك للتأكيد").
- delivery-map: a wilaya list as a two-column sand table — zone, delay, fee — headed by one line: "58 ولاية، من 24 إلى 72 ساعة".
- faq: five to seven questions as bordered accordion rows, chevron rotates, answers in the shopkeeper voice.
- trust-footer: brand line, phone and WhatsApp large and tappable, policies, "بيع بثقة منذ 2019".

Refused blocks:
- lottery-contest: a home does not run raffles; prizes cheapen trust.
- stock-urgency: manufactured panic breaks the neighborly promise.
- comparison-table: Dar never speaks ill of others' pots.

9. HERO MENU

- Daylight welcome: full-bleed home photo, beam sweeping across, name + one-line promise + plain price + CTA stacked at bottom. The default feeling of the world.
- Price-first stack: sand ground, product photo center, price stated big and honest directly under the name, trust chips beneath the CTA. For buyers who bounce when price hides.
- Story-hook hero: begins with one domestic sentence ("العشاء الذي يجمع الدار") over a table scene, product enters in the second beat below; price on a small card pinned to the photo corner.
- Offer-card hero: the hero IS a bon de commande — a #FFFDF8 card holding photo, price, three checks, and CTA, sitting on sand with the beam behind. Feels like a handed-over order slip.
- Split hearth: top 55% photo, bottom 45% sand panel with name, promise, price, CTA; the gingham strip stitches the seam. Calm and catalog-like.
- Video hero: a short muted loop of steam and serving (≤2MB, poster fallback), text and price on a sand gradient beneath; reserved for kitchen products that move.

10. FORM MENU

- The family order card: one #FFFDF8 card, all fields stacked, labels above, COD reassurance boxed at its foot with the leaf check. The default.
- Three small steps: a wizard of three sand panes (who you are / where / confirm) with a thin terracotta progress thread; each pane two fields max, big Next buttons.
- Hero-echo form: a two-field compact card (name + phone) directly under the hero for the decided buyer, repeated full-size at the end; the compact card says "نتصل بك خلال ساعة".
- Sticky-driven sheet: the sticky bar's button opens/scrolls to the form which slides up as a rounded-top sheet anchored at the page end; fields identical, gingham strip at its hem.

11. MOTION IDENTITY

Morning settle: elements fade in and rise 24px to rest, power2.out, 0.7 to 0.9s, staggered 0.08 to 0.12s within a block. The ONE signature scroll moment: the daylight beam's single sweep across the hero on load (1.6s power2.inOut) — nothing else sweeps, ever. Waveform bars in voice pills may grow in once when the proof block enters (0.5s, stagger 0.02s). No loops except nothing — even the beam rests after its pass. Reduced motion: everything visible immediately, beam static at mid-position. Banned motion: overshoot and bounce of any kind, pulsing CTAs, parallax, pinned sections, marquees, count-up races.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as icons, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter three-column icon rows with drop shadows, hero carousels, parallax stacks, backdrop-blur.
Neighbors' tics, banned by name: matiere's arch-only geometry (no arch frames, arch pills, arch anything); carnet's pinned polaroids and handwritten annotations; clair's soft-shadow floating cards; riviera's awning-stripe canopies; souk's starburst price badges and slash theater; teleachat's lower-third straps.
Refused blocks restated: lottery-contest, stock-urgency, comparison-table.
House temptations to resist: no "chaleureux" beige gradients over photos (light comes from the beam only), no more than three gingham strips, no faces-in-studio testimonial portraits, no yellow stars, no countdown of any kind even styled softly.

13. EXAMPLE VARIATIONS

- "Tajine Dada" — home & kitchen. Daylight welcome hero; announcement-bar, benefits-icons, problem-solution, unboxing-gallery, whatsapp-proof (three voice notes), price-anchor, bundle-offers, order-steps, delivery-map, faq, trust-footer; the family order card form. Mood: Friday couscous, mother-approved. Beam sweep is the only flourish; proof leads with voice.
- "Berceau Douz" — kids & baby. Offer-card hero (the bon de commande holds a sleeping-baby photo); benefits-icons, how-it-works-steps, photo-reviews led by customer photos, guarantee-seal, price-anchor, order-steps, faq, trust-footer; three-small-steps wizard form. Mood: nursery hush. Signature emphasis: gingham strips mark the three movements; voice pills absent — written reviews carry proof.
- "Tisane El Afia" — health & wellness. Story-hook hero ("نوم هادئ يبدأ بكوب"); problem-solution, ingredients told as unboxing-gallery contents, whatsapp-proof (two pills), stats-band absent, price-anchor with per-cup math, bundle duo/trio, guarantee-seal, faq, trust-footer; hero-echo form catching the decided. Mood: evening calm in daylight colors.
- "Panier Mimi" — pets. Split hearth hero; benefits-icons, photo-reviews (pet photos), how-it-works-steps as "التنظيف في دقيقة", price-anchor, order-steps, delivery-map, trust-footer; sticky-driven sheet form. Mood: the cat owns the house. Signature emphasis: the beam reappears at the reviews head, quieter than the hero's.
- "Mouilleuse Sabah" — home & kitchen. Price-first stack hero; unboxing-gallery, benefits-icons, whatsapp-proof (four pills, the longest one pinned first), price-anchor, guarantee-seal, order-steps, faq, trust-footer; the family order card form placed unusually early, right after benefits. Mood: no-nonsense morning market honesty.
- "Couffin Weld El Dar" — kids & baby. Video hero (muted stroller-fold loop); problem-solution, benefits-icons, photo-reviews, bundle-offers (single/duo), delivery-map, faq, trust-footer; sticky-driven sheet form. Mood: young parents, light luggage. Signature emphasis: waveform-less build — this sibling proves Dar breathes without voice pills when photos are stronger.
- "Mat'am El Kbir" — home & kitchen. Story-hook hero opening on the table set for twelve; how-it-works-steps, unboxing-gallery, whatsapp-proof (two pills), price-anchor with family math, bundle trio flagged "الأكثر طلبا", order-steps, faq, trust-footer; three-small-steps wizard. Mood: feast logistics, calm hands.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
