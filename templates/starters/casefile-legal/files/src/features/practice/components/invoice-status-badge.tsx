// The status of an invoice as a Badge: the word and the color of its status.
// The billing table, the invoice dialog, the matter detail page, and the client sheet render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	INVOICE_STATUS_BADGE,
	type InvoiceStatus,
} from "../lib/invoice-status";

type InvoiceStatusBadgeProps = {
	status: InvoiceStatus;
};

/** The word carries the meaning; the color only repeats it. */
export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={INVOICE_STATUS_BADGE[status]}>
			{t(`invoiceStatus.${status}`)}
		</Badge>
	);
}
