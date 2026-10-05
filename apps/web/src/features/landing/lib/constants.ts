// Non-copy landing config. All copy lives in dictionaries/*/landing.json and is
// read via useTranslation()/useDictionary(); only structural config stays here.

import type { TargetPlatform } from "@wandit/contracts";

/**
 * Nav link scroll-target ids, in display order. Labels: landing.nav.links.<id>.
 * "pricing" is special-cased in LandingNav and SiteNav as a route link to /pricing.
 */
export const LANDING_NAV_LINK_IDS = [
	"how-it-works",
	"examples",
	"pricing",
	"faq",
] as const;

/**
 * App ideas of the landing page, in display order. Copy:
 * landing.ideas.items.<id> (`name`, and `text` that continues the hero
 * sentence). `platform` is the app type the idea sets in the hero.
 */
export const IDEAS = [
	{ id: "barber", platform: "mobile" },
	{ id: "invoices", platform: "web" },
	{ id: "running", platform: "mobile" },
	{ id: "yoga", platform: "web" },
	{ id: "clinic", platform: "mobile" },
	{ id: "darija", platform: "mobile" },
	{ id: "checkin", platform: "web" },
	{ id: "gym", platform: "mobile" },
	{ id: "tasks", platform: "web" },
	{ id: "recipes", platform: "mobile" },
	{ id: "volunteers", platform: "web" },
	{ id: "homework", platform: "mobile" },
] as const satisfies readonly { id: string; platform: TargetPlatform }[];

/** Key of landing.ideas.items. */
export type IdeaId = (typeof IDEAS)[number]["id"];

/**
 * The ideas the hero types out and builds on a loop, in loop order. Each one
 * has a mini app in components/mini-apps.tsx and a build log in
 * landing.hero.log.<id>. The loop alternates mobile and web on purpose.
 */
export const HERO_IDEA_IDS = [
	"barber",
	"invoices",
	"running",
	"yoga",
] as const satisfies readonly IdeaId[];

/** An idea that has a mini app and a build log. */
export type HeroIdeaId = (typeof HERO_IDEA_IDS)[number];

/**
 * Class of each section title (h2) below the hero. Arabic gets more line
 * height and no negative tracking, because tight Arabic lines collide.
 */
export const SECTION_TITLE_CLASS =
	"text-balance font-bold text-[clamp(2.25rem,4.4vw,4.25rem)] leading-[1] tracking-[-0.04em] rtl:leading-[1.3] rtl:tracking-normal";

/**
 * Footer columns: link `key` keys landing.footer.linkLabels.<key>; scrollId
 * drives anchors. "pricing" is special-cased in LandingFooter and SiteFooter as a route link.
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
