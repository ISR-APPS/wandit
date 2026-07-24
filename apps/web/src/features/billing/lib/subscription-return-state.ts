import type { Subscription } from "@wandit/contracts";

import type { BillingReturnCopy } from "./billing-return-copy";

export function subscriptionReturnStateFor(
	subscription: Subscription,
	copy: BillingReturnCopy["subscription"],
) {
	if (!subscription.entitled) {
		return {
			body: copy.paymentAttentionBody,
			needsPortal: true,
			title: copy.paymentAttentionTitle,
			tone: "warning" as const,
		};
	}

	return {
		body: copy.updatedBody,
		needsPortal: false,
		title: copy.updatedTitle,
		tone: "success" as const,
	};
}
