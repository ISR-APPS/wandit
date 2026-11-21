// The people and the vehicle of one shipment: the recipient, the driver, and the vehicle, one row each with an action.
// ShipmentDetailPage renders it beside the related shipments. A call action is a tel: link; the vehicle row opens the fleet.
// A shipment with no driver yet shows the recipient row and one muted sentence.
import { TruckIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fillMessage, PersonAvatar, telHref } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { ShipmentDetail } from "../api/shipments.queries";

type ContactsCardProps = {
	shipment: ShipmentDetail;
};

/** The recipient call is the main action, so it is the filled button. */
export function ContactsCard({ shipment }: ContactsCardProps) {
	const { t } = useT();
	const { driver, vehicle } = shipment;
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("shipment.contacts")}</CardTitle>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								asChild
								variant="outline"
								size="icon"
								aria-label={t("drivers.title")}
							>
								<Link to="/app/drivers">
									<CaretRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t("drivers.title")}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			{/* Equal rows stretch to the height of the related shipments card beside it, so no empty band shows. */}
			<CardContent className="grid flex-1 auto-rows-fr gap-4">
				<ContactRow
					mark={
						<PersonAvatar
							name={shipment.recipient.contactName}
							className="size-10"
						/>
					}
					name={shipment.recipient.contactName}
					detail={t("shipment.recipient")}
					action={
						<Button asChild size="sm">
							<a href={telHref(shipment.recipient.phone)}>
								{t("shipment.call")}
							</a>
						</Button>
					}
				/>
				{driver && shipment.driverName ? (
					<ContactRow
						mark={
							<PersonAvatar name={shipment.driverName} className="size-10" />
						}
						name={shipment.driverName}
						detail={fillMessage(t("shipment.licence"), {
							licence: driver.licenceClass,
						})}
						action={
							<Button asChild size="sm" variant="outline">
								<a href={telHref(driver.phone)}>{t("shipment.call")}</a>
							</Button>
						}
					/>
				) : (
					<p className="text-muted-foreground text-sm">
						{t("shipment.noCrew")}
					</p>
				)}
				{vehicle && shipment.vehicleUnit ? (
					<ContactRow
						mark={
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
								<TruckIcon className="size-5" />
							</span>
						}
						name={`${shipment.vehicleUnit} · ${t(`vehicleKind.${vehicle.kind}`)}`}
						detail={vehicle.plate}
						action={
							<Button asChild size="sm" variant="outline">
								<Link to="/app/fleet">{t("fleet.title")}</Link>
							</Button>
						}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}

type ContactRowProps = {
	/** The round mark at the start: initials or an icon. */
	mark: ReactNode;
	name: string;
	/** One muted line under the name, for example the role or the plate. */
	detail: string;
	/** One button at the end of the row. */
	action: ReactNode;
};

// One row: the mark, the name and its detail, and the action at the end.
function ContactRow({ mark, name, detail, action }: ContactRowProps) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div className="flex min-w-0 items-center gap-4">
				{mark}
				<div className="grid min-w-0">
					<p className="truncate font-medium">{name}</p>
					<p className="truncate text-muted-foreground text-xs tabular-nums">
						{detail}
					</p>
				</div>
			</div>
			{action}
		</div>
	);
}
