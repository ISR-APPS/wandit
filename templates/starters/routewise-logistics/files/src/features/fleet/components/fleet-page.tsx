// The fleet board behind login: four figures of today, the status tabs, and one card per vehicle.
// The /app/fleet route renders it after its loader. The route also uses the skeleton and the error below.
// A click on a card opens the vehicle panel at the side.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	FigureStrip,
	fillMessage,
	LoadError,
	percentFormat,
	pluralForm,
	StatusTabs,
	VEHICLE_STATUSES,
	type VehicleStatus,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Card } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { vehiclesQueryOptions } from "../api/vehicles.queries";
import { SERVICE_SOON_DAYS } from "../lib/service";
import { VehicleCard } from "./vehicle-card";
import { VehicleSheet } from "./vehicle-sheet";

/** The fleet page. The status tab filters the cards. The panel state keeps the vehicle id while the panel closes. */
export function FleetPage() {
	const { t, locale } = useT();
	const { data: vehicles } = useSuspenseQuery(vehiclesQueryOptions());
	const [status, setStatus] = useState<VehicleStatus | "all">("all");
	const [panel, setPanel] = useState<{ vehicleId: string; isOpen: boolean }>({
		vehicleId: "",
		isOpen: false,
	});

	const number = new Intl.NumberFormat(locale);
	const weight = weightFormat(locale);
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

	const tabs = VEHICLE_STATUSES.map((value) => ({
		value,
		label: t(`vehicleStatus.${value}`),
		count: vehicles.filter((vehicle) => vehicle.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const shown =
		activeStatus === "all"
			? vehicles
			: vehicles.filter((vehicle) => vehicle.status === activeStatus);

	return (
		<div className="grid @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("fleet.title")}
				description={fillMessage(t("fleet.summary"), {
					total: number.format(vehicles.length),
					loaded: number.format(loaded.length),
				})}
			/>
			{/* py-0 and gap-0 replace the padding of the kit Card, so the cells touch the panel edges. */}
			<Card className="gap-0 overflow-hidden py-0">
				<FigureStrip
					className="@3xl/main:grid-cols-4 grid-cols-2"
					figures={[
						{
							id: "with-load",
							label: t("fleet.figures.withLoad"),
							value: number.format(loaded.length),
							detail: fillMessage(t("fleet.figures.withLoadDetail"), {
								total: number.format(vehicles.length),
							}),
						},
						{
							id: "payload",
							label: t("fleet.figures.payload"),
							value: weight.format(loadKg),
							detail: fillMessage(t("fleet.figures.payloadDetail"), {
								stops: fillMessage(
									t(`load.stops.${pluralForm(stopCount, locale)}`),
									{ count: number.format(stopCount) },
								),
							}),
						},
						{
							id: "capacity-used",
							label: t("fleet.figures.capacityUsed"),
							value:
								loadedCapacityKg > 0
									? percentFormat(locale).format(loadKg / loadedCapacityKg)
									: percentFormat(locale).format(0),
							detail: t("fleet.figures.capacityUsedDetail"),
						},
						{
							id: "service-soon",
							label: t("fleet.figures.serviceSoon"),
							value: number.format(serviceSoonCount),
							detail: fillMessage(t("fleet.figures.serviceSoonDetail"), {
								days: number.format(SERVICE_SOON_DAYS),
							}),
						},
					]}
				/>
			</Card>
			<StatusTabs
				value={activeStatus}
				onValueChange={setStatus}
				allLabel={t("fleet.all")}
				allCount={vehicles.length}
				tabs={tabs}
			/>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 @7xl/main:grid-cols-4 grid-cols-1 gap-4">
				{shown.map((vehicle) => (
					<VehicleCard
						key={vehicle.id}
						vehicle={vehicle}
						onOpen={() => setPanel({ vehicleId: vehicle.id, isOpen: true })}
					/>
				))}
			</div>
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

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the fleet loader runs. The route sets it as pendingComponent. */
export function FleetPageSkeleton() {
	return (
		<div className="grid @3xl/main:gap-6 gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<Skeleton className="h-24 w-full" />
			<Skeleton className="h-9 w-full max-w-md" />
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 @7xl/main:grid-cols-4 grid-cols-1 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-56" />
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
