// The shipment list behind login: the page header with the period, the status tabs, and the searchable table.
// The /app/shipments route renders it after its loader. The route also uses the skeleton and the error below.
// The period changes the query key, so the page reads with useQuery and keeps the old rows while the new ones load.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DueLabel,
	dayCountFormat,
	fillMessage,
	isOpenStatus,
	LoadError,
	PERIOD_DAYS,
	type PeriodDays,
	pluralForm,
	SHIPMENT_STATUSES,
	type ShipmentStatus,
	ShipmentStatusBadge,
	StatusTabs,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Shipment, shipmentsQueryOptions } from "../api/shipments.queries";

/** The period of the first load, in days. The route loader prefetches the list of this period. */
export const SHIPMENTS_DEFAULT_DAYS: PeriodDays = 30;

/** The list page. The status tab filters the rows; then DataTable searches, sorts, and pages them. */
export function ShipmentsPage() {
	const { t, locale } = useT();
	const [days, setDays] = useState<PeriodDays>(SHIPMENTS_DEFAULT_DAYS);
	const [status, setStatus] = useState<ShipmentStatus | "all">("all");
	// The loader fills the default period. A new period keeps the old rows on screen while the new rows load,
	// so this page does not use useSuspenseQuery.
	const { data: shipments, isError } = useQuery({
		...shipmentsQueryOptions(days),
		placeholderData: keepPreviousData,
	});

	const number = new Intl.NumberFormat(locale);
	const weight = weightFormat(locale);
	const dayCount = dayCountFormat(locale);
	const rowsOfPeriod = shipments ?? [];
	const openCount = rowsOfPeriod.filter((row) =>
		isOpenStatus(row.status),
	).length;
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
	const rows =
		activeStatus === "all"
			? rowsOfPeriod
			: rowsOfPeriod.filter((row) => row.status === activeStatus);

	// Status and Due come before the place and the driver. A phone shows only the first three columns (see the Card below).
	const columns: DataTableColumn<Shipment>[] = [
		{
			id: "reference",
			header: t("shipments.shipment"),
			sortValue: (row) => row.reference,
			cell: (row) => (
				<div className="grid justify-items-start">
					{/* The padding gives the link a touch area of 44 px. The negative margin keeps the row height. */}
					<Link
						to="/app/shipments/$shipmentId"
						params={{ shipmentId: row.id }}
						className="-my-3 py-3 font-semibold tabular-nums hover:underline"
					>
						{row.reference}
					</Link>
					{/* A phone truncates a long customer name, so Status and Due fit beside it. */}
					<span className="max-w-28 truncate text-muted-foreground text-xs sm:max-w-none">
						{row.customerName}
					</span>
				</div>
			),
		},
		{
			id: "status",
			header: t("shipments.status"),
			sortValue: (row) => SHIPMENT_STATUSES.indexOf(row.status),
			cell: (row) => <ShipmentStatusBadge status={row.status} />,
		},
		{
			id: "due",
			header: t("shipments.due"),
			sortValue: (row) => Date.parse(row.dueAt),
			cell: (row) => (
				<DueLabel
					dueAt={row.dueAt}
					lateDays={row.lateDays}
					isOpen={isOpenStatus(row.status)}
				/>
			),
		},
		{
			id: "destination",
			header: t("shipments.destination"),
			sortValue: (row) => row.destination,
			cell: (row) => (
				<div className="grid">
					<span>{row.destination}</span>
					<span className="text-muted-foreground text-xs">
						{fillMessage(t("shipments.fromDepot"), { depot: row.depotName })}
					</span>
				</div>
			),
		},
		{
			id: "driver",
			header: t("shipments.driver"),
			sortValue: (row) => row.driverName ?? "",
			cell: (row) =>
				row.driverName ? (
					<div className="grid">
						<span>{row.driverName}</span>
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
			id: "weight",
			header: t("shipments.weight"),
			align: "end",
			sortValue: (row) => row.weightKg,
			cell: (row) => (
				<div className="grid">
					<span>{weight.format(row.weightKg)}</span>
					<span className="text-muted-foreground text-xs">
						{fillMessage(t(`load.pallets.${pluralForm(row.pallets, locale)}`), {
							count: number.format(row.pallets),
						})}
					</span>
				</div>
			),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("shipments.title")}
				description={fillMessage(t("shipments.summary"), {
					open: number.format(openCount),
					closed: number.format(rowsOfPeriod.length - openCount),
					days: dayCount.format(days),
				})}
				actions={
					<Select
						value={String(days)}
						onValueChange={(value) =>
							setDays(
								PERIOD_DAYS.find((option) => String(option) === value) ??
									SHIPMENTS_DEFAULT_DAYS,
							)
						}
					>
						<SelectTrigger
							className="w-auto max-md:min-h-11"
							aria-label={t("shipments.period")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{PERIOD_DAYS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{fillMessage(t("chart.lastDays"), {
										days: dayCount.format(option),
									})}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
			{isError ? (
				<LoadError message={t("shipments.loadError")} />
			) : shipments === undefined ? (
				<ShipmentsTableSkeleton />
			) : (
				<Card>
					{/* DataTable has no column classes, so this selector hides the cells after Due below sm. Then no column is cut at the edge. */}
					{/* The smaller side padding on a phone gives the Due column room for "2 days late". */}
					<CardContent className="max-sm:px-3 max-sm:[&_:is(th,td):nth-child(n+4)]:hidden">
						<DataTable
							rows={rows}
							columns={columns}
							searchText={(row) =>
								`${row.reference} ${row.customerName} ${row.destination} ${row.driverName ?? ""} ${row.vehicleUnit ?? ""}`
							}
							noResults={t("shipments.noResults")}
							toolbar={
								<StatusTabs
									value={activeStatus}
									onValueChange={setStatus}
									allLabel={t("shipments.all")}
									allCount={rowsOfPeriod.length}
									tabs={tabs}
								/>
							}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// The table panel while its rows load: the toolbar and the rows in their final sizes.
function ShipmentsTableSkeleton() {
	return (
		<Card>
			<CardContent className="grid gap-3">
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					<Skeleton className="h-9 w-full max-w-md" />
				</div>
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</CardContent>
		</Card>
	);
}

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function ShipmentsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-36" />
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
