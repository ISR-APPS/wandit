import { aiChatMessageMetadataSchema } from "@wandit/contracts";
import { validateUIMessages } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com/public",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import {
	aiChatToolsForValidation,
	type WanditUIMessage,
} from "../../../agent/chat-agent";
import {
	assertOwnedFileParts,
	streamRequestId,
	stripRetiredVideoToolParts,
} from "./ai-chat.controller";

const OWN_UPLOAD =
	"https://assets.example.com/public/uploads/user_1/upload-1/photo.png";
const TEAMMATE_UPLOAD =
	"https://assets.example.com/public/uploads/user_2/upload-2/brief.pdf";
const FOREIGN_HOST = "https://evil.example.net/uploads/user_1/upload-1/x.png";
const GENERATED_ASSET =
	"https://assets.example.com/public/images/project-1/attempt-1/img-1.png";

function userFileMessage(id: string, url: string): WanditUIMessage {
	return {
		id,
		parts: [{ mediaType: "image/png", type: "file", url }],
		role: "user",
	} as unknown as WanditUIMessage;
}

function askUserFilesMessage(id: string, url: string): WanditUIMessage {
	return {
		id,
		parts: [
			{
				input: {},
				output: { files: [{ mediaType: "application/pdf", url }] },
				state: "output-available",
				toolCallId: "call_1",
				type: "tool-ask_user",
			},
		],
		role: "assistant",
	} as unknown as WanditUIMessage;
}

describe("persisted video tool validation", () => {
	it("skips retired tool parts without breaking the remaining history", async () => {
		const history = stripRetiredVideoToolParts(
			[
				{
					id: "assistant_legacy_video",
					parts: [
						{
							input: { brief: "A legacy video brief" },
							output: { message: "Queued.", status: "queued" },
							state: "output-available",
							toolCallId: "call_legacy_video",
							type: "tool-generate_video",
						},
						{ text: "The old render was queued.", type: "text" },
					],
					role: "assistant",
				},
			],
			new Set(["assistant_legacy_video"]),
		);
		const messages = await validateUIMessages<WanditUIMessage>({
			messages: history,
			tools: aiChatToolsForValidation,
		});

		expect(messages).toHaveLength(1);
		expect(messages[0]?.parts).toEqual([
			{ text: "The old render was queued.", type: "text" },
		]);
	});

	it("drops retired video composer metadata from persisted rows", async () => {
		const metadataSchema = z.preprocess(
			(value) => value ?? {},
			aiChatMessageMetadataSchema,
		);
		const history = stripRetiredVideoToolParts(
			[
				{
					id: "user_legacy_video",
					metadata: {
						composer: {
							mode: "video",
							options: { videoSubmissionId: "vsub_1" },
							output: "video-creator",
						},
					},
					parts: [{ text: "Make me a launch video", type: "text" }],
					role: "user",
				},
			],
			new Set(["user_legacy_video"]),
		);

		const messages = await validateUIMessages<WanditUIMessage>({
			messages: history,
			metadataSchema,
			tools: aiChatToolsForValidation,
		});

		expect(messages).toHaveLength(1);
		expect(
			(messages[0]?.metadata as { composer?: unknown } | undefined)?.composer,
		).toBeUndefined();
	});

	it("keeps NEW messages strict: retired composer metadata still rejects", async () => {
		const metadataSchema = z.preprocess(
			(value) => value ?? {},
			aiChatMessageMetadataSchema,
		);
		const history = stripRetiredVideoToolParts(
			[
				{
					id: "user_new_message",
					metadata: { composer: { mode: "video" } },
					parts: [{ text: "Video please", type: "text" }],
					role: "user",
				},
			],
			new Set(), // not persisted — must stay untouched and fail validation
		);

		await expect(
			validateUIMessages<WanditUIMessage>({
				messages: history,
				metadataSchema,
				tools: aiChatToolsForValidation,
			}),
		).rejects.toThrow();
	});
});

describe("assertOwnedFileParts", () => {
	it("accepts the acting user's own upload on a new message", () => {
		expect(() =>
			assertOwnedFileParts(
				[userFileMessage("msg_new", OWN_UPLOAD)],
				"user_1",
				new Set(),
			),
		).not.toThrow();
	});

	it("rejects another user's upload on a NEW message", () => {
		expect(() =>
			assertOwnedFileParts(
				[userFileMessage("msg_new", TEAMMATE_UPLOAD)],
				"user_1",
				new Set(),
			),
		).toThrow("Attachments must be uploaded through Wandit");
	});

	it("accepts a teammate's upload on PERSISTED history in a shared chat", () => {
		// Member A attached a file; member B resubmits the hydrated transcript.
		expect(() =>
			assertOwnedFileParts(
				[
					userFileMessage("msg_history", TEAMMATE_UPLOAD),
					userFileMessage("msg_new", OWN_UPLOAD),
				],
				"user_1",
				new Set(["msg_history"]),
			),
		).not.toThrow();
	});

	it("still rejects foreign hosts and generated assets on persisted history", () => {
		expect(() =>
			assertOwnedFileParts(
				[userFileMessage("msg_history", FOREIGN_HOST)],
				"user_1",
				new Set(["msg_history"]),
			),
		).toThrow("Attachments must be uploaded through Wandit");
		expect(() =>
			assertOwnedFileParts(
				[userFileMessage("msg_history", GENERATED_ASSET)],
				"user_1",
				new Set(["msg_history"]),
			),
		).toThrow("Attachments must be uploaded through Wandit");
	});

	it("applies the same persisted/new split to ask_user output files", () => {
		expect(() =>
			assertOwnedFileParts(
				[askUserFilesMessage("msg_history", TEAMMATE_UPLOAD)],
				"user_1",
				new Set(["msg_history"]),
			),
		).not.toThrow();
		expect(() =>
			assertOwnedFileParts(
				[askUserFilesMessage("msg_new", TEAMMATE_UPLOAD)],
				"user_1",
				new Set(),
			),
		).toThrow("Attachments must be uploaded through Wandit");
	});
});

describe("streamRequestId", () => {
	it("ignores messageId on plain submits — the SDK sends the last message's id", () => {
		// Regression: using body.id as the idempotency key 409'd every turn
		// after the first (chat id never changes), so answering ask_user
		// questions or sending a second message always failed as a replay.
		expect(
			streamRequestId({ messageId: undefined, trigger: "submit-message" }),
		).toBeUndefined();
	});

	it("ignores messageId on auto-resubmits and retries — it repeats the assistant row id across rounds", () => {
		// Regression: ask_user answers and post-failure retries auto-resubmit
		// with messageId = the extended assistant message's id, which is
		// CONSTANT for the whole turn. Honoring it welded every retry to the
		// failed attempt's idempotency key, so one mid-stream failure turned
		// the turn into a permanent 409 AI_CHAT_OPERATION_REPLAYED.
		expect(
			streamRequestId({
				messageId: "assistant-msg-1",
				trigger: "submit-message",
			}),
		).toBeUndefined();
		expect(
			streamRequestId({ messageId: "assistant-msg-1", trigger: undefined }),
		).toBeUndefined();
	});

	it("uses messageId when the client regenerates a specific message", () => {
		expect(
			streamRequestId({
				messageId: "msg-7",
				trigger: "regenerate-message",
			}),
		).toBe("msg-7");
	});
});
