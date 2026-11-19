// The employee directory behind login: the page title with the export, then the table of every employee.
// The /app/employees route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the kit users list: no card around the table, filter buttons in the toolbar, a row menu, row selection.
// A name opens the profile page.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CsvColumn,
	copyToClipboard,
	DEPARTMENTS,
	downloadCsv,
	EMPLOYEE_STATUS_BADGE,
	EMPLOYEE_STATUSES,
	LOCATIONS,
	PersonAvatar,
	toCsv,
} from "~/features/people";
import { type TranslationKey, useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type EmployeeListItem,
	employeesQueryOptions,
} from "../api/employees.queries";

// Ten rows per page, as the kit users list shows.
const EMPLOYEES_PAGE_SIZE = 10;

// One CSV column per directory field. The header export and "Export selected" use the same columns.
function employeeCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<EmployeeListItem>[] {
	return [
		{ header: t("employees.employeeId"), value: (row) => row.id },
		{ header: t("employees.name"), value: (row) => row.name },
		{ header: t("employees.jobTitle"), value: (row) => row.title },
		{
			header: t("employees.department"),
			value: (row) => t(`departments.${row.department}`),
		},
		{ header: t("employees.email"), value: (row) => row.email },
		{
			header: t("employees.location"),
			value: (row) => t(`locations.${row.location}`),
		},
		{ header: t("employees.started"), value: (row) => row.startDate },
		{
			header: t("employees.status"),
			value: (row) => t(`employeeStatuses.${row.status}`),
		},
	];
}

/** The directory. The three filters cut the rows; then RecordTable searches, sorts, selects, and pages them. */
export function EmployeesPage() {
	const { t } = useT();
	const { data: employees } = useSuspenseQuery(employeesQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [department, setDepartment] = useState<string | null>(null);
	const [location, setLocation] = useState<string | null>(null);
	const rows = employees.filter(
		(row) =>
			(status === null || row.status === status) &&
			(department === null || row.department === department) &&
			(location === null || row.location === location),
	);

	const columns: RecordColumn<EmployeeListItem>[] = [
		{
			id: "name",
			header: t("employees.name"),
			sortValue: (row) => row.lastName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PersonAvatar name={row.name} />
					<Link
						to="/app/employees/$employeeId"
						params={{ employeeId: row.id }}
						className="whitespace-nowrap font-medium hover:underline"
						dir="auto"
					>
						{row.name}
					</Link>
				</div>
			),
		},
		{
			id: "title",
			header: t("employees.jobTitle"),
			hideable: true,
			sortValue: (row) => row.title,
			cell: (row) => (
				<span className="whitespace-nowrap" dir="auto">
					{row.title}
				</span>
			),
		},
		{
			id: "department",
			header: t("employees.department"),
			hideable: true,
			sortValue: (row) => DEPARTMENTS.indexOf(row.department),
			cell: (row) => (
				<span className="whitespace-nowrap">
					{t(`departments.${row.department}`)}
				</span>
			),
		},
		{
			id: "email",
			header: t("employees.email"),
			hideable: true,
			sortValue: (row) => row.email,
			cell: (row) => <span className="text-muted-foreground">{row.email}</span>,
		},
		{
			id: "location",
			header: t("employees.location"),
			hideable: true,
			sortValue: (row) => LOCATIONS.indexOf(row.location),
			cell: (row) => t(`locations.${row.location}`),
		},
		{
			id: "status",
			header: t("employees.status"),
			sortValue: (row) => EMPLOYEE_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={EMPLOYEE_STATUS_BADGE[row.status]}>
					{t(`employeeStatuses.${row.status}`)}
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("employees.title")}
				description={t("employees.description")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("employees.csv", toCsv(rows, employeeCsvColumns(t)))
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
				searchText={(row) => `${row.name} ${row.title} ${row.email} ${row.id}`}
				searchPlaceholder={t("employees.searchPlaceholder")}
				pageSize={EMPLOYEES_PAGE_SIZE}
				noResults={t("employees.noResults")}
				toolbar={
					<>
						<RecordFilter
							label={t("employees.status")}
							options={EMPLOYEE_STATUSES.map((value) => ({
								value,
								label: t(`employeeStatuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("employees.department")}
							options={DEPARTMENTS.map((value) => ({
								value,
								label: t(`departments.${value}`),
							}))}
							value={department}
							onValueChange={setDepartment}
						/>
						<RecordFilter
							label={t("employees.location")}
							options={LOCATIONS.map((value) => ({
								value,
								label: t(`locations.${value}`),
							}))}
							value={location}
							onValueChange={setLocation}
						/>
					</>
				}
				selectable
				bulkActions={(selectedRows) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"employees-selected.csv",
								toCsv(selectedRows, employeeCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link
								to="/app/employees/$employeeId"
								params={{ employeeId: row.id }}
							>
								{t("employees.openProfile")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("employees.copyEmail")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("table.copyId")}
						</DropdownMenuItem>
					</>
				)}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the directory loader runs. The route sets it as pendingComponent. */
export function EmployeesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-sm" />
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the directory and the profile when a loader fails. Try again runs the loader again. */
export function EmployeesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("employees.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
