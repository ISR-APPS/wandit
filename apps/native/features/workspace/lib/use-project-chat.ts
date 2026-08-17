import { useQueryClient } from "@tanstack/react-query";
import type {
	ChatMessage,
	ChatMessagesResponse,
	ChatStreamEvent,
} from "@wandit/contracts";
import { paymentRequiredDetailsSchema } from "@wandit/contracts";
import type { Locale } from "@wandit/internationalization";
import { useTranslation } from "@wandit/internationalization/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { creditsKeys } from "@/features/credits/api/credits.keys";
import {
	formatCreditAmount,
	formatCreditBalance,
} from "@/features/credits/lib/format-credits";
import { chatKeys } from "@/features/workspace/api/chat.keys";
import { useSendChatMessage as useSendChatMessageMutation } from "@/features/workspace/api/chat.mutations";
import {
	useChatByProject,
	useChatMessages,
} from "@/features/workspace/api/chat.queries";
import { isApiClientError } from "@/shared/lib/api-client";
import { redirectToSignIn } from "@/shared/lib/auth-redirect";
import type { SseEventFrame } from "./chat-sse-parser";
import {
	type ChatStreamConnection,
	type ChatStreamEventMeta,
	isChatStreamHttpError,
	openChatStream,
} from "./chat-stream";

export type ChatGenerationState = "idle" | "started" | "thinking" | "streaming";

export type StreamingChatMessage = {
	messageId: string;
	text: string;
	createdAt: number;
};

type Translate = ReturnType<typeof useTranslation>["t"];

const lastEventIdsByChatId = new Map<string, string>();

export function useProjectChat(projectId?: string) {
	const queryClient = useQueryClient();
	const { locale, t } = useTranslation();
	const tRef = useRef(t);
	tRef.current = t;
	const localeRef = useRef(locale);
	localeRef.current = locale;

	const chatByProjectQuery = useChatByProject(projectId);
	const chatId = chatByProjectQuery.data?.chatId;
	const messagesQuery = useChatMessages(chatId);
	const { mutateAsync: sendChatMessageAsync, isPending: isSending } =
		useSendChatMessageMutation();

	const [streamingById, setStreamingById] = useState<
		Record<string, StreamingChatMessage>
	>({});
	const [generationState, setGenerationState] =
		useState<ChatGenerationState>("idle");
	const [activeOverride, setActiveOverride] = useState<boolean | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const isMountedRef = useRef(true);
	const streamRef = useRef<ChatStreamConnection | null>(null);
	const streamChatIdRef = useRef<string | null>(null);
	const sendLockedRef = useRef(false);
	const generationActiveRef = useRef(false);
	const optimisticSeqRef = useRef(0);

	const queryActive = messagesQuery.data?.generationActive ?? false;
	const generationActive = activeOverride ?? queryActive;
	generationActiveRef.current = generationActive;

	const messages = useMemo(() => {
		const list = messagesQuery.data?.messages ?? [];
		return [...list].sort((a, b) => a.seq - b.seq);
	}, [messagesQuery.data?.messages]);

	const streamingMessages = useMemo(
		() =>
			Object.values(streamingById).sort((a, b) => a.createdAt - b.createdAt),
		[streamingById],
	);

	const closeStream = useCallback(() => {
		const stream = streamRef.current;
		const id = streamChatIdRef.current;
		const lastEventId = stream?.getLastEventId();
		if (id && lastEventId) {
			lastEventIdsByChatId.set(id, lastEventId);
		}

		stream?.close();
		streamRef.current = null;
		streamChatIdRef.current = null;
	}, []);

	const patchMessages = useCallback(
		(
			id: string,
			updater: (prev: ChatMessagesResponse) => ChatMessagesResponse,
		) => {
			queryClient.setQueryData<ChatMessagesResponse>(
				chatKeys.messages(id),
				(prev) => (prev ? updater(prev) : prev),
			);
		},
		[queryClient],
	);

	const upsertMessage = useCallback(
		(id: string, message: ChatMessage) => {
			queryClient.setQueryData<ChatMessagesResponse>(
				chatKeys.messages(id),
				(prev) => {
					if (!prev) {
						return { generationActive: true, messages: [message] };
					}

					const exists = prev.messages.some((item) => item.id === message.id);
					return {
						...prev,
						messages: exists
							? prev.messages.map((item) =>
									item.id === message.id ? message : item,
								)
							: [...prev.messages, message],
					};
				},
			);
		},
		[queryClient],
	);

	const clearGeneration = useCallback(
		(id: string) => {
			generationActiveRef.current = false;
			sendLockedRef.current = false;
			setActiveOverride(false);
			setGenerationState("idle");
			setStreamingById({});
			queryClient.setQueryData<ChatMessagesResponse>(
				chatKeys.messages(id),
				(prev) => (prev ? { ...prev, generationActive: false } : prev),
			);
		},
		[queryClient],
	);

	const invalidateCreditBalance = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });
	}, [queryClient]);

	const handleStreamEvent = useCallback(
		(id: string, event: ChatStreamEvent, meta: ChatStreamEventMeta) => {
			if (!isMountedRef.current) {
				return "close";
			}

			rememberLastEventId(id, meta.lastEventId);

			if (event.type === "status") {
				generationActiveRef.current = true;
				setErrorMessage(null);
				setActiveOverride(true);
				setGenerationState((current) =>
					current === "streaming" ? current : event.status,
				);
				return undefined;
			}

			if (event.type === "delta") {
				generationActiveRef.current = true;
				setErrorMessage(null);
				setActiveOverride(true);
				setGenerationState("streaming");
				setStreamingById((current) => {
					const existing = current[event.messageId];
					return {
						...current,
						[event.messageId]: {
							messageId: event.messageId,
							text: `${existing?.text ?? ""}${event.delta}`,
							createdAt: existing?.createdAt ?? Date.now(),
						},
					};
				});
				return undefined;
			}

			if (event.type === "message-completed") {
				upsertMessage(id, event.message);
				setStreamingById((current) => {
					if (!current[event.message.id]) return current;
					const next = { ...current };
					delete next[event.message.id];
					return next;
				});
				return undefined;
			}

			if (event.type === "error") {
				setErrorMessage(
					event.message || tRef.current("native.workspace.chat.errors.stream"),
				);
				invalidateCreditBalance();
				clearGeneration(id);
				streamRef.current = null;
				streamChatIdRef.current = null;
				return "close";
			}

			invalidateCreditBalance();
			clearGeneration(id);
			void queryClient.invalidateQueries({ queryKey: chatKeys.messages(id) });
			streamRef.current = null;
			streamChatIdRef.current = null;
			return "close";
		},
		[clearGeneration, invalidateCreditBalance, queryClient, upsertMessage],
	);

	const handleMalformedStreamEvent = useCallback(
		(id: string, frame: SseEventFrame) => {
			if (!isMountedRef.current) return;

			if (frame.event === "message-completed") {
				void queryClient.invalidateQueries({ queryKey: chatKeys.messages(id) });
			}

			if (frame.event === "error") {
				setErrorMessage(tRef.current("native.workspace.chat.errors.stream"));
				invalidateCreditBalance();
				clearGeneration(id);
				closeStream();
			}
		},
		[clearGeneration, closeStream, invalidateCreditBalance, queryClient],
	);

	const handleConnectionError = useCallback(
		(id: string, error: unknown) => {
			if (!isMountedRef.current) return;
			if (isAbortErrorLike(error)) return;

			if (isChatStreamHttpError(error)) {
				if (error.status === 401) {
					clearGeneration(id);
					closeStream();
					redirectToSignIn();
					return;
				}

				if (error.status === 402) {
					setErrorMessage(tRef.current("native.workspace.chat.errors.credits"));
					invalidateCreditBalance();
					clearGeneration(id);
					closeStream();
					return;
				}

				if (error.status >= 400 && error.status < 500) {
					setErrorMessage(tRef.current("native.workspace.chat.errors.stream"));
					clearGeneration(id);
					closeStream();
				}
				return;
			}

			// Network-level stream interruptions are retried silently. Server-sent
			// "error" frames are handled above and become visible to the user.
		},
		[clearGeneration, closeStream, invalidateCreditBalance],
	);

	const handleStreamInactivity = useCallback(
		(id: string) => {
			if (!isMountedRef.current) return;

			void (async () => {
				await queryClient.invalidateQueries({
					queryKey: chatKeys.messages(id),
				});
				if (!isMountedRef.current) return;

				const latest = queryClient.getQueryData<ChatMessagesResponse>(
					chatKeys.messages(id),
				);
				if (latest?.generationActive) {
					setErrorMessage(tRef.current("native.workspace.chat.errors.stream"));
				}
				clearGeneration(id);
				closeStream();
			})();
		},
		[clearGeneration, closeStream, queryClient],
	);

	const ensureStreamReady = useCallback(
		(id: string) => {
			if (streamRef.current && streamChatIdRef.current === id) {
				return streamRef.current.ready;
			}

			closeStream();
			const stream = openChatStream({
				chatId: id,
				lastEventId: lastEventIdsByChatId.get(id),
				onEvent: (event, meta) => handleStreamEvent(id, event, meta),
				onMalformedEvent: (frame) => handleMalformedStreamEvent(id, frame),
				onConnectionError: (error) => handleConnectionError(id, error),
				onAppInactivity: () => handleStreamInactivity(id),
			});
			streamRef.current = stream;
			streamChatIdRef.current = id;
			stream.ready.catch(() => {
				if (streamRef.current === stream) {
					streamRef.current = null;
					streamChatIdRef.current = null;
				}
			});
			return stream.ready;
		},
		[
			closeStream,
			handleConnectionError,
			handleStreamInactivity,
			handleMalformedStreamEvent,
			handleStreamEvent,
		],
	);

	const sendMessage = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (
				!chatId ||
				!trimmed ||
				generationActiveRef.current ||
				sendLockedRef.current ||
				isSending
			) {
				return false;
			}

			sendLockedRef.current = true;
			generationActiveRef.current = true;
			const optimisticId = createOptimisticId();
			const cachedMessages =
				queryClient.getQueryData<ChatMessagesResponse>(
					chatKeys.messages(chatId),
				)?.messages ?? [];
			const optimisticSeq = Math.max(
				optimisticSeqRef.current + 1,
				getMaxMessageSeq(cachedMessages) + 1,
			);
			optimisticSeqRef.current = optimisticSeq;
			const optimistic: ChatMessage = {
				id: optimisticId,
				chatId,
				role: "user",
				parts: [{ type: "text", text: trimmed }],
				metadata: null,
				seq: optimisticSeq,
				createdAt: new Date().toISOString(),
			};

			setErrorMessage(null);
			setActiveOverride(true);
			setGenerationState("started");
			setStreamingById({});

			void (async () => {
				try {
					await queryClient.cancelQueries({
						queryKey: chatKeys.messages(chatId),
					});
					if (!isMountedRef.current) return;

					queryClient.setQueryData<ChatMessagesResponse>(
						chatKeys.messages(chatId),
						(prev) =>
							prev
								? {
										...prev,
										generationActive: true,
										messages: [...prev.messages, optimistic],
									}
								: { generationActive: true, messages: [optimistic] },
					);

					await ensureStreamReady(chatId);
					const response = await sendChatMessageAsync({
						chatId,
						text: trimmed,
					});

					if (!isMountedRef.current) return;
					patchMessages(chatId, (prev) => ({
						...prev,
						messages: upsertSentUserMessage(prev.messages, optimisticId, {
							...optimistic,
							id: response.messageId,
						}),
					}));
				} catch (error) {
					if (!isMountedRef.current) return;

					const generationStillActive = isGenerationActiveError(error);
					patchMessages(chatId, (prev) => ({
						...prev,
						generationActive: generationStillActive
							? prev.generationActive
							: false,
						messages: prev.messages.filter(
							(message) => message.id !== optimisticId,
						),
					}));
					if (isPaymentRequiredError(error)) {
						invalidateCreditBalance();
					}
					setErrorMessage(
						sendErrorMessage(error, tRef.current, localeRef.current),
					);
					if (generationStillActive) {
						generationActiveRef.current = true;
						setActiveOverride(true);
						setGenerationState((current) =>
							current === "idle" ? "thinking" : current,
						);
						void queryClient.invalidateQueries({
							queryKey: chatKeys.messages(chatId),
						});
						return;
					}

					generationActiveRef.current = false;
					setActiveOverride(false);
					setGenerationState("idle");
					setStreamingById({});
					closeStream();
				} finally {
					sendLockedRef.current = false;
				}
			})();

			return true;
		},
		[
			chatId,
			closeStream,
			ensureStreamReady,
			isSending,
			invalidateCreditBalance,
			patchMessages,
			queryClient,
			sendChatMessageAsync,
		],
	);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			closeStream();
		};
	}, [closeStream]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: chatId intentionally resets transient state when switching chats
	useEffect(() => {
		setActiveOverride(null);
		generationActiveRef.current = false;
		sendLockedRef.current = false;
		setGenerationState("idle");
		setStreamingById({});
		setErrorMessage(null);
		closeStream();
	}, [chatId, closeStream]);

	useEffect(() => {
		if (!chatId || !queryActive || activeOverride !== null) {
			return;
		}

		void queryClient.invalidateQueries({
			queryKey: chatKeys.messages(chatId),
		});
	}, [activeOverride, chatId, queryActive, queryClient]);

	useEffect(() => {
		if (!chatId || !generationActive) {
			generationActiveRef.current = false;
			return;
		}

		generationActiveRef.current = true;
		setGenerationState((current) =>
			current === "idle" ? "thinking" : current,
		);
		void ensureStreamReady(chatId);
	}, [chatId, ensureStreamReady, generationActive]);

	return {
		chatId,
		messages,
		streamingMessages,
		generationState,
		generationActive,
		errorMessage,
		isResolvingChat: Boolean(projectId) && chatByProjectQuery.isPending,
		chatUnavailable: chatByProjectQuery.isError || messagesQuery.isError,
		isLoadingMessages: Boolean(chatId) && messagesQuery.isPending,
		isSending,
		isGenerating: generationActive || isSending || generationState !== "idle",
		sendMessage,
	};
}

function sendErrorMessage(error: unknown, t: Translate, locale: Locale) {
	if (isChatStreamHttpError(error) && error.status === 402) {
		return t("native.workspace.chat.errors.credits");
	}

	if (isApiClientError(error)) {
		if (error.statusCode === 409) {
			return t("native.workspace.chat.errors.busy");
		}
		if (error.statusCode === 402) {
			const details = paymentRequiredDetailsSchema.safeParse(error.details);
			if (details.success) {
				// Decimal credits: exact charge, floored balance (pricing v4).
				return t("native.workspace.chat.errors.creditsDetails", {
					requiredCredits: formatCreditAmount(
						details.data.requiredCredits,
						locale,
					),
					availableCredits: formatCreditBalance(
						details.data.availableCredits,
						locale,
					),
				});
			}
			return t("native.workspace.chat.errors.credits");
		}
	}

	return t("native.workspace.chat.errors.send");
}

function isPaymentRequiredError(error: unknown) {
	return (
		(isApiClientError(error) && error.statusCode === 402) ||
		(isChatStreamHttpError(error) && error.status === 402)
	);
}

function isGenerationActiveError(error: unknown) {
	return (
		isApiClientError(error) &&
		error.statusCode === 409 &&
		(error.code === "GENERATION_ACTIVE" || error.code === "HTTP_409")
	);
}

function rememberLastEventId(chatId: string, lastEventId: string | undefined) {
	if (lastEventId) {
		lastEventIdsByChatId.set(chatId, lastEventId);
	}
}

function getMaxMessageSeq(messages: ChatMessage[]) {
	return messages.reduce(
		(max, message) =>
			Number.isFinite(message.seq) ? Math.max(max, message.seq) : max,
		0,
	);
}

function upsertSentUserMessage(
	messages: ChatMessage[],
	optimisticId: string,
	message: ChatMessage,
) {
	const withoutOptimistic = messages.filter((item) => item.id !== optimisticId);
	if (withoutOptimistic.some((item) => item.id === message.id)) {
		return withoutOptimistic;
	}

	return [...withoutOptimistic, message];
}

function createOptimisticId() {
	return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isAbortErrorLike(error: unknown) {
	return error instanceof Error && error.name === "AbortError";
}
