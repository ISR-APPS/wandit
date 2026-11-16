// The running spend of one card against the period before, with its own 7, 30, or 90 day control.
// CardDetailPage renders it first, beside the card face. It reads cardRunningSpendQueryOptions with useQuery.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MoneyTrendCard, type PeriodDays, PeriodSelect } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { cardRunningSpendQueryOptions } from "../api/cards.queries";

/** The period of the spend chart on the first load. The loader prefetches it. */
export const CARD_DEFAULT_DAYS: PeriodDays = 30;

type CardSpendTrendProps = {
	/** The id of the card, for example "card-4417". */
	cardId: string;
};

/** The spend chart holds its own period. The query key changes on a click, so it reads with useQuery. */
export function CardSpendTrend({ cardId }: CardSpendTrendProps) {
	const { t } = useT();
	const [days, setDays] = useState<PeriodDays>(CARD_DEFAULT_DAYS);
	const spend = useQuery({
		...cardRunningSpendQueryOptions(cardId, days),
		placeholderData: keepPreviousData,
	});
	return (
		<MoneyTrendCard
			title={t("cards.spendTitle")}
			description={t("cards.spendDescription")}
			points={spend.data}
			currentLabel={t("chart.thisPeriod")}
			previousLabel={t("chart.previousPeriod")}
			action={<PeriodSelect days={days} onDaysChange={setDays} />}
			emptyText={t("cards.noSpend")}
			yFromZero
			onRetry={spend.isError ? () => spend.refetch() : undefined}
			errorText={t("cards.spendError")}
		/>
	);
}
