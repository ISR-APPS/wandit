export type CodBlockCategory =
	| "spine"
	| "persuasion"
	| "offer"
	| "product-detail"
	| "logistics-trust";

export const COD_BLOCKS: readonly {
	id: string;
	category: CodBlockCategory;
	description: string;
}[] = [
	{
		id: "hero",
		category: "spine",
		description:
			"The opening viewport: product identity, the promise in one line, and the first price appearance (unless the world's law puts first price on the sticky bar).\nTypical content: product name, hook headline, hero imagery, price + old price, primary CTA, 2-3 micro-trust chips (COD badge, delivery time, guarantee).",
	},
	{
		id: "order-form",
		category: "spine",
		description:
			"The page's single conversion goal — the COD order form.\nTypical content: full name, phone, wilaya/region select, city, product options (variant/qty/bundle), submit button, near-form reassurance (pay on delivery, delivery delay, return policy), success state.",
	},
	{
		id: "sticky-cta",
		category: "spine",
		description:
			"The ever-reachable order button — bar or floating pill; tapping scrolls to `order-form`.\nTypical content: CTA label, price (or price appears here first if the world's law says so), sometimes a mini countdown or stock note.",
	},
	{
		id: "announcement-bar",
		category: "persuasion",
		description:
			'Thin strip above/below the hero setting the deal frame before anything else.\nTypical content: free delivery threshold, "paiement à la livraison", offer deadline, rotating messages.',
	},
	{
		id: "problem-solution",
		category: "persuasion",
		description:
			"Agitates the everyday pain, then flips to the product as the answer.\nTypical content: 2-4 pain lines or mini-scenes, a turning point sentence, product-in-action imagery.",
	},
	{
		id: "benefits-icons",
		category: "persuasion",
		description:
			"Fast-scan strip of what the buyer gains.\nTypical content: 3-6 icon + short-label chips (results, comfort, savings, ease).",
	},
	{
		id: "ingredients-infographic",
		category: "persuasion",
		description:
			'What\'s inside and why it works — the credibility X-ray.\nTypical content: annotated product visual, ingredient/component list with % or mg, origin notes, "free of" list.',
	},
	{
		id: "how-it-works-steps",
		category: "persuasion",
		description:
			"Numbered usage ritual proving it's easy.\nTypical content: 3-4 steps, each icon/photo + one sentence, optional time-per-step.",
	},
	{
		id: "before-after",
		category: "persuasion",
		description:
			"Visual transformation proof.\nTypical content: paired photos (slider or side-by-side), timeframe caption, honesty disclaimer.",
	},
	{
		id: "spec-table",
		category: "persuasion",
		description:
			"Hard technical facts for gadget-minded buyers.\nTypical content: rows of dimension/battery/power/material/capacity with values and units, what's-compatible notes.",
	},
	{
		id: "comparison-table",
		category: "persuasion",
		description:
			"Us vs the old way / vs cheap alternatives — the check-cross matrix.\nTypical content: 4-7 criteria rows, product column vs 1-2 rival columns, check/cross marks.",
	},
	{
		id: "stats-band",
		category: "persuasion",
		description:
			"Big numbers that make the crowd visible.\nTypical content: orders delivered, average rating, cities covered, years/units — 3-4 counters.",
	},
	{
		id: "video-testimonial",
		category: "persuasion",
		description:
			"Moving proof: the product working, or a customer speaking (always muted).\nTypical content: ONE short muted loop ≤2 MB with poster image (hidden under prefers-reduced-motion), caption line, star row.",
	},
	{
		id: "photo-reviews",
		category: "persuasion",
		description:
			'Written reviews from named buyers, ideally with customer photos.\nTypical content: 3-8 review cards — name, city, stars, 1-3 sentences, optional photo, "verified COD order" tag.',
	},
	{
		id: "whatsapp-proof",
		category: "persuasion",
		description:
			"Chat-culture proof: conversations customers actually have.\nTypical content: recreated WhatsApp/DM threads — order confirmations, thank-you messages, reorder requests; timestamps, read ticks.",
	},
	{
		id: "press-badges",
		category: "persuasion",
		description:
			'Borrowed authority strip.\nTypical content: "seen on" logos or badges (TV shows, TikTok/Instagram virality, marketplaces), certifications.',
	},
	{
		id: "guarantee-seal",
		category: "persuasion",
		description:
			'The risk-reversal moment made visual.\nTypical content: seal/badge artwork, guarantee text (exchange/return window), "pay only when you receive it" restatement.',
	},
	{
		id: "price-anchor",
		category: "offer",
		description:
			"A dedicated beat that makes the price feel like a win.\nTypical content: old price struck, new price large, savings amount/%, per-day or per-use math, payment-on-delivery note.",
	},
	{
		id: "bundle-offers",
		category: "offer",
		description:
			'Quantity packs that raise average order value.\nTypical content: 1x/2x/3x cards with per-unit price falling, "most popular" flag, free-delivery flag on bigger packs, selectable — feeds `order-form`.',
	},
	{
		id: "countdown",
		category: "offer",
		description:
			"Deadline pressure for the current offer.\nTypical content: D/H/M/S timer, what expires (price or gift), restock honesty line.",
	},
	{
		id: "stock-urgency",
		category: "offer",
		description:
			'Scarcity made visible.\nTypical content: remaining units count or meter, "X people ordered today", last-restock date.',
	},
	{
		id: "lottery-contest",
		category: "offer",
		description:
			"Buy-to-enter prize mechanics for promo-driven audiences.\nTypical content: prize description, entry rule (every order = ticket), draw date, past winners.",
	},
	{
		id: "cross-sell",
		category: "offer",
		description:
			"One more thing at a can't-refuse price.\nTypical content: companion product card with add-on price, single checkbox/toggle that feeds `order-form`.",
	},
	{
		id: "variant-gallery",
		category: "product-detail",
		description:
			"Choice as desire: colors, sizes, models shown as objects.\nTypical content: variant thumbnails/swatches with per-variant imagery, selected state — feeds `order-form`.",
	},
	{
		id: "size-guide",
		category: "product-detail",
		description:
			'Kills the #1 apparel objection: "will it fit?"\nTypical content: measurement table (cm), how-to-measure diagram, model-wears reference.',
	},
	{
		id: "unboxing-gallery",
		category: "product-detail",
		description:
			'Everything the courier hands over.\nTypical content: "in the box" grid — product, accessories, manual, gift; count badge ("7 pièces").',
	},
	{
		id: "order-steps",
		category: "logistics-trust",
		description:
			"How COD works, step by step — removes fear of the unknown.\nTypical content: 3-4 steps: fill form → confirmation call → delivery in X days → pay at the door; icons per step.",
	},
	{
		id: "delivery-map",
		category: "logistics-trust",
		description:
			"Where and how fast we deliver.\nTypical content: coverage map or wilaya/city list, delivery time + fee per zone, home vs pickup-point option.",
	},
	{
		id: "faq",
		category: "logistics-trust",
		description:
			"Objections answered one tap away.\nTypical content: 4-8 collapsible Q/A — payment, delivery time, returns, authenticity, usage.",
	},
	{
		id: "trust-footer",
		category: "logistics-trust",
		description:
			'The quiet end-of-page reassurance.\nTypical content: brand line, phone/WhatsApp contact, social links, policy links, legal mentions, "COD across all wilayas".',
	},
];

export const COD_BLOCK_IDS: readonly string[] = COD_BLOCKS.map(
	(block) => block.id,
);

export function formatCodBlocks(): string {
	return COD_BLOCKS.map((block) => {
		const summary = block.description.split("\n", 1)[0] ?? block.description;
		return `- ${block.id} — ${summary.replaceAll("`", "")}`;
	}).join("\n");
}
