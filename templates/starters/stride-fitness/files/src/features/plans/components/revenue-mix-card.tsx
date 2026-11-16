// The breakdown of the plans page: the monthly value of the active members, one donut slice per plan.
// PlansPage renders it with the plan summaries. The total sits in the hole of the donut.
// A gym with no active member draws one muted ring and the total 0.
import { Pie, PieChart } from "recharts";
import { PLAN_CURRENCY } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { PLAN_CHART_COLOR, type PlanSummary } from "../lib/plan-summary";

type RevenueMixCardProps = {
	/** One row per plan, in the order of the plans page. */
	summaries: PlanSummary[];
	/** The grid span of the page. */
	className?: string;
};

/** A donut and a parts list under it, one plan per line. */
export function RevenueMixCard({ summaries, className }: RevenueMixCardProps) {
	const { t, locale } = useT();
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: PLAN_CURRENCY,
		maximumFractionDigits: 0,
	});
	const total = summaries.reduce((sum, row) => sum + row.monthlyValue, 0);
	const slices = summaries.map((row) => ({
		id: row.plan.id,
		label: row.plan.name,
		value: Math.round(row.monthlyValue),
		fill: PLAN_CHART_COLOR[row.plan.id].fill,
	}));
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [
			slice.id,
			{ label: slice.label, color: slice.fill },
		]),
	) satisfies ChartConfig;
	const isEmpty = total === 0;
	const label = `${t("plans.revenueTitle")}: ${slices
		.map((slice) => `${slice.label} ${money.format(slice.value)}`)
		.join(", ")}`;

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("plans.revenueTitle")}</CardTitle>
				<CardDescription>{t("plans.revenueDescription")}</CardDescription>
			</CardHeader>
			{/* The card takes the height of the payments card beside it. The legend sits at its bottom edge. */}
			<CardContent className="flex flex-1 flex-col gap-5">
				<div className="relative mx-auto aspect-square h-52">
					<ChartContainer
						config={chartConfig}
						className="aspect-square h-52"
						role="img"
						aria-label={label}
					>
						<PieChart>
							{isEmpty ? null : (
								<ChartTooltip
									cursor={false}
									content={
										<ChartTooltipContent
											hideLabel
											valueFormat={{
												style: "currency",
												currency: PLAN_CURRENCY,
												maximumFractionDigits: 0,
											}}
										/>
									}
								/>
							)}
							{/* Recharts draws no sector for a sum of 0, so an empty gym gets one muted ring. */}
							<Pie
								data={
									isEmpty
										? [{ id: "empty", value: 1, fill: "var(--muted)" }]
										: slices
								}
								dataKey="value"
								nameKey="id"
								innerRadius="62%"
								outerRadius="100%"
								stroke="var(--card)"
								strokeWidth={2}
								isAnimationActive={false}
							/>
						</PieChart>
					</ChartContainer>
					<div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
						<span className="font-numeric text-2xl tabular-nums">
							{money.format(total)}
						</span>
						<span className="text-muted-foreground text-xs">
							{t("plans.perMonthTotal")}
						</span>
					</div>
				</div>
				<ul className="mt-auto grid gap-2 text-sm">
					{slices.map((slice) => (
						<li key={slice.id} className="flex min-w-0 items-center gap-2">
							<span
								aria-hidden="true"
								className={cn(
									"size-2.5 shrink-0 rounded-badge",
									PLAN_CHART_COLOR[slice.id].mark,
								)}
							/>
							<span className="truncate text-muted-foreground">
								{slice.label}
							</span>
							<span className="ms-auto font-numeric tabular-nums">
								{money.format(slice.value)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
