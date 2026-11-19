// The breakdown card of the Activities page: the activities of the period by type or by rep.
// ActivitiesPage renders it beside the trend card, with the period of the page header.
// It follows the pipeline list of the kit system: a stacked share bar, then one row per part with a progress bar.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { BreakdownSlice, PeriodDays } from "~/features/crm";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import { activityBreakdownQueryOptions } from "../api/activities.queries";

/** The two views of the card. */
const BREAKDOWN_VIEWS = ["byType", "byRep"] as const;
type BreakdownView = (typeof BREAKDOWN_VIEWS)[number];

/** One fill per row, in order. Five series at most: there are 4 types and 5 reps. */
const SLICE_FILLS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
] as const;

type ActivityBreakdownCardProps = {
	/** The period of the page header, in days. */
	days: PeriodDays;
};

/** Each part shows its count and its share of the period. The color is never the only mark: each row names its part. */
export function ActivityBreakdownCard({ days }: ActivityBreakdownCardProps) {
	const { t, locale } = useT();
	const breakdown = useQuery({
		...activityBreakdownQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const [view, setView] = useState<BreakdownView>("byType");
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });

	const slices: BreakdownSlice[] = breakdown.data
		? view === "byType"
			? breakdown.data.byType.map((slice) => ({
					label: t(`activityTypes.${slice.label}`),
					value: slice.value,
				}))
			: breakdown.data.byRep
		: [];
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const shareOf = (value: number) => (total === 0 ? 0 : value / total);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("activities.breakdownTitle")}</CardTitle>
				<CardDescription>
					{breakdown.data
						? `${number.format(total)} ${t("activities.trendUnit")}`
						: t("activities.breakdownDescription")}
				</CardDescription>
				<CardAction>
					<Tabs
						value={view}
						onValueChange={(value) =>
							setView(
								BREAKDOWN_VIEWS.find((option) => option === value) ?? "byType",
							)
						}
					>
						<TabsList>
							{BREAKDOWN_VIEWS.map((option) => (
								<TabsTrigger key={option} value={option}>
									{t(`activities.${option}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			{/* flex-1 and content-around: the card is as tall as the trend card, so the rows spread over that height. */}
			<CardContent className="flex flex-1 flex-col gap-6">
				{breakdown.isError ? (
					<div className="grid justify-items-start gap-3">
						<p className="text-sm" role="alert">
							{t("activities.breakdownError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => breakdown.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : breakdown.data === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : total === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				) : (
					<>
						<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
							{slices.map((slice, index) => (
								<Tooltip key={slice.label}>
									<TooltipTrigger asChild>
										<span
											className={cn(
												"h-full",
												SLICE_FILLS[index % SLICE_FILLS.length],
											)}
											style={{ width: `${shareOf(slice.value) * 100}%` }}
										/>
									</TooltipTrigger>
									<TooltipContent>
										{`${slice.label}: ${number.format(slice.value)}`}
									</TooltipContent>
								</Tooltip>
							))}
						</div>
						<ul className="grid flex-1 content-around gap-4">
							{slices.map((slice, index) => (
								<li key={slice.label} className="flex items-center gap-4">
									<span
										aria-hidden="true"
										className={cn(
											"size-3 shrink-0 rounded-full",
											SLICE_FILLS[index % SLICE_FILLS.length],
										)}
									/>
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="truncate font-medium text-sm">
											{slice.label}
										</span>
										<span className="text-muted-foreground text-xs tabular-nums">
											{number.format(slice.value)}
										</span>
									</span>
									<Progress
										value={shareOf(slice.value) * 100}
										className="h-1.5 w-16"
										aria-label={slice.label}
									/>
									<span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
										{percent.format(shareOf(slice.value))}
									</span>
								</li>
							))}
						</ul>
					</>
				)}
			</CardContent>
		</Card>
	);
}
