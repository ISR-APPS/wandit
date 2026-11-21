// A load meter: committed story points against the capacity of one person, as a bar and a percent.
// The Team page and its member sheet render it. Above 100 % the bar is full and takes the destructive color.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// From 85 % of the capacity the load is close to full and takes the warning color.
const NEAR_FULL = 0.85;

type CapacityMeterProps = {
	/** Committed story points: To do, In progress, and In review. */
	points: number;
	/** Story points that the person can carry in two weeks. */
	capacity: number;
	/** Width classes of the bar, for example "w-28". */
	className?: string;
};

/** The percent is the accessible text. The color repeats it, so it is never the only signal. */
export function CapacityMeter({
	points,
	capacity,
	className,
}: CapacityMeterProps) {
	const { locale } = useT();
	const ratio = capacity === 0 ? 0 : points / capacity;
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const tone =
		ratio > 1
			? "bg-destructive"
			: ratio >= NEAR_FULL
				? "bg-warning"
				: "bg-success";
	return (
		<span className="flex items-center gap-2.5">
			<span
				aria-hidden="true"
				className={cn(
					"h-1.5 w-24 overflow-hidden rounded-full bg-muted",
					className,
				)}
			>
				<span
					className={cn("block h-full rounded-full", tone)}
					style={{ width: `${Math.min(ratio, 1) * 100}%` }}
				/>
			</span>
			<span
				className={cn(
					"w-10 text-end font-medium text-sm tabular-nums",
					ratio > 1 && "text-destructive",
				)}
			>
				{percent.format(ratio)}
			</span>
		</span>
	);
}
