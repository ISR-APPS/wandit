import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com/public",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import type { WanditUIMessage } from "../../../agent/chat-agent";
import { assertOwnedFileParts } from "./ai-chat.controller";

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
