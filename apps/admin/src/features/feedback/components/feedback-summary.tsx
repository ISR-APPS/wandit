import { BellRingingIcon } from "@phosphor-icons/react/BellRinging";
import { BugIcon } from "@phosphor-icons/react/Bug";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { TrayIcon } from "@phosphor-icons/react/Tray";

import { Skeleton } from "@/components/ui/skeleton";
import type { FeedbackStats } from "@/features/feedback/api/feedback.dto";
import { cn } from "@/lib/utils";

function FeedbackSummary({
	stats,
	isLoading,
}: {
	stats: FeedbackStats | undefined;
	isLoading: boolean;
}) {
	const metrics = [
		{
			label: "Needs triage",
			value: stats?.byStatus.new ?? 0,
			description: "Unreviewed conversations",
			icon: TrayIcon,
			accent: true,
		},
		{
			label: "Open bugs",
			value: stats?.openBugs ?? 0,
			description: "Bug reports not yet resolved",
			icon: BugIcon,
		},
		{
			label: "High priority",
			value: stats?.highPriorityOpen ?? 0,
			description: "Urgent or high, still open",
			icon: BellRingingIcon,
		},
		{
			label: "Resolved (7 days)",
			value: stats?.resolvedLast7Days ?? 0,
			description: "Closed in the last week",
			icon: CheckCircleIcon,
		},
	];

	return (
		<section
			aria-label="Feedback summary"
			className="overflow-hidden rounded-xl border bg-background"
		>
			<div className="grid @[880px]/main:grid-cols-4 grid-cols-2">
				{metrics.map((metric, index) => (
					<div
						key={metric.label}
						className={cn(
							"flex min-w-0 items-start gap-3 border-b px-4 py-4",
							index % 2 === 0 && "border-r",
							index > 1 && "border-b-0",
							"@[880px]/main:border-r @[880px]/main:border-b-0",
							index === metrics.length - 1 && "@[880px]/main:border-r-0",
						)}
					>
						<div
							className={cn(
								"mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border bg-muted/40 text-muted-foreground",
								metric.accent && "border-primary/15 bg-primary/8 text-primary",
							)}
						>
							<metric.icon aria-hidden="true" size={16} weight="regular" />
						</div>
						<div className="min-w-0">
							<p className="truncate text-muted-foreground text-xs">
								{metric.label}
							</p>
							{isLoading ? (
								<Skeleton className="mt-1 h-6 w-9" />
							) : (
								<p className="mt-0.5 font-mono font-semibold text-xl tabular-nums tracking-tight">
									{metric.value}
								</p>
							)}
							<p className="mt-1 truncate text-muted-foreground text-xs">
								{metric.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

export { FeedbackSummary };
