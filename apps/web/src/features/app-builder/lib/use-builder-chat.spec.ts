// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
		// Writes the [DONE] terminator like the real wire, then closes.
		endPostStream: () => {
			postController?.enqueue(encoder.encode("data: [DONE]\n\n"));
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
	it("exposes the turn id and estimate of data-turn-created while sending", async () => {
		const fake = createDeps();
		const { result } = renderBuilderChat(
			{ projectId: PROJECT_ID, chatId: CHAT_ID, initialMessages: [] },
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
		expect(result.current.estimate).toEqual(createdFrame.data.estimate);

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
			{ projectId: PROJECT_ID, chatId: CHAT_ID, initialMessages: [] },
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
			{ projectId: PROJECT_ID, chatId: CHAT_ID, initialMessages: [] },
			resumed.deps,
		);
		await waitFor(() => expect(resumedResult.current.isSending).toBe(true));
		expect(resumedResult.current.isAwaitingTurn).toBe(false);
	});

	it("aborts the stream and then posts the turn cancel", async () => {
		const fake = createDeps();
		const { result } = renderBuilderChat(
			{ projectId: PROJECT_ID, chatId: CHAT_ID, initialMessages: [] },
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
			{ projectId: PROJECT_ID, chatId: CHAT_ID, initialMessages: [] },
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

	it("refuses to send while the chat id is unknown", async () => {
		const fake = createDeps();
		const { result } = renderBuilderChat(
			{
				projectId: PROJECT_ID,
				chatId: undefined,
				initialMessages: [],
			},
			fake.deps,
		);

		act(() => {
			result.current.send({ text: "hello" });
		});
		// Flush pending work so a stray POST would have fired.
		await act(async () => {});

		expect(postCount(fake)).toBe(0);
		expect(result.current.turnId).toBeNull();
	});

	it("marks the Code view tree and files stale when a turn ends", async () => {
		const fake = createDeps();
		const queryClient = new QueryClient();
		queryClient.setQueryData(appBuilderKeys.code(PROJECT_ID), null);
		const { result } = renderBuilderChat(
			{ projectId: PROJECT_ID, chatId: CHAT_ID, initialMessages: [] },
			fake.deps,
			queryClient,
		);
		await waitFor(() => expect(result.current.status).toBe("ready"));

		act(() => {
			result.current.send({ text: "hello" });
		});
		await waitFor(() => expect(result.current.isSending).toBe(true));
		expect(
			queryClient.getQueryState(appBuilderKeys.code(PROJECT_ID))?.isInvalidated,
		).toBe(false);

		fake.endPostStream();
		await waitFor(() => expect(result.current.status).toBe("ready"));

		// The turn woke the sandbox, so an asleep Code view loads again.
		await waitFor(() =>
			expect(
				queryClient.getQueryState(appBuilderKeys.code(PROJECT_ID))
					?.isInvalidated,
			).toBe(true),
		);
	});

	it("marks the Cloud tables and their pages stale when a turn ends, not the backend state", async () => {
		const fake = createDeps();
		const queryClient = new QueryClient();
		const rowsKey = cloudKeys.rows(PROJECT_ID, "orders", {
			page: 1,
			pageSize: 50,
			dir: "asc",
		});
		queryClient.setQueryData(cloudKeys.tables(PROJECT_ID), []);
		queryClient.setQueryData(rowsKey, null);
		queryClient.setQueryData(cloudKeys.backend(PROJECT_ID), {
			status: "active",
			ref: "abcdefghijklmnopqrst",
			region: "eu-west-3",
			failureCode: null,
		});
		const { result } = renderBuilderChat(
			{ projectId: PROJECT_ID, chatId: CHAT_ID, initialMessages: [] },
			fake.deps,
			queryClient,
		);
		await waitFor(() => expect(result.current.status).toBe("ready"));

		act(() => {
			result.current.send({ text: "add an orders table" });
		});
		await waitFor(() => expect(result.current.isSending).toBe(true));
		fake.endPostStream();
		await waitFor(() => expect(result.current.status).toBe("ready"));

		// The agent can run a migration in any turn.
		await waitFor(() =>
			expect(
				queryClient.getQueryState(cloudKeys.tables(PROJECT_ID))?.isInvalidated,
			).toBe(true),
		);
		expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(true);
		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID))?.isInvalidated,
		).toBe(false);
	});

	it("ignores a history change while streaming and reseeds when ready", async () => {
		const fake = createDeps();
		const historyMessage = (id: string, text: string): TurnMessage => ({
			id,
			role: "user",
			parts: [{ type: "text", text }],
		});
		const baseInput = { projectId: PROJECT_ID, chatId: CHAT_ID };
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
		expect(messageTexts(result.current.messages)).toContain("hello");
		expect(messageTexts(result.current.messages)).not.toContain(
			"newer history",
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

	it("puts a late history in front of a resumed reply", async () => {
		const fake = createDeps({ resumeReply: true });
		const baseInput = { projectId: PROJECT_ID, chatId: CHAT_ID };
		const { result, rerender } = renderBuilderChat(
			{ ...baseInput, initialMessages: [] },
			fake.deps,
		);
		// The reload resumed the running turn before the history query landed.
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
});
