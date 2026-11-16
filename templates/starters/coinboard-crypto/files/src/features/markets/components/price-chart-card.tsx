// The price card of the asset page: the current price, its change over the period, an area chart, and the period range.
// AssetDetailPage renders it. The card holds the period and reads the price series of that period itself,
// because the period changes after a click.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	ChangeLine,
	CURRENCY,
	changeRatio,
	DEFAULT_DAYS,
	fillMessage,
	formatPrice,
	niceTicks,
	PERIOD_DAYS,
	type PeriodDays,
	parsePeriodDays,
	priceDecimals,
} from "~/features/ledger";
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
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type AssetDetail,
	assetPricesQueryOptions,
} from "../api/assets.queries";

type PriceChartCardProps = {
	/** The asset of the page. The card reads its id, its ticker, and its current price. */
	asset: AssetDetail;
};

/** While a new period loads, the card keeps the line of the last period, so the plot does not jump. */
export function PriceChartCard({ asset }: PriceChartCardProps) {
	const { t, locale, dir } = useT();
	const fillId = useId();
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const series = useQuery({
		...assetPricesQueryOptions(asset.id, days),
		placeholderData: keepPreviousData,
	});

	const decimals = priceDecimals(asset.price);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const timeFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
	const shortDays = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
	});
	const config = {
		price: { label: t("asset.priceTitle"), color: "var(--chart-1)" },
	} satisfies ChartConfig;

	const points = series.data ?? [];
	const prices = points.map((point) => point.price);
	const firstPrice = prices[0];
	const lastPoint = points.at(-1);
	const low = Math.min(...prices);
	const high = Math.max(...prices);
	const average =
		prices.reduce((sum, price) => sum + price, 0) / Math.max(1, prices.length);
	// The axis covers 1 % of the price or more, centered on the prices. So a stablecoin draws a calm line in the middle.
	const middle = (high + low) / 2;
	const halfRange = Math.max((high - low) / 2, asset.price * 0.005);
	const axis = niceTicks(middle - halfRange, middle + halfRange);
	// The ticks sit evenly on both sides of the round value nearest the middle, so the line never hugs one edge.
	const axisCenter = Math.round(middle / axis.step) * axis.step;
	const ticksPerSide = Math.max(
		1,
		Math.ceil(Math.max(high - axisCenter, axisCenter - low) / axis.step),
	);
	const axisTicks = Array.from({ length: ticksPerSide * 2 + 1 }, (_, index) =>
		// 12 digits remove the float rest of the product.
		Number((axisCenter + (index - ticksPerSide) * axis.step).toPrecision(12)),
	);
	// A step of 1 or more needs no decimals. A smaller step needs the decimals that write it exactly, and 2 or more:
	// $2.60, $0.9975 (a step of 0.0025 needs 4).
	let axisDecimals = axis.step >= 1 ? 0 : 2;
	while (
		axisDecimals > 0 &&
		axisDecimals < 6 &&
		Math.abs(
			Math.round(axis.step * 10 ** axisDecimals) -
				axis.step * 10 ** axisDecimals,
		) > 1e-6
	) {
		axisDecimals += 1;
	}
	// The axis has no room for the full digits of a costly asset: $42K, but $0.0195.
	const axisFormat = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		...(asset.price >= 1000
			? { notation: "compact", maximumSignificantDigits: 3 }
			: {
					minimumFractionDigits: axisDecimals,
					maximumFractionDigits: axisDecimals,
				}),
	});
	const isRtl = dir === "rtl";

	return (
		<Card>
			<CardHeader>
				<CardDescription>{t("asset.priceTitle")}</CardDescription>
				<CardTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span className="font-numeric text-3xl tabular-nums">
						{formatPrice(asset.price, locale)}
					</span>
					{firstPrice === undefined ? null : (
						<ChangeLine
							change={changeRatio(asset.price, firstPrice)}
							comparison={t("asset.priceComparison")}
						/>
					)}
				</CardTitle>
				<CardAction>
					<Tabs
						value={String(days)}
						onValueChange={(value) => setDays(parsePeriodDays(value))}
					>
						<TabsList
							aria-label={t("chart.period")}
							// A touch target of 44 px on a phone.
							className="max-sm:group-data-[orientation=horizontal]/tabs:h-11"
						>
							{PERIOD_DAYS.map((period) => (
								<TabsTrigger
									key={period}
									value={String(period)}
									className="px-3"
								>
									{shortDays.format(period)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{series.isError ? (
					<div className="grid h-72 content-center justify-items-center gap-3 text-center">
						<p className="text-sm" role="alert">
							{t("chart.loadError")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => series.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : series.data === undefined ? (
					<Skeleton className="h-72 w-full" />
				) : (
					<ChartContainer
						config={config}
						className={cn(
							"aspect-auto h-72 w-full",
							// The line of the last period stays while the new period loads, a little faded.
							series.isPlaceholderData && "opacity-60",
						)}
						role="img"
						aria-label={
							lastPoint
								? fillMessage(t("asset.priceSummary"), {
										symbol: asset.symbol,
										day: dayFormat.format(lastPoint.time),
										price: formatPrice(lastPoint.price, locale),
									})
								: t("asset.priceTitle")
						}
					>
						<AreaChart
							data={points}
							// The margin on the axis side keeps the ticks off the edge of the plot.
							margin={{
								top: 8,
								bottom: 0,
								left: isRtl ? 8 : 4,
								right: isRtl ? 4 : 8,
							}}
						>
							<defs>
								<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--color-price)"
										stopOpacity={0.4}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-price)"
										stopOpacity={0.02}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="time"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={48}
								reversed={isRtl}
								tickFormatter={(time: number) => dayFormat.format(time)}
							/>
							{/* A price line shows its moves, not its size: the scale fits the prices of the period. */}
							<YAxis
								width="auto"
								domain={[axisTicks[0] ?? 0, axisTicks.at(-1) ?? 0]}
								ticks={axisTicks}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								orientation={isRtl ? "right" : "left"}
								tick={{ textAnchor: "end" }}
								tickFormatter={(value: number) => axisFormat.format(value)}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										indicator="line"
										labelFormatter={(time) => timeFormat.format(Number(time))}
										valueFormat={{
											style: "currency",
											currency: CURRENCY,
											minimumFractionDigits: decimals,
											maximumFractionDigits: decimals,
										}}
									/>
								}
							/>
							<Area
								dataKey="price"
								type="monotone"
								stroke="var(--color-price)"
								fill={`url(#${fillId})`}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ChartContainer>
				)}
				{prices.length === 0 ? null : (
					<dl className="grid grid-cols-3 gap-4 border-t pt-4 text-sm">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("asset.periodLow")}</dt>
							<dd className="font-medium tabular-nums">
								{formatPrice(low, locale)}
							</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">
								{t("asset.periodAverage")}
							</dt>
							<dd className="font-medium tabular-nums">
								{formatPrice(average, locale)}
							</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">{t("asset.periodHigh")}</dt>
							<dd className="font-medium tabular-nums">
								{formatPrice(high, locale)}
							</dd>
						</div>
					</dl>
				)}
			</CardContent>
		</Card>
	);
}
