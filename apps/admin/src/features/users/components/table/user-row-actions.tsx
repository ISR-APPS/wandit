import { Link } from "@tanstack/react-router";
import { isAdminRole } from "@wandit/contracts";
import {
	BanIcon,
	CopyIcon,
	CreditCardIcon,
	EllipsisIcon,
	ExternalLinkIcon,
	ShieldCheckIcon,
	UserCogIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/features/auth/lib/session";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import { BanUserDialog } from "@/features/users/components/ban-user-dialog";
import { ChangeRoleDialog } from "@/features/users/components/change-role-dialog";
import { GrantCreditsDialog } from "@/features/users/components/grant-credits-dialog";

type ActiveDialog = "credits" | "role" | "ban" | null;

function UserRowActions({ user }: { user: AdminUserSummary }) {
	const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
	const { data: session } = useSession();
	const isSelf = session?.user.id === user.id;
	// The server rejects banning an admin (restoring one is still allowed), so
	// banning an admin has to go through "Change role" first.
	const canToggleAccess = !isSelf && (user.banned || !isAdminRole(user.role));

	async function copyUserId() {
		try {
			await navigator.clipboard.writeText(user.id);
			toast.success("User ID copied");
		} catch {
			toast.error("User ID could not be copied");
		}
	}

	return (
		<>
			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="data-[state=open]:bg-accent"
									title="User actions"
								>
									<EllipsisIcon data-icon="inline-start" />
									<span className="sr-only">Open actions for {user.name}</span>
								</Button>
							</DropdownMenuTrigger>
						</span>
					</TooltipTrigger>
					<TooltipContent side="left" sideOffset={6}>
						User actions
					</TooltipContent>
				</Tooltip>
				<DropdownMenuContent align="end" className="w-52">
					<DropdownMenuGroup>
						<DropdownMenuLabel className="truncate">
							{user.name}
						</DropdownMenuLabel>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem asChild>
							<Link to="/users/$userId" params={{ userId: user.id }}>
								<ExternalLinkIcon />
								View user details
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setActiveDialog("credits")}>
							<CreditCardIcon />
							Grant credits
						</DropdownMenuItem>
						{!isSelf && (
							<DropdownMenuItem onSelect={() => setActiveDialog("role")}>
								<UserCogIcon />
								Change role
							</DropdownMenuItem>
						)}
						<DropdownMenuItem onSelect={() => void copyUserId()}>
							<CopyIcon />
							Copy user ID
						</DropdownMenuItem>
					</DropdownMenuGroup>
					{canToggleAccess && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuItem
									variant={user.banned ? "default" : "destructive"}
									onSelect={() => setActiveDialog("ban")}
								>
									{user.banned ? <ShieldCheckIcon /> : <BanIcon />}
									{user.banned ? "Restore access" : "Ban user"}
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<GrantCreditsDialog
				user={user}
				open={activeDialog === "credits"}
				onOpenChange={(open) => setActiveDialog(open ? "credits" : null)}
			/>
			<ChangeRoleDialog
				user={user}
				open={activeDialog === "role"}
				onOpenChange={(open) => setActiveDialog(open ? "role" : null)}
			/>
			<BanUserDialog
				user={user}
				open={activeDialog === "ban"}
				onOpenChange={(open) => setActiveDialog(open ? "ban" : null)}
			/>
		</>
	);
}

export { UserRowActions };
