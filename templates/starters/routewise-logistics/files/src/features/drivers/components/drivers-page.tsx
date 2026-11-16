// The driver list behind login: the page header, the status tabs, and the searchable table with the figures of 30 days.
// The /app/drivers route renders it after its loader. The route also uses the skeleton and the error below.
// A click on a name opens the driver panel at the side.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DRIVER_STATUS_BADGE,
	DRIVER_STATUSES,
	type DriverStatus,
	fillMessage,
	LoadError,
	PersonAvatar,
	percentFormat,
	pluralForm,
	StatusTabs,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	DRIVER_STATS_DAYS,
	type Driver,
	driversQueryOptions,
} from "../api/drivers.queries";
import { DriverSheet } from "./driver-sheet";

// The on-time rate that the desk expects of a driver. A lower rate shows in the warning color.
const ON_TIME_TARGET = 0.9;

/** The drivers page. The status tab filters the rows; then DataTable searches, sorts, and pages them. */
export function DriversPage() {
	const { t, locale } = useT();
	const { data: drivers } = useSuspenseQuery(driversQueryOptions());
	const [status, setStatus] = useState<DriverStatus | "all">("all");
	const [panel, setPanel] = useState<{ driverId: string; isOpen: boolean }>({
		driverId: "",
		isOpen: false,
	});

	const number = new Intl.NumberFormat(locale);
	const percent = percentFormat(locale);
	const tabs = DRIVER_STATUSES.map((value) => ({
		value,
		label: t(`driverStatus.${value}`),
		count: drivers.filter((driver) => driver.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? drivers
			: drivers.filter((driver) => driver.status === activeStatus);
	const withRunCount = drivers.filter((driver) => driver.stopCount > 0).length;

	// The figures come before "Run today", so a phone shows the on-time rate without a sideways scroll.
	const columns: DataTableColumn<Driver>[] = [
		{
			id: "name",
			header: t("drivers.driver"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					{/* A phone hides the initials, so the status and the on-time rate fit on the first screen. */}
					<PersonAvatar name={row.name} className="max-sm:hidden" />
					<div className="grid justify-items-start">
						{/* The padding gives the button a touch area of 44 px. The negative margin keeps the row height. */}
						<button
							type="button"
							className="-my-3 rounded-sm py-3 font-semibold outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
							onClick={() => setPanel({ driverId: row.id, isOpen: true })}
						>
							{row.name}
						</button>
						<span className="text-muted-foreground text-xs">
							{`${fillMessage(t("drivers.licenceClass"), { licence: row.licenceClass })} · ${row.depotName}`}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "status",
			header: t("drivers.status"),
			sortValue: (row) => DRIVER_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={DRIVER_STATUS_BADGE[row.status]}>
					{t(`driverStatus.${row.status}`)}
				</Badge>
			),
		},
		{
			id: "on-time",
			header: t("drivers.onTime"),
			align: "end",
			sortValue: (row) => row.onTimeRate ?? -1,
			cell: (row) =>
				row.onTimeRate === null ? (
					<span className="text-muted-foreground">{t("drivers.noRate")}</span>
				) : (
					<span
						className={cn(
							"font-medium",
							row.onTimeRate < ON_TIME_TARGET && "text-warning",
						)}
					>
						{percent.format(row.onTimeRate)}
					</span>
				),
		},
		{
			id: "delivered",
			header: t("drivers.delivered"),
			align: "end",
			sortValue: (row) => row.deliveredCount,
			cell: (row) => number.format(row.deliveredCount),
		},
		{
			id: "late",
			header: t("drivers.late"),
			align: "end",
			sortValue: (row) => row.lateCount,
			cell: (row) => number.format(row.lateCount),
		},
		{
			id: "run",
			header: t("drivers.runToday"),
			sortValue: (row) => row.stopCount,
			cell: (row) =>
				row.vehicleUnit ? (
					<div className="grid">
						<span className="font-medium tabular-nums">{row.vehicleUnit}</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{fillMessage(
								t(`load.stops.${pluralForm(row.stopCount, locale)}`),
								{ count: number.format(row.stopCount) },
							)}
						</span>
					</div>
				) : (
					<span className="text-muted-foreground">
						{t(row.status === "off_duty" ? "drivers.restDay" : "drivers.noRun")}
					</span>
				),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("drivers.title")}
				description={fillMessage(t("drivers.summary"), {
					total: number.format(drivers.length),
					withRun: number.format(withRunCount),
					days: number.format(DRIVER_STATS_DAYS),
				})}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.name} ${row.depotName} ${row.vehicleUnit ?? ""}`
						}
						noResults={t("drivers.noResults")}
						toolbar={
							<StatusTabs
								value={activeStatus}
								onValueChange={setStatus}
								allLabel={t("drivers.all")}
								allCount={drivers.length}
								tabs={tabs}
							/>
						}
					/>
				</CardContent>
			</Card>
			<DriverSheet
				driver={drivers.find((driver) => driver.id === panel.driverId)}
				open={panel.isOpen}
				onOpenChange={(isOpen) =>
					setPanel((current) => ({ ...current, isOpen }))
				}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the drivers loader runs. The route sets it as pendingComponent. */
export function DriversPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-72 max-w-full" />
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

/** Error state of the drivers page when its loader fails. Try again runs the loader again. */
export function DriversPageError() {
	const { t } = useT();
	return <LoadError message={t("drivers.pageError")} />;
}
