// The sales chart card of the home: daily bars of the chosen period and a totals box that picks the series.
// DashboardPage renders it at the start of the first band, as the kit revenue chart. The bars load with React.lazy.
// The totals box sits in the top end corner from the @xl/main width, in the card padding. Each total is a button for its series.
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import {
	fillMessage,
	formatCents,
	wholeMoneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { salesByDayQueryOptions } from "../api/dashboard.queries";
import type { PeriodDays } from "../lib/dashboard";
import type { SalesSeries } from "./sales-bars";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const SalesBars = lazy(() =>
	import("./sales-bars").then((module) => ({ default: module.SalesBars })),
);

const SERIES: SalesSeries[] = ["sales", "covers"];

type SalesChartCardProps = {
	/** The period of the page header, in days. It is in the query key. */
	days: PeriodDays;
};

/** The card fills the height of its grid cell, so it lines up with the 2 x 2 stat cards beside it. */
export function SalesChartCard({ days }: SalesChartCardProps) {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(salesByDayQueryOptions(days));
	const [series, setSeries] = useState<SalesSeries>("sales");
	const wholeMoney = wholeMoneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const totals = {
		sales: formatCents(wholeMoney, data.totalSalesCents),
		covers: number.format(data.totalCovers),
	} satisfies Record<SalesSeries, string>;
	const description = fillMessage(t("period.last"), {
		days: number.format(days),
	});

	return (
		<Card className="relative h-full overflow-hidden">
			<CardHeader>
				<CardTitle>{t("dashboard.salesByDay")}</CardTitle>
				{/* Column 1 always: below @xl the action moves to row 3, and the grid would put this line beside the title. */}
				<CardDescription className="col-start-1">{description}</CardDescription>
				<CardAction className="@xl/main:col-start-2 col-start-1 @xl/main:row-start-1 row-start-3 @xl/main:justify-self-end justify-self-stretch">
					<div className="@xl/main:absolute @xl/main:end-6 @xl/main:top-6 flex divide-x overflow-hidden rounded-md border rtl:divide-x-reverse">
						{SERIES.map((key) => (
							<button
								key={key}
								type="button"
								aria-pressed={series === key}
								onClick={() => setSeries(key)}
								className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 text-start outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-muted"
							>
								<span className="text-muted-foreground text-xs">
									{t(`dashboard.${key}`)}
								</span>
								<span className="font-numeric @xl/main:text-2xl text-lg tabular-nums leading-none">
									{totals[key]}
								</span>
							</button>
						))}
					</div>
				</CardAction>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-48 w-full" />}>
					<SalesBars
						points={data.points}
						series={series}
						label={`${t("dashboard.salesByDay")}, ${description}: ${t(`dashboard.${series}`)} ${totals[series]}`}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
