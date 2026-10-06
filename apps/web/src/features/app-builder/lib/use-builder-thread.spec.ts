// @vitest-environment jsdom

import {
	type InfiniteData,
	onlineManager,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ChatHistoryPage, CreateTurnResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "@/features/workspace";
import { ApiClientError } from "@/lib/api-client";
import { appBuilderKeys } from "../api/app-builder.queries";
import type { BuilderChatDeps } from "./use-builder-chat";
import {
	canReconnectAfter,
	turnErrorKey,
	useBuilderThread,
} from "./use-builder-thread";

const PROJECT_ID = crypto.randomUUID();
const CHAT_ID = crypto.randomUUID();
const TURN_ID = crypto.randomUUID();

// The first frame the create route sends, per turnCreatedDataPartSchema.
const createdFrame = {
	type: "data-turn-created",
	id: "turn-created",
	data: {
		turnId: TURN_ID,
		chatId: CHAT_ID,
		runId: null,
		status: "running",
		streamUrl: `/api/v2/projects/${PROJECT_ID}/turns/active/stream`,
	} satisfies CreateTurnResponse,
};

// The frames a failed turn streams after the created frame, as the API
// sends them: the card frame, then the chunk that sets the chat error.
const failedTurnFrames = [
	{
		type: "data-turn-error",
		id: "turn-error",
		data: {
			code: "internal",
			message: "Something went wrong on our side.",
			retryable: true,
		},
	},
	{ type: "error", errorText: "Something went wrong on our side." },
];

// A V1 project id gets a 400 from the chat id lookup.
const lookupError = new ApiClientError({
	code: "CHAT_LOOKUP_FAILED",
	message: "The chat lookup failed.",
	path: `/api/v1/chats/by-project/${PROJECT_ID}`,
	requestId: "req-lookup",
	statusCode: 400,
	timestamp: "2026-09-17T00:00:00.000Z",
});

const loadError = new ApiClientError({
	code: "CHAT_LOAD_FAILED",
	message: "The history load failed.",
	path: `/api/v2/projects/${PROJECT_ID}/messages`,
	requestId: "req-load",
	statusCode: 500,
	timestamp: "2026-09-17T00:00:00.000Z",
});

// The SSE answer of a turn route: these frames, then the end marker.
function turnStream(frames: readonly { type: string }[]): Response {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				for (const frame of frames) {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
					);
				}
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			},
		}),
		{ status: 200, headers: { "content-type": "text/event-stream" } },
	);
}

// Minimal fetch fake, copied small from use-builder-chat.spec.ts on purpose.
// The resume GET answers 204 (no active turn to replay). The turn POST
// answers a completed stream. When the test asks, it answers the error
// envelope of `refusePostWith` or a failed stream.
function createDeps(
	options: {
		refusePostWith?: { statusCode: number; code: string };
		postStreamsFailure?: boolean;
	} = {},
) {
	const requests: { url: string; init: RequestInit | undefined }[] = [];

	const fetchImpl = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		requests.push({ url: String(input), init });
		if (init?.method !== "POST") {
			return new Response(null, { status: 204 });
		}
		if (options.refusePostWith) {
			const { statusCode, code } = options.refusePostWith;
			return Response.json(
				{
					error: {
						code,
						message: "The API refused the turn.",
						path: `/api/v2/projects/${PROJECT_ID}/turns`,
						requestId: "req-1",
						statusCode,
						timestamp: "2026-09-17T00:00:00.000Z",
					},
				},
				{ status: statusCode },
			);
		}
		return turnStream(
			options.postStreamsFailure
				? [createdFrame, ...failedTurnFrames]
				: [createdFrame],
		);
	};

	const cancelTurn = vi.fn<BuilderChatDeps["cancelTurn"]>(
		async (_projectId, turnId) => ({ turnId, status: "canceled" }),
	);

	return { requests, deps: { fetch: fetchImpl, cancelTurn } };
}

// Starts a fetch of one query that rejects with `error`. The hook mounts
// while it runs and joins it, so the load fails on this mount, like a real
// failed load. The real queryFn never runs, so no real API call happens.
function failQueryDuringMount(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	error: ApiClientError,
) {
	void queryClient.prefetchQuery({
		queryKey,
		queryFn: () => Promise.reject(error),
	});
}

// The answer of the history route for an empty chat: one page, no older one.
const EMPTY_HISTORY = {
	pages: [{ items: [], nextCursor: null }],
	pageParams: [null],
};

// A stored turn that failed: the user row, then the reply with its error
// part. The reply shows the error card and a Retry button after a reload.
const FAILED_TURN_HISTORY: InfiniteData<ChatHistoryPage, string | null> = {
	pages: [
		{
			items: [
				{
					id: crypto.randomUUID(),
					chatId: CHAT_ID,
					role: "user",
					parts: [{ type: "text", text: "Build the dashboard" }],
					metadata: null,
					seq: 1,
					createdAt: "2026-10-06T00:00:00.000Z",
				},
				{
					id: crypto.randomUUID(),
					chatId: CHAT_ID,
					role: "assistant",
					parts: [failedTurnFrames[0]],
					metadata: null,
					seq: 2,
					createdAt: "2026-10-06T00:00:01.000Z",
				},
			],
			nextCursor: null,
		},
	],
	pageParams: [null],
};

function renderThread(
	deps: BuilderChatDeps,
	options: {
		byProjectError?: ApiClientError;
		messagesError?: ApiClientError;
		/** The stored history the history query answers. EMPTY_HISTORY when left out. */
		history?: InfiniteData<ChatHistoryPage, string | null>;
		/** True leaves the history query without an answer, so it loads. */
		historyPending?: boolean;
		/** The cache of an earlier render: the user comes back to the project. A new cache when left out. */
		queryClient?: QueryClient;
	} = {},
) {
	const queryClient =
		options.queryClient ??
		new QueryClient({
			defaultOptions: {
				queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
			},
		});
	if (options.byProjectError) {
		// A failed by-project lookup: a V1 project id gets a 400.
		failQueryDuringMount(
			queryClient,
			chatKeys.byProject(PROJECT_ID),
			options.byProjectError,
		);
	} else {
		// The seeded answer feeds the chat id query, so it never fetches.
		queryClient.setQueryData(chatKeys.byProject(PROJECT_ID), {
			chatId: CHAT_ID,
			projectId: PROJECT_ID,
		});
	}
	// The history query does not wait for the chat id, so every case seeds or
	// fails it, and the real API is never called.
	if (options.messagesError) {
		failQueryDuringMount(
			queryClient,
			appBuilderKeys.chatHistory(PROJECT_ID),
			options.messagesError,
		);
	} else if (!options.historyPending) {
		queryClient.setQueryData(
			appBuilderKeys.chatHistory(PROJECT_ID),
			options.history ?? EMPTY_HISTORY,
		);
	}
	const view = renderHook(() => useBuilderThread(PROJECT_ID, deps), {
		wrapper: ({ children }: { children: ReactNode }) =>
			createElement(
				QueryClientProvider,
				{ client: queryClient },
				createElement(I18nProvider, {
					locale: "en",
					dictionary: fallbackDictionary,
					setLocale: () => {},
					children,
				}),
			),
	});
	return { ...view, queryClient };
}

// The mount resume GET must settle first: send refuses while a request runs.
async function waitForResume(
	fake: ReturnType<typeof createDeps>,
	result: { current: { isSending: boolean } },
) {
	await waitFor(() =>
		expect(
			fake.requests.some((request) => request.init?.method === "GET"),
		).toBe(true),
	);
	await waitFor(() => expect(result.current.isSending).toBe(false));
}

// An error answer of the turn routes, as the status-preserving fetch throws it.
function turnRouteError(statusCode: number, code: string) {
	return new ApiClientError({
		code,
		message: "The turn route failed.",
		path: `/api/v2/projects/${PROJECT_ID}/turns`,
		requestId: "req-turn",
		statusCode,
		timestamp: "2026-10-06T00:00:00.000Z",
	});
}

afterEach(cleanup);

// A refused send has its draft back in the composer, so its sentence asks
// to send again. A lost stream gets Reconnect; a final 4xx gets neither.
// A null key shows the shared errors.codes sentence.
describe("turnErrorKey and canReconnectAfter", () => {
	it.each([
		{
			failure: "a rate-limited send",
			error: turnRouteError(429, "RATE_LIMITED"),
			isSendRefused: true,
			key: null,
			canReconnect: false,
		},
		{
			failure: "a send during an API deploy",
			error: turnRouteError(502, "HTTP_502"),
			isSendRefused: true,
			key: "appBuilder.chat.errors.sendFailed",
			canReconnect: false,
		},
		// The POST answer can be lost after the API created the turn.
		{
			failure: "a send that lost the network",
			error: new TypeError("Failed to fetch"),
			isSendRefused: true,
			key: "appBuilder.chat.errors.connectionLost",
			canReconnect: true,
		},
		{
			failure: "a stream reopen during an API deploy",
			error: turnRouteError(502, "HTTP_502"),
			isSendRefused: false,
			key: "appBuilder.chat.errors.connectionLost",
			canReconnect: true,
		},
		{
			failure: "a stream reopen with no free stream slot",
			error: turnRouteError(429, "HTTP_429"),
			isSendRefused: false,
			key: "appBuilder.chat.errors.connectionLost",
			canReconnect: true,
		},
		{
			failure: "a stream reopen of an unknown turn",
			error: turnRouteError(404, "HTTP_404"),
			isSendRefused: false,
			key: null,
			canReconnect: false,
		},
	])("maps $failure", ({ error, isSendRefused, key, canReconnect }) => {
		expect(turnErrorKey(error, isSendRefused)).toBe(key);
		expect(canReconnectAfter(error, isSendRefused)).toBe(canReconnect);
	});
});

describe("useBuilderThread", () => {
	it("shows the no-credits sentence when the turn POST answers 402", async () => {
		const fake = createDeps({
			refusePostWith: { statusCode: 402, code: "INSUFFICIENT_CREDITS" },
		});
		const { result } = renderThread(fake.deps);
		await waitForResume(fake, result);

		act(() => {
			result.current.send({ text: "Build the dashboard", files: [] });
		});

		await waitFor(() =>
			expect(result.current.errorText).toBe(
				"You have no credits left for this turn.",
			),
		);
	});

	it.each([
		{
			failure: "chat id lookup",
			options: { byProjectError: lookupError },
			isReady: false,
			// The history loads without the chat id, so the empty history settles.
			isFirstTurn: true,
		},
		// A failed load settles the history, so the composer and the boot screen do not hang.
		{
			failure: "history load",
			options: { messagesError: loadError },
			isReady: true,
			isFirstTurn: true,
		},
	])("shows the generic sentence when the $failure fails (ready: $isReady, first turn: $isFirstTurn)", async ({
		options,
		isReady,
		isFirstTurn,
	}) => {
		const { result } = renderThread(createDeps().deps, options);

		await waitFor(() =>
			expect(result.current.errorText).toBe(
				"Something went wrong. Please try again.",
			),
		);
		expect(result.current.isReady).toBe(isReady);
		expect(result.current.isFirstTurn).toBe(isFirstTurn);
	});

	it("keeps the row empty when the reply holds the error card", async () => {
		const fake = createDeps({ postStreamsFailure: true });
		const { result } = renderThread(fake.deps);
		await waitForResume(fake, result);

		act(() => {
			result.current.send({ text: "Build the dashboard", files: [] });
		});

		await waitFor(() =>
			expect(
				result.current.messages
					.at(-1)
					?.parts.some((part) => part.type === "data-error"),
			).toBe(true),
		);
		await waitFor(() => expect(result.current.isSending).toBe(false));
		expect(result.current.errorText).toBeNull();
		// The preview reads the same card to say that the app did not start.
		expect(result.current.lastTurnFailed).toBe(true);
	});

	// A refused send drops its bubble, so the stored failed reply is the last
	// message again. Its card does not tell why the new send failed.
	it("shows the reason of a refused send under a stored failed reply", async () => {
		const fake = createDeps({
			refusePostWith: { statusCode: 409, code: "BUILDER_TURN_ACTIVE" },
		});
		const { result } = renderThread(fake.deps, {
			history: FAILED_TURN_HISTORY,
		});
		await waitForResume(fake, result);
		expect(result.current.lastTurnFailed).toBe(true);

		await act(async () => {
			await result.current.send({ text: "Build the dashboard", files: [] });
		});

		expect(result.current.errorText).toBe(
			"Wait for the running operation to finish, then retry.",
		);
		// The API created no turn, so no Reconnect.
		expect(result.current.reconnect).toBeNull();
		// The useChat throttle can hold the bubble drop for 50 ms.
		await waitFor(() => expect(result.current.lastTurnFailed).toBe(true));
	});

	// The API can create the turn and lose the POST answer. A failed reconnect
	// GET keeps the send error in useChat, so the row keeps Reconnect. A
	// replayed turn that fails shows only its own card.
	it.each([
		{
			reconnect: "meets an API deploy",
			row: "the sentence and Reconnect",
			answerReconnect: () => new Response(null, { status: 502 }),
			errorText: "The chat lost its connection to the server.",
			canReconnect: true,
		},
		{
			reconnect: "replays a turn that fails",
			row: "nothing",
			answerReconnect: () => turnStream([createdFrame, ...failedTurnFrames]),
			errorText: null,
			canReconnect: false,
		},
	])("shows $row under a stored failed reply when the reconnect after a lost POST answer $reconnect", async ({
		answerReconnect,
		errorText,
		canReconnect,
	}) => {
		const fake = createDeps();
		let getCount = 0;
		const deps: BuilderChatDeps = {
			...fake.deps,
			fetch: async (input, init) => {
				if (init?.method === "POST") throw new TypeError("Failed to fetch");
				getCount += 1;
				// The mount resume finds no turn.
				return getCount === 1
					? fake.deps.fetch(input, init)
					: answerReconnect();
			},
		};
		const { result, queryClient, unmount } = renderThread(deps, {
			history: FAILED_TURN_HISTORY,
		});
		try {
			await waitForResume(fake, result);
			// Offline, the history refetch after the reconnect waits and never
			// calls the real API.
			onlineManager.setOnline(false);
			await act(async () => {
				await result.current.send({ text: "Build the dashboard", files: [] });
			});
			expect(result.current.reconnect).not.toBeNull();

			await act(async () => {
				await result.current.reconnect?.();
			});

			expect(getCount).toBe(2);
			await waitFor(() => expect(result.current.isSending).toBe(false));
			expect(result.current.errorText).toBe(errorText);
			expect(result.current.reconnect !== null).toBe(canReconnect);
		} finally {
			unmount();
			// The clear cancels the waiting fetch before the network comes back.
			queryClient.clear();
			onlineManager.setOnline(true);
		}
	});

	// A preview "Try to fix" sends no mode. With an open plan, a build turn
	// approves the whole plan, so the send must follow the toggle.
	it("sends a message with no mode in the mode of the Plan toggle", async () => {
		const fake = createDeps();
		const { result } = renderThread(fake.deps);
		await waitForResume(fake, result);

		act(() => result.current.setPlanMode(true));
		act(() => {
			result.current.send({ text: "Fix the error on the page", files: [] });
		});

		await waitFor(() =>
			expect(
				fake.requests.some((request) => request.init?.method === "POST"),
			).toBe(true),
		);
		const post = fake.requests.find(
			(request) => request.init?.method === "POST",
		);
		expect(JSON.parse(String(post?.init?.body))).toMatchObject({
			mode: "plan",
		});
	});

	it("does not count a send that the API refuses as a running turn", async () => {
		const fake = createDeps({
			refusePostWith: { statusCode: 402, code: "INSUFFICIENT_CREDITS" },
		});
		let answerPost = () => {};
		// The POST waits until the spec answers it, so the in-flight state holds still.
		const deps: BuilderChatDeps = {
			...fake.deps,
			fetch: (input, init) =>
				init?.method === "POST"
					? new Promise<Response>((resolve) => {
							answerPost = () => resolve(fake.deps.fetch(input, init));
						})
					: fake.deps.fetch(input, init),
		};
		const { result } = renderThread(deps);
		await waitForResume(fake, result);

		act(() => {
			result.current.send({ text: "Build the dashboard", files: [] });
		});

		await waitFor(() => expect(result.current.isSending).toBe(true));
		expect(result.current.isTurnRunning).toBe(false);

		act(() => answerPost());

		await waitFor(() => expect(result.current.errorText).not.toBeNull());
		expect(result.current.isTurnRunning).toBe(false);
	});

	it("shows the sent message once when the history refetches during the stream", async () => {
		const fake = createDeps();
		// The POST stays open, so the turn streams until the case ends.
		const deps: BuilderChatDeps = {
			...fake.deps,
			fetch: (input, init) =>
				init?.method === "POST"
					? new Promise<Response>(() => {})
					: fake.deps.fetch(input, init),
		};
		const { result, queryClient } = renderThread(deps);
		await waitForResume(fake, result);

		act(() => {
			result.current.send({ text: "Build the dashboard", files: [] });
		});
		await waitFor(() => expect(result.current.isSending).toBe(true));

		// The refetch answers the stored row of the sent message with a server
		// id, not the client id, plus one older page.
		const storedRow = (
			id: string,
			seq: number,
			role: "user" | "assistant",
		) => ({
			id,
			chatId: CHAT_ID,
			role,
			parts: [{ type: "text", text: "Build the dashboard" }],
			metadata: null,
			seq,
			createdAt: "2026-10-04T00:00:00.000Z",
		});
		const olderId = crypto.randomUUID();
		act(() => {
			queryClient.setQueryData(appBuilderKeys.chatHistory(PROJECT_ID), {
				pages: [
					{
						items: [storedRow(crypto.randomUUID(), 2, "user")],
						nextCursor: "2",
					},
					{ items: [storedRow(olderId, 1, "assistant")], nextCursor: null },
				],
				pageParams: [null, "2"],
			});
		});

		await waitFor(() =>
			expect(result.current.messages.map((message) => message.id)).toContain(
				olderId,
			),
		);
		expect(
			result.current.messages.filter((message) => message.role === "user"),
		).toHaveLength(1);
	});

	it.each([
		{ cache: "is new", seedCache: async () => undefined },
		{
			cache: "holds a failed load of an earlier mount",
			// The user comes back: the new mount refetches the failed load.
			seedCache: async () => {
				const earlierFake = createDeps();
				const earlier = renderThread(earlierFake.deps, {
					messagesError: loadError,
				});
				await waitForResume(earlierFake, earlier.result);
				earlier.unmount();
				return earlier.queryClient;
			},
		},
	])("stays unready and does not resume until the history answers, when the cache $cache", async ({
		seedCache,
	}) => {
		const earlierCache = await seedCache();
		// Offline, the history query waits and never calls the real API.
		onlineManager.setOnline(false);
		const fake = createDeps();
		const { result, queryClient, unmount } = renderThread(fake.deps, {
			historyPending: true,
			queryClient: earlierCache,
		});
		try {
			await act(async () => {});
			expect(result.current.isReady).toBe(false);
			expect(result.current.isFirstTurn).toBeNull();
			expect(fake.requests).toHaveLength(0);

			act(() => {
				queryClient.setQueryData(
					appBuilderKeys.chatHistory(PROJECT_ID),
					EMPTY_HISTORY,
				);
			});
			await waitFor(() => expect(result.current.isReady).toBe(true));
			await waitFor(() =>
				expect(
					fake.requests.some((request) => request.init?.method === "GET"),
				).toBe(true),
			);
		} finally {
			unmount();
			// The clear cancels the waiting fetch before the network comes back.
			queryClient.clear();
			onlineManager.setOnline(true);
		}
	});

	it("resumes once and stays ready while a failed history load refetches", async () => {
		const fake = createDeps();
		const { result, queryClient, unmount } = renderThread(fake.deps, {
			messagesError: loadError,
		});
		const resumeCount = () =>
			fake.requests.filter((request) => request.init?.method === "GET").length;
		try {
			await waitForResume(fake, result);
			expect(resumeCount()).toBe(1);

			// Offline, the refetch waits and never calls the real API. It sets
			// `error` to null while `data` stays undefined, like a reconnect refetch.
			onlineManager.setOnline(false);
			act(() => {
				void queryClient.refetchQueries({
					queryKey: appBuilderKeys.chatHistory(PROJECT_ID),
				});
			});
			await waitFor(() => expect(result.current.errorText).toBeNull());
			expect(result.current.isReady).toBe(true);
			expect(result.current.isFirstTurn).toBe(true);

			act(() => {
				queryClient.setQueryData(
					appBuilderKeys.chatHistory(PROJECT_ID),
					EMPTY_HISTORY,
				);
			});
			// One macrotask lets a second resume GET go out, if the gate flipped.
			await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
			expect(result.current.isReady).toBe(true);
			expect(resumeCount()).toBe(1);
		} finally {
			unmount();
			// The clear cancels the waiting fetch before the network comes back.
			queryClient.clear();
			onlineManager.setOnline(true);
		}
	});
});
