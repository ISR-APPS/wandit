// One vehicle of the fleet board: its number, status, driver, load of today, and the three workshop figures.
// FleetPage renders one card per vehicle. A click on the card opens the vehicle panel.
import { SteeringWheelIcon } from "@phosphor-icons/react";
import {
	distanceFormat,
	fillMessage,
	percentFormat,
	pluralForm,
	VEHICLE_STATUS_BADGE,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { Vehicle } from "../api/vehicles.queries";
import { ServiceLabel } from "./service-label";

type VehicleCardProps = {
	vehicle: Vehicle;
	/** Opens the panel of this vehicle. */
	onOpen: () => void;
};

/** The whole card is one button: a stretched button covers it, so the card content stays plain markup. */
export function VehicleCard({ vehicle, onOpen }: VehicleCardProps) {
	const { t, locale } = useT();
	const weight = weightFormat(locale);
	const number = new Intl.NumberFormat(locale);
	return (
		<Card className="relative h-full gap-4 py-4 transition-colors focus-within:border-ring hover:bg-accent/50">
			<div className="flex items-start justify-between gap-3 px-4">
				<div className="grid gap-0.5">
					<h2 className="font-(--heading-weight) font-display text-2xl tabular-nums leading-none tracking-(--heading-tracking)">
						{vehicle.unit}
					</h2>
					<p className="text-muted-foreground text-xs tabular-nums">
						{`${t(`vehicleKind.${vehicle.kind}`)} · ${vehicle.plate}`}
					</p>
				</div>
				<Badge variant={VEHICLE_STATUS_BADGE[vehicle.status]}>
					{t(`vehicleStatus.${vehicle.status}`)}
				</Badge>
			</div>
			<div className="grid flex-1 content-start gap-3 px-4 text-sm">
				<p className="flex items-center gap-2">
					<SteeringWheelIcon className="size-4 shrink-0 text-muted-foreground" />
					{vehicle.driverName ? (
						<span className="truncate font-medium">{vehicle.driverName}</span>
					) : (
						<span className="text-muted-foreground">{t("fleet.noDriver")}</span>
					)}
				</p>
				{vehicle.workshopNote ? (
					<p className="rounded-md border border-warning/25 bg-warning/12 px-3 py-2 text-warning text-xs">
						{vehicle.workshopNote}
					</p>
				) : (
					<div className="grid gap-1.5">
						<div className="flex items-baseline justify-between gap-2 text-xs">
							<span className="text-muted-foreground">
								{vehicle.stopCount > 0
									? fillMessage(t("fleet.loadLine"), {
											pallets: number.format(vehicle.loadPallets),
											spaces: number.format(vehicle.palletSpaces),
											stops: fillMessage(
												t(
													`load.stops.${pluralForm(vehicle.stopCount, locale)}`,
												),
												{ count: number.format(vehicle.stopCount) },
											),
										})
									: t("fleet.noLoad")}
							</span>
							<span className="font-medium tabular-nums">
								{percentFormat(locale).format(
									vehicle.loadKg / vehicle.capacityKg,
								)}
							</span>
						</div>
						<Progress
							value={vehicle.loadKg}
							max={vehicle.capacityKg}
							aria-label={t("fleet.payload")}
						/>
						<p className="text-muted-foreground text-xs tabular-nums">
							{fillMessage(t("fleet.payloadOf"), {
								weight: weight.format(vehicle.loadKg),
								capacity: weight.format(vehicle.capacityKg),
							})}
						</p>
					</div>
				)}
			</div>
			<dl className="grid grid-cols-3 gap-2 border-t px-4 pt-3 text-xs">
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground">{t("fleet.odometer")}</dt>
					<dd className="font-medium tabular-nums">
						{distanceFormat(locale).format(vehicle.odometerKm)}
					</dd>
				</div>
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground">{t("fleet.fuel")}</dt>
					<dd className="font-medium tabular-nums">
						{percentFormat(locale).format(vehicle.fuelPercent / 100)}
					</dd>
				</div>
				<div className="grid gap-0.5">
					<dt className="text-muted-foreground">{t("fleet.service")}</dt>
					<dd>
						<ServiceLabel
							serviceDueAt={vehicle.serviceDueAt}
							serviceInDays={vehicle.serviceInDays}
						/>
					</dd>
				</div>
			</dl>
			<button
				type="button"
				onClick={onOpen}
				className="absolute inset-0 rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				aria-label={fillMessage(t("fleet.openVehicle"), { unit: vehicle.unit })}
			/>
		</Card>
	);
}
