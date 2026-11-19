// Reads of the header alerts: the overdue invoices and the deadlines of high priority, the oldest first.
// HeaderNotifications reads it after the shell renders. The rules come from invoice-status.ts and deadline.ts,
// so the bell counts the same invoices as the overdue figure of the billing page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { deadlinePriority } from "../lib/deadline";
import { getSampleTables } from "../lib/sample-data";

// linkOptions types each path, so a wrong path fails typecheck.
function invoiceLink(invoiceId: string) {
	return linkOptions({ to: "/app/billing", search: { invoice: invoiceId } });
}

function matterLink(matterId: string) {
	return linkOptions({ to: "/app/matters/$matterId", params: { matterId } });
}

/** One alert of the bell menu. */
export type Alert = {
	id: string;
	/** "overdueInvoice": an open balance past its due date. "deadline": a deadline in 3 days or less. */
	kind: "overdueInvoice" | "deadline";
	/** The invoice number with the client, or the deadline title. */
	title: string;
	/** The matter name. */
	detail: string;
	/** ISO time: the due date of the invoice or of the deadline. */
	at: string;
	link: ReturnType<typeof invoiceLink> | ReturnType<typeof matterLink>;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const now = Date.now();
			const tables = getSampleTables(now);
			const matterName = new Map(
				tables.matters.map((matter) => [matter.id, matter.name]),
			);
			const clientName = new Map(
				tables.clients.map((client) => [client.id, client.name]),
			);
			const overdueInvoices: Alert[] = tables.invoices
				.filter((invoice) => invoice.status === "overdue")
				.map((invoice) => ({
					id: invoice.id,
					kind: "overdueInvoice",
					title: `${invoice.number} · ${clientName.get(invoice.clientId) ?? ""}`,
					detail: matterName.get(invoice.matterId) ?? "",
					at: invoice.dueAt,
					link: invoiceLink(invoice.id),
				}));
			const urgentDeadlines: Alert[] = tables.deadlines
				.filter((deadline) => deadlinePriority(deadline.dueAt, now) === "high")
				.map((deadline) => ({
					id: deadline.id,
					kind: "deadline",
					title: deadline.title,
					detail: matterName.get(deadline.matterId) ?? "",
					at: deadline.dueAt,
					link: matterLink(deadline.matterId),
				}));
			return [...overdueInvoices, ...urgentDeadlines].sort((first, second) =>
				first.at.localeCompare(second.at),
			);
		},
	});
}
