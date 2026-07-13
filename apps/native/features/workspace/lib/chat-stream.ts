import { type ChatStreamEvent, chatsRoutes } from "@wandit/contracts";
import { fetch as expoFetch } from "expo/fetch";

import { authClient } from "@/lib/auth-client";
import { getServerUrl } from "@/shared/lib/server-url";

import {
	createSseParser,
	isValidLastEventId,
	parseChatStreamEventFrame,
	type SseEventFrame,
} from "./chat-sse-parser";

export { parseChatStreamEventFrame } from "./chat-sse-parser";

export type ChatStreamEventMeta = {
	id?: string;
	lastEventId?: string;
};

export type ChatStreamEventResult = "close" | void;

export type ChatStreamConnection = {
	ready: Promise<void>;
	close: () => void;
	getLastEventId: () => string | undefined;
};

export type OpenChatStreamOptions = {
	chatId: string;
	lastEventId?: string;
	onEvent: (
		event: ChatStreamEvent,
		meta: ChatStreamEventMeta,
	) => ChatStreamEventResult;
	onMalformedEvent?: (frame: SseEventFrame) => void;
	onConnectionError?: (error: unknown) => void;
	onAppInactivity?: () => void;
	onOpen?: () => void;
	appInactivityTimeoutMs?: number;
};

const BASE_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;
const INITIAL_CONNECT_MAX_ATTEMPTS = 3;
const RECONNECT_RESET_AFTER_MS = 5_000;
const APP_EVENT_INACTIVITY_TIMEOUT_MS = 105_000;

export class ChatStreamHttpError extends Error {
	constructor(readonly status: number) {
		super(`Chat stream failed with HTTP ${status}.`);
		this.name = "ChatStreamHttpError";
	}
}

export function openChatStream(
	options: OpenChatStreamOptions,
): ChatStreamConnection {
	let activeController: AbortController | null = null;
	let closed = false;
	let terminal = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let lastEventId = options.lastEventId;
	let readySettled = false;
	let reconnectAttempt = 0;
	let resolveReady!: () => void;
	let rejectReady!: (error: unknown) => void;
	let appInactivityTimer: ReturnType<typeof setTimeout> | null = null;

	const ready = new Promise<void>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});

	const settleReady = () => {
		if (!readySettled) {
			readySettled = true;
			resolveReady();
		}
	};

	const failReady = (error: unknown) => {
		if (!readySettled) {
			readySettled = true;
			rejectReady(error);
		}
	};

	const clearAppInactivityTimer = () => {
		if (appInactivityTimer) {
			clearTimeout(appInactivityTimer);
			appInactivityTimer = null;
		}
	};

	const close = () => {
		closed = true;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		clearAppInactivityTimer();
		activeController?.abort();
		failReady(new Error("Chat stream closed before connecting."));
	};

	const scheduleAppInactivityTimer = () => {
		if (!options.onAppInactivity) {
			return;
		}

		clearAppInactivityTimer();
		appInactivityTimer = setTimeout(() => {
			appInactivityTimer = null;
			options.onAppInactivity?.();
		}, options.appInactivityTimeoutMs ?? APP_EVENT_INACTIVITY_TIMEOUT_MS);
	};

	const resetReconnectAttempt = () => {
		reconnectAttempt = 0;
	};

	const dispatchFrames = (frames: SseEventFrame[]) => {
		for (const frame of frames) {
			const event = parseChatStreamEventFrame(frame);
			if (!event) {
				options.onMalformedEvent?.(frame);
				continue;
			}

			if (isValidLastEventId(frame.id)) {
				lastEventId = frame.id;
			}
			resetReconnectAttempt();

			const result = options.onEvent(event, {
				id: frame.id,
				lastEventId,
			});
			if (result === "close") {
				terminal = true;
				clearAppInactivityTimer();
				activeController?.abort();
				return;
			}

			scheduleAppInactivityTimer();
		}
	};

	const readOnce = async (signal: AbortSignal) => {
		const parser = createSseParser();
		const response = await expoFetch(
			buildChatStreamUrl(options.chatId, lastEventId),
			{
				headers: createStreamHeaders(),
				signal,
			},
		);

		if (!response.ok) {
			throw new ChatStreamHttpError(response.status);
		}

		if (!response.body) {
			throw new Error("Chat stream response did not include a readable body.");
		}

		settleReady();
		options.onOpen?.();
		scheduleAppInactivityTimer();

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		const stableTimer = setTimeout(
			resetReconnectAttempt,
			RECONNECT_RESET_AFTER_MS,
		);

		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				dispatchFrames(parser.push(decoder.decode(value, { stream: true })));
				if (terminal || closed) break;
			}

			if (!terminal && !closed) {
				const tail = decoder.decode();
				if (tail) {
					dispatchFrames(parser.push(tail));
				}
			}
		} finally {
			clearTimeout(stableTimer);
			clearAppInactivityTimer();
			reader.releaseLock();
		}
	};

	const waitForReconnect = (delayMs: number) =>
		new Promise<void>((resolve) => {
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				resolve();
			}, delayMs);
		});

	const run = async () => {
		let initialFailureCount = 0;

		while (!closed && !terminal) {
			const controller = new AbortController();
			activeController = controller;

			try {
				await readOnce(controller.signal);
				initialFailureCount = 0;
				if (!closed && !terminal) {
					options.onConnectionError?.(
						new Error("Chat stream disconnected before completion."),
					);
				}
			} catch (error) {
				if (isTerminalHttpError(error)) {
					terminal = true;
					failReady(error);
					if (!closed) {
						options.onConnectionError?.(error);
					}
					continue;
				}

				if (!closed && !terminal && !isAbortError(error)) {
					options.onConnectionError?.(error);
					if (!readySettled) {
						initialFailureCount += 1;
						if (initialFailureCount >= INITIAL_CONNECT_MAX_ATTEMPTS) {
							terminal = true;
							failReady(error);
							continue;
						}
					}
				}
			} finally {
				if (activeController === controller) {
					activeController = null;
				}
			}

			if (!closed && !terminal) {
				await waitForReconnect(getReconnectDelay(reconnectAttempt));
				reconnectAttempt += 1;
			}
		}

		if (!readySettled) {
			failReady(new Error("Chat stream stopped before connecting."));
		}
	};

	void run();

	return {
		ready,
		close,
		getLastEventId: () => lastEventId,
	};
}

export function buildChatStreamUrl(chatId: string, lastEventId?: string) {
	const url = new URL(chatsRoutes.stream(chatId), getServerUrl());
	if (isValidLastEventId(lastEventId)) {
		url.searchParams.set("lastEventId", lastEventId);
	}
	return url.toString();
}

function createStreamHeaders() {
	const headers: Record<string, string> = {
		accept: "text/event-stream",
	};
	const cookie = authClient.getCookie();
	if (cookie) {
		headers.cookie = cookie;
	}
	return headers;
}

function getReconnectDelay(attempt: number) {
	return Math.min(
		BASE_RECONNECT_DELAY_MS * 2 ** attempt,
		MAX_RECONNECT_DELAY_MS,
	);
}

function isAbortError(error: unknown) {
	return error instanceof Error && error.name === "AbortError";
}

export function isChatStreamHttpError(
	error: unknown,
): error is ChatStreamHttpError {
	return error instanceof ChatStreamHttpError;
}

function isTerminalHttpError(error: unknown) {
	return (
		error instanceof ChatStreamHttpError &&
		error.status >= 400 &&
		error.status < 500
	);
}
