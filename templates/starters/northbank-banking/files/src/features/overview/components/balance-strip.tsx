// The slim activity strip of the home: the end-of-day balance of all accounts as a thin line with a low fill,
// over the same days one period earlier as a dashed line. OverviewPage renders it and holds the period.
// It follows the chart form "compare" at strip height: no panel, no legend, no axis, no grid, a tooltip per day.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
	BANK_CURRENCY,
	centsToUnits,
	dayFormat,
	dayToDate,
	fillMessage,
	MoneyText,
	moneyFormat,
	type PeriodDays,
	PeriodSelect,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import { Skeleton } from "~/shared/ui/skeleton";
import { dailyBalanceQueryOptions } from "../api/overview.queries";

// The plot keeps 2 % of space under the lowest balance and 1 % over the highest, so the line never touches the edge.
const LOW_MARGIN = 0.98;
const HIGH_MARGIN = 1.01;

type BalanceStripProps = {
	/** The period of the strip, in days. OverviewPage holds it. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** While a new period loads, the strip keeps the line of the last period, so it does not jump. */
export function BalanceStrip({ days, onDaysChange }: BalanceStripProps) {
	const { t, locale } = useT();
	const balance = useQuery({
		...dailyBalanceQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const day = dayFormat(locale, "long");
	const money = moneyFormat(locale, 0);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const config = {
		current: { label: t("chart.thisPeriod"), color: "var(--chart-1)" },
		previous: {
			label: t("chart.previousPeriod"),
			color: "var(--muted-foreground)",
		},
	} satisfies ChartConfig;
	const rows = (balance.data ?? []).map((point) => ({
		day: point.day,
		current: centsToUnits(point.current),
		previous: centsToUnits(point.previous),
	}));
	const title = fillMessage(t("overview.stripTitle"), {
		period: dayCount.format(days),
	});
	const last = balance.data?.at(-1);
	const first = balance.data?.[0];

	return (
		// Two rules frame the strip. It leads into the table and does not read as a chart panel.
		<section aria-label={title} className="grid gap-3 border-y py-4">
			{/* Under 40rem the title and the period share the first row, and the "From … → …" line takes the second row. */}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<span className="font-medium text-sm">{title}</span>
				{last && first ? (
					<span className="order-last w-full text-muted-foreground text-sm sm:order-none sm:w-auto">
						{`${t("overview.stripBalance")} `}
						<MoneyText amountCents={first.current} withCents={false} />
						<span aria-hidden="true"> → </span>
						<span className="sr-only">{` ${t("overview.stripTo")} `}</span>
						<MoneyText
							amountCents={last.current}
							withCents={false}
							className="font-medium text-foreground"
						/>
					</span>
				) : null}
				<div className="ms-auto">
					<PeriodSelect days={days} onDaysChange={onDaysChange} />
				</div>
			</div>
			<div>
				{balance.isError ? (
					<div className="flex h-16 items-center gap-3 text-sm">
						<p role="alert">{t("overview.stripError")}</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => balance.refetch()}
						>
							{t("common.retry")}
						</Button>
					</div>
				) : balance.data === undefined ? (
					<Skeleton className="h-16 w-full" />
				) : (
					<ChartContainer
						config={config}
						className="aspect-auto h-16 w-full"
						role="img"
						aria-label={
							last
								? `${title}. ${day.format(dayToDate(last.day))}: ${money.format(centsToUnits(last.current))}`
								: title
						}
					>
						<ComposedChart
							data={rows}
							margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
						>
							<defs>
								<linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--color-current)"
										stopOpacity={0.35}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-current)"
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
							<XAxis dataKey="day" hide />
							<YAxis
								hide
								domain={[
									(lowest: number) => lowest * LOW_MARGIN,
									(highest: number) => highest * HIGH_MARGIN,
								]}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(value) =>
											day.format(dayToDate(String(value)))
										}
										valueFormat={{
											style: "currency",
											currency: BANK_CURRENCY,
											maximumFractionDigits: 0,
										}}
									/>
								}
							/>
							<Area
								dataKey="current"
								type="monotone"
								stroke="var(--color-current)"
								fill="url(#balance-fill)"
								isAnimationActive={false}
							/>
							<Line
								dataKey="previous"
								type="monotone"
								stroke="var(--color-previous)"
								strokeDasharray="4 4"
								dot={false}
								isAnimationActive={false}
							/>
						</ComposedChart>
					</ChartContainer>
				)}
			</div>
		</section>
	);
}
