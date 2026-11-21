// The service progress of one check: the steps done of the 5 steps of a meal, as a bar and a percent.
// OrderDetailPage renders it under the check card, in the place of the kit "complete your profile" card.
// A void stops the service, so its bar shows the steps done before the void.
import type { Order } from "~/features/restaurant";
import { fillMessage } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

// Opened, sent, served, bill printed, paid.
const SERVICE_STEPS = 5;

type ServiceProgressCardProps = {
	order: Order;
};

/** The opened and sent steps are always done: a check exists only after its first ticket. */
export function ServiceProgressCard({ order }: ServiceProgressCardProps) {
	const { t, locale } = useT();
	const done = [
		order.openedAt,
		order.sentAt,
		order.servedAt,
		order.billAt,
		order.paidAt,
	].filter((at) => at !== null).length;
	const percent = new Intl.NumberFormat(locale, { style: "percent" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orderDetail.serviceProgress")}</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={done}
					max={SERVICE_STEPS}
					aria-label={fillMessage(t("orderDetail.stepsDone"), {
						done: String(done),
						total: String(SERVICE_STEPS),
					})}
				/>
				<span className="text-muted-foreground text-sm tabular-nums">
					{percent.format(done / SERVICE_STEPS)}
				</span>
			</CardContent>
		</Card>
	);
}
