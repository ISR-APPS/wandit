// The bookings of one rep per week of the current quarter, as bars, with the weekly target as a dashed line.
// RepDetailPage renders it in the main column. A week after today shows a faint bar at its target: the amount still to sell.
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import {
	BAR_RADIUS_PX,
	fillMessage,
	MONEY_OPTIONS,
	moneyFormat,
	niceCeiling,
} from "~/features/sales";
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
import { useAppTheme } from "~/styles/theme";
import type { RepWeek } from "../api/reps.queries";

type RepWeeklyCardProps = {
	/** The weeks of the quarter, oldest first. */
	weeks: RepWeek[];
};

/** A side-height chart (h-56). The line is the target of a full week. */
export function RepWeeklyCard({ weeks }: RepWeeklyCardProps) {
	const { t, locale, dir } = useT();
	const isRtl = dir === "rtl";
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const money = moneyFormat(locale);
	const compactMoney = moneyFormat(locale, { compact: true });
	const dayLabel = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	// The first week is full; the last one can be short. The line uses a full week.
	const weeklyTarget = Math.max(0, ...weeks.map((week) => week.target));
	const config = {
		booked: { label: t("chart.booked"), color: "var(--chart-1)" },
		toSell: { label: t("reps.weekToSell"), color: "var(--muted-foreground)" },
	} satisfies ChartConfig;
	// A future week has no booked amount. Its target bar shows that the empty half of the quarter is still to sell.
	const data = weeks.map((week) => ({
		...week,
		toSell: week.booked === null ? week.target : null,
	}));
	// Every third week gets a label: the steps stay even, and 5 labels fit on a 390 px phone.
	const ticks = weeks
		.filter((_, index) => index % 3 === 0)
		.map((week) => week.weekStart);
	const lastClosed = [...weeks].reverse().find((week) => week.booked !== null);
	const ariaLabel = lastClosed
		? `${t("reps.weeklyTitle")}: ${fillMessage(t("reps.weekOf"), {
				date: dayLabel.format(new Date(`${lastClosed.weekStart}T00:00:00Z`)),
			})}, ${money.format(lastClosed.booked ?? 0)}`
		: t("reps.weeklyTitle");
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.weeklyTitle")}</CardTitle>
				<CardDescription>{t("reps.weeklyDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-2">
				{weeklyTarget > 0 ? (
					// The legend of the dashed line. A label on the line itself sits on the bars.
					<p className="flex items-center justify-end gap-2 text-muted-foreground text-xs">
						<span className="w-5 border-muted-foreground border-t border-dashed" />
						{t("reps.weeklyTarget")}
						<span className="font-medium text-foreground tabular-nums">
							{compactMoney.format(weeklyTarget)}
						</span>
					</p>
				) : null}
				<ChartContainer
					config={config}
					className="aspect-auto h-56 w-full"
					role="img"
					aria-label={ariaLabel}
				>
					<BarChart data={data} margin={{ top: 8, left: 4, right: 4 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="weekStart"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							ticks={ticks}
							interval={0}
							reversed={isRtl}
							tickFormatter={(value: string) =>
								dayLabel.format(new Date(`${value}T00:00:00Z`))
							}
						/>
						<YAxis
							width="auto"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							orientation={isRtl ? "right" : "left"}
							tick={{ textAnchor: "end" }}
							domain={[
								0,
								// A round top keeps round ticks. 4 % headroom keeps the tallest bar off the top line.
								(dataMax: number) =>
									niceCeiling(Math.max(dataMax, weeklyTarget) * 1.04),
							]}
							tickFormatter={(value: number) => compactMoney.format(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									valueFormat={MONEY_OPTIONS}
									labelFormatter={(value) =>
										fillMessage(t("reps.weekOf"), {
											date: dayLabel.format(new Date(`${value}T00:00:00Z`)),
										})
									}
								/>
							}
						/>
						<Bar
							dataKey="booked"
							stackId="week"
							fill="var(--color-booked)"
							radius={[barRadius, barRadius, 0, 0]}
							isAnimationActive={false}
						>
							{/* The week of today is not over, so a lighter bar marks its amount as partial. */}
							{weeks.map((week) => (
								<Cell
									key={week.weekStart}
									fillOpacity={week.isPartial ? 0.4 : 1}
								/>
							))}
						</Bar>
						<Bar
							dataKey="toSell"
							stackId="week"
							fill="var(--color-toSell)"
							fillOpacity={0.18}
							radius={[barRadius, barRadius, 0, 0]}
							isAnimationActive={false}
						/>
						{weeklyTarget > 0 ? (
							<ReferenceLine
								y={weeklyTarget}
								stroke="var(--foreground)"
								strokeOpacity={0.6}
								strokeDasharray="5 5"
							/>
						) : null}
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
