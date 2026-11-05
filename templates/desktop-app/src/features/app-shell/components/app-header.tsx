// The bar at the top of the page column: the menu button, the name of the current page, and the language switcher.
// AppShell renders it. The header axis of theme.json gives the look through engine.css:
// [data-header] selects data-slot="app-header". The name comes from the active NAV_ITEMS entry.
import { useMatchRoute } from "@tanstack/react-router";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { Separator } from "~/shared/ui/separator";
import { SidebarTrigger } from "~/shared/ui/sidebar";
import { findActiveNavItem } from "../lib/nav-items";

/** h-14 high. It shows no label on a page that NAV_ITEMS does not list. */
export function AppHeader() {
	const { t } = useT();
	const activeItem = findActiveNavItem(useMatchRoute());

	return (
		// The top corners follow the inset page panel, so a sticky fill does not cover its rounded edge.
		<header
			data-slot="app-header"
			className="flex h-14 shrink-0 items-center gap-2 px-4 md:rounded-t-(--shell-panel-radius) md:px-6"
		>
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
			<div className="ms-auto flex items-center gap-2">
				{/* It renders nothing while the app has one language. */}
				<LocaleSwitcher />
			</div>
		</header>
	);
}
