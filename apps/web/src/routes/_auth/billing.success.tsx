import { createFileRoute } from "@tanstack/react-router";
import { CHECKOUT_PURPOSE, type CheckoutPurpose } from "@wandit/contracts";

import BillingSuccessPage from "@/features/billing/pages/billing-success-page";

type BillingSuccessSearch = {
	purpose: CheckoutPurpose | undefined;
	session_id: string | undefined;
};

export const Route = createFileRoute("/_auth/billing/success")({
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
