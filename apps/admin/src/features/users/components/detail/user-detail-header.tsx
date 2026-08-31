import { Link } from "@tanstack/react-router";
import { isStaffRole } from "@wandit/contracts";
import {
	ArrowLeftIcon,
	BadgeCheckIcon,
	BanIcon,
	CopyIcon,
	HandCoinsIcon,
	ShieldCheckIcon,
	WalletCardsIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import type { AdminUserDetail } from "@/features/users/api/users.dto";
import {
	CountryFlag,
	countryDisplayName,
} from "@/features/users/components/country-flag";
import { PhoneCell } from "@/features/users/components/table/user-table-cells";
import { formatAdminDate } from "@/features/users/lib/formatters";

import { getInitials, getRoleLabel, titleCase } from "./user-detail-helpers";

type UserDetailHeaderProps = {
	user: AdminUserDetail;
	/** False when the signed-in admin is viewing their own account. */
	canManageAccess: boolean;
	onGrantCredits: () => void;
	onGrantOffline?: () => void;
	onChangeRole: () => void;
	onToggleBanned: () => void;
};

export function UserDetailHeader({
	user,
	canManageAccess,
	onGrantCredits,
	onGrantOffline,
	onChangeRole,
	onToggleBanned,
}: UserDetailHeaderProps) {
	const canGrantCredits = useAdminPermission({ users: ["grant-credits"] });
	const canSetRole = useAdminPermission({ users: ["set-role"] });
	const canBan = useAdminPermission({ users: ["ban"] });
	const canManageBilling = useAdminPermission({ billing: ["manage"] });
	// The server rejects banning staff (restoring one is still allowed), so a
	// staff account has to be demoted before it can be banned.
	const canToggleBanned =
		canBan && canManageAccess && (user.banned || !isStaffRole(user.role));

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
						<AvatarImage src={user.image ?? undefined} alt="" />
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
							<div className="text-muted-foreground text-sm">
								<PhoneCell phone={user.phone} />
							</div>
							<div className="flex items-center gap-1.5 text-muted-foreground text-sm">
								{user.countryCode ? (
									<>
										<CountryFlag countryCode={user.countryCode} />
										<span>{countryDisplayName(user.countryCode)}</span>
									</>
								) : (
									<span>Unknown</span>
								)}
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant={user.role === "admin" ? "default" : "outline"}>
								{getRoleLabel(user.role)}
							</Badge>
							<Badge variant="secondary">{titleCase(user.plan)}</Badge>
							{user.emailVerified ? (
								<Badge variant="outline">
									<BadgeCheckIcon aria-hidden="true" />
									Verified
								</Badge>
							) : (
								<Badge variant="outline">Unverified</Badge>
							)}
							{user.banned ? (
								<Badge variant="destructive">
									<BanIcon aria-hidden="true" />
									Banned
								</Badge>
							) : null}
							<span className="text-muted-foreground text-xs">
								Signed up {formatAdminDate(user.createdAt)}
							</span>
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
						{user.banned && user.banReason ? (
							<p className="max-w-xl rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-muted-foreground text-sm">
								Ban reason: {user.banReason}
							</p>
						) : null}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{canManageBilling && !user.subscription && onGrantOffline ? (
						<Button type="button" variant="outline" onClick={onGrantOffline}>
							<HandCoinsIcon data-icon="inline-start" aria-hidden="true" />
							Grant offline subscription
						</Button>
					) : null}
					{canSetRole && canManageAccess ? (
						<Button type="button" variant="outline" onClick={onChangeRole}>
							<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
							Change role
						</Button>
					) : null}
					{canGrantCredits ? (
						<Button type="button" onClick={onGrantCredits}>
							<WalletCardsIcon data-icon="inline-start" aria-hidden="true" />
							Grant credits
						</Button>
					) : null}
					{canToggleBanned ? (
						<Button
							type="button"
							variant={user.banned ? "outline" : "destructive"}
							onClick={onToggleBanned}
						>
							{user.banned ? (
								<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
							) : (
								<BanIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{user.banned ? "Restore access" : "Ban user"}
						</Button>
					) : null}
				</div>
			</div>
		</header>
	);
}
