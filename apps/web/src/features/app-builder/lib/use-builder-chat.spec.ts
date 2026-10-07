// @vitest-environment jsdom

import {
	QueryClient,
	QueryClientProvider,
	type QueryKey,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { CreateTurnResponse } from "@wandit/contracts";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appBuilderKeys } from "../api/app-builder.queries";
import { cloudKeys } from "../api/cloud.queries";
import type { TurnMessage } from "../api/dto";
import { type BuilderChatDeps, useBuilderChat } from "./use-builder-chat";

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
		estimate: {
			credits: 3,
			basis: "fixed",
			modelId: "model-1",
			multiplier: 1,
		},
	} satisfies CreateTurnResponse,
};

// The last frame the relay sends for a turn that succeeded.
const doneFrame = {
	type: "data-turn-done",
	id: "turn-done",
	data: { status: "succeeded" },
};

// `resumeReply` makes the reconnect GET answer an open stream with one
// assistant reply, like the API does during a turn after a reload.
function createDeps(options: { resumeReply?: boolean } = {}) {
	const requests: { url: string; init: RequestInit | undefined }[] = [];
	const encoder = new TextEncoder();
	let postAbortSignal: AbortSignal | null = null;
	// Kept so a test can finish the turn stream on purpose.
	let postController: ReadableStreamDefaultController<Uint8Array> | null = null;
	// Set inside the fake cancelTurn, so the spec proves the POST abort
	// landed before the cancel call ran.
	let cancelSawAbort = false;

	const fetchImpl = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		// The SDK calls fetch(api, init) with a string url.
		requests.push({ url: String(input), init });
		if (init?.method !== "POST") {
			if (options.resumeReply) {
				const frames = [
					{ type: "start", messageId: "a-resumed" },
					{ type: "text-start", id: "t1" },
					{ type: "text-delta", id: "t1", delta: "resumed reply" },
				];
				return new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							for (const frame of frames) {
								controller.enqueue(
									encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
								);
							}
							// The stream stays open like a running turn.
						},
					}),
					{ status: 200, headers: { "content-type": "text/event-stream" } },
				);
			}
			// The reconnect GET answers 204: no active turn to resume.
			return new Response(null, { status: 204 });
		}
		postAbortSignal = init.signal ?? null;
		return new Response(
			new ReadableStream<Uint8Array>({
				start(controller) {
					postController = controller;
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(createdFrame)}\n\n`),
					);
					// The stream stays open; the test ends it through endPostStream.
				},
			}),
			{ status: 200, headers: { "content-type": "text/event-stream" } },
		);
	};

	const cancelTurn = vi.fn<BuilderChatDeps["cancelTurn"]>(
		async (_projectId, turnId) => {
			cancelSawAbort = postAbortSignal?.aborted ?? false;
			return { turnId, status: "canceled" };
		},
	);

	return {
		requests,
		deps: { fetch: fetchImpl, cancelTurn },
		postAbortSignal: () => postAbortSignal,
		cancelSawAbort: () => cancelSawAbort,
		// Writes the done frame and the [DONE] terminator like the relay, then
		// closes. A close with no done frame makes the transport reopen the turn.
		endPostStream: () => {
			postController?.enqueue(
				encoder.encode(
					`data: ${JSON.stringify(doneFrame)}\n\ndata: [DONE]\n\n`,
				),
			);
			postController?.close();
		},
	};
}

function renderBuilderChat(
	input: Parameters<typeof useBuilderChat>[0],
	deps: BuilderChatDeps,
	queryClient: QueryClient = new QueryClient(),
) {
	return renderHook(
		(props: { currentInput: Parameters<typeof useBuilderChat>[0] }) =>
			useBuilderChat(props.currentInput, deps),
		{
			initialProps: { currentInput: input },
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(QueryClientProvider, { client: queryClient }, children),
		},
	);
}

function messageTexts(messages: TurnMessage[]): string[] {
	return messages.flatMap((message) =>
		message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
	);
}

function postCount(fake: ReturnType<typeof createDeps>): number {
	return fake.requests.filter((request) => request.init?.method === "POST")
		.length;
}

afterEach(cleanup);

describe("useBuilderChat", () => {
	it("refuses a second send while a turn runs", async () => {
		const fake = createDeps();
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			fake.deps,
		);
		// The mount resume GET replays the active turn; 204 means none runs.
		await waitFor(() =>
			expect(
				fake.requests.some((request) => request.init?.method === "GET"),
			).toBe(true),
		);

		act(() => {
			result.current.send({ text: "hello" });
		});

		await waitFor(() => {
			expect(result.current.turnId).toBe(TURN_ID);
			expect(result.current.isSending).toBe(true);
		});

		// One turn runs at a time: a second send while streaming is refused.
		act(() => {
			result.current.send({ text: "again" });
		});
		await act(async () => {});
		expect(postCount(fake)).toBe(1);
	});

	it("waits for data-turn-created after a local send, and never after a resume", async () => {
		const fake = createDeps();
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
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			deps,
		);
		await waitFor(() =>
			expect(
				fake.requests.some((request) => request.init?.method === "GET"),
			).toBe(true),
		);

		act(() => {
			result.current.send({ text: "hello" });
		});
		await waitFor(() => expect(result.current.isSending).toBe(true));
		expect(result.current.isAwaitingTurn).toBe(true);

		act(() => answerPost());
		await waitFor(() => expect(result.current.turnId).toBe(TURN_ID));
		expect(result.current.isAwaitingTurn).toBe(false);

		// A resumed turn sends no data-turn-created, so it must not wait for one.
		const resumed = createDeps({ resumeReply: true });
		const { result: resumedResult } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			resumed.deps,
		);
		await waitFor(() => expect(resumedResult.current.isSending).toBe(true));
		expect(resumedResult.current.isAwaitingTurn).toBe(false);
	});

	it("aborts the stream and then posts the turn cancel", async () => {
		const fake = createDeps();
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			fake.deps,
		);
		act(() => {
			result.current.send({ text: "hello" });
		});
		await waitFor(() => expect(result.current.turnId).toBe(TURN_ID));

		await act(async () => {
			await result.current.cancel();
		});

		expect(fake.postAbortSignal()?.aborted).toBe(true);
		expect(fake.cancelSawAbort()).toBe(true);
		expect(fake.deps.cancelTurn).toHaveBeenCalledWith(PROJECT_ID, TURN_ID);
		expect(result.current.turnId).toBeNull();
	});

	// A Stop during the admission of the POST has no turn id yet. Without the
	// wait, no cancel goes out and the turn keeps running and spending.
	it("waits for the turn id when Stop comes before the first frame, then cancels", async () => {
		const fake = createDeps();
		let answerPost = () => {};
		const deps: BuilderChatDeps = {
			...fake.deps,
			fetch: (input, init) =>
				init?.method === "POST"
					? new Promise<Response>((resolve) => {
							answerPost = () => resolve(fake.deps.fetch(input, init));
						})
					: fake.deps.fetch(input, init),
		};
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			deps,
		);
		// The mount resume GET answers 204 first, so it cannot reset the status.
		await waitFor(() =>
			expect(
				fake.requests.some((request) => request.init?.method === "GET"),
			).toBe(true),
		);
		act(() => {
			result.current.send({ text: "hello" });
		});
		await waitFor(() => expect(result.current.isSending).toBe(true));

		let canceling: Promise<void> = Promise.resolve();
		act(() => {
			canceling = result.current.cancel();
		});
		await act(async () => {});
		expect(fake.deps.cancelTurn).not.toHaveBeenCalled();

		act(() => answerPost());
		await act(async () => {
			await canceling;
		});

		expect(fake.deps.cancelTurn).toHaveBeenCalledWith(PROJECT_ID, TURN_ID);
		expect(fake.postAbortSignal()?.aborted).toBe(true);
		// The reply gets the canceled status, so the chat shows "Stopped".
		expect(result.current.messages.at(-1)?.parts).toContainEqual({
			type: "data-turn-done",
			id: "turn-done",
			data: { status: "canceled" },
		});
	});

	it("marks the project stale again after the cancel POST answers", async () => {
		const fake = createDeps();
		const queryClient = new QueryClient();
		const projectKey = appBuilderKeys.project(PROJECT_ID);
		queryClient.setQueryData(projectKey, null);
		// The refresh at the abort lands before the settle. The fake cancel
		// waits for it and stores its answer, so the project is fresh again.
		fake.deps.cancelTurn.mockImplementation(async (_projectId, turnId) => {
			await vi.waitFor(() =>
				expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true),
			);
			queryClient.setQueryData(projectKey, null);
			return { turnId, status: "canceled" };
		});
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			fake.deps,
			queryClient,
		);
		act(() => {
			result.current.send({ text: "hello" });
		});
		await waitFor(() => expect(result.current.turnId).toBe(TURN_ID));

		await act(async () => {
			await result.current.cancel();
		});

		// The settle wrote the wip commit, so hasCodeChanges can be true now.
		expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true);
	});

	it("marks the Code view and every Cloud panel stale when a turn ends, not the backend state", async () => {
		const fake = createDeps();
		const queryClient = new QueryClient();
		const isStale = (key: QueryKey) =>
			queryClient.getQueryState(key)?.isInvalidated;
		const turnKeys = [
			// The turn woke the sandbox, so an asleep Code view loads again.
			appBuilderKeys.code(PROJECT_ID),
			// The agent can run a migration, deploy a function, or set a secret in any turn.
			cloudKeys.tables(PROJECT_ID),
			cloudKeys.rows(PROJECT_ID, "orders", {
				page: 1,
				pageSize: 50,
				dir: "asc",
			}),
			cloudKeys.functions(PROJECT_ID),
			cloudKeys.secrets(PROJECT_ID),
		];
		// The backend state polls on its own while it changes.
		const backendKey = cloudKeys.backend(PROJECT_ID);
		for (const key of [...turnKeys, backendKey]) {
			queryClient.setQueryData(key, null);
		}
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			fake.deps,
			queryClient,
		);
		await waitFor(() => expect(result.current.status).toBe("ready"));

		act(() => {
			result.current.send({ text: "add an orders table" });
		});
		await waitFor(() => expect(result.current.isSending).toBe(true));
		expect(turnKeys.map(isStale)).toEqual([false, false, false, false, false]);

		fake.endPostStream();
		await waitFor(() => expect(result.current.status).toBe("ready"));

		await waitFor(() =>
			expect(turnKeys.map(isStale)).toEqual([true, true, true, true, true]),
		);
		expect(isStale(backendKey)).toBe(false);
	});

	it("ignores a history change while streaming and reseeds when ready", async () => {
		const fake = createDeps();
		const historyMessage = (id: string, text: string): TurnMessage => ({
			id,
			role: "user",
			parts: [{ type: "text", text }],
		});
		const baseInput = {
			projectId: PROJECT_ID,
			chatId: CHAT_ID,
			isHistorySettled: true,
		};
		const { result, rerender } = renderBuilderChat(
			{ ...baseInput, initialMessages: [historyMessage("h1", "old history")] },
			fake.deps,
		);
		await waitFor(() => expect(result.current.status).toBe("ready"));

		act(() => {
			result.current.send({ text: "hello" });
		});
		await waitFor(() => expect(result.current.isSending).toBe(true));

		// A history refetch mid-stream must not drop the live message.
		rerender({
			currentInput: {
				...baseInput,
				initialMessages: [historyMessage("h2", "newer history")],
			},
		});
		// The useChat throttle can hold the last update for 50 ms.
		await waitFor(() =>
			expect(messageTexts(result.current.messages)).toEqual([
				"old history",
				"hello",
			]),
		);

		fake.endPostStream();
		await waitFor(() => expect(result.current.status).toBe("ready"));
		// The settled turn clears its id and estimate.
		expect(result.current.turnId).toBeNull();
		expect(result.current.estimate).toBeNull();

		// On ready the next history change replaces the messages again.
		rerender({
			currentInput: {
				...baseInput,
				initialMessages: [historyMessage("h3", "settled history")],
			},
		});
		await waitFor(() =>
			expect(messageTexts(result.current.messages)).toEqual([
				"settled history",
			]),
		);
	});

	it("puts a history refetch in front of a resumed reply", async () => {
		const fake = createDeps({ resumeReply: true });
		const baseInput = {
			projectId: PROJECT_ID,
			chatId: CHAT_ID,
			isHistorySettled: true,
		};
		const { result, rerender } = renderBuilderChat(
			{ ...baseInput, initialMessages: [] },
			fake.deps,
		);
		// The history load failed, so the resume ran with no history.
		await waitFor(() =>
			expect(messageTexts(result.current.messages)).toEqual(["resumed reply"]),
		);
		expect(result.current.isSending).toBe(true);

		rerender({
			currentInput: {
				...baseInput,
				initialMessages: [
					{
						id: "h1",
						role: "user",
						parts: [{ type: "text", text: "build it" }],
					},
				],
			},
		});
		await waitFor(() =>
			expect(messageTexts(result.current.messages)).toEqual([
				"build it",
				"resumed reply",
			]),
		);
	});

	// The composer puts a refused message back, so a bubble would show it twice.
	it("resolves false for a send that the API refuses, and drops its bubble", async () => {
		const fake = createDeps();
		const deps: BuilderChatDeps = {
			...fake.deps,
			fetch: (input, init) =>
				init?.method === "POST"
					? Promise.resolve(
							Response.json(
								{
									error: {
										code: "BUILDER_TURN_ACTIVE",
										message: "A restore or a sandbox wake is running.",
										path: `/api/v2/projects/${PROJECT_ID}/turns`,
										requestId: "req-1",
										statusCode: 409,
										timestamp: "2026-10-06T00:00:00.000Z",
									},
								},
								{ status: 409 },
							),
						)
					: fake.deps.fetch(input, init),
		};
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			deps,
		);
		await waitFor(() =>
			expect(
				fake.requests.some((request) => request.init?.method === "GET"),
			).toBe(true),
		);
		// The 204 of the mount resume settles first, so it cannot clear the error.
		await act(async () => {});

		let isAccepted: boolean | null = null;
		await act(async () => {
			isAccepted = await result.current.send({ text: "hello" });
		});

		expect(isAccepted).toBe(false);
		// The useChat throttle can hold the last update for 50 ms.
		await waitFor(() => expect(result.current.messages).toEqual([]));
		expect(result.current.isSendRefused).toBe(true);
	});

	// A project switch keeps this hook. A failed resume after a switch back is
	// a lost stream, so it must get Reconnect, not the refused-send sentence.
	it("forgets a refused send after a switch to another chat and back", async () => {
		let getCount = 0;
		const deps: BuilderChatDeps = {
			...createDeps().deps,
			fetch: async (_input, init) => {
				if (init?.method === "POST") throw new TypeError("Failed to fetch");
				getCount += 1;
				// The first mount resume finds no turn. Each later resume meets an API deploy.
				return new Response(null, { status: getCount === 1 ? 204 : 502 });
			},
		};
		const input = {
			projectId: PROJECT_ID,
			chatId: CHAT_ID,
			initialMessages: [],
			isHistorySettled: true,
		};
		const { result, rerender } = renderBuilderChat(input, deps);
		await waitFor(() => expect(getCount).toBe(1));
		await act(async () => {});
		await act(async () => {
			await result.current.send({ text: "hello" });
		});
		expect(result.current.isSendRefused).toBe(true);

		rerender({
			currentInput: {
				...input,
				projectId: crypto.randomUUID(),
				chatId: crypto.randomUUID(),
			},
		});
		await waitFor(() => expect(getCount).toBe(2));
		rerender({ currentInput: input });

		await waitFor(() => expect(getCount).toBe(3));
		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.isSendRefused).toBe(false);
	});

	// The transport gives up after its reopen budget. The turn still runs, or
	// it ended while the stream was down and the GET answers 204. The history
	// refetch of the `online` event can answer before that 204.
	it.each([
		{
			turn: "still runs",
			reconnectAnswer: "replay",
			storedHistory: null,
			texts: ["hello", "replayed reply"],
			isSending: true,
			isHistoryStale: false,
		},
		{
			turn: "ended while the stream was down",
			reconnectAnswer: "none",
			storedHistory: null,
			texts: ["hello", "partial reply"],
			isSending: false,
			isHistoryStale: true,
		},
		{
			turn: "ended, and the history answers before the 204",
			reconnectAnswer: "none",
			storedHistory: [
				{ id: "h1", role: "user", parts: [{ type: "text", text: "hello" }] },
				{
					id: "h2",
					role: "assistant",
					parts: [{ type: "text", text: "final reply" }],
				},
			] satisfies TurnMessage[],
			texts: ["hello", "final reply"],
			isSending: false,
			isHistoryStale: true,
		},
	])("reconnects after a lost stream when the turn $turn", async ({
		reconnectAnswer,
		storedHistory,
		texts,
		isSending,
		isHistoryStale,
	}) => {
		// Kept so the case can break the POST stream after its first frames.
		const post: {
			controller: ReadableStreamDefaultController<Uint8Array> | null;
		} = { controller: null };
		let getCount = 0;
		// The reconnect GET waits, so the case can set the history first.
		let answerReconnect = () => {};
		const reconnectGate = new Promise<void>((resolve) => {
			answerReconnect = resolve;
		});
		const deps: BuilderChatDeps = {
			...createDeps().deps,
			fetch: async (_input, init) => {
				if (init?.method === "POST") {
					return openTurnStream("partial reply", (controller) => {
						post.controller = controller;
					});
				}
				getCount += 1;
				// The mount resume finds no turn. The reconnect GET replays the
				// running turn from its first event, or finds no turn.
				if (getCount === 1) return new Response(null, { status: 204 });
				await reconnectGate;
				return reconnectAnswer === "none"
					? new Response(null, { status: 204 })
					: openTurnStream("replayed reply");
			},
		};
		const queryClient = new QueryClient();
		const historyKey = appBuilderKeys.chatHistory(PROJECT_ID);
		queryClient.setQueryData(historyKey, null);
		const input = {
			projectId: PROJECT_ID,
			chatId: CHAT_ID,
			initialMessages: [],
			isHistorySettled: true,
		};
		const { result, rerender } = renderBuilderChat(input, deps, queryClient);
		await waitFor(() => expect(getCount).toBe(1));
		await act(async () => {});

		act(() => {
			void result.current.send({ text: "hello" });
		});
		await waitFor(() =>
			expect(messageTexts(result.current.messages)).toEqual([
				"hello",
				"partial reply",
			]),
		);
		// Not a TypeError, so the transport does not reopen: the stream fails at once.
		act(() => post.controller?.error(new Error("stream lost")));
		await waitFor(() => expect(result.current.status).toBe("error"));

		act(() => {
			void result.current.reconnect();
		});
		await waitFor(() => expect(getCount).toBe(2));
		if (storedHistory !== null) {
			rerender({ currentInput: { ...input, initialMessages: storedHistory } });
		}
		await act(async () => answerReconnect());

		await waitFor(() =>
			expect(messageTexts(result.current.messages)).toEqual(texts),
		);
		await waitFor(() => expect(result.current.isSending).toBe(isSending));
		expect(queryClient.getQueryState(historyKey)?.isInvalidated).toBe(
			isHistoryStale,
		);
	});

	// The network can fail after the API created the turn. The send then drops
	// its bubble, and only the stored history shows the user row again.
	it("loads the history after a reconnect replays the turn of a lost POST answer", async () => {
		let getCount = 0;
		const deps: BuilderChatDeps = {
			...createDeps().deps,
			fetch: async (_input, init) => {
				if (init?.method === "POST") throw new TypeError("Failed to fetch");
				getCount += 1;
				// The mount resume finds no turn. The reconnect replays the whole turn.
				return getCount === 1
					? new Response(null, { status: 204 })
					: openTurnStream("replayed reply", (controller) => {
							controller.enqueue(
								new TextEncoder().encode(
									`data: ${JSON.stringify(doneFrame)}\n\ndata: [DONE]\n\n`,
								),
							);
							controller.close();
						});
			},
		};
		const queryClient = new QueryClient();
		const historyKey = appBuilderKeys.chatHistory(PROJECT_ID);
		queryClient.setQueryData(historyKey, null);
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [],
				isHistorySettled: true,
			},
			deps,
			queryClient,
		);
		await waitFor(() => expect(getCount).toBe(1));
		await act(async () => {});

		let isAccepted: boolean | null = null;
		await act(async () => {
			isAccepted = await result.current.send({ text: "hello" });
		});
		await waitFor(() => expect(result.current.status).toBe("error"));
		await act(async () => {
			await result.current.reconnect();
		});

		expect(isAccepted).toBe(false);
		expect(messageTexts(result.current.messages)).toEqual(["replayed reply"]);
		expect(queryClient.getQueryState(historyKey)?.isInvalidated).toBe(true);
	});

	// A stored reply has no created frame and no done frame. The reconnect
	// must not take it for a cut reply and drop it.
	it("keeps a stored reply when a reconnect after a failed resume replays a turn", async () => {
		let getCount = 0;
		const deps: BuilderChatDeps = {
			...createDeps().deps,
			// The mount resume fails during an API deploy; the reconnect replays.
			fetch: async () => {
				getCount += 1;
				return getCount === 1
					? new Response(null, { status: 502 })
					: openTurnStream("replayed reply");
			},
		};
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: CHAT_ID,
				initialMessages: [
					{
						id: "h1",
						role: "user",
						parts: [{ type: "text", text: "build it" }],
					},
					{
						id: "h2",
						role: "assistant",
						parts: [{ type: "text", text: "stored reply" }],
					},
				],
				isHistorySettled: true,
			},
			deps,
		);
		await waitFor(() => expect(result.current.status).toBe("error"));

		act(() => {
			void result.current.reconnect();
		});

		await waitFor(() =>
			expect(messageTexts(result.current.messages)).toEqual([
				"build it",
				"stored reply",
				"replayed reply",
			]),
		);
	});
});

/**
 * A turn stream as the relay sends it: the created frame and the start of a
 * reply. It stays open like a running turn. `onOpen` gets its controller.
 */
function openTurnStream(
	text: string,
	onOpen: (
		controller: ReadableStreamDefaultController<Uint8Array>,
	) => void = () => {},
): Response {
	const encoder = new TextEncoder();
	const frames = [
		createdFrame,
		{ type: "text-start", id: "t1" },
		{ type: "text-delta", id: "t1", delta: text },
	];
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				for (const frame of frames) {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
					);
				}
				onOpen(controller);
			},
		}),
		{ status: 200, headers: { "content-type": "text/event-stream" } },
	);
}
