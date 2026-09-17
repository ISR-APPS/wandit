import {
	appBuilderRoutes,
	type ChatMessage,
	type TurnAssistantMessageMetadata,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

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
		// A question answer is the same shape with the option label as message.
		expect(sentBody(call)).toEqual({ chatId: CHAT_ID, message: "hello" });
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
});
