/**
 * React hook over the V2 turn stream of one project chat. Owns the useChat
 * instance and exposes the running turn id and its cost estimate. Sends
 * text, question answers, and approval decisions as turn requests. Called
 * by the app-builder page; calls builder-chat-transport.ts and
 * api/app-builder.services.ts.
 */

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	type CreateTurnResponse,
	createTurnResponseSchema,
	type TurnApprovalAnswer,
} from "@wandit/contracts";
import type { ChatStatus } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { creditsKeys } from "@/features/credits";
import { appBuilderKeys } from "../api/app-builder.queries";
import { cancelTurn } from "../api/app-builder.services";
import type { TurnMessage } from "../api/dto";
import { createBuilderChatTransport } from "./builder-chat-transport";

/** Cost hint carried by `data-turn-created`, in whole credits plus its basis. */
export type TurnEstimate = NonNullable<CreateTurnResponse["estimate"]>;

/** What `send` accepts: the draft text plus optional per-turn extras. */
export type BuilderChatSend = {
	/**
	 * Message text for a plain turn, the option label for a `data-question`
	 * answer, or "" for a `data-approval` answer.
	 */
	text: string;
	/** Decision answering a pending `data-approval` card. */
	approval?: TurnApprovalAnswer;
	/** Paid model id the user picked for this turn; absent uses the deploy default. */
	model?: string;
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
	/** Aborts the stream, then posts the cancel; rejects with the POST error. */
	cancel: () => Promise<void>;
};

/**
 * The `chatId` and `initialMessages` inputs come from the caller (the page
 * composes them from useChatByProjectQuery, useChatMessagesQuery, and
 * hydrateTurnMessages). While `chatId` is undefined no transport exists and
 * `send` refuses.
 */
export function useBuilderChat(
	input: {
		/** Project the turn routes are scoped to. */
		projectId: string;
		/** Resolved chat id; undefined while the by-project query loads. */
		chatId: string | undefined;
		/** Hydrated history; reseeds the chat when it changes while idle. */
		initialMessages: readonly TurnMessage[];
	},
	deps: BuilderChatDeps = defaultDeps,
): BuilderChat {
	const { projectId, chatId, initialMessages } = input;
	const queryClient = useQueryClient();
	const [activeTurn, setActiveTurn] = useState<{
		turnId: string;
		estimate: TurnEstimate | null;
	} | null>(null);
	const [isAwaitingTurn, setIsAwaitingTurn] = useState(false);

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

	// A finished turn can mint a new version, change the code, move the
	// project summary, and settle credits; all four caches refresh at once.
	// The code key covers the Code view tree and every open file.
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
		void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
	}, [queryClient, projectId]);

	const { messages, status, error, sendMessage, setMessages, stop } =
		useChat<TurnMessage>({
			id: chatId ?? `project:${projectId}`,
			messages: [...initialMessages],
			transport,
			// Replays the active turn after a reload. useChat re-runs this for
			// each Chat instance, and a new `id` builds a new one.
			resume: chatId !== undefined,
			onData: (part) => {
				// First frame of the create route. It is the only browser source
				// of the turn id that `cancel` needs and of the estimate. The
				// frame crosses the HTTP boundary, so the schema decides; a bad
				// frame throws and the stream surfaces it as `error`.
				if (part.type === "data-turn-created") {
					const created = createTurnResponseSchema.parse(part.data);
					setIsAwaitingTurn(false);
					setActiveTurn({
						turnId: created.turnId,
						estimate: created.estimate ?? null,
					});
				}
			},
			// The SDK fires onFinish on success, error, and abort. The turn id
			// and the estimate are stale from here; a cancel after this point
			// would post for a finished turn.
			// LIMIT: after a cancel the caches refresh before the settle.
			// Upgrade: post the cancel first and keep the stream open until
			// data-turn-done.
			onFinish: () => {
				setActiveTurn(null);
				setIsAwaitingTurn(false);
				invalidateTurnData();
			},
		});

	const isSending = status === "submitted" || status === "streaming";

	// The history query can land or refetch while a stream runs. A reseed
	// then drops the live parts. So the status check reads a ref, and
	// `status` stays out of the dependency list on purpose.
	const statusRef = useRef(status);
	useEffect(() => {
		statusRef.current = status;
	}, [status]);
	useEffect(() => {
		if (statusRef.current === "ready") {
			setMessages([...initialMessages]);
			return;
		}
		// A resumed stream (reload during a turn) holds only the reply. The
		// history lands after the resume GET, so it goes in front of the reply.
		// A stream that a local send started already holds its user message.
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
			void sendMessage(
				{ text: sendInput.text },
				{
					body: {
						...(sendInput.approval ? { approval: sendInput.approval } : {}),
						...(sendInput.model ? { model: sendInput.model } : {}),
					},
				},
			);
		},
		[chatId, isSending, sendMessage],
	);

	const cancel = useCallback(async (): Promise<void> => {
		// stop() aborts the POST stream; its onFinish clears activeTurn, so a
		// turn the user starts during the cancel POST stays untouched.
		await stop();
		const turnId = activeTurn?.turnId;
		// LIMIT: a cancel before the first frame leaves the turn running until
		// a reload resumes it. Upgrade: wait for data-turn-created before the
		// cancel POST.
		if (turnId === undefined) return;
		// The error propagates on purpose: the page maps it to copy.
		await deps.cancelTurn(projectId, turnId);
	}, [stop, activeTurn?.turnId, deps, projectId]);

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
