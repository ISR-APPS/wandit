// All landing copy lives here so a locale swap stays cheap.

export const LANDING_NAV = {
	links: [
		{ label: "How it works", id: "how-it-works" },
		{ label: "Examples", id: "examples" },
		{ label: "Pricing", id: "pricing" },
		{ label: "FAQ", id: "faq" },
	],
	signIn: "Sign in",
	getStarted: "Get started",
	dashboard: "Dashboard",
} as const;

export const HERO = {
	titleLine1: "Type it. Launch it.",
	titleLine2: "Sell it.",
	sub: "Wandit turns a prompt into a ready-to-run landing page — publish and collect COD orders in minutes.",
	chips: [
		{
			label: "COD product page",
			prompt:
				"A COD product page for a vintage leather watch — hero shot, three benefit blocks, and an order form with wilaya and commune fields.",
		},
		{
			label: "Site vitrine",
			prompt:
				"Un site vitrine élégant pour un cabinet dentaire à Alger — services, équipe, horaires et prise de rendez-vous.",
		},
		{
			label: "Service page",
			prompt:
				"A landing page for a media-buying training program in French — curriculum, testimonials, and an enrollment form.",
		},
		{
			label: "Promo page",
			prompt:
				"A limited-time promo page for a sneakers drop in Algiers — bold visuals, size picker, and COD checkout.",
		},
	],
	trust: ["Pages in AR & FR", "COD order forms", "Publish in one click"],
} as const;

export const HOW_IT_WORKS = {
	kicker: "How it works",
	title: "Three steps to your first order.",
	steps: [
		{
			number: "01",
			title: "Describe it",
			body: "Type what you sell in Arabic, French or English. Wandit drafts a complete landing page in seconds.",
		},
		{
			number: "02",
			title: "Make it yours",
			body: "Iterate in chat — swap sections, colors and copy. Every change becomes a version you can roll back.",
		},
		{
			number: "03",
			title: "Publish & sell",
			body: "Go live on your-page.wandit.app in one click. COD orders land straight in your leads inbox.",
		},
	],
} as const;

export type ExampleItem = {
	id: string;
	name: string;
	category: string;
	prompt: string;
	rtl?: boolean;
};

export const EXAMPLES = {
	kicker: "Examples",
	title: "Made with Wandit",
	sub: "The page types sellers launch every day — pick one to start from it.",
	items: [
		{
			id: "watch",
			name: "Montre Vintage COD",
			category: "COD product",
			prompt:
				"A COD product page for a vintage leather watch — hero shot, three benefit blocks, and an order form with wilaya and commune fields.",
		},
		{
			id: "honey",
			name: "عسل الأوراس",
			category: "COD product",
			prompt:
				"صفحة هبوط لعسل جبلي حر من الأوراس — قصة المنتج، فوائده، ونموذج طلب بالدفع عند الاستلام.",
			rtl: true,
		},
		{
			id: "serum",
			name: "Serum Éclat",
			category: "Beauty",
			prompt:
				"Page produit pour un sérum éclat à la vitamine C — avant/après, ingrédients, et formulaire de commande COD.",
		},
		{
			id: "dental",
			name: "Cabinet Dentaire Amine",
			category: "Site vitrine",
			prompt:
				"Un site vitrine pour un cabinet dentaire à Alger — services, équipe, horaires et prise de rendez-vous.",
		},
		{
			id: "formation",
			name: "Formation Ads FR",
			category: "Service",
			prompt:
				"A landing page for a media-buying training program in French — curriculum, testimonials, and an enrollment form.",
		},
		{
			id: "sneakers",
			name: "Sneakers Drop DZ",
			category: "Promo",
			prompt:
				"A limited-time promo page for a sneakers drop in Algiers — bold visuals, size picker, and COD checkout.",
		},
	] satisfies ExampleItem[],
} as const;

export const FEATURES = {
	kicker: "Why Wandit",
	title: "Built for how you actually sell.",
	items: {
		rtl: {
			title: "AR & RTL from day one",
			body: "Prompt in Arabic and get a native right-to-left page — layout, type and order form included. French too.",
		},
		leads: {
			title: "COD leads CRM",
			body: "Every order lands in a pipeline you can work — confirm, ship, done.",
		},
		publish: {
			title: "One-click publish",
			body: "Your page live on a real address in seconds. No hosting to think about.",
		},
		credits: {
			title: "Transparent credits",
			body: "Every action shows its price before you act. No surprise bills.",
		},
		mobile: {
			title: "Mobile-first pages",
			body: "Designed for the phones your buyers actually scroll on.",
		},
		versions: {
			title: "Versions & rollback",
			body: "Every edit is a version. Restore any of them in one click.",
		},
	},
	pipeline: ["to confirm", "confirmed", "shipped"],
	publishUrl: { slug: "montre-vintage", domain: ".wandit.app" },
} as const;

export const PRICING = {
	kicker: "Pricing",
	title: "Start free. Scale when you sell.",
	note: "Publishing and lead collection are always free.",
	free: {
		name: "Free",
		tagline: "For your first pages",
		price: "Free",
		creditsLine: "100 credits included",
		features: [
			"Enough credits for ~10 pages",
			"Publishing always free",
			"Lead collection always free",
			"Pages in AR, FR & EN",
		],
		cta: "Start free",
	},
	pro: {
		name: "Pro",
		badge: "Popular",
		tagline: "For sellers running ads",
		priceNote: "Early-bird pricing — soon",
		sliderLabel: "Credits per pack",
		creditsUnit: "credits",
		features: [
			"Everything in Free",
			"Bigger credit packs",
			"Priority generation",
			"Remove the Wandit badge",
		],
		cta: "Get early access",
		slider: { min: 500, max: 5000, step: 250, initial: 1000 },
	},
	business: {
		name: "Business",
		tagline: "For agencies & teams",
		price: "Custom",
		features: ["Seats for your team", "Client workspaces", "White-label pages"],
		cta: "Contact us",
		contactHref: "mailto:hello@wandit.dev",
	},
} as const;

export const FAQ = {
	kicker: "FAQ",
	title: "Questions, answered.",
	items: [
		{
			q: "What are credits?",
			a: "Credits are Wandit's single currency. Generating a page costs 10 credits, a chat edit costs 1 — and you always see the price before you act.",
		},
		{
			q: "Is publishing free?",
			a: "Yes. Publishing your page and collecting leads never cost credits. You only spend when the AI works for you.",
		},
		{
			q: "Do you support Arabic and RTL?",
			a: "Fully. Prompt in Arabic and you get a native right-to-left page — layout, typography and order form included.",
		},
		{
			q: "Where do my pages live?",
			a: "Every published page gets a your-page.wandit.app address on fast hosting. Custom domains are on the roadmap.",
		},
		{
			q: "What happens when my credits run out?",
			a: "Your published pages stay live and keep collecting orders. You just can't generate or edit until you top up.",
		},
	],
} as const;

export const CTA_BAND = {
	title: "From prompt to first order.",
	sub: "Describe your product tonight. Take orders tomorrow.",
	button: "Start building free",
} as const;

export const FOOTER = {
	tagline: "The fastest way from an idea to a page that sells.",
	columns: [
		{
			title: "Product",
			links: [
				{ label: "How it works", id: "how-it-works" },
				{ label: "Examples", id: "examples" },
				{ label: "Pricing", id: "pricing" },
			],
		},
		{
			title: "Company",
			links: [
				{ label: "Docs", id: null },
				{ label: "Support", id: null },
				{ label: "Contact", id: null },
			],
		},
	],
	copyright: "© 2026 Wandit",
	madeIn: "Made for sellers in DZ",
} as const;
