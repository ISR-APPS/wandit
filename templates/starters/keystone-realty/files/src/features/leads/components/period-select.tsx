// The period control of the leads page header: a select of 7, 30, or 90 days with a calendar icon.
// LeadsPage renders it and holds the value. The value is part of the key of the leads summary query.
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { fillMessage } from "~/features/agency";
import { useT } from "~/shared/i18n";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { PERIOD_DAYS, type PeriodDays } from "../lib/lead-stats";

type PeriodSelectProps = {
	/** The chosen period, in days. */
	days: PeriodDays;
	/** Gets the new period when the user picks one. */
	onDaysChange: (days: PeriodDays) => void;
};

/** Each choice reads "Last 30 days". Intl writes the day count in the language of the page. */
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
			onValueChange={(value) => {
				const next = PERIOD_DAYS.find((period) => String(period) === value);
				if (next) {
					onDaysChange(next);
				}
			}}
		>
			<SelectTrigger aria-label={t("period.label")} className="w-auto gap-2">
				<CalendarBlankIcon className="size-4 text-muted-foreground" />
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="end">
				{PERIOD_DAYS.map((period) => (
					<SelectItem key={period} value={String(period)}>
						{fillMessage(t("period.last"), { period: dayCount.format(period) })}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
