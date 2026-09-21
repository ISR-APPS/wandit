/**
 * The one chat hook the app-builder page calls. Joins the workspace chat
 * queries (project id -> chat id -> stored history) with the live turn
 * stream of use-builder-chat.ts, maps the stream messages to the card
 * shapes the pane renders, and turns a rejected send into a dictionary
 * sentence. Calls the workspace queries, use-builder-chat.ts,
 * builder-chat-transport.ts, and turn-parts.ts.
 */

import type { ChatMessage } from "@wandit/contracts";
import { useMemo } from "react";

import {
	useChatByProjectQuery,
	useChatMessagesQuery,
} from "@/features/workspace";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { BuilderMessage } from "../api/dto";
import { hydrateTurnMessages } from "./builder-chat-transport";
import { type TurnPartLabels, toBuilderMessages } from "./turn-parts";
import {
	type BuilderChatDeps,
	type TurnEstimate,
	useBuilderChat,
} from "./use-builder-chat";

/** The chat state the app-builder page binds to the pane. */
export type BuilderThreadState = {
	/** Card-shaped messages, mapped from the live turn stream. */
	messages: BuilderMessage[];
	/** True from the turn POST until the stream settles or aborts. */
	isSending: boolean;
	/** Cost hint of the running turn, in whole credits; null before its first frame. */
	estimate: TurnEstimate | null;
	/**
	 * Sentence of a send the API refused before any stream, of a failed chat
	 * id lookup, or of a failed history load. Null while every request
	 * worked. Null when the reply already holds the error card.
	 */
	errorText: string | null;
	/** Sends one turn with this text. Dropped while a turn runs or the chat id is unknown. */
	send: (text: string) => void;
	/** Answers an open approval card through a turn with an empty message. */
	decideApproval: (approvalId: string, approved: boolean) => void;
	/** Aborts the stream, then posts the turn cancel. Rejects with ApiClientError. */
	cancel: () => Promise<void>;
	/** False while the project id resolves to a chat id, and after that lookup failed. */
	isReady: boolean;
};

// A shared empty list keeps the useMemo deps stable while the history
// query is still loading.
const EMPTY_HISTORY: readonly ChatMessage[] = [];

/**
 * The dictionary key of a rejected send's sentence, or null when the error
 * has no builder copy. `error` is a caught failure: the status-preserving
 * fetch throws ApiClientError, and useChat also stores plain Errors.
 */
export function turnErrorKey(error: unknown): TranslationKey | null {
	if (!isApiClientError(error)) return null;
	// A bare 402 arrives as HTTP_402 when the answer carries no error envelope.
	if (error.code === "INSUFFICIENT_CREDITS" || error.statusCode === 402) {
		return "appBuilder.chat.errors.noCredits";
	}
	switch (error.code) {
		case "PROJECT_CREDIT_CAP_REACHED":
			return "appBuilder.chat.errors.projectCap";
		case "TOO_MANY_ACTIVE_TURNS":
			return "appBuilder.chat.errors.tooManyTurns";
		case "BUILDER_APPROVAL_PENDING":
			return "appBuilder.chat.errors.approvalPending";
		case "V2_MODEL_DENIED":
			return "appBuilder.chat.errors.modelDenied";
		case "V2_MODEL_UNPRICED":
			return "appBuilder.chat.errors.modelUnpriced";
		default:
			return null;
	}
}

/**
 * The sentence the pane shows for the last chat error: the builder copy
 * when the code has one, the shared API message otherwise. Null while no
 * request failed.
 */
function turnErrorText(
	error: Error | undefined,
	t: (key: TranslationKey) => string,
): string | null {
	if (error === undefined) return null;
	const key = turnErrorKey(error);
	return key === null ? getApiErrorMessage(error) : t(key);
}

/**
 * Reads the chat of one project: its stored history hydrates the stream,
 * and every further send goes through the real turn routes. `deps` is the
 * test seam of use-builder-chat.ts; production passes nothing.
 */
export function useBuilderThread(
	projectId: string,
	deps?: BuilderChatDeps,
): BuilderThreadState {
	const { t } = useTranslation();
	const byProjectQuery = useChatByProjectQuery(projectId);
	const chatId = byProjectQuery.data?.chatId;
	const messagesQuery = useChatMessagesQuery(chatId);
	const history = messagesQuery.data;

	const initialMessages = useMemo(
		() => hydrateTurnMessages(history?.messages ?? EMPTY_HISTORY),
		[history],
	);

	const chat = useBuilderChat({ projectId, chatId, initialMessages }, deps);

	// Every key is a literal, so a new contract phase or tool kind fails
	// check-types until the dictionary grows the matching key.
	const labels = useMemo<TurnPartLabels>(
		() => ({
			phases: {
				sandbox_waking: t("appBuilder.chat.phases.sandbox_waking"),
				session_starting: t("appBuilder.chat.phases.session_starting"),
				running: t("appBuilder.chat.phases.running"),
				checkpoint: t("appBuilder.chat.phases.checkpoint"),
				committing: t("appBuilder.chat.phases.committing"),
			},
			tools: {
				think: t("appBuilder.chat.tools.think"),
				read: t("appBuilder.chat.tools.read"),
				write: t("appBuilder.chat.tools.write"),
				run: t("appBuilder.chat.tools.run"),
			},
		}),
		[t],
	);

	const messages = useMemo(
		() => toBuilderMessages(chat.messages, labels),
		[chat.messages, labels],
	);

	// A failed stream ends with a data-turn-error frame and an error chunk.
	// The frame is already a card in the reply, so the row under the list
	// stays empty. The row is for a send the API refused before any stream,
	// for the chat id lookup that never resolved (a V1 project id), or for
	// a history load that failed and left the thread blank.
	const lastMessage = messages.at(-1);
	const replyHoldsError =
		lastMessage?.role === "assistant" &&
		lastMessage.parts.some((part) => part.type === "data-error");

	return {
		messages,
		isSending: chat.isSending,
		estimate: chat.estimate,
		errorText: replyHoldsError
			? null
			: turnErrorText(
					chat.error ??
						byProjectQuery.error ??
						messagesQuery.error ??
						undefined,
					t,
				),
		send: (text) => chat.send({ text }),
		decideApproval: (approvalId, approved) =>
			chat.send({ text: "", approval: { approvalId, approved } }),
		cancel: chat.cancel,
		isReady: chatId !== undefined,
	};
}
