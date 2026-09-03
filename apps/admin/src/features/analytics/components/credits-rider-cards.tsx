import type {
	AdminAnalyticsConversionByCreditsPoint,
	AdminAnalyticsFreeCredits,
} from "@wandit/contracts";
import { CoinsIcon, TimerResetIcon, UsersRoundIcon } from "lucide-react";

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
import { InlinePercentageBar } from "@/features/analytics/components/inline-percentage-bar";
import {
	formatAnalyticsDays,
	formatNullableAnalyticsMetric,
	mapConversionByCreditsChartData,
} from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type FreeCreditsCardProps = {
	freeCredits: AdminAnalyticsFreeCredits;
};

type ConversionByCreditsCardProps = {
	points: AdminAnalyticsConversionByCreditsPoint[];
};

const freeCreditsTooltip =
	"Time from the signup grant to consuming the full grant. This excludes users who received another promo grant before crossing, subscribed before crossing, or never consumed the full grant.";

function FreeCreditsCard({ freeCredits }: FreeCreditsCardProps) {
	const hasMeasuredUsers = freeCredits.measuredUsers > 0;

	return (
		<Card
			className="h-full gap-0 overflow-hidden py-0 shadow-none"
			data-state={hasMeasuredUsers ? "data" : "empty"}
		>
			<CardHeader className="border-b pt-6">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle>
							<h2 className="flex items-center gap-1">
								Free-credit runway
								<MetricInfoTooltip
									label="Free-credit runway"
									content={freeCreditsTooltip}
								/>
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Days to consume the signup grant
						</CardDescription>
					</div>
					<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
						<TimerResetIcon aria-hidden="true" className="size-4" />
					</span>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<div className="grid grid-cols-2 divide-x border-b">
					<div className="px-5 py-5">
						<p className="text-muted-foreground text-xs">Median</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
							{formatAnalyticsDays(freeCredits.medianDaysToConsume)}
						</p>
					</div>
					<div className="px-5 py-5">
						<p className="text-muted-foreground text-xs">Average</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
							{formatAnalyticsDays(freeCredits.avgDaysToConsume)}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 px-5 py-4">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
						<UsersRoundIcon aria-hidden="true" className="size-4" />
					</span>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-1">
							<p className="text-muted-foreground text-xs">Measured users</p>
							<MetricInfoTooltip
								label="Measured users"
								content={freeCreditsTooltip}
							/>
						</div>
						<p className="mt-0.5 font-semibold text-xl tabular-nums">
							{formatOverviewWholeNumber(freeCredits.measuredUsers)}
						</p>
					</div>
					{hasMeasuredUsers ? null : (
						<Badge variant="outline" className="shrink-0 bg-muted/30">
							Not enough data
						</Badge>
					)}
				</div>
			</CardContent>

			<div className="border-t bg-muted/20 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				All-time as of the latest snapshot; the selected range does not change
				this card.
			</div>
		</Card>
	);
}

function ConversionByCreditsCard({ points }: ConversionByCreditsCardProps) {
	const rows = mapConversionByCreditsChartData(points);
	const totalOwners = rows.reduce((total, point) => total + point.owners, 0);
	const totalPaidOwners = rows.reduce(
		(total, point) => total + point.paidOwners,
		0,
	);
	const hasOwners = totalOwners > 0;

	return (
		<Card
			className="h-full gap-0 overflow-hidden py-0 shadow-none"
			data-state={hasOwners ? "data" : "empty"}
		>
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-1">
								Paid conversion by credits used
								<MetricInfoTooltip
									label="Paid conversion by credits used"
									content="All billing owners grouped by gross all-time credits consumed. Paid means the owner has ever started a subscription."
								/>
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Ever-paid owners within each consumption bucket
						</CardDescription>
					</div>
					<Badge
						variant="outline"
						className="shrink-0 bg-muted/30 tabular-nums"
					>
						{formatOverviewWholeNumber(totalPaidOwners)} /{" "}
						{formatOverviewWholeNumber(totalOwners)} paid
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{hasOwners ? (
					<Table className="min-w-[620px]">
						<TableCaption className="sr-only">
							Billing owners and ever-paid conversion by all-time credits
							consumed.
						</TableCaption>
						<TableHeader className="bg-muted/20">
							<TableRow className="hover:bg-transparent">
								<TableHead className="pl-6">Credits used</TableHead>
								<TableHead className="text-right">Owners</TableHead>
								<TableHead className="text-right">Paid</TableHead>
								<TableHead className="pr-6 text-right">Paid %</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((point) => (
								<TableRow key={point.bucket}>
									<TableCell className="pl-6 font-medium">
										{point.label}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatOverviewWholeNumber(point.owners)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatOverviewWholeNumber(point.paidOwners)}
									</TableCell>
									<TableCell className="pr-6">
										<div className="ml-auto flex min-w-44 items-center justify-end gap-3">
											<div className="min-w-24 flex-1">
												{point.paidPct === null ? (
													<div className="h-1.5 w-full rounded-full border border-dashed bg-muted/30" />
												) : (
													<InlinePercentageBar
														value={point.paidPct}
														label={`${point.label} paid conversion`}
													/>
												)}
											</div>
											<span className="w-12 text-right font-medium tabular-nums">
												{formatNullableAnalyticsMetric(
													point.paidPct,
													formatOverviewPercentValue,
												)}
											</span>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
						<span className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<CoinsIcon aria-hidden="true" className="size-5" />
						</span>
						<p className="mt-3 font-medium text-sm">
							No credit-conversion cohort yet
						</p>
						<p className="mt-1 max-w-sm text-muted-foreground text-xs">
							Owners will appear here once accounts and credit-ledger activity
							are available.
						</p>
					</div>
				)}
			</CardContent>

			<div className="border-t bg-muted/20 px-6 py-3 text-muted-foreground text-xs leading-relaxed">
				All-time owner cohort as of the latest snapshot. Organizations and
				personal accounts each count once.
			</div>
		</Card>
	);
}

export type { ConversionByCreditsCardProps, FreeCreditsCardProps };
export { ConversionByCreditsCard, FreeCreditsCard };
