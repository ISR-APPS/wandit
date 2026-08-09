import type { DesignWorld } from "../types";

export const argan: DesignWorld = {
	id: "argan",
	name: "Argan",
	family: "natural-organic",
	tagline: "Cold-pressed botanical calm in olive and oil-gold",
	kind: "cod",
	mood: ["earthy", "artisanal", "calm", "botanical"],
	energy: "quiet",
	priceFeel: "premium",
	industries: ["beauty & cosmetics", "health & wellness", "home & kitchen"],
	avoidFor: ["electronics & gadgets", "car accessories"],
	fusesWith: ["dar", "hammam"],
	preview: {
		ground: "#F5F0E4",
		ink: "#35402B",
		accent: "#C89033",
		fontFamily: "Marcellus",
		sampleWord: "Argania",
	},
	doc: `
ARGAN — THE WORLD DOC

1. PHILOSOPHY

Argan is the cooperative's cold press: patient hands, raw cotton, a thread of golden oil that took a season to exist. This world sells natural goods by refusing every shortcut the "bio" aesthetic usually takes — no leaf clip-art wallpaper, no green-washed banners, no fake apothecary nostalgia. Its credibility is MATERIAL: cotton-toned grounds that feel woven, olive ink that feels stone-ground, and one golden ribbon of oil that flows down the page the way the real thing leaves the press. Argan speaks quietly and precisely about origin, percentage, and process, because its buyer has been burned by miracle jars before. She reads INCI lists. She wants to know which valley, which women, which press, what purity. So Argan's persuasion is a supply chain told as a landscape: the fruit, the hands, the droplet, the glass bottle on her shelf. The pace is slow pour — nothing snaps, nothing flashes; the page breathes at the speed of honey leaving a spoon. Premium here means EARNED: the price sits beside proof of craft, never beside urgency. If a block cannot be imagined printed on kraft and tied to a bottle, it does not belong.

Self-audit checklist — answer yes to ship:
- Does the oil ribbon flow visibly down the page, linking at least three sections?
- Is every claim quantified (percentage, origin, press method) at least once?
- Could this page be mistaken for a premium cosmetics insert rather than a promo funnel?
- Are droplet badges carrying real numbers, not vague words like "pure"?
- Is the golden accent under 12% of any viewport — precious, not gilded?
- Does the photography smell of cotton, kernels, and honey light — never of studio plastic?
- Is there zero countdown, zero lottery, zero panic anywhere?
- Would a cooperative artisan recognize her work in this page's tone?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The spine: hook then convince then offer then order form, invisible and absolute.
- Palette registers: cotton grounds #F5F0E4 to #EFE8D8; deep-olive ink #35402B; olive #75894F; oil gold #C89033; clay #B56B44 capped at 8%.
- Type stacks: Latin display Marcellus or Cormorant Infant, body Mulish or Source Sans 3; Arabic display Cairo (500), body IBM Plex Sans Arabic.
- The three owned tics: the oil ribbon, droplet badges, crushed-spice swatches.
- Motion identity: slow pour — fades rising 18px, sine.out, 0.8s; the oil ribbon scrubbed by scroll; nothing faster, nothing looping.
- Desktop law: responsive expansion to a 1040px maximum, airy single column widening — never a shell card.
- Refused blocks: lottery-contest, countdown, spec-table.
- Imagery style: artisanal organic photography — raw cotton cloth, kernels and branches, warm honey side-light, golden droplets, earthy minimalism.
CLIENT-OWNED — re-decided fresh for every client:
- Hero composition from the menu; block choice within the supported set and their order; form style; proof lead (reviews, stats, or process story); where the ribbon enters and exits; whether olive or gold leads the accent duty this build; section density from a spare 7-block rituel to a full 13-block dossier.
Every client receives a new pressing from the same press — same land, same hands, different bottle. If hero plus form plus ribbon path repeat a previous build, discard and re-decide.

3. VISUAL SIGNATURES — measured

- Grounds: base #F5F0E4; alternate #EFE8D8; one deeper linen band #E9E0CC allowed for the offer or guarantee. Cards #FDFBF4 with 1px #DDD3BC border, radius 10px — corners stay quiet.
- Ink: headings #35402B; body #4A5540; captions #7C8468.
- Accents: oil gold #C89033 (hover #B37F26) owns prices, the ribbon, droplet fills, key rules; olive #75894F owns checks, secondary buttons, origin chips; clay #B56B44 appears only in imagery echoes and one chip family, never on CTAs.
- Display type: hero H1 clamp(1.8rem, 6.4vw, 2.7rem) Marcellus 400 (its caps carry weight without bolding), line-height 1.2; section titles clamp(1.35rem, 4.6vw, 1.9rem); an uppercase 0.75rem letter-spaced (Latin only) kicker in olive above titles. Body clamp(1rem, 2.8vw, 1.0625rem), line-height 1.7; Arabic body line-height 1.85.
- Radii: cards 10px, buttons 10px, fields 10px, droplet badges get their own teardrop geometry, spice swatches are irregular circles.
- The oil ribbon: an SVG path 48 to 90px wide, filled with a vertical linear-gradient #E3B65A to #C89033 at 85 to 92% opacity, meandering down the page margin (inline-end on LTR, mirrored in RTL), passing behind section titles and in front of grounds; its gradient position advances with scroll (scrub). It enters below the hero and dissolves before the form — the form is dry land.
- Droplet badges: teardrop shapes (SVG, 56 to 72px tall), gold fill at 12% with a 1.5px gold stroke, carrying a number ("100%", "1ère pression", "48h") in ink and a two-word caption below.
- Crushed-spice swatches: 64 to 80px irregular-edged discs (SVG blob paths with grain texture fill in olive/gold/clay at 20%), one line-icon or numeral centered; used as benefit icon containers, 3 or 4 per row maximum.
- Spacing: sections 72 to 96px vertical padding mobile; text measures capped at 62ch.

4. COLOR PHYSICS

- Ground register (70 to 80%): cotton #F5F0E4 to #EFE8D8, plus the one linen band. Whites only as card fill #FDFBF4.
- Ink register (~15%): the olive-coffee family #35402B to #4A5540. Pure black forbidden.
- Accent registers (8 to 12% combined): gold leads or olive leads — the build chooses ONE leader; the other supports. Gold never becomes a background fill wider than the ribbon; olive never exceeds chips, checks, and one button style.
- Clay (≤8%): warmth echo only — a chip family or an illustration stroke.
- Section logic: light throughout; the page darkens NEVER — depth comes from the linen band and photography. Errors in muted brick #A3542E.
- Forbidden: bright greens (mint, lime, emerald), pharmacy teal, red, blue, purple, black grounds, white-glare sections, gradient meshes.

5. TYPOGRAPHY

Latin stack: display Marcellus (400 — a Roman inscription softened by time) or Cormorant Infant (500/600) for builds needing more perfume; body Mulish (400/600) or Source Sans 3 (400/600). Pairing rule: Marcellus with Mulish is the house pressing; Cormorant Infant only with Source Sans 3 (its roundness needs a sturdier floor). Never pair the two displays.
Arabic stack: display Cairo (500/600 — geometric dignity without stiffness); body IBM Plex Sans Arabic (400/500). Pairing rule: Cairo display always; if a build's Arabic body runs editorial-long, IBM Plex Sans Arabic 400 at 1.85 line-height holds the page together.
Shared clamps: as section 3. Kickers: Latin uppercase with 0.14em tracking; Arabic kickers are NEVER letter-spaced — they take a 1px olive rule beside them instead (same hierarchy, native manners).
Weight rules: displays live at 400 to 600 — bold is banned in display sizes (craft never shouts); body 400, with 600 for prices, origins, and field labels.
RTL rules: logical properties everywhere; the ribbon path and its meander mirror horizontally; droplet badges keep their vertical teardrop; digits Western Arabic (0-9); phone numbers in dir="ltr" spans; Arabic line-height 1.7 body minimum, 1.85 preferred.

6. SIGNATURE ART & COMPONENTS

The oil ribbon (owned): the world's spine made visible — a filled fluid gradient shape, never a line, never dotted, never a route with stops. It should read as poured liquid: soft meanders, slight width swells, no sharp turns. Scroll scrubs its gradient downward so the pour advances as the reader does. One ribbon per page. It dissolves (opacity fade over 200px) before the order form.
Droplet badges (owned): quantified trust — each carries ONE number and ONE fact: "100% pure", "1ère pression à froid", "Vallée d'Ammeln", "0 additif". Three to five per page, in a loose row or scattered beside the ingredients story. Never decorative without data.
Crushed-spice swatches (owned): benefit icons sit inside irregular powder-pile discs, as if pigments were crushed on the page. Their edges are irregular blob paths — never perfect circles, never watercolor washes (aquarelle owns washes).
Supporting cast: primary button is a gold slab (min-height 54px, radius 10px, ink-on-gold label at 600); secondary is an olive-outline button. Origin chips are small cotton pills with 1px olive borders ("Coopérative Tamounte", "Récolte 2025"). Cards are quiet; imagery does the luxury. Dividers are single 1px #DDD3BC rules — the gingham, the steam, the kilim all belong to other worlds. Field focus rings are olive.
Imagery: artisanal organic photography — products on raw cotton or linen cloth, argan kernels, olive branches, clay bowls as props; warm honey side-light from one direction; golden oil droplets caught mid-fall where the product allows; visible textile weave, mild grain, muted earth grading. Compositions leave cotton breathing room around the product. Banned in photos: studio white sweeps, neon or cool light, plastic props, spa stones (hammam's land), laboratory glassware (remede's land), faces in studio poses — hands at work are welcome.

7. THE SPINE

Hook, convince, offer, order form — the invisible law, restated: the buyer must glide from desire to evidence to price to the form without one jarring beat. Argan's price placement: the price appears EARLY IN THE HERO but held gently — a gold figure beneath the product name with "paiement à la livraison" in whisper caps beside it; no strikethrough theater in the hero (the price-anchor block owns the savings math). The sticky CTA is a slim bottom bar in cotton with a 1px olive top rule and a gold slab button "Commander — payer à la livraison"; it appears once the hero is passed and glides the page to the form. Mobile-first at 390px; Desktop law — responsive expansion: the column widens to a 1040px maximum, imagery breathes into asymmetric two-column moments (photo 55 / text 45), the ribbon keeps to one margin. Never a phone-shell card.

8. BLOCKS TREATMENT — supported set

- announcement-bar: one cotton strip, olive text, a single fact — "Récolte 2025 — pressée à froid en 48h". No urgency language ever.
- problem-solution: the dry-hair winter told in two short beats on cotton, then the turn carried by a full-bleed honey-lit photo; copy stays under 80 words.
- benefits-icons: four crushed-spice swatches in a row, each with a line-icon and a two-word label; captions quantified where possible ("brillance en 7 jours").
- ingredients-infographic: the world's centerpiece — the bottle photographed on cotton, droplet badges anchored around it listing purity, origin, press method, additives (zero); below, a short INCI-style list in mono-spaced-feeling small caps (Latin) with plain-language notes.
- how-it-works-steps: three ritual steps ("3 gouttes, paumes chaudes, pointes d'abord") as numbered cotton cards, numerals in Marcellus gold.
- before-after: allowed and welcomed for hair/skin — two honest photos side by side with a 4-week caption and a small disclaimer line; frame corners 10px, no slider theatrics.
- photo-reviews: reviews as pressed-card testimonials — name, city, skin/hair type chip, two sentences, optional photo; stars rendered as five tiny gold droplets.
- stats-band: three counters on the linen band — "12 000 flacons", "4,8/5", "34 coopératrices" — numerals in Marcellus, counted up slowly once.
- price-anchor: the savings beat — old price small struck in olive, price large in gold, per-ml math ("0,9 MAD le ml"), one line on why the press costs what it costs.
- bundle-offers: cure durations, not multipacks — 1 mois / 3 mois / rituel complet as three stacked cotton cards, per-flacon price falling, "la cure conseillée" flagged in olive.
- guarantee-seal: a pressed-wax-free seal — a simple gold-stroke roundel with "Authenticité vérifiée — échange 14 jours" and the cooperative's name; sits beside the form.
- order-steps: four quiet steps — commande, appel de confirmation, livraison 24-72h, paiement à la porte — icons in 1.5px olive stroke.
- faq: six questions in accordion rows ruled by 1px lines — authenticity, conservation, grossesse, usage cheveux/peau, livraison, retour.
- trust-footer: cotton footer with the cooperative's story in two lines, phone/WhatsApp, policies, "Du village à votre porte".

Refused blocks:
- lottery-contest: raffles are carnival noise; the press has no carnival.
- countdown: harvest time cannot be rushed; panic clocks break the covenant.
- spec-table: cold engineering rows belong to gadgets; here facts live in droplets and INCI lines.

9. HERO MENU

- The pressing: full-width honey-lit photo of the product on cotton, name in Marcellus over it on a cotton gradient, price in gold beneath, CTA slab; the ribbon begins its pour at the hero's lower edge. The default landscape.
- Bottle portrait: cotton ground, the bottle centered and large, name above, three droplet badges orbiting the bottle's sides, price and CTA below. For builds where the object is the argument.
- Origin story-hook: opens with one line ("Dans la vallée d'Ammeln, l'huile se mérite.") over a landscape/hands photo; the product and price arrive at the second beat. For clients with a real story.
- Ritual split: photo 55 / text 45 asymmetric split (stacks at 390px), text side carrying name, promise, price, CTA, one droplet badge; the ribbon threads the seam.
- Offer-card hero: a #FDFBF4 card on cotton holding photo, price, three quantified checks, CTA — the hero as a pressing certificate.
- Before-after hero: the honest opener — paired photos above the fold with the 4-week caption, name and price banded beneath; reserved for transformation products with real proof.

10. FORM MENU

- The certificate card: one #FDFBF4 card, stacked labeled fields, guarantee-seal beside the submit slab, COD line under it. The default.
- Two-pour wizard: two panes (vous / livraison), progress shown as a droplet filling; three fields maximum per pane; gold Next slabs.
- Hero-echo: a compact name+phone card under the hero ("Rappel sous 1h par la coopérative"), repeated full-size at the end; for returning customers who already know the oil.
- Sticky-driven: the slim cotton bar carries the only persistent CTA; the form waits at the end as a full-width linen band with fields on cotton cards; ribbon long dissolved before it.

11. MOTION IDENTITY

Slow pour: entrances fade and rise 18px, sine.out, 0.8s, staggered 0.12s; nothing enters faster than honey. THE signature scroll moment: the oil ribbon's gradient position advances with scroll (scrubbed, 0.5 smoothing) so the pour tracks the reader's descent — this is the page's only scrub and only continuous motion. Stats count up once, slowly (1.2s). Reduced motion: ribbon static at full pour, all content visible, counters at final values. Banned motion: loops, pulses, spins, bounces, parallax layers, pinned scenes, anything under 0.5s.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as icons, Poppins-everything, lorem ipsum, fake certification logos, cookie-cutter three-column icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur.
Neighbors' tics, banned by name: herbier's botanical specimen plates, pressed-leaf silhouettes, and tied specimen tags; aquarelle's watercolor washes, pigment-bloom masks, and brush underpainting; atlas's dotted travel routes; orfevre's self-drawing gold engravings; bauplan's rotating circular text badge; dar's daylight beam, voice-note pills, and gingham strips; hammam's steam veils, pebble stacks, and ripple rings.
Refused blocks restated: lottery-contest, countdown, spec-table.
House temptations: no leaf wallpaper or floating botanical PNGs; no kraft-paper texture backgrounds (material comes from photography, not CSS burlap); no gold foil flooding; no "digital detox sage green" trends; the ribbon is never a thin line, never dotted, never a route.

13. EXAMPLE VARIATIONS

- "ÔR d'Argane" — beauty & cosmetics. The pressing hero; announcement-bar, ingredients-infographic (five droplets), how-it-works-steps, before-after, photo-reviews, stats-band, price-anchor, bundle cures, guarantee-seal, order-steps, faq, trust-footer; certificate card form. Gold leads. Mood: the flagship pressing — full dossier, unhurried.
- "Savon d'Alep des Atlas" — beauty & cosmetics. Bottle portrait hero (bar soap as the object); benefits-icons (spice swatches), ingredients-infographic, photo-reviews, price-anchor, bundle trio, order-steps, faq, trust-footer; two-pour wizard. Olive leads. Mood: austere apothecary warmth, fewer words, more material.
- "Miel de Jujubier Sidr" — health & wellness. Origin story-hook hero (the beekeeper's line); problem-solution, ingredients-infographic with harvest droplets, stats-band, photo-reviews, price-anchor with per-cuillère math, guarantee-seal, faq, trust-footer; hero-echo form. Gold leads. Mood: rare-harvest gravity; ribbon reads as honey this build.
- "Tisane des Sept Collines" — health & wellness. Offer-card hero; how-it-works-steps (infusion ritual), benefits-icons, photo-reviews, bundle cures (1/2/3 mois), order-steps, faq, trust-footer; sticky-driven form. Olive leads. Mood: evening infusion calm — the sparse sibling, seven blocks, ribbon entering late.
- "Ghassoul & Rose" — beauty & cosmetics. Ritual split hero; ingredients-infographic, how-it-works-steps, before-after, photo-reviews, price-anchor, guarantee-seal, faq, trust-footer; certificate card form arriving directly after before-after — proof to pen in one gesture. Gold leads. Mood: hammam-day preparation without hammam's steam — clay and roses on cotton.
- "Huile d'Olive Beldiya" — home & kitchen. The pressing hero recomposed food-side (bread, drizzle); droplet badges turn culinary ("extraction à froid", "acidité 0,3%"), benefits-icons, stats-band, price-anchor per-litre, bundle 1L/3L/5L, order-steps, faq, trust-footer; two-pour wizard. Olive leads. Mood: the table, not the vanity — same press, different hunger.
- "Amlou du Souss" — home & kitchen. Before-after hero replaced by a spread-on-bread photo-split (the world allows invention inside the menu's spirit); unboxing-style ingredients (almonds, argan, miel as three spice swatches), photo-reviews, price-anchor, bundle duo, guarantee-seal, faq, trust-footer; hero-echo form. Gold leads. Mood: breakfast heritage, jars that empty too fast.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
