import type { AdminAnalyticsRetention } from "@wandit/contracts";
import { CalendarRangeIcon, DatabaseIcon } from "lucide-react";

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
	getRevenueRetentionColumns,
	orderRevenueRetentionCohorts,
} from "@/features/analytics/lib/revenue-history-data";
import {
	formatOverviewDate,
	formatOverviewPercentValue,
	formatOverviewRoundedUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type RevenueRetentionCardProps = {
	retention: AdminAnalyticsRetention;
};

function RevenueRetentionCard({ retention }: RevenueRetentionCardProps) {
	const cohorts = orderRevenueRetentionCohorts(retention.cohorts);
	const columns = getRevenueRetentionColumns(cohorts);
	const hasCohorts = cohorts.length > 0 && columns.length > 0;

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-1">
								Paid and revenue retention
								<MetricInfoTooltip
									label="Paid and revenue retention"
									content="Monthly cohorts start with an owner's first subscription. Paid retention counts owners with at least one active, trialing, or past-due subscription at each boundary. Revenue retention compares live list-price MRR with M0 and may exceed 100% after expansion."
								/>
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Monthly subscription cohorts, with paid owners and MRR retained
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						History since Jul 2026
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{hasCohorts ? (
					<Table className="min-w-max tabular-nums">
						<TableCaption className="sr-only">
							Monthly subscription cohort owners, M0 recurring revenue, paid
							retention, and revenue retention through month 11.
						</TableCaption>
						<TableHeader className="bg-muted/20">
							<TableRow className="hover:bg-transparent">
								<TableHead className="h-12 min-w-36 pl-6">Cohort</TableHead>
								<TableHead className="h-12 min-w-24 text-right">
									Owners
								</TableHead>
								<TableHead className="h-12 min-w-28 text-right">
									M0 MRR
								</TableHead>
								{columns.map((month) => (
									<TableHead
										key={month}
										className="h-12 min-w-24 text-center last:pr-6"
									>
										M{month}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{cohorts.map((cohort) => {
								const cohortLabel = formatOverviewDate(
									cohort.cohortMonth,
									"en-US",
									{ month: "short", year: "numeric" },
								);

								return (
									<TableRow key={cohort.cohortMonth}>
										<TableCell className="pl-6 font-medium">
											{cohortLabel}
										</TableCell>
										<TableCell className="text-right font-medium">
											{formatOverviewWholeNumber(cohort.owners)}
										</TableCell>
										<TableCell className="text-right font-medium">
											{formatOverviewRoundedUsdMinor(cohort.m0MrrCents)}
										</TableCell>
										{columns.map((month) => {
											const point = cohort.points[month];

											return (
												<TableCell
													key={month}
													aria-label={
														point
															? `${cohortLabel}, month ${month}: ${formatOverviewPercentValue(point.paidPct)} paid, ${point.revenuePct === null ? "revenue unavailable" : `${formatOverviewPercentValue(point.revenuePct)} revenue`}`
															: `${cohortLabel}, month ${month}: not reached`
													}
													className="text-center last:pr-6"
												>
													{point ? (
														<span className="block rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
															<span className="block font-medium text-xs">
																{formatOverviewPercentValue(point.paidPct)}
															</span>
															<span className="mt-0.5 block text-[10px] text-muted-foreground">
																{point.revenuePct === null
																	? "— revenue"
																	: `${formatOverviewPercentValue(point.revenuePct)} revenue`}
															</span>
														</span>
													) : (
														<span className="text-muted-foreground/60">—</span>
													)}
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
							<CalendarRangeIcon className="size-5" />
						</span>
						<p className="mt-3 font-medium text-sm">
							No subscription retention cohorts yet
						</p>
						<p className="mt-1 max-w-sm text-muted-foreground text-xs">
							Cohorts appear after a subscription reaches its first monthly
							observation boundary.
						</p>
					</div>
				)}
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/25 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				<DatabaseIcon className="mt-0.5 size-3.5 shrink-0" />
				<p>
					Approximate: subscription state is rebuilt from stored Stripe events
					since July 2026, with current subscription data used where history is
					incomplete. Past-due subscriptions count as retained.
				</p>
			</div>
		</Card>
	);
}

export type { RevenueRetentionCardProps };
export { RevenueRetentionCard };
