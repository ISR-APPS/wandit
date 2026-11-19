// The handling marks of one shipment as small outline badges: service, pallets, vehicle kind, licence, and problem.
// ShipmentDetailPage renders it under the progress card. A mark shows only when the shipment has its value.
import { fillMessage, pluralForm } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { ShipmentDetail } from "../api/shipments.queries";

type HandlingCardProps = {
	shipment: ShipmentDetail;
};

/** The marks wrap on a narrow column. A delay or failure reason is the last mark. */
export function HandlingCard({ shipment }: HandlingCardProps) {
	const { t, locale } = useT();
	const marks = [
		t(`serviceLevel.${shipment.service}`),
		fillMessage(t(`load.pallets.${pluralForm(shipment.pallets, locale)}`), {
			count: new Intl.NumberFormat(locale).format(shipment.pallets),
		}),
		shipment.vehicle ? t(`vehicleKind.${shipment.vehicle.kind}`) : null,
		shipment.driver
			? fillMessage(t("shipment.licence"), {
					licence: shipment.driver.licenceClass,
				})
			: null,
		shipment.exceptionReason
			? t(`exceptionReason.${shipment.exceptionReason}`)
			: null,
	].filter((mark) => mark !== null);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("shipment.handling")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-wrap gap-2">
					{marks.map((mark) => (
						<li key={mark}>
							<Badge variant="outline">{mark}</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
