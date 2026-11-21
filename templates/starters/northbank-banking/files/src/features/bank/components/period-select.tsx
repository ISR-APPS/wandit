// The period control of a page header: the last 7, 30, or 90 days, as a Select with a calendar icon.
// The home and the transactions page render it beside their export button. The page holds the period.
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { fillMessage } from "../lib/format";
import { PERIOD_DAYS, type PeriodDays } from "../lib/series";

type PeriodSelectProps = {
	/** The period on show, in days. */
	days: PeriodDays;
	/** Runs when the user picks another period. */
	onDaysChange: (days: PeriodDays) => void;
};

/** The choices read "Last 7 days", "Last 30 days", "Last 90 days" in the app language. */
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
			<SelectTrigger aria-label={t("period.label")} className="w-44">
				<CalendarBlankIcon className="text-muted-foreground" />
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="end">
				{PERIOD_DAYS.map((option) => (
					<SelectItem key={option} value={String(option)}>
						{fillMessage(t("period.last"), {
							period: dayCount.format(option),
						})}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
