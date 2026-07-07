import type { ChatMessage, MessageRole } from "@wandit/contracts";

export type ChatThreadMessage = {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
};

export function extractChatMessageText(parts: ChatMessage["parts"]) {
	let text = "";

	for (const part of parts) {
		if (
			part &&
			typeof part === "object" &&
			(part as { type?: unknown }).type === "text"
		) {
			const value = (part as { text?: unknown }).text;
			if (typeof value === "string") {
				text += value;
			}
		}
	}

	return text;
}
