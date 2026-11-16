// A thin bar that shows a share from 0 to 1. The ranked lists and the cadence rows draw one per row.
// It is a plain element: the value stands as text beside it, so screen readers skip the bar.
import { cn } from "~/shared/lib/utils";

type ShareBarProps = {
	/** The filled part, from 0 to 1. A value outside that range is cut. */
	share: number;
	/** The fill class, for example the `solid` class of a channel tone. The default is chart-1. */
	fillClassName?: string;
	className?: string;
};

/** The bar grows from the start side, in Arabic too. */
export function ShareBar({ share, fillClassName, className }: ShareBarProps) {
	const percent = Math.min(1, Math.max(0, share)) * 100;
	return (
		<div
			aria-hidden="true"
			className={cn(
				"h-1.5 w-full overflow-hidden rounded-badge bg-muted",
				className,
			)}
		>
			<div
				className={cn("h-full rounded-badge", fillClassName ?? "bg-chart-1")}
				style={{ width: `${percent}%` }}
			/>
		</div>
	);
}
