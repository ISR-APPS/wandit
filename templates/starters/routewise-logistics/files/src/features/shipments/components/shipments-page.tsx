// The shipment list behind login: the header with the period and the export, the status tabs, and the record table.
// The /app/shipments route renders it after its loader. The route also uses the skeleton and the error below.
// The period changes the query key, so the page reads with useQuery and keeps the old rows while the new ones load.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	DueLabel,
	downloadCsv,
	initialsOf,
	isOpenStatus,
	LoadError,
	type PeriodDays,
	PeriodSelect,
	SERVICE_LEVELS,
	SHIPMENT_STATUSES,
	type ShipmentStatus,
	ShipmentStatusBadge,
	StatusTabs,
	toCsv,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Shipment, shipmentsQueryOptions } from "../api/shipments.queries";
import { shipmentCsvColumns } from "../lib/shipment-csv";

/** The period of the first load, in days. The route loader prefetches the list of this period. */
export const SHIPMENTS_DEFAULT_DAYS: PeriodDays = 30;

// Ten rows per page, as the order list of the kit.
const PAGE_SIZE = 10;

/** The list page. The tab and the two filters narrow the rows; then RecordTable searches, sorts, and pages them. */
export function ShipmentsPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(SHIPMENTS_DEFAULT_DAYS);
	const [status, setStatus] = useState<ShipmentStatus | "all">("all");
	const [service, setService] = useState<string | null>(null);
	const [depot, setDepot] = useState<string | null>(null);
	// The loader fills the default period. A new period keeps the old rows on screen while the new rows load,
	// so this page does not use useSuspenseQuery.
	const { data: shipments, isError } = useQuery({
		...shipmentsQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const weight = weightFormat(locale);
	const rowsOfPeriod = shipments ?? [];
	// A tab shows only for a status that has rows.
	const tabs = SHIPMENT_STATUSES.map((value) => ({
		value,
		label: t(`shipmentStatus.${value}`),
		count: rowsOfPeriod.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A shorter period can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const depotNames = [
		...new Set(rowsOfPeriod.map((row) => row.depotName)),
	].sort((first, second) => first.localeCompare(second, locale));
	const rows = rowsOfPeriod.filter(
		(row) =>
			(activeStatus === "all" || row.status === activeStatus) &&
			(service === null || row.service === service) &&
			(depot === null || row.depotName === depot),
	);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	const columns: RecordColumn<Shipment>[] = [
		{
			id: "reference",
			header: "#",
			sortValue: (row) => row.reference,
			cell: (row) => (
				<Link
					to="/app/shipments/$shipmentId"
					params={{ shipmentId: row.id }}
					className="text-muted-foreground tabular-nums hover:text-foreground hover:underline"
				>
					{row.reference}
				</Link>
			),
		},
		{
			id: "customer",
			header: t("shipments.customer"),
			cell: (row) => (
				<div className="flex items-center gap-4">
					<span
						aria-hidden="true"
						className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-xs"
					>
						{initialsOf(row.customerName)}
					</span>
					<div className="grid">
						<span dir="auto">{row.customerName}</span>
						<span className="text-muted-foreground text-xs">
							{row.destination}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "weight",
			header: t("shipments.weight"),
			hideable: true,
			sortValue: (row) => row.weightKg,
			cell: (row) => (
				<span className="tabular-nums">{weight.format(row.weightKg)}</span>
			),
		},
		{
			id: "driver",
			header: t("shipments.driver"),
			hideable: true,
			sortValue: (row) => row.driverName ?? "",
			cell: (row) =>
				row.driverName ? (
					<div className="grid">
						<span className="font-medium">{row.driverName}</span>
						<span className="text-muted-foreground text-xs">
							{row.vehicleUnit}
						</span>
					</div>
				) : (
					<span className="text-muted-foreground">
						{t("shipments.noDriver")}
					</span>
				),
		},
		{
			id: "due",
			header: t("shipments.due"),
			sortValue: (row) => Date.parse(row.dueAt),
			cell: (row) =>
				isOpenStatus(row.status) ? (
					<DueLabel dueAt={row.dueAt} lateDays={row.lateDays} isOpen />
				) : (
					<span className="tabular-nums">
						{date.format(new Date(row.dueAt))}
					</span>
				),
		},
		{
			id: "service",
			header: t("shipments.service"),
			hideable: true,
			cell: (row) => t(`serviceLevel.${row.service}`),
		},
		{
			id: "status",
			header: t("shipments.status"),
			sortValue: (row) => SHIPMENT_STATUSES.indexOf(row.status),
			cell: (row) => <ShipmentStatusBadge status={row.status} />,
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("shipments.title")}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							disabled={shipments === undefined}
							onClick={() =>
								downloadCsv("shipments.csv", toCsv(rows, shipmentCsvColumns(t)))
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			{isError ? (
				<LoadError message={t("shipments.loadError")} />
			) : shipments === undefined ? (
				<ShipmentsTableSkeleton />
			) : (
				<>
					<StatusTabs
						value={activeStatus}
						onValueChange={setStatus}
						allLabel={t("shipments.all")}
						allCount={rowsOfPeriod.length}
						tabs={tabs}
					/>
					<RecordTable
						rows={rows}
						columns={columns}
						searchText={(row) =>
							`${row.reference} ${row.customerName} ${row.destination} ${row.driverName ?? ""} ${row.vehicleUnit ?? ""}`
						}
						searchPlaceholder={t("shipments.search")}
						toolbar={
							<>
								<RecordFilter
									label={t("shipments.service")}
									options={SERVICE_LEVELS.map((value) => ({
										value,
										label: t(`serviceLevel.${value}`),
									}))}
									value={service}
									onValueChange={setService}
								/>
								<RecordFilter
									label={t("shipments.depot")}
									options={depotNames.map((name) => ({
										value: name,
										label: name,
									}))}
									value={depot}
									onValueChange={setDepot}
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
										"shipments-selected.csv",
										toCsv(selected, shipmentCsvColumns(t)),
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
										to="/app/shipments/$shipmentId"
										params={{ shipmentId: row.id }}
									>
										{t("common.open")}
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										copyToClipboard(row.reference, {
											done: t("table.copied"),
											failed: t("table.copyFailed"),
										})
									}
								>
									{t("shipments.copyReference")}
								</DropdownMenuItem>
							</>
						)}
						pageSize={PAGE_SIZE}
						noResults={t("shipments.noResults")}
					/>
				</>
			)}
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// The tabs, the toolbar, and the rows in their final sizes while the rows load.
function ShipmentsTableSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-9 w-full max-w-md" />
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-full sm:max-w-sm" />
				<Skeleton className="h-9 w-24" />
				<Skeleton className="h-9 w-24" />
			</div>
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14 w-full" />
				))}
			</div>
		</div>
	);
}

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ShipmentsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<ShipmentsTableSkeleton />
		</div>
	);
}

/** Error state of the list and of the shipment page when a loader fails. Try again runs the loader again. */
export function ShipmentsPageError() {
	const { t } = useT();
	return <LoadError message={t("shipments.loadError")} />;
}
