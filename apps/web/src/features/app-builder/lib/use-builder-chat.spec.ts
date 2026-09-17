// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { CreateTurnResponse } from "@wandit/contracts";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
) {
	return renderHook(
		(props: { currentInput: Parameters<typeof useBuilderChat>[0] }) =>
			useBuilderChat(props.currentInput, deps),
		{
			initialProps: { currentInput: input },
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(
					QueryClientProvider,
					{ client: new QueryClient() },
					children,
				),
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
