// The Badge of one reservation status: a word and a color.
// The reservation list, the detail page, and the guest panel render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { ReservationStatus } from "../lib/sample-reservations";
import { RESERVATION_STATUS_BADGE } from "../lib/status-badges";

type ReservationStatusBadgeProps = {
	/** The status of the reservation at this minute. */
	status: ReservationStatus;
};

/** The label comes from the message key `reservationStatuses.<status>`. */
export function ReservationStatusBadge({
	status,
}: ReservationStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={RESERVATION_STATUS_BADGE[status]}>
			{t(`reservationStatuses.${status}`)}
		</Badge>
	);
}
