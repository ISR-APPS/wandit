import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

export default function UserMenu() {
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
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon" variant="ghost" className="rounded-full">
					<Avatar>
						<AvatarImage src={image} alt={name} />
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<span className="sr-only">Open administrator menu</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="min-w-60" align="end">
				<DropdownMenuLabel className="p-0 font-normal">
					<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
						<Avatar>
							<AvatarImage src={image} alt={name} />
							<AvatarFallback>{initials}</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<div className="flex min-w-0 items-center gap-2">
								<span className="truncate font-semibold">{name}</span>
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
						<LogOutIcon />
						Log out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
