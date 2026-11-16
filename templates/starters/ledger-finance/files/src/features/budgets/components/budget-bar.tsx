// The bar of one budget: the used share of the limit, and a thin mark at the share of the month that passed.
// BudgetLineRow and BudgetLineSheet render it. The text beside the bar gives the same figures.
import { cn } from "~/shared/lib/utils";
import type { BudgetStatus } from "../lib/budget-report";
import { BUDGET_STATUS_FILL } from "../lib/budget-status";

type BudgetBarProps = {
	/** The spend and the limit, in cents. A spend above the limit fills the bar. */
	spentCents: number;
	limitCents: number;
	status: BudgetStatus;
	/** The share of the month that passed, from 0 to 1. null hides the mark, for a closed month. */
	monthShare: number | null;
	className?: string;
};

/** Decoration only: it is hidden from screen readers. */
export function BudgetBar({
	spentCents,
	limitCents,
	status,
	monthShare,
	className,
}: BudgetBarProps) {
	const usedShare = limitCents > 0 ? Math.min(spentCents / limitCents, 1) : 0;
	return (
		<div aria-hidden="true" className={cn("relative h-2", className)}>
			<div className="h-full overflow-hidden rounded-full bg-muted">
				<div
					className={cn("h-full rounded-full", BUDGET_STATUS_FILL[status])}
					style={{ width: `${usedShare * 100}%` }}
				/>
			</div>
			{monthShare === null ? null : (
				// The mark is taller than the bar, so it shows on the fill and on the track.
				<span
					className="absolute -inset-y-1 w-0 border-foreground/70 border-s"
					style={{ insetInlineStart: `${monthShare * 100}%` }}
				/>
			)}
		</div>
	);
}
