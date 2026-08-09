import {
	CircleDollarSignIcon,
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

import { titleCase } from "./user-detail-helpers";

type UserMetricsProps = {
	user: AdminUserDetail;
};

export function UserMetrics({ user }: UserMetricsProps) {
	const metrics = [
		{
			label: "Credit balance",
			value: formatWholeNumber(user.creditsBalance),
			detail: "Available now",
			icon: CoinsIcon,
		},
		{
			label: "Projects",
			value: formatWholeNumber(user.projectsCount),
			detail: `${formatWholeNumber(user.projects.length)} in activity`,
			icon: FolderKanbanIcon,
		},
		{
			label: "Plan",
			value: titleCase(user.plan),
			detail: user.subscription
				? `Subscription ${user.subscription.status}`
				: "No active subscription",
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
			<CardContent className="grid grid-cols-1 px-0 sm:grid-cols-2 lg:grid-cols-4">
				{metrics.map((metric, index) => {
					const Icon = metric.icon;

					return (
						<div
							key={metric.label}
							className="flex min-w-0 items-start gap-3 border-b p-4 last:border-b-0 sm:odd:border-r lg:border-r lg:border-b-0 lg:last:border-r-0"
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
