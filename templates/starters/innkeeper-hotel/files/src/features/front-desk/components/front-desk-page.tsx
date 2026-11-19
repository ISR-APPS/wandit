// The home behind login: the front desk of the hotel. The /app route renders it after its loader.
// It follows the hotel page of the kit, band by band: the header with two actions, four tinted KPI tiles,
// the reservations donut beside the occupancy chart (1/3 + 2/3), a row of three cards
// (recent activity, revenue, bookings by channel), and the table of the arrivals and departures.
// The route also uses the skeleton and the error state below.
import { CalendarDotsIcon, ClipboardTextIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { downloadCsv, fillMessage, toCsv } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { frontDeskQueryOptions } from "../api/front-desk.queries";
import { ChannelCard } from "./channel-card";
import { DeskActivityCard } from "./desk-activity-card";
import { KpiTiles } from "./kpi-tiles";
import { MovementsCard, movementCsvColumns } from "./movements-card";
import { OccupancyCard } from "./occupancy-card";
import { ReservationsCard } from "./reservations-card";
import { RevenueCard } from "./revenue-card";

/** The summary query refetches every minute, so the tiles and the table follow the arrivals of the day. */
export function FrontDeskPage() {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(frontDeskQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("frontDesk.title")}
				description={fillMessage(t("frontDesk.description"), {
					date: today.format(new Date(data.now)),
					rooms: number.format(data.kpis.inHouse.rooms),
					total: number.format(data.kpis.inHouse.sellableRooms),
				})}
				actions={
					<>
						<Button asChild aria-label={t("frontDesk.schedule")}>
							<Link to="/app/reservations">
								<CalendarDotsIcon />
								<span className="hidden lg:inline">
									{t("frontDesk.schedule")}
								</span>
							</Link>
						</Button>
						<Button
							type="button"
							variant="outline"
							aria-label={t("frontDesk.export")}
							onClick={() =>
								downloadCsv(
									"arrivals-and-departures.csv",
									toCsv(data.movements, movementCsvColumns(t, locale)),
								)
							}
						>
							<ClipboardTextIcon />
							<span className="hidden lg:inline">{t("frontDesk.export")}</span>
						</Button>
					</>
				}
			/>
			<KpiTiles kpis={data.kpis} />
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<ReservationsCard mix={data.mix} />
				<OccupancyCard className="@4xl/main:col-span-2" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<DeskActivityCard events={data.events} now={data.now} />
				<RevenueCard />
				<ChannelCard splits={data.channels} />
			</div>
			<MovementsCard rows={data.movements} />
		</div>
	);
}

// Placeholder blocks of the bands. Fixed keys, because they never reorder.
const KPI_KEYS = ["1", "2", "3", "4"];
const ROW_KEYS = ["1", "2", "3"];

/** Placeholder while the home loader runs, band by band. The route sets it as pendingComponent. */
export function FrontDeskPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-56" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{KPI_KEYS.map((key) => (
					<Skeleton key={key} className="h-44 rounded-surface" />
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="h-96 rounded-surface" />
				<Skeleton className="@4xl/main:col-span-2 h-96 rounded-surface" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				{ROW_KEYS.map((key) => (
					<Skeleton key={key} className="h-96 rounded-surface" />
				))}
			</div>
			<Skeleton className="h-96 rounded-surface" />
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function FrontDeskPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("frontDesk.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
