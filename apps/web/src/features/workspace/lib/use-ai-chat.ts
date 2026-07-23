import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	type AiChatTools,
	type AskUserOutput,
	aiChatRoutes,
	type ComposerMetadata,
	composerMetadataSchema,
	type UploadAttachmentResponse,
} from "@wandit/contracts";
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,
	type UIMessage,
} from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { chatAutostart } from "@/features/projects";
import { getServerUrl } from "@/lib/server-url";
import {
	useChatByProjectQuery,
	useChatMessagesQuery,
} from "../api/chat.queries";
import { pageKeys } from "../api/pages.queries";
import { workspaceKeys } from "../api/workspace.queries";

export type WanditUIMessage = UIMessage<never, never, AiChatTools>;

export function useAiChat(projectId: string) {
	const chatByProjectQuery = useChatByProjectQuery(projectId);
	const chatId = chatByProjectQuery.data?.chatId;
	const messagesQuery = useChatMessagesQuery(chatId);

	// Per-turn request metadata (contract §10.1). A ref, not state: it must
	// survive the SAME turn's automatic resubmits (ask_user answers) unchanged,
	// and is overwritten by the next sendText. The transport reads it below in
	// prepareSendMessagesRequest — sendMessage's options.body is NOT used
	// because it would not cover those automatic resubmits.
	const metaRef = useRef<{ composer?: ComposerMetadata; selectedWid?: string }>(
		{},
	);

	// AI edits (replace_section, page generation) mint a NEW immutable version
	// server-side. Both keys must be invalidated: workspaceKeys.state refreshes
	// the versions list (VersionSwitcher), while the preview iframe only
	// remounts via pageKeys.overview (its key contains activeVersion.id).
	const queryClient = useQueryClient();
	const invalidatePageData = useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: workspaceKeys.state(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: pageKeys.overview(projectId),
		});
	}, [queryClient, projectId]);
	// Ref so the Chat instance (created once per chat id) never holds a stale
	// closure.
	const invalidatePageDataRef = useRef(invalidatePageData);
	invalidatePageDataRef.current = invalidatePageData;

	const initialMessages = useMemo(
		() =>
			(messagesQuery.data?.messages ?? []).flatMap<WanditUIMessage>(
				(message) =>
					message.role === "system" || message.parts.length === 0
						? []
						: [
								{
									id: message.id,
									role: message.role,
									parts: message.parts as WanditUIMessage["parts"],
								},
							],
			),
		[messagesQuery.data?.messages],
	);

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
						...(metaRef.current.composer || metaRef.current.selectedWid
							? {
									metadata: {
										...(metaRef.current.composer
											? { composer: metaRef.current.composer }
											: {}),
										...(metaRef.current.selectedWid
											? { selectedWid: metaRef.current.selectedWid }
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
		setMessages,
		regenerate,
	} = useChat<WanditUIMessage>({
		id: chatId ?? `project:${projectId}`,
		messages: initialMessages,
		transport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		// Unconditional turn-end refetch — harmless after aborted/failed turns
		// and covers partial turns that already applied a section.
		onFinish: () => invalidatePageDataRef.current(),
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

	// replace_section landing mid-turn: invalidate as soon as a NEW applied
	// output shows up, so the preview updates before the turn finishes. Only
	// an ACTIVE turn may invalidate — historical applied parts arrive with
	// status "ready" (the persisted transcript seeding, warm or cold cache)
	// and are recorded silently: their versions are already reflected by the
	// queries' own initial fetches. A part that lands exactly on the ready
	// flip is covered by the onFinish refetch above either way.
	const handledReplaceIdsRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		let sawNew = false;
		for (const message of messages) {
			if (message.role !== "assistant") continue;
			for (const part of message.parts) {
				if (part.type !== "tool-replace_section") continue;
				if (part.state !== "output-available") continue;
				if (part.output.status !== "applied") continue;
				if (handledReplaceIdsRef.current.has(part.toolCallId)) continue;
				handledReplaceIdsRef.current.add(part.toolCallId);
				sawNew = true;
			}
		}
		if (sawNew && (status === "submitted" || status === "streaming")) {
			invalidatePageData();
		}
	}, [messages, status, invalidatePageData]);

	const sendText = useCallback(
		(
			text: string,
			options?: {
				/** Uploaded R2 assets sent as AI SDK v7 file parts (contract §10.4). */
				files?: UploadAttachmentResponse[];
				composer?: ComposerMetadata;
				/** Click-to-target selection riding this message (contract §10.3). */
				selectedWid?: string;
			},
		) => {
			const trimmed = text.trim();
			if (!chatId || !messagesQuery.data) return false;
			// Attachments alone are a valid message; empty text with no files is not.
			if (!trimmed && !options?.files?.length) return false;

			metaRef.current = {
				composer: options?.composer,
				selectedWid: options?.selectedWid,
			};
			void sendMessage({
				text: trimmed,
				files: options?.files?.map((file) => ({
					type: "file" as const,
					mediaType: file.mediaType,
					filename: file.filename,
					url: file.url,
				})),
			});
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
		sendText,
		answerAskUser,
		isResolvingChat: chatByProjectQuery.isPending,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
	};
}

function buildStreamUrl(chatId: string) {
	return `${getServerUrl().replace(/\/$/, "")}${aiChatRoutes.stream(chatId)}`;
}
