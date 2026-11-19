// The reply box of the ticket thread: adds an agent reply or an internal note to the open ticket.
// TicketThread calls the hook. The sample app has no table, so the write lives in the query cache.
// LIMIT: the reply lasts for the browser session only; a reload of the sample tables drops it. Upgrade: insert into ticket_messages (STARTER.md).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ConversationEntry, ticketQueryOptions } from "./tickets.queries";

/** The input of one reply. */
export type ReplyInput = {
	/** "agent" sends the text to the customer. "note" keeps it inside the team. */
	kind: "agent" | "note";
	/** The text of the reply, already trimmed and not empty. */
	body: string;
	/** The name that the thread shows as the author. */
	authorName: string;
};

/** Adds one reply to the conversation of `ticketId`. onSuccess writes it at the end of the cached ticket. */
export function useAddReplyMutation(ticketId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: ReplyInput): Promise<ConversationEntry> => ({
			kind: input.kind,
			id: crypto.randomUUID(),
			authorName: input.authorName,
			body: input.body,
			at: new Date().toISOString(),
		}),
		onSuccess: (entry) => {
			queryClient.setQueryData(
				ticketQueryOptions(ticketId).queryKey,
				(ticket) =>
					ticket
						? { ...ticket, conversation: [...ticket.conversation, entry] }
						: ticket,
			);
		},
	});
}
