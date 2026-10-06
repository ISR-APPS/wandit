/**
 * React hook over the V2 turn stream of one project chat. Owns the useChat
 * instance and exposes the running turn id and its cost estimate. Sends
 * text, files, question answers, approval decisions, and the turn mode as
 * turn requests. A refused send leaves the chat, so the composer can show it
 * again. After a failed stream, `reconnect` replays the running turn.
 * A 402 answer opens the credits dialog. Called by use-builder-thread.ts;
 * calls builder-chat-transport.ts, api/app-builder.services.ts, and the
 * billing dispatch.
 */

import { useChat } from "@ai-sdk/react";
import { hashKey, useQueryClient } from "@tanstack/react-query";
import {
	type BuilderTurnMode,
	type BuilderTurnStatus,
	createTurnResponseSchema,
	type PreviewTarget,
	type TurnApprovalAnswer,
	type TurnEstimate,
	type TurnQuestionAnswer,
} from "@wandit/contracts";
import type { ChatStatus, FileUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { dispatchBillingError } from "@/features/billing";
import { creditsKeys } from "@/features/credits";
import { appBuilderKeys } from "../api/app-builder.queries";
import { cancelTurn } from "../api/app-builder.services";
import { cloudKeys } from "../api/cloud.queries";
import type { TurnMessage, TurnMessagePart } from "../api/dto";
import { createBuilderChatTransport } from "./builder-chat-transport";

/** What `send` accepts: the draft text plus optional per-turn extras. */
export type BuilderChatSend = {
	/**
	 * Message text for a plain turn, a short summary of the answers for a
	 * `data-question` round, or "" for a `data-approval` answer or a
	 * message with files only.
	 */
	text: string;
	/** Uploaded files of the message, with their upload URLs. The transport sends them as `attachments`. */
	files?: FileUIPart[];
	/** Decision answering a pending `data-approval` card. */
	approval?: TurnApprovalAnswer;
	/** One answer per open `data-question` card, from the request tray. */
	answers?: TurnQuestionAnswer[];
	/** Paid model id the user picked for this turn; absent uses the deploy default. */
	model?: string;
	/** `plan` runs the turn in Plan Mode: the agent asks and plans, and changes no file. Absent sends a build turn. */
	mode?: BuilderTurnMode;
	/** Elements picked in the preview. They go on the user message as a `data-targets` part. */
	targets?: PreviewTarget[];
};

/**
 * Injectable seams so specs pass fakes instead of mocking repo modules.
 * `fetch` reaches the SSE transport; `cancelTurn` is the POST cancel call.
 */
export type BuilderChatDeps = {
	fetch: typeof globalThis.fetch;
	cancelTurn: typeof cancelTurn;
};

const defaultDeps: BuilderChatDeps = { fetch: globalThis.fetch, cancelTurn };

/** Live state and actions of one project chat, as the page consumes them. */
export type BuilderChat = {
	messages: TurnMessage[];
	status: ChatStatus;
	/** True from the turn POST until the stream settles or aborts. */
	isSending: boolean;
	/** An ApiClientError for a rejected request, a plain Error for a network or stream failure. */
	error: Error | undefined;
	/** Id of the running turn, from `data-turn-created`; null before send and after the stream settles. */
	turnId: string | null;
	/** True from a local send until `data-turn-created` or the end of the request. The preview boot screen reads it, so a refused send does not count as a turn. */
	isAwaitingTurn: boolean;
	/** Server estimate of the running turn; null when the frame carried none. */
	estimate: TurnEstimate | null;
	/**
	 * Sends one turn. Resolves true when `data-turn-created` arrives. Resolves
	 * false when the request ends before that frame, as for a refused or
	 * failed POST. It also resolves false at once while a turn runs or the
	 * chat id is unknown. On false the user bubble leaves the chat.
	 */
	send: (input: BuilderChatSend) => Promise<boolean>;
	/** True while `error` comes from a send that ended before the API admitted its turn. */
	isSendRefused: boolean;
	/**
	 * Aborts the stream, then posts the cancel; rejects with the POST error.
	 * Before the first frame it waits for the turn id first.
	 */
	cancel: () => Promise<void>;
	/**
	 * Runs after a failed request. GET turns/active/stream replays the running
	 * turn from its first event, or answers 204 when no turn runs. The stored
	 * history loads again without a replay, and after the replay of a refused
	 * send. Does nothing unless the status is `error`.
	 */
	reconnect: () => Promise<void>;
};

/**
 * The `chatId`, `initialMessages`, and `isHistorySettled` inputs come from
 * useBuilderThread (it composes them from useChatByProjectQuery,
 * the paged chatHistoryQuery, and hydrateTurnMessages). While `chatId` is
 * undefined no transport exists and `send` refuses.
 */
export function useBuilderChat(
	input: {
		/** Project the turn routes are scoped to. */
		projectId: string;
		/** Resolved chat id; undefined while the by-project query loads. */
		chatId: string | undefined;
		/** Hydrated newest history page; reseeds the chat when it changes while idle. */
		initialMessages: readonly TurnMessage[];
		/**
		 * True once the stored history loaded or failed. The resume waits for
		 * it, so the user bubble shows above the resumed reply. It must not go
		 * back to false for one chat: each new true value resumes again.
		 */
		isHistorySettled: boolean;
	},
	deps: BuilderChatDeps = defaultDeps,
): BuilderChat {
	const { projectId, chatId, initialMessages, isHistorySettled } = input;
	const queryClient = useQueryClient();
	const [activeTurn, setActiveTurn] = useState<{
		turnId: string;
		estimate: TurnEstimate | null;
	} | null>(null);
	const [isAwaitingTurn, setIsAwaitingTurn] = useState(false);
	// Chat id of the last send that ended before the API admitted its turn.
	// A new send, a created frame, a 204, or a project switch clears it.
	// A failed reconnect GET keeps it, because useChat then keeps the send error.
	const [refusedSendChatId, setRefusedSendChatId] = useState<string | null>(
		null,
	);
	// A project switch keeps this hook. A useChat of another chat id starts
	// with no error, so the flag of the old chat goes.
	if (refusedSendChatId !== null && refusedSendChatId !== chatId) {
		setRefusedSendChatId(null);
	}
	// The reconnect that runs now, or null. The created frame of its replay
	// sets `hasReplay`. onError sets `hasFailed` when its GET or stream fails.
	const reconnectRef = useRef<{
		hasReplay: boolean;
		hasFailed: boolean;
	} | null>(null);
	// Stops and sends that wait for the turn id. `data-turn-created` resolves
	// them with the id; the end of the request resolves them with null.
	const turnIdWaitersRef = useRef<((turnId: string | null) => void)[]>([]);
	const resolveTurnIdWaiters = useCallback((turnId: string | null) => {
		const waiters = turnIdWaitersRef.current;
		turnIdWaitersRef.current = [];
		for (const resolve of waiters) resolve(turnId);
	}, []);

	const transport = useMemo(
		() =>
			chatId === undefined
				? undefined
				: createBuilderChatTransport({
						projectId,
						fetch: deps.fetch,
					}),
		[projectId, chatId, deps.fetch],
	);

	// A finished turn can change six caches: the versions, the code, the
	// project summary, the app backend, the credits, and the next estimate.
	// All six refresh at once. The code key covers the Code view tree and
	// every open file. The Cloud keys cover the tables, functions, secrets,
	// and every other panel. The backend state polls on its own.
	const invalidateTurnData = useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.versions(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.code(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.project(projectId),
		});
		const backendKey = hashKey(cloudKeys.backend(projectId));
		void queryClient.invalidateQueries({
			queryKey: cloudKeys.all(projectId),
			predicate: (query) => query.queryHash !== backendKey,
		});
		void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
		// The next hold is the median of the settled turns, so it moves too.
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.turnEstimate(projectId),
		});
	}, [queryClient, projectId]);

	const {
		messages,
		status,
		error,
		sendMessage,
		setMessages,
		stop,
		resumeStream,
	} = useChat<TurnMessage>({
		id: chatId ?? `project:${projectId}`,
		messages: [...initialMessages],
		transport,
		// A resume replays every chunk of the turn. Without a throttle, each
		// chunk renders the whole page once. 50 ms is about 3 frames. The SDK
		// still flushes the messages at once on the ready and error status.
		throttle: 50,
		// Replays the active turn after a reload. useChat re-runs this for
		// each Chat instance (a new `id` builds a new one) and when the value
		// turns true. The wait for the history keeps the order: a reply that
		// streams first shows the working row above the user bubble.
		resume: chatId !== undefined && isHistorySettled,
		onData: (part) => {
			// First frame of the create route and of the resume route. It is
			// the only browser source of the turn id that `cancel` needs and
			// of the estimate. The frame crosses the HTTP boundary, so the
			// schema decides; a bad frame throws and the stream surfaces it
			// as `error`.
			if (part.type === "data-turn-created") {
				const created = createTurnResponseSchema.parse(part.data);
				setIsAwaitingTurn(false);
				setActiveTurn({
					turnId: created.turnId,
					estimate: created.estimate ?? null,
				});
				resolveTurnIdWaiters(created.turnId);
				// A turn owns the chat now. A later error is a turn error, not the
				// error of a refused send.
				setRefusedSendChatId(null);
				if (reconnectRef.current !== null) {
					reconnectRef.current.hasReplay = true;
				}
			}
		},
		// A 402 answer of the create POST opens the credits dialog. The
		// dispatch ignores every other error; the pane shows its sentence.
		onError: (error) => {
			dispatchBillingError(error);
			if (reconnectRef.current !== null) {
				reconnectRef.current.hasFailed = true;
			}
		},
		// The SDK fires onFinish on success, error, and abort. The turn id
		// and the estimate are stale from here; a cancel after this point
		// would post for a finished turn. On an abort the caches refresh
		// before the settle, so `cancel` refreshes them again.
		onFinish: () => {
			setActiveTurn(null);
			setIsAwaitingTurn(false);
			resolveTurnIdWaiters(null);
			invalidateTurnData();
		},
	});

	const isSending = status === "submitted" || status === "streaming";

	// The history query can refetch while a stream runs. A reseed then drops
	// the live parts. So the status check reads a ref, and `status` stays out
	// of the dependency list on purpose.
	const statusRef = useRef(status);
	useEffect(() => {
		statusRef.current = status;
	}, [status]);
	// The newest history page, and the page of the last full reseed. A page
	// that comes while the chat is not ready only merges. After a 204,
	// `reconnect` compares the two and reseeds from the newest page.
	const newestHistoryRef = useRef(initialMessages);
	const seededHistoryRef = useRef(initialMessages);
	useEffect(() => {
		newestHistoryRef.current = initialMessages;
		if (statusRef.current === "ready") {
			seededHistoryRef.current = initialMessages;
			setMessages([...initialMessages]);
			return;
		}
		// A resume after an empty or failed history load holds only the reply.
		// A later history refetch goes in front of it. A local send, or a
		// resume after the history with the user message, keeps its messages.
		setMessages((current) =>
			current.some((message) => message.role === "user")
				? current
				: [...initialMessages, ...current],
		);
	}, [initialMessages, setMessages]);

	const send = useCallback(
		async (sendInput: BuilderChatSend): Promise<boolean> => {
			// One active turn per project: a second send queues or fails with 429
			// TOO_MANY_ACTIVE_TURNS. The hook refuses early and keeps one stream.
			if (chatId === undefined || isSending) return false;
			setIsAwaitingTurn(true);
			setRefusedSendChatId(null);
			// Files first, then the text, as the AI SDK orders `{ text, files }`.
			// The bubble shows the chips from the targets part; the transport reads
			// the targets of the turn body from it too.
			const parts: TurnMessagePart[] = [
				...(sendInput.files ?? []),
				{ type: "text", text: sendInput.text },
			];
			if (sendInput.targets?.length) {
				parts.push({
					type: "data-targets",
					id: "targets",
					data: { targets: sendInput.targets },
				});
			}
			// The id finds the bubble again when the API admits no turn.
			const messageId = crypto.randomUUID();
			const turnId = new Promise<string | null>((resolve) => {
				turnIdWaitersRef.current.push(resolve);
			});
			void sendMessage(
				{ id: messageId, parts },
				{
					body: {
						...(sendInput.approval ? { approval: sendInput.approval } : {}),
						...(sendInput.answers ? { answers: sendInput.answers } : {}),
						...(sendInput.model ? { model: sendInput.model } : {}),
						...(sendInput.mode ? { mode: sendInput.mode } : {}),
					},
				},
			);
			if ((await turnId) !== null) return true;
			// No turn exists for this message, and the caller puts it back in the
			// composer. A bubble would show it twice after the next send.
			setMessages((current) =>
				current.filter((message) => message.id !== messageId),
			);
			setRefusedSendChatId(chatId);
			return false;
		},
		[chatId, isSending, sendMessage, setMessages],
	);

	const cancel = useCallback(async (): Promise<void> => {
		// A Stop during the admission of the POST has no turn id yet. An abort
		// drops the first frame, and the turn then runs and spends. So the
		// cancel waits for the frame or for the end of the request.
		const turnId =
			activeTurn?.turnId ??
			(isSending
				? await new Promise<string | null>((resolve) => {
						turnIdWaitersRef.current.push(resolve);
					})
				: null);
		// stop() aborts the POST stream; its onFinish clears activeTurn, so a
		// turn the user starts during the cancel POST stays untouched.
		await stop();
		if (turnId === null) return;
		// The error propagates on purpose: the page maps it to copy.
		const canceled = await deps.cancelTurn(projectId, turnId);
		// The aborted read never gets the done frame. The cancel answer has
		// the same status, so the reply can show that the turn stopped.
		setMessages((current) =>
			withTurnDoneStatus(current, turnId, canceled.status),
		);
		// The cancel answers after the settle wrote the wip commit. The refresh
		// shows its files, for example the first version of a new project.
		invalidateTurnData();
	}, [
		stop,
		activeTurn?.turnId,
		isSending,
		deps,
		projectId,
		setMessages,
		invalidateTurnData,
	]);

	const reconnect = useCallback(async (): Promise<void> => {
		// A second GET while one runs would abort the first, so the call drops.
		if (
			chatId === undefined ||
			status !== "error" ||
			reconnectRef.current !== null
		) {
			return;
		}
		const attempt = { hasReplay: false, hasFailed: false };
		reconnectRef.current = attempt;
		// A send can lose its POST answer after the API created the turn. Its
		// bubble is gone, so the history must show the user row again.
		const isAfterRefusedSend = refusedSendChatId === chatId;
		// The replay starts at the first event of the turn and builds the reply
		// again, so the cut reply goes. Only the relay writes the created
		// frame: a stored reply has no created frame.
		const lastMessage = messages.at(-1);
		const cutReply =
			lastMessage?.role === "assistant" &&
			lastMessage.parts.some((part) => part.type === "data-turn-created") &&
			!lastMessage.parts.some((part) => part.type === "data-turn-done")
				? lastMessage
				: null;
		if (cutReply !== null) {
			setMessages((current) =>
				current.filter((message) => message.id !== cutReply.id),
			);
		}
		try {
			await resumeStream();
		} finally {
			reconnectRef.current = null;
		}
		const historyKey = appBuilderKeys.chatHistory(projectId);
		if (attempt.hasReplay) {
			// resumeStream resolves when the replay ends. When the chat is ready,
			// the refetched history reseeds it with the user row.
			if (isAfterRefusedSend) {
				void queryClient.invalidateQueries({ queryKey: historyKey });
			}
			return;
		}
		// No replay: the GET failed again, or the turn ended while the stream
		// was down (204). A failed GET keeps the cut reply. After a 204, a
		// history page that came during the error holds the end of the turn.
		// Its reseed only merged, and a refetch of equal data does not reseed.
		// A 204 also ends the error of a refused send.
		if (!attempt.hasFailed) setRefusedSendChatId(null);
		const newestHistory = newestHistoryRef.current;
		if (!attempt.hasFailed && newestHistory !== seededHistoryRef.current) {
			seededHistoryRef.current = newestHistory;
			setMessages([...newestHistory]);
		} else if (cutReply !== null) {
			// The refetch below replaces the cut reply once the chat is ready.
			setMessages((current) => [...current, cutReply]);
		}
		void queryClient.invalidateQueries({ queryKey: historyKey });
		// onFinish runs only for a stream, so the turn data refreshes here.
		invalidateTurnData();
	}, [
		chatId,
		status,
		refusedSendChatId,
		messages,
		setMessages,
		resumeStream,
		queryClient,
		projectId,
		invalidateTurnData,
	]);

	return {
		messages,
		status,
		isSending,
		error,
		turnId: activeTurn?.turnId ?? null,
		isAwaitingTurn,
		estimate: activeTurn?.estimate ?? null,
		send,
		isSendRefused: error !== undefined && refusedSendChatId === chatId,
		cancel,
		reconnect,
	};
}

/**
 * The messages with a `data-turn-done` part on the reply of one turn. The
 * reply is the assistant message that holds the `data-turn-created` frame
 * of `turnId`. The messages stay the same when no reply holds it.
 */
function withTurnDoneStatus(
	messages: TurnMessage[],
	turnId: string,
	status: BuilderTurnStatus,
): TurnMessage[] {
	return messages.map((message) =>
		message.role === "assistant" &&
		message.parts.some(
			(part) =>
				part.type === "data-turn-created" && part.data.turnId === turnId,
		)
			? {
					...message,
					parts: [
						...message.parts.filter((part) => part.type !== "data-turn-done"),
						{ type: "data-turn-done", id: "turn-done", data: { status } },
					],
				}
			: message,
	);
}
