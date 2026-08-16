import type {
	AdminAnalyticsDuration,
	AdminAnalyticsFunnelDurations,
} from "@wandit/contracts";
import { Clock3Icon, SparklesIcon } from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatAnalyticsDurationHours } from "@/features/analytics/lib/analytics-data";
import { formatOverviewWholeNumber } from "@/features/overview/lib/formatters";

type FunnelDurationCardsProps = {
	durations: AdminAnalyticsFunnelDurations;
};

type FunnelDurationCardProps = {
	duration: AdminAnalyticsDuration;
	label: string;
	description: string;
	tooltip: string;
	icon: typeof Clock3Icon;
};

function FunnelDurationCard({
	duration,
	label,
	description,
	tooltip,
	icon: Icon,
}: FunnelDurationCardProps) {
	const hasMeasuredUsers = duration.users > 0;

	return (
		<Card
			className="h-full gap-0 overflow-hidden py-0 shadow-none"
			data-state={hasMeasuredUsers ? "data" : "empty"}
		>
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[210px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-1">
								{label}
								<MetricInfoTooltip label={label} content={tooltip} />
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">{description}</CardDescription>
					</div>
					<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
						<Icon aria-hidden="true" className="size-4" />
					</span>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<div className="grid grid-cols-2 divide-x">
					<div className="px-5 py-5">
						<p className="text-muted-foreground text-xs">Median</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
							{formatAnalyticsDurationHours(duration.medianHours)}
						</p>
					</div>
					<div className="px-5 py-5">
						<p className="text-muted-foreground text-xs">Average</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
							{formatAnalyticsDurationHours(duration.avgHours)}
						</p>
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 border-t px-5 py-3">
					<p className="text-muted-foreground text-xs">
						{hasMeasuredUsers
							? "Completed users in the signup cohort"
							: "No completed users measured yet"}
					</p>
					<Badge
						variant="outline"
						className="shrink-0 bg-muted/30 tabular-nums"
					>
						{formatOverviewWholeNumber(duration.users)} measured
					</Badge>
				</div>
			</CardContent>

			<div className="border-t bg-muted/20 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				Users who have not reached this milestone are excluded, not counted as
				zero.
			</div>
		</Card>
	);
}

function FunnelDurationCards({ durations }: FunnelDurationCardsProps) {
	return (
		<section
			aria-label="Signup cohort timing"
			className="grid gap-5 lg:grid-cols-2"
		>
			<FunnelDurationCard
				duration={durations.signupToFirstAction}
				label="Signup → first action"
				description="Time to a project or AI chat"
				tooltip="For users who signed up in the selected range, the time to their first project or AI chat. Users without an action are excluded. Organization-project timing uses the project creator as provenance, the same approximation as the funnel steps."
				icon={Clock3Icon}
			/>
			<FunnelDurationCard
				duration={durations.signupToFirstGeneration}
				label="Signup → first result"
				description="Time to a successful generation"
				tooltip="For users who signed up in the selected range, the time to their first successful generation. Users without a successful result are excluded. Organization-project timing uses the project creator as provenance, the same approximation as the funnel steps."
				icon={SparklesIcon}
			/>
		</section>
	);
}

export type { FunnelDurationCardsProps };
export { FunnelDurationCards };
