// The quota card of the rep page: one bar of the quarter attainment and its percent at the end.
// RepDetailPage renders it under the profile card. A rep over the target shows a full bar and the real percent.
import { fillMessage, moneyFormat, percentFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { RepDetail } from "../api/reps.queries";

type RepAttainmentCardProps = {
	rep: RepDetail;
};

/** The description gives the booked amount against the target, so the bar is never the only mark. */
export function RepAttainmentCard({ rep }: RepAttainmentCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = percentFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.attainmentTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("reps.bookedOf"), {
						booked: money.format(rep.booked),
						target: money.format(rep.target),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={rep.attainment * 100}
					aria-label={t("reps.attainmentTitle")}
				/>
				<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
					{percent.format(rep.attainment)}
				</span>
			</CardContent>
		</Card>
	);
}
