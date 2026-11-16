// The control that puts a piece on the reservation list, or takes it off. The window cells and the piece in focus render it.
// It reads and changes the basket of ReservationProvider. A pressed button takes the green of the theme.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { PieceRef } from "../lib/pieces";
import { useReservation } from "./reservation-provider";

type ReserveButtonProps = {
	/** The reference of the piece that the button reserves. */
	pieceRef: PieceRef;
	/** The text of the free state. The window uses "Reserve", and the piece in focus names the chair. */
	label: string;
	/** "large" is the button of the piece in focus. "small" is the button of a window cell. */
	size: "small" | "large";
};

/** A toggle button. When the basket holds three other pieces, it is off and says that the basket is full. */
export function ReserveButton({ pieceRef, label, size }: ReserveButtonProps) {
	const { t } = useT();
	const { refs, isFull, toggle } = useReservation();
	const isReserved = refs.includes(pieceRef);
	const isBlocked = isFull && !isReserved;
	return (
		<button
			type="button"
			aria-pressed={isReserved}
			disabled={isBlocked}
			onClick={() => toggle(pieceRef)}
			className={cn(
				"nour-mono inline-flex cursor-pointer items-center justify-center self-start border uppercase tracking-[0.11em] transition-colors duration-300 disabled:cursor-not-allowed disabled:text-muted-foreground",
				// A phone needs a 44px touch box. From 1101px the six cells stand on one row, with a pointer.
				size === "small"
					? "min-h-11 px-3.5 text-[10.5px] min-[1101px]:min-h-[34px] min-[1101px]:px-[11px]"
					: "min-h-11 px-5 text-[11px]",
				isReserved
					? "border-primary bg-primary text-primary-foreground"
					: size === "large"
						? "border-foreground enabled:focus-visible:bg-foreground enabled:focus-visible:text-background enabled:hover:bg-foreground enabled:hover:text-background"
						: "border-foreground/16 enabled:focus-visible:border-foreground enabled:focus-visible:bg-foreground enabled:focus-visible:text-background enabled:hover:border-foreground enabled:hover:bg-foreground enabled:hover:text-background",
			)}
		>
			{isReserved
				? t("window.reserved")
				: isBlocked
					? t("window.basketFull")
					: label}
		</button>
	);
}
