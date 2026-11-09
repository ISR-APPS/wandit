// The pages of the side navigation, in order. AppSidebar lists them; AppHeader shows the active label.
// The app lists its pages here. A path that src/router.tsx does not have fails typecheck.
import { GearIcon, HouseIcon } from "@phosphor-icons/react";
import type { RegisteredRouter, useMatchRoute } from "@tanstack/react-router";
import type { TranslationKey } from "~/shared/i18n";
import type { KitIcon } from "~/shared/ui/icons";

/** One entry of the side navigation. */
export type NavItem = {
	/** Full path of a route of src/router.tsx, for example "/settings". */
	to: keyof RegisteredRouter["routesByPath"];
	/** Message key of the label, for example "shell.settings". */
	labelKey: TranslationKey;
	/** An icon that names the page: a kit icon, or any icon of @phosphor-icons/react. */
	icon: KitIcon;
};

/** The navigation entries. Home comes first; Settings stays last. */
export const NAV_ITEMS: NavItem[] = [
	{ to: "/", labelKey: "shell.home", icon: HouseIcon },
	{ to: "/settings", labelKey: "shell.settings", icon: GearIcon },
];

/**
 * The entry of the current page. A fuzzy match keeps a list entry active on its detail pages.
 * The longest path wins, so the home entry "/" does not match every page.
 */
export function findActiveNavItem(
	matchRoute: ReturnType<typeof useMatchRoute>,
): NavItem | undefined {
	return NAV_ITEMS.filter(
		(item) => matchRoute({ to: item.to, fuzzy: true }) !== false,
	).sort((first, second) => second.to.length - first.to.length)[0];
}
