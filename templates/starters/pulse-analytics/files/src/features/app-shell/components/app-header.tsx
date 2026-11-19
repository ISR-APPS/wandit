// The bar at the top of the page column: the menu button, the page search, the language switcher, the alerts,
// and the user menu when theme.json puts it here. AppShell renders it.
// The header axis of theme.json gives the look through engine.css: [data-header] selects data-slot="app-header".
// The page title is in PageHeader, so this bar shows no page name.
import type { ReactNode } from "react";
import { LocaleSwitcher, useT } from "~/shared/i18n";
import { Separator } from "~/shared/ui/separator";
import { SidebarTrigger } from "~/shared/ui/sidebar";
import { HeaderNotifications } from "./header-notifications";
import { HeaderSearch } from "./header-search";

type AppHeaderProps = {
	/** The user menu at the end side (NavUser with placement "header"), or null when the sidebar holds it. */
	userMenu: ReactNode;
};

/** h-14 high. The search field becomes an icon button below the lg width. */
export function AppHeader({ userMenu }: AppHeaderProps) {
	const { t } = useT();

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
			<HeaderSearch />
			<div className="ms-auto flex items-center gap-2">
				{/* It renders nothing while the app has one language. */}
				<LocaleSwitcher />
				<HeaderNotifications />
				{userMenu ? (
					<>
						<Separator
							orientation="vertical"
							className="mx-1 data-[orientation=vertical]:h-4"
						/>
						{userMenu}
					</>
				) : null}
			</div>
		</header>
	);
}
