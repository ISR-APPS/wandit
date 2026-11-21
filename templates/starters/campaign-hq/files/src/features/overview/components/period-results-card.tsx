// The "Period results" card of the home: six figures of the period, each with an icon tile and a delta badge.
// OverviewPage renders it in the third row and passes the period data.
// The figures are the ones that the top row does not show: spend, clicks, costs, conversion rate, revenue.
import {
	ChartLineUpIcon,
	CoinsIcon,
	CursorClickIcon,
	FunnelIcon,
	ReceiptIcon,
	TagIcon,
} from "@phosphor-icons/react";
import { DeltaBadge, fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { Overview, ResultFigureId } from "../api/overview.queries";
import { formatFigureValue } from "../lib/figure-value";

// The icon of each row id of overviewQueryOptions. The type makes the map cover every id.
const RESULT_ICON = {
	spend: CoinsIcon,
	clicks: CursorClickIcon,
	"cost-per-click": TagIcon,
	"conversion-rate": FunnelIcon,
	"cost-per-conversion": ReceiptIcon,
	revenue: ChartLineUpIcon,
} satisfies Record<ResultFigureId, KitIcon>;

type PeriodResultsCardProps = {
	/** The data of the chosen period. */
	overview: Overview;
	/** The number of live campaigns today, for the description. */
	liveCount: number;
};

/** The badges stand in one column of a fixed width, so the values line up. */
export function PeriodResultsCard({
	overview,
	liveCount,
}: PeriodResultsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.resultsTitle")}</CardTitle>
				<CardDescription>
					{liveCount === 1
						? t("overview.resultsHintOne")
						: fillMessage(t("overview.resultsHint"), {
								count: number.format(liveCount),
							})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{/* grid-cols-1 caps the row at the card width. An auto track grows to the full label and pushes the badges out. */}
				<ul className="grid grid-cols-1 gap-5">
					{overview.results.map((figure) => {
						const Icon = RESULT_ICON[figure.id];
						return (
							<li key={figure.id} className="flex items-center gap-4">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
									<Icon className="size-4" />
								</span>
								{/* A long label wraps to two lines in a narrow card. A cut label hides the metric name. */}
								<span className="min-w-0 leading-tight">
									{t(figure.labelKey)}
								</span>
								<span className="ms-auto shrink-0 text-sm tabular-nums">
									{formatFigureValue(figure, locale)}
								</span>
								<span className="flex w-20 shrink-0 justify-end">
									<DeltaBadge
										change={figure.change}
										goodWhen={figure.goodWhen}
										withIcon={false}
									/>
								</span>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
