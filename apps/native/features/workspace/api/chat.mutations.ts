import { useMutation } from "@tanstack/react-query";

import { sendChatMessage } from "@/features/workspace/api/chat.requests";

export type SendChatMessageVariables = {
	chatId: string;
	text: string;
};

/**
 * chat.mutations.ts — write hook for queueing one user message.
 *
 * Native chat deliberately sends only { text }; mode/quality/attachments are
 * visual composer affordances until the backend contract explicitly accepts
 * them for mobile.
 */
export function useSendChatMessage() {
	return useMutation({
		mutationFn: ({ chatId, text }: SendChatMessageVariables) =>
			sendChatMessage(chatId, { text }),
	});
}
