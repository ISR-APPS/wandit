// A short list of shipments as slips: the reference, the customer, the load, the due day, and the status.
// The driver panel and the vehicle panel list an open load with it. The reference opens the shipment page.
import { Link } from "@tanstack/react-router";
import {
	DueLabel,
	isOpenStatus,
	ShipmentStatusBadge,
} from "~/features/logistics";
import type { Shipment } from "../api/shipments.queries";
import { LoadText } from "./load-text";

type ShipmentSlipListProps = {
	/** The rows to list, already in the order to show. */
	shipments: Shipment[];
};

/** One bordered slip per shipment. The caller shows its own empty sentence for an empty list. */
export function ShipmentSlipList({ shipments }: ShipmentSlipListProps) {
	return (
		<ul className="grid gap-2">
			{shipments.map((shipment) => (
				<li
					key={shipment.id}
					className="grid gap-1.5 rounded-md border bg-card p-3 text-sm"
				>
					<div className="flex items-center justify-between gap-2">
						{/* The padding gives the link a touch area of 44 px. The negative margin keeps the row height. */}
						<Link
							to="/app/shipments/$shipmentId"
							params={{ shipmentId: shipment.id }}
							className="-my-3 py-3 font-semibold tabular-nums hover:underline"
						>
							{shipment.reference}
						</Link>
						<ShipmentStatusBadge status={shipment.status} />
					</div>
					<p className="truncate">
						{`${shipment.customerName} · ${shipment.destination}`}
					</p>
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-muted-foreground text-xs">
						<LoadText pallets={shipment.pallets} weightKg={shipment.weightKg} />
						<DueLabel
							dueAt={shipment.dueAt}
							lateDays={shipment.lateDays}
							isOpen={isOpenStatus(shipment.status)}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}
