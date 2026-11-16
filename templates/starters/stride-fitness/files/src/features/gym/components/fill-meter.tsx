// The fill of one class session: "12 / 16" and a short bar under it.
// The home agenda and the timetable of the classes page render it in each row.
// It reads only its props. The bar clamps at the capacity; the text keeps the real count.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Progress } from "~/shared/ui/progress";

type FillMeterProps = {
	/** Booked spots of the session. */
	booked: number;
	/** Spots of the session. */
	capacity: number;
	/** Layout classes of the caller, for example a width. */
	className?: string;
};

/** The bar repeats the text, so screen readers read only the text. */
export function FillMeter({ booked, capacity, className }: FillMeterProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<div className={cn("grid w-20 gap-1.5", className)}>
			<span className="text-sm tabular-nums">
				<span className="font-medium">{number.format(booked)}</span>
				<span className="text-muted-foreground">{` / ${number.format(capacity)}`}</span>
				<span className="sr-only">{` ${t("classes.spotsBooked")}`}</span>
			</span>
			<Progress
				value={booked}
				max={capacity}
				aria-hidden="true"
				className="h-1.5"
			/>
		</div>
	);
}
