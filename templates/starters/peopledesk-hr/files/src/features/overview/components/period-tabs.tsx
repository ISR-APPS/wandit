// The period control of the digest: 7 days or 30 days, as tabs.
// OverviewPage renders it at the end of its header and holds the chosen period.
import { useT } from "~/shared/i18n";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { DIGEST_PERIODS, type DigestPeriod } from "../lib/digest-period";

type PeriodTabsProps = {
	/** The chosen period in days, from ?days= of the /app URL. */
	days: DigestPeriod;
	/** Writes the new period to the URL, so every digest section reads it. */
	onDaysChange: (days: DigestPeriod) => void;
};

/** Two tabs that name each period in days, in the app language. */
export function PeriodTabs({ days, onDaysChange }: PeriodTabsProps) {
	const { t, locale } = useT();
	const dayUnit = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	return (
		<Tabs
			value={String(days)}
			onValueChange={(value) =>
				onDaysChange(
					DIGEST_PERIODS.find((period) => String(period) === value) ?? days,
				)
			}
		>
			<TabsList aria-label={t("chart.period")}>
				{DIGEST_PERIODS.map((period) => (
					<TabsTrigger key={period} value={String(period)} className="px-3">
						{dayUnit.format(period)}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
