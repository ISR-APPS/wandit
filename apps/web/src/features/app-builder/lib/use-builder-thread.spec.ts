// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ChatMessage, CreateTurnResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chatKeys } from "@/features/workspace";
import { ApiClientError } from "@/lib/api-client";
import type { BuilderChatDeps } from "./use-builder-chat";
import { turnErrorKey, useBuilderThread } from "./use-builder-thread";

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

// Seeds one query as a finished error state, so the hook sees `error`
// with no network call (`retryOnMount: false` keeps the state on mount).
function seedQueryError(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	error: ApiClientError,
) {
	queryClient.getQueryCache().build(
		queryClient,
		{ queryKey },
		{
			data: undefined,
			dataUpdateCount: 0,
			dataUpdatedAt: 0,
			error,
			errorUpdateCount: 1,
			errorUpdatedAt: 1,
			fetchFailureCount: 1,
			fetchFailureReason: error,
			fetchMeta: null,
			isInvalidated: false,
			status: "error",
			fetchStatus: "idle",
		},
	);
}

function renderThread(
	deps: BuilderChatDeps,
	options: {
		byProjectError?: ApiClientError;
		messagesError?: ApiClientError;
		/** Stored rows of the chat history; empty when left out. */
		history?: ChatMessage[];
	} = {},
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: Number.POSITIVE_INFINITY,
				retry: false,
				// A seeded error state must survive the hook mount; without this
				// the query would run its real queryFn.
				retryOnMount: false,
			},
		},
	});
	if (options.byProjectError) {
		// A failed by-project lookup: a V1 project id gets a 400.
		seedQueryError(
			queryClient,
			chatKeys.byProject(PROJECT_ID),
			options.byProjectError,
		);
	} else {
		// The seeded answers feed both history queries, so they never fetch.
		queryClient.setQueryData(chatKeys.byProject(PROJECT_ID), {
			chatId: CHAT_ID,
			projectId: PROJECT_ID,
		});
		if (options.messagesError) {
			seedQueryError(
				queryClient,
				chatKeys.messages(CHAT_ID),
				options.messagesError,
			);
		} else {
			queryClient.setQueryData(chatKeys.messages(CHAT_ID), {
				generationActive: false,
				messages: options.history ?? [],
			});
		}
	}
	return renderHook(() => useBuilderThread(PROJECT_ID, deps), {
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
	it("posts an approval decision as a turn with an empty message", async () => {
		const fake = createDeps();
		const { result } = renderThread(fake.deps);
		await waitForResume(fake, result);

		act(() => {
			result.current.decideApproval("ap-1", true);
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
			message: "",
			approval: { approvalId: "ap-1", approved: true },
		});
	});

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

	it("shows the lookup error and stays unready when the chat id lookup fails", async () => {
		const lookupError = new ApiClientError({
			code: "CHAT_LOOKUP_FAILED",
			message: "The chat lookup failed.",
			path: `/api/v1/chats/by-project/${PROJECT_ID}`,
			requestId: "req-4",
			statusCode: 400,
			timestamp: "2026-09-17T00:00:00.000Z",
		});
		const fake = createDeps();
		const { result } = renderThread(fake.deps, { byProjectError: lookupError });

		await waitFor(() =>
			expect(result.current.errorText).toBe(
				"Something went wrong. Please try again.",
			),
		);
		expect(result.current.isReady).toBe(false);
		// The turn routes never open: no turn POST, no resume GET.
		expect(fake.requests).toHaveLength(0);
	});

	it("shows the load error when the history load fails", async () => {
		const loadError = new ApiClientError({
			code: "CHAT_LOAD_FAILED",
			message: "The history load failed.",
			path: `/api/v1/chats/${CHAT_ID}/messages`,
			requestId: "req-5",
			statusCode: 500,
			timestamp: "2026-09-17T00:00:00.000Z",
		});
		const fake = createDeps();
		const { result } = renderThread(fake.deps, { messagesError: loadError });

		await waitFor(() =>
			expect(result.current.errorText).toBe(
				"Something went wrong. Please try again.",
			),
		);
		expect(result.current.messages).toEqual([]);
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

	it("reports the phase of the running turn and the first turn", async () => {
		const fake = createDeps();
		const encoder = new TextEncoder();
		const statusFrame = {
			type: "data-turn-status",
			id: "turn-status",
			data: { phase: "sandbox_waking" },
		};
		let endStream = () => {};
		// The turn stream stays open after the status frame, like a sandbox that boots.
		const deps: BuilderChatDeps = {
			...fake.deps,
			fetch: async (input, init) => {
				if (init?.method !== "POST") return fake.deps.fetch(input, init);
				return new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							for (const frame of [createdFrame, statusFrame]) {
								controller.enqueue(
									encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
								);
							}
							endStream = () => {
								controller.enqueue(encoder.encode("data: [DONE]\n\n"));
								controller.close();
							};
						},
					}),
					{ status: 200, headers: { "content-type": "text/event-stream" } },
				);
			},
		};
		const { result } = renderThread(deps);
		await waitForResume(fake, result);
		expect(result.current.phase).toBeNull();

		act(() => {
			result.current.send("Build the dashboard");
		});

		await waitFor(() => expect(result.current.phase).toBe("sandbox_waking"));
		expect(result.current.isTurnRunning).toBe(true);
		// The chat holds one user message, so this turn creates the sandbox.
		expect(result.current.isFirstTurn).toBe(true);

		act(() => endStream());

		await waitFor(() => expect(result.current.isSending).toBe(false));
		expect(result.current.phase).toBeNull();
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

	it("knows the first turn only from a loaded or failed history", async () => {
		const userRow = (id: string, seq: number): ChatMessage => ({
			id,
			chatId: CHAT_ID,
			role: "user",
			parts: [{ type: "text", text: `prompt ${seq}` }],
			metadata: null,
			seq,
			createdAt: "2026-09-24T10:00:00.000Z",
		});
		const lookupFailed = new ApiClientError({
			code: "BAD_REQUEST",
			message: "Not a V2 project.",
			path: "/api/v1/chats/by-project",
			requestId: "req-1",
			statusCode: 400,
			timestamp: "2026-09-24T00:00:00.000Z",
		});

		// No chat id means no history yet: the value is unknown.
		const unknown = renderThread(createDeps().deps, {
			byProjectError: lookupFailed,
		});
		expect(unknown.result.current.isFirstTurn).toBeNull();
		unknown.unmount();

		// A failed history load must not hold the boot screen on its mark.
		const failed = renderThread(createDeps().deps, {
			messagesError: lookupFailed,
		});
		expect(failed.result.current.isFirstTurn).toBe(true);
		failed.unmount();

		const later = renderThread(createDeps().deps, {
			history: [userRow("u1", 0), userRow("u2", 1)],
		});
		expect(later.result.current.isFirstTurn).toBe(false);
	});
});

describe("turnErrorKey", () => {
	it("maps the project cap code and returns null for an unknown code", () => {
		const capError = new ApiClientError({
			code: "PROJECT_CREDIT_CAP_REACHED",
			message: "The cap is reached.",
			path: `/api/v2/projects/${PROJECT_ID}/turns`,
			requestId: "req-2",
			statusCode: 403,
			timestamp: "2026-09-17T00:00:00.000Z",
		});
		expect(turnErrorKey(capError)).toBe("appBuilder.chat.errors.projectCap");

		const other = new ApiClientError({
			code: "SOME_OTHER_CODE",
			message: "Unknown failure.",
			path: `/api/v2/projects/${PROJECT_ID}/turns`,
			requestId: "req-3",
			statusCode: 500,
			timestamp: "2026-09-17T00:00:00.000Z",
		});
		expect(turnErrorKey(other)).toBeNull();
		expect(turnErrorKey(new Error("offline"))).toBeNull();
	});
});
