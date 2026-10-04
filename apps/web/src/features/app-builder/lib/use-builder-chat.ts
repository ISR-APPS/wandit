/**
 * React hook over the V2 turn stream of one project chat. Owns the useChat
 * instance and exposes the running turn id and its cost estimate. Sends
 * text, files, question answers, and approval decisions as turn requests.
 * A 402 answer opens the credits dialog. Called by the app-builder page;
 * calls builder-chat-transport.ts, api/app-builder.services.ts, and the
 * billing dispatch.
 */

import { useChat } from "@ai-sdk/react";
import { hashKey, useQueryClient } from "@tanstack/react-query";
import {
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
	/** Sends one turn. Dropped while a turn runs or while the chat id is unknown. */
	send: (input: BuilderChatSend) => void;
	/**
	 * Aborts the stream, then posts the cancel; rejects with the POST error.
	 * Before the first frame it waits for the turn id first.
	 */
	cancel: () => Promise<void>;
};

/**
 * The `chatId`, `initialMessages`, and `isHistorySettled` inputs come from
 * useBuilderThread (it composes them from useChatByProjectQuery,
 * useChatMessagesQuery, and hydrateTurnMessages). While `chatId` is
 * undefined no transport exists and `send` refuses.
 */
export function useBuilderChat(
	input: {
		/** Project the turn routes are scoped to. */
		projectId: string;
		/** Resolved chat id; undefined while the by-project query loads. */
		chatId: string | undefined;
		/** Hydrated history; reseeds the chat when it changes while idle. */
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
	// Stops that came before the turn id. `data-turn-created` resolves them
	// with the id; the end of the request resolves them with null.
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

	const { messages, status, error, sendMessage, setMessages, stop } =
		useChat<TurnMessage>({
			id: chatId ?? `project:${projectId}`,
			messages: [...initialMessages],
			transport,
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
				}
			},
			// A 402 answer of the create POST opens the credits dialog. The
			// dispatch ignores every other error; the pane shows its sentence.
			onError: (error) => {
				dispatchBillingError(error);
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
	useEffect(() => {
		if (statusRef.current === "ready") {
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
		(sendInput: BuilderChatSend): void => {
			// One active turn per project: a second send queues or fails with 429
			// TOO_MANY_ACTIVE_TURNS. The hook refuses early and keeps one stream.
			if (chatId === undefined || isSending) return;
			setIsAwaitingTurn(true);
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
			void sendMessage(
				{ parts },
				{
					body: {
						...(sendInput.approval ? { approval: sendInput.approval } : {}),
						...(sendInput.answers ? { answers: sendInput.answers } : {}),
						...(sendInput.model ? { model: sendInput.model } : {}),
					},
				},
			);
		},
		[chatId, isSending, sendMessage],
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

	return {
		messages,
		status,
		isSending,
		error,
		turnId: activeTurn?.turnId ?? null,
		isAwaitingTurn,
		estimate: activeTurn?.estimate ?? null,
		send,
		cancel,
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
