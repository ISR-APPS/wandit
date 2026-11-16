// The period control of a trend: 7, 30, or 90 days, as a compact Select.
// The balance strip of the home and the spend chart of a card render it. The parent holds the period.
import { useT } from "~/shared/i18n";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { PERIOD_DAYS, type PeriodDays } from "../lib/series";

type PeriodSelectProps = {
	/** The period on show, in days. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** The choices read "7 days", "30 days", "90 days" in the app language. */
export function PeriodSelect({ days, onDaysChange }: PeriodSelectProps) {
	const { t, locale } = useT();
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	return (
		<Select
			value={String(days)}
			onValueChange={(value) =>
				onDaysChange(
					PERIOD_DAYS.find((option) => String(option) === value) ?? days,
				)
			}
		>
			<SelectTrigger
				aria-label={t("chart.period")}
				className="h-8 w-32 max-md:h-11"
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="end">
				{PERIOD_DAYS.map((option) => (
					<SelectItem key={option} value={String(option)}>
						{dayCount.format(option)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
