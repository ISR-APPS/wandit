// The practitioners page behind login: the title and the export, then one table of the team with a filter field,
// specialty and status filters, a column menu, row checkboxes, a row menu, and pages.
// The /app/practitioners route renders it after its loader. The route also uses the skeleton and the error below.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type BadgeVariant,
	type CsvColumn,
	copyToClipboard,
	downloadCsv,
	fillMessage,
	PersonAvatar,
	SPECIALTIES,
	type Specialty,
	toCsv,
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
import { practitionersQueryOptions } from "../api/practitioners.queries";
import type { PractitionerRow } from "../lib/practitioner-rows";

/** The status of a practitioner now. The label is the message key `practitioners.statuses.<status>`. */
const PRACTITIONER_STATUSES = ["with_patient", "on_duty", "off"] as const;
type PractitionerStatus = (typeof PRACTITIONER_STATUSES)[number];

// Badge variant per status. A practitioner with a patient is busy; one off today is muted.
const PRACTITIONER_STATUS_BADGE = {
	with_patient: "info",
	on_duty: "success",
	off: "outline",
} satisfies Record<PractitionerStatus, BadgeVariant>;

// A consultation now wins over the shift: the front desk must not send a patient in.
function statusOf(row: PractitionerRow): PractitionerStatus {
	if (row.currentAppointment !== null) {
		return "with_patient";
	}
	return row.shiftToday === null ? "off" : "on_duty";
}

/** The two filters cut the rows; then RecordTable filters by text, sorts, selects, and pages them. */
export function PractitionersPage() {
	const { t, locale } = useT();
	const { data: practitioners } = useSuspenseQuery(practitionersQueryOptions());
	const [specialty, setSpecialty] = useState<Specialty | null>(null);
	const [status, setStatus] = useState<PractitionerStatus | null>(null);
	const number = new Intl.NumberFormat(locale);
	const rows = practitioners.filter(
		(row) =>
			(specialty === null || row.specialty === specialty) &&
			(status === null || statusOf(row) === status),
	);

	const columns: RecordColumn<PractitionerRow>[] = [
		{
			id: "name",
			header: t("practitioners.name"),
			sortValue: (row) => row.fullName,
			cell: (row) => (
				<span className="flex items-center gap-3">
					<PersonAvatar name={row.fullName} tone="staff" className="size-9" />
					<span className="font-medium">{row.fullName}</span>
				</span>
			),
		},
		{
			id: "specialty",
			header: t("practitioners.specialty"),
			hideable: true,
			sortValue: (row) => t(`specialties.${row.specialty}`),
			cell: (row) => t(`specialties.${row.specialty}`),
		},
		{
			id: "room",
			header: t("practitioners.room"),
			hideable: true,
			sortValue: (row) => row.room,
			cell: (row) => `${row.room} · ${row.extension}`,
		},
		{
			id: "today",
			header: t("practitioners.today"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.todayTotal,
			cell: (row) =>
				row.shiftToday === null ? (
					<span className="text-muted-foreground">–</span>
				) : (
					fillMessage(t("practitioners.seenOfTotal"), {
						seen: number.format(row.todaySeen),
						total: number.format(row.todayTotal),
					})
				),
		},
		{
			id: "visits",
			header: t("practitioners.visits30"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.periodVisits,
			cell: (row) => number.format(row.periodVisits),
		},
		{
			id: "status",
			header: t("practitioners.status"),
			sortValue: (row) => PRACTITIONER_STATUSES.indexOf(statusOf(row)),
			cell: (row) => {
				const rowStatus = statusOf(row);
				return (
					<Badge variant={PRACTITIONER_STATUS_BADGE[rowStatus]}>
						{t(`practitioners.statuses.${rowStatus}`)}
					</Badge>
				);
			},
		},
	];

	const csvColumns: CsvColumn<PractitionerRow>[] = [
		{ header: t("practitioners.name"), value: (row) => row.fullName },
		{ header: t("practitioners.credentials"), value: (row) => row.credentials },
		{
			header: t("practitioners.specialty"),
			value: (row) => t(`specialties.${row.specialty}`),
		},
		{ header: t("practitioners.room"), value: (row) => row.room },
		{ header: t("practitioners.extension"), value: (row) => row.extension },
		{
			header: t("practitioners.visits30"),
			value: (row) => String(row.periodVisits),
		},
		{
			header: t("practitioners.status"),
			value: (row) => t(`practitioners.statuses.${statusOf(row)}`),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("practitioners.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("practitioners.csv", toCsv(rows, csvColumns))
						}
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
					`${row.fullName} ${t(`specialties.${row.specialty}`)} ${row.room} ${row.languages.join(" ")}`
				}
				searchPlaceholder={t("practitioners.filter")}
				toolbar={
					<>
						<RecordFilter
							label={t("practitioners.specialty")}
							options={SPECIALTIES.map((value) => ({
								value,
								label: t(`specialties.${value}`),
							}))}
							value={specialty}
							onValueChange={(value) =>
								setSpecialty(
									SPECIALTIES.find((option) => option === value) ?? null,
								)
							}
						/>
						<RecordFilter
							label={t("practitioners.status")}
							options={PRACTITIONER_STATUSES.map((value) => ({
								value,
								label: t(`practitioners.statuses.${value}`),
							}))}
							value={status}
							onValueChange={(value) =>
								setStatus(
									PRACTITIONER_STATUSES.find((option) => option === value) ??
										null,
								)
							}
						/>
					</>
				}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/appointments" search={{ practitioner: row.id }}>
								{t("practitioners.openAgenda")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.extension, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("practitioners.copyExtension")}
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
								"practitioners-selected.csv",
								toCsv(selectedRows, csvColumns),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				pageSize={10}
				noResults={t("practitioners.noResults")}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the loader runs: the header, the toolbar, and the rows. */
export function PractitionersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-44" />
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

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function PractitionersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("practitioners.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
