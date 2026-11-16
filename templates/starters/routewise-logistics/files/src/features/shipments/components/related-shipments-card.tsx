// The newest other shipments of the same customer, as a small table.
// The shipment page renders it under the timeline. Each reference opens that shipment.
import { Link } from "@tanstack/react-router";
import {
	DueLabel,
	fillMessage,
	isOpenStatus,
	ShipmentStatusBadge,
	weightFormat,
} from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { ShipmentDetail } from "../api/shipments.queries";

type RelatedShipmentsCardProps = {
	shipment: ShipmentDetail;
};

/** A customer with no other shipment shows one muted sentence in place of the table. */
export function RelatedShipmentsCard({ shipment }: RelatedShipmentsCardProps) {
	const { t, locale } = useT();
	const weight = weightFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{fillMessage(t("shipment.related"), {
						customer: shipment.customerName,
					})}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{shipment.related.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("shipment.noRelated")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("shipments.shipment")}</TableHead>
								{/* A phone hides the booking day, so the weight is not cut at the edge. */}
								<TableHead className="max-sm:hidden">
									{t("shipment.booked")}
								</TableHead>
								<TableHead>{t("shipments.due")}</TableHead>
								<TableHead>{t("shipments.status")}</TableHead>
								<TableHead className="text-end">
									{t("shipments.weight")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{shipment.related.map((other) => (
								<TableRow key={other.id}>
									<TableCell>
										{/* The padding gives the link a touch area of 44 px. The negative margin keeps the row height. */}
										<Link
											to="/app/shipments/$shipmentId"
											params={{ shipmentId: other.id }}
											className="-my-3 inline-block py-3 font-semibold tabular-nums hover:underline"
										>
											{other.reference}
										</Link>
									</TableCell>
									<TableCell className="tabular-nums max-sm:hidden">
										{date.format(new Date(other.bookedAt))}
									</TableCell>
									<TableCell>
										<DueLabel
											dueAt={other.dueAt}
											lateDays={other.lateDays}
											isOpen={isOpenStatus(other.status)}
										/>
									</TableCell>
									<TableCell>
										<ShipmentStatusBadge status={other.status} />
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{weight.format(other.weightKg)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
