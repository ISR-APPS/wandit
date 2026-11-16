// The list of the whole book: period tabs, a practitioner filter, and a table that searches, sorts, and pages.
// AppointmentsPage renders it for the "list" view. The period is local state; the practitioner comes from the URL.
// The time cell opens the detail panel. The patient cell opens the patient file.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	APPOINTMENT_STATUSES,
	type AppointmentRow,
	AppointmentStatusBadge,
	isLate,
	listPractitioners,
	VISIT_TYPES,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	APPOINTMENT_PERIODS,
	type AppointmentPeriod,
	rowsOfPeriod,
} from "../lib/appointment-views";

type AppointmentsTableProps = {
	/** Every appointment of the book, oldest first. */
	rows: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** The practitioner filter of the URL, or undefined for every practitioner. */
	practitionerId: string | undefined;
	/** Called with the new filter. undefined means every practitioner. */
	onPractitionerChange: (practitionerId: string | undefined) => void;
};

// The Select value of "every practitioner". No practitioner has this id.
const ALL = "all";

/** The practitioner filter applies first, so each tab count is the count of the rows that the tab shows. */
export function AppointmentsTable({
	rows,
	now,
	practitionerId,
	onPractitionerChange,
}: AppointmentsTableProps) {
	const { t, locale } = useT();
	const [period, setPeriod] = useState<AppointmentPeriod>("today");
	const practitioners = listPractitioners();
	const activePractitioner = practitioners.find(
		(practitioner) => practitioner.id === practitionerId,
	);
	const filtered = activePractitioner
		? rows.filter((row) => row.practitioner.id === activePractitioner.id)
		: rows;
	const tabs = APPOINTMENT_PERIODS.map((value) => ({
		value,
		rows: rowsOfPeriod(filtered, value, now),
	}));
	const periodRows = tabs.find((tab) => tab.value === period)?.rows ?? [];

	const number = new Intl.NumberFormat(locale);
	const day = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	const columns: DataTableColumn<AppointmentRow>[] = [
		{
			id: "when",
			header: t("appointments.when"),
			sortValue: (row) => row.startsAt,
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/appointments"
						search={(previous) => ({ ...previous, appointment: row.id })}
						className="font-medium tabular-nums hover:underline"
					>
						{time.format(row.startsAt)}
					</Link>
					{/* Every row of the Today tab has the same day, so the tab shows only the time. */}
					{period === "today" ? null : (
						<span className="text-muted-foreground text-xs tabular-nums">
							{day.format(row.startsAt)}
						</span>
					)}
				</div>
			),
		},
		// Status comes second: the front desk reads it first, and a phone shows only the first columns.
		{
			id: "status",
			header: t("appointments.status"),
			sortValue: (row) => APPOINTMENT_STATUSES.indexOf(row.status),
			cell: (row) => (
				<AppointmentStatusBadge status={row.status} isLate={isLate(row, now)} />
			),
		},
		{
			id: "patient",
			header: t("appointments.patient"),
			sortValue: (row) => `${row.patient.lastName} ${row.patient.firstName}`,
			cell: (row) => (
				<div className="grid justify-items-start">
					<Link
						to="/app/patients/$patientId"
						params={{ patientId: row.patient.id }}
						className="font-medium hover:underline"
					>
						{row.patient.fullName}
					</Link>
					<span className="text-muted-foreground text-xs tabular-nums">
						{row.patient.fileNumber}
					</span>
				</div>
			),
		},
		{
			id: "practitioner",
			header: t("appointments.practitioner"),
			sortValue: (row) => row.practitioner.fullName,
			cell: (row) => (
				<div className="grid">
					<span>{row.practitioner.fullName}</span>
					<span className="text-muted-foreground text-xs">{row.room}</span>
				</div>
			),
		},
		{
			id: "visit",
			header: t("appointments.visit"),
			// The order of VISIT_TYPES groups the visits of one kind, for example all vaccinations.
			sortValue: (row) => VISIT_TYPES.indexOf(row.visitType),
			cell: (row) => (
				<div className="grid">
					<span>{t(`visitTypes.${row.visitType}`)}</span>
					<span className="text-muted-foreground text-xs">{row.reason}</span>
				</div>
			),
		},
	];

	return (
		<DataTable
			// A new filter starts at page 1 with no sort of the old rows.
			key={`${period}:${activePractitioner?.id ?? ALL}`}
			rows={periodRows}
			columns={columns}
			searchText={(row) =>
				`${row.patient.fullName} ${row.patient.fileNumber} ${row.practitioner.fullName} ${row.reason}`
			}
			noResults={t("appointments.noResults")}
			toolbar={
				<>
					{/* The filter sits beside the search, so the period tabs wrap as one piece on a narrow page. */}
					<Select
						value={activePractitioner?.id ?? ALL}
						onValueChange={(value) =>
							onPractitionerChange(value === ALL ? undefined : value)
						}
					>
						<SelectTrigger
							className="w-full max-md:h-11 sm:w-52"
							aria-label={t("appointments.practitionerFilter")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="start">
							<SelectItem value={ALL}>
								{t("appointments.allPractitioners")}
							</SelectItem>
							{practitioners.map((practitioner) => (
								<SelectItem key={practitioner.id} value={practitioner.id}>
									{practitioner.fullName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Tabs
						value={period}
						onValueChange={(value) =>
							setPeriod(
								APPOINTMENT_PERIODS.find((option) => option === value) ??
									"today",
							)
						}
						className="max-w-full overflow-x-auto"
					>
						{/* The kit strip is 36 px high. A phone gets a 44 px touch area. */}
						<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
							{tabs.map((tab) => (
								<TabsTrigger key={tab.value} value={tab.value}>
									{t(`appointments.periods.${tab.value}`)}
									<span className="tabular-nums opacity-70">
										{number.format(tab.rows.length)}
									</span>
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</>
			}
		/>
	);
}
