/**
 * The one chat hook the app-builder page calls. Joins the chat id lookup
 * and the paged stored history with the live turn stream of
 * use-builder-chat.ts, maps the messages to the card shapes the pane
 * renders, and turns a rejected send into a dictionary sentence. Calls the
 * workspace chat id query, the history query of app-builder.queries.ts,
 * use-builder-chat.ts, builder-chat-transport.ts, and turn-parts.ts.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import type {
	ChatMessage,
	PreviewTarget,
	TurnEstimate,
	TurnQuestionAnswer,
	TurnStreamPhase,
} from "@wandit/contracts";
import type { FileUIPart } from "ai";
import { useMemo } from "react";

import { useChatByProjectQuery } from "@/features/workspace";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { chatHistoryQuery } from "../api/app-builder.queries";
import type { SendBuilderMessageInput } from "../api/app-builder.services";
import type { BuilderMessage } from "../api/dto";
import { hydrateTurnMessages } from "./builder-chat-transport";
import { livePhaseOf, toBuilderMessages } from "./turn-parts";
import { type BuilderChatDeps, useBuilderChat } from "./use-builder-chat";

/** The chat state the app-builder page binds to the pane. */
export type BuilderThreadState = {
	/** Card-shaped messages: the loaded older pages, then the live turn stream. */
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
	/**
	 * Sends one turn with this text, these uploaded files, and the elements
	 * picked in the preview. Dropped while a turn runs or the chat id is unknown.
	 */
	send: (input: SendBuilderMessageInput, targets?: PreviewTarget[]) => void;
	/** Answers an open approval card through a turn with an empty message. */
	decideApproval: (approvalId: string, approved: boolean) => void;
	/**
	 * Answers the open question cards in one turn. `message` is the short
	 * summary the user bubble shows; `answers` carry the typed values.
	 */
	answerQuestions: (input: {
		message: string;
		answers: TurnQuestionAnswer[];
		/** Files of a typed message that also answers a skipped round. */
		files?: FileUIPart[];
	}) => void;
	/** Aborts the stream, then posts the turn cancel. Rejects with ApiClientError. */
	cancel: () => Promise<void>;
	/**
	 * False until the chat id resolves and the stored history loads or fails
	 * on this mount. A send before the history shows would put the reply
	 * above it. Also false after the chat id lookup failed.
	 */
	isReady: boolean;
	/**
	 * True while a turn the API accepted streams, or while a resumed turn
	 * replays. False while a send waits for the API, so a refused send never
	 * counts as a turn.
	 */
	isTurnRunning: boolean;
	/** Last `data-turn-status` phase of the running turn. Null before its first status part and while no turn runs. */
	phase: TurnStreamPhase | null;
	/**
	 * Id of the reply that streams now, or null while no turn runs or before
	 * the reply starts. The production chat shows this reply as one status line.
	 */
	liveMessageId: string | null;
	/** True when the last reply holds an error card. The preview then says that the app did not start. */
	lastTurnFailed: boolean;
	/**
	 * True while the chat holds at most one user message. The first turn
	 * creates the sandbox from the template. Null until the history loads or
	 * fails on this mount. A failed load counts as a first turn.
	 */
	isFirstTurn: boolean | null;
	/** True while the API has an older page of the stored chat. The pane then shows "Load earlier messages". */
	hasOlderMessages: boolean;
	/** True while the next older page loads. */
	isLoadingOlderMessages: boolean;
	/** Loads the next older page. A failed load shows in `errorText`, and the button stays. */
	loadOlderMessages: () => void;
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
	const historyQuery = useInfiniteQuery(chatHistoryQuery(projectId));
	const history = historyQuery.data;

	// useChat holds only the newest page. A load of an older page then never
	// reseeds the live stream. Structural sharing keeps this page object
	// when only an older page arrives.
	const newestPage = history?.pages[0];
	const initialMessages = useMemo(
		() => hydrateTurnMessages(newestPage?.items ?? EMPTY_HISTORY),
		[newestPage],
	);
	// The older loaded pages in chat order. The pages come newest first. The
	// live list owns the newest page: a stored turn row has a server id, and
	// the live bubble of the same turn has a client id.
	const olderHistoryMessages = useMemo(
		() =>
			hydrateTurnMessages(
				(history?.pages ?? [])
					.slice(1)
					.reverse()
					.flatMap((page) => page.items),
			),
		[history],
	);

	// The resume and the composer wait for the history, so the user bubble
	// shows above the reply. A history from the cache resumes at once and can
	// lack the bubble of the running turn. A load that fails on this mount
	// also settles. `isFetchedAfterMount` ignores an error cached by an
	// earlier mount, which refetches now. It stays true during a later
	// refetch, so useChat does not resume a second time.
	const isHistorySettled =
		history !== undefined || historyQuery.isFetchedAfterMount;

	const chat = useBuilderChat(
		{ projectId, chatId, initialMessages, isHistorySettled },
		deps,
	);

	// A history refetch during a stream can move rows of the live list into
	// the second page. The id check drops them, so no row shows twice.
	const messages = useMemo(() => {
		const liveIds = new Set(chat.messages.map((message) => message.id));
		const olderMessages = olderHistoryMessages.filter(
			(message) => !liveIds.has(message.id),
		);
		return toBuilderMessages([...olderMessages, ...chat.messages], {
			isRunning: chat.isSending,
		});
	}, [olderHistoryMessages, chat.messages, chat.isSending]);

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
					chat.error ?? byProjectQuery.error ?? historyQuery.error ?? undefined,
					t,
				),
		send: ({ text, files }, targets) => chat.send({ text, files, targets }),
		decideApproval: (approvalId, approved) =>
			chat.send({ text: "", approval: { approvalId, approved } }),
		answerQuestions: ({ message, answers, files }) =>
			chat.send({ text: message, answers, files }),
		cancel: chat.cancel,
		isReady: chatId !== undefined && isHistorySettled,
		isTurnRunning: chat.isSending && !chat.isAwaitingTurn,
		// The phase lives in the reply that streams now, the last message.
		phase: livePhaseOf(chat.messages, chat.isSending),
		// toBuilderMessages keeps the ids, so this id also finds the card message.
		liveMessageId:
			chat.isSending && chat.messages.at(-1)?.role === "assistant"
				? (chat.messages.at(-1)?.id ?? null)
				: null,
		lastTurnFailed: replyHoldsError,
		// LIMIT: a first turn that failed before the sandbox existed makes the
		// next turn show the resume copy. Upgrade: a sandbox status from the API.
		// An older page proves earlier turns, also when the newest page holds
		// only approval answers, which show no user bubble.
		isFirstTurn: isHistorySettled
			? !historyQuery.hasNextPage &&
				messages.filter((message) => message.role === "user").length <= 1
			: null,
		hasOlderMessages: historyQuery.hasNextPage,
		isLoadingOlderMessages: historyQuery.isFetchingNextPage,
		loadOlderMessages: () => {
			// A second click while a page loads would read the same cursor twice.
			if (!historyQuery.isFetchingNextPage) void historyQuery.fetchNextPage();
		},
	};
}
