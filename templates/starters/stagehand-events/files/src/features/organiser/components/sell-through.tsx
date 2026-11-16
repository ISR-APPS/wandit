// The sales of one event as a bar and a line of figures: "1,240 / 1,800" and the share sold.
// The home list, the events table, and the venue panel render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Progress } from "~/shared/ui/progress";
import { fillMessage } from "../lib/format";

type SellThroughProps = {
	/** Valid tickets of the event. */
	sold: number;
	/** The ticket limit of the event. */
	capacity: number;
	/** Extra classes of the wrapper, for example a width. */
	className?: string;
};

/** The bar has an aria-label with the same figures, so a screen reader reads the sales once. */
export function SellThrough({ sold, capacity, className }: SellThroughProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const share = capacity > 0 ? sold / capacity : 0;
	return (
		<div className={cn("grid min-w-28 gap-1.5", className)}>
			<div className="flex items-baseline justify-between gap-3 text-xs tabular-nums">
				<span>
					{number.format(sold)}
					<span className="text-muted-foreground">{` / ${number.format(capacity)}`}</span>
				</span>
				<span className="text-muted-foreground">{percent.format(share)}</span>
			</div>
			<Progress
				value={sold}
				max={capacity}
				className="h-1.5"
				aria-label={fillMessage(t("events.soldOf"), {
					sold: number.format(sold),
					capacity: number.format(capacity),
				})}
			/>
		</div>
	);
}
