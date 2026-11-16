// The last four closed quarters of one rep: the attainment of each, with a bar and the booked amount.
// RepDetailPage renders it last in the rail. A closed quarter has no pace mark.
import {
	AttainmentBar,
	fillMessage,
	moneyFormat,
	paceStatusOf,
	percentFormat,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { RepQuarterResult } from "../api/reps.queries";

type RepHistoryCardProps = {
	/** Newest first. */
	history: RepQuarterResult[];
};

/** One row per quarter. A closed quarter is judged against its full target (pace 1). */
export function RepHistoryCard({ history }: RepHistoryCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, { compact: true });
	const percent = percentFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reps.historyTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-4">
					{history.map((quarter) => (
						<li key={quarter.label} className="grid gap-2">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span className="font-medium">{quarter.label}</span>
								<span className="text-muted-foreground tabular-nums">
									{`${money.format(quarter.booked)} / ${money.format(quarter.target)}`}
									<span className="ms-2 font-medium text-foreground">
										{percent.format(quarter.attainment)}
									</span>
								</span>
							</div>
							<AttainmentBar
								attainment={quarter.attainment}
								pace={1}
								status={paceStatusOf(quarter.attainment, 1)}
								label={fillMessage(t("reps.ofTarget"), {
									value: percent.format(quarter.attainment),
								})}
							/>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
