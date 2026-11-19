// The search params of the ticket list: the status tab lives in the URL, as /app/tickets?status=pending.
// The /app/tickets route validates the URL with this schema. Each tab of the page writes it.
import { z } from "zod";
import { TICKET_STATUSES } from "~/features/helpdesk";

/** `status` is absent for the "All" tab. An unknown value in the URL also reads as absent. */
export const ticketsSearchSchema = z.object({
	status: z.enum(TICKET_STATUSES).optional().catch(undefined),
});
