// The weekday card of the home: the paid orders or tickets of the period per day of the week, against the period before.
// OverviewPage renders it in the third row. The tabs switch the series of the figure and of the bars.
// It follows the kit "revenue stat" card: a tab control, one large figure with its change, then bars per weekday.
import { lazy, Suspense, useState } from "react";
import { ChangeLine, fillMessage } from "~/features/organiser";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { weekdayOrder } from "../lib/month-grid";
import type { WeekdaySales } from "../lib/overview-math";
import { changeRatio } from "../lib/series";

// The chart library loads with the card, not with the first script of the app.
const WeekdayBars = lazy(() =>
	import("./weekday-bars").then((module) => ({ default: module.WeekdayBars })),
);

/** The two series of the tabs. */
type Series = "orders" | "tickets";

function isSeries(value: string): value is Series {
	return value === "orders" || value === "tickets";
}

// 7 January 2024 is a Sunday. Day `weekday` after it, read in UTC, has the weekday `weekday` (0 is Sunday).
function weekdayDate(weekday: number): Date {
	return new Date(Date.UTC(2024, 0, 7 + weekday));
}

type WeekdaySalesCardProps = {
	/** One row per day of the week, Sunday first, from the home summary. */
	weekdays: WeekdaySales[];
};

/** The bars follow the first day of the week of the app language. */
export function WeekdaySalesCard({ weekdays }: WeekdaySalesCardProps) {
	const { t, locale } = useT();
	const [series, setSeries] = useState<Series>("orders");
	const number = new Intl.NumberFormat(locale);
	const shortDay = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const longDay = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		timeZone: "UTC",
	});
	const byWeekday = new Map(weekdays.map((row) => [row.weekday, row]));
	const bars = weekdayOrder(locale).map((weekday) => {
		const row = byWeekday.get(weekday);
		return {
			weekday,
			label: shortDay.format(weekdayDate(weekday)),
			current: (series === "orders" ? row?.orders : row?.tickets) ?? 0,
			previous:
				(series === "orders" ? row?.previousOrders : row?.previousTickets) ?? 0,
		};
	});
	const total = bars.reduce((sum, bar) => sum + bar.current, 0);
	const previousTotal = bars.reduce((sum, bar) => sum + bar.previous, 0);
	const busiest = bars.reduce(
		(best, bar) => (bar.current > best.current ? bar : best),
		bars[0] ?? { weekday: 0, label: "", current: 0, previous: 0 },
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.byWeekday")}</CardTitle>
				<CardAction>
					<Tabs
						value={series}
						onValueChange={(value) => {
							if (isSeries(value)) {
								setSeries(value);
							}
						}}
					>
						<TabsList>
							<TabsTrigger value="orders">{t("overview.orders")}</TabsTrigger>
							<TabsTrigger value="tickets">{t("overview.tickets")}</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{number.format(total)}
					</p>
					<ChangeLine
						change={changeRatio(total, previousTotal)}
						goodWhen="up"
					/>
				</div>
				<Suspense fallback={<Skeleton className="h-56 w-full" />}>
					<WeekdayBars
						bars={bars}
						label={fillMessage(t("overview.weekdayChartLabel"), {
							day: longDay.format(weekdayDate(busiest.weekday)),
							count: number.format(busiest.current),
						})}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
