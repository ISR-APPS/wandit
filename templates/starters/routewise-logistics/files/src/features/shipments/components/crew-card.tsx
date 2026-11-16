// The driver and the vehicle of one shipment, and the share of the payload that this load takes.
// The shipment page renders it in its side column. A shipment with no driver shows one sentence.
import { TruckIcon } from "@phosphor-icons/react";
import {
	fillMessage,
	PersonAvatar,
	percentFormat,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Separator } from "~/shared/ui/separator";
import type { ShipmentDetail } from "../api/shipments.queries";

type CrewCardProps = {
	shipment: ShipmentDetail;
};

/** The payload bar compares the weight of this shipment with the largest payload of the vehicle. */
export function CrewCard({ shipment }: CrewCardProps) {
	const { t, locale } = useT();
	const { driver, vehicle } = shipment;
	const weight = weightFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("shipment.crew")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 text-sm">
				{driver && vehicle && shipment.driverName ? (
					<>
						<div className="flex items-center gap-3">
							<PersonAvatar name={shipment.driverName} className="size-10" />
							<div className="grid min-w-0">
								<p className="truncate font-medium">{shipment.driverName}</p>
								<p className="text-muted-foreground text-xs tabular-nums">
									{`${fillMessage(t("shipment.licence"), { licence: driver.licenceClass })} · ${driver.phone}`}
								</p>
							</div>
						</div>
						<Separator />
						<div className="flex items-center gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
								<TruckIcon className="size-5" />
							</span>
							<div className="grid min-w-0">
								<p className="font-medium">
									{`${shipment.vehicleUnit} · ${t(`vehicleKind.${vehicle.kind}`)}`}
								</p>
								<p className="text-muted-foreground text-xs tabular-nums">
									{vehicle.plate}
								</p>
							</div>
						</div>
						<div className="grid gap-1.5">
							<div className="flex items-baseline justify-between gap-2 text-xs">
								<span className="text-muted-foreground">
									{t("shipment.payloadShare")}
								</span>
								<span className="font-medium tabular-nums">
									{percentFormat(locale).format(
										shipment.weightKg / vehicle.capacityKg,
									)}
								</span>
							</div>
							<Progress
								value={shipment.weightKg}
								max={vehicle.capacityKg}
								aria-label={t("shipment.payloadShare")}
							/>
							<p className="text-muted-foreground text-xs tabular-nums">
								{fillMessage(t("shipment.payloadOf"), {
									weight: weight.format(shipment.weightKg),
									capacity: weight.format(vehicle.capacityKg),
								})}
							</p>
						</div>
					</>
				) : (
					<div className="grid gap-1">
						<p className="font-medium">{t("shipment.noCrew")}</p>
						<p className="text-muted-foreground">
							{fillMessage(t("shipment.needs"), {
								weight: weight.format(shipment.weightKg),
								pallets: new Intl.NumberFormat(locale).format(shipment.pallets),
							})}
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
