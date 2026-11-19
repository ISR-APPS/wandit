// A small card-shaped tile with the last 4 digits: the thumbnail of a card row, in place of a photo.
// The cards table and the card page header render it. A physical card is filled; a virtual card is outlined.
import type { BankCard } from "~/features/bank";
import { cn } from "~/shared/lib/utils";

type CardChipProps = {
	card: BankCard;
	className?: string;
};

/** The digits sit at the bottom end, where a real card prints its number. The text is hidden: the row names the card. */
export function CardChip({ card, className }: CardChipProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex h-9 w-14 shrink-0 items-end justify-end rounded-md p-1.5 font-numeric text-xs tabular-nums leading-none",
				card.kind === "physical"
					? "bg-primary text-primary-foreground"
					: "border border-dashed bg-muted text-muted-foreground",
				className,
			)}
		>
			{card.numberEnding}
		</span>
	);
}
