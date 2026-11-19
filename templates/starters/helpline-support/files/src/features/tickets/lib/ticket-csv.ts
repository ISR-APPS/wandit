// The CSV columns of a ticket export. The Tickets page and the home table export the same columns.
// The callers pass them to toCsv of the helpdesk feature in their click handlers.
import type { CsvColumn } from "~/features/helpdesk";
import type { TranslationKey } from "~/shared/i18n";
import type { TicketListItem } from "../api/tickets.queries";

/**
 * The columns of a ticket file. Dates stay ISO times in UTC, so a spreadsheet can sort them.
 * `t` is the translate function of useT().
 */
export function ticketCsvColumns(
	t: (key: TranslationKey) => string,
): CsvColumn<TicketListItem>[] {
	return [
		{ header: t("tickets.number"), value: (ticket) => ticket.id },
		{ header: t("tickets.subject"), value: (ticket) => ticket.subject },
		{ header: t("tickets.customer"), value: (ticket) => ticket.customer.name },
		{
			header: t("tickets.requester"),
			value: (ticket) => ticket.requester.name,
		},
		{
			header: t("tickets.status"),
			value: (ticket) => t(`tickets.statuses.${ticket.status}`),
		},
		{
			header: t("tickets.priority"),
			value: (ticket) => t(`tickets.priorities.${ticket.priority}`),
		},
		{
			header: t("tickets.channel"),
			value: (ticket) => t(`tickets.channels.${ticket.channel}`),
		},
		{
			header: t("tickets.assignee"),
			value: (ticket) => ticket.assignee?.name ?? t("tickets.unassigned"),
		},
		{ header: t("tickets.created"), value: (ticket) => ticket.createdAt },
		{ header: t("tickets.due"), value: (ticket) => ticket.dueAt ?? "" },
	];
}
