// The status of one appointment as a word in a Badge.
// The agenda, the day board, the lists, and the detail panel render it.
// A late patient shows "Late" in place of the stored status: the front desk must act on it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	APPOINTMENT_STATUS_BADGE,
	type AppointmentStatus,
} from "../lib/appointment-status";

type AppointmentStatusBadgeProps = {
	status: AppointmentStatus;
	/** True when the patient is expected and the start time passed. See `isLate`. */
	isLate?: boolean;
	className?: string;
};

/** A status is a word and a color. A cancelled visit is muted, so it differs from a booking that waits for a confirmation. */
export function AppointmentStatusBadge({
	status,
	isLate = false,
	className,
}: AppointmentStatusBadgeProps) {
	const { t } = useT();
	if (isLate) {
		return (
			<Badge variant="warning" className={className}>
				{t("appointmentStatuses.late")}
			</Badge>
		);
	}
	return (
		<Badge
			variant={APPOINTMENT_STATUS_BADGE[status]}
			className={cn(
				status === "cancelled" && "text-muted-foreground",
				className,
			)}
		>
			{t(`appointmentStatuses.${status}`)}
		</Badge>
	);
}
