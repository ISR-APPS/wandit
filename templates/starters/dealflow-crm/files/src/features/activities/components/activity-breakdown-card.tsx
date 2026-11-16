// The breakdown card of the activities page: the activity counts of the last ACTIVITY_DEFAULT_DAYS days by type and by rep.
// ActivitiesPage renders it beside the trend card and passes the cached breakdown.
import { dayCountFormat, fillMessage } from "~/features/crm";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	ACTIVITY_DEFAULT_DAYS,
	type ActivityBreakdown,
} from "../api/activities.queries";
import { RankedBars } from "./ranked-bars";

type ActivityBreakdownCardProps = {
	/** The counts by type and by rep, each largest first. */
	breakdown: ActivityBreakdown;
};

/** Two ranked lists. The period control of the trend card does not change them. */
export function ActivityBreakdownCard({
	breakdown,
}: ActivityBreakdownCardProps) {
	const { t, locale } = useT();
	const hasRows = breakdown.byType.some((slice) => slice.value > 0);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("activities.breakdownTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("activities.lastPeriod"), {
						period: dayCountFormat(locale).format(ACTIVITY_DEFAULT_DAYS),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				{hasRows ? (
					<>
						<section className="grid gap-2">
							<h3 className="label-text font-sans text-muted-foreground text-xs">
								{t("activities.byType")}
							</h3>
							<RankedBars
								slices={breakdown.byType.map((slice) => ({
									label: t(`activityTypes.${slice.label}`),
									value: slice.value,
								}))}
							/>
						</section>
						<section className="grid gap-2">
							<h3 className="label-text font-sans text-muted-foreground text-xs">
								{t("activities.byRep")}
							</h3>
							<RankedBars slices={breakdown.byRep} />
						</section>
					</>
				) : (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
