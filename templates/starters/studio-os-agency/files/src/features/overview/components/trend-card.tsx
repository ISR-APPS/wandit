// The main trend panel of an entity tab: the title, a short note, the legend, and the compare plot.
// The Projects, Team, and Invoices tabs of the overview render one each.
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { DailyPoint } from "../lib/series";
import { CompareTrend } from "./compare-trend";

type TrendCardProps = {
	/** The panel title, already translated. */
	title: string;
	/** One muted line, for example "Running total of each period". */
	description: string;
	points: DailyPoint[];
	/** Intl options of the values, for example a currency. */
	format?: Intl.NumberFormatOptions;
};

/** The legend sits in the header. The plot fills the card height, so it matches the table card beside it. */
export function TrendCard({
	title,
	description,
	points,
	format,
}: TrendCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
				<ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-muted-foreground text-xs">
					<li className="flex items-center gap-1.5">
						<span className="h-0.5 w-4 rounded-full bg-chart-1" />
						{t("chart.thisPeriod")}
					</li>
					<li className="flex items-center gap-1.5">
						<span className="w-4 border-muted-foreground border-t border-dashed" />
						{t("chart.previousPeriod")}
					</li>
				</ul>
			</CardHeader>
			<CardContent className="flex-1">
				<CompareTrend
					title={title}
					points={points}
					format={format}
					size="main"
					className="h-full min-h-72"
				/>
			</CardContent>
		</Card>
	);
}
