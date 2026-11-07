// The user menu: a trigger with the initials of the email, and a menu with the email and Sign out.
// AppSidebar shows it as a full row in the sidebar header or footer. AppHeader shows an avatar button.
// The userMenu field of theme.json picks the place.
// Sign-out uses the auth feature mutation, which opens / and clears the query cache on success.

import { Direction } from "radix-ui";
import { toast } from "sonner";
import { useSignOutMutation } from "~/features/auth";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { CaretUpDownIcon, SignOutIcon } from "~/shared/ui/icons";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "~/shared/ui/sidebar";

type NavUserProps = {
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
	/** The shell part that holds the menu. "sidebar" shows a row with the email; "header" shows the avatar only. */
	placement: "sidebar" | "header";
};

/** The user menu. A failed sign-out shows a toast; a success leaves the app area. */
export function NavUser({ email, placement }: NavUserProps) {
	const { t } = useT();
	const { isMobile } = useSidebar();
	const dir = Direction.useDirection();
	const signOut = useSignOutMutation();
	const initials = email.slice(0, 2).toUpperCase();

	const menu = (
		<DropdownMenuContent
			className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
			// Below the header and on a phone the menu opens down. Beside the sidebar it opens away from the column.
			side={
				placement === "header" || isMobile
					? "bottom"
					: dir === "rtl"
						? "left"
						: "right"
			}
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
				<SignOutIcon className="rtl:rotate-180" />
				{t("common.signOut")}
			</DropdownMenuItem>
		</DropdownMenuContent>
	);

	if (placement === "header") {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					{/* The email names the button for screen readers. The initials alone say little. */}
					<Button variant="ghost" size="icon" aria-label={email}>
						<Avatar className="size-8 rounded-lg">
							<AvatarFallback className="rounded-lg bg-secondary font-medium text-secondary-foreground text-xs">
								{initials}
							</AvatarFallback>
						</Avatar>
					</Button>
				</DropdownMenuTrigger>
				{menu}
			</DropdownMenu>
		);
	}

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
									{initials}
								</AvatarFallback>
							</Avatar>
							<span dir="auto" className="min-w-0 flex-1 truncate font-medium">
								{email}
							</span>
							<CaretUpDownIcon className="ms-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					{menu}
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
