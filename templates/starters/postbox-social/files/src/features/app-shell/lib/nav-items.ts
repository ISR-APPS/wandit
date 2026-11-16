// The pages of the nav, in order. AppSidebar lists them, also in the phone Sheet.
// AppHeader shows the active label. Postbox lists its five pages here, then Profile; a wrong path fails typecheck.
import {
	BroadcastIcon,
	CalendarDotsIcon,
	ChartLineUpIcon,
	NotePencilIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import type { useMatchRoute } from "@tanstack/react-router";
import type { FileRouteTypes } from "~/routeTree.gen";
import type { TranslationKey } from "~/shared/i18n";
import { type KitIcon, UserIcon } from "~/shared/ui/icons";

/** One entry of the nav. */
export type NavItem = {
	/** Path of a route under /app. The generated route tree types it, so a missing route fails typecheck. */
	to: FileRouteTypes["to"];
	/** Message key of the label, for example "shell.profile". */
	labelKey: TranslationKey;
	/** An icon that names the page: a kit icon, or any icon of @phosphor-icons/react. */
	icon: KitIcon;
};

/** The nav entries. The home watches the reach of the brand, so its icon is a rising line. Profile stays last. */
export const NAV_ITEMS: NavItem[] = [
	{ to: "/app", labelKey: "overview.title", icon: ChartLineUpIcon },
	{ to: "/app/posts", labelKey: "posts.title", icon: NotePencilIcon },
	{ to: "/app/schedule", labelKey: "schedule.title", icon: CalendarDotsIcon },
	{ to: "/app/channels", labelKey: "channels.title", icon: BroadcastIcon },
	{ to: "/app/audience", labelKey: "audience.title", icon: UsersThreeIcon },
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
