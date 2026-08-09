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

	it("drops a docx file part and points the marker at read_attachment", () => {
		const url = "https://assets.example.com/uploads/user-1/tarifs.docx";
		const [message] = annotateUserFileParts([
			{
				id: "m1",
				parts: [
					{
						filename: "tarifs.docx",
						mediaType:
							"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
						type: "file",
						url,
					},
					{ text: "voici mes tarifs", type: "text" },
				],
				role: "user",
			},
		]);

		expect(message?.parts.map((part) => part.type)).toEqual(["text", "text"]);
		const marker = message?.parts[0];
		expect(marker?.type === "text" && marker.text).toBe(
			`[Attached file "tarifs.docx" (application/vnd.openxmlformats-officedocument.wordprocessingml.document): ${url}] ` +
				"Use the read_attachment tool with this URL to read its contents.",
		);
	});

	it("drops xlsx and csv file parts the same way", () => {
		const xlsxUrl = "https://assets.example.com/uploads/user-1/stock.xlsx";
		const csvUrl = "https://assets.example.com/uploads/user-1/leads.csv";
		const [message] = annotateUserFileParts([
			{
				id: "m1",
				parts: [
					{
						mediaType:
							"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
						type: "file",
						url: xlsxUrl,
					},
					{
						filename: "leads.csv",
						mediaType: "text/csv",
						type: "file",
						url: csvUrl,
					},
				],
				role: "user",
			},
		]);

		expect(message?.parts.map((part) => part.type)).toEqual(["text", "text"]);
		const xlsxMarker = message?.parts[0];
		const csvMarker = message?.parts[1];
		expect(xlsxMarker?.type === "text" && xlsxMarker.text).toBe(
			`[Attached file (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet): ${xlsxUrl}] ` +
				"Use the read_attachment tool with this URL to read its contents.",
		);
		expect(csvMarker?.type === "text" && csvMarker.text).toBe(
			`[Attached file "leads.csv" (text/csv): ${csvUrl}] ` +
				"Use the read_attachment tool with this URL to read its contents.",
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
