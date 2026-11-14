/**
 * React hook over the V2 turn stream of one conversation of a project. Owns
 * the useChat instance and exposes the running turn id and its cost estimate.
 * Sends text, files, question answers, approval decisions, and the turn mode
 * as turn requests. A refused send leaves the chat, so the composer can show
 * it again. After a failed stream, `reconnect` replays the running turn.
 * While no stream runs, it polls the running turn, the busy conversation,
 * and the head. It then follows a turn of this conversation or a commit of
 * another client, such as a coding agent. A turn of another conversation
 * never replays here: the hook only reports that conversation as busy.
 * A 402 answer opens the credits dialog. Called by use-builder-thread.ts;
 * calls builder-chat-transport.ts, api/app-builder.queries.ts,
 * api/app-builder.services.ts, and the billing dispatch.
 */

import { useChat } from "@ai-sdk/react";
import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	type BuilderTurnMode,
	type BuilderTurnStatus,
	createTurnResponseSchema,
	type PreviewTarget,
	type TurnApprovalAnswer,
	type TurnEstimate,
	type TurnQuestionAnswer,
	turnDoneDataSchema,
} from "@wandit/contracts";
import type { ChatStatus, FileUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { dispatchBillingError } from "@/features/billing";
import { creditsKeys } from "@/features/credits";
import {
	activeTurnStateQuery,
	appBuilderKeys,
	chatHistoryQuery,
} from "../api/app-builder.queries";
import { cancelTurn, getActiveTurnState } from "../api/app-builder.services";
import { cloudKeys } from "../api/cloud.queries";
import type { TurnMessage, TurnMessagePart } from "../api/dto";
import { githubKeys } from "../api/github.queries";
import {
	createBuilderChatTransport,
	hydrateTurnMessages,
} from "./builder-chat-transport";

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
	/** Model id from the model menu, a row of `GET /api/v2/models`; absent uses the deploy default. */
	model?: string;
	/** `plan` runs the turn in Plan Mode: the agent asks and plans, and changes no file. Absent sends a build turn. */
	mode?: BuilderTurnMode;
	/** Elements picked in the preview. They go on the user message as a `data-targets` part. */
	targets?: PreviewTarget[];
};

/**
 * Injectable seams so specs pass fakes instead of mocking repo modules.
 * `fetch` reaches the SSE transport; `cancelTurn` is the POST cancel call;
 * `getActiveTurnState` is the poll of the running turn and the head.
 */
export type BuilderChatDeps = {
	fetch: typeof globalThis.fetch;
	cancelTurn: typeof cancelTurn;
	getActiveTurnState: typeof getActiveTurnState;
};

// The one field of the done frame that the head rule reads. The frame
// crosses the HTTP boundary, so the schema checks it.
const turnDoneCommitSchema = turnDoneDataSchema.pick({ outputCommitSha: true });

const defaultDeps: BuilderChatDeps = {
	fetch: globalThis.fetch,
	cancelTurn,
	getActiveTurnState,
};

/** Live state and actions of one conversation, as the page consumes them. */
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
	 * Id of the conversation that holds the project, or null. It is this
	 * conversation while its turn streams, else the last answer of the 5 s
	 * poll. Another conversation cannot send while this value names one.
	 */
	busyChatId: string | null;
	/**
	 * Aborts the stream, then posts the cancel; rejects with the POST error.
	 * Before the first frame it waits for the turn id first.
	 */
	cancel: () => Promise<void>;
	/**
	 * Runs after a failed request. GET turns/active/stream replays the running
	 * turn from its first event, or answers 204 when no turn runs. The stored
	 * history loads again without a replay, and after the replay of a refused
	 * send. Does nothing unless the status is `error`, and while a follow runs.
	 */
	reconnect: () => Promise<void>;
};

/**
 * The `chatId`, `initialMessages`, and `isHistorySettled` inputs come from
 * useBuilderThread (it composes them from the open conversation of the
 * page, the paged chatHistoryQuery, and hydrateTurnMessages). While `chatId`
 * is undefined no transport exists and `send` refuses. A new `chatId`
 * switches the conversation in place: useChat builds a new chat for it.
 */
export function useBuilderChat(
	input: {
		/** Project the turn routes are scoped to. */
		projectId: string;
		/** Id of the open conversation; undefined while the conversation list loads. */
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
	// A new send, a created frame, a 204, or a conversation switch clears it.
	// A failed reconnect GET keeps it, because useChat then keeps the send error.
	const [refusedSendChatId, setRefusedSendChatId] = useState<string | null>(
		null,
	);
	// A project or conversation switch keeps this hook. A useChat of another
	// chat id starts with no error, so the flag of the old chat goes.
	if (refusedSendChatId !== null && refusedSendChatId !== chatId) {
		setRefusedSendChatId(null);
	}
	// The reconnect that runs now, or null. The created frame of its replay
	// sets `hasReplay`. onError sets `hasFailed` when its GET or stream fails.
	const reconnectRef = useRef<{
		hasReplay: boolean;
		hasFailed: boolean;
	} | null>(null);
	// The follow of another client's turn that runs now, or null. The created
	// frame of its replay sets `hasReplay`; without it, the GET found no turn.
	const followRef = useRef<{ hasReplay: boolean } | null>(null);
	// What the poll rules know about one conversation. A project or
	// conversation switch in place keeps this hook, so `followStateOf` starts
	// the state of another conversation again.
	const followStateRef = useRef<{
		projectId: string;
		/** Id of the conversation of this state; undefined while the conversation list loads. */
		chatId: string | undefined;
		/** Ids of the turns whose created frame this hook streamed, and of each followed turn. */
		streamedTurnIds: Set<string>;
		/** Head sha of the last poll answer. Undefined until an answer sets the baseline. */
		headSha: string | null | undefined;
	}>({ projectId, chatId, streamedTurnIds: new Set(), headSha: undefined });
	const followStateOf = useCallback(
		(ofProjectId: string, ofChatId: string | undefined) => {
			if (
				followStateRef.current.projectId !== ofProjectId ||
				followStateRef.current.chatId !== ofChatId
			) {
				followStateRef.current = {
					projectId: ofProjectId,
					chatId: ofChatId,
					streamedTurnIds: new Set(),
					headSha: undefined,
				};
			}
			return followStateRef.current;
		},
		[],
	);
	// True when the created frame of the current stream had `queued: true`.
	// That turn waited behind another turn, which can come from another client.
	const isQueuedTurnRef = useRef(false);
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

	// A finished turn can change ten caches: the versions, the code, the
	// theme, the project summary, the app backend, the credits, the next
	// estimate, the chat cost, the conversation list, and the GitHub status.
	// All ten refresh at once. The code key covers the Code view tree and
	// every open file. The theme changes on a set_theme call or a theme
	// answer. The Cloud keys cover the tables, functions, secrets, and every
	// other panel. The backend state polls on its own. The turn commit moves
	// the head that the GitHub pull sends back.
	const invalidateTurnData = useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.versions(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.code(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.theme(projectId),
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
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.chatCost(projectId, chatId),
		});
		// A turn moves its conversation to the top of the list.
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.chats(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: githubKeys.status(projectId),
		});
	}, [queryClient, projectId, chatId]);

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
				// A later poll that still shows this id must not replay the turn.
				followStateOf(projectId, chatId).streamedTurnIds.add(created.turnId);
				// The first message of a conversation is its title, and the API
				// stored it before this frame. So the conversation list loads again.
				void queryClient.invalidateQueries({
					queryKey: appBuilderKeys.chats(projectId),
				});
				isQueuedTurnRef.current = created.queued === true;
				// A turn owns the chat now. A later error is a turn error, not the
				// error of a refused send.
				setRefusedSendChatId(null);
				if (reconnectRef.current !== null) {
					reconnectRef.current.hasReplay = true;
				}
				if (followRef.current !== null) {
					followRef.current.hasReplay = true;
				}
			}
			// The commit of this turn moves the head, and onFinish refreshes the
			// caches. So the head rule takes this sha as its baseline. A queued
			// turn ran after another turn, and the chat can lack the rows of that
			// turn. Its sha is not the baseline, so the next poll sees a head move.
			if (part.type === "data-turn-done") {
				const { outputCommitSha } = turnDoneCommitSchema.parse(part.data);
				if (outputCommitSha !== undefined && !isQueuedTurnRef.current) {
					followStateOf(projectId, chatId).headSha = outputCommitSha;
				}
			}
		},
		// A 402 answer of the create POST opens the credits dialog. The
		// dispatch ignores every other error; the pane shows its sentence.
		onError: (error) => {
			// A 402 means the paying pool is empty. The estimate carries the payer
			// state that locks the composer, so it refetches.
			if (dispatchBillingError(error) !== null) {
				void queryClient.invalidateQueries({
					queryKey: appBuilderKeys.turnEstimate(projectId),
				});
			}
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
	// A project or conversation switch in place builds a new Chat. A follow
	// that waited for the history reads this ref, so it never resumes on the
	// old Chat.
	const chatIdRef = useRef(chatId);
	useEffect(() => {
		chatIdRef.current = chatId;
	}, [chatId]);
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
		// A follow also runs a GET, and it can start in `error`.
		if (
			chatId === undefined ||
			status !== "error" ||
			reconnectRef.current !== null ||
			followRef.current !== null
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
		const historyKey = appBuilderKeys.chatHistory(projectId, chatId);
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

	// Opens the stream of a turn that another client started in this
	// conversation, as a reload does: the stored user row of the turn first,
	// then the replayed reply.
	const follow = useCallback(
		async (turnId: string): Promise<void> => {
			// Each turn follows once, also after a 204 or a send that comes first.
			followStateOf(projectId, chatId).streamedTurnIds.add(turnId);
			const attempt = { hasReplay: false };
			followRef.current = attempt;
			const historyKey = chatHistoryQuery(projectId, chatId).queryKey;
			try {
				// A failed load keeps the cached page, and the error row shows the failure.
				await queryClient.refetchQueries({ queryKey: historyKey, exact: true });
				// The user can send during the load. That send owns the chat then.
				if (
					statusRef.current === "submitted" ||
					statusRef.current === "streaming" ||
					chatIdRef.current !== chatId
				) {
					return;
				}
				// The reseed effect runs only after the next render, so the page
				// comes from the cache. The user row then shows above the reply.
				const newestPage = queryClient.getQueryData(historyKey)?.pages[0];
				if (newestPage !== undefined) {
					setMessages(hydrateTurnMessages(newestPage.items));
				}
				await resumeStream();
			} finally {
				followRef.current = null;
			}
			if (attempt.hasReplay) return;
			// The GET answered 204 (the turn ended during the load) or failed.
			// onFinish runs only for a stream, so the chat and the turn data load here.
			// A 204 ends the error of a refused send, and a failed GET replaces it.
			setRefusedSendChatId(null);
			void queryClient.invalidateQueries({ queryKey: historyKey });
			invalidateTurnData();
		},
		[
			projectId,
			chatId,
			followStateOf,
			queryClient,
			setMessages,
			resumeStream,
			invalidateTurnData,
		],
	);

	// The poll starts with the mount resume: after the chat id and the history.
	// A stream of this page says more than the poll: its frames and its end
	// refresh the chat and the caches. So the poll waits while one runs.
	const activeTurnState = useQuery({
		...activeTurnStateQuery(projectId, deps.getActiveTurnState),
		enabled: chatId !== undefined && isHistorySettled && !isSending,
	});
	const polledTurnId = activeTurnState.data?.activeTurnId ?? null;
	const polledBusyChatId = activeTurnState.data?.busyChatId ?? null;
	const polledHeadSha = activeTurnState.data?.headSha;

	// A running turn that this hook did not stream comes from another client:
	// the MCP tool `send_prompt`, or a teammate. The chat follows it when idle.
	// Idle includes `error`. A failed turn or a refused send keeps that status
	// until the next send. resumeStream works from it, as reconnect shows.
	useEffect(() => {
		if (
			polledTurnId === null ||
			chatId === undefined ||
			!isHistorySettled ||
			isSending
		) {
			return;
		}
		// Product rule: one conversation at a time uses the project. A turn of
		// another conversation never replays into this thread.
		if (polledBusyChatId !== chatId) return;
		// A second resume GET aborts the first, so one resume runs at a time.
		// The status stays `ready` during the mount resume GET. A follow then
		// aborts that GET and streams the same turn.
		if (followRef.current !== null || reconnectRef.current !== null) return;
		if (followStateOf(projectId, chatId).streamedTurnIds.has(polledTurnId)) {
			return;
		}
		void follow(polledTurnId);
	}, [
		polledTurnId,
		polledBusyChatId,
		chatId,
		isHistorySettled,
		isSending,
		projectId,
		followStateOf,
		follow,
	]);

	// A head move while no stream runs comes from another client: the MCP tool
	// `apply_changes`, a restore in another tab, a turn of another
	// conversation, or a turn that ended while this tab was hidden. A Stop of
	// this page also moves it: the wip commit lands while its row still
	// cancels. The turn caches load again.
	useEffect(() => {
		if (polledHeadSha === undefined) return;
		const followState = followStateOf(projectId, chatId);
		const previousHeadSha = followState.headSha;
		followState.headSha = polledHeadSha;
		// The first answer only sets the baseline. A stream of this page
		// refreshes the caches when it ends. The status comes from the ref, so
		// the end of a stream does not run this rule again on an old answer.
		const isStreaming =
			statusRef.current === "submitted" || statusRef.current === "streaming";
		if (
			previousHeadSha === undefined ||
			previousHeadSha === polledHeadSha ||
			isStreaming
		) {
			return;
		}
		// The history hides the reply of an active turn. During a Stop, a reseed
		// from it drops the stopped reply. The follow loads the chat of an active
		// turn of another client. So the chat loads here only when no turn is active.
		// LIMIT: a turn of another client can run only between two polls, as in a hidden tab. It shows after a reload when it changes no file or the chat is in `error`. Upgrade: the newest turn id in the poll answer, and a follow of that turn.
		if (polledTurnId === null) {
			void queryClient.invalidateQueries({
				queryKey: appBuilderKeys.chatHistory(projectId, chatId),
			});
		}
		invalidateTurnData();
	}, [
		polledHeadSha,
		polledTurnId,
		projectId,
		chatId,
		followStateOf,
		queryClient,
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
		// The poll waits while this chat streams, so its last answer is old then.
		busyChatId:
			isSending && !isAwaitingTurn && chatId !== undefined
				? chatId
				: polledBusyChatId,
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
