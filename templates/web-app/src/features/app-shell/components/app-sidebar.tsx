// The sidebar of the area behind login: the app name, the nav items, and the user menu.
// AppShell renders it. It reads NAV_ITEMS and marks the entry of the current route.
// Inside the sidebar, colors come only from the sidebar tokens.
import { Link, useMatchRoute } from "@tanstack/react-router";
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
import { findActiveNavItem, NAV_ITEMS } from "../lib/nav-items";
import { NavUser } from "./nav-user";

type AppSidebarProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
};

/** The app name links to /app. Each nav click also closes the mobile Sheet. */
export function AppSidebar({ email }: AppSidebarProps) {
	const { t } = useT();
	const { setOpenMobile } = useSidebar();
	const activeItem = findActiveNavItem(useMatchRoute());
	const appName = t("common.appName");

	return (
		// These two props are the shell slot of the app-dashboard recipe. The skill changes them per shell.
		<Sidebar label={appName} variant="inset" collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							{/* A click closes the mobile Sheet in the handler, so no effect watches the route. */}
							<Link to="/app" onClick={() => setOpenMobile(false)}>
								<span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-display font-semibold text-sidebar-primary-foreground">
									{appName.charAt(0)}
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
							return (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton
										asChild
										isActive={item === activeItem}
										tooltip={label}
									>
										<Link to={item.to} onClick={() => setOpenMobile(false)}>
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
			<SidebarFooter>
				<NavUser email={email} />
			</SidebarFooter>
		</Sidebar>
	);
}
