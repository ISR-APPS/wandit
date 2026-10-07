/**
 * The one chat hook the app-builder page calls. Joins the chat id lookup
 * and the paged stored history with the live turn stream of
 * use-builder-chat.ts. Maps the messages to the card shapes the pane
 * renders. Turns a chat error into a dictionary sentence and a Reconnect
 * action, and holds the Plan toggle. Calls the workspace chat id query,
 * the history query of app-builder.queries.ts, use-builder-chat.ts,
 * builder-chat-transport.ts, and turn-parts.ts.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import type {
	BuilderTurnMode,
	ChatMessage,
	PreviewTarget,
	TurnEstimate,
	TurnQuestionAnswer,
	TurnStreamPhase,
} from "@wandit/contracts";
import type { FileUIPart } from "ai";
import { useEffect, useMemo, useState } from "react";

import { useChatByProjectQuery } from "@/features/workspace";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { chatHistoryQuery } from "../api/app-builder.queries";
import type { SendBuilderMessageInput } from "../api/app-builder.services";
import type { BuilderMessage } from "../api/dto";
import { hydrateTurnMessages } from "./builder-chat-transport";
import { latestTurnModeOf, livePhaseOf, toBuilderMessages } from "./turn-parts";
import {
	type BuilderChatDeps,
	type BuilderChatSend,
	useBuilderChat,
} from "./use-builder-chat";

/** The chat state the app-builder page binds to the pane. */
export type BuilderThreadState = {
	/** Card-shaped messages: the loaded older pages, then the live turn stream. */
	messages: BuilderMessage[];
	/** True from the turn POST until the stream settles or aborts. */
	isSending: boolean;
	/** Cost hint of the running turn, in whole credits; null before its first frame. */
	estimate: TurnEstimate | null;
	/**
	 * The sentence for a refused send, or for a failed or lost turn stream.
	 * A failed chat id lookup or history load also shows here. Null while
	 * every request worked. Null when the last reply holds the error card of
	 * this error.
	 */
	errorText: string | null;
	/**
	 * Sends one turn with this text, these uploaded files, and the elements
	 * picked in the preview. A send with no `mode` uses the Plan toggle.
	 * Resolves false when the API admitted no turn, also while a turn runs or
	 * the chat id is unknown. The caller then puts the draft back.
	 */
	send: (
		input: SendBuilderMessageInput,
		targets?: PreviewTarget[],
	) => Promise<boolean>;
	/** Answers an open approval card through a turn with an empty message. */
	decideApproval: (approvalId: string, approved: boolean) => void;
	/**
	 * Answers the open question cards in one turn. `message` is the short
	 * summary the user bubble shows; `answers` carry the typed values.
	 * Resolves like `send`.
	 */
	answerQuestions: (input: {
		message: string;
		answers: TurnQuestionAnswer[];
		/** Files of a typed message that also answers a skipped round. */
		files?: FileUIPart[];
	}) => Promise<boolean>;
	/** Aborts the stream, then posts the turn cancel. Rejects with ApiClientError. */
	cancel: () => Promise<void>;
	/**
	 * Opens the stream of the running turn again after a lost connection.
	 * Null while `errorText` is null or the error is final (canReconnectAfter).
	 */
	reconnect: (() => Promise<void>) | null;
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
	/** Mode of the newest turn the thread knows (latestTurnModeOf). The preview shows the planning note for `plan`. */
	latestTurnMode: BuilderTurnMode;
	/**
	 * State of the Plan toggle: the user's pick, else true when the newest
	 * turn was a Plan Mode turn. A send shows its own mode at once. The next
	 * turn start clears the pick, so after "Build this plan" the toggle is off.
	 */
	isPlanMode: boolean;
	/** Sets the Plan toggle until the next turn starts. */
	setPlanMode: (isPlanMode: boolean) => void;
};

// A shared empty list keeps the useMemo deps stable while the history
// query is still loading.
const EMPTY_HISTORY: readonly ChatMessage[] = [];

/**
 * True when a Reconnect can bring the turn back after this chat error. A
 * network failure, a 429, and a 5xx of a stream are temporary; another 4xx
 * is final. A send that the API answered with an error created no turn,
 * because TurnsService.create fails its row. Its draft is back in the
 * composer. `isSendRefused` comes from useBuilderChat.
 */
export function canReconnectAfter(
	error: Error,
	isSendRefused: boolean,
): boolean {
	if (!isApiClientError(error)) return true;
	if (isSendRefused) return false;
	return error.statusCode === 429 || error.statusCode >= 500;
}

/**
 * The dictionary key of a chat error's sentence, or null when the shared API
 * message fits. `error` is useChat's error: the status-preserving fetch
 * throws ApiClientError, and the stream fails with plain Errors.
 */
export function turnErrorKey(
	error: Error,
	isSendRefused: boolean,
): TranslationKey | null {
	if (isApiClientError(error)) {
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
		}
		// The composer holds the draft of a refused send again. This sentence
		// asks the user to send it again. A refused 409 BUILDER_TURN_ACTIVE
		// or 429 RATE_LIMITED uses the shared errors.codes copy.
		if (isSendRefused && error.statusCode >= 500) {
			return "appBuilder.chat.errors.sendFailed";
		}
	}
	return canReconnectAfter(error, isSendRefused)
		? "appBuilder.chat.errors.connectionLost"
		: null;
}

/**
 * The sentence the pane shows for the last chat error. Without a chat
 * error, it is the sentence of a failed chat id lookup or history load.
 * It is the builder copy when one fits, else the shared API message.
 * Null while no request failed.
 */
function turnErrorText(
	chatError: Error | undefined,
	isSendRefused: boolean,
	loadError: Error | undefined,
	t: (key: TranslationKey) => string,
): string | null {
	if (chatError !== undefined) {
		const key = turnErrorKey(chatError, isSendRefused);
		return key === null ? getApiErrorMessage(chatError) : t(key);
	}
	return loadError === undefined ? null : getApiErrorMessage(loadError);
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

	const latestTurnMode = useMemo(
		() => latestTurnModeOf([...olderHistoryMessages, ...chat.messages]),
		[olderHistoryMessages, chat.messages],
	);
	// The user's pick of the Plan toggle, with its project; null follows the
	// newest turn. A project switch in place keeps this hook, so the pick of
	// another project reads as none.
	const [storedPick, setStoredPick] = useState<{
		projectId: string;
		isPlanMode: boolean;
	} | null>(null);
	const planModePick =
		storedPick?.projectId === projectId ? storedPick.isPlanMode : null;
	const setPlanModePick = (isPlanMode: boolean | null) =>
		setStoredPick(isPlanMode === null ? null : { projectId, isPlanMode });
	// Id of the last turn whose `data-turn-created` frame arrived. A new id
	// means a new turn started: the pick clears, and the toggle shows the
	// mode of that turn. Message ids do not work here: a history reseed
	// replaces the client ids of the live list with the stored ids.
	const [startedTurnId, setStartedTurnId] = useState<string | null>(null);
	if (chat.turnId !== null && chat.turnId !== startedTurnId) {
		setStartedTurnId(chat.turnId);
		setPlanModePick(null);
	}
	// A send that the API refuses (402, 409, network) gets no created frame.
	// The pick clears too: else a refused "Build this plan" leaves the toggle
	// off while the plan waits, and the next typed change builds the plan.
	const [seenError, setSeenError] = useState<Error | undefined>(undefined);
	if (chat.error !== seenError) {
		setSeenError(chat.error);
		if (chat.error !== undefined) {
			setPlanModePick(null);
		}
	}
	const isPlanMode = planModePick ?? latestTurnMode === "plan";
	const sendTurn = (input: BuilderChatSend) => {
		// A send with no mode runs in the mode of the toggle. With an open plan,
		// a build turn approves the whole plan, so a preview fix must not send one.
		const mode = input.mode ?? (isPlanMode ? "plan" : "build");
		// Until the created frame of the new turn arrives, the toggle and the
		// header chip show the mode of this send.
		setPlanModePick(mode === "plan");
		return chat.send({ ...input, mode });
	};

	// A failed stream ends with a data-turn-error frame and an error chunk.
	// The frame is already a card in the reply, so the row under the list
	// stays empty. The row shows a send that the API refused before any
	// stream, or a stream that the transport cannot reopen. It also shows a
	// chat id lookup that never resolved (a V1 project id), and a failed
	// history load.
	const lastMessage = messages.at(-1);
	const replyHoldsError =
		lastMessage?.role === "assistant" &&
		lastMessage.parts.some((part) => part.type === "data-error");
	// A refused send drops its bubble, so the last reply can be an older
	// failed turn. That card does not tell why the send failed.
	const hidesChatError = replyHoldsError && !chat.isSendRefused;
	const reconnect =
		chat.error !== undefined &&
		!hidesChatError &&
		canReconnectAfter(chat.error, chat.isSendRefused)
			? chat.reconnect
			: null;

	// The transport stops after about 45 s of failed reopens, as in a long
	// Wi-Fi drop. When the browser is back online, the chat reconnects once.
	useEffect(() => {
		if (reconnect === null) return;
		const reconnectWhenOnline = () => void reconnect();
		window.addEventListener("online", reconnectWhenOnline);
		return () => window.removeEventListener("online", reconnectWhenOnline);
	}, [reconnect]);

	return {
		messages,
		isSending: chat.isSending,
		estimate: chat.estimate,
		errorText: hidesChatError
			? null
			: turnErrorText(
					chat.error,
					chat.isSendRefused,
					byProjectQuery.error ?? historyQuery.error ?? undefined,
					t,
				),
		send: ({ text, files, mode }, targets) =>
			sendTurn({ text, files, targets, mode }),
		// No mode, so a build turn: only a build turn pauses on an approval.
		decideApproval: (approvalId, approved) =>
			void chat.send({ text: "", approval: { approvalId, approved } }),
		answerQuestions: ({ message, answers, files }) =>
			sendTurn({ text: message, answers, files }),
		cancel: chat.cancel,
		reconnect,
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
		latestTurnMode,
		isPlanMode,
		setPlanMode: setPlanModePick,
	};
}
