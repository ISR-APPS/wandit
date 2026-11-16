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

/** The five section links, in page order. The reservation has its own button, so it is not in this list. */
export const NAV_LINKS: readonly NavLink[] = [
	{ href: "#practices", labelKey: "site.navPractices" },
	{ href: "#teachers", labelKey: "site.navTeachers" },
	{ href: "#schedule", labelKey: "site.navSchedule" },
	{ href: "#studio", labelKey: "site.navStudio" },
	{ href: "#memberships", labelKey: "site.navMemberships" },
];
