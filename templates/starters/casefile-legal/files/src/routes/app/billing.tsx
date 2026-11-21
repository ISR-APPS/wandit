// The billing page behind login. The /app layout checks the session first.
// The loader fills the KPI row, the recent lines, and the open invoices. Thin: the page lives in the billing feature.
import { createFileRoute } from "@tanstack/react-router";
import {
	BILLING_DEFAULT_DAYS,
	BillingPage,
	BillingPageError,
	BillingPageSkeleton,
	billingSearchSchema,
	billingSummaryQueryOptions,
	openInvoicesQueryOptions,
	recentLinesQueryOptions,
} from "~/features/billing";

/** /app/billing: money in and money due. `?invoice=` opens the dialog of one invoice. */
export const Route = createFileRoute("/app/billing")({
	validateSearch: billingSearchSchema,
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(
				billingSummaryQueryOptions(BILLING_DEFAULT_DAYS),
			),
			context.queryClient.query(recentLinesQueryOptions(BILLING_DEFAULT_DAYS)),
			context.queryClient.query(openInvoicesQueryOptions()),
		]),
	pendingComponent: BillingPageSkeleton,
	errorComponent: BillingPageError,
	component: BillingPage,
});
