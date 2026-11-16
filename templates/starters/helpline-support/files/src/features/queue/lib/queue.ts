// The rules of the queue home: which tickets are open and their order. The first ticket of the order is Next up.
// QueuePage calls openTicketsInOrder on the rows of the ticket list query.
import { isOpenStatus, TICKET_PRIORITIES } from "~/features/helpdesk";
import type { TicketListItem } from "~/features/tickets";

/** The period of the Solved panel on the first load, in days. */
export const DEFAULT_DAYS = 30;

/** The most rows that the queue panel shows. 8 rows match the height of Next up. "See all tickets" opens the full list. */
export const QUEUE_LIMIT = 8;

/**
 * The open tickets, soonest deadline first, so the most overdue ticket leads. A ticket with no deadline (pending) goes last.
 * Equal deadlines: the higher priority first, then the oldest ticket.
 * LIMIT: filters the full ticket list in the browser. Upgrade: an open-tickets query with a status filter in SQL.
 */
export function openTicketsInOrder(
	tickets: TicketListItem[],
): TicketListItem[] {
	return tickets
		.filter((ticket) => isOpenStatus(ticket.status))
		.sort((first, second) => {
			const firstDue = first.dueAt
				? Date.parse(first.dueAt)
				: Number.POSITIVE_INFINITY;
			const secondDue = second.dueAt
				? Date.parse(second.dueAt)
				: Number.POSITIVE_INFINITY;
			if (firstDue !== secondDue) {
				return firstDue - secondDue;
			}
			const byPriority =
				TICKET_PRIORITIES.indexOf(first.priority) -
				TICKET_PRIORITIES.indexOf(second.priority);
			return byPriority !== 0
				? byPriority
				: Date.parse(first.createdAt) - Date.parse(second.createdAt);
		});
}
