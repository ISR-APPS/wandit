import { describe, expect, it } from "vitest";
import { annotateUserFileParts } from "./annotate-file-parts";
import type { WanditUIMessage } from "./chat-agent";

const FILE_URL = "https://assets.example.com/uploads/user-1/bottle.jpg";

function userMessageWithFile(): WanditUIMessage {
	return {
		id: "m1",
		parts: [
			{
				filename: "bottle.jpg",
				mediaType: "image/jpeg",
				type: "file",
				url: FILE_URL,
			},
			{ text: "Voici mon image, fais une photo commerciale", type: "text" },
		],
		role: "user",
	};
}

describe("annotateUserFileParts", () => {
	it("follows a user file part with a text marker exposing its URL", () => {
		const [message] = annotateUserFileParts([userMessageWithFile()]);

		expect(message?.parts.map((part) => part.type)).toEqual([
			"file",
			"text",
			"text",
		]);
		const marker = message?.parts[1];
		expect(marker?.type === "text" && marker.text).toBe(
			`[Attached image "bottle.jpg" (image/jpeg): ${FILE_URL}]`,
		);
	});

	it("labels non-image attachments as files", () => {
		const [message] = annotateUserFileParts([
			{
				id: "m1",
				parts: [
					{
						mediaType: "application/pdf",
						type: "file",
						url: "https://assets.example.com/uploads/user-1/menu.pdf",
					},
				],
				role: "user",
			},
		]);

		const marker = message?.parts[1];
		expect(marker?.type === "text" && marker.text).toBe(
			"[Attached file (application/pdf): https://assets.example.com/uploads/user-1/menu.pdf]",
		);
	});

	it("leaves messages without file parts untouched (same reference)", () => {
		const textOnly: WanditUIMessage = {
			id: "m2",
			parts: [{ text: "hello", type: "text" }],
			role: "user",
		};
		const assistant: WanditUIMessage = {
			id: "m3",
			parts: [{ text: "hi", type: "text" }],
			role: "assistant",
		};

		const result = annotateUserFileParts([textOnly, assistant]);

		expect(result[0]).toBe(textOnly);
		expect(result[1]).toBe(assistant);
	});

	it("does not mutate the input message", () => {
		const original = userMessageWithFile();
		const partCount = original.parts.length;

		annotateUserFileParts([original]);

		expect(original.parts).toHaveLength(partCount);
	});
});
