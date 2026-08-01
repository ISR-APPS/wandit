import type { DesignWorld } from "../types";

export const kenz: DesignWorld = {
	id: "kenz",
	name: "Kenz",
	family: "dark-premium",
	tagline: "A vault of black velvet where one product is treasure",
	kind: "cod",
	mood: ["hushed", "opulent", "nocturnal"],
	energy: "quiet",
	priceFeel: "premium",
	industries: [
		"jewelry & watches",
		"beauty & cosmetics",
		"electronics & gadgets",
		"fashion & apparel",
	],
	avoidFor: ["kids & baby", "pets", "home & kitchen"],
	fusesWith: [
		"caravane",
		"falak",
		"hikaya",
		"dahab",
		"oud",
		"mahra",
		"bureau",
		"loulou",
	],
	preview: {
		ground: "#0A0A0D",
		ink: "#F4EDDD",
		accent: "#C6A15B",
		fontFamily: "Amiri",
		sampleWord: "كنز",
	},
	doc: `
KENZ — THE JEWEL VAULT

1. PHILOSOPHY

Kenz means treasure, and the page behaves like the room where treasure is kept. One product sits in the dark. One light finds it. Everything else — words, price, reassurance — approaches quietly, as if not to disturb the object. Where a bazaar page shouts to prove value, Kenz proves value by refusing to shout: black space is the loudest luxury signal there is, and this world spends it recklessly while spending everything else with restraint. The buyer scrolls through darkness the way a visitor walks through a vault: each section is a case, each case holds one idea, and the price arrives not as a plea but as a fact engraved in gold. Kenz sells watches, perfume, fine leather, premium audio — anything a person buys to feel that they own one excellent thing. The selling spine still runs underneath (hook, convince, offer, order form — always in that order), but Kenz walks it slowly, with few words of ivory on near-black, and lets photography carry desire. Copy is short, declarative, second person singular, never exclamatory. If a sentence would survive being whispered by a concierge, it belongs; if it needs an exclamation mark, it does not.

Self-audit before shipping:
- Is there exactly ONE metallic register on the page (gold or silver, never both)?
- Does the hero read as a lit object in darkness, not a dark-themed template?
- Is every ground within #0A0A0D–#111116, with at most one #171310 interlude?
- Is the price set in the metallic, unapologetic, with no starburst, no slash theater?
- Could every sentence be whispered? (No exclamation marks anywhere.)
- Is the spotlight cone visible as light, not just a vignette?
- Does the order form feel like a private ledger, with COD reassurance intact?
- Zero horizontal overflow at 390 / 768 / 1440, and the page readable with JS off?

2. THE VARIATION CONTRACT

WORLD LAW — locked in every build, no exceptions:
- The spine: hook, convince, offer, order form, in order, invisible to the buyer.
- Grounds in the #0A0A0D–#111116 register; ivory ink #F4EDDD; ONE metallic register per build (gold #C6A15B–#D4B36A or silver #C8CDD4); optional single brown-black interlude #171310.
- Type stacks: Cormorant Garamond or Marcellus for display, Jost or Outfit (300/400) for body; Amiri display with Noto Naskh Arabic or Almarai (300) body in Arabic.
- The three owned tics: spotlight cone, gold dust drift, velvet jewel-box panel.
- Motion identity: vault reveals — slow fades from black, 1.0–1.2s, power2.inOut; dust is the only loop.
- Desktop law: centered mobile shell, ~480px, floating on pure black.
- Refused blocks: lottery-contest, stock-urgency, whatsapp-proof, before-after.
- Imagery: single-spotlight product photography on black velvet, museum stillness.

CLIENT-OWNED — re-decided fresh for every client, never carried over:
- Hero composition (choose from the hero menu, or invent within law).
- Block choice within the supported set, and the ORDER those blocks run in.
- Form style (from the form menu), and where the form's compact echo appears, if anywhere.
- Proof type: photo-reviews or video-testimonial or quiet stats — pick per product.
- Metallic choice (gold or silver) and where the interlude ground sits, if used.
- Section density: a watch page may run 8 spare cases; a perfume page may run 12.
Every client receives a new sibling of this world — same blood, new face. A build that copies a previous variation's hero + block order + form combination has failed the contract.

3. VISUAL SIGNATURES

Measured values. Grounds: #0A0A0D base, #0E0E12 alternate, #111116 raised card, #171310 the single permitted warm interlude. Ivory ink #F4EDDD for headings, #C9C2B2 for secondary text, never pure white. Gold register #C6A15B → #D4B36A (highlights), or silver #C8CDD4 with #E2E6EA highlights — one register per build. Display type clamp(34px, 9vw, 52px) with line-height 1.15; section titles clamp(24px, 6.5vw, 34px); body clamp(15px, 4.1vw, 17px) at line-height 1.65 (Latin) / 1.8 (Arabic); price display clamp(28px, 8vw, 44px) in the metallic. Radii: 2px on cards and fields — the vault has edges, not pillows; buttons 2px; only the dust particles are round. Borders: 1px solid rgba(198,161,91,0.45) keylines; the jewel-box uses a keyline INSET 10px inside the card edge, top highlight rgba(255,255,255,0.04). Shadows are banned — darkness does the separating; use ground steps instead. Spacing rhythm: sections breathe at clamp(72px, 18vw, 110px) vertical; inside cards 24–28px padding.

The tics, precisely:
- SPOTLIGHT CONE: a radial-gradient ellipse anchored above the product — center rgba(244,237,221,0.16), mid rgba(244,237,221,0.05), transparent by 65% radius — drawn as a wide cone (width ~140% of the product image, height ~120%) plus a faint floor pool beneath the product. The cone is VISIBLE LIGHT, angled slightly (rotate -4deg), never a symmetric page-center vignette.
- GOLD DUST DRIFT: 14–22 particles, 2–3px, metallic fills at 0.25–0.6 opacity, drifting upward-left at 8–20s loops with slight x wander; confined to hero and offer sections; static (scattered, no motion) under prefers-reduced-motion.
- VELVET JEWEL-BOX PANEL: near-black card (#0E0E12) carrying a velvet grain (a subtle repeating SVG noise at 3–4% opacity), the single 1px metallic keyline inset 10px, content centered, price engraved in the metallic. This panel is the offer's home and may host the form.

4. COLOR PHYSICS

Ground register: #0A0A0D–#111116 — every section lives here; steps between adjacent sections stay within 8 hex points so the page reads as one continuous darkness, not stripes. One interlude only: #171310, reserved for the offer or a provenance moment; a second interlude collapses the vault into a theme. Ink register: #F4EDDD headings, #C9C2B2 body, #8F897B captions — a three-step ivory scale; pure #FFFFFF is forbidden (it reads as UI, not candlelight). Metallic register: gold #C6A15B base, #D4B36A highlight, rgba(198,161,91,0.45) keylines — OR silver #C8CDD4 base, #E2E6EA highlight, rgba(200,205,212,0.4) keylines. The gold-or-silver rule is absolute: one metallic per build, never both, chosen per client (warm products take gold; technical or icy products may take silver). Metallic coverage stays under 8% of any viewport — it is punctuation, not paint. Support: form-error red #B3443F, used only inline in the form. Forbidden: saturated hues of any kind, purple-blue gradients, pure white, warm beiges as grounds (that is caravane's territory), and any second light source color.

5. TYPOGRAPHY

Latin stack. Display: Cormorant Garamond (500/600) first choice — its narrow elegance engraves well; Marcellus as the alternative when the product is architectural (audio, leather). Body: Jost (300/400) or Outfit (300/400) — geometric, cool, invisible. Pairing rule: ONE display + ONE body per build; the display face appears only in the hero title, section titles, and the price; everything else is body. Letter-spacing 0.14em on Latin small-caps labels (12–13px) for case captions.

Arabic stack. Display: Amiri (400/700) — its Naskh contrast mirrors Cormorant's role. Body: Noto Naskh Arabic (400) or Almarai (300/400). Pairing rule: Amiri + Noto Naskh for classical products (jewelry, perfume), Amiri + Almarai when the product is modern (audio, leather).

Shared size clamps as in Visual signatures; Arabic display runs the same clamps but sits visually ~10% larger per glyph, so drop one step if a title wraps past two lines. RTL rules: dir="rtl" on the root; logical properties only (margin-inline, inset-inline); NEVER letter-spacing on Arabic text — tracking applies to Latin and digits only; Arabic body line-height 1.8; prices and phone numbers use Western digits (0-9) wrapped LTR; directional motion mirrors (x offsets flip sign).

6. SIGNATURE ART & COMPONENTS

The spotlight cone is built as two absolutely-positioned gradient layers behind the product image (cone + floor pool) so the photograph appears to be LIT rather than pasted. The jewel-box panel is the world's altar: velvet grain, inset keyline, centered composition — price anchors, offers, and the ledger form all live inside it. Dust drift is one small JS loop creating particles inside a clipped container — never page-wide confetti.

Supporting cast: buttons are 2px-radius bars in the metallic with #0A0A0D text, full-width on mobile, label in letter-spaced caps (Latin) or Amiri 700 (Arabic); a ghost variant exists — 1px metallic keyline, ivory text — for secondary actions only. Cards are ground-step panels (#111116) with no border; only the jewel-box gets the keyline. Chips are 1px-keyline lozenges, 2px radius, 12px ivory caps ("COD", "توصيل ٤٨ ساعة" with digits kept Western: "48"). Dividers: a 1px line fading from transparent through the metallic and back, max-width 120px, centered. Section labels: tiny metallic small-caps above titles ("THE MOVEMENT", "التفاصيل").

Imagery. Every photograph obeys one direction: the product on black velvet or black stone, a single overhead spotlight, metallic rim light matching the build's register, deep shadow falloff to true black at the edges, macro details shot close enough to show machining, grain, or nap. Museum-grade stillness: no lifestyle scenes, no hands unless wearing/holding in darkness, no daylight, no colored gels, no props that are not the product's own materials (its strap, its cap, its box). Backgrounds must fall to #0A0A0D so images dissolve into the page. Frames: full-bleed or inside the jewel-box; never white-matted. This direction reproduces for any Kenz product: a serum bottle, a cuff, an earbud case — all become treasure under the same light.

7. THE SPINE

Hook, convince, offer, order form — invisible law, in that order, every build. Kenz's price placement: the price appears IN THE HERO, engraved in the metallic beneath the product name — quiet confidence is the sell; hiding the price would read as apology. The sticky CTA is a thin bottom bar (#0E0E12, 1px metallic top keyline) carrying the price at the start edge and a metallic "Order" bar at the end edge; it appears after the hero scrolls past and smooth-scrolls to the order form. Mobile-first: designed at 390px. Desktop law: centered mobile shell — a ~480px column floating on pure #000000, the shell's own ground #0A0A0D distinguishing it; the black around it is not empty, it is the vault.

8. BLOCKS TREATMENT

Supported blocks and their Kenz dressing:
- announcement-bar: a single line of 12px ivory small-caps between hairline keylines — "التوصيل مجاني — الدفع عند الاستلام" — no rotation, no blink.
- ingredients-infographic: "the composition" — for perfume/beauty: notes listed as an engraved menu (name ivory, origin caption, percentage in metallic), product macro beside; never cartoon molecule icons.
- spec-table: an engraved plate — two-column rows, ivory label / metallic value, 1px rgba keyline rules; six rows maximum, each one earned.
- variant-gallery: velvet trays — variants as 2px-radius tiles on #111116, selected tray gains the metallic keyline; variant names in small caps.
- unboxing-gallery: "the presentation" — what the courier hands over, shot as one composed flat-lay in the house light plus a listed inventory with metallic counts; the COD moment dignified.
- photo-reviews: patron plates — short quotes on #111116 plates, reviewer as initials + city in small caps ("م.ب — دبي"), stars replaced by a single metallic line rating ("9.6 / 10"); no avatars.
- video-testimonial: one muted loop inside the jewel-box or full-bleed — the product turning under the spotlight; poster mandatory, ≤2 MB, hidden under reduced motion.
- price-anchor: the jewel-box panel itself — old price in small struck ivory, the price engraved large in the metallic, one line of per-day math if the product warrants ("درهمان في اليوم").
- guarantee-seal: not a badge — a keyline-framed statement: "Seven days. If it does not feel like treasure, return it." plus the COD line; signature-style rule beneath.
- order-steps: four small numbered ivory steps with metallic numerals — order, confirmation call, delivery, pay at the door; one line each, no icons.
- faq: hairline-separated rows, question in ivory, answer in #C9C2B2; chevrons thin and metallic; five questions maximum.
- trust-footer: near-silent — brand mark, one phone line, policies in 12px captions, "الدفع عند الاستلام في كل الإمارات" as the closing line.

Refused blocks: lottery-contest (a vault does not raffle), stock-urgency (scarcity is implied by worth, not counters), whatsapp-proof (chat bubbles break the hush), before-after (treasure has no before).

9. HERO MENU

- The Vault Stack: centered column — small-caps house label, product name in display type, the product under the full spotlight cone, price engraved beneath, one metallic bar CTA. The default and the purest.
- The Treasure Reveal: opens on near-black with a single ivory line ("Some things are bought once."); the product fades in under the cone as the second beat; price and CTA arrive last. For perfume and story-led products.
- The Macro Whisper: an extreme macro detail fills the viewport top — dial machining, leather nap, nozzle knurl — with name, one caption, price, CTA on the lower velvet panel. For products whose craft survives closeness.
- The Jewel-Box Hero: the velvet jewel-box panel IS the hero — product image inside the keyline, name, price, CTA all within one boxed composition on the black ground. For offer-forward builds.
- The Turning Loop: video hero — the muted spotlight rotation loop full-bleed behind name and price; poster first paint; dust confined to the loop's edges. For watches and audio.
- The Split Case: mobile vertical split — top 60% full-bleed photograph falling to black, bottom 40% a raised #111116 case with name, price, CTA. For builds needing a denser first viewport.

10. FORM MENU

- The Ledger: one jewel-box panel holding the full form — fields as 1px-keyline underlined lines on velvet, ivory labels above, metallic submit bar. Success state: the panel empties to an engraved order number and "We will call you to confirm."
- The Private Appointment: a three-step wizard inside the jewel-box — your selection, your details, your confirmation — steps marked by three small metallic dots; one field group per step; back/next as ghost buttons.
- The Hero Echo: two fields (name, phone) and a metallic bar directly beneath the hero price for the decided buyer, then the full Ledger at the page's end; the echo's success scrolls to the full confirmation.
- The Summoned Form: sticky-bar-driven — the page carries no visible form until the bar's CTA is touched; the Ledger then reveals at the end and receives focus. For the sparest builds.

11. MOTION IDENTITY

Vault reveals: elements fade from black — opacity 0 to 1 with scale 1.03 to 1 — power2.inOut, 1.0–1.2s, stagger 0.12s, triggered at 75% viewport. The ONE signature scroll moment: on load, the hero spotlight cone brightens from 0 to full over 1.4s, as if a curator switched on the light — this happens once, only in the hero. Dust drifts continuously (the only loop). The sticky bar fades in over 0.6s after the hero. Banned motion: bounces and overshoot, spins, parallax layers, marquees, letter-by-letter typing, Ken-Burns photo scrubs, any duration under 0.6s. Reduced motion: everything visible immediately, dust static, spotlight at full.

12. BAN LIST

Generic slop: purple-blue gradients, glassmorphism, emoji as design, Poppins-everything, lorem ipsum, fake trust logos, cookie-cutter icon rows with drop shadows, hero carousels, parallax overuse, backdrop-blur, back.out overshoot. Neighbor tics banned by name: nocturne's letterboxed 21:9 crops, champagne-foil small caps and Ken-Burns scrubs; orfevre's self-drawing gold engravings and double-hairline filigree frames; an2000's lens-flare sparkles and chrome bevels; voltage's neon glow and glowing glass panels; caravane's kilim bands and saddle stitches; rimel's blush orbs and shine sweep. Kenz's own temptations, also banned: two metallics in one build, gold TEXT paragraphs (metallic is for price, keylines, labels only), vignette-instead-of-cone laziness, luxury-brand name-dropping in copy, and exclamation marks. Cross-library: iris's single radial aura (a soft ambient halo as the page's only light) is banned — Kenz light is always a DIRECTIONAL cone with visible beam edges, never an ambient glow. Refused blocks: lottery-contest, stock-urgency, whatsapp-proof, before-after.

13. EXAMPLE VARIATIONS

- Al-Khazna (jewelry & watches, Arabic RTL): The Vault Stack hero into announcement-bar, spec-table (movement, sapphire, water resistance), Macro gallery via variant-gallery trays (dial colors), photo-reviews plates, price-anchor jewel-box, order-steps, The Ledger form, faq, trust-footer. Gold register. Dust emphasized in the hero only. Mood: a watch bought to be inherited.
- Oud Al-Layl (beauty & cosmetics, perfume): The Treasure Reveal hero, then ingredients-infographic as an engraved note menu (oud, saffron, amber with origins), unboxing-gallery flat-lay, patron plates, jewel-box price-anchor with per-day math, The Hero Echo form pattern (echo under hero, Ledger at end), guarantee-seal, trust-footer. Gold register, #171310 interlude behind the composition. The reveal line: "بعض العطور لا تُنسى."
- Noir Céramique (electronics & gadgets, flagship earbuds): The Turning Loop video hero, silver register throughout, spec-table engraved plate, variant-gallery (ceramic white / graphite trays), video-testimonial loop of the case closing, price-anchor, The Private Appointment wizard, faq, trust-footer. Dust silver and sparse. Museum-of-technology stillness.
- La Main (fashion & apparel, leather gloves): The Macro Whisper hero — nap and stitching at full viewport — then a short provenance passage (problem-solution dressed as craft story is NOT used; instead ingredients-infographic lists hides and tanning), size-guide-free (gloves sized via variant-gallery S/M/L trays), photo-reviews, guarantee-seal, price-anchor, The Summoned Form via sticky bar. Gold register, no interlude, eight sections total — the sparest sibling.
- Sultana (jewelry & watches, gold bracelet, Arabic RTL): The Jewel-Box Hero carrying product and price together, unboxing-gallery (velvet pouch, certificate), patron plates with city names across the Gulf, order-steps, The Private Appointment wizard (selection: bracelet length), faq, trust-footer. Gold register; the single interlude hosts a one-line provenance: "ذهب عيار ١٨". Spotlight emphasis on the offer section rather than the hero.
- Velours (fashion & apparel, silk scarf): The Split Case hero, variant-gallery trays of three patterns, one muted drape loop as video-testimonial, price-anchor, guarantee-seal, The Hero Echo form, trust-footer. Silver register — icy elegance; dust omitted entirely (the permitted minimum), the cone carried by the drape loop's lighting.

These show the range. NEVER copy one — remix their choices or invent a new variation in the same spirit.
`,
};
