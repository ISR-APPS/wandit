// The ticket sales card of one event: the running total of tickets against the capacity, per day.
// EventDetailPage loads it with React.lazy at the top of the main column. An event not on sale yet shows an empty frame.
import { useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import { type EventSummary, fillMessage } from "~/features/organiser";
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
import type { PacePoint } from "../lib/sales-pace";

type SalesPaceCardProps = {
	event: EventSummary;
	/** The running total per day, from the first day of sale. Empty before the sale opens. */
	points: PacePoint[];
};

/** The capacity line shows how close the event is to a sell-out. */
export function SalesPaceCard({ event, points }: SalesPaceCardProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const config = {
		total: { label: t("events.ticketsSold"), color: "var(--chart-1)" },
	} satisfies ChartConfig;
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const dayLabel = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const longDate = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	// `day` is YYYY-MM-DD with no time. Midnight UTC, shown in UTC, keeps the same calendar day.
	const formatDay = (day: string) =>
		dayLabel.format(new Date(`${day}T00:00:00Z`));
	const isRtl = dir === "rtl";
	const isCancelled = event.status === "cancelled";
	const last = points.at(-1);
	// Quarter ticks up to the capacity: the capacity is the top tick, so no tick crowds the dashed line.
	const capacityTicks = [0, 0.25, 0.5, 0.75, 1].map((share) =>
		Math.round(event.capacity * share),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("events.salesTitle")}</CardTitle>
				<CardDescription>
					{isCancelled ? t("events.salesHintCancelled") : t("events.salesHint")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{points.length === 0 ? (
					<div className="grid h-56 place-items-center rounded-control border border-dashed px-6 text-center">
						<p className="max-w-sm text-muted-foreground text-sm">
							{fillMessage(t("events.notOnSaleYet"), {
								date: longDate.format(event.onSaleAt),
							})}
						</p>
					</div>
				) : (
					<ChartContainer
						config={config}
						className="aspect-auto h-56 w-full"
						role="img"
						aria-label={
							last
								? fillMessage(t("events.paceChartLabel"), {
										day: formatDay(last.day),
										total: number.format(last.total),
										capacity: number.format(event.capacity),
									})
								: t("events.salesTitle")
						}
					>
						<AreaChart
							data={points}
							margin={{ top: 12, left: isRtl ? 8 : 0, right: isRtl ? 0 : 8 }}
						>
							<defs>
								<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--color-total)"
										stopOpacity={0.3}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-total)"
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							{/* Time runs from right to left in Arabic, so the values move to the right side. */}
							<XAxis
								dataKey="day"
								reversed={isRtl}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={24}
								tickFormatter={formatDay}
							/>
							{/* SVG anchors follow the page direction. "end" puts the text end at the plot side. */}
							<YAxis
								orientation={isRtl ? "right" : "left"}
								tick={{ textAnchor: "end" }}
								width="auto"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								domain={[0, event.capacity]}
								ticks={capacityTicks}
								tickFormatter={(value: number) => compact.format(value)}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) => formatDay(String(label))}
									/>
								}
							/>
							<ReferenceLine
								y={event.capacity}
								stroke="var(--muted-foreground)"
								strokeDasharray="4 4"
								ifOverflow="extendDomain"
							/>
							<Area
								dataKey="total"
								type="monotone"
								stroke="var(--color-total)"
								fill={`url(#${fillId})`}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
