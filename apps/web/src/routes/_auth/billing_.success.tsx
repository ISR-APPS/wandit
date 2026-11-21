/**
 * /billing/success: Stripe sends the buyer here after a card payment, with ?purpose and ?session_id.
 * The "_" after "billing" keeps this route out of the /billing page, which has no outlet for child routes.
 * Without it, the wallet page shows and a buyer can pay the Starter pass a second time.
 */
import { createFileRoute } from "@tanstack/react-router";
import { CHECKOUT_PURPOSE, type CheckoutPurpose } from "@wandit/contracts";

import BillingSuccessPage from "@/features/billing/pages/billing-success-page";

type BillingSuccessSearch = {
	purpose: CheckoutPurpose | undefined;
	session_id: string | undefined;
};

export const Route = createFileRoute("/_auth/billing_/success")({
	validateSearch: (search: Record<string, unknown>): BillingSuccessSearch => ({
		purpose:
			search.purpose === CHECKOUT_PURPOSE.subscription ||
			search.purpose === CHECKOUT_PURPOSE.topup ||
			search.purpose === CHECKOUT_PURPOSE.order
				? search.purpose
				: undefined,
		session_id:
			typeof search.session_id === "string" && search.session_id.trim()
				? search.session_id.trim()
				: undefined,
	}),
	component: BillingSuccessRoute,
});

function BillingSuccessRoute() {
	const search = Route.useSearch();

	return (
		<BillingSuccessPage
			purpose={search.purpose}
			sessionId={search.session_id}
		/>
	);
}
