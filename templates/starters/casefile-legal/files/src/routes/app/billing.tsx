// The billing page behind login. The /app layout checks the session first.
// The loader fills the trend, the breakdown, the totals, and the invoice list. Thin: the page lives in the billing feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	BILLING_DAYS,
	BillingPage,
	BillingPageError,
	BillingPageSkeleton,
	billingSearchSchema,
	billingTotalsQueryOptions,
	hoursByAreaQueryOptions,
	hoursPerDayQueryOptions,
	invoicesQueryOptions,
} from "~/features/billing";

/** /app/billing: logged time and invoices. `?invoice=` opens the dialog of one invoice. */
export const Route = createFileRoute("/app/billing")({
	validateSearch: billingSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(hoursPerDayQueryOptions(BILLING_DAYS)),
			context.queryClient.query(hoursByAreaQueryOptions(BILLING_DAYS)),
			context.queryClient.query(billingTotalsQueryOptions()),
			context.queryClient.query(invoicesQueryOptions()),
		]),
	pendingComponent: BillingPageSkeleton,
	errorComponent: BillingPageError,
	component: BillingPage,
});
