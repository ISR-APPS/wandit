// The section links of the home page. SiteHeader, SiteMenu, and SiteFooter render the same list.
// Each href is the id that a section component sets on its <section>.
import type { TranslationKey } from "~/shared/i18n";

/** One anchor link: the id of its section and the key of its text. */
type NavLink = {
	/** "#" and the id of a section of the page. */
	href: string;
	/** Key of the link text in the `site` group of messages.ts. */
	labelKey: TranslationKey;
};

/** The four section links, in page order. The booking has its own button, so it is not in this list. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#ritual", labelKey: "site.navRitual" },
	{ href: "#treatments", labelKey: "site.navTreatments" },
	{ href: "#house", labelKey: "site.navHouse" },
	{ href: "#gifts", labelKey: "site.navGifts" },
];
