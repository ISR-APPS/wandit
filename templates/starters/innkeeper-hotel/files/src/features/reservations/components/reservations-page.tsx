// The reservations page behind login: the room schedule of one week, or the list of every reservation.
// The /app/reservations route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the bookings page of the kit: the title with a day navigator, a Schedule | List toggle,
// and the primary action at the end. The view lives in the URL (?view=list), so a link can open the list.
import {
	CaretLeftIcon,
	CaretRightIcon,
	DownloadSimpleIcon,
	ListBulletsIcon,
	SquaresFourIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	addDays,
	BOOK_FUTURE_DAYS,
	BOOK_PAST_DAYS,
	downloadCsv,
	startOfLocalDay,
	toCsv,
	toIsoDay,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	reservationsQueryOptions,
	roomsQueryOptions,
} from "../api/reservations.queries";
import { SCHEDULE_DAYS } from "../lib/room-schedule";
import { ReservationsTable, reservationCsvColumns } from "./reservations-table";
import { RoomSchedule } from "./room-schedule";

const routeApi = getRouteApi("/app/reservations/");

/** The two views of the page. "schedule" is the default and has no search param. */
export type ReservationsView = "schedule" | "list";

/** The navigator moves the schedule by one week, inside the dates of the sample book. */
export function ReservationsPage() {
	const { t, locale } = useT();
	const { data: reservations } = useSuspenseQuery(reservationsQueryOptions());
	const { data: rooms } = useSuspenseQuery(roomsQueryOptions());
	const { view } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	// Days from today to the first night of the schedule. 0 shows tonight in the first row.
	const [startOffset, setStartOffset] = useState(0);
	const activeView: ReservationsView = view ?? "schedule";
	const firstDayMs = addDays(startOfLocalDay(Date.now()), startOffset);
	const lastDayMs = addDays(firstDayMs, SCHEDULE_DAYS - 1);
	const dayLabel = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	// The book holds no stay outside these days, so the navigator stops at its ends.
	const minOffset = -BOOK_PAST_DAYS;
	const maxOffset = BOOK_FUTURE_DAYS - SCHEDULE_DAYS;

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
				<div className="flex flex-wrap items-center gap-4">
					<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking)">
						{t("reservations.title")}
					</h1>
					{activeView === "schedule" ? (
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label={t("reservations.previousWeek")}
								disabled={startOffset <= minOffset}
								onClick={() =>
									setStartOffset(
										Math.max(minOffset, startOffset - SCHEDULE_DAYS),
									)
								}
							>
								<CaretLeftIcon className="rtl:rotate-180" />
							</Button>
							<span className="min-w-40 text-center font-medium text-sm tabular-nums">
								{dayLabel.formatRange(firstDayMs, lastDayMs)}
							</span>
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label={t("reservations.nextWeek")}
								disabled={startOffset >= maxOffset}
								onClick={() =>
									setStartOffset(
										Math.min(maxOffset, startOffset + SCHEDULE_DAYS),
									)
								}
							>
								<CaretRightIcon className="rtl:rotate-180" />
							</Button>
						</div>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<Tabs
						value={activeView}
						onValueChange={(value) =>
							navigate({
								search: value === "list" ? { view: "list" } : {},
								replace: true,
							})
						}
					>
						<TabsList>
							<TabsTrigger
								value="schedule"
								aria-label={t("reservations.scheduleView")}
							>
								<SquaresFourIcon />
							</TabsTrigger>
							<TabsTrigger value="list" aria-label={t("reservations.listView")}>
								<ListBulletsIcon />
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(
								"reservations.csv",
								toCsv(
									activeView === "schedule"
										? reservations.filter(
												(row) =>
													row.checkIn <= toIsoDay(lastDayMs) &&
													row.checkOut > toIsoDay(firstDayMs),
											)
										: reservations,
									reservationCsvColumns(t, locale),
								),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				</div>
			</div>
			{activeView === "schedule" ? (
				<RoomSchedule
					reservations={reservations}
					rooms={rooms}
					firstDay={toIsoDay(firstDayMs)}
				/>
			) : (
				<Card>
					<CardContent>
						<ReservationsTable reservations={reservations} />
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ReservationsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-4">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-9 w-56" />
				</div>
				<Skeleton className="h-9 w-48" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-24 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list and of the detail page when a loader fails. Try again runs the loader again. */
export function ReservationsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("reservations.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
