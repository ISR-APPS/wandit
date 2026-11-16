// One price in the display face with tabular figures, for example "4,800 DZD".
// The menu slates and the fire menu render it. The currency label is the key site.currency.
// The number format follows the page locale of useT(), so a second language gets its own separators.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { FIGURE } from "../lib/type-styles";

/** A price span. `.br-price` dims it to 55% chalk until the smoke lights its slate. */
export function Price({
	amountDa,
	className,
}: {
	/** The amount in Algerian dinars. */
	amountDa: number;
	className?: string;
}) {
	const { t, locale } = useT();
	return (
		<span
			className={cn(
				FIGURE,
				"br-price whitespace-nowrap font-semibold tracking-[-0.01em]",
				className,
			)}
		>
			{new Intl.NumberFormat(locale).format(amountDa)}
			{" "}
			{t("site.currency")}
		</span>
	);
}
