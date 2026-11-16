// Reads of customers: every company with its plan, revenue, people, and ticket figures of the last 90 days.
// The /app/customers route prefetches it. CustomersPage and the customer sheet read it with useSuspenseQuery.
// The queryFn reads the sample tables. A later turn replaces it with a Supabase select and one SQL read function.
import { queryOptions } from "@tanstack/react-query";
import {
	type ContactRow,
	type CustomerRow,
	dayAge,
	getSampleTables,
	isOpenStatus,
	PLAN_SEAT_PRICE,
	type TicketStatus,
} from "~/features/helpdesk";

/** The days of the ticket figures of a customer. */
export const CUSTOMER_FIGURE_DAYS = 90;

// Fewer ratings give no useful share: one bad rating of two would read as 50 %.
const MIN_RATINGS = 3;

/** One recent ticket of a customer, for the sheet. */
export type CustomerTicket = {
	id: string;
	subject: string;
	status: TicketStatus;
	createdAt: string;
};

/** One customer company with its derived figures. Times are ISO texts. */
export type CustomerListItem = CustomerRow & {
	/** Monthly revenue in whole units of CURRENCY: seats times the seat price of the plan. */
	mrr: number;
	openTickets: number;
	/** Tickets created in the last CUSTOMER_FIGURE_DAYS days. */
	recentTicketCount: number;
	/** Share of good ratings in the last CUSTOMER_FIGURE_DAYS days, 0 to 1. null under MIN_RATINGS ratings. */
	satisfaction: number | null;
	contacts: Pick<ContactRow, "id" | "name" | "title" | "email">[];
	/** The 5 newest tickets, newest first. */
	recentTickets: CustomerTicket[];
};

/** Every customer, the highest revenue first. */
export function customersQueryOptions() {
	return queryOptions({
		queryKey: ["customers", "list"],
		queryFn: async (): Promise<CustomerListItem[]> => {
			const now = Date.now();
			const tables = getSampleTables();
			return tables.customers
				.map((customer) => {
					const tickets = tables.tickets
						.filter((ticket) => ticket.customerId === customer.id)
						.sort(
							(first, second) =>
								Date.parse(second.createdAt) - Date.parse(first.createdAt),
						);
					const recent = tickets.filter(
						(ticket) => dayAge(ticket.createdAt, now) < CUSTOMER_FIGURE_DAYS,
					);
					const rated = recent.filter((ticket) => ticket.rating !== null);
					return {
						...customer,
						mrr: customer.seats * PLAN_SEAT_PRICE[customer.plan],
						openTickets: tickets.filter((ticket) => isOpenStatus(ticket.status))
							.length,
						recentTicketCount: recent.length,
						satisfaction:
							rated.length < MIN_RATINGS
								? null
								: rated.filter((ticket) => ticket.rating === "good").length /
									rated.length,
						contacts: tables.contacts
							.filter((contact) => contact.customerId === customer.id)
							.map(({ id, name, title, email }) => ({
								id,
								name,
								title,
								email,
							})),
						recentTickets: tickets.slice(0, 5).map((ticket) => ({
							id: ticket.id,
							subject: ticket.subject,
							status: ticket.status,
							createdAt: ticket.createdAt,
						})),
					};
				})
				.sort((first, second) => second.mrr - first.mrr);
		},
	});
}
