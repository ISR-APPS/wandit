import { Link } from "@tanstack/react-router";
import { CircleIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type {
	AdminPaymentProvider,
	AdminSubscriptionStatus,
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
				<AvatarImage src={user.avatarUrl} alt="" />
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

function PaymentProviderBadge({
	provider,
}: {
	provider: AdminPaymentProvider | null;
}) {
	if (!provider) {
		return <span className="text-muted-foreground">—</span>;
	}

	const isStripe = provider === "stripe";

	return (
		<span className="inline-flex items-center gap-2.5">
			<span
				aria-hidden="true"
				className={cn(
					"flex size-6 shrink-0 items-center justify-center rounded-md font-semibold text-[11px] text-white shadow-xs ring-1 ring-white/15 ring-inset",
					isStripe ? "bg-[#635bff]" : "bg-[#0b9b72]",
				)}
			>
				{isStripe ? "S" : "C"}
			</span>
			<span className="font-medium text-sm">
				{isStripe ? "Stripe" : "Chargily"}
			</span>
		</span>
	);
}

const roleClasses: Record<AdminUserRole, string> = {
	user: "text-muted-foreground",
	affiliate: "border-sky-500/30 bg-sky-500/8 text-sky-700 dark:text-sky-300",
	admin:
		"border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300",
	owner: "border-primary/30 bg-primary/8 text-primary",
};

function RoleBadge({ role }: { role: AdminUserRole }) {
	return (
		<Badge variant="outline" className={cn("capitalize", roleClasses[role])}>
			{role}
		</Badge>
	);
}

const planClasses: Record<AdminUserPlan, string> = {
	free: "text-muted-foreground",
	starter: "border-border bg-muted/50 text-foreground",
	pro: "border-primary/25 bg-primary/8 text-primary",
};

function PlanBadge({ plan }: { plan: AdminUserPlan }) {
	return (
		<Badge variant="outline" className={cn("capitalize", planClasses[plan])}>
			{plan}
		</Badge>
	);
}

const subscriptionClasses: Record<AdminSubscriptionStatus, string> = {
	active:
		"border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	"past-due":
		"border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
	canceled:
		"border-border bg-muted/50 text-muted-foreground line-through decoration-muted-foreground/40",
};

function SubscriptionBadge({
	status,
}: {
	status: AdminSubscriptionStatus | null;
}) {
	if (!status) {
		return (
			<span className="text-muted-foreground text-sm">No subscription</span>
		);
	}

	return (
		<Badge
			variant="outline"
			className={cn("gap-1 capitalize", subscriptionClasses[status])}
		>
			<CircleIcon className="size-1.5 fill-current" />
			{titleCase(status)}
		</Badge>
	);
}

function AccountBadge({ user }: { user: AdminUserSummary }) {
	if (user.isBanned) {
		return (
			<div className="space-y-1">
				<Badge
					variant="outline"
					className="border-destructive/30 bg-destructive/8 text-destructive"
				>
					Banned
				</Badge>
				{user.banReason && (
					<p className="max-w-[150px] truncate text-muted-foreground text-xs">
						{user.banReason}
					</p>
				)}
			</div>
		);
	}

	return (
		<Badge
			variant="outline"
			className="border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
		>
			Active
		</Badge>
	);
}

export {
	AccountBadge,
	PaymentProviderBadge,
	PlanBadge,
	RoleBadge,
	SubscriptionBadge,
	UserIdentity,
};
