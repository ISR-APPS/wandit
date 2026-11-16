// Reads of the billing page: hours per day, hours by practice area, the invoice list, the totals, and one invoice.
// The /app/billing route prefetches the first four. The trend reads other periods and the dialog reads one
// invoice with useQuery, after a click.
// The queryFn returns sample rows today. A later turn replaces its body with a Supabase call (STARTER.md).
import { queryOptions } from "@tanstack/react-query";
import { getSampleTables } from "~/features/practice";
import {
	buildBillingTotals,
	buildInvoiceFile,
	buildInvoiceList,
	hoursByArea,
	hoursPerDay,
} from "../lib/billing";

/** Logged hours per day for the last `days` days, with the same days one period earlier. Feeds the trend panel. */
export function hoursPerDayQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["time-entries", "per-day", days],
		queryFn: async () => {
			const now = Date.now();
			return hoursPerDay(getSampleTables(now), days, now);
		},
	});
}

/** Logged hours by practice area in the last `days` days, the largest first. Feeds the breakdown panel. */
export function hoursByAreaQueryOptions(days: number) {
	return queryOptions({
		queryKey: ["time-entries", "by-area", days],
		queryFn: async () => {
			const now = Date.now();
			return hoursByArea(getSampleTables(now), days, now);
		},
	});
}

/** Every invoice with its client and matter names, newest first. */
export function invoicesQueryOptions() {
	return queryOptions({
		queryKey: ["invoices", "list"],
		queryFn: async () => buildInvoiceList(getSampleTables()),
	});
}

/** The outstanding, overdue, and collected totals of the billing header. */
export function billingTotalsQueryOptions() {
	return queryOptions({
		queryKey: ["invoices", "totals"],
		queryFn: async () => {
			const now = Date.now();
			return buildBillingTotals(getSampleTables(now), now);
		},
	});
}

/** The lines and the payments of one invoice. null for an unknown id. */
export function invoiceQueryOptions(invoiceId: string) {
	return queryOptions({
		queryKey: ["invoices", "detail", invoiceId],
		queryFn: async () => buildInvoiceFile(getSampleTables(), invoiceId),
	});
}
