/**
 * /billing/slickpay: SlickPay sends the buyer here after the payment, with ?payment=<slickpay_payments id>.
 * The "_" after "billing" keeps this route out of the /billing page, which has no outlet for child routes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { uuidSchema } from "@wandit/contracts";

import SlickpayReturnPage from "@/features/billing/pages/slickpay-return-page";

type SlickpayReturnSearch = {
	/** Id of the row in `slickpay_payments`. Undefined when the value is not a uuid. */
	payment: string | undefined;
};

export const Route = createFileRoute("/_auth/billing_/slickpay")({
	validateSearch: (search: Record<string, unknown>): SlickpayReturnSearch => {
		const parsed = uuidSchema.safeParse(search.payment);

		return { payment: parsed.success ? parsed.data : undefined };
	},
	component: SlickpayReturnRoute,
});

function SlickpayReturnRoute() {
	const search = Route.useSearch();

	return <SlickpayReturnPage paymentId={search.payment} />;
}
