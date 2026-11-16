// The picks per day of one item, with its own period control.
// The item page renders it in the main column. The loader prefetches the first period; a new period loads here.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	DailyUnitsCard,
	DailyUnitsCardSkeleton,
	LoadError,
	type PeriodDays,
} from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	ITEM_DEFAULT_DAYS,
	itemDailyPicksQueryOptions,
} from "../api/items.queries";

type ItemPicksCardProps = {
	/** The id of the item, from the URL. */
	itemId: string;
};

/** The query key holds the period, so a new period reads with useQuery and its own skeleton. */
export function ItemPicksCard({ itemId }: ItemPicksCardProps) {
	const { t } = useT();
	const [days, setDays] = useState<PeriodDays>(ITEM_DEFAULT_DAYS);
	const picks = useQuery(itemDailyPicksQueryOptions(itemId, days));
	if (picks.isPending) {
		return <DailyUnitsCardSkeleton height="side" />;
	}
	if (picks.isError) {
		return <LoadError message={t("itemDetail.chartError")} />;
	}
	return (
		<DailyUnitsCard
			title={t("itemDetail.picksTitle")}
			description={t("itemDetail.picksDescription")}
			points={picks.data}
			days={days}
			onDaysChange={setDays}
			height="side"
		/>
	);
}
