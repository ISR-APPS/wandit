import { useChat } from "@ai-sdk/react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
	type AiChatCreditsSettledData,
	type AiChatDataParts,
	type AiChatMessageMetadata,
	type AiChatSelectedTarget,
	type AiChatTools,
	type AiErrorData,
	type AskUserOutput,
	aiChatBillingErrorDataSchema,
	aiChatCreditsSettledDataSchema,
	aiChatMessageMetadataSchema,
	aiChatRoutes,
	aiErrorDataSchema,
	type ComposerMetadata,
	type CreditBalanceResponse,
	composerMetadataSchema,
	type UploadAttachmentResponse,
} from "@wandit/contracts";
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithApprovalResponses,
	lastAssistantMessageIsCompleteWithToolCalls,
	type UIMessage,
} from "ai";
import { fetch as expoFetch } from "expo/fetch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { creditsKeys } from "@/features/credits";
import {
	type BillingErrorIntent,
	toBillingErrorIntent,
} from "@/features/credits/lib/billing-error";
import {
	useChatByProject,
	useChatMessages,
} from "@/features/workspace/api/chat.queries";
import { pageKeys } from "@/features/workspace/api/generation.keys";
import { authClient } from "@/lib/auth-client";
import { getServerUrl } from "@/shared/lib/server-url";
import {
	aiErrorNoticeKey,
	findLastTerminalAiErrorMessage,
} from "./ai-error-copy";
import { chatAutostart } from "./chat-autostart";
import { findRetryRequestMetadata } from "./retry-request-metadata";
import { createStatusPreservingChatFetch } from "./status-preserving-chat-fetch";

export type WanditUIMessage = UIMessage<
	AiChatMessageMetadata,
	AiChatDataParts,
	AiChatTools
>;

export type SendChatTextOptions = {
	composer?: ComposerMetadata;
	files?: UploadAttachmentResponse[];
	/** Ordered request-level targets used by the agent for this turn (page
	 * comment batches — web parity). */
	selectedWids?: string[];
	/** Ordered display snapshots persisted on the user message for target
	 * chips. */
	selectedTargets?: AiChatSelectedTarget[];
};

export function useAiChat(projectId?: string) {
	const queryClient = useQueryClient();
	const chatByProjectQuery = useChatByProject(projectId);
	const chatId = chatByProjectQuery.data?.chatId;
	const messagesQuery = useChatMessages(chatId);

	// Request metadata must remain unchanged when ask_user answers or approval
	// responses automatically continue the same assistant turn.
	const metaRef = useRef<{
		composer?: ComposerMetadata;
		selectedWids?: string[];
	}>({});
	const lastSendSucceededRef = useRef(false);
	const aiErrorRef = useRef<AiErrorData | null>(null);
	const [aiError, setAiError] = useState<AiErrorData | null>(null);
	const [notices, setNotices] = useState<AiErrorData[]>([]);
	// Billing is a monotonic condition within one chat turn: the server can
	// emit a typed billing data part and then a generic AI SDK error chunk;
	// that later chunk must not restore the generic error UI (web parity).
	const billingErrorInCurrentTurnRef = useRef(false);
	const [billingIntent, setBillingIntent] = useState<BillingErrorIntent | null>(
		null,
	);

	const initialMessages = useMemo(
		() =>
			(messagesQuery.data?.messages ?? []).flatMap<WanditUIMessage>(
				(message) => {
					if (message.role === "system" || message.parts.length === 0) {
						return [];
					}
					// Assistants carry model/usage, targeted user turns carry the
					// selected-target snapshots rendered in history.
					const metadata = parsePersistedMessageMetadata(message.metadata);
					return [
						{
							id: message.id,
							role: message.role,
							parts: message.parts as WanditUIMessage["parts"],
							...(metadata ? { metadata } : {}),
						},
					];
				},
			),
		[messagesQuery.data?.messages],
	);

	const transport = useMemo(
		() =>
			new DefaultChatTransport<WanditUIMessage>({
				api: chatId ? buildStreamUrl(chatId) : undefined,
				credentials: "include",
				// Typed errors (billing status, server code, credit details) must
				// survive the transport — DefaultChatTransport alone flattens every
				// non-2xx into a plain Error.
				fetch: createStatusPreservingChatFetch(
					expoFetch as unknown as typeof globalThis.fetch,
				),
				// Expo/Better Auth persists the cookie outside a browser cookie jar.
				// Resolve headers for every request so a refreshed session is used by
				// normal sends and automatic tool continuations alike.
				headers: createStreamHeaders,
				prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => ({
					body: {
						id,
						messages,
						trigger,
						messageId,
						...(metaRef.current.composer || metaRef.current.selectedWids
							? {
									metadata: {
										...(metaRef.current.composer
											? { composer: metaRef.current.composer }
											: {}),
										...(metaRef.current.selectedWids
											? { selectedWids: metaRef.current.selectedWids }
											: {}),
									},
								}
							: {}),
					},
				}),
			}),
		[chatId],
	);

	const {
		messages,
		status,
		error: streamError,
		sendMessage,
		addToolOutput,
		addToolApprovalResponse,
		setMessages,
		regenerate,
	} = useChat<WanditUIMessage>({
		id: chatId ?? `project:${projectId ?? "none"}`,
		messageMetadataSchema: aiChatMessageMetadataSchema,
		dataPartSchemas: {
			"ai-error": aiErrorDataSchema,
			"billing-error": aiChatBillingErrorDataSchema,
			"credits-settled": aiChatCreditsSettledDataSchema,
		},
		messages: initialMessages,
		transport,
		sendAutomaticallyWhen: (options) =>
			lastAssistantMessageIsCompleteWithToolCalls(options) ||
			lastAssistantMessageIsCompleteWithApprovalResponses(options),
		onFinish: ({ isAbort, isError }) => {
			lastSendSucceededRef.current =
				!isAbort && !isError && !billingErrorInCurrentTurnRef.current;
			// A content-filter finish can be transport-successful while the typed
			// terminal data part is the user-visible outcome. Preserve it; ordinary
			// successful turns clear stale failures. Notices never outlive a turn.
			if (!aiErrorRef.current) setAiError(null);
			setNotices([]);
			void queryClient.invalidateQueries({
				queryKey: creditsKeys.balance(),
			});
			// AI edits and page generation mint NEW immutable versions server-side
			// — refresh the preview's overview + history once the turn settles
			// (web parity).
			if (projectId) {
				void queryClient.invalidateQueries({
					queryKey: pageKeys.overview(projectId),
				});
				void queryClient.invalidateQueries({
					queryKey: pageKeys.versions(projectId),
				});
			}
		},
		onError: (chatError) => {
			const intent = toBillingErrorIntent(chatError);
			if (intent) {
				billingErrorInCurrentTurnRef.current = true;
				setBillingIntent(intent);
				// The balance is the composer lock's authority — refetch it now so
				// the gate engages immediately, not on the next 15s poll.
				void queryClient.invalidateQueries({
					queryKey: creditsKeys.balance(),
				});
			}
		},
		onData: (part) => {
			if (part.type === "data-ai-error") {
				if (part.data.terminal) {
					// Tool-scoped failures render on their owning card, never as the
					// whole-turn banner.
					if (!part.data.toolCallId) {
						aiErrorRef.current = part.data;
						setAiError(part.data);
					}
				} else {
					setNotices((current) =>
						current.some(
							(notice) =>
								aiErrorNoticeKey(notice) === aiErrorNoticeKey(part.data),
						)
							? current
							: [...current, part.data],
					);
				}
				return;
			}
			if (part.type === "data-credits-settled") {
				applyCreditsSettled(queryClient, part.data);
				return;
			}
			const intent = toBillingErrorIntent(part);
			if (intent) {
				billingErrorInCurrentTurnRef.current = true;
				setBillingIntent(intent);
				void queryClient.invalidateQueries({
					queryKey: creditsKeys.balance(),
				});
			}
		},
	});

	const seededChatIdsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		if (
			!projectId ||
			!chatId ||
			!messagesQuery.data ||
			seededChatIdsRef.current.has(chatId)
		) {
			return;
		}

		// History usually resolves after useChat is constructed. Seed it once per
		// chat so a later query refetch cannot overwrite an in-flight transcript.
		setMessages(initialMessages);
		seededChatIdsRef.current.add(chatId);

		if (initialMessages.at(-1)?.role !== "user") return;

		// The flag is consumed before starting, making the handoff safe against
		// duplicate effects. regenerate() posts the persisted user message as-is;
		// sendMessage() would create a duplicate user row.
		const autostart = chatAutostart.consume(projectId, chatId);
		if (!autostart) return;

		const initiatingId = initialMessages.at(-1)?.id;
		const initiatingMetadata = messagesQuery.data.messages.find(
			(message) => message.id === initiatingId,
		)?.metadata;
		const persistedComposer = parseComposerMetadata(initiatingMetadata);

		metaRef.current = {
			composer: persistedComposer ?? autostart.composer,
		};
		lastSendSucceededRef.current = false;
		billingErrorInCurrentTurnRef.current = false;
		aiErrorRef.current = null;
		setAiError(null);
		setNotices([]);
		setBillingIntent(null);
		void regenerate();
	}, [
		chatId,
		initialMessages,
		messagesQuery.data,
		projectId,
		regenerate,
		setMessages,
	]);

	const sendText = useCallback(
		async (text: string, options?: SendChatTextOptions) => {
			const trimmed = text.trim();
			if (!chatId || !messagesQuery.data) return false;
			if (!trimmed && !options?.files?.length) return false;

			const selectedWids = options?.selectedWids?.length
				? options.selectedWids
				: undefined;
			const selectedTargets = options?.selectedTargets?.length
				? options.selectedTargets
				: undefined;
			const messageMetadata =
				options?.composer || selectedWids || selectedTargets
					? {
							...(options?.composer ? { composer: options.composer } : {}),
							...(selectedWids ? { selectedWids } : {}),
							...(selectedTargets ? { selectedTargets } : {}),
						}
					: undefined;
			metaRef.current = { composer: options?.composer, selectedWids };
			lastSendSucceededRef.current = false;
			billingErrorInCurrentTurnRef.current = false;
			aiErrorRef.current = null;
			setAiError(null);
			setNotices([]);
			setBillingIntent(null);

			const files = options?.files?.map((file) => ({
				type: "file" as const,
				mediaType: file.mediaType,
				filename: file.filename,
				url: file.url,
			}));

			try {
				// An attachment-only message must OMIT the text part entirely — the
				// server 400s on empty text parts. Targeted turns carry the display
				// snapshots on the message so history renders their chips.
				await sendMessage(
					trimmed
						? {
								text: trimmed,
								...(files?.length ? { files } : {}),
								...(messageMetadata ? { metadata: messageMetadata } : {}),
							}
						: {
								files: files ?? [],
								...(messageMetadata ? { metadata: messageMetadata } : {}),
							},
				);
				return lastSendSucceededRef.current;
			} catch {
				// The transport threw before the server accepted the message, but
				// the SDK keeps the optimistic user row. The composer preserves the
				// draft on `false`, so retrying would post the prompt TWICE (the
				// stale row plus the retyped one) — drop the dangling row.
				setMessages((current) => {
					const last = current[current.length - 1];
					return last?.role === "user" ? current.slice(0, -1) : current;
				});
				return false;
			}
		},
		[chatId, messagesQuery.data, sendMessage, setMessages],
	);

	const answerAskUser = useCallback(
		(toolCallId: string, output: AskUserOutput) => {
			void addToolOutput({
				tool: "ask_user",
				toolCallId,
				output,
			});
		},
		[addToolOutput],
	);

	const retryTurn = () => {
		const failedMessage = findLastTerminalAiErrorMessage(messages);
		if (!failedMessage) return;

		metaRef.current = findRetryRequestMetadata(
			messages,
			failedMessage.id,
			metaRef.current,
		);
		aiErrorRef.current = null;
		setAiError(null);
		setNotices([]);
		lastSendSucceededRef.current = false;
		billingErrorInCurrentTurnRef.current = false;
		setBillingIntent(null);
		return regenerate({ messageId: failedMessage.id });
	};

	const historyError =
		chatByProjectQuery.error ?? messagesQuery.error ?? undefined;

	return {
		chatId,
		messages,
		status,
		error: streamError ?? historyError,
		streamError,
		historyError,
		aiError,
		notices,
		billingError: billingIntent !== null,
		billingIntent,
		sendText,
		answerAskUser,
		answerAsk: answerAskUser,
		addToolOutput,
		addToolApprovalResponse,
		regenerate,
		retryTurn,
		isResolvingChat: chatByProjectQuery.isPending,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
	};
}

/**
 * The server sends the post-settle balance once per turn. Seed the cache
 * with it so the chip moves exactly once, then refetch the credits queries
 * in the background (web parity).
 */
export function applyCreditsSettled(
	queryClient: QueryClient,
	data: AiChatCreditsSettledData,
): void {
	queryClient.setQueryData<CreditBalanceResponse>(
		creditsKeys.balance(),
		(prev) => (prev ? { ...prev, settledBalance: data.settledBalance } : prev),
	);
	void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
}

function buildStreamUrl(chatId: string) {
	return `${getServerUrl().replace(/\/$/, "")}${aiChatRoutes.stream(chatId)}`;
}

function createStreamHeaders() {
	const cookie = authClient.getCookie();
	return {
		Accept: "text/event-stream",
		...(cookie ? { Cookie: cookie } : {}),
	};
}

function parseComposerMetadata(value: unknown): ComposerMetadata | undefined {
	const direct = composerMetadataSchema.safeParse(value);
	if (direct.success) return direct.data;

	if (!value || typeof value !== "object") return undefined;
	const nested = composerMetadataSchema.safeParse(
		(value as Record<string, unknown>).composer,
	);
	return nested.success ? nested.data : undefined;
}

function parsePersistedMessageMetadata(
	value: unknown,
): AiChatMessageMetadata | undefined {
	// Project creation historically stored the composer object directly.
	const directComposer = composerMetadataSchema.safeParse(value);
	if (directComposer.success) return { composer: directComposer.data };

	const metadata = aiChatMessageMetadataSchema.safeParse(value);
	return metadata.success ? metadata.data : undefined;
}
