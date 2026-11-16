// The employee directory behind login: four figures, then the table of every employee.
// The /app/employees route renders it after its loader. The route also uses the skeleton and the error below.
// The status tabs and the department filter cut the rows; a name opens the profile page.
// Narrow screens show fewer columns (see PHONE_COLUMN_IDS and LAPTOP_COLUMN_IDS).
// On a phone the name cell also names the department.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DEPARTMENTS,
	type Department,
	dayKeyToMs,
	EMPLOYEE_STATUS_BADGE,
	EMPLOYEE_STATUSES,
	type EmployeeStatus,
	KpiFigures,
	KpiFiguresSkeleton,
	PersonAvatar,
	TimeOffTypeMark,
	useIsWideScreen,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { useSidebar } from "~/shared/ui/sidebar";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type EmployeeListItem,
	employeesKpisQueryOptions,
	employeesQueryOptions,
} from "../api/employees.queries";

// The grid of the figure row: two columns on a phone, four from a 42rem main column (a 1024 px screen).
const KPI_GRID = "grid-cols-2 @2xl/main:grid-cols-4";
// The columns that fit with no cut text: a 390 px phone, then a laptop under 1280 px.
// A wide screen shows every column. The profile shows the facts that a narrow screen leaves out.
const PHONE_COLUMN_IDS = new Set(["name", "status"]);
const LAPTOP_COLUMN_IDS = new Set(["name", "department", "vacation", "status"]);

/** The directory. The tab and the department cut the rows; then DataTable searches, sorts, and pages them. */
export function EmployeesPage() {
	const { t, locale } = useT();
	const { data: employees } = useSuspenseQuery(employeesQueryOptions());
	const { data: kpis } = useSuspenseQuery(employeesKpisQueryOptions());
	const { isMobile } = useSidebar();
	const isWideScreen = useIsWideScreen();
	const [status, setStatus] = useState<EmployeeStatus | "all">("all");
	const [department, setDepartment] = useState<Department | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const inDepartment =
		department === "all"
			? employees
			: employees.filter((row) => row.department === department);
	// A tab shows only for a status that has rows in the chosen department.
	const tabs = EMPLOYEE_STATUSES.map((value) => ({
		value,
		count: inDepartment.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? inDepartment
			: inDepartment.filter((row) => row.status === activeStatus);

	const columns: DataTableColumn<EmployeeListItem>[] = [
		{
			id: "name",
			header: t("employees.name"),
			sortValue: (row) => row.lastName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PersonAvatar name={row.name} />
					<div className="grid justify-items-start">
						<Link
							to="/app/employees/$employeeId"
							params={{ employeeId: row.id }}
							className="font-medium hover:underline"
							dir="auto"
						>
							{row.name}
						</Link>
						<span
							className="whitespace-normal text-muted-foreground text-xs"
							dir="auto"
						>
							{row.title}
						</span>
						{isMobile ? (
							<span className="whitespace-normal text-muted-foreground text-xs">
								{t(`departments.${row.department}`)}
							</span>
						) : null}
					</div>
				</div>
			),
		},
		{
			id: "department",
			header: t("employees.department"),
			sortValue: (row) => DEPARTMENTS.indexOf(row.department),
			cell: (row) => (
				<span className="whitespace-nowrap">
					{t(`departments.${row.department}`)}
				</span>
			),
		},
		{
			id: "location",
			header: t("employees.location"),
			sortValue: (row) => row.location,
			cell: (row) => t(`locations.${row.location}`),
		},
		{
			id: "start",
			header: t("employees.started"),
			sortValue: (row) => row.startDate,
			cell: (row) => (
				<span className="whitespace-nowrap tabular-nums">
					{dateFormat.format(new Date(dayKeyToMs(row.startDate)))}
				</span>
			),
		},
		{
			id: "vacation",
			header: t("employees.vacationLeft"),
			align: "end",
			sortValue: (row) => row.vacationLeft,
			cell: (row) => (
				<span className="whitespace-nowrap">
					{dayCount.format(row.vacationLeft)}
				</span>
			),
		},
		{
			id: "status",
			header: t("employees.status"),
			sortValue: (row) => EMPLOYEE_STATUSES.indexOf(row.status),
			cell: (row) => (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<Badge variant={EMPLOYEE_STATUS_BADGE[row.status]}>
						{t(`employeeStatuses.${row.status}`)}
					</Badge>
					{/* Long leave already shows in the status. A short leave today gets its own mark. */}
					{row.offTodayType && row.status !== "on_leave" ? (
						<span className="whitespace-nowrap text-muted-foreground text-xs">
							<TimeOffTypeMark type={row.offTodayType} />
						</span>
					) : null}
				</div>
			),
		},
	];
	const visibleColumns = isWideScreen
		? columns
		: columns.filter((column) =>
				(isMobile ? PHONE_COLUMN_IDS : LAPTOP_COLUMN_IDS).has(column.id),
			);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("employees.title")}
				description={t("employees.description")}
			/>
			<KpiFigures
				items={kpis.map(({ labelKey, noteKey, ...item }) => ({
					...item,
					label: t(labelKey),
					note: noteKey ? t(noteKey) : undefined,
				}))}
				className={KPI_GRID}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={visibleColumns}
						searchText={(row) => `${row.name} ${row.title} ${row.id}`}
						noResults={t("employees.noResults")}
						toolbar={
							<>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											EMPLOYEE_STATUSES.find((option) => option === value) ??
												"all",
										)
									}
									className="max-w-full"
								>
									{/* On a phone the tabs wrap to a second line, so no status hides past the edge. */}
									<TabsList className="max-w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
										<TabsTrigger value="all">
											{t("employees.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(inDepartment.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`employeeStatuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={department}
									onValueChange={(value) =>
										setDepartment(
											DEPARTMENTS.find((option) => option === value) ?? "all",
										)
									}
								>
									<SelectTrigger
										className="w-full sm:w-52"
										aria-label={t("employees.departmentFilter")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("employees.allDepartments")}
										</SelectItem>
										{DEPARTMENTS.map((option) => (
											<SelectItem key={option} value={option}>
												{t(`departments.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the directory loader runs. The route sets it as pendingComponent. */
export function EmployeesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<KpiFiguresSkeleton count={4} className={KPI_GRID} />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-11 w-full" />
					))}
				</CardContent>
			</Card>
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
