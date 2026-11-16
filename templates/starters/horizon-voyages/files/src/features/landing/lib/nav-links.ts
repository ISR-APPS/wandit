// The section links of the home page. SiteHeader, SiteMenu, and SiteFooter render the same list.
// Each href is the id that a section component sets on its <section>.
import type { TranslationKey } from "~/shared/i18n";

/** One anchor link of the header: the id of its section and the key of its text. */
type NavLink = {
	/** "#" and the id of a section of the page. */
	href: string;
	/** Key of the link text in the `site` group of messages.ts. */
	labelKey: TranslationKey;
};

/** The five section links, in page order. The proof row has no link: it is not a destination. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#circuits", labelKey: "site.navCircuits" },
	{ href: "#line", labelKey: "site.navLine" },
	{ href: "#journey", labelKey: "site.navJourney" },
	{ href: "#seasons", labelKey: "site.navSeasons" },
	{ href: "#quote", labelKey: "site.navQuote" },
];
