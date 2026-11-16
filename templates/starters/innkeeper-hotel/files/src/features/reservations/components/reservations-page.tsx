// The reservations page behind login: the page header, the view switch, and the list or the calendar.
// The /app/reservations route renders it after its loader. The route also uses the skeleton and the error below.
// The `view` search param of the URL keeps the chosen view.
import { CalendarDotsIcon, ListBulletsIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	reservationsQueryOptions,
	roomsQueryOptions,
} from "../api/reservations.queries";
import { ReservationsTable } from "./reservations-table";
import { TapeChart } from "./tape-chart";

/** The two views of the page. The URL holds `calendar`; no param means `list`. */
export type ReservationsView = "list" | "calendar";

type ReservationsPageProps = {
	/** The view in the `view` search param of the URL. */
	view: ReservationsView;
};

/** The list view is a searchable table. The calendar view draws the same rows as bars per room and day. */
export function ReservationsPage({ view }: ReservationsPageProps) {
	const { t } = useT();
	const navigate = useNavigate();
	const { data: reservations } = useSuspenseQuery(reservationsQueryOptions());
	const { data: rooms } = useSuspenseQuery(roomsQueryOptions());

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("reservations.title")}
				description={t(
					view === "list"
						? "reservations.description"
						: "reservations.calendarDescription",
				)}
				actions={
					<Tabs
						value={view}
						onValueChange={(value) =>
							navigate({
								to: "/app/reservations",
								search: value === "calendar" ? { view: "calendar" } : {},
							})
						}
					>
						<TabsList aria-label={t("reservations.view")}>
							<TabsTrigger value="list">
								<ListBulletsIcon />
								{t("reservations.listView")}
							</TabsTrigger>
							<TabsTrigger value="calendar">
								<CalendarDotsIcon />
								{t("reservations.calendarView")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				}
			/>
			<Card>
				<CardContent>
					{view === "list" ? (
						<ReservationsTable reservations={reservations} />
					) : (
						<TapeChart rooms={rooms} reservations={reservations} />
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ReservationsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-44" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
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
