import type Stripe from "stripe";

export type NonAdverseDisputeStatus = Extract<
	Stripe.Dispute.Status,
	"prevented" | "warning_closed" | "won"
>;

export const NON_ADVERSE_DISPUTE_STATUSES: ReadonlySet<Stripe.Dispute.Status> =
	new Set(["prevented", "warning_closed", "won"]);

export function isNonAdverseDisputeStatus(
	status: Stripe.Dispute.Status,
): status is NonAdverseDisputeStatus {
	return NON_ADVERSE_DISPUTE_STATUSES.has(status);
}
