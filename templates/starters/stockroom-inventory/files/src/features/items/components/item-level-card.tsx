// The stock of one item at the end of each day, with its minimum as a dashed line.
// The item page renders it in its Movements tab. The points come from itemQueryOptions (the `levels` field).
// The steps show each delivery as a jump up and the picks as the slope down to the next delivery.
import { useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import type { StockUnit } from "~/features/stock";
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
import type { ItemLevelPoint } from "../api/items.queries";

type ItemLevelCardProps = {
	/** End-of-day stock of the last 90 full days, oldest first. */
	levels: ItemLevelPoint[];
	/** The reorder point of the item, in its unit. The chart draws it as a dashed line. */
	minimum: number;
	/** The unit of the item, for the label of the series. */
	unit: StockUnit;
};

/** An area chart with steps. The label of the chart names the lowest level of the period for a screen reader. */
export function ItemLevelCard({ levels, minimum, unit }: ItemLevelCardProps) {
	const { t, locale, dir } = useT();
	const gradientId = useId();
	const number = new Intl.NumberFormat(locale);
	// Midnight UTC, shown in UTC, keeps the same calendar day in every time zone.
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	const formatDay = (day: string | number) =>
		dayFormat.format(new Date(`${day}T00:00:00Z`));
	const config = {
		onHand: {
			label: `${t("itemDetail.levelSeries")} (${t(`units.${unit}.other`)})`,
			color: "var(--chart-1)",
		},
	} satisfies ChartConfig;
	const lowest = Math.min(...levels.map((point) => point.onHand));

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{t("itemDetail.levelTitle")}</CardTitle>
				<CardDescription>{t("itemDetail.levelDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={config}
					role="img"
					aria-label={`${t("itemDetail.levelTitle")}. ${t("itemDetail.levelLowest")}: ${number.format(lowest)}. ${t("itemDetail.minimum")}: ${number.format(minimum)}`}
					className="aspect-auto h-64 w-full"
				>
					<AreaChart
						data={levels}
						margin={
							dir === "rtl"
								? { top: 4, left: 4, right: 8 }
								: { top: 4, left: 0, right: 4 }
						}
					>
						<defs>
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-onHand)"
									stopOpacity={0.5}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-onHand)"
									stopOpacity={0.05}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="day"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							reversed={dir === "rtl"}
							tickFormatter={formatDay}
						/>
						<YAxis
							width="auto"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							// Units are whole: a slow item must not show a tick of 0.5.
							allowDecimals={false}
							orientation={dir === "rtl" ? "right" : "left"}
							tick={{ textAnchor: "end" }}
							tickFormatter={(value: number) => number.format(value)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent labelFormatter={formatDay} />}
						/>
						<ReferenceLine
							y={minimum}
							stroke="var(--muted-foreground)"
							strokeDasharray="4 4"
							ifOverflow="extendDomain"
						/>
						<Area
							dataKey="onHand"
							type="stepAfter"
							stroke="var(--color-onHand)"
							fill={`url(#${gradientId})`}
							isAnimationActive={false}
						/>
					</AreaChart>
				</ChartContainer>
				<p className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
					{/* The key of the dashed line: a short dashed rule in the same color. */}
					<span
						aria-hidden="true"
						className="w-4 border-muted-foreground border-t border-dashed"
					/>
					{`${t("itemDetail.minimum")} · ${number.format(minimum)}`}
				</p>
			</CardContent>
		</Card>
	);
}
