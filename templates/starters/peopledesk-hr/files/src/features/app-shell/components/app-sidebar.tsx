// The sidebar of the area behind login: the brand row, the labeled nav groups, and the user menu.
// AppShell renders it with the sidebar fields of theme.json. On a phone the kit Sidebar is the Sheet nav.
// It reads NAV_GROUPS and marks the page of the current route. A row with children opens a list of child pages.
// Colors come only from the sidebar tokens.
import { Link, useMatchRoute } from "@tanstack/react-router";
import { Collapsible } from "radix-ui";
import type { ComponentProps } from "react";
import { useT } from "~/shared/i18n";
import { CaretDownIcon } from "~/shared/ui/icons";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/shared/ui/sidebar";
import type { AppThemeFile } from "~/styles/theme";
import { findActiveNavItem, NAV_GROUPS } from "../lib/nav-items";
import { NavUser } from "./nav-user";

type AppSidebarProps = {
	/** `auth.users.id` of the signed-in user, from the session of the /app layout route. The user menu reads its `app_access` row. */
	userId: string;
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
 * A parent row opens by default when one of its children is the current page.
 * In the icon and rail states a parent row is a plain link to its first child.
 */
export function AppSidebar({
	userId,
	email,
	variant,
	collapsible,
	userMenu,
}: AppSidebarProps) {
	const { t } = useT();
	const { setOpenMobile } = useSidebar();
	const activeItem = findActiveNavItem(useMatchRoute());
	const appName = t("common.appName");
	const navUser = <NavUser userId={userId} email={email} placement="sidebar" />;
	// A click closes the mobile Sheet in the handler, so no effect watches the route.
	const closeMobile = () => setOpenMobile(false);

	return (
		<Sidebar label={appName} variant={variant} collapsible={collapsible}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							{/* exact: by default the router marks /app as the current page on every page. */}
							<Link
								to="/app"
								activeOptions={{ exact: true }}
								onClick={closeMobile}
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
				{NAV_GROUPS.map((group) => (
					<SidebarGroup key={group.labelKey}>
						<SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
						<SidebarMenu>
							{group.items.map((item) => {
								const label = t(item.labelKey);
								const children = item.children ?? [];
								const hasActiveChild = children.some(
									(child) => child === activeItem,
								);
								if (children.length === 0) {
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
													onClick={closeMobile}
												>
													<item.icon />
													<span>{label}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								}
								return (
									<Collapsible.Root
										key={item.to}
										asChild
										defaultOpen={hasActiveChild}
										className="group/collapsible"
									>
										<SidebarMenuItem>
											<Collapsible.Trigger asChild>
												<SidebarMenuButton className="group-data-[collapsible=icon]:hidden group-data-[collapsible=rail]:hidden">
													<item.icon />
													<span>{label}</span>
													<CaretDownIcon className="ms-auto size-4 transition-transform group-data-[state=closed]/collapsible:-rotate-90 rtl:group-data-[state=closed]/collapsible:rotate-90" />
												</SidebarMenuButton>
											</Collapsible.Trigger>
											{/* The collapsed sidebar has no room for the child list: the row links to the first child. */}
											<SidebarMenuButton
												asChild
												isActive={hasActiveChild}
												tooltip={label}
												className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=rail]:flex"
											>
												<Link to={item.to} onClick={closeMobile}>
													<item.icon />
													<span>{label}</span>
												</Link>
											</SidebarMenuButton>
											<Collapsible.Content className="group-data-[collapsible=icon]:hidden group-data-[collapsible=rail]:hidden">
												<ul className="ms-3.5 grid gap-1 border-sidebar-border border-s py-0.5 ps-2.5">
													{children.map((child) => {
														const isActive = child === activeItem;
														return (
															<li key={child.to}>
																<SidebarMenuButton
																	asChild
																	isActive={isActive}
																	className="h-7"
																>
																	<Link
																		to={child.to}
																		activeOptions={{ exact: true }}
																		aria-current={isActive ? "page" : undefined}
																		onClick={closeMobile}
																	>
																		<span>{t(child.labelKey)}</span>
																	</Link>
																</SidebarMenuButton>
															</li>
														);
													})}
												</ul>
											</Collapsible.Content>
										</SidebarMenuItem>
									</Collapsible.Root>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			{userMenu === "sidebar-footer" ? (
				<SidebarFooter>{navUser}</SidebarFooter>
			) : null}
		</Sidebar>
	);
}
