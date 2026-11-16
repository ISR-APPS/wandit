// The amount cell of the transaction table: a thin bar, then the signed amount.
// useTransactionTable renders it on the home, on the list page, and on the account page.
// The bar compares the row with the largest amount of the table.
import { MoneyText, type TransactionType } from "~/features/ledger";
import { cn } from "~/shared/lib/utils";

type AmountCellProps = {
	/** The signed amount of the row, in cents. */
	amountCents: number;
	type: TransactionType;
	/** The largest amount of the table without its sign, in cents. 0 or less hides the bar. */
	largestCents: number;
};

/** Money that comes in has a plus sign. Income is green. A transfer is muted: it is not a gain and not a cost. */
export function AmountCell({
	amountCents,
	type,
	largestCents,
}: AmountCellProps) {
	const sizeCents = Math.abs(amountCents);
	return (
		<span className="inline-flex items-center justify-end gap-3">
			{largestCents > 0 && sizeCents > 0 ? (
				// The bar is decoration: the number beside it is the text of the cell.
				// The faint track shows the full scale, so a short fill reads as the start of a bar and not as a dot.
				<span
					aria-hidden="true"
					className="@4xl/main:flex hidden h-1.5 w-24 justify-end overflow-hidden rounded-full bg-muted/60"
				>
					<span
						className={cn(
							"block h-full",
							type === "income"
								? "bg-success/80"
								: type === "expense"
									? "bg-chart-2"
									: "bg-muted-foreground/35",
						)}
						// A small amount keeps a fill of 1 spacing step, so it stays visible at the end of the track.
						style={{
							width: `max(var(--spacing), ${(sizeCents / largestCents) * 100}%)`,
						}}
					/>
				</span>
			) : null}
			<MoneyText
				amountCents={amountCents}
				sign="always"
				className={cn(
					"min-w-24 text-end",
					type === "income" && "text-success",
					type === "transfer" && "text-muted-foreground",
				)}
			/>
		</span>
	);
}
