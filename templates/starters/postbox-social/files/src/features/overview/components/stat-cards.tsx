// The first band of the home: four stat cards with the label, the change pill, and the value.
// OverviewPage renders it with the stats of the chosen period. It follows the kit stat card:
// the label and the pill share the top row, the value sits under them.
import { ChangePill } from "~/features/social";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { OverviewFigure } from "../api/overview.queries";

type StatCardsProps = {
	/** The four figures of the period, the most important first. */
	stats: OverviewFigure[];
};

/** Two columns from the xl container width, four from 4xl. */
export function StatCards({ stats }: StatCardsProps) {
	const { t, locale } = useT();
	return (
		<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
			{stats.map((stat) => (
				<Card key={stat.id} className="py-4">
					<CardContent>
						<div className="flex items-center justify-between gap-2">
							<p className="font-medium text-muted-foreground text-sm">
								{t(stat.labelKey)}
							</p>
							{stat.change === null ? (
								<span className="text-muted-foreground text-xs">
									{t("kpi.noComparison")}
								</span>
							) : (
								<ChangePill change={stat.change} goodWhen={stat.goodWhen} />
							)}
						</div>
						<p className="mt-2 font-numeric font-semibold text-3xl tabular-nums">
							{new Intl.NumberFormat(locale, stat.format).format(stat.value)}
						</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
