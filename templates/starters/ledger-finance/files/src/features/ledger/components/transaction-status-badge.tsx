// The status of one transaction as a word on a color.
// The transaction table, the detail page, and the lists of the accounts and budgets pages render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { TransactionStatus } from "../lib/sample-transactions";
import { TRANSACTION_STATUS_BADGE } from "../lib/transaction-status";

type TransactionStatusBadgeProps = {
	status: TransactionStatus;
};

/** The label is the message `transactionStatuses.<status>`. */
export function TransactionStatusBadge({
	status,
}: TransactionStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={TRANSACTION_STATUS_BADGE[status]}>
			{t(`transactionStatuses.${status}`)}
		</Badge>
	);
}
