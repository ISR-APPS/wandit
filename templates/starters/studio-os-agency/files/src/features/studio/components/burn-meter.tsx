// A thin bar of budget spent, with a tick at the share of the calendar that has passed.
// The Projects table and the project detail render it. Spend past the tick means the project burns fast.
import { cn } from "~/shared/lib/utils";

type BurnMeterProps = {
	/** Spend divided by budget. 1.2 fills the bar and turns it red. */
	burnShare: number;
	/** Share of the calendar that has passed, 0 to 1. null hides the tick (a retainer). */
	elapsedShare: number | null;
	/** Width and height classes. The default is a full-width bar of h-1.5. */
	className?: string;
};

/** Decorative: the caller prints the percent beside it. The bar fills from the start side, also in Arabic. */
export function BurnMeter({
	burnShare,
	elapsedShare,
	className,
}: BurnMeterProps) {
	const fill = Math.min(1, Math.max(0, burnShare));
	return (
		<div
			aria-hidden="true"
			className={cn("relative h-1.5 w-full rounded-full bg-muted", className)}
		>
			<div
				className={cn(
					"h-full rounded-full",
					burnShare > 1 ? "bg-destructive" : "bg-primary",
				)}
				style={{ width: `${fill * 100}%` }}
			/>
			{elapsedShare === null ? null : (
				<div
					className="absolute -inset-y-1 w-0.5 rounded-full bg-chart-3"
					style={{ insetInlineStart: `calc(${elapsedShare * 100}% - 1px)` }}
				/>
			)}
		</div>
	);
}
