import { Link, useLocation } from "@tanstack/react-router";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@wandit/ui/components/sidebar";
import type * as React from "react";

import { Spark } from "@/components/logo";
import { UpgradeCard } from "@/features/billing/components/upgrade-button";
import { isChatwootConfigured, openSupportChat } from "@/features/support";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { useTranslation } from "@/lib/i18n";
import { NAV_GROUPS, type NavItem } from "../../lib/nav-config";

function NavEntry({ item }: { item: NavItem }) {
	const pathname = useLocation({ select: (location) => location.pathname });
	const { t } = useTranslation();
	const { isMobile, setOpenMobile } = useSidebar();
	const title = t(item.titleKey);

	if (item.type === "route") {
		return (
			<SidebarMenuButton
				asChild
				isActive={pathname === item.to || pathname.startsWith(`${item.to}/`)}
				tooltip={title}
			>
				<Link to={item.to}>
					<item.icon />
					<span>{title}</span>
				</Link>
			</SidebarMenuButton>
		);
	}

	if (item.type === "external") {
		return (
			<SidebarMenuButton asChild tooltip={title}>
				<a href={item.href}>
					<item.icon />
					<span>{title}</span>
				</a>
			</SidebarMenuButton>
		);
	}

	if (item.type === "action") {
		// Only "open-support-chat" exists today; disabled when the widget is
		// not configured so the button never silently does nothing.
		return (
			<SidebarMenuButton
				disabled={!isChatwootConfigured}
				onClick={() => {
					// The mobile sidebar is a modal sheet: while open it sets
					// body pointer-events:none, which the chat window inherits.
					if (isMobile) setOpenMobile(false);
					openSupportChat();
				}}
				tooltip={title}
			>
				<item.icon />
				<span>{title}</span>
			</SidebarMenuButton>
		);
	}

	return (
		<>
			<SidebarMenuButton disabled tooltip={title}>
				<item.icon />
				<span>{title}</span>
			</SidebarMenuButton>
			<SidebarMenuBadge className="font-mono text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
				{t("projects.sidebar.soon")}
			</SidebarMenuBadge>
		</>
	);
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const { t } = useTranslation();
	return (
		<Sidebar
			collapsible="icon"
			mobileTitle={t("projects.sidebar.mobileTitle")}
			mobileDescription={t("projects.sidebar.mobileDescription")}
			{...props}
		>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="h-10 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0!"
						>
							<Link to="/dashboard" aria-label={t("projects.logoLabel")}>
								<Spark className="size-4 shrink-0 text-primary" />
								<span className="select-none font-bold font-display text-foreground text-lg lowercase leading-none tracking-tight group-data-[collapsible=icon]:hidden">
									wandit
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
						<WorkspaceSwitcher />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{NAV_GROUPS.map((group) => (
					<SidebarGroup key={group.titleKey}>
						<SidebarGroupLabel>{t(group.titleKey)}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.titleKey}>
										<NavEntry item={item} />
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			{/* The upgrade card gates itself on purchases + free plan, so this
			    stays invisible until billing opens (ship-dark launch policy). */}
			<SidebarFooter className="group-data-[collapsible=icon]:hidden">
				<UpgradeCard />
			</SidebarFooter>
			<SidebarRail
				aria-label={t("projects.sidebar.toggleSidebar")}
				title={t("projects.sidebar.toggleSidebar")}
			/>
		</Sidebar>
	);
}
