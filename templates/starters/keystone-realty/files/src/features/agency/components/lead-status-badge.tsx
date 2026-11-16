// The badge of a lead status: a word and a color.
// The leads table, the lead panel, and the enquiry list of a listing render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { LeadStatus } from "../lib/sample-leads";
import { LEAD_STATUS_BADGE } from "../lib/status-badges";

type LeadStatusBadgeProps = {
	/** The status of the lead at the time of the read. */
	status: LeadStatus;
};

/** The label is the message `agency.leadStatuses.<status>`. */
export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={LEAD_STATUS_BADGE[status]}>
			{t(`agency.leadStatuses.${status}`)}
		</Badge>
	);
}
