// The status word of one statement, in a Badge: in progress for the month of today, final for a closed month.
// The statements table and the statement page render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { StatementStatus } from "../lib/statements";

type StatementStatusBadgeProps = {
	status: StatementStatus;
};

/** "In progress" is info, because its figures still change. "Final" is quiet. */
export function StatementStatusBadge({ status }: StatementStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={status === "open" ? "info" : "outline"}>
			{t(`statements.statuses.${status}`)}
		</Badge>
	);
}
