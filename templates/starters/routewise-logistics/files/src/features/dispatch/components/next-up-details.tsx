// The lower part of the "Next up" panel: the steps of the shipment and the recipient with the note for the driver.
// NextUpCard renders it under the key facts. It reads the shipment detail query, with its own loading and error states.
import { PhoneIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { ShipmentProgress, shipmentQueryOptions } from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";

type NextUpDetailsProps = {
	/** The id of the "Next up" shipment. The detail query reads its steps and its recipient. */
	shipmentId: string;
};

/** The dispatcher sees where the shipment waits and whom to call, without a click. */
export function NextUpDetails({ shipmentId }: NextUpDetailsProps) {
	const { t } = useT();
	const detail = useQuery(shipmentQueryOptions(shipmentId));
	if (detail.isError) {
		return (
			<p className="text-destructive text-sm" role="alert">
				{t("dispatch.detailError")}
			</p>
		);
	}
	if (detail.data === undefined) {
		return (
			<div className="grid gap-3">
				<Skeleton className="h-44 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}
	// The query answers null for an unknown id. The queue gives a known id, so this is only a guard.
	if (detail.data === null) {
		return null;
	}
	const { recipient } = detail.data;
	return (
		<div className="grid gap-5">
			<ShipmentProgress shipment={detail.data} />
			<div className="grid gap-1.5 rounded-md border p-3 text-sm">
				<p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<span className="font-medium">{recipient.contactName}</span>
					<span className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
						<PhoneIcon
							className="size-3.5"
							role="img"
							aria-hidden={false}
							aria-label={t("shipment.phone")}
						/>
						{recipient.phone}
					</span>
				</p>
				<p className="text-muted-foreground text-xs">
					{recipient.deliveryNote}
				</p>
			</div>
		</div>
	);
}
