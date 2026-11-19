// The status of a ticket as a Badge: the word and the color of TICKET_STATUS_BADGE.
// The ticket list, the ticket thread, and the customer and article sheets render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { TICKET_STATUS_BADGE, type TicketStatus } from "../lib/ticket-rules";

type TicketStatusBadgeProps = {
	status: TicketStatus;
};

/** One status badge. The label is `tickets.statuses.<status>`. */
export function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={TICKET_STATUS_BADGE[status]}>
			{t(`tickets.statuses.${status}`)}
		</Badge>
	);
}
