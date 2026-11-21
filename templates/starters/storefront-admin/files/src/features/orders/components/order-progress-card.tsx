// The progress card of the order page: one bar with the share of the timeline steps that are done.
// OrderDetailPage renders it in the side column, under the customer card. timelineOf of ~/features/shop gives the steps.
import { timelineOf } from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { OrderDetail } from "../api/orders.queries";

type OrderProgressCardProps = {
	/** The order of the page. The card reads its event times. */
	order: OrderDetail;
};

/** A delivered or cancelled order shows 100%: its last step is done. */
export function OrderProgressCard({ order }: OrderProgressCardProps) {
	const { t, locale } = useT();
	const steps = timelineOf(order);
	const doneCount = steps.filter((step) => step.at !== null).length;
	const share = doneCount / steps.length;
	const percent = new Intl.NumberFormat(locale, { style: "percent" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("orders.progress.title")}</CardTitle>
				<CardDescription>
					{t(`orders.steps.${steps[doneCount - 1]?.id ?? "placed"}`)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress value={share * 100} aria-label={t("orders.progress.title")} />
				<span className="text-muted-foreground text-sm tabular-nums">
					{percent.format(share)}
				</span>
			</CardContent>
		</Card>
	);
}
