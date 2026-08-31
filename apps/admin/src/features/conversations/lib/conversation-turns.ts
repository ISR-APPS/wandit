import type { ChatMessage } from "@/features/conversations/api/conversations.dto";

export type ConversationTurn = {
	id: string;
	createdAt: string;
	userMessageId: string | null;
	messages: ChatMessage[];
};

export function groupConversationTurns(
	messages: ChatMessage[],
): ConversationTurn[] {
	const turns: ConversationTurn[] = [];
	let current: ConversationTurn | null = null;

	for (const message of messages.toSorted(
		(left, right) => left.seq - right.seq,
	)) {
		if (message.role === "system") {
			flushCurrent();
			turns.push(createTurn(message, null));
			continue;
		}

		if (message.role === "user") {
			flushCurrent();
			current = createTurn(message, message.id);
			continue;
		}

		if (current && current.userMessageId) {
			current.messages.push(message);
			continue;
		}

		if (current) {
			current.messages.push(message);
			continue;
		}

		current = createTurn(message, null);
	}

	flushCurrent();
	return turns;

	function flushCurrent() {
		if (current) {
			turns.push(current);
			current = null;
		}
	}
}

function createTurn(
	message: ChatMessage,
	userMessageId: string | null,
): ConversationTurn {
	return {
		id: `turn-${message.id}`,
		createdAt: message.createdAt,
		userMessageId,
		messages: [message],
	};
}
