// The reservations card of the home: the stays that start this week by status, as a donut with a side legend,
// and the room revenue that these stays book under it. FrontDeskPage renders it at the start of the middle row.
// The donut file loads with React.lazy.
import { lazy, Suspense } from "react";
import { dayToDate, fillMessage, moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { ReservationMix } from "../lib/home-figures";
import type { DonutSlice } from "./status-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const StatusDonut = lazy(() =>
	import("./status-donut").then((module) => ({ default: module.StatusDonut })),
);

type ReservationsCardProps = {
	/** The stays of this week per status, from the summary query. */
	mix: ReservationMix;
};

/** The legend names each slice and its count, so the color is never the only mark. */
export function ReservationsCard({ mix }: ReservationsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const shortDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const slices: DonutSlice[] = mix.slices.map((slice, index) => ({
		key: slice.key,
		label: t(`frontDesk.mix.${slice.key}`),
		value: slice.value,
		// Chart series 1 to 4 follow the order of a stay.
		color: `var(--chart-${index + 1})`,
	}));
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("frontDesk.mix.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("frontDesk.mix.description"), {
						from: shortDate.format(dayToDate(mix.fromDay)),
						to: shortDate.format(dayToDate(mix.toDay)),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="flex @6xl/main:flex-row flex-col items-center justify-center gap-6">
					<Suspense fallback={<Skeleton className="size-56 rounded-full" />}>
						<StatusDonut slices={slices} total={total} />
					</Suspense>
					<ul className="flex @6xl/main:flex-col flex-wrap justify-center gap-x-4 gap-y-3">
						{slices.map((slice) => (
							<li key={slice.key} className="flex items-center gap-2 text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: slice.color }}
								/>
								<span>{slice.label}</span>
								<span className="font-medium tabular-nums">
									{number.format(slice.value)}
								</span>
							</li>
						))}
					</ul>
				</div>
				<div className="text-center">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{money.format(mix.roomRevenue)}
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("frontDesk.mix.revenue")}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
