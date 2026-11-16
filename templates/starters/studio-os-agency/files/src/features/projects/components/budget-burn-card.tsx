// The burn chart of one project: euros spent so far against the plan that spreads the budget over the calendar.
// The project detail page renders it in its main column. A retainer shows its last 90 days against three fees.
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import { parseDay, STUDIO_CURRENCY, useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
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
import type { BurnPoint } from "../lib/project-detail";

// Tick steps of the money axis, as multiples of a power of ten. 7.5 keeps €30K, not €40K, above €29.9K.
const TICK_STEPS = [1, 2, 2.5, 5, 7.5, 10];
// The axis has four steps above zero, so the budget rule sits in the top half of the plot.
const TICK_COUNT = 4;

/** Five round ticks from 0 that reach at least `top`, for example 0, 25K, 50K, 75K, 100K for 92.4K. */
function moneyTicks(top: number): number[] {
	const rawStep = Math.max(1, top / TICK_COUNT);
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const step =
		(TICK_STEPS.find((multiple) => multiple * magnitude >= rawStep) ?? 10) *
		magnitude;
	return Array.from({ length: TICK_COUNT + 1 }, (_, index) => index * step);
}

type BudgetBurnCardProps = {
	/** One point per day, oldest first. */
	points: BurnPoint[];
	/** The euros the chart compares with: the fee, or three monthly fees of a retainer. */
	budget: number;
	/** True for a retainer: the text names the 90-day window. */
	isRetainer: boolean;
};

/** The spend is an area in the accent color under an ink line. The plan is a dashed line; the budget a rule. */
export function BudgetBurnCard({
	points,
	budget,
	isRetainer,
}: BudgetBurnCardProps) {
	const { t, locale, dir } = useT();
	const format = useFormatters();
	const compact = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: STUDIO_CURRENCY,
		notation: "compact",
		// One decimal keeps quarter ticks exact: "€22.5K", not a rounded "€23K".
		maximumFractionDigits: 1,
	});
	// 5 % headroom above the highest value, so the budget rule never touches the top edge.
	const ticks = moneyTicks(
		Math.max(
			budget,
			...points.map((point) => Math.max(point.spent, point.planned)),
		) * 1.05,
	);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const config = {
		spent: { label: t("projectDetail.spent"), color: "var(--chart-1)" },
		planned: {
			label: t("projectDetail.planned"),
			color: "var(--muted-foreground)",
		},
	} satisfies ChartConfig;
	const last = points.at(-1);
	const isRtl = dir === "rtl";
	const summary = last
		? `${t("projectDetail.burnTitle")}. ${format.money(last.spent)} / ${format.money(budget)}`
		: t("projectDetail.burnTitle");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("projectDetail.burnTitle")}</CardTitle>
				<CardDescription>
					{isRetainer
						? t("projectDetail.burnRetainer")
						: t("projectDetail.burnFixed")}
				</CardDescription>
				<ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-muted-foreground text-xs">
					<li className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-sm border border-chart-1 bg-chart-2" />
						{t("projectDetail.spent")}
					</li>
					<li className="flex items-center gap-1.5">
						<span className="w-4 border-muted-foreground border-t border-dashed" />
						{t("projectDetail.planned")}
					</li>
					<li className="flex items-center gap-1.5">
						<span className="h-0.5 w-4 rounded-full bg-destructive" />
						{t("projectDetail.budgetLine")}
					</li>
				</ul>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={config}
					className="aspect-auto h-64 w-full"
					role="img"
					aria-label={summary}
				>
					<ComposedChart
						data={points}
						margin={{
							top: 12,
							bottom: 0,
							left: isRtl ? 8 : 0,
							right: isRtl ? 0 : 8,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="day"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							reversed={isRtl}
							tickFormatter={(day: string) => dayFormat.format(parseDay(day))}
						/>
						<YAxis
							width="auto"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							orientation={isRtl ? "right" : "left"}
							tick={{ textAnchor: "end" }}
							domain={[0, ticks[ticks.length - 1] ?? budget]}
							ticks={ticks}
							tickFormatter={(value: number) => compact.format(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									indicator="line"
									valueFormat={{
										style: "currency",
										currency: STUDIO_CURRENCY,
										maximumFractionDigits: 0,
									}}
									labelFormatter={(day) =>
										dayFormat.format(parseDay(String(day)))
									}
								/>
							}
						/>
						<ReferenceLine
							y={budget}
							stroke="var(--destructive)"
							ifOverflow="extendDomain"
						/>
						<Area
							dataKey="spent"
							type="monotone"
							stroke="var(--color-spent)"
							fill="var(--chart-2)"
							isAnimationActive={false}
						/>
						<Line
							dataKey="planned"
							type="linear"
							stroke="var(--color-planned)"
							strokeDasharray="4 4"
							dot={false}
							isAnimationActive={false}
						/>
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
