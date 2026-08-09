import { Link } from "@tanstack/react-router";
import { BadgeCheckIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type {
	AdminUserPlan,
	AdminUserRole,
	AdminUserSummary,
} from "@/features/users/api/users.dto";
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
				<Link
					to="/users/$userId"
					params={{ userId: user.id }}
					className="block truncate font-medium text-foreground outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
				>
					{user.name}
				</Link>
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
};

function PlanBadge({ plan }: { plan: AdminUserPlan }) {
	return (
		<Badge variant="outline" className={cn("capitalize", planClasses[plan])}>
			{titleCase(plan)}
		</Badge>
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

export { PlanBadge, RoleBadge, StatusBadge, UserIdentity };
