// A price in the display face with its small currency unit: "1,150 DA".
// Every section with a price renders it. It reads the language for the number format.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/** The color of the currency unit: the hot accent on cream and mustard, or the text color on the hot and ink grounds. */
type UnitTone = "hot" | "inherit";

const UNIT_CLASS_OF: Record<UnitTone, string> = {
	hot: "text-primary",
	inherit: "opacity-70",
};

type PriceProps = {
	/** The amount in Algerian dinars, as a whole number. */
	amountDa: number;
	unitTone: UnitTone;
	/** True for a supplement. It puts "+" before the amount. */
	isExtra?: boolean;
	/** Layout classes of the caller, for example `ms-auto`. A font size class replaces the default size. */
	className?: string;
};

/** The amount never wraps. The unit is 52% of the digits. */
export function Price({
	amountDa,
	unitTone,
	isExtra = false,
	className,
}: PriceProps) {
	const { t, locale } = useT();
	const amount = new Intl.NumberFormat(locale).format(amountDa);
	return (
		<b
			className={cn(
				"whitespace-nowrap font-display font-normal text-[clamp(1.35rem,2.5vw,2rem)] leading-none tracking-[0.005em]",
				className,
			)}
		>
			{isExtra ? "+" : ""}
			{amount}
			<span
				className={cn("ms-[0.18em] text-[0.52em]", UNIT_CLASS_OF[unitTone])}
			>
				{t("site.currency")}
			</span>
		</b>
	);
}
