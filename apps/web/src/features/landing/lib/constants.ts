// Non-copy landing config. All copy lives in dictionaries/*/landing.json and is
// read via useTranslation()/useDictionary(); only structural config stays here.

/**
 * Nav link scroll-target ids, in display order. Labels: landing.nav.links.<id>.
 * "pricing" is special-cased in LandingNav as a route link to /pricing.
 */
export const LANDING_NAV_LINK_IDS = [
	"how-it-works",
	"examples",
	"pricing",
	"faq",
] as const;

/** Example gallery config: id keys landing.examples.items.<id> + ART; rtl drives dir. */
export const EXAMPLE_ITEMS = [
	{ id: "watch", rtl: false },
	{ id: "honey", rtl: true },
	{ id: "serum", rtl: false },
	{ id: "dental", rtl: false },
	{ id: "formation", rtl: false },
	{ id: "sneakers", rtl: false },
] as const;

export type ExampleItemId = (typeof EXAMPLE_ITEMS)[number]["id"];

/** Non-copy bits of the features bento (a demo publish URL). */
export const FEATURES_CONFIG = {
	publishUrl: { slug: "montre-vintage", domain: ".wandit.app" },
} as const;

/**
 * Footer columns: link `key` keys landing.footer.linkLabels.<key>; scrollId
 * drives anchors. "pricing" is special-cased in LandingFooter as a route link.
 */
export const FOOTER_COLUMNS = [
	{
		id: "product",
		links: [
			{ key: "how-it-works", scrollId: "how-it-works" },
			{ key: "examples", scrollId: "examples" },
			{ key: "pricing", scrollId: null },
		],
	},
	{
		id: "company",
		links: [
			{ key: "docs", scrollId: null },
			{ key: "support", scrollId: null },
			{ key: "contact", scrollId: null },
		],
	},
] as const;
