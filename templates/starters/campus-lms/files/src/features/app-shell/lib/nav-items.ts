// The pages of the nav, in order. AppSidebar lists them, also in the phone Sheet.
// AppHeader shows the active label. A wrong path fails typecheck.
import {
	BooksIcon,
	ExamIcon,
	NewspaperIcon,
	StudentIcon,
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

/** The nav entries. The home is the digest of the school, so it gets the newspaper. Profile stays last. */
export const NAV_ITEMS: NavItem[] = [
	{ to: "/app", labelKey: "overview.nav", icon: NewspaperIcon },
	{ to: "/app/courses", labelKey: "courses.title", icon: BooksIcon },
	{ to: "/app/students", labelKey: "students.title", icon: StudentIcon },
	{ to: "/app/assignments", labelKey: "assignments.title", icon: ExamIcon },
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
