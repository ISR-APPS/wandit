// The section links of the header, the phone menu, and the footer.
// Each href is the id of a section of LandingPage, so the links work with no script.
import type { TranslationKey } from "~/shared/i18n";

/** One anchor link to a section of the page. */
export type NavLink = { href: string; labelKey: TranslationKey };

/** Page order. The ids are set in the section components. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#register", labelKey: "nav.register" },
	{ href: "#districts", labelKey: "nav.districts" },
	{ href: "#method", labelKey: "nav.method" },
	{ href: "#sell", labelKey: "nav.sell" },
];
