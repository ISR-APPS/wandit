// The trend panel of an entity tab: the daily series of the period at main height, with its legend.
// OverviewPage renders one in the Tasks tab and one in the Bugs tab. The period control sits above the tab content.
import type { DailyPoint } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CompareTrend } from "./compare-trend";

type EntityTrendCardProps = {
	/** The panel title, already translated: "Tasks completed per day". */
	title: string;
	/** One point per working day of the period, oldest first. */
	points: DailyPoint[];
};

/** The legend sits in the header, not under the plot. */
export function EntityTrendCard({ title, points }: EntityTrendCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<span className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="h-0.5 w-4 rounded-full bg-chart-1"
						/>
						{t("chart.thisPeriod")}
					</span>
					<span className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className="w-4 border-muted-foreground border-t border-dashed"
						/>
						{t("chart.previousPeriod")}
					</span>
				</CardDescription>
			</CardHeader>
			{/* The plot fills the card, which is as high as the list beside it. It keeps at least 18rem. */}
			<CardContent className="relative min-h-72 flex-1">
				<CompareTrend
					title={title}
					points={points}
					size="main"
					className="absolute inset-x-6 inset-y-0 h-full w-auto"
				/>
			</CardContent>
		</Card>
	);
}
