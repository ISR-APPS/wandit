import type { DesignWorld } from "../types";
import { formatCodBlocks } from "./blocks";

export const COD_GENRE_DOC =
	`# COD FUNNEL GENRE — SHARED LAW

This is genre law and outranks generic builder defaults. Worlds supply the skin; this document supplies the selling anatomy. A world's refused blocks remain law.

## 1. THE GENRE: A PITCH THE VISITOR ANSWERS

A COD page is a PITCH answered on a phone, not a dossier to admire or a polished service/agency landing page. Sell one physical product through one corridor into one form. The invisible spine is hook → convince → offer → order form. hero, order-form and sticky-cta always exist; everything else is a deliberate menu choice. Every scene must earn the next tap.

## 2. THE BLOCK VOCABULARY

SECTIONS in the brief use these permanent ids in order. World docs dress them through BLOCKS TREATMENT; they never rename them. Apply the UNION of every supplied world's refused blocks: drop a refused block even when the brief lists it, then cover its job through another permitted scene.

` +
	formatCodBlocks() +
	`

The three spine blocks are mandatory. Everything else is a menu, not a checklist. Never invent private block ids.

## 3. NO-NAVIGATION LAW

No nav bar, anchor menu, drawer or footer sitemap. Every link, including a linked brand mark, must scroll to order-form, open a supplied tel: or wa.me contact, or toggle a details element. trust-footer is reassurance, never navigation.

## 4. PRICE AND CTA CADENCE

Put struck-old + large-new price in the first mobile viewport, in accent color and display face, unless the base world explicitly puts first price in the sticky bar. Show price on at least 5 synchronized surfaces: hero, offer beat, every bundle option, form total and sticky bar. Bundle selection updates them all.

Place a CTA every 1-2 scenes, at least 4 total. Primary CTAs scroll to the one form, stand at least 52px tall and go full-width on mobile.

## 5. STICKY BAR TRIPLE LAW

All three are mandatory: body padding reserves the bar height plus env(safe-area-inset-bottom); the bar hides while order-form is in view; success removes it and resets body padding. In-flow CTAs and the form still work without JavaScript.

## 6. THE ORDER FORM CANON

order-form is the climax and only purchase form. Collect full name or first+last; phone with type=tel, inputmode=numeric, dir=ltr and the locale regex; region select (wilaya in Algeria); commune/address text. Never collect email.

When the offer needs them: bundle RADIO CARDS, never a select; per-item variant selects; delivery-method radios with explicit home versus desk/pickup/stopdesk fees. Compute and update a visible 3-row summary: product / delivery / grand total. Never say fees to be confirmed.

Put order-steps before the form. Within one scene of submit state: pay nothing now, supplied delivery window, supplied exchange window. Dispatch the base prompt's wandit:lead event with canonical name, phone, wilaya and commune keys; extras use their own keys.

Success REPLACES the form card with an order number and recap of product, option, delivery and total. Kill sticky-cta and reset body padding; never redirect or leave a second active submit.

## 7. PROOF HONESTY

Reviews use first name + city + stars. photo-reviews requires one supplied review below 5 stars with a minor complaint and one supplied photo review. Never invent reviews, people, cities, photos, counts, results, certifications or press badges; use demonstration/process proof when evidence is absent.

Use at most ONE countdown OR stock line, only when a world permits it and the brief supplies the fact. Name the real deadline or a real specific count. Never invent urgency, live viewers or recent orders.

## 8. PHOTO ECONOMY

User photos are raw material: large, full-bleed or near, 1:1 or 4:5 on mobile, about one per 1.5 scenes when available. Caption them into evidence with supplied where/when/who. Use a flyer with baked-in text or prices WHOLE: never type over it or crop away its price. Give an amateur phone photo a ground that makes it the only bright thing.

When the brief supplies NO user photos, the product must still be SEEN: generating the product shots with generate_image is MANDATORY — execute the brief's SHOT LIST when present, otherwise decide the shot count yourself under the photo-economy law: as many as the page genuinely needs, judged against the selected blocks rather than any fixed habit (one clean packshot-style hero cut first, then the context/use scenes those blocks call for), staying faithful to every product fact the brief states. When image generation is unavailable or fails, no product frame is left empty and no URL is ever invented: render the slot with the builder prompt's replaceable placeholder <img> convention (data-wandit-placeholder) so the merchant can upload the real photo later — that convention outranks any world line that forbids drawing a placeholder.

## 9. LANGUAGE, RTL AND DIGITS

Write in the brief's language and register: second-person and dialect-warm, never corporate. Emoji may live inside sentences, never as the icon system.

For Arabic use logical CSS properties and Western Arabic numerals 0-9 for every price/count. Wrap price numerals and phones in dir=ltr spans. Draw old-price strikes with a positioned pseudo-element, never text-decoration. No Arabic letter-spacing; body line-height ≥1.75, display ≥1.38. Mirror directional ornaments by meaning.

## 10. LOCALE VARIABLES

Phone regex, currency glyph/placement, region label/options and delivery fees come from market facts in the brief. Worldwide builds replace every locale value, not just labels. Algeria default: /^0[567]\\d{8}$/, DZD as دج or DZD with thin-space thousands, all 58 wilayas, commune, and explicit home-vs-stopdesk fees.

## 11. DESKTOP LAW

The WORLD picks exactly one: a centered 430-470px mobile shell on a designed ground, OR responsive expansion capped at 1040-1100px with 1-2 columns. Expansion is a RECOMPOSITION, not a magnification: the hero pairs media with the offer stack in two columns, at least one proof or offer band goes 2-column, body text caps near 60-75ch, and display type scales with clamp() to a hard maximum. A desktop that is the phone layout scaled up — same single column, same giant type — is a FAILED desktop treatment. Never a 12-column editorial grid or pinned desktop-only scrub. Zero horizontal overflow at 390/768/1440. The page reads and converts with JS off.

## 12. PAGE LENGTH IS A DECISION

Choose the brief/world density pole: short aggressive at about 4-5 blocks, or full ceremony at 10-13. Never average them. Every scene needs one distinct persuasion job.

## 13. TOKEN BRIDGE

World literal hexes, font names and radii are VALUES of required tokens: ground → --background; ink → --foreground; CTA/accent → --primary; radius law → --radius; stacks → --font-heading/--font-body. Fill --secondary, --accent, --muted, --border and --primary-foreground from the world's palette.

The first style's first :root declares exactly those 11 tokens and no others. Extra world properties live in another declaration. Outside :root every rendered color/font/radius uses var(--token) or legal token mixes; visibly consume var(--background), var(--foreground), var(--primary), var(--font-body) and var(--radius). World literals survive only as token values, never scattered CSS.

## 14. SLOP BANS

Ban repeated uniform icon-card rows, generic outline icon systems, empty claims such as high quality or جودة عالية, 5-stars-only proof, purple-blue gradients, glassmorphism, hero carousels, one-time price/CTA and whitespace-as-luxury pacing. Concrete beats abstract: use a number, place or duration. The result must be a selling corridor in its world's skin, never an agency template with a form attached.
`;

export function FUSION_CONTRACT(worlds: readonly DesignWorld[]): string {
	const [primary, ...support] = worlds;
	if (!primary) {
		return "No world documents resolved. Apply the COD genre law directly and produce one coherent funnel.";
	}

	const donorNames = support.length
		? support.map((world) => world.name).join(", ")
		: "none";

	return [
		"# WORLD FUSION CONTRACT",
		`You received ${worlds.length} world doc${worlds.length === 1 ? "" : "s"}. The FIRST (${primary.name}) is the BASE: its palette registers, type stacks, spine law, refused blocks and motion identity govern this build.`,
		`The others (${donorNames}) are DONORS: borrow at most 1-2 signature elements or tics from each where they strengthen the base — a component treatment, a proof register or an ornament family — re-dressed in the base world's skin.`,
		"Where any two docs conflict, the base wins. Refused blocks: the UNION of all supplied worlds' refusals applies.",
		"The final page must read as ONE coherent brand — a new pressing, not a patchwork — and must not be a recognizable copy of any single doc's example variations.",
	].join("\n");
}
