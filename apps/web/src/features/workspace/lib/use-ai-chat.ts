import { useChat } from "@ai-sdk/react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
	type AiChatCreditsSettledData,
	type AiChatDataParts,
	type AiChatMessageMetadata,
	type AiChatSelectedTarget,
	type AiChatTools,
	type AskUserOutput,
	aiChatBillingErrorDataSchema,
	aiChatCreditsSettledDataSchema,
	aiChatMessageMetadataSchema,
	aiChatRoutes,
	type ChatMessage,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dispatchBillingError } from "@/features/billing/lib/billing-error-dispatch";
import { creditsKeys } from "@/features/credits/api/credits.queries";
import { chatAutostart, projectKeys } from "@/features/projects";
import { workspaceScopeHeaders } from "@/features/workspaces/lib/workspace-scope";
import { isApiClientError } from "@/lib/api-client";
import { getServerUrl } from "@/lib/server-url";
import {
	useChatByProjectQuery,
	useChatMessagesQuery,
} from "../api/chat.queries";
import { pageKeys } from "../api/pages.queries";
import { createStatusPreservingChatFetch } from "./status-preserving-chat-transport";

export type WanditUIMessage = UIMessage<
	AiChatMessageMetadata,
	AiChatDataParts,
	AiChatTools
>;

export type SendAiTextOptions = {
	/** Uploaded R2 assets sent as AI SDK v7 file parts (contract §10.4). */
	files?: UploadAttachmentResponse[];
	composer?: ComposerMetadata;
	/** Ordered request-level targets used by the agent for this turn. */
	selectedWids?: string[];
	/** Ordered display snapshots persisted on the user message for target chips. */
	selectedTargets?: AiChatSelectedTarget[];
};

/** Turn persisted chat rows into the AI SDK shape used by the live thread. */
export function hydrateAiChatMessages(
	messages: readonly ChatMessage[],
): WanditUIMessage[] {
	return messages.flatMap<WanditUIMessage>((message) => {
		if (message.role === "system" || message.parts.length === 0) return [];

		// Both sides can carry typed metadata now: assistants carry model/usage,
		// while targeted user turns carry the descriptor rendered in history.
		const metadata = aiChatMessageMetadataSchema.safeParse(message.metadata);

		return [
			{
				id: message.id,
				role: message.role,
				parts: message.parts as WanditUIMessage["parts"],
				...(metadata.success ? { metadata: metadata.data } : {}),
			},
		];
	});
}

export function useAiChat(projectId: string) {
	const chatByProjectQuery = useChatByProjectQuery(projectId);
	const chatId = chatByProjectQuery.data?.chatId;
	const messagesQuery = useChatMessagesQuery(chatId);

	// Per-turn request metadata (contract §10.1). A ref, not state: it must
	// survive the SAME turn's automatic resubmits (ask_user answers) unchanged,
	// and is overwritten by the next sendText. The transport reads it below in
	// prepareSendMessagesRequest — sendMessage's options.body is NOT used
	// because it would not cover those automatic resubmits.
	const metaRef = useRef<{
		composer?: ComposerMetadata;
		selectedWids?: string[];
	}>({});

	// AI edits and page generation mint a NEW immutable version
	// server-side. Both keys must be invalidated: pageKeys.versions refreshes
	// the version list (VersionSwitcher, assets, history), while the preview
	// iframe only remounts via pageKeys.overview (its key contains
	// activeVersion.id).
	const queryClient = useQueryClient();
	const invalidatePageData = useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: pageKeys.versions(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: pageKeys.overview(projectId),
		});
	}, [queryClient, projectId]);
	const invalidateFinishedTurnData = useCallback(() => {
		invalidatePageData();
		void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
		void queryClient.invalidateQueries({
			queryKey: projectKeys.lists(),
		});
		void queryClient.invalidateQueries({
			queryKey: projectKeys.detail(projectId),
		});
	}, [invalidatePageData, queryClient, projectId]);
	// Ref so the Chat instance (created once per chat id) never holds a stale
	// turn-end invalidation closure.
	const invalidateFinishedTurnDataRef = useRef(invalidateFinishedTurnData);
	useEffect(() => {
		invalidateFinishedTurnDataRef.current = invalidateFinishedTurnData;
	}, [invalidateFinishedTurnData]);

	const initialMessages = useMemo(
		() => hydrateAiChatMessages(messagesQuery.data?.messages ?? []),
		[messagesQuery.data?.messages],
	);
	// AI SDK's sendMessage Promise resolves even when the transport fails; the
	// authoritative outcome arrives through onFinish. PromptBox uses this
	// result to clear only drafts that were actually accepted and completed.
	const lastSendSucceededRef = useRef(false);
	// Targets belong to the live AI turn, not the mutable editor selection.
	// Keeping them here lets the preview replay its pulses after iframe remounts.
	const [aiTargets, setAiTargets] = useState<AiChatSelectedTarget[]>([]);
	const [billingError, setBillingError] = useState(false);
	const billingErrorInCurrentTurnRef = useRef(false);

	const transport = useMemo(
		() =>
			new DefaultChatTransport<WanditUIMessage>({
				api: chatId ? buildStreamUrl(chatId) : undefined,
				credentials: "include",
				fetch: createStatusPreservingChatFetch(),
				// The returned body REPLACES the default assembly entirely
				// (http-chat-transport.ts uses it verbatim when defined), so it must
				// carry the complete default fields plus our optional metadata.
				prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => ({
					// Workspace scoping (§2): the AI stream bypasses axios, so the
					// active-workspace header must ride this transport explicitly.
					headers: workspaceScopeHeaders(),
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
		error,
		sendMessage,
		addToolOutput,
		addToolApprovalResponse,
		setMessages,
		regenerate,
	} = useChat<WanditUIMessage>({
		id: chatId ?? `project:${projectId}`,
		messageMetadataSchema: aiChatMessageMetadataSchema,
		dataPartSchemas: {
			"billing-error": aiChatBillingErrorDataSchema,
			"credits-settled": aiChatCreditsSettledDataSchema,
		},
		messages: initialMessages,
		transport,
		sendAutomaticallyWhen: (options) =>
			lastAssistantMessageIsCompleteWithToolCalls(options) ||
			lastAssistantMessageIsCompleteWithApprovalResponses(options),
		// Unconditional turn-end refetch — harmless after aborted/failed turns
		// and covers partial turns that already applied a section.
		onFinish: ({ isAbort, isError }) => {
			lastSendSucceededRef.current =
				!isAbort && !isError && !billingErrorInCurrentTurnRef.current;
			invalidateFinishedTurnDataRef.current();
		},
		onError: (chatError) => {
			const intent = dispatchBillingError(chatError);
			billingErrorInCurrentTurnRef.current = nextBillingErrorInTurn(
				billingErrorInCurrentTurnRef.current,
				intent,
			);
			if (billingErrorInCurrentTurnRef.current) {
				setBillingError(true);
			}
		},
		onData: (part) => {
			if (part.type === "data-credits-settled") {
				applyCreditsSettled(queryClient, part.data);
				return;
			}
			const intent = dispatchBillingError(part);
			if (intent) {
				billingErrorInCurrentTurnRef.current = true;
				setBillingError(true);
			}
		},
	});

	const seededChatId = useRef<string | null>(null);

	useEffect(() => {
		if (!chatId || !messagesQuery.data || seededChatId.current === chatId) {
			return;
		}

		// The query resolves after useChat is created, so seed each chat once when
		// its persisted history becomes available without replacing later live turns.
		setMessages(initialMessages);
		seededChatId.current = chatId;

		// A project fresh from the dashboard arrives with its prompt already
		// persisted as the last user message but no assistant reply yet. When the
		// one-shot autostart flag matches this chat, continue that existing turn.
		// regenerate() posts the transcript as-is — sendMessage() would append a
		// duplicate user message.
		if (
			initialMessages.at(-1)?.role === "user" &&
			chatAutostart.consume(projectId, chatId)
		) {
			// Prime the per-turn metadata from the initiating message's persisted
			// composer so the dashboard's mode/output/goal reach the agent
			// (contract §10.1 — this closes the first-message metadata gap).
			// projects.repository.ts stores the composer object directly in
			// `metadata`; parse defensively and also accept a nested `{ composer }`.
			// Look the row up by id: initialMessages filters system/empty messages,
			// so the raw tail is not guaranteed to be the same message.
			const initiatingId = initialMessages.at(-1)?.id;
			const raw = messagesQuery.data.messages.find(
				(message) => message.id === initiatingId,
			)?.metadata;
			const direct = composerMetadataSchema.safeParse(raw);
			const nested = direct.success
				? direct
				: composerMetadataSchema.safeParse(raw?.composer);
			if (nested.success) {
				metaRef.current = { composer: nested.data };
			}
			void regenerate();
		}
	}, [
		chatId,
		initialMessages,
		messagesQuery.data,
		projectId,
		regenerate,
		setMessages,
	]);

	// A page edit landing mid-turn: invalidate as soon as a NEW applied
	// output shows up, so the preview updates before the turn finishes. Only
	// an ACTIVE turn may invalidate — historical applied parts arrive with
	// status "ready" (the persisted transcript seeding, warm or cold cache)
	// and are recorded silently: their versions are already reflected by the
	// queries' own initial fetches. A part that lands exactly on the ready
	// flip is covered by the onFinish refetch above either way.
	const handledPageEditIdsRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		let sawNew = false;
		for (const message of messages) {
			if (message.role !== "assistant") continue;
			for (const part of message.parts) {
				if (!isAppliedPageEditPart(part)) continue;
				if (handledPageEditIdsRef.current.has(part.toolCallId)) continue;
				handledPageEditIdsRef.current.add(part.toolCallId);
				sawNew = true;
			}
		}
		if (sawNew && (status === "submitted" || status === "streaming")) {
			invalidatePageData();
		}
	}, [messages, status, invalidatePageData]);

	const sendText = useCallback(
		async (text: string, options?: SendAiTextOptions) => {
			const trimmed = text.trim();
			if (!chatId || !messagesQuery.data) return false;
			// Attachments alone are a valid message; empty text with no files is not.
			if (!trimmed && !options?.files?.length) return false;
			const selectedWids = options?.selectedWids?.length
				? options.selectedWids
				: undefined;
			const selectedTargets = options?.selectedTargets?.length
				? options.selectedTargets
				: undefined;

			metaRef.current = {
				composer: options?.composer,
				selectedWids,
			};
			billingErrorInCurrentTurnRef.current = false;
			setBillingError(false);
			if (selectedTargets) setAiTargets(selectedTargets);
			lastSendSucceededRef.current = false;
			try {
				await sendMessage({
					text: trimmed,
					...(selectedTargets ? { metadata: { selectedTargets } } : {}),
					files: options?.files?.map((file) => ({
						type: "file" as const,
						mediaType: file.mediaType,
						filename: file.filename,
						url: file.url,
					})),
				});
				return lastSendSucceededRef.current;
			} catch {
				// Synchronous message construction errors can reject even though
				// transport errors normally resolve through onFinish.
				return false;
			} finally {
				// AI SDK invokes onFinish before deciding whether a completed tool step
				// should automatically continue. sendMessage resolves only after that
				// whole chain, so clear the pulse here rather than between tool steps.
				if (selectedTargets) setAiTargets([]);
			}
		},
		[chatId, messagesQuery.data, sendMessage],
	);

	const answerAskUser = useCallback(
		(toolCallId: string, output: AskUserOutput) => {
			// This completes the client-side tool call. sendAutomaticallyWhen then
			// posts the updated transcript so the agent can continue its next step.
			// Callers build the output shape (pick / selections / text / delegated /
			// dismissed — see request-tray/use-request-tray.ts) so one path covers
			// every way the tray can be answered.
			void addToolOutput({
				tool: "ask_user",
				toolCallId,
				output,
			});
		},
		[addToolOutput],
	);

	return {
		messages,
		status,
		error,
		billingError,
		aiTargets,
		sendText,
		answerAskUser,
		addToolApprovalResponse,
		isResolvingChat: chatByProjectQuery.isPending,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
	};
}

/**
 * The server sends the post-settle balance once per turn. Seed the cache
 * with it so the chip moves exactly once, then refetch the credits queries
 * (activity row, buckets) in the background.
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

/**
 * The generic stream-error copy says "try again", which is exactly wrong for
 * two server refusals: 409 AI_CHAT_OPERATION_REPLAYED means the identical
 * transcript already COMPLETED (retrying reproduces the identical idempotency
 * key — the user must send a new message), and 409 AI_CHAT_TURN_ACTIVE means
 * this turn is streaming RIGHT NOW (the user must wait, not fork the chat).
 * The pane maps each to its own copy; everything else keeps the generic text.
 */
export function chatStreamErrorKey(
	error: unknown,
):
	| "workspace.chat.errors.busy"
	| "workspace.chat.errors.replayed"
	| "workspace.chat.errors.stream" {
	if (isApiClientError(error) && error.code === "AI_CHAT_OPERATION_REPLAYED") {
		return "workspace.chat.errors.replayed";
	}

	if (isApiClientError(error) && error.code === "AI_CHAT_TURN_ACTIVE") {
		return "workspace.chat.errors.busy";
	}

	return "workspace.chat.errors.stream";
}

/**
 * Billing is a monotonic condition within one chat turn. The server can emit a
 * typed billing data part and then a generic AI SDK error chunk; that later
 * chunk must not restore the generic error UI.
 */
export function nextBillingErrorInTurn(
	current: boolean,
	intent: ReturnType<typeof dispatchBillingError>,
) {
	return current || intent !== null;
}

function buildStreamUrl(chatId: string) {
	return `${getServerUrl().replace(/\/$/, "")}${aiChatRoutes.stream(chatId)}`;
}

export function isAppliedPageEditPart(
	part: WanditUIMessage["parts"][number],
): part is Extract<
	WanditUIMessage["parts"][number],
	{
		type:
			| "tool-apply_element_ops"
			| "tool-insert_section"
			| "tool-replace_section";
	}
> & { state: "output-available" } {
	return (
		(part.type === "tool-replace_section" ||
			part.type === "tool-insert_section" ||
			part.type === "tool-apply_element_ops") &&
		part.state === "output-available" &&
		part.output.status === "applied"
	);
}
