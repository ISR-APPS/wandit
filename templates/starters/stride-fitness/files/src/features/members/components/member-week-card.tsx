// The week card of the member page: the visits of the last 7 days against the usual visits of a week.
// MemberDetailPage renders it under the profile card. It follows the progress card of the kit profile page.
import { fillMessage } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type MemberWeekCardProps = {
	/** Check-ins of the last 7 days, today included. */
	visits: number;
	/** The visits that the member usually makes in a week, 1 to 5. */
	usual: number;
};

/** The text gives the count, so the bar is hidden from screen readers. */
export function MemberWeekCard({ visits, usual }: MemberWeekCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.weekTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={visits}
					max={usual}
					aria-hidden="true"
					className="h-2.5 flex-1"
				/>
				<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
					{fillMessage(t("members.weekCount"), {
						visits: number.format(visits),
						usual: number.format(usual),
					})}
				</span>
			</CardContent>
		</Card>
	);
}
