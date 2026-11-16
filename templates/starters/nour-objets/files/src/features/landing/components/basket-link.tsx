// The basket chip of the header: the word "Basket" and the count of the reserved pieces.
// SiteHeader renders it. It reads the basket of ReservationProvider and jumps to the reservation ledger.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useReservation } from "./reservation-provider";

/** A link to the "#visit" section. The count takes the green of the theme when the basket holds a piece. */
export function BasketLink() {
	const { t } = useT();
	const { refs } = useReservation();
	const hasPieces = refs.length > 0;
	return (
		<a
			href="#visit"
			aria-label={`${t("site.basket")}: ${refs.length} ${t("site.basketCount")}`}
			className="group flex h-11 flex-none items-center"
		>
			{/* The link is 44px high for a finger. The box inside it keeps the 34px of the design. */}
			<span className="flex h-[34px] items-center gap-2 border border-foreground/16 px-2.5 transition-colors duration-300 group-hover:border-foreground group-focus-visible:border-foreground">
				<span
					className={cn(
						"nour-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors duration-300",
						hasPieces ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{t("site.basket")}
				</span>
				<span
					className={cn(
						"nour-mono grid h-[19px] min-w-[19px] place-items-center border text-[11px] transition-colors duration-300",
						hasPieces
							? "border-primary bg-primary text-primary-foreground"
							: "border-foreground/16 text-muted-foreground",
					)}
				>
					{refs.length}
				</span>
			</span>
		</a>
	);
}
