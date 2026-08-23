import { CaretUpDownIcon } from "@phosphor-icons/react/CaretUpDown";
import { SignOutIcon } from "@phosphor-icons/react/SignOut";
import { useNavigate } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { sessionRoleLabel } from "@/features/auth/lib/permissions";
import { signOut, useSession } from "@/features/auth/lib/session";

function getInitials(name: string) {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("") || "?"
	);
}

export function NavUser() {
	const { isMobile } = useSidebar();
	const navigate = useNavigate();
	const { data } = useSession();
	const user = data?.user;
	const name = user?.name ?? "Administrator";
	const email = user?.email ?? "";
	const image = user?.image ?? undefined;
	const initials = getInitials(name);
	const roleLabel = sessionRoleLabel(user?.role ?? "user");

	async function handleLogOut() {
		await signOut();
		await navigate({ to: "/login" });
	}

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
								<AvatarImage src={image} alt={name} />
								<AvatarFallback>{initials}</AvatarFallback>
							</Avatar>
							<div className="grid min-w-0 flex-1 text-left font-sans leading-tight group-data-[collapsible=icon]:hidden">
								<div className="flex min-w-0 items-center gap-1.5">
									<span className="truncate font-semibold text-[12.5px] text-sidebar-accent-foreground leading-4 tracking-[-0.01em]">
										{name}
									</span>
									<Badge variant="outline" className="h-4 px-1 text-[8px]">
										{roleLabel}
									</Badge>
								</div>
								<span className="truncate text-[10.5px] text-sidebar-foreground/52 leading-3.5">
									{email}
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
									<AvatarImage src={image} alt={name} />
									<AvatarFallback>{initials}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<div className="flex min-w-0 items-center gap-2">
										<span className="truncate font-medium">{name}</span>
										<Badge variant="outline" className="h-5 px-1.5 text-[10px]">
											{roleLabel}
										</Badge>
									</div>
									<span className="truncate text-muted-foreground text-xs">
										{email}
									</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem onSelect={() => void handleLogOut()}>
								<SignOutIcon size={16} weight="regular" />
								Log out
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
