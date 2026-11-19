// The driver list behind login, in the kit user list layout: the header with the export, then the record table.
// The /app/drivers route renders it after its loader. The route also uses the skeleton and the error below.
// A click on a name, or "Open" in the row menu, opens the driver panel at the side.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	DRIVER_STATUS_BADGE,
	DRIVER_STATUSES,
	downloadCsv,
	fillMessage,
	LICENCE_CLASSES,
	LoadError,
	PersonAvatar,
	telHref,
	toCsv,
} from "~/features/logistics";
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
import { type Driver, driversQueryOptions } from "../api/drivers.queries";
import { driverCsvColumns } from "../lib/driver-csv";
import { DriverSheet } from "./driver-sheet";

// Ten rows per page, as the user list of the kit.
const PAGE_SIZE = 10;

/** The drivers page. The three filters narrow the rows; then RecordTable searches, sorts, and pages them. */
export function DriversPage() {
	const { t, locale } = useT();
	const { data: drivers } = useSuspenseQuery(driversQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [depot, setDepot] = useState<string | null>(null);
	const [licence, setLicence] = useState<string | null>(null);
	const [panel, setPanel] = useState<{ driverId: string; isOpen: boolean }>({
		driverId: "",
		isOpen: false,
	});

	const depotNames = [...new Set(drivers.map((row) => row.depotName))].sort(
		(first, second) => first.localeCompare(second, locale),
	);
	const rows = drivers.filter(
		(row) =>
			(status === null || row.status === status) &&
			(depot === null || row.depotName === depot) &&
			(licence === null || row.licenceClass === licence),
	);
	const openPanel = (driverId: string) => setPanel({ driverId, isOpen: true });

	const columns: RecordColumn<Driver>[] = [
		{
			id: "name",
			header: t("drivers.driver"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-4">
					<PersonAvatar name={row.name} className="size-8" />
					{/* The padding gives the button a touch area of 44 px. The negative margin keeps the row height. */}
					<button
						type="button"
						className="-my-3 rounded-sm py-3 text-start outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
						onClick={() => openPanel(row.id)}
					>
						{row.name}
					</button>
				</div>
			),
		},
		{
			id: "licence",
			header: t("drivers.licence"),
			hideable: true,
			sortValue: (row) => row.licenceClass,
			cell: (row) =>
				fillMessage(t("drivers.licenceClass"), { licence: row.licenceClass }),
		},
		{
			id: "depot",
			header: t("drivers.depot"),
			hideable: true,
			sortValue: (row) => row.depotName,
			cell: (row) => row.depotName,
		},
		{
			id: "phone",
			header: t("drivers.phone"),
			hideable: true,
			sortValue: (row) => row.phone,
			cell: (row) => <span className="tabular-nums">{row.phone}</span>,
		},
		{
			id: "vehicle",
			header: t("drivers.vehicle"),
			hideable: true,
			sortValue: (row) => row.vehicleUnit ?? "",
			cell: (row) =>
				row.vehicleUnit ?? (
					<span className="text-muted-foreground">
						{t(row.status === "off_duty" ? "drivers.restDay" : "drivers.noRun")}
					</span>
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
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("drivers.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("drivers.csv", toCsv(rows, driverCsvColumns(t)))
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
					`${row.name} ${row.depotName} ${row.phone} ${row.vehicleUnit ?? ""}`
				}
				searchPlaceholder={t("drivers.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("drivers.status")}
							options={DRIVER_STATUSES.map((value) => ({
								value,
								label: t(`driverStatus.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("drivers.depot")}
							options={depotNames.map((name) => ({ value: name, label: name }))}
							value={depot}
							onValueChange={setDepot}
						/>
						<RecordFilter
							label={t("drivers.licence")}
							options={LICENCE_CLASSES.map((value) => ({
								value,
								label: fillMessage(t("drivers.licenceClass"), {
									licence: value,
								}),
							}))}
							value={licence}
							onValueChange={setLicence}
						/>
					</>
				}
				selectable
				bulkActions={(selected) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv(
								"drivers-selected.csv",
								toCsv(selected, driverCsvColumns(t)),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem onSelect={() => openPanel(row.id)}>
							{t("common.open")}
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<a href={telHref(row.phone)}>{t("shipment.call")}</a>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.phone, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("drivers.copyPhone")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("drivers.noResults")}
			/>
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
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the drivers loader runs. The route sets it as pendingComponent. */
export function DriversPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				<Skeleton className="h-9 w-24" />
				<Skeleton className="h-9 w-24" />
			</div>
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the drivers page when its loader fails. Try again runs the loader again. */
export function DriversPageError() {
	const { t } = useT();
	return <LoadError message={t("drivers.pageError")} />;
}
