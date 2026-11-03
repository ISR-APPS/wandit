// The sidebar of the area behind login: the brand row, the nav items, and the user menu.
// AppShell renders it with the sidebar fields of theme.json. On a phone the kit Sidebar is the Sheet nav.
// It reads NAV_ITEMS and marks the entry of the current route. Colors come only from the sidebar tokens.
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useT } from "~/shared/i18n";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/shared/ui/sidebar";
import type { AppThemeFile } from "~/styles/theme";
import { findActiveNavItem, NAV_ITEMS } from "../lib/nav-items";
import { NavUser } from "./nav-user";

type AppSidebarProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
	/** The desktop look: a column with an edge rule, a detached panel, or a column beside the page panel. */
	variant: NonNullable<ComponentProps<typeof Sidebar>["variant"]>;
	/** "icon" collapses to a column of icons, "rail" to icons with their label under them. "offcanvas" slides the sidebar out. */
	collapsible: NonNullable<ComponentProps<typeof Sidebar>["collapsible"]>;
	/** The userMenu field of theme.json. "header" puts the menu in AppHeader, so the sidebar shows none. */
	userMenu: AppThemeFile["selection"]["userMenu"];
};

/**
 * The brand row links to /app. Each nav click also closes the mobile Sheet.
 * On a phone the kit Sidebar ignores variant and collapsible.
 */
export function AppSidebar({
	email,
	variant,
	collapsible,
	userMenu,
}: AppSidebarProps) {
	const { t } = useT();
	const { setOpenMobile } = useSidebar();
	const activeItem = findActiveNavItem(useMatchRoute());
	const appName = t("common.appName");
	const navUser = <NavUser email={email} placement="sidebar" />;

	return (
		<Sidebar label={appName} variant={variant} collapsible={collapsible}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							{/* A click closes the mobile Sheet in the handler, so no effect watches the route.
							    exact: by default the router marks /app as the current page on every page. */}
							<Link
								to="/app"
								activeOptions={{ exact: true }}
								onClick={() => setOpenMobile(false)}
							>
								{/* The brand chip. The app name next to it names the link, so screen readers skip it. */}
								<span
									aria-hidden="true"
									className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-control bg-sidebar-primary font-display font-semibold text-sidebar-primary-foreground"
								>
									{/* Array.from splits by code point, so a first emoji or astral letter stays whole. */}
									{Array.from(appName)[0] ?? ""}
								</span>
								<span className="font-display font-semibold">{appName}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				{userMenu === "sidebar-header" ? navUser : null}
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						{NAV_ITEMS.map((item) => {
							const label = t(item.labelKey);
							const isActive = item === activeItem;
							return (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton
										asChild
										isActive={isActive}
										tooltip={label}
									>
										{/* aria-current follows findActiveNavItem, so a detail page marks its list entry. */}
										<Link
											to={item.to}
											activeOptions={{ exact: true }}
											aria-current={isActive ? "page" : undefined}
											onClick={() => setOpenMobile(false)}
										>
											<item.icon />
											<span>{label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			{userMenu === "sidebar-footer" ? (
				<SidebarFooter>{navUser}</SidebarFooter>
			) : null}
		</Sidebar>
	);
}
