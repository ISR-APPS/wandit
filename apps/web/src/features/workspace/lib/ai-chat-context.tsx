import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";

import { useAiChat } from "./use-ai-chat";

export type SharedAiChat = ReturnType<typeof useAiChat>;

type AiChatControls = Pick<
	SharedAiChat,
	"status" | "error" | "sendText" | "aiTargets"
>;

const SharedAiChatContext = createContext<SharedAiChat | null>(null);
const AiChatControlsContext = createContext<AiChatControls | null>(null);

/** Owns the workspace's single AI SDK chat instance for both left panes. */
export function AiChatProvider({
	projectId,
	children,
}: {
	projectId: string;
	children: ReactNode;
}) {
	const chat = useAiChat(projectId);
	// Inspector/preview consumers need turn state, not every streamed token.
	// Keep their context stable while only `messages` changes.
	const controls = useMemo<AiChatControls>(
		() => ({
			status: chat.status,
			error: chat.error,
			sendText: chat.sendText,
			aiTargets: chat.aiTargets,
		}),
		[chat.status, chat.error, chat.sendText, chat.aiTargets],
	);

	return (
		<SharedAiChatContext.Provider value={chat}>
			<AiChatControlsContext.Provider value={controls}>
				{children}
			</AiChatControlsContext.Provider>
		</SharedAiChatContext.Provider>
	);
}

/** Full shared conversation state for ChatPane. */
export function useSharedAiChat(): SharedAiChat {
	const chat = useContext(SharedAiChatContext);
	if (!chat) {
		throw new Error("useSharedAiChat must be used inside <AiChatProvider>");
	}
	return chat;
}

/** Stable scoped-send/pulse state for the inspector and preview. */
export function useAiChatControls(): AiChatControls {
	const controls = useContext(AiChatControlsContext);
	if (!controls) {
		throw new Error("useAiChatControls must be used inside <AiChatProvider>");
	}
	return controls;
}
