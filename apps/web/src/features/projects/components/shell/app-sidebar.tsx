import { Button } from "@my-better-t-app/ui/components/button";
import { Progress } from "@my-better-t-app/ui/components/progress";
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
} from "@my-better-t-app/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import type * as React from "react";

import { Spark } from "@/components/logo";
import { SIGNUP_GRANT, useCredits } from "@/features/credits";
import { PROJECTS_COPY } from "../../lib/constants";
import { NAV_GROUPS, type NavItem } from "../../lib/nav-config";

function NavEntry({ item }: { item: NavItem }) {
	const pathname = useLocation({ select: (location) => location.pathname });

	if (item.type === "route") {
		return (
			<SidebarMenuButton
				asChild
				isActive={pathname === item.to}
				tooltip={item.title}
			>
				<Link to={item.to}>
					<item.icon />
					<span>{item.title}</span>
				</Link>
			</SidebarMenuButton>
		);
	}

	if (item.type === "external") {
		return (
			<SidebarMenuButton asChild tooltip={item.title}>
				<a href={item.href}>
					<item.icon />
					<span>{item.title}</span>
				</a>
			</SidebarMenuButton>
		);
	}

	return (
		<>
			<SidebarMenuButton disabled tooltip={item.title}>
				<item.icon />
				<span>{item.title}</span>
			</SidebarMenuButton>
			<SidebarMenuBadge className="font-mono text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
				{PROJECTS_COPY.sidebarSoon}
			</SidebarMenuBadge>
		</>
	);
}

function CreditsCard() {
	const { balance } = useCredits();
	const usedPercent = Math.min(100, (balance / SIGNUP_GRANT) * 100);

	return (
		<div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 group-data-[collapsible=icon]:hidden">
			<div className="flex items-baseline justify-between gap-2">
				<span className="text-sidebar-foreground/70 text-xs">
					{PROJECTS_COPY.sidebarCreditsLabel}
				</span>
				<span className="font-medium font-mono text-sidebar-foreground text-xs">
					{balance}
					<span className="text-sidebar-foreground/50">/{SIGNUP_GRANT}</span>
				</span>
			</div>
			<Progress value={usedPercent} className="mt-2 h-1.5" />
			<Button
				size="xs"
				variant="outline"
				disabled
				className="mt-3 w-full font-mono text-[11px]"
			>
				{PROJECTS_COPY.sidebarTopUp}
			</Button>
		</div>
	);
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="h-10 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0!"
						>
							<Link to="/dashboard" aria-label="Wandit — projects">
								<Spark className="size-4 shrink-0 text-primary" />
								<span className="select-none font-bold font-display text-foreground text-lg lowercase leading-none tracking-tight group-data-[collapsible=icon]:hidden">
									wandit
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{NAV_GROUPS.map((group) => (
					<SidebarGroup key={group.title}>
						<SidebarGroupLabel>{group.title}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.title}>
										<NavEntry item={item} />
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter>
				<CreditsCard />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
