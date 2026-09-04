import { Link } from "@tanstack/react-router";
import { BadgeCheckIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type {
	AdminUserPlan,
	AdminUserRole,
	AdminUserSummary,
} from "@/features/users/api/users.dto";
import { CountryFlag } from "@/features/users/components/country-flag";
import { cn } from "@/lib/utils";

import { getInitials, titleCase } from "./users-table-utils";

function UserIdentity({ user }: { user: AdminUserSummary }) {
	return (
		<div className="flex w-full min-w-0 items-center gap-3">
			<Avatar size="lg" className="border">
				<AvatarImage src={user.image ?? undefined} alt="" />
				<AvatarFallback className="font-medium">
					{getInitials(user.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-1.5">
					<Link
						to="/users/$userId"
						params={{ userId: user.id }}
						className="min-w-0 truncate font-medium text-foreground outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
					>
						{user.name}
					</Link>
					{user.countryCode ? (
						<CountryFlag countryCode={user.countryCode} />
					) : null}
				</div>
				<p className="truncate text-muted-foreground text-xs">{user.email}</p>
				<p className="mt-0.5 font-mono text-[10px] text-muted-foreground/75">
					{user.id}
				</p>
			</div>
		</div>
	);
}

const roleClasses: Record<AdminUserRole, string> = {
	user: "text-muted-foreground",
	support: "border-sky-500/30 bg-sky-500/8 text-sky-700 dark:text-sky-300",
	admin:
		"border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300",
};

function RoleBadge({ role }: { role: AdminUserRole }) {
	return (
		<Badge variant="outline" className={cn("capitalize", roleClasses[role])}>
			{role}
		</Badge>
	);
}

const planClasses: Record<AdminUserPlan, string> = {
	business: "border-chart-2/25 bg-chart-2/8 text-chart-2",
	free: "text-muted-foreground",
	pro: "border-primary/25 bg-primary/8 text-primary",
	starter:
		"border-violet-500/25 bg-violet-500/8 text-violet-700 dark:text-violet-300",
};

function PlanBadge({ plan }: { plan: AdminUserPlan }) {
	return (
		<Badge variant="outline" className={cn("capitalize", planClasses[plan])}>
			{titleCase(plan)}
		</Badge>
	);
}

function PhoneCell({ phone }: { phone: string | null }) {
	if (!phone) {
		return <span className="text-muted-foreground">—</span>;
	}

	return (
		<a
			href={`tel:${phone}`}
			className="whitespace-nowrap font-mono text-sm hover:underline"
		>
			{phone}
		</a>
	);
}

function StatusBadge({ user }: { user: AdminUserSummary }) {
	if (user.banned) {
		return (
			<Badge
				variant="outline"
				className="border-destructive/30 bg-destructive/8 text-destructive"
			>
				Banned
			</Badge>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<Badge
				variant="outline"
				className="border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
			>
				Active
			</Badge>
			{user.emailVerified ? (
				<Badge variant="outline" className="gap-1 text-muted-foreground">
					<BadgeCheckIcon className="size-3" aria-hidden="true" />
					Verified
				</Badge>
			) : (
				<Badge variant="outline" className="text-muted-foreground">
					Unverified
				</Badge>
			)}
		</div>
	);
}

export { PhoneCell, PlanBadge, RoleBadge, StatusBadge, UserIdentity };
