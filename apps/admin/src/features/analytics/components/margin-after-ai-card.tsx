import type {
	AdminAnalyticsMarginAfterAiPlan,
	AdminAnalyticsMarginAfterAiRow,
} from "@wandit/contracts";
import { adminAnalyticsMarginAfterAiPlans } from "@wandit/contracts";

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
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatNullableAnalyticsMetric } from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewPercentValue,
	formatOverviewUsdMinor,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type MarginAfterAiCardProps = {
	marginAfterAi: AdminAnalyticsMarginAfterAiRow[];
};

type MarginAfterAiPlanMetadata = {
	label: string;
	description: string;
};

const marginAfterAiMethod =
	"Collected subscription cash minus metered AI-provider cost. Shared infrastructure bills are not allocated per plan — they live in the blended gross margin.";

const marginAfterAiColumnTooltips = {
	revenue:
		"Subscription invoice cash collected in the selected range, attributed to the plan of the paying subscription.",
	aiCost:
		"Metered AI-provider cost of the owners on this plan, from AI usage events in the selected range.",
	margin: "Revenue less AI cost. Negative when AI costs more than it collects.",
	marginPct:
		"Margin as a share of the plan's revenue. Blank when the plan collected no revenue.",
} as const;

const marginAfterAiPlanMetadata: Record<
	AdminAnalyticsMarginAfterAiPlan,
	MarginAfterAiPlanMetadata
> = {
	starter: {
		label: "Starter",
		description: "Collected Starter invoices",
	},
	pro: {
		label: "Pro",
		description: "Collected Pro invoices",
	},
	business: {
		label: "Business",
		description: "Collected Business invoices",
	},
	free: {
		label: "Free",
		description: "Owners with no live subscription",
	},
};

function orderMarginAfterAiRows(
	rows: readonly AdminAnalyticsMarginAfterAiRow[],
): AdminAnalyticsMarginAfterAiRow[] {
	const rowsByPlan = new Map(rows.map((row) => [row.plan, row]));

	return adminAnalyticsMarginAfterAiPlans.map(
		(plan) =>
			rowsByPlan.get(plan) ?? {
				plan,
				revenueCents: 0,
				aiCostCents: 0,
				marginCents: 0,
				marginPct: null,
			},
	);
}

function MarginAfterAiCard({ marginAfterAi }: MarginAfterAiCardProps) {
	const rows = orderMarginAfterAiRows(marginAfterAi);
	const totalRevenueCents = rows.reduce(
		(total, row) => total + row.revenueCents,
		0,
	);
	const totalAiCostCents = rows.reduce(
		(total, row) => total + row.aiCostCents,
		0,
	);
	const totalMarginCents = totalRevenueCents - totalAiCostCents;
	const totalMarginPct =
		totalRevenueCents > 0 ? (totalMarginCents / totalRevenueCents) * 100 : null;

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6 pb-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2>Margin after AI</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							{marginAfterAiMethod}
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						USD
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<Table className="min-w-[680px]">
					<TableCaption className="sr-only">
						Collected subscription cash, metered AI-provider cost, and the
						margin between them for each plan in the selected range.
					</TableCaption>
					<TableHeader className="bg-muted/20">
						<TableRow className="hover:bg-transparent">
							<TableHead className="min-w-52 pl-6">Plan</TableHead>
							<TableHead className="min-w-28">
								<div className="flex items-center justify-end gap-1">
									Revenue
									<MetricInfoTooltip
										label="Revenue"
										content={marginAfterAiColumnTooltips.revenue}
									/>
								</div>
							</TableHead>
							<TableHead className="min-w-28">
								<div className="flex items-center justify-end gap-1">
									AI cost
									<MetricInfoTooltip
										label="AI cost"
										content={marginAfterAiColumnTooltips.aiCost}
									/>
								</div>
							</TableHead>
							<TableHead className="min-w-28">
								<div className="flex items-center justify-end gap-1">
									Margin
									<MetricInfoTooltip
										label="Margin"
										content={marginAfterAiColumnTooltips.margin}
									/>
								</div>
							</TableHead>
							<TableHead className="min-w-28 pr-6">
								<div className="flex items-center justify-end gap-1">
									Margin %
									<MetricInfoTooltip
										label="Margin %"
										content={marginAfterAiColumnTooltips.marginPct}
									/>
								</div>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => {
							const metadata = marginAfterAiPlanMetadata[row.plan];

							return (
								<TableRow key={row.plan}>
									<TableCell className="pl-6">
										<span className="block font-medium">{metadata.label}</span>
										<span className="block text-muted-foreground text-xs">
											{metadata.description}
										</span>
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatOverviewUsdMinor(row.revenueCents)}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatOverviewUsdMinor(row.aiCostCents)}
									</TableCell>
									<TableCell
										className={cn(
											"text-right font-medium tabular-nums",
											row.marginCents < 0 && "text-destructive",
										)}
									>
										{formatOverviewUsdMinor(row.marginCents)}
									</TableCell>
									<TableCell
										className={cn(
											"pr-6 text-right tabular-nums",
											row.marginPct !== null &&
												row.marginPct < 0 &&
												"text-destructive",
										)}
									>
										{formatNullableAnalyticsMetric(
											row.marginPct,
											formatOverviewPercentValue,
										)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
					<TableFooter>
						<TableRow className="hover:bg-transparent">
							<TableCell className="pl-6">All plans</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatOverviewUsdMinor(totalRevenueCents)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatOverviewUsdMinor(totalAiCostCents)}
							</TableCell>
							<TableCell
								className={cn(
									"text-right tabular-nums",
									totalMarginCents < 0 && "text-destructive",
								)}
							>
								{formatOverviewUsdMinor(totalMarginCents)}
							</TableCell>
							<TableCell
								className={cn(
									"pr-6 text-right tabular-nums",
									totalMarginPct !== null &&
										totalMarginPct < 0 &&
										"text-destructive",
								)}
							>
								{formatNullableAnalyticsMetric(
									totalMarginPct,
									formatOverviewPercentValue,
								)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</CardContent>

			<div className="border-t bg-muted/20 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				Owners are attributed to their current plan, so an owner who upgraded
				inside the range carries all of their AI cost on the new plan.
			</div>
		</Card>
	);
}

export type { MarginAfterAiCardProps };
export {
	MarginAfterAiCard,
	marginAfterAiColumnTooltips,
	marginAfterAiMethod,
	marginAfterAiPlanMetadata,
	orderMarginAfterAiRows,
};
