// The pages of the sidebar, in order. AppSidebar lists them; AppHeader shows the active label.
// The generated app lists its pages here; a wrong path fails typecheck.
import type { useMatchRoute } from "@tanstack/react-router";
import type { ComponentType, SVGProps } from "react";
import type { FileRouteTypes } from "~/routeTree.gen";
import type { TranslationKey } from "~/shared/i18n";
import { UserIcon } from "~/shared/ui/icons";

/** One entry of the sidebar. */
export type NavItem = {
	/** Path of a route under /app. The generated route tree types it, so a missing route fails typecheck. */
	to: FileRouteTypes["to"];
	/** Message key of the label, for example "shell.profile". */
	labelKey: TranslationKey;
	/** An icon from ~/shared/ui/icons that names the page. */
	icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/** The sidebar entries. The home comes first; Profile stays last. */
export const NAV_ITEMS: NavItem[] = [
	{ to: "/app/profile", labelKey: "shell.profile", icon: UserIcon },
];

/**
 * The entry of the current page. A fuzzy match keeps a list item active on its detail pages.
 * The longest path wins, so the home entry `/app` does not match every page.
 */
export function findActiveNavItem(
	matchRoute: ReturnType<typeof useMatchRoute>,
): NavItem | undefined {
	return NAV_ITEMS.filter(
		(item) => matchRoute({ to: item.to, fuzzy: true }) !== false,
	).sort((first, second) => second.to.length - first.to.length)[0];
}
