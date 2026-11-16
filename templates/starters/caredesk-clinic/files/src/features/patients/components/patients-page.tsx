// The patient list behind login: the page header, the tabs, and the searchable table.
// The /app/patients route renders it after its loader. The route also uses the skeleton and the error below.
// A name opens the patient file. The starter has no "add" form: STARTER.md says where it goes.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	formatRelativeTime,
	PersonAvatar,
	useNow,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { patientsQueryOptions } from "../api/patients.queries";
import {
	formatAge,
	PATIENT_SEGMENTS,
	type PatientRow,
	type PatientSegment,
	rowsOfSegment,
} from "../lib/patient-rows";

/** The list page. The tab filters the rows; then DataTable searches, sorts, and pages them. */
export function PatientsPage() {
	const { t, locale } = useT();
	const now = useNow();
	const { data: patients } = useSuspenseQuery(patientsQueryOptions());
	const [segment, setSegment] = useState<PatientSegment>("all");

	const number = new Intl.NumberFormat(locale);
	const day = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	// A tab shows only for a group that has rows.
	const tabs = PATIENT_SEGMENTS.map((value) => ({
		value,
		rows: rowsOfSegment(patients, value),
	})).filter((tab) => tab.value === "all" || tab.rows.length > 0);
	const activeTab = tabs.find((tab) => tab.value === segment) ?? tabs[0];

	const columns: DataTableColumn<PatientRow>[] = [
		{
			id: "patient",
			header: t("patients.patient"),
			sortValue: (row) => `${row.lastName} ${row.firstName}`,
			cell: (row) => (
				<div className="flex items-center gap-3">
					{/* A phone has no room for the avatar. The next appointment then fits beside the name. */}
					<PersonAvatar name={row.fullName} className="@xl/main:flex hidden" />
					<div className="grid justify-items-start">
						<span className="flex items-center gap-2">
							<Link
								to="/app/patients/$patientId"
								params={{ patientId: row.id }}
								className="font-medium hover:underline"
							>
								{row.fullName}
							</Link>
							{row.isNew ? (
								<Badge variant="info">{t("patients.new")}</Badge>
							) : null}
						</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{`${row.fileNumber} · ${formatAge(row.dateOfBirth, now, locale)} · ${t(`sexes.${row.sex}`)}`}
						</span>
					</div>
				</div>
			),
		},
		// The next appointment comes second, so a phone shows it beside the name.
		{
			id: "next",
			// A short head keeps every column inside the card at 1024 px.
			header: t("patients.nextVisit"),
			// A patient with no booking sorts after every booked patient.
			sortValue: (row) =>
				row.nextAppointment?.startsAt ?? Number.MAX_SAFE_INTEGER,
			cell: (row) =>
				row.nextAppointment ? (
					<div className="grid whitespace-nowrap tabular-nums">
						<span>{day.format(row.nextAppointment.startsAt)}</span>
						<span className="text-muted-foreground text-xs">
							{time.format(row.nextAppointment.startsAt)}
						</span>
					</div>
				) : row.isRecallDue ? (
					<Badge variant="warning">{t("patients.recallDue")}</Badge>
				) : (
					<span className="text-muted-foreground">
						{t("patients.noneBooked")}
					</span>
				),
		},
		{
			id: "phone",
			header: t("patients.phone"),
			// A sortable head has the size of the other heads. The phone sorts by area code.
			sortValue: (row) => row.phone,
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">{row.phone}</span>
			),
		},
		{
			id: "practitioner",
			header: t("patients.practitioner"),
			sortValue: (row) => row.primaryPractitioner?.fullName ?? "",
			cell: (row) => row.primaryPractitioner?.fullName ?? "",
		},
		{
			id: "lastVisit",
			header: t("patients.lastVisit"),
			sortValue: (row) => row.lastVisitAt ?? 0,
			// The count of visits sits under the date, so the table needs no sixth column.
			cell: (row) =>
				row.lastVisitAt === null ? (
					<span className="text-muted-foreground">{t("patients.noVisit")}</span>
				) : (
					<div className="grid whitespace-nowrap">
						<span>{formatRelativeTime(row.lastVisitAt, now, locale)}</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{fillMessage(t("patients.visitCount"), {
								count: number.format(row.visitCount),
							})}
						</span>
					</div>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("patients.title")}
				description={fillMessage(t("patients.description"), {
					count: number.format(patients.length),
				})}
			/>
			<Card>
				<CardContent>
					<DataTable
						// A new tab starts at page 1.
						key={activeTab?.value}
						rows={activeTab?.rows ?? []}
						columns={columns}
						searchText={(row) =>
							`${row.fullName} ${row.fileNumber} ${row.phone} ${row.email ?? ""}`
						}
						noResults={t("patients.noResults")}
						toolbar={
							<Tabs
								value={activeTab?.value}
								onValueChange={(value) =>
									setSegment(
										PATIENT_SEGMENTS.find((option) => option === value) ??
											"all",
									)
								}
								className="max-w-full overflow-x-auto"
							>
								{/* The kit strip is 36 px high. A phone gets a 44 px touch area. */}
								<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
									{tabs.map((tab) => (
										<TabsTrigger key={tab.value} value={tab.value}>
											{t(`patients.segments.${tab.value}`)}
											{/* The page header already gives the count of all files. The four tabs then fit at 375 px. */}
											{tab.value === "all" ? null : (
												<span className="tabular-nums opacity-70">
													{number.format(tab.rows.length)}
												</span>
											)}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function PatientsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
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

/** Error state of the patient pages when a loader fails. Try again runs the loader again. */
export function PatientsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("patients.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
