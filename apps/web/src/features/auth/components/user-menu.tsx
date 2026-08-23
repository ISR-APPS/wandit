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
import { CreditCard, LogOut } from "lucide-react";

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

export function UserMenu() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session, isPending } = useSession();
	const { open } = useAuthModal();

	if (isPending) {
		return <Skeleton className="size-7 rounded-full" />;
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
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel className="ph-no-capture flex flex-col gap-0.5 font-normal">
					<span className="font-medium text-sm">{user.name}</span>
					<span className="font-mono text-muted-foreground text-xs">
						{user.displayEmail ?? user.email}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/billing">
						<CreditCard />
						{t("billing.page.title")}
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuLabel className="pb-0 text-[10px] text-muted-foreground uppercase tracking-widest">
					{t("common.language")}
				</DropdownMenuLabel>
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
					<LogOut className="size-4" />
					{t("auth.signOut")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
