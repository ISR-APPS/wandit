// The side panel of one vehicle: its facts, the workshop note, and the open load of today.
// FleetPage opens it from a vehicle card. The load is read on open, with its own loading and error states.
import { useQuery } from "@tanstack/react-query";
import {
	distanceFormat,
	fillMessage,
	percentFormat,
	VEHICLE_STATUS_BADGE,
	weightFormat,
} from "~/features/logistics";
import { openLoadQueryOptions, ShipmentSlipList } from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { Skeleton } from "~/shared/ui/skeleton";
import type { Vehicle } from "../api/vehicles.queries";
import { ServiceLabel } from "./service-label";

type VehicleSheetProps = {
	/** The vehicle to show. It stays set while the panel closes, so the content does not empty during the slide. */
	vehicle: Vehicle | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled panel at the end side. On a phone it takes the full width. */
export function VehicleSheet({
	vehicle,
	open,
	onOpenChange,
}: VehicleSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{vehicle ? <VehiclePanel vehicle={vehicle} /> : null}
			</SheetContent>
		</Sheet>
	);
}

// The content of the panel. A separate component, so the load query runs only for an open vehicle.
function VehiclePanel({ vehicle }: { vehicle: Vehicle }) {
	const { t, locale } = useT();
	const load = useQuery(
		openLoadQueryOptions({ kind: "vehicle", vehicleId: vehicle.id }),
	);
	const weight = weightFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const facts = [
		{ label: t("fleet.plate"), value: vehicle.plate },
		{ label: t("fleet.depot"), value: vehicle.depotName },
		{
			label: t("fleet.driverToday"),
			value: vehicle.driverName ?? t("fleet.noDriver"),
		},
		{
			label: t("fleet.capacity"),
			value: fillMessage(t("fleet.capacityValue"), {
				weight: weight.format(vehicle.capacityKg),
				spaces: number.format(vehicle.palletSpaces),
			}),
		},
		{
			label: t("fleet.odometer"),
			value: distanceFormat(locale).format(vehicle.odometerKm),
		},
		{
			label: t("fleet.fuel"),
			value: percentFormat(locale).format(vehicle.fuelPercent / 100),
		},
		{
			label: t("fleet.lastInspection"),
			value: date.format(new Date(vehicle.lastInspectionAt)),
		},
	];
	return (
		<>
			<SheetHeader className="gap-2 border-b pe-12">
				<div className="flex flex-wrap items-center gap-3">
					<SheetTitle className="font-(--heading-weight) font-display text-2xl tabular-nums tracking-(--heading-tracking)">
						{vehicle.unit}
					</SheetTitle>
					<Badge variant={VEHICLE_STATUS_BADGE[vehicle.status]}>
						{t(`vehicleStatus.${vehicle.status}`)}
					</Badge>
				</div>
				<SheetDescription>{t(`vehicleKind.${vehicle.kind}`)}</SheetDescription>
			</SheetHeader>
			<div className="grid gap-6 p-4">
				{vehicle.workshopNote ? (
					<p className="rounded-md border border-warning/25 bg-warning/12 px-3 py-2 text-sm text-warning">
						{vehicle.workshopNote}
					</p>
				) : null}
				<dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
					{facts.map((fact) => (
						<div key={fact.label} className="grid gap-1">
							<dt className="text-muted-foreground text-xs">{fact.label}</dt>
							<dd className="font-medium tabular-nums">{fact.value}</dd>
						</div>
					))}
					<div className="grid gap-1">
						<dt className="text-muted-foreground text-xs">
							{t("fleet.nextService")}
						</dt>
						<dd className="tabular-nums">
							<ServiceLabel
								serviceDueAt={vehicle.serviceDueAt}
								serviceInDays={vehicle.serviceInDays}
							/>
							<span className="text-muted-foreground">
								{` · ${date.format(new Date(vehicle.serviceDueAt))}`}
							</span>
						</dd>
					</div>
				</dl>
				<section className="grid gap-3">
					<div className="flex items-baseline justify-between gap-3">
						<h3 className="font-semibold text-sm">{t("fleet.loadToday")}</h3>
						<p className="text-muted-foreground text-xs tabular-nums">
							{fillMessage(t("fleet.payloadOf"), {
								weight: weight.format(vehicle.loadKg),
								capacity: weight.format(vehicle.capacityKg),
							})}
						</p>
					</div>
					{load.isError ? (
						<p className="text-destructive text-sm" role="alert">
							{t("fleet.loadError")}
						</p>
					) : load.data === undefined ? (
						<div className="grid gap-2">
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					) : load.data.length === 0 ? (
						<p className="text-muted-foreground text-sm">{t("fleet.noLoad")}</p>
					) : (
						<ShipmentSlipList shipments={load.data} />
					)}
				</section>
			</div>
		</>
	);
}
