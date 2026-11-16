// Reads of tickets: the list with its joins, and one ticket with its conversation, customer, and related rows.
// The list, detail, and home routes prefetch them in their loaders. The pages read them with useSuspenseQuery.
// Each queryFn reads the sample tables of the helpdesk feature. A later turn replaces it with a Supabase call.
import { queryOptions } from "@tanstack/react-query";
import {
	type ArticleCollection,
	type CustomerPlan,
	getSampleTables,
	isOpenStatus,
	PLAN_SEAT_PRICE,
	type SampleTables,
	slaDueAt,
	type TicketEventRow,
	type TicketRating,
	type TicketRow,
} from "~/features/helpdesk";

/** One ticket of the list, with the names of its customer, requester, and assignee. Times are ISO texts. */
export type TicketListItem = Omit<
	TicketRow,
	"customerId" | "requesterId" | "assigneeId" | "articleId" | "rating"
> & {
	/** The next SLA deadline (slaDueAt), or null when no clock runs: pending, solved, or closed. */
	dueAt: string | null;
	/** The time of the last message. The list meta line and the Next up "Last update" show it. */
	lastActivityAt: string;
	/** The last message of the customer, for the Next up panel. */
	preview: string;
	customer: { id: string; name: string; plan: CustomerPlan };
	requester: { name: string; email: string };
	/** null while nobody took the ticket. */
	assignee: { id: string; name: string } | null;
};

/** One line of a conversation: a message (customer, agent, or internal note), or a change of the ticket. */
export type ConversationEntry =
	| {
			kind: "customer" | "agent" | "note";
			id: string;
			authorName: string;
			body: string;
			at: string;
	  }
	| {
			kind: "event";
			id: string;
			event: TicketEventRow["type"];
			/** The agent of the change. null for the nightly job that closes solved tickets. */
			agentName: string | null;
			at: string;
	  };

/** Another ticket of the same customer, for the "Same customer" panel. */
export type RelatedTicket = Pick<
	TicketListItem,
	"id" | "subject" | "status" | "createdAt"
>;

/** One ticket with everything that its page shows. */
export type TicketDetail = TicketListItem & {
	requester: { name: string; email: string; title: string };
	customer: {
		id: string;
		name: string;
		plan: CustomerPlan;
		city: string;
		seats: number;
		/** Monthly revenue in whole units of CURRENCY: seats times the seat price of the plan. */
		mrr: number;
		/** Open tickets of this customer, this one included. */
		openTickets: number;
	};
	rating: TicketRating | null;
	/** Messages and changes, oldest first. */
	conversation: ConversationEntry[];
	/** The help article that the first reply links. */
	article: { id: string; title: string; collection: ArticleCollection } | null;
	/** The 5 newest other tickets of the customer. */
	relatedTickets: RelatedTicket[];
};

// The joins of one ticket row: the same work as a select with embedded rows.
function toListItem(
	ticket: TicketRow,
	tables: SampleTables,
	lastMessages: Map<string, { at: string; preview: string }>,
): TicketListItem {
	const { customerId, requesterId, assigneeId, articleId, rating, ...row } =
		ticket;
	const customer = tables.customers.find((item) => item.id === customerId);
	const requester = tables.contacts.find((item) => item.id === requesterId);
	const assignee = tables.agents.find((item) => item.id === assigneeId);
	const last = lastMessages.get(ticket.id);
	return {
		...row,
		dueAt: slaDueAt(ticket.status, ticket.priority, ticket.createdAt),
		lastActivityAt: last?.at ?? ticket.createdAt,
		preview: last?.preview ?? "",
		customer: {
			id: customerId,
			name: customer?.name ?? "",
			plan: customer?.plan ?? "starter",
		},
		requester: { name: requester?.name ?? "", email: requester?.email ?? "" },
		assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
	};
}

// The time of the last message of each ticket, and the text of the last customer message.
function lastMessagesOf(
	tables: SampleTables,
): Map<string, { at: string; preview: string }> {
	const result = new Map<string, { at: string; preview: string }>();
	// The messages are in time order per ticket, so the last write wins.
	for (const message of tables.messages) {
		const current = result.get(message.ticketId);
		result.set(message.ticketId, {
			at: message.sentAt,
			preview:
				message.kind === "customer" ? message.body : (current?.preview ?? ""),
		});
	}
	return result;
}

/** Every ticket, newest first. The list page, the queue, and the home read it. */
export function ticketsQueryOptions() {
	return queryOptions({
		queryKey: ["tickets", "list"],
		queryFn: async (): Promise<TicketListItem[]> => {
			const tables = getSampleTables();
			const lastMessages = lastMessagesOf(tables);
			return tables.tickets
				.map((ticket) => toListItem(ticket, tables, lastMessages))
				.sort(
					(first, second) =>
						Date.parse(second.createdAt) - Date.parse(first.createdAt),
				);
		},
	});
}

/** One ticket with its conversation, or null when the number does not exist. */
export function ticketQueryOptions(ticketId: string) {
	return queryOptions({
		queryKey: ["tickets", "detail", ticketId],
		queryFn: async (): Promise<TicketDetail | null> => {
			const tables = getSampleTables();
			const ticket = tables.tickets.find((item) => item.id === ticketId);
			const customer = tables.customers.find(
				(item) => item.id === ticket?.customerId,
			);
			const requester = tables.contacts.find(
				(item) => item.id === ticket?.requesterId,
			);
			if (!ticket || !customer || !requester) {
				return null;
			}
			const item = toListItem(ticket, tables, lastMessagesOf(tables));
			const agentName = (agentId: string | null) =>
				tables.agents.find((agent) => agent.id === agentId)?.name ?? null;
			const conversation: ConversationEntry[] = [
				...tables.messages
					.filter((message) => message.ticketId === ticketId)
					.map((message) => ({
						kind: message.kind,
						id: message.id,
						authorName: message.authorName,
						body: message.body,
						at: message.sentAt,
					})),
				...tables.events
					.filter((event) => event.ticketId === ticketId)
					.map((event) => ({
						kind: "event" as const,
						id: event.id,
						event: event.type,
						agentName: agentName(event.agentId),
						at: event.occurredAt,
					})),
			].sort((first, second) => Date.parse(first.at) - Date.parse(second.at));
			const customerTickets = tables.tickets.filter(
				(row) => row.customerId === customer.id,
			);
			const article = tables.articles.find(
				(row) => row.id === ticket.articleId,
			);
			return {
				...item,
				requester: {
					name: requester.name,
					email: requester.email,
					title: requester.title,
				},
				customer: {
					id: customer.id,
					name: customer.name,
					plan: customer.plan,
					city: customer.city,
					seats: customer.seats,
					mrr: customer.seats * PLAN_SEAT_PRICE[customer.plan],
					openTickets: customerTickets.filter((row) => isOpenStatus(row.status))
						.length,
				},
				rating: ticket.rating,
				conversation,
				article: article
					? {
							id: article.id,
							title: article.title,
							collection: article.collection,
						}
					: null,
				relatedTickets: customerTickets
					.filter((row) => row.id !== ticketId)
					.sort(
						(first, second) =>
							Date.parse(second.createdAt) - Date.parse(first.createdAt),
					)
					.slice(0, 5)
					.map((row) => ({
						id: row.id,
						subject: row.subject,
						status: row.status,
						createdAt: row.createdAt,
					})),
			};
		},
	});
}
