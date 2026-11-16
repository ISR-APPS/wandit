// The section links of the home page. SiteHeader and SiteMenu render the same list.
// Each href is the id that a section component sets on its <section>.
import type { TranslationKey } from "~/shared/i18n";

/** One anchor link of the header: the id of its section and the key of its text. */
type NavLink = {
	/** "#" and the id of a section of the page. */
	href: string;
	/** Key of the link text in the `site` group of messages.ts. */
	labelKey: TranslationKey;
};

/** The four section links, in page order. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#care", labelKey: "site.navCare" },
	{ href: "#ritual", labelKey: "site.navRitual" },
	{ href: "#doctor", labelKey: "site.navTeam" },
	{ href: "#contact", labelKey: "site.navContact" },
];
