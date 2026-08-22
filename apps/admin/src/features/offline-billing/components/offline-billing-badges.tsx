import { Badge } from "@/components/ui/badge";
import type { AdminManualRequest } from "@/features/offline-billing/api/offline-billing.dto";

const REQUEST_STATUS_LABELS: Record<AdminManualRequest["status"], string> = {
	pending: "Pending",
	contacted: "Contacted",
	approved: "Approved",
	rejected: "Rejected",
	canceled: "Canceled",
};

export function ManualRequestStatusBadge({
	status,
}: {
	status: AdminManualRequest["status"];
}) {
	return (
		<Badge
			variant={
				status === "approved"
					? "default"
					: status === "rejected" || status === "canceled"
						? "destructive"
						: status === "contacted"
							? "secondary"
							: "outline"
			}
		>
			{REQUEST_STATUS_LABELS[status]}
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

export function ManualSubscriptionGraceBadge() {
	return (
		<Badge className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
			In grace
		</Badge>
	);
}
