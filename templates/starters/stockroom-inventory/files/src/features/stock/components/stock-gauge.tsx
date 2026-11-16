// A slim bar of the stock of one item: the fill is the on-hand quantity, the tick is the minimum.
// The item list renders it under each on-hand number; the item page renders it large.
// The scale ends at the minimum plus one reorder quantity: the level just after a full delivery.
import { cn } from "~/shared/lib/utils";
import type { StockStatus } from "../lib/statuses";

type StockGaugeProps = {
	onHand: number;
	/** The reorder point of the item. The tick sits there. */
	minimum: number;
	/** The quantity of one order line. Minimum plus this is the full scale. */
	reorderQuantity: number;
	/** The level from stockStatusOf. It picks the fill color. */
	status: StockStatus;
	/** "sm" in a table cell, "md" on the item page. */
	size?: "sm" | "md";
	className?: string;
};

// The fill color of each level. Out of stock has no fill, so the empty track says it.
const FILL_CLASS = {
	out: "bg-destructive",
	low: "bg-warning",
	ok: "bg-chart-2",
} satisfies Record<StockStatus, string>;

/** Decorative: the numbers next to it carry the facts, so screen readers skip it. */
export function StockGauge({
	onHand,
	minimum,
	reorderQuantity,
	status,
	size = "sm",
	className,
}: StockGaugeProps) {
	const scale = Math.max(1, minimum + reorderQuantity);
	const fillPercent = Math.min(100, (Math.max(0, onHand) / scale) * 100);
	const minimumPercent = Math.min(100, (minimum / scale) * 100);
	return (
		<div
			aria-hidden="true"
			className={cn(
				"relative w-full rounded-full bg-border",
				size === "sm" ? "h-1.5" : "h-2.5",
				className,
			)}
		>
			{/* start-0 makes the fill grow from the start side: from the right in Arabic. */}
			<div
				className={cn(
					"absolute inset-y-0 start-0 rounded-full",
					FILL_CLASS[status],
				)}
				style={{ width: `${fillPercent}%` }}
			/>
			<div
				className="absolute -inset-y-1 w-0.5 rounded-full bg-muted-foreground"
				style={{ insetInlineStart: `${minimumPercent}%` }}
			/>
		</div>
	);
}
