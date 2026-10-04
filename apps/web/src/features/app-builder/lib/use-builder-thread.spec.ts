// @vitest-environment jsdom

import {
	onlineManager,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { CreateTurnResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "@/features/workspace";
import { ApiClientError } from "@/lib/api-client";
import { appBuilderKeys } from "../api/app-builder.queries";
import type { BuilderChatDeps } from "./use-builder-chat";
import { useBuilderThread } from "./use-builder-thread";

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

// Minimal fetch fake, copied small from use-builder-chat.spec.ts on purpose.
// The resume GET answers 204 (no active turn to replay). The turn POST
// answers a completed stream — or the 402 error envelope, or a failed
// stream, when the test asks.
function createDeps(
	options: { postResponds402?: boolean; postStreamsFailure?: boolean } = {},
) {
	const requests: { url: string; init: RequestInit | undefined }[] = [];
	const encoder = new TextEncoder();

	const fetchImpl = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		requests.push({ url: String(input), init });
		if (init?.method !== "POST") {
			return new Response(null, { status: 204 });
		}
		if (options.postResponds402) {
			return Response.json(
				{
					error: {
						code: "INSUFFICIENT_CREDITS",
						message: "The balance is empty.",
						path: `/api/v2/projects/${PROJECT_ID}/turns`,
						requestId: "req-1",
						statusCode: 402,
						timestamp: "2026-09-17T00:00:00.000Z",
					},
				},
				{ status: 402 },
			);
		}
		return new Response(
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(createdFrame)}\n\n`),
					);
					if (options.postStreamsFailure) {
						for (const frame of failedTurnFrames) {
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
							);
						}
					}
					controller.enqueue(encoder.encode("data: [DONE]\n\n"));
					controller.close();
				},
			}),
			{ status: 200, headers: { "content-type": "text/event-stream" } },
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

function renderThread(
	deps: BuilderChatDeps,
	options: {
		byProjectError?: ApiClientError;
		messagesError?: ApiClientError;
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
			EMPTY_HISTORY,
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

afterEach(cleanup);

describe("useBuilderThread", () => {
	it("shows the no-credits sentence when the turn POST answers 402", async () => {
		const fake = createDeps({ postResponds402: true });
		const { result } = renderThread(fake.deps);
		await waitForResume(fake, result);

		act(() => {
			result.current.send("Build the dashboard");
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
			result.current.send("Build the dashboard");
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

	it("does not count a send that the API refuses as a running turn", async () => {
		const fake = createDeps({ postResponds402: true });
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
			result.current.send("Build the dashboard");
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
			result.current.send("Build the dashboard");
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
