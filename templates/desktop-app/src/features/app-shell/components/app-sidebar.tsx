// The side navigation: the brand row and the nav items.
// AppShell renders it with the sidebar fields of theme.json. In a narrow window the kit Sidebar is a Sheet.
// It reads NAV_ITEMS and marks the entry of the current route. Colors come only from the sidebar tokens.
import { Link, useMatchRoute } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useT } from "~/shared/i18n";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/shared/ui/sidebar";
import { findActiveNavItem, NAV_ITEMS } from "../lib/nav-items";

type AppSidebarProps = {
	/** The look: a column with an edge rule, a detached panel, or a column beside the page panel. */
	variant: NonNullable<ComponentProps<typeof Sidebar>["variant"]>;
	/** "icon" collapses to a column of icons, "rail" to icons with their label under them. "offcanvas" slides the sidebar out. */
	collapsible: NonNullable<ComponentProps<typeof Sidebar>["collapsible"]>;
};

/** The brand row links to the home page. Each nav click also closes the narrow-window Sheet. */
export function AppSidebar({ variant, collapsible }: AppSidebarProps) {
	const { t } = useT();
	const { setOpenMobile } = useSidebar();
	const activeItem = findActiveNavItem(useMatchRoute());
	const appName = t("common.appName");

	return (
		<Sidebar label={appName} variant={variant} collapsible={collapsible}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							{/* A click closes the Sheet in the handler, so no effect watches the route. */}
							<Link to="/" onClick={() => setOpenMobile(false)}>
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
		</Sidebar>
	);
}
