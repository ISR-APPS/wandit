// The section links of the landing page. SiteHeader, MobileMenu, and SiteFooter render the same list.
// Each href is the id of a section element. The section component sets that id.
import type { TranslationKey } from "~/shared/i18n";

/** One link to a section of the page. */
type SectionLink = {
	/** A hash of the same page, for example "#pricing". */
	href: string;
	/** The key of the link text in the `site` group of messages.ts. */
	labelKey: TranslationKey;
};

/** The four section links, in page order. The contact section has its own button. */
export const SECTION_LINKS: readonly SectionLink[] = [
	{ href: "#product", labelKey: "site.navProduct" },
	{ href: "#path", labelKey: "site.navPath" },
	{ href: "#pricing", labelKey: "site.navPricing" },
	{ href: "#faq", labelKey: "site.navFaq" },
];
