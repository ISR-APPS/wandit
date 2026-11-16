// The period control of the home: 7, 30, or 90 days.
// RevenueHero renders it in its header. OverviewPage holds the value, so the hero and the facts row follow it.
import { dayCountFormat, PERIOD_DAYS, type PeriodDays } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";

type PeriodTabsProps = {
	/** The active period, in days. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** Each choice is written with Intl, for example "30 days". */
export function PeriodTabs({ days, onDaysChange }: PeriodTabsProps) {
	const { t, locale } = useT();
	const dayCount = dayCountFormat(locale);
	return (
		<Tabs
			value={String(days)}
			onValueChange={(value) => {
				const next = PERIOD_DAYS.find((period) => String(period) === value);
				if (next) {
					onDaysChange(next);
				}
			}}
		>
			<TabsList aria-label={t("chart.period")}>
				{PERIOD_DAYS.map((period) => (
					<TabsTrigger key={period} value={String(period)} className="px-3">
						{dayCount.format(period)}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
