// The newest other shipments of the same customer, as a small table: reference, status, and booking day.
// The shipment page renders it under the timeline, beside the contacts card. Each reference opens that shipment.
import { Link } from "@tanstack/react-router";
import { ShipmentStatusBadge } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
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
	const date = new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	});
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("shipment.relatedTitle")}</CardTitle>
				<CardDescription dir="auto">{shipment.customerName}</CardDescription>
			</CardHeader>
			<CardContent>
				{shipment.related.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("shipment.noRelated")}
					</p>
				) : (
					<Table>
						<TableHeader className="bg-transparent">
							<TableRow>
								<TableHead>{t("shipments.shipment")}</TableHead>
								<TableHead>{t("shipments.status")}</TableHead>
								<TableHead className="text-end">
									{t("shipment.booked")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{shipment.related.map((other) => (
								<TableRow key={other.id}>
									<TableCell>
										<Link
											to="/app/shipments/$shipmentId"
											params={{ shipmentId: other.id }}
											className="tabular-nums hover:underline"
										>
											{other.reference}
										</Link>
									</TableCell>
									<TableCell>
										<ShipmentStatusBadge status={other.status} />
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{date.format(new Date(other.bookedAt))}
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
