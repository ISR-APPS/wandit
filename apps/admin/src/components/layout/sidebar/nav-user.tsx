import { BellSimpleIcon } from "@phosphor-icons/react/BellSimple";
import { CaretUpDownIcon } from "@phosphor-icons/react/CaretUpDown";
import { GearSixIcon } from "@phosphor-icons/react/GearSix";
import { SignOutIcon } from "@phosphor-icons/react/SignOut";
import { UserCircleGearIcon } from "@phosphor-icons/react/UserCircleGear";
import { Link } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

const adminUser = {
	name: "Platform Admin",
	email: "admin@wandit.app",
	avatar: "/images/avatars/01.png",
};

export function NavUser() {
	const { isMobile } = useSidebar();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="h-[52px] gap-2.5 rounded-[10px] px-2 transition-[background-color,color,transform] duration-150 active:scale-[0.985] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1!"
						>
							<Avatar className="size-[30px] rounded-full ring-1 ring-sidebar-border">
								<AvatarImage src={adminUser.avatar} alt={adminUser.name} />
								<AvatarFallback>PA</AvatarFallback>
							</Avatar>
							<div className="grid min-w-0 flex-1 text-left font-sans leading-tight group-data-[collapsible=icon]:hidden">
								<span className="truncate font-semibold text-[12.5px] text-sidebar-accent-foreground leading-4 tracking-[-0.01em]">
									{adminUser.name}
								</span>
								<span className="truncate text-[10.5px] text-sidebar-foreground/52 leading-3.5">
									Owner · Production
								</span>
							</div>
							<CaretUpDownIcon
								aria-hidden="true"
								size={14}
								weight="regular"
								className="ml-auto size-3.5! text-sidebar-foreground/52 group-data-[collapsible=icon]:hidden"
							/>
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="rounded-lg">
									<AvatarImage src={adminUser.avatar} alt={adminUser.name} />
									<AvatarFallback>PA</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{adminUser.name}</span>
									<span className="truncate text-muted-foreground text-xs">
										{adminUser.email}
									</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<UserCircleGearIcon size={16} weight="regular" />
								Account
							</DropdownMenuItem>
							<DropdownMenuItem>
								<GearSixIcon size={16} weight="regular" />
								Preferences
							</DropdownMenuItem>
							<DropdownMenuItem>
								<BellSimpleIcon size={16} weight="regular" />
								Notifications
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link to="/login">
									<SignOutIcon size={16} weight="regular" />
									Log out
								</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
