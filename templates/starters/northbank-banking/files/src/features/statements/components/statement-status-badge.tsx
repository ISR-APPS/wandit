// The status of one statement, in a Badge: "N days left" for the open month, "Final" for a closed one.
// The statement tiles, the statement page, and its related list render it.
import { countLabel } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { StatementStatus } from "../lib/statements";

type StatementStatusBadgeProps = {
	/** "open" for the month of today, "closed" for a final statement. */
	status: StatementStatus;
	/** Days from today to the month end. Only the open month reads it. */
	daysLeft: number;
};

/** The open month still changes, so it gets the info color; a final statement is quiet. */
export function StatementStatusBadge({
	status,
	daysLeft,
}: StatementStatusBadgeProps) {
	const { t, locale } = useT();
	if (status === "closed") {
		return <Badge variant="outline">{t("statements.statuses.closed")}</Badge>;
	}
	return (
		<Badge variant="info">
			{countLabel(
				daysLeft,
				t("statements.daysLeftOne"),
				t("statements.daysLeftOther"),
				locale,
			)}
		</Badge>
	);
}
