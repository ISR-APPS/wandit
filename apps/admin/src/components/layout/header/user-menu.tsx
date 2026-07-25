import { Link } from "@tanstack/react-router";
import {
	BellIcon,
	LogOutIcon,
	Settings2Icon,
	UserRoundCogIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const adminUser = {
	name: "Platform Admin",
	email: "admin@wandit.app",
	avatar: "/images/avatars/01.png",
};

export default function UserMenu() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon" variant="ghost" className="rounded-full">
					<Avatar>
						<AvatarImage src={adminUser.avatar} alt={adminUser.name} />
						<AvatarFallback>PA</AvatarFallback>
					</Avatar>
					<span className="sr-only">Open administrator menu</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-60" align="end">
				<DropdownMenuLabel className="p-0 font-normal">
					<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
						<Avatar>
							<AvatarImage src={adminUser.avatar} alt={adminUser.name} />
							<AvatarFallback>PA</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">{adminUser.name}</span>
							<span className="truncate text-muted-foreground text-xs">
								{adminUser.email}
							</span>
						</div>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<UserRoundCogIcon />
						Account
					</DropdownMenuItem>
					<DropdownMenuItem>
						<Settings2Icon />
						Preferences
					</DropdownMenuItem>
					<DropdownMenuItem>
						<BellIcon />
						Notifications
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link to="/login">
							<LogOutIcon />
							Log out
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
