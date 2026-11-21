// The period control of a page header: a select of 7, 30, or 90 days with a calendar icon.
// The home and the Activities page render it. The page holds the value and puts it in its query keys.
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { dayCountFormat, fillMessage } from "../lib/format";
import { PERIOD_DAYS, type PeriodDays } from "../lib/series";

type PeriodSelectProps = {
	/** The chosen period, in days. */
	days: PeriodDays;
	/** Gets the new period when the user picks one. */
	onDaysChange: (days: PeriodDays) => void;
};

/** Each choice reads "Last 30 days". */
export function PeriodSelect({ days, onDaysChange }: PeriodSelectProps) {
	const { t, locale } = useT();
	const dayCount = dayCountFormat(locale);
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
						{fillMessage(t("period.last"), {
							period: dayCount.format(period),
						})}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
