import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	type AiChatMessageMetadata,
	type AiChatSelectedTarget,
	type AiChatTools,
	type AskUserOutput,
	aiChatMessageMetadataSchema,
	aiChatRoutes,
	type ChatMessage,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { chatAutostart, projectKeys } from "@/features/projects";
import { getServerUrl } from "@/lib/server-url";
import {
	useChatByProjectQuery,
	useChatMessagesQuery,
} from "../api/chat.queries";
import { pageKeys } from "../api/pages.queries";

export type WanditUIMessage = UIMessage<
	AiChatMessageMetadata,
	never,
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

/** Scan only newly appended assistant parts for applied page edits. */
export function collectNewAppliedPageEditIds(
	messages: readonly WanditUIMessage[],
	handledIds: ReadonlySet<string>,
	fromMessageIndex: number,
): { ids: string[]; nextIndex: number } {
	const ids: string[] = [];
	const start = Math.max(0, Math.min(fromMessageIndex, messages.length));
	for (let index = start; index < messages.length; index += 1) {
		const message = messages[index];
		if (!message || message.role !== "assistant") continue;
		for (const part of message.parts) {
			if (!isAppliedPageEditPart(part)) continue;
			if (handledIds.has(part.toolCallId)) continue;
			ids.push(part.toolCallId);
		}
	}
	return { ids, nextIndex: messages.length };
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

	// AI edits (replace_section, page generation) mint a NEW immutable version
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
	invalidateFinishedTurnDataRef.current = invalidateFinishedTurnData;

	const initialMessages = useMemo(
		() => hydrateAiChatMessages(messagesQuery.data?.messages ?? []),
		[messagesQuery.data?.messages],
	);
	// AI SDK's sendMessage Promise resolves even when the transport fails; the
	// authoritative outcome arrives through onFinish. PromptBox uses this
	// result to clear only drafts that were actually accepted and completed.
	const lastSendSucceededRef = useRef(false);
	const sendInFlightRef = useRef(false);
	const pendingAutostartRef = useRef<{
		projectId: string;
		chatId: string;
	} | null>(null);
	const autostartStartedChatIdRef = useRef<string | null>(null);
	// Targets belong to the live AI turn, not the mutable editor selection.
	// Keeping them here lets the preview replay its pulses after iframe remounts.
	const [aiTargets, setAiTargets] = useState<AiChatSelectedTarget[]>([]);

	const transport = useMemo(
		() =>
			new DefaultChatTransport<WanditUIMessage>({
				api: chatId ? buildStreamUrl(chatId) : undefined,
				credentials: "include",
				// The returned body REPLACES the default assembly entirely
				// (http-chat-transport.ts uses it verbatim when defined), so it must
				// carry the complete default fields plus our optional metadata.
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
		error,
		sendMessage,
		addToolOutput,
		addToolApprovalResponse,
		setMessages,
		regenerate,
	} = useChat<WanditUIMessage>({
		id: chatId ?? `project:${projectId}`,
		messageMetadataSchema: aiChatMessageMetadataSchema,
		messages: initialMessages,
		transport,
		sendAutomaticallyWhen: (options) =>
			lastAssistantMessageIsCompleteWithToolCalls(options) ||
			lastAssistantMessageIsCompleteWithApprovalResponses(options),
		// Unconditional turn-end refetch — harmless after aborted/failed turns
		// and covers partial turns that already applied a section.
		onFinish: ({ isAbort, isError }) => {
			lastSendSucceededRef.current = !isAbort && !isError;
			// AI SDK transport failures resolve (they don't reject), so re-stash
			// a failed first-turn autostart here for a later reload/retry.
			const pending = pendingAutostartRef.current;
			if (pending && (isAbort || isError)) {
				chatAutostart.stash(pending);
				autostartStartedChatIdRef.current = null;
			}
			pendingAutostartRef.current = null;
			invalidateFinishedTurnDataRef.current();
		},
	});

	const seededChatId = useRef<string | null>(null);
	const autostartStartedChatIdRef = useRef<string | null>(null);
	const handledPageEditIdsRef = useRef(new Set<string>());
	const scannedMessageCountRef = useRef(0);

	useEffect(() => {
		if (!chatId || !messagesQuery.data || seededChatId.current === chatId) {
			return;
		}

		// The query resolves after useChat is created, so seed each chat once when
		// its persisted history becomes available without replacing later live turns.
		setMessages(initialMessages);
		seededChatId.current = chatId;
		handledPageEditIdsRef.current = new Set();
		scannedMessageCountRef.current = initialMessages.length;

		// A project fresh from the dashboard arrives with its prompt already
		// persisted as the last user message but no assistant reply yet. When the
		// one-shot autostart flag matches this chat, continue that existing turn.
		// regenerate() posts the transcript as-is — sendMessage() would append a
		// duplicate user message.
		if (
			initialMessages.at(-1)?.role === "user" &&
			autostartStartedChatIdRef.current !== chatId &&
			chatAutostart.matches(projectId, chatId)
		) {
			autostartStartedChatIdRef.current = chatId;
			chatAutostart.consume(projectId, chatId);
			pendingAutostartRef.current = { projectId, chatId };
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
	//
	// Streaming mutates the tail message's parts in place, so rescan from the
	// previous message index rather than only newly appended rows.
	useEffect(() => {
		const start = Math.max(0, scannedMessageCountRef.current - 1);
		const { ids, nextIndex } = collectNewAppliedPageEditIds(
			messages,
			handledPageEditIdsRef.current,
			start,
		);
		scannedMessageCountRef.current = nextIndex;
		if (ids.length === 0) return;
		for (const id of ids) {
			handledPageEditIdsRef.current.add(id);
		}
		if (status === "submitted" || status === "streaming") {
			invalidatePageData();
		}
	}, [messages, status, invalidatePageData]);

	const sendText = useCallback(
		async (text: string, options?: SendAiTextOptions) => {
			const trimmed = text.trim();
			if (!chatId || !messagesQuery.data) return false;
			// Attachments alone are a valid message; empty text with no files is not.
			if (!trimmed && !options?.files?.length) return false;
			if (sendInFlightRef.current) return false;
			sendInFlightRef.current = true;

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
				sendInFlightRef.current = false;
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
		aiTargets,
		sendText,
		answerAskUser,
		addToolApprovalResponse,
		isResolvingChat: chatByProjectQuery.isPending,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
	};
}

function buildStreamUrl(chatId: string) {
	return `${getServerUrl().replace(/\/$/, "")}${aiChatRoutes.stream(chatId)}`;
}

export function isAppliedPageEditPart(
	part: WanditUIMessage["parts"][number],
): part is Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-apply_element_ops" | "tool-replace_section" }
> & { state: "output-available" } {
	return (
		(part.type === "tool-replace_section" ||
			part.type === "tool-apply_element_ops") &&
		part.state === "output-available" &&
		part.output.status === "applied"
	);
}
