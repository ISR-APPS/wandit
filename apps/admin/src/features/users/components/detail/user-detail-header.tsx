import { Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	BanIcon,
	CheckIcon,
	CopyIcon,
	ShieldCheckIcon,
	WalletCardsIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminUserDetail } from "@/features/users/api/users.dto";

import {
	getInitials,
	getRoleLabel,
	getSubscriptionLabel,
	titleCase,
} from "./user-detail-helpers";

type UserDetailHeaderProps = {
	user: AdminUserDetail;
	onGrantCredits: () => void;
	onChangeRole: () => void;
	onToggleBanned: () => void;
};

export function UserDetailHeader({
	user,
	onGrantCredits,
	onChangeRole,
	onToggleBanned,
}: UserDetailHeaderProps) {
	async function copyUserId() {
		try {
			await navigator.clipboard.writeText(user.id);
			toast.success("User ID copied.");
		} catch {
			toast.error("The user ID could not be copied.");
		}
	}

	return (
		<header className="flex flex-col gap-5">
			<Button asChild variant="ghost" size="sm" className="w-fit">
				<Link to="/users">
					<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
					Back to users
				</Link>
			</Button>

			<div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
				<div className="flex min-w-0 items-start gap-4">
					<Avatar className="size-12">
						<AvatarImage src={user.avatarUrl} alt="" />
						<AvatarFallback>{getInitials(user.name)}</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-col gap-2">
						<div className="min-w-0">
							<h1 className="truncate font-semibold text-2xl tracking-tight">
								{user.name}
							</h1>
							<p className="truncate text-muted-foreground text-sm">
								{user.email}
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant={user.role === "owner" ? "default" : "outline"}>
								{getRoleLabel(user.role)}
							</Badge>
							<Badge variant="secondary">{titleCase(user.plan)}</Badge>
							<Badge
								variant={
									user.subscriptionStatus === "past-due"
										? "destructive"
										: "outline"
								}
							>
								{getSubscriptionLabel(user.subscriptionStatus)}
							</Badge>
							{user.isBanned ? (
								<Badge variant="destructive">
									<BanIcon aria-hidden="true" />
									Banned
								</Badge>
							) : (
								<Badge variant="outline">
									<CheckIcon aria-hidden="true" />
									Access active
								</Badge>
							)}
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={copyUserId}
								title="Copy user ID"
								aria-label={`Copy user ID ${user.id}`}
								className="font-mono text-muted-foreground"
							>
								<CopyIcon aria-hidden="true" />
								{user.id}
							</Button>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button type="button" variant="outline" onClick={onChangeRole}>
						<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
						Change role
					</Button>
					<Button type="button" onClick={onGrantCredits}>
						<WalletCardsIcon data-icon="inline-start" aria-hidden="true" />
						Grant credits
					</Button>
					<Button
						type="button"
						variant={user.isBanned ? "outline" : "destructive"}
						onClick={onToggleBanned}
					>
						{user.isBanned ? (
							<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
						) : (
							<BanIcon data-icon="inline-start" aria-hidden="true" />
						)}
						{user.isBanned ? "Restore access" : "Ban user"}
					</Button>
				</div>
			</div>
		</header>
	);
}
