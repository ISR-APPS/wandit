/**
 * Shows status badges in offline billing tables and detail sheets.
 * Uses the shared request labels and the Badge component.
 */
import { Badge } from "@/components/ui/badge";
import type { AdminManualRequest } from "@/features/offline-billing/api/offline-billing.dto";
import { MANUAL_REQUEST_STATUS_LABELS } from "@/features/offline-billing/lib/offline-billing";

// Amber marks a row that needs attention and is not closed.
const AMBER_BADGE_CLASS =
	"border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";

/** Shown in the requests table and the detail sheet. The tone follows the status. */
export function ManualRequestStatusBadge({
	status,
}: {
	status: AdminManualRequest["status"];
}) {
	return (
		<Badge
			className={
				status === "no_answer" || status === "wrong_number"
					? AMBER_BADGE_CLASS
					: undefined
			}
			// These tones separate completed requests from calls that need further action.
			variant={
				status === "approved"
					? "default"
					: status === "rejected" || status === "canceled"
						? "destructive"
						: status === "contacted" ||
								status === "call_back" ||
								status === "awaiting_payment"
							? "secondary"
							: "outline"
			}
		>
			{MANUAL_REQUEST_STATUS_LABELS[status]}
		</Badge>
	);
}

export function ManualSubscriptionStatusBadge({
	entitled,
}: {
	entitled: boolean;
}) {
	return (
		<Badge variant={entitled ? "default" : "secondary"}>
			{entitled ? "Active" : "Ended"}
		</Badge>
	);
}

/** Shown on a manual subscription past its period end that still has access. */
export function ManualSubscriptionGraceBadge() {
	return <Badge className={AMBER_BADGE_CLASS}>In grace</Badge>;
}
