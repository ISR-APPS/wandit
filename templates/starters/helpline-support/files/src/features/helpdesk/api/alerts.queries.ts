// Reads of the header alerts: the open tickets past their SLA deadline, and the urgent tickets that nobody took.
// HeaderNotifications reads it after the shell renders. The rules come from lib/ticket-rules.ts,
// so the bell counts the same late tickets as the home table and the ticket page.
// The queryFn reads the sample tables. A later turn replaces its body with a Supabase call that returns the same type.
import { queryOptions } from "@tanstack/react-query";
import { linkOptions } from "@tanstack/react-router";
import { getSampleTables } from "../lib/sample-data";
import { isLate, isOpenStatus, slaDueAt } from "../lib/ticket-rules";

// Each alert opens the page of its ticket. linkOptions types the path, so a wrong path fails typecheck.
function ticketLink(ticketId: string) {
	return linkOptions({ to: "/app/tickets/$ticketId", params: { ticketId } });
}

/** One alert of the bell menu. */
export type Alert = {
	/** The ticket number. One ticket gives at most one alert. */
	id: string;
	/** "slaBreach": an open ticket past its deadline. "unassignedUrgent": an urgent ticket with no agent, not late yet. */
	kind: "slaBreach" | "unassignedUrgent";
	/** The ticket subject. */
	title: string;
	/** The customer company of the ticket. */
	detail: string;
	/** ISO time: the missed deadline, or the creation of the unassigned ticket. */
	at: string;
	link: ReturnType<typeof ticketLink>;
};

/** Every alert, the oldest first. The bell shows the count and the first 5. */
export function alertsQueryOptions() {
	return queryOptions({
		queryKey: ["alerts"],
		queryFn: async (): Promise<Alert[]> => {
			const tables = getSampleTables();
			const now = Date.now();
			const customers = new Map(
				tables.customers.map((customer) => [customer.id, customer.name]),
			);
			const alerts: Alert[] = [];
			for (const ticket of tables.tickets) {
				if (!isOpenStatus(ticket.status)) {
					continue;
				}
				const dueAt = slaDueAt(
					ticket.status,
					ticket.priority,
					ticket.createdAt,
				);
				const base = {
					id: ticket.id,
					title: ticket.subject,
					detail: customers.get(ticket.customerId) ?? "",
					link: ticketLink(ticket.id),
				};
				// A late ticket is the stronger alert, so an urgent late ticket shows once, as late.
				if (dueAt !== null && isLate(dueAt, now)) {
					alerts.push({ ...base, kind: "slaBreach", at: dueAt });
				} else if (ticket.priority === "urgent" && ticket.assigneeId === null) {
					alerts.push({
						...base,
						kind: "unassignedUrgent",
						at: ticket.createdAt,
					});
				}
			}
			return alerts.sort((first, second) => first.at.localeCompare(second.at));
		},
	});
}
