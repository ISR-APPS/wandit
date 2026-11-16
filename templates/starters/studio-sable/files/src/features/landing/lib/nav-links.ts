// The four section links of the header and of the phone menu, in page order.
// SiteHeader and SiteMenu read this list. Each href is the id of a section element.
import type { TranslationKey } from "~/shared/i18n";

/** One section link. */
export type NavLink = {
	/** The anchor of the section, for example "#studio". It is also the React key. */
	href: string;
	/** The number of the section label on the page, for example "04" for "04 — offers". Shown in the phone menu. */
	number: string;
	labelKey: TranslationKey;
};

/** The section links. "services" is the offers section, and "contact" is the brief section. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#index", number: "01", labelKey: "site.navIndex" },
	{ href: "#studio", number: "02", labelKey: "site.navStudio" },
	{ href: "#services", number: "04", labelKey: "site.navServices" },
	{ href: "#contact", number: "07", labelKey: "site.navContact" },
];
