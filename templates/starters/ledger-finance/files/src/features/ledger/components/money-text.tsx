// One amount of money in the numeral face of the theme, for example "-$329.94" or "+$4,800.00".
// The tables, the totals, and the detail pages of every feature render it.
// It reads the locale of useT() and the ledger currency.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { centsToUnits, moneyFormat } from "../lib/format";

type MoneyTextProps = {
	/** The amount in cents. A negative amount shows a minus sign. */
	amountCents: number;
	/** "always" also puts a plus sign in front of a positive amount: use it for a flow, not for a balance. */
	sign?: "auto" | "always";
	/** false rounds to whole currency units, for a total or a headline figure. */
	withCents?: boolean;
	className?: string;
};

/** The bdi keeps the sign in front of the number in a right-to-left language. */
export function MoneyText({
	amountCents,
	sign = "auto",
	withCents = true,
	className,
}: MoneyTextProps) {
	const { locale } = useT();
	// `-0` formats as "-$0.00". `|| 0` turns it into a plain zero.
	const text = moneyFormat(locale, withCents ? 2 : 0).format(
		centsToUnits(amountCents) || 0,
	);
	return (
		<bdi
			dir="ltr"
			className={cn("whitespace-nowrap font-numeric tabular-nums", className)}
		>
			{sign === "always" && amountCents > 0 ? `+${text}` : text}
		</bdi>
	);
}
