// The user menu: a trigger with the initials of the email, and a menu with the email and Sign out.
// AppSidebar shows it as a full row in the sidebar header or footer. AppHeader shows an avatar button.
// The userMenu field of theme.json picks the place.
// The owner of the app gets one more item: it opens the access requests dialog of the access feature.
// Sign-out uses the auth feature mutation, which opens / and clears the query cache on success.

import { UsersIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Direction } from "radix-ui";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	AccessRequestsDialog,
	accessQueryOptions,
	accessRequestsQueryOptions,
} from "~/features/access";
import { useSignOutMutation } from "~/features/auth";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
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
	/** `auth.users.id` of the signed-in user, from the session of the /app layout route. It is the key of the cached `app_access` row. */
	userId: string;
	/** Email of the signed-in user, from the session of the /app layout route. */
	email: string;
	/** The shell part that holds the menu. "sidebar" shows a row with the email; "header" shows the avatar only. */
	placement: "sidebar" | "header";
};

/**
 * The user menu. A failed sign-out shows a toast; a success leaves the app area.
 * Only the owner of the app sees the access requests item, with the count of the accounts that wait.
 */
export function NavUser({ userId, email, placement }: NavUserProps) {
	const { t, locale } = useT();
	const { isMobile } = useSidebar();
	const dir = Direction.useDirection();
	const signOut = useSignOutMutation();
	const initials = email.slice(0, 2).toUpperCase();
	const [isRequestsOpen, setIsRequestsOpen] = useState(false);
	// The button that opens the menu. Only one placement renders, so one ref serves the two.
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	// The /app layout loader fills the cache with this row. This read starts no request while the row is fresh.
	const { data: access } = useQuery(accessQueryOptions(userId));
	// Product rule: only the owner approves accounts. RLS gives the full list to the owner only.
	const isOwner = access?.role === "owner";
	const requests = useQuery({
		...accessRequestsQueryOptions(),
		enabled: isOwner,
	});
	const pendingCount = (requests.data ?? []).filter(
		(account) => account.status === "pending",
	).length;

	// The list has no live update. Each open of the menu reads it again, so the count and the dialog are current.
	function onMenuOpenChange(isOpen: boolean) {
		if (isOpen && isOwner) {
			requests.refetch();
		}
	}

	// Radix workaround: a dialog with no DialogTrigger leaves the keyboard focus on <body> at the close.
	// preventDefault stops the Radix handler, which runs after this one. The focus returns to the menu button.
	function onRequestsCloseAutoFocus(event: Event) {
		event.preventDefault();
		menuButtonRef.current?.focus();
	}

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
			{isOwner ? (
				<DropdownMenuItem onSelect={() => setIsRequestsOpen(true)}>
					<UsersIcon />
					{t("appAccess.requests")}
					{pendingCount > 0 ? (
						<Badge className="ms-auto tabular-nums">
							{new Intl.NumberFormat(locale).format(pendingCount)}
						</Badge>
					) : null}
				</DropdownMenuItem>
			) : null}
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

	// The dialog is a sibling of the menu, not a child: the menu content unmounts when an item closes it.
	const requestsDialog = isOwner ? (
		<AccessRequestsDialog
			open={isRequestsOpen}
			onOpenChange={setIsRequestsOpen}
			onCloseAutoFocus={onRequestsCloseAutoFocus}
		/>
	) : null;

	if (placement === "header") {
		return (
			<>
				<DropdownMenu onOpenChange={onMenuOpenChange}>
					<DropdownMenuTrigger asChild ref={menuButtonRef}>
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
				{requestsDialog}
			</>
		);
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu onOpenChange={onMenuOpenChange}>
					<DropdownMenuTrigger asChild ref={menuButtonRef}>
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
				{requestsDialog}
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
