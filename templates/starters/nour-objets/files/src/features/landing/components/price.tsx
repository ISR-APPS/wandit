// A price in dinars, for example "14 800 DA". Every caption, the shelf, the piece in focus, and the ledger render it.
// It reads the currency code from the "site" group of messages.ts.
import { useT } from "~/shared/i18n";
import { formatAmount } from "../lib/pieces";

/** `amount` is in Algerian dinars with no decimals. The space between the thousands never breaks the line. */
export function Price({ amount }: { amount: number }) {
	const { t } = useT();
	return (
		<span className="whitespace-nowrap">
			{formatAmount(amount)} {t("site.currency")}
		</span>
	);
}
