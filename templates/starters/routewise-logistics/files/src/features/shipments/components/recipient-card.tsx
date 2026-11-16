// The recipient of one shipment: the company, the contact, the address, and the note for the driver.
// The shipment page renders it in its side column.
import { MapPinIcon, PhoneIcon } from "@phosphor-icons/react";
import { PersonAvatar } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { ShipmentDetail } from "../api/shipments.queries";

type RecipientCardProps = {
	shipment: ShipmentDetail;
};

/** The phone number is plain text: the sample numbers are not real. */
export function RecipientCard({ shipment }: RecipientCardProps) {
	const { t } = useT();
	const { recipient } = shipment;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("shipment.recipient")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4 text-sm">
				<div className="flex items-center gap-3">
					<PersonAvatar name={recipient.contactName} className="size-10" />
					<div className="grid min-w-0">
						<p className="truncate font-medium">{recipient.contactName}</p>
						<p className="truncate text-muted-foreground text-xs">
							{shipment.customerName}
						</p>
					</div>
				</div>
				<dl className="grid gap-2">
					<div className="flex items-start gap-2">
						<dt>
							<MapPinIcon
								className="mt-0.5 size-4 text-muted-foreground"
								role="img"
								aria-hidden={false}
								aria-label={t("shipment.address")}
							/>
						</dt>
						<dd>
							{recipient.street}
							<br />
							{shipment.destination}
						</dd>
					</div>
					<div className="flex items-center gap-2">
						<dt>
							<PhoneIcon
								className="size-4 text-muted-foreground"
								role="img"
								aria-hidden={false}
								aria-label={t("shipment.phone")}
							/>
						</dt>
						<dd className="tabular-nums">{recipient.phone}</dd>
					</div>
				</dl>
				<div className="grid gap-1 rounded-md bg-muted p-3">
					<p className="label-text text-muted-foreground text-xs">
						{t("shipment.deliveryNote")}
					</p>
					<p>{recipient.deliveryNote}</p>
				</div>
			</CardContent>
		</Card>
	);
}
