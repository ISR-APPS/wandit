// The main chart of the home: units picked per day, with the 7, 30, and 90 day control.
// OverviewPage renders it first in the main column and holds the period. A new period loads here with useQuery.
import { useQuery } from "@tanstack/react-query";
import {
	DailyUnitsCard,
	DailyUnitsCardSkeleton,
	LoadError,
	type PeriodDays,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import { dailyPicksQueryOptions } from "../api/overview.queries";

type PicksTrendCardProps = {
	/** The period of the chart, held by the page. */
	days: PeriodDays;
	/** Changes the period of the page. */
	onDaysChange: (days: PeriodDays) => void;
};

/** The loader prefetches the first period, so the first render has its data. */
export function PicksTrendCard({ days, onDaysChange }: PicksTrendCardProps) {
	const { t } = useT();
	const picks = useQuery(dailyPicksQueryOptions(days));
	if (picks.isPending) {
		return <DailyUnitsCardSkeleton />;
	}
	if (picks.isError) {
		return <LoadError message={t("overview.chartError")} />;
	}
	return (
		<DailyUnitsCard
			title={t("overview.trendTitle")}
			description={t("overview.trendDescription")}
			points={picks.data}
			days={days}
			onDaysChange={onDaysChange}
		/>
	);
}
