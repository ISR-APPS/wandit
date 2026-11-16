// The home behind login: the revenue hero, the facts row, and the orders to ship.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The page holds the period, so the hero and the facts row show the same days.
import { PackageIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { ordersQueryOptions, shipByOf } from "~/features/orders";
import { fillMessage, type PeriodDays, startOfLocalDay } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { OverviewFacts, OverviewFactsSkeleton } from "./overview-facts";
import { RevenueHero } from "./revenue-hero";
import { ToShipCard } from "./to-ship-card";

/** The period of the first load, in days. The home route prefetches the queries of this period. */
export const DEFAULT_DAYS: PeriodDays = 30;

/** The home. One figure leads: the revenue of the period. The list shows the work of the day. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);

	// The same filter as the "To ship" tab of the order list, so the two counts agree.
	const toShip = orders
		.filter((order) => order.status === "to_ship")
		.sort((first, second) => shipByOf(first) - shipByOf(second));
	// The figures cover full days. The last one is yesterday: one millisecond before today starts.
	const lastFullDay = new Date(startOfLocalDay(Date.now()) - 1);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.description"), {
					date: dayFormat.format(lastFullDay),
				})}
				actions={
					toShip.length > 0 ? (
						<Button asChild className="max-sm:min-h-11">
							<Link to="/app/orders" search={{ status: "to_ship" }}>
								<PackageIcon />
								{fillMessage(
									t(
										toShip.length === 1
											? "overview.shipOne"
											: "overview.shipMany",
									),
									{ count: number.format(toShip.length) },
								)}
							</Link>
						</Button>
					) : null
				}
			/>
			<RevenueHero days={days} onDaysChange={setDays} />
			<OverviewFacts days={days} />
			<ToShipCard orders={toShip} />
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** Placeholder while the home loader runs: the hero at its full height, the facts row, and 5 list rows. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="@4xl/main:h-72 h-96" />
			<OverviewFactsSkeleton />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-5 w-40" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("overview.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
