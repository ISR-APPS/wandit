// The bar at the top of the page column: the sidebar trigger, the name of the current page, and the language switcher.
// AppShell renders it above every page behind login. The name comes from the active NAV_ITEMS entry.
// The rounded top corners follow the page card of the inset shell; on other shells they do not show.
import { useMatchRoute } from "@tanstack/react-router";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { Separator } from "~/shared/ui/separator";
import { SidebarTrigger } from "~/shared/ui/sidebar";
import { findActiveNavItem } from "../lib/nav-items";

/** Sticky bar, 3rem high. It shows no label on a page that NAV_ITEMS does not list. */
export function AppHeader() {
	const { t } = useT();
	const activeItem = findActiveNavItem(useMatchRoute());

	return (
		<header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 md:rounded-t-xl lg:px-6">
			<SidebarTrigger className="-ms-1" aria-label={t("shell.toggleSidebar")} />
			<Separator
				orientation="vertical"
				className="mx-2 data-[orientation=vertical]:h-4"
			/>
			{activeItem ? (
				<span className="truncate font-medium text-sm">
					{t(activeItem.labelKey)}
				</span>
			) : null}
			{/* It renders nothing while the app has one language. */}
			<div className="ms-auto">
				<LocaleSwitcher />
			</div>
		</header>
	);
}
