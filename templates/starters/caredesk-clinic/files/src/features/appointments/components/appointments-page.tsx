// The appointments page behind login: the board of one day, or the list of the whole book.
// The /app/appointments route renders it after its loader, with the view, the open appointment,
// and the practitioner filter of the URL. The route also uses the skeleton and the error below.
import { CalendarDotsIcon, ListBulletsIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { useNow } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { appointmentsQueryOptions } from "../api/appointments.queries";
import type { AppointmentView } from "../lib/appointment-views";
import { AppointmentSheet } from "./appointment-sheet";
import { AppointmentsTable } from "./appointments-table";
import { DayBoard } from "./day-board";

type AppointmentsPageProps = {
	/** The `view` of the URL. The board of the day is the default. */
	view: AppointmentView;
	/** The `appointment` id of the URL: the detail panel shows that appointment. */
	appointmentId: string | undefined;
	/** The `practitioner` id of the URL: the list shows only that practitioner. */
	practitionerId: string | undefined;
};

/** The URL holds the view, the open appointment, and the filter, so a link can open each state. */
export function AppointmentsPage({
	view,
	appointmentId,
	practitionerId,
}: AppointmentsPageProps) {
	const { t } = useT();
	const now = useNow();
	const navigate = useNavigate();
	const { data: rows } = useSuspenseQuery(appointmentsQueryOptions());
	const openRow = rows.find((row) => row.id === appointmentId) ?? null;

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("appointments.title")}
				description={t("appointments.description")}
				actions={
					<Tabs
						value={view}
						onValueChange={(value) =>
							navigate({
								to: "/app/appointments",
								search: (previous) => ({
									...previous,
									view: value === "list" ? "list" : undefined,
								}),
							})
						}
					>
						{/* The kit strip is 36 px high. A phone gets a 44 px touch area. */}
						<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
							<TabsTrigger value="day">
								<CalendarDotsIcon />
								{t("appointments.dayView")}
							</TabsTrigger>
							<TabsTrigger value="list">
								<ListBulletsIcon />
								{t("appointments.listView")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				}
			/>
			{view === "day" ? (
				<DayBoard rows={rows} now={now} />
			) : (
				<Card>
					<CardContent>
						<AppointmentsTable
							rows={rows}
							now={now}
							practitionerId={practitionerId}
							onPractitionerChange={(nextId) =>
								navigate({
									to: "/app/appointments",
									search: (previous) => ({ ...previous, practitioner: nextId }),
								})
							}
						/>
					</CardContent>
				</Card>
			)}
			<AppointmentSheet
				row={openRow}
				now={now}
				onClose={() =>
					navigate({
						to: "/app/appointments",
						search: (previous) => ({ ...previous, appointment: undefined }),
					})
				}
			/>
		</div>
	);
}

// Placeholder columns of the skeleton. Fixed keys, because they never reorder.
const SKELETON_COLUMNS = ["1", "2", "3", "4", "5"];

/** Placeholder while the loader runs: the header and the columns of the board. */
export function AppointmentsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-12 w-64" />
			<div className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-3">
				{SKELETON_COLUMNS.map((key) => (
					<Skeleton key={key} className="h-96" />
				))}
			</div>
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function AppointmentsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("appointments.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
