// The user row at the foot of the sidebar: the avatar, the email, and a menu with Sign out.
// AppSidebar renders it with the email of the session. Sign-out uses the auth feature mutation,
// which opens / and clears the query cache on success.

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { Direction } from "radix-ui";
import { toast } from "sonner";
import { useSignOutMutation } from "~/features/auth";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/shared/ui/sidebar";

type NavUserProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
};

/** The user row. A failed sign-out shows a toast; a success leaves the app area. */
export function NavUser({ email }: NavUserProps) {
	const { t } = useT();
	const { isMobile } = useSidebar();
	const dir = Direction.useDirection();
	const signOut = useSignOutMutation();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="size-8 rounded-lg">
								<AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
									{email.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span dir="auto" className="min-w-0 flex-1 truncate font-medium">
								{email}
							</span>
							<ChevronsUpDownIcon className="ms-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						// On a phone the menu opens below the row; on a desktop it opens away from the sidebar.
						side={isMobile ? "bottom" : dir === "rtl" ? "left" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel
							dir="auto"
							className="truncate font-normal text-muted-foreground"
						>
							{email}
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							disabled={signOut.isPending}
							onSelect={() =>
								signOut.mutate(undefined, {
									onError: () => toast.error(t("shell.signOutError")),
								})
							}
						>
							<LogOutIcon className="rtl:rotate-180" />
							{t("common.signOut")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
