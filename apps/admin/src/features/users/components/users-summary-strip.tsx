import {
	BadgeDollarSignIcon,
	CircleAlertIcon,
	CoinsIcon,
	ShieldCheckIcon,
	UsersRoundIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import { formatWholeNumber } from "@/features/users/lib/formatters";

type UsersSummaryStripProps = {
	users: AdminUserSummary[];
};

const summaryItems = [
	{
		key: "total",
		label: "Total users",
		icon: UsersRoundIcon,
	},
	{
		key: "paying",
		label: "Paying users",
		icon: BadgeDollarSignIcon,
	},
	{
		key: "staff",
		label: "Staff access",
		icon: ShieldCheckIcon,
	},
	{
		key: "credits",
		label: "Credits available",
		icon: CoinsIcon,
	},
	{
		key: "attention",
		label: "Needs attention",
		icon: CircleAlertIcon,
	},
] as const;

function UsersSummaryStrip({ users }: UsersSummaryStripProps) {
	const totalUsers = users.length;
	const payingUsers = users.filter((user) => user.plan !== "free").length;
	const staffUsers = users.filter(
		(user) => user.role === "admin" || user.role === "owner",
	).length;
	const totalCredits = users.reduce(
		(total, user) => total + user.creditsBalance,
		0,
	);
	const needsAttention = users.filter(
		(user) => user.isBanned || user.subscriptionStatus === "past-due",
	).length;

	const values: Record<(typeof summaryItems)[number]["key"], string> = {
		total: formatWholeNumber(totalUsers),
		paying: formatWholeNumber(payingUsers),
		staff: formatWholeNumber(staffUsers),
		credits: formatWholeNumber(totalCredits),
		attention: formatWholeNumber(needsAttention),
	};

	const descriptions: Record<(typeof summaryItems)[number]["key"], string> = {
		total: "Across every role and plan",
		paying:
			totalUsers > 0
				? `${Math.round((payingUsers / totalUsers) * 100)}% of the user base`
				: "No paid subscriptions",
		staff: "Admin and owner accounts",
		credits: "Combined unspent balance",
		attention: "Past-due or suspended",
	};

	return (
		<div className="overflow-x-auto rounded-xl border bg-background">
			<div className="flex min-w-max divide-x">
				{summaryItems.map((item) => (
					<div
						key={item.key}
						className="flex min-w-[190px] flex-1 items-start gap-3 px-4 py-4 xl:min-w-0"
					>
						<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
							<item.icon className="size-4" />
						</div>
						<div className="min-w-0">
							<p className="text-muted-foreground text-xs">{item.label}</p>
							<p className="mt-0.5 font-semibold text-xl tabular-nums tracking-tight">
								{values[item.key]}
							</p>
							<p className="mt-1 truncate text-muted-foreground text-xs">
								{descriptions[item.key]}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function UsersSummaryStripSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border bg-background">
			<div className="flex min-w-max divide-x">
				{summaryItems.map((item) => (
					<div
						key={item.key}
						className="flex min-w-[190px] flex-1 items-start gap-3 px-4 py-4 xl:min-w-0"
					>
						<Skeleton className="size-8 shrink-0" />
						<div className="space-y-2">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-6 w-14" />
							<Skeleton className="h-3 w-28" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export type { UsersSummaryStripProps };
export { UsersSummaryStrip, UsersSummaryStripSkeleton };
