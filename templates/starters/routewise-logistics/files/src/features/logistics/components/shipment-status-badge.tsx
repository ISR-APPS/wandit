// The status of a shipment as a Badge: a word and a color.
// The queue of the home, the shipment list, the shipment page, and the driver and vehicle panels render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	SHIPMENT_STATUS_BADGE,
	type ShipmentStatus,
} from "../lib/shipment-status";

type ShipmentStatusBadgeProps = {
	status: ShipmentStatus;
};

/** The label is the message `shipmentStatus.<status>`. */
export function ShipmentStatusBadge({ status }: ShipmentStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={SHIPMENT_STATUS_BADGE[status]}>
			{t(`shipmentStatus.${status}`)}
		</Badge>
	);
}
