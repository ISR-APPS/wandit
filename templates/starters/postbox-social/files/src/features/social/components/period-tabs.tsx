// The period control of a page or a card: 7, 30, or 90 complete days.
// The Overview, Audience, and channel pages render it. The parent holds the period, so the query keys change with it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { dayCountFormat } from "../lib/format";
import { TAB_TOUCH_AREA } from "../lib/layout";
import { PERIOD_DAYS, type PeriodDays } from "../lib/series";

type PeriodTabsProps = {
	/** The chosen period, in days. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** Three tabs with the day counts in words: "7 days", "30 days", "90 days". */
export function PeriodTabs({ days, onDaysChange }: PeriodTabsProps) {
	const { t, locale } = useT();
	const dayCount = dayCountFormat(locale);
	return (
		<Tabs
			value={String(days)}
			onValueChange={(value) => {
				const next = PERIOD_DAYS.find((choice) => String(choice) === value);
				if (next) {
					onDaysChange(next);
				}
			}}
		>
			<TabsList aria-label={t("chart.period")}>
				{PERIOD_DAYS.map((choice) => (
					<TabsTrigger
						key={choice}
						value={String(choice)}
						className={cn("px-3", TAB_TOUCH_AREA)}
					>
						{dayCount.format(choice)}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
