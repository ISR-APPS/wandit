import { billingCancelRequestSchema } from "@wandit/contracts";
import type { CancellationReasonCode } from "../api/billing.dto";

export function parseBillingCancelRequest(
	reason: CancellationReasonCode | null,
	details: string,
) {
	const trimmedDetails = details.trim();

	return billingCancelRequestSchema.safeParse({
		details: trimmedDetails || undefined,
		reason: reason ?? undefined,
	});
}
