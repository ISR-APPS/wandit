/**
 * One line that names what a SlickPay payment or an offline request buys.
 * A pricing v8 row names an amount in USD. A row from before v8 names its plan, as history.
 * The wallet page, the offline request panel, and the SlickPay return page call it.
 */
import type { SlickpayPaymentView } from "@wandit/contracts";

import { useDictionary, useTranslation } from "@/lib/i18n";
import { formatUsd } from "./price-format";

/** The fields that a SlickPay payment view and an offline request have in common. */
type PurchaseRow = Pick<
	SlickpayPaymentView,
	"amountUsd" | "interval" | "plan" | "tierCredits"
>;

/** Returns a formatter for the current locale, for example "$25" or "Pro plan · 250 credits · Monthly". */
export function usePurchaseSummary(): (row: PurchaseRow) => string {
	const { locale, t } = useTranslation();
	const history = useDictionary().billing.history;

	return (row) => {
		if (row.amountUsd !== null) {
			return formatUsd(row.amountUsd, locale);
		}
		// The db checks give an old row the full plan triple. The dash covers a row that breaks that rule.
		if (
			row.plan === null ||
			row.tierCredits === null ||
			row.interval === null
		) {
			return "—";
		}
		return [
			history.plans[row.plan],
			t("credits.creditUnit", { count: row.tierCredits }),
			history[row.interval],
		].join(" · ");
	};
}
