// The section links of the header and of the phone menu. Each one is an anchor of the same page.
// SiteHeader, SiteMenu, and SiteFooter map over NAV_LINKS. The ids exist on the section elements.
// SiteMenu numbers each row from its index, so the order here is also the N° order.
import type { TranslationKey } from "~/shared/i18n";

/** One section link. */
type NavLink = {
	/** Anchor of the section, for example "#design". */
	href: string;
	labelKey: TranslationKey;
};

/** In page order. "Reserve" is not here: it is the pill of the header. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#design", labelKey: "site.navDesign" },
	{ href: "#details", labelKey: "site.navDetails" },
	{ href: "#reviews", labelKey: "site.navReviews" },
	{ href: "#questions", labelKey: "site.navQuestions" },
];
