// The fleet list behind login, in the kit product list layout: the header, four figure cards, then the record table.
// The /app/fleet route renders it after its loader. The route also uses the skeleton and the error below.
// A click on a vehicle name, or "Open" in the row menu, opens the vehicle panel at the side.
import {
	DownloadSimpleIcon,
	GasPumpIcon,
	TruckIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	fillMessage,
	LoadError,
	percentFormat,
	pluralForm,
	toCsv,
	VEHICLE_KINDS,
	VEHICLE_STATUS_BADGE,
	VEHICLE_STATUSES,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { Progress } from "~/shared/ui/progress";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { type Vehicle, vehiclesQueryOptions } from "../api/vehicles.queries";
import { SERVICE_SOON_DAYS } from "../lib/service";
import { vehicleCsvColumns } from "../lib/vehicle-csv";
import { FleetStatCard } from "./fleet-stat-card";
import { VehicleSheet } from "./vehicle-sheet";

// Ten rows per page, as the product list of the kit.
const PAGE_SIZE = 10;

/** The fleet page. The three filters narrow the rows; then RecordTable searches, sorts, and pages them. */
export function FleetPage() {
	const { t, locale } = useT();
	const { data: vehicles } = useSuspenseQuery(vehiclesQueryOptions());
	const [status, setStatus] = useState<string | null>(null);
	const [kind, setKind] = useState<string | null>(null);
	const [depot, setDepot] = useState<string | null>(null);
	const [panel, setPanel] = useState<{ vehicleId: string; isOpen: boolean }>({
		vehicleId: "",
		isOpen: false,
	});

	const number = new Intl.NumberFormat(locale);
	const weight = weightFormat(locale);
	const percent = percentFormat(locale);
	const loaded = vehicles.filter((vehicle) => vehicle.stopCount > 0);
	const loadKg = loaded.reduce((sum, vehicle) => sum + vehicle.loadKg, 0);
	const loadedCapacityKg = loaded.reduce(
		(sum, vehicle) => sum + vehicle.capacityKg,
		0,
	);
	const stopCount = loaded.reduce((sum, vehicle) => sum + vehicle.stopCount, 0);
	const serviceSoonCount = vehicles.filter(
		(vehicle) => vehicle.serviceInDays <= SERVICE_SOON_DAYS,
	).length;
	const depotNames = [...new Set(vehicles.map((row) => row.depotName))].sort(
		(first, second) => first.localeCompare(second, locale),
	);
	const rows = vehicles.filter(
		(row) =>
			(status === null || row.status === status) &&
			(kind === null || row.kind === kind) &&
			(depot === null || row.depotName === depot),
	);
	const openPanel = (vehicleId: string) =>
		setPanel({ vehicleId, isOpen: true });

	const columns: RecordColumn<Vehicle>[] = [
		{
			id: "vehicle",
			header: t("fleet.vehicle"),
			sortValue: (row) => row.unit,
			cell: (row) => (
				<div className="flex items-center gap-4">
					<span
						aria-hidden="true"
						className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"
					>
						<TruckIcon className="size-5" />
					</span>
					{/* The padding gives the button a touch area of 44 px. The negative margin keeps the row height. */}
					<button
						type="button"
						className="-my-3 rounded-sm py-3 text-start outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
						onClick={() => openPanel(row.id)}
					>
						{`${row.unit} · ${t(`vehicleKind.${row.kind}`)}`}
					</button>
				</div>
			),
		},
		{
			id: "capacity",
			header: t("fleet.capacity"),
			hideable: true,
			sortValue: (row) => row.capacityKg,
			cell: (row) => (
				<span className="tabular-nums">{weight.format(row.capacityKg)}</span>
			),
		},
		{
			id: "depot",
			header: t("fleet.depot"),
			hideable: true,
			sortValue: (row) => row.depotName,
			cell: (row) => row.depotName,
		},
		{
			id: "load",
			header: t("fleet.load"),
			sortValue: (row) => row.loadKg / row.capacityKg,
			// A vehicle with no open load shows words, not an empty bar at "0%".
			cell: (row) =>
				row.stopCount === 0 ? (
					<span className="text-muted-foreground">{t("fleet.noLoad")}</span>
				) : (
					<div className="flex items-center gap-2">
						<Progress
							value={row.loadKg}
							max={row.capacityKg}
							className="h-1.5 w-16"
							aria-label={fillMessage(t("fleet.payloadOf"), {
								weight: weight.format(row.loadKg),
								capacity: weight.format(row.capacityKg),
							})}
						/>
						<span className="w-10 text-muted-foreground text-xs tabular-nums">
							{percent.format(row.loadKg / row.capacityKg)}
						</span>
					</div>
				),
		},
		{
			id: "plate",
			header: t("fleet.plate"),
			hideable: true,
			cell: (row) => <span className="tabular-nums">{row.plate}</span>,
		},
		{
			id: "fuel",
			header: t("fleet.fuel"),
			hideable: true,
			cell: (row) => (
				<span className="flex items-center gap-1 tabular-nums">
					<GasPumpIcon className="size-4 text-muted-foreground" />
					{percent.format(row.fuelPercent / 100)}
				</span>
			),
		},
		{
			id: "status",
			header: t("fleet.status"),
			sortValue: (row) => VEHICLE_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={VEHICLE_STATUS_BADGE[row.status]}>
					{t(`vehicleStatus.${row.status}`)}
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("fleet.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("fleet.csv", toCsv(rows, vehicleCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<FleetStatCard
					label={t("fleet.figures.withLoad")}
					value={number.format(loaded.length)}
					badge={fillMessage(t("fleet.figures.ofFleet"), {
						share: percent.format(
							vehicles.length === 0 ? 0 : loaded.length / vehicles.length,
						),
					})}
					badgeVariant="outline"
				/>
				<FleetStatCard
					label={t("fleet.figures.payload")}
					value={weight.format(loadKg)}
					badge={fillMessage(t(`load.stops.${pluralForm(stopCount, locale)}`), {
						count: number.format(stopCount),
					})}
					badgeVariant="outline"
				/>
				<FleetStatCard
					label={t("fleet.figures.capacityUsed")}
					// No loaded vehicle gives no share, so the value shows a dash, not "0%".
					value={
						loadedCapacityKg > 0
							? percent.format(loadKg / loadedCapacityKg)
							: "–"
					}
					badge={t("fleet.figures.capacityUsedDetail")}
					badgeVariant="outline"
				/>
				<FleetStatCard
					label={t("fleet.figures.serviceSoon")}
					value={number.format(serviceSoonCount)}
					badge={fillMessage(t("fleet.figures.serviceSoonDetail"), {
						days: number.format(SERVICE_SOON_DAYS),
					})}
					badgeVariant={serviceSoonCount > 0 ? "warning" : "outline"}
				/>
			</div>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) =>
					`${row.unit} ${row.plate} ${row.depotName} ${row.driverName ?? ""} ${t(`vehicleKind.${row.kind}`)}`
				}
				searchPlaceholder={t("fleet.search")}
				toolbar={
					<>
						<RecordFilter
							label={t("fleet.status")}
							options={VEHICLE_STATUSES.map((value) => ({
								value,
								label: t(`vehicleStatus.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("fleet.kind")}
							options={VEHICLE_KINDS.map((value) => ({
								value,
								label: t(`vehicleKind.${value}`),
							}))}
							value={kind}
							onValueChange={setKind}
						/>
						<RecordFilter
							label={t("fleet.depot")}
							options={depotNames.map((name) => ({ value: name, label: name }))}
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
								"fleet-selected.csv",
								toCsv(selected, vehicleCsvColumns(t)),
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
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.plate, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("fleet.copyPlate")}
						</DropdownMenuItem>
					</>
				)}
				pageSize={PAGE_SIZE}
				noResults={t("fleet.noResults")}
			/>
			<VehicleSheet
				vehicle={vehicles.find((vehicle) => vehicle.id === panel.vehicleId)}
				open={panel.isOpen}
				onOpenChange={(isOpen) =>
					setPanel((current) => ({ ...current, isOpen }))
				}
			/>
		</div>
	);
}

// Placeholder keys of the skeleton. Fixed keys, because the parts never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4"];
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the fleet loader runs. The route sets it as pendingComponent. */
export function FleetPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-28" />
				))}
			</div>
			<Skeleton className="h-9 w-full max-w-md" />
			<div className="grid gap-2">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state of the fleet page when its loader fails. Try again runs the loader again. */
export function FleetPageError() {
	const { t } = useT();
	return <LoadError message={t("fleet.pageError")} />;
}
