// The status word of one payee, in a Badge: active or idle.
// The payees table and the payee page render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { PayeeStatus } from "../lib/payee-summary";

type PayeeStatusBadgeProps = {
	/** "active" when the payee got a payment in the last 90 days. */
	status: PayeeStatus;
};

/** An idle payee is not an error, so it gets the quiet outline style. */
export function PayeeStatusBadge({ status }: PayeeStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={status === "active" ? "success" : "outline"}>
			{t(`payees.statuses.${status}`)}
		</Badge>
	);
}
