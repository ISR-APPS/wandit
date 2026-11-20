/**
 * Metric strip of the user detail page: wallet balance, spend and spend badge, projects, paid state, AI cost.
 * UserDetailPage renders it from the admin user detail. Calls highestSpendBadgeId of user-detail-helpers for the spend badge.
 */
import {
	CircleDollarSignIcon,
	CircleMinusIcon,
	CoinsIcon,
	FolderKanbanIcon,
	GemIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { AdminUserDetail } from "@/features/users/api/users.dto";
import {
	formatUsdMicros,
	formatWholeNumber,
} from "@/features/users/lib/formatters";
import { formatCreditAmount, formatCreditBalance } from "@/lib/credit-format";
import { cn } from "@/lib/utils";

import { highestSpendBadgeId, titleCase } from "./user-detail-helpers";

type UserMetricsProps = {
	user: AdminUserDetail;
};

export function UserMetrics({ user }: UserMetricsProps) {
	const spendBadgeId = highestSpendBadgeId(user.creditsConsumed);
	const metrics = [
		{
			label: "Wallet balance",
			value: formatCreditBalance(user.creditsBalance),
			detail: "Personal wallet, available now",
			icon: CoinsIcon,
		},
		{
			label: "Credits used",
			value: formatCreditAmount(user.creditsConsumed),
			detail: spendBadgeId
				? `Spend badge: ${titleCase(spendBadgeId)}`
				: "No spend badge yet",
			icon: CircleMinusIcon,
		},
		{
			label: "Projects",
			value: formatWholeNumber(user.projectsCount),
			detail: `${formatWholeNumber(user.projects.length)} in activity`,
			icon: FolderKanbanIcon,
		},
		{
			label: "Payment status",
			value: user.isPaidOwner ? "Paid" : "Free",
			detail: user.isPaidOwner
				? "Has a top-up or had a plan"
				: "No payment yet",
			icon: GemIcon,
		},
		{
			label: "AI spend",
			value: formatUsdMicros(user.aiSpend.totalCostUsdMicros),
			detail: `${formatWholeNumber(user.aiSpend.meteredOperations)} metered operations`,
			icon: CircleDollarSignIcon,
		},
	] as const;

	return (
		<Card className="gap-0 py-0 shadow-none">
			<CardContent className="grid grid-cols-1 px-0 sm:grid-cols-2 lg:grid-cols-5">
				{metrics.map((metric, index) => {
					const Icon = metric.icon;

					return (
						<div
							key={metric.label}
							className={cn(
								"flex min-w-0 items-start gap-3 border-b p-4 last:border-b-0 sm:last:col-span-2 lg:border-r lg:border-b-0 lg:last:col-span-1 lg:last:border-r-0",
								index % 2 === 0 && index < metrics.length - 1 && "sm:border-r",
							)}
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<Icon aria-hidden="true" />
							</div>
							<dl className="min-w-0">
								<dt className="truncate text-muted-foreground text-xs">
									{metric.label}
								</dt>
								<dd
									className="mt-1 font-semibold text-2xl tabular-nums tracking-tight"
									title={metric.value}
								>
									{metric.value}
								</dd>
								<dd className="mt-1 truncate text-muted-foreground text-xs">
									{metric.detail}
								</dd>
							</dl>
							<span className="sr-only">
								{index + 1} of {metrics.length} metrics
							</span>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
