import {
	appBuilderRoutes,
	type ChatMessage,
	type TurnAssistantMessageMetadata,
} from "@wandit/contracts";
import type { UIMessageChunk } from "ai";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import { getServerUrl } from "@/lib/server-url";
import type { TurnMessage } from "../api/dto";
import {
	createBuilderChatTransport,
	hydrateTurnMessages,
} from "./builder-chat-transport";

const PROJECT_ID = crypto.randomUUID();
const CHAT_ID = crypto.randomUUID();

function createRecordingFetch() {
	const calls: { url: string; init: RequestInit | undefined }[] = [];
	const fetchImpl = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		// The SDK calls fetch(api, init) with a string url.
		calls.push({ url: String(input), init });
		return new Response("data: [DONE]\n\n", {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	};
	return { calls, fetchImpl };
}

function userMessage(id: string, text: string): TurnMessage {
	return { id, role: "user", parts: [{ type: "text", text }] };
}

function sentBody(call: { init?: RequestInit } | undefined) {
	return JSON.parse(String(call?.init?.body));
}

describe("createBuilderChatTransport", () => {
	it("posts the user text to the create-turn route with credentials", async () => {
		const fake = createRecordingFetch();
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});

		await transport.sendMessages({
			trigger: "submit-message",
			chatId: CHAT_ID,
			messageId: undefined,
			messages: [userMessage("m1", "hello")],
			abortSignal: undefined,
		});

		expect(fake.calls).toHaveLength(1);
		const call = fake.calls[0];
		expect(call?.url).toBe(
			`${getServerUrl().replace(/\/$/, "")}${appBuilderRoutes.createTurn(PROJECT_ID)}`,
		);
		expect(call?.init?.method).toBe("POST");
		expect(call?.init?.credentials).toBe("include");
		expect(sentBody(call)).toEqual({ chatId: CHAT_ID, message: "hello" });
	});

	it("sends the tray answers with the summary message", async () => {
		const fake = createRecordingFetch();
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});
		const answers = [
			{
				toolCallId: "call-1",
				questionId: "question-0",
				action: "answered",
				optionIds: ["warm"],
				text: "",
				files: [],
			},
		];

		await transport.sendMessages({
			trigger: "submit-message",
			chatId: CHAT_ID,
			messageId: undefined,
			messages: [userMessage("m1", "Warm and crafted")],
			abortSignal: undefined,
			body: { answers },
		});

		expect(sentBody(fake.calls[0])).toEqual({
			chatId: CHAT_ID,
			message: "Warm and crafted",
			answers,
		});
	});

	it("sends an approval body with an empty message", async () => {
		const fake = createRecordingFetch();
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});

		await transport.sendMessages({
			trigger: "submit-message",
			chatId: CHAT_ID,
			messageId: undefined,
			messages: [userMessage("m1", "")],
			abortSignal: undefined,
			body: { approval: { approvalId: "ap-1", approved: true } },
		});

		expect(sentBody(fake.calls[0])).toEqual({
			chatId: CHAT_ID,
			message: "",
			approval: { approvalId: "ap-1", approved: true },
		});
	});

	it("sends file parts as attachments and a picked model", async () => {
		const fake = createRecordingFetch();
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});
		const message: TurnMessage = {
			id: "m1",
			role: "user",
			parts: [
				{
					type: "file",
					url: "https://x/a.png",
					mediaType: "image/png",
					filename: "a.png",
				},
				{ type: "text", text: "look" },
			],
		};

		await transport.sendMessages({
			trigger: "submit-message",
			chatId: CHAT_ID,
			messageId: undefined,
			messages: [message],
			abortSignal: undefined,
			body: { model: "model-1" },
		});

		expect(sentBody(fake.calls[0])).toEqual({
			chatId: CHAT_ID,
			message: "look",
			attachments: [
				{
					url: "https://x/a.png",
					mediaType: "image/png",
					filename: "a.png",
				},
			],
			model: "model-1",
		});
	});

	it("rejects a malformed request body before any fetch", async () => {
		const fake = createRecordingFetch();
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});

		// approvalId "" fails turnApprovalAnswerSchema; parse throws so the
		// bug reaches `error` instead of shipping a bad body.
		await expect(
			transport.sendMessages({
				trigger: "submit-message",
				chatId: CHAT_ID,
				messageId: undefined,
				messages: [userMessage("m1", "")],
				abortSignal: undefined,
				body: { approval: { approvalId: "" } },
			}),
		).rejects.toThrow();
		expect(fake.calls).toHaveLength(0);
	});

	it("sends only the last user message of a transcript", async () => {
		const fake = createRecordingFetch();
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});
		const transcript: TurnMessage[] = [
			userMessage("m1", "first"),
			{ id: "m2", role: "assistant", parts: [{ type: "text", text: "done" }] },
			userMessage("m3", "second"),
		];

		await transport.sendMessages({
			trigger: "submit-message",
			chatId: CHAT_ID,
			messageId: undefined,
			messages: transcript,
			abortSignal: undefined,
		});

		expect(sentBody(fake.calls[0])).toEqual({
			chatId: CHAT_ID,
			message: "second",
		});
	});

	it("reconnects on the active-turn stream route with credentials", async () => {
		const fake = createRecordingFetch();
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});

		await transport.reconnectToStream({ chatId: CHAT_ID });

		expect(fake.calls).toHaveLength(1);
		const call = fake.calls[0];
		expect(call?.url).toBe(
			`${getServerUrl().replace(/\/$/, "")}${appBuilderRoutes.activeTurnStream(PROJECT_ID)}`,
		);
		expect(call?.init?.method).toBe("GET");
		expect(call?.init?.credentials).toBe("include");
	});
});

describe("createBuilderChatTransport after a stream cut", () => {
	const TURN_ID = crypto.randomUUID();
	const created = {
		type: "data-turn-created",
		id: "turn-created",
		data: {
			turnId: TURN_ID,
			chatId: CHAT_ID,
			runId: null,
			status: "running",
			streamUrl: appBuilderRoutes.activeTurnStream(PROJECT_ID),
		},
	} satisfies UIMessageChunk;
	const prefix = [
		{ type: "start" },
		{ type: "text-start", id: "t1" },
		{ type: "text-delta", id: "t1", delta: "Hello " },
	] satisfies UIMessageChunk[];
	const rest = [
		{ type: "text-delta", id: "t1", delta: "world" },
		{ type: "text-end", id: "t1" },
	] satisfies UIMessageChunk[];
	const done = {
		type: "data-turn-done",
		id: "turn-done",
		data: { status: "succeeded" },
	} satisfies UIMessageChunk;

	function frames(chunks: UIMessageChunk[]): string {
		return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("");
	}

	/** A full replay answer of `GET turns/:turnId/stream`. */
	function replay(chunks: UIMessageChunk[]): Response {
		return new Response(`${frames(chunks)}data: [DONE]\n\n`, {
			headers: { "content-type": "text/event-stream" },
		});
	}

	/**
	 * The first fetch answers with an open body that holds `created` and
	 * `prefix`; the test cuts it. Each later fetch answers `reopens[n]`.
	 */
	function createCutFetch(reopens: (Response | Promise<Response>)[]) {
		const calls: { url: string; init: RequestInit | undefined }[] = [];
		let body: ReadableStreamDefaultController<Uint8Array> | undefined;
		const fetchImpl = async (
			input: RequestInfo | URL,
			init?: RequestInit,
		): Promise<Response> => {
			calls.push({ url: String(input), init });
			if (calls.length > 1) {
				const reopen = reopens[calls.length - 2];
				if (reopen === undefined) throw new Error("No reopen answer left");
				return reopen;
			}
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					body = controller;
					controller.enqueue(
						new TextEncoder().encode(frames([created, ...prefix])),
					);
				},
			});
			return new Response(stream, {
				headers: { "content-type": "text/event-stream" },
			});
		};
		const cut = (how: "network" | "close") => {
			if (how === "network") body?.error(new TypeError("network error"));
			else body?.close();
		};
		return { calls, cut, fetchImpl };
	}

	/** Reads the frames the first body holds, cuts the body, reads the rest. */
	async function readAcrossCut(
		fake: ReturnType<typeof createCutFetch>,
		how: "network" | "close",
		abort?: AbortController,
	) {
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});
		const stream = await transport.sendMessages({
			trigger: "submit-message",
			chatId: CHAT_ID,
			messageId: undefined,
			messages: [userMessage("m1", "build it")],
			abortSignal: abort?.signal,
		});
		const reader = stream.getReader();
		const chunks: (UIMessageChunk | undefined)[] = [];
		for (let index = 0; index < 1 + prefix.length; index += 1) {
			chunks.push((await reader.read()).value);
		}
		abort?.abort();
		fake.cut(how);
		for (;;) {
			const result = await reader.read();
			if (result.done) return chunks;
			chunks.push(result.value);
		}
	}

	it.each([
		"network",
		"close",
	] as const)("reopens the turn after a %s cut and gives each chunk once", async (how) => {
		const fake = createCutFetch([replay([...prefix, ...rest, done])]);

		const chunks = await readAcrossCut(fake, how);

		expect(chunks).toEqual([created, ...prefix, ...rest, done]);
		expect(fake.calls).toHaveLength(2);
		expect(fake.calls[1]?.url).toBe(
			`${getServerUrl().replace(/\/$/, "")}${appBuilderRoutes.turnStream(PROJECT_ID, TURN_ID)}`,
		);
		expect(fake.calls[1]?.init?.method).toBe("GET");
		expect(fake.calls[1]?.init?.credentials).toBe("include");
	});

	it("passes the turn end of a replay that is shorter than the prefix", async () => {
		// The relay writes the end from the row when the run left no events.
		const fake = createCutFetch([replay([done])]);

		const chunks = await readAcrossCut(fake, "close");

		expect(chunks).toEqual([created, ...prefix, done]);
		expect(fake.calls).toHaveLength(2);
	});

	it("does not reopen after the user stops", async () => {
		const fake = createCutFetch([]);

		await expect(
			readAcrossCut(fake, "network", new AbortController()),
		).rejects.toThrow("network error");
		expect(fake.calls).toHaveLength(1);
	});

	// A 503 comes in a deploy. A 429 comes when the server has not yet freed
	// the open-stream slot of the cut stream.
	it.each([503, 429])("tries the reopen again after a %i", async (status) => {
		vi.useFakeTimers();
		try {
			const fake = createCutFetch([
				new Response(null, { status }),
				replay([...prefix, ...rest, done]),
			]);

			const read = readAcrossCut(fake, "network");
			await vi.advanceTimersByTimeAsync(1_000);

			expect(await read).toEqual([created, ...prefix, ...rest, done]);
			expect(fake.calls).toHaveLength(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it("closes a reopened stream that arrives after useChat cancels", async () => {
		let answerReopen: (response: Response) => void = () => {};
		let isReopenCanceled = false;
		const fake = createCutFetch([
			new Promise<Response>((resolve) => {
				answerReopen = resolve;
			}),
		]);
		const transport = createBuilderChatTransport({
			projectId: PROJECT_ID,
			fetch: fake.fetchImpl,
		});
		const stream = await transport.sendMessages({
			trigger: "submit-message",
			chatId: CHAT_ID,
			messageId: undefined,
			messages: [userMessage("m1", "build it")],
			abortSignal: undefined,
		});
		const reader = stream.getReader();
		for (let index = 0; index < 1 + prefix.length; index += 1) {
			await reader.read();
		}

		fake.cut("close");
		const pending = reader.read();
		await vi.waitFor(() => expect(fake.calls).toHaveLength(2));
		await reader.cancel();
		answerReopen(
			new Response(
				new ReadableStream<Uint8Array>({
					cancel() {
						isReopenCanceled = true;
					},
				}),
				{ headers: { "content-type": "text/event-stream" } },
			),
		);

		expect(await pending).toEqual({ done: true, value: undefined });
		await vi.waitFor(() => expect(isReopenCanceled).toBe(true));
	});

	it("stops with the API error when the reopen answers 401", async () => {
		const fake = createCutFetch([new Response(null, { status: 401 })]);

		const read = readAcrossCut(fake, "network");

		await expect(read).rejects.toBeInstanceOf(ApiClientError);
		await expect(read).rejects.toMatchObject({ statusCode: 401 });
		expect(fake.calls).toHaveLength(2);
	});
});

describe("hydrateTurnMessages", () => {
	it("drops system and empty rows and appends the usage part of a V2 assistant row", () => {
		const usage = {
			inputTokens: 120,
			outputTokens: 40,
			cacheReadTokens: 5,
			cacheWriteTokens: 2,
			credits: 7,
		};
		const metadata: TurnAssistantMessageMetadata = {
			usage,
			model: "model-1",
			harness: "claude_code",
			outputCommitSha: "abc123",
		};
		const rows: ChatMessage[] = [
			{
				id: "sys",
				chatId: CHAT_ID,
				role: "system",
				parts: [{ type: "text", text: "system prompt" }],
				metadata: null,
				seq: 0,
				createdAt: "2026-09-16T10:00:00.000Z",
			},
			{
				id: "empty",
				chatId: CHAT_ID,
				role: "user",
				parts: [],
				metadata: null,
				seq: 1,
				createdAt: "2026-09-16T10:00:00.500Z",
			},
			{
				id: "u1",
				chatId: CHAT_ID,
				role: "user",
				parts: [{ type: "text", text: "hi" }],
				metadata: null,
				seq: 2,
				createdAt: "2026-09-16T10:00:01.000Z",
			},
			{
				id: "a1",
				chatId: CHAT_ID,
				role: "assistant",
				parts: [{ type: "text", text: "answer" }],
				metadata,
				seq: 3,
				createdAt: "2026-09-16T10:00:02.000Z",
			},
			{
				id: "a2",
				chatId: CHAT_ID,
				role: "assistant",
				parts: [{ type: "text", text: "old answer" }],
				metadata: null,
				seq: 4,
				createdAt: "2026-09-16T10:00:03.000Z",
			},
		];

		const messages = hydrateTurnMessages(rows);

		expect(messages.map((message) => message.id)).toEqual(["u1", "a1", "a2"]);
		expect(messages[1]?.parts.at(-1)).toEqual({
			type: "data-turn-usage",
			id: "turn-usage",
			data: usage,
		});
		// An assistant row without V2 metadata keeps its parts untouched.
		expect(
			messages[2]?.parts.some((part) => part.type === "data-turn-usage"),
		).toBe(false);
	});

	it("drops a stored data- part that fails its contracts schema", () => {
		const rows: ChatMessage[] = [
			{
				id: "a1",
				chatId: CHAT_ID,
				role: "assistant",
				parts: [
					{ type: "text", text: "answer" },
					// `options` is missing, so the part fails turnDataPartSchema.
					{ type: "data-question", id: "q1", data: { question: "Pick?" } },
					// No `type` at all: the tool-part check would throw on it.
					{ text: "no type" },
				],
				metadata: null,
				seq: 0,
				createdAt: "2026-09-16T10:00:00.000Z",
			},
		];

		const messages = hydrateTurnMessages(rows);

		expect(messages[0]?.parts).toEqual([{ type: "text", text: "answer" }]);
	});

	it("fills the defaults of a question row stored with plain option labels", () => {
		const rows: ChatMessage[] = [
			{
				id: "a1",
				chatId: CHAT_ID,
				role: "assistant",
				parts: [
					{
						type: "data-question",
						id: "call-1:question-0",
						data: {
							toolCallId: "call-1",
							questionId: "question-0",
							question: "Which color?",
							options: ["Blue", "Green"],
							answer: null,
						},
					},
				],
				metadata: null,
				seq: 0,
				createdAt: "2026-09-16T10:00:00.000Z",
			},
		];

		const [part] = hydrateTurnMessages(rows)[0]?.parts ?? [];

		expect(part).toEqual({
			type: "data-question",
			id: "call-1:question-0",
			data: {
				toolCallId: "call-1",
				questionId: "question-0",
				question: "Which color?",
				kind: "single-choice",
				options: [
					{ id: "Blue", label: "Blue" },
					{ id: "Green", label: "Green" },
				],
				answer: null,
			},
		});
	});
});
