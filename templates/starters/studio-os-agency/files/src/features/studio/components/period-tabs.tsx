// The period control: three small tabs for the last 7, 30, and 90 days.
// The overview and the Team page render it once and hold the period in their URL.
import { useT } from "~/shared/i18n";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { PERIOD_DAYS, type PeriodDays, parsePeriodDays } from "../lib/period";

type PeriodTabsProps = {
	/** The active period, in days. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** Each tab shows "30d". Its accessible name is the long text "30 days". */
export function PeriodTabs({ days, onDaysChange }: PeriodTabsProps) {
	const { t, locale } = useT();
	const longCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const shortCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
	});
	return (
		<Tabs
			value={String(days)}
			onValueChange={(value) => {
				const next = parsePeriodDays(value);
				if (next) {
					onDaysChange(next);
				}
			}}
		>
			{/* On a phone the strip is 44 px high, the smallest comfortable touch area. */}
			<TabsList
				aria-label={t("period.label")}
				className="max-md:group-data-[orientation=horizontal]/tabs:h-11"
			>
				{PERIOD_DAYS.map((period) => (
					<TabsTrigger
						key={period}
						value={String(period)}
						className="px-3"
						aria-label={longCount.format(period)}
					>
						{shortCount.format(period)}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
