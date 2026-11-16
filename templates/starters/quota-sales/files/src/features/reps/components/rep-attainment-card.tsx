// The attainment of one rep: the percent of the target, the pace badge, and the bar with the pace mark.
// RepDetailPage renders it first in the rail.
import {
	AttainmentBar,
	fillMessage,
	PaceBadge,
	percentFormat,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { RepDetail } from "../api/reps.queries";

type RepAttainmentCardProps = {
	rep: RepDetail;
};

/** The big number of the rep page. The note under the bar explains the pace mark. */
export function RepAttainmentCard({ rep }: RepAttainmentCardProps) {
	const { t, locale } = useT();
	const percent = percentFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.attainmentTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex items-center justify-between gap-3">
					<p className="font-numeric font-semibold text-4xl tabular-nums leading-none">
						{percent.format(rep.attainment)}
					</p>
					<PaceBadge status={rep.status} />
				</div>
				<AttainmentBar
					attainment={rep.attainment}
					pace={rep.progress.pace}
					status={rep.status}
					label={fillMessage(t("reps.ofTarget"), {
						value: percent.format(rep.attainment),
					})}
					className="h-2.5"
				/>
				<p className="text-muted-foreground text-sm">
					{fillMessage(t("reps.paceNote"), {
						value: percent.format(rep.progress.pace),
					})}
				</p>
			</CardContent>
		</Card>
	);
}
