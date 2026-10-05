/**
 * The account menu: the avatar opens billing, the languages, and sign-out.
 * Signed out, it is a sign-in button that opens the auth modal. The top bars
 * render the round avatar. The dashboard sidebar renders the full row with
 * the name and the email. Calls the session hooks and signOut.
 */
import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react/DotsThreeVertical";
import { SignOutIcon } from "@phosphor-icons/react/SignOut";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@wandit/ui/components/avatar";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { LanguageSwitcherMenuItems } from "@/components/language-switcher";
import { useTranslation } from "@/lib/i18n";
import { signOut, useSession } from "../lib/session";
import { useAuthModal } from "./auth-modal";

function initials(name: string): string {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0])
			.join("")
			.toUpperCase() || "?"
	);
}

/** The account menu of the signed-in user. Signed out, it is a sign-in button. */
export function UserMenu({
	variant = "avatar",
}: {
	/** `avatar` is the round button of a top bar. `sidebar` is the row at the foot of the dashboard sidebar; collapsed, the row shows only the avatar. */
	variant?: "avatar" | "sidebar";
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session, isPending } = useSession();
	const { open } = useAuthModal();

	const isRow = variant === "sidebar";

	if (isPending) {
		return (
			<Skeleton
				className={cn("rounded-full", isRow ? "m-1 size-8" : "size-7")}
			/>
		);
	}

	if (!session) {
		return (
			<Button type="button" variant="outline" size="sm" onClick={() => open()}>
				{t("auth.signIn")}
			</Button>
		);
	}

	const { user } = session;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{isRow ? (
					// The group-data selectors read the collapsed state of the dashboard sidebar.
					<button
						type="button"
						// The name and the email are hidden in a collapsed sidebar, so the label names the button.
						aria-label={user.name}
						className="ph-no-capture flex w-full items-center gap-2.5 rounded-2xl p-1 text-start outline-offset-2 transition-colors hover:bg-night/[0.05] focus-visible:outline-2 focus-visible:outline-ember data-[state=open]:bg-night/[0.05] dark:data-[state=open]:bg-white/[0.06] dark:hover:bg-white/[0.06]"
					>
						<Avatar className="size-8">
							{user.image ? <AvatarImage src={user.image} alt="" /> : null}
							<AvatarFallback className="bg-spark font-grotesk font-semibold text-night text-xs">
								{initials(user.name)}
							</AvatarFallback>
						</Avatar>
						<span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
							<span className="block truncate font-grotesk font-semibold text-night text-sm leading-tight dark:text-foreground">
								{user.name}
							</span>
							<span className="block truncate text-night/55 text-xs leading-tight dark:text-foreground/55">
								{user.displayEmail ?? user.email}
							</span>
						</span>
						<DotsThreeVerticalIcon
							aria-hidden
							weight="bold"
							className="size-4 shrink-0 text-night/45 group-data-[collapsible=icon]:hidden dark:text-foreground/45"
						/>
					</button>
				) : (
					<button
						type="button"
						aria-label={user.name}
						className="ph-no-capture rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<Avatar className="size-7">
							{user.image ? (
								<AvatarImage src={user.image} alt={user.name} />
							) : null}
							{/* 28px ink circle with a parchment initial (3a reference). */}
							<AvatarFallback className="bg-foreground font-medium text-background text-xs">
								{initials(user.name)}
							</AvatarFallback>
						</Avatar>
					</button>
				)}
			</DropdownMenuTrigger>
			{/* The sidebar row is at the bottom of the screen, so its menu opens upward. */}
			<DropdownMenuContent
				side={isRow ? "top" : "bottom"}
				align={isRow ? "start" : "end"}
				className="w-64"
			>
				<DropdownMenuLabel className="ph-no-capture flex flex-col gap-0.5 pb-2">
					<span className="text-popover-foreground text-sm">{user.name}</span>
					<span className="font-normal font-sans text-muted-foreground text-xs">
						{user.displayEmail ?? user.email}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/billing">
						<CreditCardIcon aria-hidden weight="duotone" />
						{t("billing.page.title")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
				<LanguageSwitcherMenuItems />
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					onClick={() => {
						void (async () => {
							await signOut();
							queryClient.clear();
							await navigate({ to: "/" });
						})();
					}}
				>
					<SignOutIcon aria-hidden weight="duotone" />
					{t("auth.signOut")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
