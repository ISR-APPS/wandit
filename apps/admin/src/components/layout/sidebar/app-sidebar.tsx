import { Link, useLocation } from "@tanstack/react-router";
import type * as React from "react";
import { useEffect, useRef } from "react";

import Logo from "@/components/layout/logo";
import { NavMain } from "@/components/layout/sidebar/nav-main";
import { NavUser } from "@/components/layout/sidebar/nav-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { useIsTablet } from "@/hooks/use-mobile";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const pathname = useLocation({
		select: (location) => location.pathname,
	});
	const { setOpen, setOpenMobile, isMobile } = useSidebar();
	const isTablet = useIsTablet();
	const hasAppliedTabletDefault = useRef(false);

	useEffect(() => {
		if (isMobile && pathname) {
			setOpenMobile(false);
		}
	}, [isMobile, pathname, setOpenMobile]);

	useEffect(() => {
		if (!isTablet) {
			hasAppliedTabletDefault.current = false;
			return;
		}

		if (!hasAppliedTabletDefault.current) {
			hasAppliedTabletDefault.current = true;
			setOpen(false);
		}
	}, [isTablet, setOpen]);

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="border-sidebar-border/70 border-b px-3 py-3 group-data-[collapsible=icon]:px-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							size="lg"
							tooltip="Wandit admin"
							className="h-10 gap-2.5 rounded-xl px-0 hover:bg-transparent hover:text-foreground active:bg-transparent group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
						>
							<Link to="/dashboard" aria-label="Wandit admin home">
								<span className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-gradient-ember shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] ring-1 ring-primary/10 ring-inset">
									<Logo className="size-[15px] text-primary-foreground" />
								</span>
								<span className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:hidden">
									<span className="select-none font-bold font-sans text-[17px] text-foreground lowercase leading-5 tracking-[-0.045em]">
										Wandit
									</span>
									<span
										aria-hidden="true"
										className="h-3 w-px bg-sidebar-border"
									/>
									<span className="font-medium font-mono text-[8.5px] text-sidebar-foreground/48 uppercase leading-3 tracking-[0.15em]">
										Admin
									</span>
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent className="pt-1">
				<ScrollArea className="h-full">
					<NavMain />
				</ScrollArea>
			</SidebarContent>
			<SidebarFooter className="border-sidebar-border/70 border-t p-2.5 group-data-[collapsible=icon]:p-2">
				<NavUser />
			</SidebarFooter>
			<SidebarRail className="after:w-px hover:after:bg-sidebar-primary/35" />
		</Sidebar>
	);
}
