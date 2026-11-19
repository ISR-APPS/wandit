// The appointments page behind login: one calendar card with a toolbar, a month or week grid, and a department legend.
// The /app/appointments route renders it after its loader, with the view, the open appointment,
// and the practitioner filter of the URL. The route also uses the skeleton and the error below.
// A chip opens the detail panel. "Export CSV" downloads the appointments of the shown month or week.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	addDays,
	addMonths,
	downloadCsv,
	monthGridDays,
	SPECIALTIES,
	SPECIALTY_TONE,
	startOfMonth,
	toCsv,
	useNow,
	weekDays,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { appointmentsQueryOptions } from "../api/appointments.queries";
import { appointmentCsvColumns } from "../lib/appointment-csv";
import { CALENDAR_VIEWS, type CalendarView } from "../lib/appointment-views";
import { AppointmentSheet } from "./appointment-sheet";
import { MonthGrid, WeekGrid } from "./calendar-grid";

// The Select value of "every practitioner". A practitioner id never has this value.
const ALL_PRACTITIONERS = "all";

type AppointmentsPageProps = {
	/** The `view` of the URL. The month is the default. */
	view: CalendarView;
	/** The `appointment` id of the URL: the detail panel shows that appointment. */
	appointmentId: string | undefined;
	/** The `practitioner` id of the URL: the calendar shows only that practitioner. */
	practitionerId: string | undefined;
};

/** The URL holds the view, the open appointment, and the filter. The shown month or week is state. */
export function AppointmentsPage({
	view,
	appointmentId,
	practitionerId,
}: AppointmentsPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const navigate = useNavigate();
	const { data: rows } = useSuspenseQuery(appointmentsQueryOptions());
	// Any time inside the shown month or week. The arrows move it by one month or one week.
	const [anchor, setAnchor] = useState(now);
	// The filter lists each practitioner of the book once, in the order of the rooms.
	const practitioners = [
		...new Map(
			rows.map((row) => [row.practitioner.id, row.practitioner]),
		).values(),
	].sort((first, second) =>
		first.room.localeCompare(second.room, locale, { numeric: true }),
	);
	const openRow = rows.find((row) => row.id === appointmentId) ?? null;
	const shownRows = practitionerId
		? rows.filter((row) => row.practitioner.id === practitionerId)
		: rows;
	const monthStart = startOfMonth(anchor);
	const days =
		view === "month"
			? monthGridDays(monthStart, locale)
			: weekDays(anchor, locale);
	const rangeStart = days[0] ?? anchor;
	const rangeEnd = addDays(days.at(-1) ?? anchor, 1);
	const rangeRows = shownRows.filter(
		(row) => row.startsAt >= rangeStart && row.startsAt < rangeEnd,
	);
	const title =
		view === "month"
			? new Intl.DateTimeFormat(locale, {
					month: "long",
					year: "numeric",
				}).format(monthStart)
			: new Intl.DateTimeFormat(locale, {
					day: "numeric",
					month: "short",
				}).formatRange(rangeStart, rangeEnd - 1);

	function setView(next: CalendarView) {
		navigate({
			to: "/app/appointments",
			search: (previous) => ({
				...previous,
				view: next === "month" ? undefined : next,
			}),
		});
	}

	function move(step: -1 | 1) {
		setAnchor((current) =>
			view === "month" ? addMonths(current, step) : addDays(current, 7 * step),
		);
	}

	function openAppointment(id: string) {
		navigate({
			to: "/app/appointments",
			search: (previous) => ({ ...previous, appointment: id }),
		});
	}

	return (
		<div className="grid gap-4">
			<Card className="gap-0 overflow-hidden py-0">
				<div className="flex flex-wrap items-center gap-2 border-b p-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => setAnchor(now)}
					>
						{t("appointments.today")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={
							view === "month"
								? t("appointments.previousMonth")
								: t("appointments.previousWeek")
						}
						onClick={() => move(-1)}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={
							view === "month"
								? t("appointments.nextMonth")
								: t("appointments.nextWeek")
						}
						onClick={() => move(1)}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
					{/* The period is the visible title, as in the kit. The page name stays for screen readers. */}
					<h1 className="ms-2 font-(--heading-weight) font-display text-xl tracking-(--heading-tracking)">
						<span className="sr-only">{`${t("appointments.title")}, `}</span>
						{title}
					</h1>
					<div className="ms-auto flex flex-wrap items-center gap-2">
						<Select
							value={practitionerId ?? ALL_PRACTITIONERS}
							onValueChange={(value) =>
								navigate({
									to: "/app/appointments",
									search: (previous) => ({
										...previous,
										practitioner:
											value === ALL_PRACTITIONERS ? undefined : value,
									}),
								})
							}
						>
							<SelectTrigger
								aria-label={t("appointments.practitionerFilter")}
								className="w-auto"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value={ALL_PRACTITIONERS}>
									{t("appointments.allPractitioners")}
								</SelectItem>
								{practitioners.map((practitioner) => (
									<SelectItem key={practitioner.id} value={practitioner.id}>
										{practitioner.fullName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={view}
							onValueChange={(value) =>
								setView(
									CALENDAR_VIEWS.find((option) => option === value) ?? "month",
								)
							}
						>
							<SelectTrigger
								aria-label={t("appointments.view")}
								className="w-auto"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								{CALENDAR_VIEWS.map((option) => (
									<SelectItem key={option} value={option}>
										{t(`appointments.views.${option}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv(
									"appointments.csv",
									toCsv(rangeRows, appointmentCsvColumns(t, locale)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</div>
				</div>
				{view === "month" ? (
					<MonthGrid
						monthStart={monthStart}
						rows={rangeRows}
						now={now}
						onOpen={openAppointment}
						onShowDay={(dayStart) => {
							setAnchor(dayStart);
							setView("week");
						}}
					/>
				) : (
					<WeekGrid
						anchor={anchor}
						rows={rangeRows}
						now={now}
						onOpen={openAppointment}
					/>
				)}
				{/* The chip color names the department. The legend gives each color its word. */}
				<ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-3 text-muted-foreground text-xs">
					{SPECIALTIES.map((specialty) => (
						<li key={specialty} className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className={cn(
									"size-2 rounded-full",
									SPECIALTY_TONE[specialty].dot,
								)}
							/>
							{t(`specialties.${specialty}`)}
						</li>
					))}
				</ul>
			</Card>
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

/** Placeholder while the loader runs: the toolbar and the month grid. */
export function AppointmentsPageSkeleton() {
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<div className="flex flex-wrap items-center gap-2 border-b p-4">
				<Skeleton className="h-9 w-20" />
				<Skeleton className="h-9 w-48" />
				<Skeleton className="ms-auto h-9 w-72 max-w-full" />
			</div>
			<Skeleton className="m-4 h-160" />
		</Card>
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
