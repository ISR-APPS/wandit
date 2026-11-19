// The patient list behind login: the title and the export, then one table with a filter field,
// status, coverage, and practitioner filters, a column menu, row checkboxes, a row menu, and pages.
// The /app/patients route renders it after its loader. The route also uses the skeleton and the error below.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	formatRelativeTime,
	PersonAvatar,
	toCsv,
	useNow,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { patientsQueryOptions } from "../api/patients.queries";
import {
	PATIENT_STATUS_BADGE,
	PATIENT_STATUSES,
	type PatientRow,
	type PatientStatus,
	patientStatusOf,
} from "../lib/patient-rows";

// The coverage values of the filter, in the order of the message file.
const COVERAGES = ["public", "private", "self_pay"] as const;

/** The three filters cut the rows; then RecordTable filters by text, sorts, selects, and pages them. */
export function PatientsPage() {
	const { t, locale } = useT();
	const now = useNow();
	const { data: patients } = useSuspenseQuery(patientsQueryOptions());
	const [status, setStatus] = useState<PatientStatus | null>(null);
	const [coverage, setCoverage] = useState<(typeof COVERAGES)[number] | null>(
		null,
	);
	const [practitionerId, setPractitionerId] = useState<string | null>(null);
	// One entry per practitioner who follows a patient, in the order of the rooms.
	const practitioners = [
		...new Map(
			patients.flatMap((row) =>
				row.primaryPractitioner
					? [[row.primaryPractitioner.id, row.primaryPractitioner] as const]
					: [],
			),
		).values(),
	].sort((first, second) =>
		first.room.localeCompare(second.room, locale, { numeric: true }),
	);
	const rows = patients.filter(
		(row) =>
			(status === null || patientStatusOf(row) === status) &&
			(coverage === null || row.coverage === coverage) &&
			(practitionerId === null || row.primaryPractitionerId === practitionerId),
	);

	const columns: RecordColumn<PatientRow>[] = [
		{
			id: "name",
			header: t("patients.name"),
			sortValue: (row) => `${row.lastName} ${row.firstName}`,
			cell: (row) => (
				<Link
					to="/app/patients/$patientId"
					params={{ patientId: row.id }}
					className="group flex items-center gap-3 outline-none"
				>
					<PersonAvatar name={row.fullName} className="size-9" />
					<span
						className="font-medium group-hover:underline group-focus-visible:underline"
						dir="auto"
					>
						{row.fullName}
					</span>
				</Link>
			),
		},
		{
			id: "practitioner",
			header: t("patients.practitioner"),
			hideable: true,
			sortValue: (row) => row.primaryPractitioner?.fullName ?? "",
			cell: (row) => row.primaryPractitioner?.fullName ?? "–",
		},
		{
			id: "coverage",
			header: t("patients.coverage"),
			hideable: true,
			sortValue: (row) => t(`coverage.${row.coverage}`),
			cell: (row) => t(`coverage.${row.coverage}`),
		},
		{
			id: "email",
			header: t("patients.email"),
			hideable: true,
			sortValue: (row) => row.email ?? "",
			cell: (row) =>
				row.email ? (
					<a
						href={`mailto:${row.email}`}
						className="underline decoration-border underline-offset-4 hover:decoration-ring"
						dir="ltr"
					>
						{row.email}
					</a>
				) : (
					<span className="text-muted-foreground">{t("patients.noEmail")}</span>
				),
		},
		{
			id: "lastVisit",
			header: t("patients.lastVisit"),
			hideable: true,
			// A file with no visit sorts as the oldest.
			sortValue: (row) => row.lastVisitAt ?? 0,
			cell: (row) => (
				<span className="text-muted-foreground">
					{row.lastVisitAt === null
						? t("patients.noVisit")
						: formatRelativeTime(row.lastVisitAt, now, locale)}
				</span>
			),
		},
		{
			id: "status",
			header: t("patients.status"),
			sortValue: (row) => PATIENT_STATUSES.indexOf(patientStatusOf(row)),
			cell: (row) => {
				const rowStatus = patientStatusOf(row);
				return (
					<Badge variant={PATIENT_STATUS_BADGE[rowStatus]}>
						{t(`patients.statuses.${rowStatus}`)}
					</Badge>
				);
			},
		},
	];

	const csvColumns: CsvColumn<PatientRow>[] = [
		{ header: t("patients.fileNumber"), value: (row) => row.fileNumber },
		{ header: t("patients.name"), value: (row) => row.fullName },
		{ header: t("patients.dateOfBirth"), value: (row) => row.dateOfBirth },
		{ header: t("patients.phone"), value: (row) => row.phone },
		{ header: t("patients.email"), value: (row) => row.email ?? "" },
		{
			header: t("patients.practitioner"),
			value: (row) => row.primaryPractitioner?.fullName ?? "",
		},
		{
			header: t("patients.coverage"),
			value: (row) => t(`coverage.${row.coverage}`),
		},
		{
			header: t("patients.status"),
			value: (row) => t(`patients.statuses.${patientStatusOf(row)}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("patients.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() => downloadCsv("patients.csv", toCsv(rows, csvColumns))}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.fullName} ${row.fileNumber} ${row.email ?? ""} ${row.phone}`
				}
				searchPlaceholder={t("patients.filter")}
				toolbar={
					<>
						<RecordFilter
							label={t("patients.status")}
							options={PATIENT_STATUSES.map((value) => ({
								value,
								label: t(`patients.statuses.${value}`),
							}))}
							value={status}
							onValueChange={(value) =>
								setStatus(
									PATIENT_STATUSES.find((option) => option === value) ?? null,
								)
							}
						/>
						<RecordFilter
							label={t("patients.coverage")}
							options={COVERAGES.map((value) => ({
								value,
								label: t(`coverage.${value}`),
							}))}
							value={coverage}
							onValueChange={(value) =>
								setCoverage(
									COVERAGES.find((option) => option === value) ?? null,
								)
							}
						/>
						<RecordFilter
							label={t("patients.practitioner")}
							options={practitioners.map((practitioner) => ({
								value: practitioner.id,
								label: practitioner.fullName,
							}))}
							value={practitionerId}
							onValueChange={setPractitionerId}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								to="/app/patients/$patientId"
								params={{ patientId: row.id }}
							>
								{t("patients.openFile")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.phone, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("dashboard.copyPhone")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.fileNumber, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("patients.copyFileNumber")}
						</DropdownMenuItem>
					</>
				)}
				selectable
				bulkActions={(selectedRows) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"patients-selected.csv",
								toCsv(selectedRows, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={10}
				noResults={t("patients.noResults")}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the loader runs: the header, the toolbar, and the rows. */
export function PatientsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full max-w-xl" />
			<div className="grid gap-2 rounded-md border p-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-10 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the list and detail pages when the loader fails. Try again runs the loader again. */
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
