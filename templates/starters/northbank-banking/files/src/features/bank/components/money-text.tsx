// One amount of money, formatted in the app language, with aligned digits.
// Tables, totals, and detail pages render it. It reads the amount in cents and the locale of useT().
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { centsToUnits, moneyFormat } from "../lib/format";

type MoneyTextProps = {
	/** Cents with a sign: positive comes in, negative goes out. */
	amountCents: number;
	/** False rounds to whole dollars, for a total. True shows the cents of one entry. */
	withCents?: boolean;
	/** True writes "+" in front of money that comes in and colors it as good news. */
	isSigned?: boolean;
	className?: string;
};

/** The sign sits in a `bdi dir="ltr"`, so "-$120.00" keeps its order in Arabic. */
export function MoneyText({
	amountCents,
	withCents = true,
	isSigned = false,
	className,
}: MoneyTextProps) {
	const { locale } = useT();
	const format = moneyFormat(
		locale,
		withCents ? 2 : 0,
		isSigned ? "exceptZero" : "auto",
	);
	return (
		<bdi
			dir="ltr"
			className={cn(
				"font-numeric tabular-nums",
				isSigned && amountCents > 0 && "text-success",
				className,
			)}
		>
			{format.format(centsToUnits(amountCents))}
		</bdi>
	);
}
