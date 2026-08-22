import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	type AiChatDataParts,
	type AiChatMessageMetadata,
	type AiChatSelectedTarget,
	type AiChatTools,
	type AskUserOutput,
	aiChatBillingErrorDataSchema,
	aiChatMessageMetadataSchema,
	aiChatRoutes,
	type ComposerMetadata,
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
import { pageKeys } from "@/features/workspace/api/generation.keys";
import {
	type BillingErrorIntent,
	toBillingErrorIntent,
} from "@/features/credits/lib/billing-error";
import {
	useChatByProject,
	useChatMessages,
} from "@/features/workspace/api/chat.queries";
import { authClient } from "@/lib/auth-client";
import { isApiClientError } from "@/shared/lib/base-service";
import { getServerUrl } from "@/shared/lib/server-url";
import { chatAutostart } from "./chat-autostart";
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
					const metadata = aiChatMessageMetadataSchema.safeParse(
						message.metadata,
					);
					return [
						{
							id: message.id,
							role: message.role,
							parts: message.parts as WanditUIMessage["parts"],
							...(metadata.success ? { metadata: metadata.data } : {}),
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
			"billing-error": aiChatBillingErrorDataSchema,
		},
		messages: initialMessages,
		transport,
		sendAutomaticallyWhen: (options) =>
			lastAssistantMessageIsCompleteWithToolCalls(options) ||
			lastAssistantMessageIsCompleteWithApprovalResponses(options),
		onFinish: ({ isAbort, isError }) => {
			lastSendSucceededRef.current =
				!isAbort && !isError && !billingErrorInCurrentTurnRef.current;
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
			metaRef.current = { composer: options?.composer, selectedWids };
			lastSendSucceededRef.current = false;
			billingErrorInCurrentTurnRef.current = false;
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
								...(selectedTargets ? { metadata: { selectedTargets } } : {}),
							}
						: { files: files ?? [] },
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

	const historyError =
		chatByProjectQuery.error ?? messagesQuery.error ?? undefined;

	return {
		chatId,
		messages,
		status,
		error: streamError ?? historyError,
		streamError,
		historyError,
		billingError: billingIntent !== null,
		billingIntent,
		sendText,
		answerAskUser,
		answerAsk: answerAskUser,
		addToolOutput,
		addToolApprovalResponse,
		regenerate,
		isResolvingChat: chatByProjectQuery.isPending,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
	};
}

/**
 * The generic stream-error copy says "try again", which is exactly wrong for
 * two server refusals: 409 AI_CHAT_OPERATION_REPLAYED means the identical
 * transcript already COMPLETED (the user must send a new message), and 409
 * AI_CHAT_TURN_ACTIVE means this turn is streaming RIGHT NOW (the user must
 * wait, not fork the chat). Everything else keeps the generic text.
 */
export function chatStreamErrorKey(
	error: unknown,
):
	| "native.workspace.chat.errors.busy"
	| "native.workspace.chat.errors.replayed"
	| "native.workspace.chat.errors.stream" {
	if (isApiClientError(error) && error.code === "AI_CHAT_OPERATION_REPLAYED") {
		return "native.workspace.chat.errors.replayed";
	}

	if (isApiClientError(error) && error.code === "AI_CHAT_TURN_ACTIVE") {
		return "native.workspace.chat.errors.busy";
	}

	return "native.workspace.chat.errors.stream";
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
