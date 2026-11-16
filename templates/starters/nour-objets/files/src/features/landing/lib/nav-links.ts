// The five section links of the header and of the phone menu, in page order.
// SiteHeader and SiteMenu read this list. Each href is the id of a section element of the home page.
import type { TranslationKey } from "~/shared/i18n";

/** One section link. */
export type NavLink = {
	/** The anchor of the section, for example "#shelf". It is also the React key. */
	href: string;
	/** The two digits of the section kicker. The phone menu shows them before the name. Not translated. */
	number: string;
	labelKey: TranslationKey;
};

/** The section links. The numbers match the kickers of the sections: the hero is 01, and the quote band 06 has no link. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#shelf", number: "02", labelKey: "site.navShelf" },
	{ href: "#window", number: "03", labelKey: "site.navWindow" },
	{ href: "#piece", number: "04", labelKey: "site.navPiece" },
	{ href: "#rules", number: "05", labelKey: "site.navRules" },
	{ href: "#visit", number: "07", labelKey: "site.navVisit" },
];
