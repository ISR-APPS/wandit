// The bookings card of the home: the title, a box of two year totals that switch the series, and the daily bars.
// OverviewPage renders it in the first band, beside the 4 stat cards, with the points of the chosen period.
// BookingsBars loads with React.lazy. The year choice is state of this card; it changes no query.
import { lazy, Suspense, useState } from "react";
import { BAR_RADIUS_PX, moneyFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { useAppTheme } from "~/styles/theme";
import type { YearPoint } from "../api/overview.queries";
import type { BookingsYear } from "./bookings-bars";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const BookingsBars = lazy(() =>
	import("./bookings-bars").then((module) => ({
		default: module.BookingsBars,
	})),
);

const YEARS: BookingsYear[] = ["thisYear", "lastYear"];

type BookingsChartCardProps = {
	/** The closed days of the period, oldest first. */
	points: YearPoint[];
	/** The translated period line under the title, for example "Last 30 days". */
	periodLabel: string;
};

/** The totals box sits in the top end corner of the card when the header is wide enough. */
export function BookingsChartCard({
	points,
	periodLabel,
}: BookingsChartCardProps) {
	const { t, locale } = useT();
	const [year, setYear] = useState<BookingsYear>("thisYear");
	const barRadius = BAR_RADIUS_PX[useAppTheme().selection.radius];
	const compactMoney = moneyFormat(locale, { compact: true });
	const totals = {
		thisYear: points.reduce((sum, point) => sum + point.thisYear, 0),
		lastYear: points.reduce((sum, point) => sum + point.lastYear, 0),
	} satisfies Record<BookingsYear, number>;

	return (
		<Card className="relative h-full overflow-hidden">
			<CardHeader>
				<CardTitle>{t("overview.chart.title")}</CardTitle>
				{/* On a narrow header the action moves to row 3, so the description must stay in column 1. */}
				<CardDescription className="col-start-1">{periodLabel}</CardDescription>
				<CardAction className="@md/card-header:col-start-2 col-start-1 @md/card-header:row-start-1 row-start-3 justify-self-start @md/card-header:justify-self-end">
					{/* The card is relative, so on a wide header the box sits flush in the top end corner. */}
					<fieldset className="@md/card-header:absolute @md/card-header:end-0 @md/card-header:top-0 flex divide-x @max-md/card-header:rounded-md @md/card-header:rounded-es-md @max-md/card-header:border border-s border-b rtl:divide-x-reverse">
						<legend className="sr-only">{t("overview.chart.yearLabel")}</legend>
						{YEARS.map((option) => (
							<button
								key={option}
								type="button"
								aria-pressed={year === option}
								onClick={() => setYear(option)}
								className={cn(
									"grid min-w-28 gap-1 px-6 py-4 text-start outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
									year === option && "bg-muted",
								)}
							>
								<span className="text-muted-foreground text-xs">
									{t(`overview.chart.${option}`)}
								</span>
								<span className="font-numeric font-semibold @md/card-header:text-2xl text-lg tabular-nums leading-none">
									{compactMoney.format(totals[option])}
								</span>
							</button>
						))}
					</fieldset>
				</CardAction>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-48 w-full" />}>
					<BookingsBars points={points} year={year} barRadius={barRadius} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
