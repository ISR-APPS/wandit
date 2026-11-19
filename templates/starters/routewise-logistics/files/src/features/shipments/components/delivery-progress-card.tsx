// The delivery progress of one shipment: a bar and a percent of the four steps (booked, assigned, picked up, closed).
// ShipmentDetailPage renders it under the profile card. A failed delivery closes the path too, so it shows full.
import { fillMessage, percentFormat } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { ShipmentDetail } from "../api/shipments.queries";

type DeliveryProgressCardProps = {
	shipment: ShipmentDetail;
};

/** Each step with a time counts. The description gives the count of the steps done. */
export function DeliveryProgressCard({ shipment }: DeliveryProgressCardProps) {
	const { t, locale } = useT();
	const steps = [
		shipment.bookedAt,
		shipment.assignedAt,
		shipment.pickedUpAt,
		shipment.closedAt,
	];
	const doneCount = steps.filter((step) => step !== null).length;
	const share = doneCount / steps.length;
	const number = new Intl.NumberFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("shipment.progressTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("shipment.progressSteps"), {
						done: number.format(doneCount),
						total: number.format(steps.length),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={doneCount}
					max={steps.length}
					aria-label={t("shipment.progressTitle")}
				/>
				<span className="text-muted-foreground text-sm tabular-nums">
					{percentFormat(locale).format(share)}
				</span>
			</CardContent>
		</Card>
	);
}
