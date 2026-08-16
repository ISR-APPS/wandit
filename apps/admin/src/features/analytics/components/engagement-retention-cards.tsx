import type {
	AdminAnalyticsEngagementCohort,
	AdminAnalyticsReturning,
} from "@wandit/contracts";
import { CalendarHeartIcon } from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	getRetentionHeatmapBucket,
	getRetentionHeatmapColumns,
	type RetentionHeatmapBucket,
} from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { formatAdminDateTooltipLabel } from "@/lib/admin-date-range";
import { cn } from "@/lib/utils";

type ReturningUsersCardProps = {
	returning: AdminAnalyticsReturning;
};

type RetentionCohortHeatmapProps = {
	cohorts: AdminAnalyticsEngagementCohort[];
};

const returningMetrics = [
	{ key: "d1Pct", label: "D1", day: 1 },
	{ key: "d3Pct", label: "D3", day: 3 },
	{ key: "d7Pct", label: "D7", day: 7 },
	{ key: "d14Pct", label: "D14", day: 14 },
	{ key: "d30Pct", label: "D30", day: 30 },
] as const satisfies ReadonlyArray<{
	key: keyof AdminAnalyticsReturning;
	label: string;
	day: number;
}>;

const heatmapBucketClasses = {
	unavailable: "bg-muted/25 text-muted-foreground/55",
	zero: "bg-chart-1/5 text-muted-foreground",
	low: "bg-chart-1/10 text-foreground",
	medium: "bg-chart-1/20 text-foreground",
	high: "bg-chart-1/35 text-foreground",
	strong: "bg-chart-1/55 text-background",
} satisfies Record<RetentionHeatmapBucket, string>;

function ReturningUsersCard({ returning }: ReturningUsersCardProps) {
	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-1">
								Returning users
								<MetricInfoTooltip
									label="Returning users"
									content="Share of eligible signups who were active on the exact UTC calendar day after signup. Users who have not reached that day are excluded."
								/>
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Exact-day return rate after signup
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						Signup cohorts
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<dl className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-5">
					{returningMetrics.map((metric) => (
						<div
							key={metric.key}
							className="min-w-0 border-r border-b px-5 py-5"
						>
							<dt className="flex items-center gap-1 text-muted-foreground text-xs">
								{metric.label}
								<MetricInfoTooltip
									label={`${metric.label} return rate`}
									content={`Users active exactly ${metric.day} ${metric.day === 1 ? "day" : "days"} after their signup date.`}
								/>
							</dt>
							<dd className="mt-2 font-semibold text-2xl tabular-nums tracking-tight">
								{formatOverviewPercentValue(returning[metric.key])}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

function RetentionCohortHeatmap({ cohorts }: RetentionCohortHeatmapProps) {
	const columns = getRetentionHeatmapColumns(cohorts);
	const orderedCohorts = [...cohorts].sort((left, right) =>
		right.cohortWeekStart.localeCompare(left.cohortWeekStart),
	);
	const hasCohorts = orderedCohorts.length > 0 && columns.length > 0;

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-1">
								Weekly cohort retention
								<MetricInfoTooltip
									label="Weekly cohort retention"
									content="Each row groups users by signup week. Cells show the share active in that numbered week after signup. A dash means the cohort has not reached that week yet."
								/>
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Signup cohorts measured against weekly authenticated activity
						</CardDescription>
					</div>
					{hasCohorts ? (
						<div
							role="img"
							aria-label="Retention intensity scale; a muted square means the cohort has not reached that week"
							className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
						>
							<span>Less</span>
							{(["zero", "low", "medium", "high", "strong"] as const).map(
								(bucket) => (
									<span
										key={bucket}
										aria-hidden="true"
										className={cn(
											"size-3 rounded-[3px] border border-border/40",
											heatmapBucketClasses[bucket],
										)}
									/>
								),
							)}
							<span>More</span>
							<span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
							<span
								aria-hidden="true"
								className={cn(
									"size-3 rounded-[3px] border border-border/40",
									heatmapBucketClasses.unavailable,
								)}
							/>
							<span>Not reached</span>
						</div>
					) : null}
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{hasCohorts ? (
					<Table className="min-w-max tabular-nums">
						<TableCaption className="sr-only">
							Weekly signup cohort size and the percentage returning in each
							available week.
						</TableCaption>
						<TableHeader className="bg-muted/20">
							<TableRow className="hover:bg-transparent">
								<TableHead scope="col" className="h-11 min-w-40 pl-6">
									Cohort week
								</TableHead>
								<TableHead scope="col" className="h-11 min-w-20 text-right">
									Size
								</TableHead>
								{columns.map((weekIndex) => (
									<TableHead
										key={weekIndex}
										scope="col"
										className={cn(
											"h-11 min-w-20 text-center",
											weekIndex === columns.at(-1) && "pr-6",
										)}
									>
										W{weekIndex}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{orderedCohorts.map((cohort) => {
								const cohortLabel = formatAdminDateTooltipLabel(
									cohort.cohortWeekStart,
								);

								return (
									<TableRow key={cohort.cohortWeekStart}>
										<TableCell className="pl-6 font-medium">
											{cohortLabel}
										</TableCell>
										<TableCell className="text-right font-medium">
											{formatOverviewWholeNumber(cohort.size)}
										</TableCell>
										{columns.map((weekIndex) => {
											const value = cohort.weeks[weekIndex];
											const bucket = getRetentionHeatmapBucket(value);

											return (
												<TableCell
													key={weekIndex}
													aria-label={
														value === undefined
															? `${cohortLabel}, week ${weekIndex}: unavailable`
															: `${cohortLabel}, week ${weekIndex}: ${formatOverviewPercentValue(value)}`
													}
													className={cn(
														"p-1.5 text-center",
														weekIndex === columns.at(-1) && "pr-6",
													)}
												>
													<span
														className={cn(
															"block min-w-16 rounded-md border border-border/35 px-2 py-2 font-medium text-xs",
															heatmapBucketClasses[bucket],
														)}
													>
														{value === undefined
															? "—"
															: formatOverviewPercentValue(value)}
													</span>
												</TableCell>
											);
										})}
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				) : (
					<div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
						<span className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<CalendarHeartIcon className="size-5" />
						</span>
						<p className="mt-3 font-medium text-sm">
							No weekly retention cohorts yet
						</p>
						<p className="mt-1 max-w-sm text-muted-foreground text-xs">
							Cohorts appear after tracked signups return in a later week.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export type { RetentionCohortHeatmapProps, ReturningUsersCardProps };
export { RetentionCohortHeatmap, ReturningUsersCard };
