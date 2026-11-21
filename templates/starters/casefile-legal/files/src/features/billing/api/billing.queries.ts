// Reads of the billing page: the KPI row of a period, the recent invoices and payments, the open invoices,
// and one invoice. The /app/billing route prefetches the first three with the default period.
// Another period loads in the page with useQuery. The dialog reads one invoice with useQuery, after a click.
// The queryFn returns sample rows today. A later turn replaces its body with a Supabase call (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables, type PeriodDays } from "~/features/practice";
import {
	buildBillingSummary,
	buildInvoiceFile,
	buildOpenInvoices,
	buildRecentLines,
} from "../lib/billing";

/** The first period of the page header. A firm bills in 30-day periods. */
export const BILLING_DEFAULT_DAYS: PeriodDays = 30;

/** Collected, billed, days to pay, and outstanding for the last `days` days. Feeds the KPI row. */
export function billingSummaryQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["invoices", "summary", days],
		queryFn: async () => {
			const now = Date.now();
			return buildBillingSummary(getSampleTables(now), days, now);
		},
	});
}

/** The invoices issued and the payments received in the last `days` days, newest first. Feeds the "Recent" tab. */
export function recentLinesQueryOptions(days: PeriodDays) {
	return queryOptions({
		queryKey: ["invoices", "recent", days],
		queryFn: async () => {
			const now = Date.now();
			return buildRecentLines(getSampleTables(now), days, now);
		},
	});
}

/** Every invoice with an open balance, the earliest due date first. Feeds the "Upcoming" tab. */
export function openInvoicesQueryOptions() {
	return queryOptions({
		queryKey: ["invoices", "open"],
		queryFn: async () => buildOpenInvoices(getSampleTables()),
	});
}

/** The lines and the payments of one invoice. null for an unknown id. */
export function invoiceQueryOptions(invoiceId: string) {
	return queryOptions({
		queryKey: ["invoices", "detail", invoiceId],
		queryFn: async () => buildInvoiceFile(getSampleTables(), invoiceId),
	});
}
