// The nav of the area behind login: labeled groups of rows, and the flat list of their pages.
// AppSidebar draws NAV_GROUPS, also in the phone Sheet. HeaderSearch lists NAV_ITEMS in its dialog.
// A wrong path fails typecheck, because the generated route tree types each `to`.
import {
	BookOpenTextIcon,
	ChartLineUpIcon,
	ReceiptIcon,
	StorefrontIcon,
} from "@phosphor-icons/react";
import type { useMatchRoute } from "@tanstack/react-router";
import type { FileRouteTypes } from "~/routeTree.gen";
import type { TranslationKey } from "~/shared/i18n";
import { type KitIcon, UserIcon } from "~/shared/ui/icons";

/** One page of the nav. A child row under a parent has no icon: the sidebar indents it with a start rule. */
export type NavLeaf = {
	/** Path of a route under /app. A missing route fails typecheck. */
	to: FileRouteTypes["to"];
	/** Message key of the label, for example "shell.profile". */
	labelKey: TranslationKey;
};

/**
 * One row of the nav. A row with `children` opens and closes them.
 * Its own `to` is the first child: the collapsed icon sidebar links there.
 */
export type NavItem = NavLeaf & {
	/** An icon that names the page: a kit icon, or any icon of @phosphor-icons/react. */
	icon: KitIcon;
	/** 2 to 4 child pages. Each child is a real route, never a search param. */
	children?: NavLeaf[];
};

/** One labeled group of rows, for example "Service" or "Account". */
export type NavGroup = {
	/** Message key of the small muted label over the rows. */
	labelKey: TranslationKey;
	items: NavItem[];
};

/**
 * The nav, in order. The sales overview is the home. "Orders" holds the list and the till screen,
 * because a server moves between the two many times per service. Profile is the last row.
 */
export const NAV_GROUPS: NavGroup[] = [
	{
		labelKey: "nav.service",
		items: [
			{ to: "/app", labelKey: "dashboard.title", icon: StorefrontIcon },
			{
				to: "/app/orders",
				labelKey: "nav.orders",
				icon: ReceiptIcon,
				children: [
					{ to: "/app/orders", labelKey: "nav.allOrders" },
					{ to: "/app/order", labelKey: "nav.newOrder" },
				],
			},
			{ to: "/app/menu", labelKey: "nav.menu", icon: BookOpenTextIcon },
		],
	},
	{
		labelKey: "nav.reports",
		items: [
			{ to: "/app/report", labelKey: "nav.report", icon: ChartLineUpIcon },
		],
	},
	{
		labelKey: "nav.account",
		items: [{ to: "/app/profile", labelKey: "shell.profile", icon: UserIcon }],
	},
];

/** Every page of the nav: a row without children, or each child of a parent row. */
export const NAV_ITEMS: NavLeaf[] = NAV_GROUPS.flatMap((group) =>
	group.items.flatMap((item) => item.children ?? [item]),
);

/**
 * The page of the current route. A fuzzy match keeps a list page active on its detail pages.
 * The longest path wins, so the home `/app` does not match every page.
 */
export function findActiveNavItem(
	matchRoute: ReturnType<typeof useMatchRoute>,
): NavLeaf | undefined {
	return NAV_ITEMS.filter(
		(item) => matchRoute({ to: item.to, fuzzy: true }) !== false,
	).sort((first, second) => second.to.length - first.to.length)[0];
}
