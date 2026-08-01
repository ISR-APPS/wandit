import type { DesignWorld } from "../types";

export const trottoir: DesignWorld = {
	id: "trottoir",
	name: "Trottoir",
	family: "street-hype",
	tagline: "Street-drop tension: labels, receipts, edition numbers",
	kind: "cod",
	mood: ["stark", "cool", "limited", "urban"],
	energy: "medium",
	priceFeel: "premium",
	industries: [
		"fashion & apparel",
		"electronics & gadgets",
		"jewelry & watches",
	],
	avoidFor: ["kids & baby", "health & wellness", "home & kitchen"],
	fusesWith: ["impact", "viral"],
	preview: {
		ground: "#E9E9E7",
		ink: "#0B0B0B",
		accent: "#FF4D00",
		fontFamily: "Archivo Black",
		sampleWord: "DROP /200",
	},
	doc: `
=== TROTTOIR — WORLD DOC (kind: cod-page) ===

1. PHILOSOPHY

Trottoir is the sidewalk outside the store at 07:40, twenty people deep, everyone pretending not to count everyone else. The product is scarce, numbered, and it does not beg. This world treats LOGISTICS AS AESTHETIC: the page dresses itself in the paperwork of desire — shipping labels, thermal receipts, edition numbers, routing arrows — because in drop culture the packaging trail IS the proof of realness. Concrete grounds, hard black ink, one safety-orange signal. Nothing is cute, nothing is loud for long; the tension is in the restraint. The page speaks in mono captions and short declaratives, like a release note taped to a shutter. It never explains why you want the product. It states what it is, how many exist, when the window closes, and where to sign.

Desire here is manufactured by precision, not pressure. A starburst yelling 50% would kill the object's aura instantly — price is stated like a fact on an invoice. The buyer must feel they found something, not that something was sold to them.

Self-audit checklist — answer before shipping:
- Does the hero read as a DROP (name, edition count, window, price) inside one 390px viewport?
- Is every info surface dressed as logistics paper — label, receipt, manifest — not as generic cards?
- Is safety orange under 8% of any viewport, and never used for body text?
- Are chevron rails actually guiding toward the form, each one tappable or adjacent to a tappable?
- Does the receipt-rail offer contain real math (item, delivery, total) and an oversized total?
- Is the mono face carrying captions/labels only — never paragraphs?
- Zero horizontal overflow at 390 / 768 / 1440?
- Two-second test: could nobody confuse this with a sport page, a promo page, or a zine?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build:
- The selling spine: hook then convince then offer then order form, in order, invisible.
- Palette registers: concrete grounds #E9E9E7 to #FFFFFF, ink #0B0B0B, safety orange #FF4D00, occasional full-black block sections.
- Type stacks: Latin display Archivo Black or Space Grotesk 700; mono Space Mono or IBM Plex Mono; body Inter. Arabic display Changa 700; body IBM Plex Sans Arabic.
- The three owned tics: courier-label furniture, receipt rail, chevron rails.
- Motion identity "street snap": 0.4s expo.out, minimal, receipt prints line-by-line as the one signature.
- Desktop law: centered mobile shell (~430px) on raw concrete ground.
- Refused blocks: how-it-works-steps, ingredients-infographic, before-after.
- Imagery style: harsh-flash streetwear photography as specified in Signature Art.

CLIENT-OWNED — re-decided fresh every build:
- Hero composition (from the hero menu or a justified new one).
- Block choice within the supported set and the ORDER of the convince run.
- Form style (from the form menu).
- Proof emphasis: co-signs vs reviews vs chat screenshots — whichever this product's scene respects.
- Edition framing: numbered edition, timed window, or region-limited — pick ONE scarcity axis.
- Ground temperature within register (cool concrete vs warm paper white) and black-block frequency.
Each client gets a new sibling, never a clone. If two Trottoir pages could be mistaken for each other, the second one failed.

3. VISUAL SIGNATURES — measured values

- Grounds: #E9E9E7 concrete primary; #FFFFFF paper sections; #0B0B0B black blocks (max 2 per page). Card/paper surfaces #FFFFFF with 1px #D8D8D5 hairline.
- Ink: #0B0B0B; secondary #5A5A57.
- Safety orange #FF4D00: chevrons, one word per screen max, edition numbers, the CTA. Cap 8% of viewport. On black blocks orange stays #FF4D00; on white never lightens.
- Display: clamp(2rem, 8.5vw, 3rem), caps, letter-spacing -0.01em, line-height 0.95. Archivo Black carries names and totals only.
- Mono captions: 0.7-0.78rem, letter-spacing 0.08em caps (Latin only), for labels, SKUs, timestamps, routing lines.
- Body: Inter clamp(0.95rem, 4vw, 1.02rem), line-height 1.55, short paragraphs only.
- Radii: 0px. Everything squared. The only curve on the page is the barcode's quiet zone. Sticky bar also squared.
- Borders: 1px hairlines #C9C9C6 on paper; dashed 1px #9A9A97 for tear lines; NO thick borders (3px+ is banned — bloc's territory).
- Shadows: none. Paper sits flat on concrete.
- Spacing: section padding-block clamp(48px, 12vw, 80px); label furniture packs tight (8/12px), editorial gaps stay wide (32/48px) — the contrast between dense paperwork and empty concrete is the rhythm.
- Courier-label furniture (tic): white rectangle, 1px hairline, packed rows of mono caps — SKU, EDITION 047/200, ORIGIN, WINDOW — one row may hold a CSS barcode (repeating-linear-gradient vertical bars, 28-40px tall) or a small QR-like block. Used for: hero info plate, spec surfaces, review headers, footer meta.
- Receipt rail (tic): a 300-340px wide thermal receipt — white, dashed tear line top/bottom (or a zigzag clipped edge at the bottom only), mono lines with dotted leader fills, oversized TOTAL row in display face, "PAY ON DELIVERY" stamped line. THE offer surface of this world.
- Chevron rails (tic): repeated mono chevrons (3 to 7 glyphs) in safety orange guiding to the next beat or the form; horizontal strips between sections or a vertical run beside the sticky path. In RTL they point left.

4. COLOR PHYSICS

- Ground register: #E9E9E7 to #FFFFFF. Concrete for the street, white for paper. Sections alternate by MATERIAL logic (street / paper / street), not by stripe habit.
- Black blocks: #0B0B0B sections, max two per page, reserved for the drop moment (hero variant or offer). Ink inverts to #F4F4F2 inside. This is a material shift, never an alternating inversion rhythm.
- Ink register: #0B0B0B primary, #5A5A57 secondary, #F4F4F2 on black.
- Accent: #FF4D00 only. No second accent, no tints of orange — full strength or absent.
- Forbidden: gradients anywhere, red urgency tones, yellow, any pastel, textured backgrounds pretending to be concrete photos — concrete is a flat hex, the FEELING of concrete comes from composition, not texture images.

5. TYPOGRAPHY

Latin stack:
- Display: Archivo Black first; Space Grotesk (700) when the client's object is technical (electronics) — one per build.
- Mono: Space Mono or IBM Plex Mono — captions, labels, receipts, timestamps. Never paragraphs.
- Body: Inter (400/500).
Arabic stack:
- Display: Changa (700) — its condensed weight holds the drop energy in Arabic.
- Body: IBM Plex Sans Arabic (400/500).
- Mono policy in RTL: keep Latin mono for SKUs, timestamps and numbers (they are logistics artifacts and stay LTR inside dir="ltr" spans); Arabic text never set in mono.
Pairing rules: Archivo Black + Space Mono + Inter is the house default; Space Grotesk + IBM Plex Mono + Inter is the technical alternate. Never two display faces in one build.
Size clamps shared across scripts; Arabic display max 2.7rem (10% under Latin top). Weights: display only 700+ (or Archivo Black's single weight); mono 400; body 400/500.
RTL mirroring: logical properties everywhere; chevrons point left for forward; receipt leader dots fill from the correct start side; NEVER letter-spacing on Arabic (tracking is for Latin caps and digits only); Arabic body line-height 1.7-1.9. Digits: Western Arabic numerals for prices, editions, phones.

6. SIGNATURE ART & COMPONENTS

- Courier-label furniture (owned): the world's information container. Every meta surface is a label: the hero's info plate, the spec sheet, even reviewer identities render as mono label rows ("BUYER: SARAH K. — PARIS 11E — VERIFIED").
- Receipt rail (owned): the offer block. Items, delivery line, discount line if any, dotted leaders, giant total, COD stamp line. Printed by the signature motion.
- Chevron rails (owned): orange mono chevrons chaining sections toward the form; the sticky bar may carry a micro chevron run before the CTA label.
- CTA button: squared, #0B0B0B fill with #F4F4F2 text on light grounds; inverts to orange fill #FF4D00 with black text inside black blocks and on the sticky bar. Caps, mono-spaced label, 54px min height.
- Cards: white paper, 1px hairline, 0 radius, tight mono header row + body content.
- Chips: mono caps in 1px hairline rectangles ("EU 42", "1TO", "COLOR: BÉTON").
- Dividers: 1px hairline full-width, or a chevron rail — never decorative flourishes.
- Sticky bar: white paper strip, 1px top hairline, price in mono, CTA squared. Feels like a checkout counter slip.
Imagery (art direction for ANY product in this world): streetwear-drop photography with a harsh on-camera flash look; raw concrete floor or wall as the only backdrop; the product shot close and slightly clinical, like evidence; macro texture crops (sole grain, stitching, brushed metal); safety-orange props allowed sparingly (a cone, a strap, a cable); daylight versions cold and overcast. BANNED in photos: lifestyle smiles, golden hour warmth, studio gradient sweeps, busy urban-collage backgrounds, any visible brand logos. Shots per build: one hero object shot, one macro texture, one top-down flat lay, one in-context street shot, box/unboxing shot for the manifest.

7. THE SPINE

Hook, convince, offer, order form — the invisible law, in that order. Trottoir's implementations:
- Price placement: HERO-FIRST, stated flat on the hero's courier label ("PRIX: 89 €" as a label row — a fact, not a shout). The sticky bar repeats it in mono.
- Sticky CTA: the checkout-counter slip — a white squared bar, price left in mono, "COMMANDER" squared black button right (orange inside black-block contexts); appears after the hero, taps smooth-scroll to the form. RTL mirrors.
- Mobile-first at 390px. Desktop law: CENTERED MOBILE SHELL — the page renders as a ~430px column resting on a raw concrete #E9E9E7 ground; the shell has a 1px hairline edge and the ground stays empty (no decorations on the concrete — emptiness is the luxury).

8. BLOCKS TREATMENT (supported: 14)

- announcement-bar: a mono ticker-free strip: "DROP 004 — FENÊTRE 48H — COD DISPONIBLE". Static text, one orange word max.
- benefits-icons: no icons — a label row list: 3-5 mono caps facts ("CUIR PLEINE FLEUR", "SEMELLE 4CM", "FABRIQUÉ AU PORTUGAL") separated by hairlines. Facts are the benefit.
- spec-table: a full courier label: mono rows, dotted leaders to values, hairline frame. Electronics builds lean here.
- photo-reviews: paper cards with label-row headers (buyer, city, verified) and short body text; photos flash-look; stars rendered as five mono asterisk-like marks in orange, filled count only.
- whatsapp-proof: recreated chat threads inside a paper card, mono timestamps, restrained — 2-3 exchanges max, used when the scene's proof lives in DMs.
- press-badges: co-sign strip — mono caps names/handles separated by chevrons ("VU CHEZ @SNKR.DZ >> RADIO NOVA >> HYPE FR"). No logo images, text-only co-signs.
- guarantee-seal: an authenticity label: "AUTHENTIQUE — VÉRIFIÉ PIÈCE PAR PIÈCE" mono block with a barcode and return-window line. The seal is paperwork, not a medal.
- price-anchor: the receipt rail itself — item line, delivery line, TOTAL oversized, COD stamp. If the build needs an early anchor, a mini-receipt (3 lines) appears after the hero.
- countdown: the WINDOW — mono digits "FERME DANS 23:14:09" inside a label row, no flip animation, no color flashing; the colon does not blink.
- stock-urgency: the EDITION COUNTER — "RESTE 037/200" in display face with the slash mono; decrements are never faked live.
- cross-sell: "AJOUTER AU COLIS" — a second label row under the receipt with a checkbox chip (matching laces, case, strap) that appends a line to the receipt total.
- variant-gallery: colorway chips (mono caps + tiny flash-look thumbnails); selected chip gets an orange 1px outline and its name stamps into the hero label.
- size-guide: apparel builds — a paper table in mono, cm rows, "ENTRE DEUX TAILLES: PRENDS LA GRANDE" one-liner. Flat, no diagrams.
- unboxing-gallery: THE MANIFEST — contents listed as label rows with quantity marks + one top-down flat-lay photo; count badge "5 PIÈCES / COLIS".
(Always present in world skin: hero, order-form, sticky-cta; faq as hairline accordion with mono Q numbers; trust-footer as a final label block with contact, policies, "COD — TOUTES RÉGIONS".)

REFUSED BLOCKS:
- how-it-works-steps: a drop needs no tutorial; explaining usage kills the object's aura.
- ingredients-infographic: nothing here has ingredients; composition belongs on the spec label.
- before-after: transformation-proof is self-improvement grammar — wrong scene entirely.

9. HERO MENU (choose ONE per build)

- THE WAYBILL (label hero): a full courier label as the hero — product name in display caps at top, then mono rows: edition, window, origin, PRIX — CTA stapled at the bottom of the label. The purest Trottoir opening.
- FLAT LAY (photo-split): top 55% a harsh-flash object photo on concrete, bottom a paper plate with name, one-line note, price row and CTA. Desktop: photo and paper sit side by side inside the shell.
- STICKER PRICE (price-first stack): display-face name, the price HUGE in Archivo Black with the edition fraction beside it in mono, CTA immediately, macro photo under. For objects whose price is the flex.
- CCTV LOOP (video hero): the muted loop in a hairline frame with a mono timestamp caption overlay ("07:41 — FILE D'ATTENTE"), name + price on a label row beneath, poster required.
- THE MANIFEST (offer-card hero): hero as a receipt — the product enters as a line item, delivery line, total, CTA at the receipt foot. Radical, best for repeat drops to a warm audience.
- THE QUEUE (story-hook hero): a black block opening with one mono line ("ILS ÉTAIENT 200. RESTE 41.") then the product revealed on paper below with price. Scarcity as narrative.

10. FORM MENU (choose ONE per build)

- CLAIM FORM (single card): one paper card titled in mono "FORMULAIRE DE RÉSERVATION", hairline field rows, squared inputs, black CTA. Reads like customs paperwork.
- CHECKPOINT 1/2/3 (multi-step): three mono-numbered steps (taille+colorway / identité / confirmation), progress as chevrons filling orange, snap transitions. For variant-heavy objects.
- RESERVE / CONFIRM (hero-echo): a 2-field quick-claim strip (name+phone) directly under the hero label for the decided, repeated full-size at page end; both print the same success receipt.
- THE WINDOW (sticky-driven): the sticky slip is the sole entry; tapping slides a full-height form panel up in-page; the panel header shows the countdown window. For timed drops.
All forms: fields 52px+, visible mono labels, region select real (départements/wilayas per market), phone keyboard correct, COD line in the world's voice ("Paiement à la livraison. Aucun prélèvement en ligne."), inline errors in orange, success state = a printed CONFIRMATION receipt with order number, edition hold note and "on vous appelle pour confirmer".

11. MOTION IDENTITY — "street snap"

- Entrances: 0.4s expo.out, x or y 16-24px + fade, stagger 0.05s. Fewer animated elements than any loud world — most content just IS there.
- The ONE signature scroll moment: the receipt rail prints itself — its lines stagger in top-to-bottom, each with a 4px paper-feed upward nudge, 0.06s apart; the TOTAL row lands last with a single 1.02 scale settle.
- Chevron rails: a subtle one-time stagger (each chevron fades in sequence) when a rail enters; no infinite loops.
- Sticky bar: slides up 0.3s.
- Continuous loops: none. The countdown updates by the second without animation flourish.
- Reduced motion: everything static; receipt fully printed.
- Banned motion: marquees, blinking (including the countdown colon), parallax, pinning, overshoot, flicker, hover-scale zooms.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design furniture, Poppins-everything, lorem ipsum, fake trustpilot logos, 3-column icon rows with drop shadows, hero carousels, parallax, backdrop-blur, back.out overshoot.
Neighbor tics banned BY NAME: silhouette's type-over-photo collisions and crimson accent word; manifeste's words-as-layout and black/white inversion-flip rhythm (Trottoir's max-two black blocks are material shifts, never a page-wide alternation); fanzine's torn edges, tape and misregistered print; bloc's hard offset shadows and 3-4px borders; cinetique's telemetry voice and crossing marquees; chantier's stencil spray caps and hazard stripes; affiche's giant punctuation glyphs; phosphore's blinking cursor and prompt furniture; impact's lime duotone photos, workout-set labels and plate-stack markers; souk's starburst badges and price-slash theater.
Refused blocks: how-it-works-steps, ingredients-infographic, before-after.
World temptations to refuse: graffiti textures, spray tags, skate-deck clichés, fake NYC references in Maghreb markets, discount percentages in display type (price is a fact, never a celebration), more than one barcode per viewport.

13. EXAMPLE VARIATIONS

- "BÉTON" (fashion & apparel — chunky sneaker /200): THE WAYBILL hero; order: announcement-bar, benefits-icons (material facts), variant-gallery, size-guide, photo-reviews, stock-urgency (edition counter), receipt price-anchor, faq; CLAIM FORM; mood: pure catalogue-of-evidence, receipt print is the only theater.
- "PALIER 2" (electronics & gadgets — mechanical keyboard): FLAT LAY hero; order: spec-table, benefits-icons, press-badges co-signs, photo-reviews, cross-sell (keycap set), receipt price-anchor, countdown window, faq; CHECKPOINT 1/2/3 form; mood: technical drop, Space Grotesk build, chevrons carry the eye between spec and receipt.
- "ACIER BROSSÉ" (jewelry & watches — steel chain): STICKER PRICE hero; order: benefits-icons, guarantee-seal (authenticity label), photo-reviews, stock-urgency, receipt price-anchor, unboxing-gallery manifest, faq; RESERVE / CONFIRM hero-echo form; mood: price-as-flex, one black block wraps the guarantee label.
- "07:40" (fashion & apparel — varsity jacket): THE QUEUE hero; order: whatsapp-proof, variant-gallery, size-guide, press-badges, receipt price-anchor, countdown, faq; THE WINDOW sticky-driven form; mood: narrative scarcity, black-block open and black-block offer, chevron rail runs the whole spine.
- "SIGNAL" (electronics & gadgets — retro handheld console): CCTV LOOP video hero; order: spec-table, photo-reviews, benefits-icons, cross-sell (case), receipt price-anchor, stock-urgency, faq; CLAIM FORM variant with device-color chips inside; mood: object-as-artifact, the loop's timestamp caption sets the tone.
- "LAITON" (jewelry & watches — signet ring): THE MANIFEST receipt hero; order: benefits-icons (metal facts), guarantee-seal, photo-reviews, size-guide (ring sizes), stock-urgency, faq; RESERVE / CONFIRM form; mood: minimal paper luxury, zero black blocks, the quietest Trottoir.
- "COLIS 9" (fashion & apparel — cap + tote bundle): FLAT LAY hero re-composed as double-object; order: unboxing-gallery manifest, benefits-icons, whatsapp-proof, receipt price-anchor with cross-sell line, countdown, faq; CHECKPOINT 1/2/3; mood: bundle-as-parcel, the manifest is the star and prints like the receipt's cousin.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
