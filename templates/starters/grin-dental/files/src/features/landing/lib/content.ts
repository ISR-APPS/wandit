// The structured content of the Grin Dental Studio home page: links, services, steps, stats, team, menu, and reviews.
// The section components map over these lists. The texts stay in messages.ts; each entry names its keys.
// Change a price or a name in messages.ts, and the order or the art of an entry here.
import type { TranslationKey } from "~/shared/i18n";

/** One link of the header and of the phone menu. `href` is the id of a section on the same page. */
export type NavLink = { href: string; labelKey: TranslationKey };

/** The five section links. The "Book a visit" button of the header is separate. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#services", labelKey: "site.navServices" },
	{ href: "#visit", labelKey: "site.navVisit" },
	{ href: "#team", labelKey: "site.navTeam" },
	{ href: "#prices", labelKey: "site.navPrices" },
	{ href: "#club", labelKey: "site.navClub" },
];

/** The drawing of a service icon. ServiceIcon draws one for each value. */
export type ServiceIconKind =
	| "checkup"
	| "aligners"
	| "fillings"
	| "firstVisit"
	| "guards"
	| "polish";

/** One sticker of the services grid. */
export type Service = {
	id: string;
	icon: ServiceIconKind;
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
	priceKey: TranslationKey;
	/** The rest angle of the sticker, as a Tailwind class that sets --gd-r. Each card tilts its own way. */
	tiltClass: string;
	/** The featured card is teal with a sun ribbon. The page has one. */
	ribbonKey?: TranslationKey;
};

/** Six services in grid order. The fourth one is the featured card. */
export const SERVICES: readonly Service[] = [
	{
		id: "checkup",
		icon: "checkup",
		titleKey: "services.checkupTitle",
		bodyKey: "services.checkupBody",
		priceKey: "services.checkupPrice",
		tiltClass: "[--gd-r:-1.4deg]",
	},
	{
		id: "aligners",
		icon: "aligners",
		titleKey: "services.alignersTitle",
		bodyKey: "services.alignersBody",
		priceKey: "services.alignersPrice",
		tiltClass: "[--gd-r:1.2deg]",
	},
	{
		id: "fillings",
		icon: "fillings",
		titleKey: "services.fillingsTitle",
		bodyKey: "services.fillingsBody",
		priceKey: "services.fillingsPrice",
		tiltClass: "[--gd-r:-0.8deg]",
	},
	{
		id: "first-visit",
		icon: "firstVisit",
		titleKey: "services.firstTitle",
		bodyKey: "services.firstBody",
		priceKey: "services.firstPrice",
		tiltClass: "[--gd-r:1.5deg]",
		ribbonKey: "services.firstRibbon",
	},
	{
		id: "guards",
		icon: "guards",
		titleKey: "services.guardsTitle",
		bodyKey: "services.guardsBody",
		priceKey: "services.guardsPrice",
		tiltClass: "[--gd-r:-1.2deg]",
	},
	{
		id: "polish",
		icon: "polish",
		titleKey: "services.polishTitle",
		bodyKey: "services.polishBody",
		priceKey: "services.polishPrice",
		tiltClass: "[--gd-r:0.9deg]",
	},
];

/** The drawing of a step badge. StepIcon draws one for each value. */
export type StepIconKind = "fish" | "rocket" | "sparkle" | "gift";

/** One stop of the first visit, in the order a kid lives it. */
export type VisitStep = {
	icon: StepIconKind;
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
};

/** The four stops. VisitSection places them along the dotted path from 1024px. */
export const VISIT_STEPS: readonly VisitStep[] = [
	{ icon: "fish", titleKey: "visit.step1Title", bodyKey: "visit.step1Body" },
	{ icon: "rocket", titleKey: "visit.step2Title", bodyKey: "visit.step2Body" },
	{
		icon: "sparkle",
		titleKey: "visit.step3Title",
		bodyKey: "visit.step3Body",
	},
	{ icon: "gift", titleKey: "visit.step4Title", bodyKey: "visit.step4Body" },
];

/** One sticker of the stats row. A null `target` is the "0 scary words" stat: it stamps in and never counts. */
export type Stat = {
	labelKey: TranslationKey;
	/** The end value of the count. */
	target: number | null;
	decimals: number;
	/** A text after the number: "+" or the minutes unit. */
	suffix: "plus" | "minutes" | "none";
};

/** The four stats, in row order. The numbers are the claims of the studio, not live data. */
export const STATS: readonly Stat[] = [
	{ labelKey: "stats.smiles", target: 12400, decimals: 0, suffix: "plus" },
	{ labelKey: "stats.scaryWords", target: null, decimals: 0, suffix: "none" },
	{ labelKey: "stats.wait", target: 9, decimals: 0, suffix: "minutes" },
	{ labelKey: "stats.rating", target: 4.9, decimals: 1, suffix: "none" },
];

/** The drawing of a team portrait. MemberPortrait draws one for each value. */
export type PortraitKind = "maya" | "jonas" | "rui" | "bea";

/** One member of the team. */
export type TeamMember = {
	portrait: PortraitKind;
	nameKey: TranslationKey;
	roleKey: TranslationKey;
	factKey: TranslationKey;
	altKey: TranslationKey;
};

/** The four members, in grid order. */
export const TEAM: readonly TeamMember[] = [
	{
		portrait: "maya",
		nameKey: "team.mayaName",
		roleKey: "team.mayaRole",
		factKey: "team.mayaFact",
		altKey: "team.mayaAlt",
	},
	{
		portrait: "jonas",
		nameKey: "team.jonasName",
		roleKey: "team.jonasRole",
		factKey: "team.jonasFact",
		altKey: "team.jonasAlt",
	},
	{
		portrait: "rui",
		nameKey: "team.ruiName",
		roleKey: "team.ruiRole",
		factKey: "team.ruiFact",
		altKey: "team.ruiAlt",
	},
	{
		portrait: "bea",
		nameKey: "team.beaName",
		roleKey: "team.beaRole",
		factKey: "team.beaFact",
		altKey: "team.beaAlt",
	},
];

/** One line of the price menu card. */
export type MenuRow = { itemKey: TranslationKey; priceKey: TranslationKey };

/** The six lines of "Today's menu". They repeat the service prices with the visit types. */
export const MENU_ROWS: readonly MenuRow[] = [
	{ itemKey: "prices.item1", priceKey: "prices.price1" },
	{ itemKey: "prices.item2", priceKey: "prices.price2" },
	{ itemKey: "prices.item3", priceKey: "prices.price3" },
	{ itemKey: "prices.item4", priceKey: "prices.price4" },
	{ itemKey: "prices.item5", priceKey: "prices.price5" },
	{ itemKey: "prices.item6", priceKey: "prices.price6" },
];

/** One speech bubble of the reviews wall. */
export type Review = {
	quoteKey: TranslationKey;
	authorKey: TranslationKey;
	/** "kid" is a sun bubble with a big quote and no stars. "teal" is a teal bubble. */
	tone: "white" | "kid" | "teal";
};

/** Six bubbles, in wall order. The stagger and tilt of each one is in ReviewsSection. */
export const REVIEWS: readonly Review[] = [
	{ quoteKey: "reviews.quote1", authorKey: "reviews.author1", tone: "white" },
	{ quoteKey: "reviews.quote2", authorKey: "reviews.author2", tone: "kid" },
	{ quoteKey: "reviews.quote3", authorKey: "reviews.author3", tone: "white" },
	{ quoteKey: "reviews.quote4", authorKey: "reviews.author4", tone: "white" },
	{ quoteKey: "reviews.quote5", authorKey: "reviews.author5", tone: "white" },
	{ quoteKey: "reviews.quote6", authorKey: "reviews.author6", tone: "teal" },
];

/** The perks of the Grin Club, in list order. */
export const CLUB_PERKS: readonly TranslationKey[] = [
	"club.perk1",
	"club.perk2",
	"club.perk3",
	"club.perk4",
];

/** One choice of the visit request card. `labelKey` is shown on the chip and written into the email. */
export type RequestChoice = { value: string; labelKey: TranslationKey };

/** The age chips of the request card. The second one (3–5) is the default of the card. */
export const AGE_CHOICES: readonly RequestChoice[] = [
	{ value: "under-3", labelKey: "book.ageUnder3" },
	{ value: "3-5", labelKey: "book.age3to5" },
	{ value: "6-9", labelKey: "book.age6to9" },
	{ value: "10-13", labelKey: "book.age10to13" },
	{ value: "teen", labelKey: "book.ageTeen" },
	{ value: "grown-up", labelKey: "book.ageGrownUp" },
];

/** The time chips of the request card. The first one is the default. */
export const TIME_CHOICES: readonly RequestChoice[] = [
	{ value: "morning", labelKey: "book.timeMorning" },
	{ value: "afternoon", labelKey: "book.timeAfternoon" },
	{ value: "saturday", labelKey: "book.timeSaturday" },
];
