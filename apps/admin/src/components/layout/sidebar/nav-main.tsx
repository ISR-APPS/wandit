import { Link, useLocation } from "@tanstack/react-router";

import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { getAdminAnalyticsNavigationSearch } from "@/lib/admin-date-range";
import {
	type AdminNavigationItem,
	adminNavigationGroups,
} from "@/lib/navigation";

type NavigationEntryProps = {
	item: AdminNavigationItem;
	pathname: string;
	search: Record<string, unknown>;
	isMobile: boolean;
	closeMobileSidebar: () => void;
};

function NavigationEntry({
	item,
	pathname,
	search,
	isMobile,
	closeMobileSidebar,
}: NavigationEntryProps) {
	const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
	const Icon = item.icon;
	const navigationSearch = getAdminAnalyticsNavigationSearch(
		pathname,
		item.to,
		search,
	);

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={isActive}
				tooltip={item.title}
				className="group/nav relative h-[52px] gap-2.5 rounded-[10px] px-2.5 py-1.5 font-sans text-sidebar-foreground/75 transition-[background-color,color,box-shadow,transform] duration-150 ease-out before:pointer-events-none before:absolute before:inset-y-[17px] before:start-0 before:w-0.5 before:rounded-full before:bg-transparent hover:bg-background/55 hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar active:scale-[0.985] data-[active=true]:bg-background/80 data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[inset_0_0_0_1px_var(--sidebar-border)] data-[active=true]:before:bg-sidebar-primary group-data-[collapsible=icon]:h-11! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:before:inset-y-[13px]"
			>
				<Link
					to={item.to}
					search={navigationSearch}
					aria-current={isActive ? "page" : undefined}
					onClick={() => {
						if (isMobile) {
							closeMobileSidebar();
						}
					}}
				>
					<Icon
						aria-hidden="true"
						size={18}
						weight="regular"
						className="size-[18px]! shrink-0 text-sidebar-foreground/65 transition-colors duration-150 group-hover/nav:text-sidebar-foreground group-data-[active=true]/nav:text-sidebar-primary"
					/>
					<div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
						<span className="block truncate font-medium text-[13.5px] leading-4 tracking-[-0.01em] group-data-[active=true]/nav:font-semibold">
							{item.title}
						</span>
						<span className="mt-1 block truncate font-normal text-[10.5px] text-sidebar-foreground/48 leading-3 tracking-[-0.005em] group-data-[active=true]/nav:text-sidebar-foreground/58">
							{item.description}
						</span>
					</div>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function NavMain() {
	const location = useLocation({
		select: ({ pathname, search }) => ({ pathname, search }),
	});
	const { isMobile, setOpenMobile } = useSidebar();

	return (
		<>
			{adminNavigationGroups.map((group) => (
				<SidebarGroup
					key={group.title}
					className="px-2 pt-2 group-data-[collapsible=icon]:px-1"
				>
					<SidebarGroupLabel className="mb-1 h-7 px-2.5 font-medium font-mono text-[9px] text-sidebar-foreground/45 uppercase tracking-[0.18em] group-data-[collapsible=icon]:hidden">
						{group.title}
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1.5">
							{group.items.map((item) => (
								<NavigationEntry
									key={item.to}
									item={item}
									pathname={location.pathname}
									search={location.search}
									isMobile={isMobile}
									closeMobileSidebar={() => setOpenMobile(false)}
								/>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			))}
		</>
	);
}
