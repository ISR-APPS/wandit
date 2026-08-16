import type { AskUserOutput } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import {
	annotateAskUserAnswerFiles,
	annotateUserFileParts,
} from "./annotate-file-parts";
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

type AskAnswerFile = NonNullable<AskUserOutput["files"]>[number];

function askUserPart(
	files: AskAnswerFile[] | undefined,
	toolCallId = "ask-1",
): WanditUIMessage["parts"][number] {
	return {
		input: { options: [], question: "What should I use?" },
		output: { files, text: "Use these files" },
		state: "output-available",
		toolCallId,
		type: "tool-ask_user",
	};
}

describe("annotateAskUserAnswerFiles", () => {
	it("inserts a deterministic user file message immediately after the assistant answer", () => {
		const assistant: WanditUIMessage = {
			id: "assistant-1",
			parts: [
				{ text: "Please attach the product image.", type: "text" },
				askUserPart([
					{
						filename: "product.png",
						mediaType: "image/png",
						url: "https://assets.example.com/product.png",
					},
				]),
			],
			role: "assistant",
		};
		const followingMessage: WanditUIMessage = {
			id: "user-2",
			parts: [{ text: "Continue", type: "text" }],
			role: "user",
		};

		const result = annotateAskUserAnswerFiles([assistant, followingMessage]);

		expect(result[0]).toBe(assistant);
		expect(result[1]).toEqual({
			id: "assistant-1:ask-answer-files",
			parts: [
				{
					text: "[Files the user attached when answering the questions above — shown here so you can see them. Their URLs are in the ask_user results.]",
					type: "text",
				},
				{
					filename: "product.png",
					mediaType: "image/png",
					type: "file",
					url: "https://assets.example.com/product.png",
				},
			],
			role: "user",
		});
		expect(result[2]).toBe(followingMessage);
	});

	it("keeps model-safe files and deduplicates URLs across asks", () => {
		const imageUrl = "https://assets.example.com/product.jpg";
		const assistant: WanditUIMessage = {
			id: "assistant-2",
			parts: [
				askUserPart([
					{
						filename: "product.jpg",
						mediaType: "image/jpeg",
						url: imageUrl,
					},
					{
						filename: "brief.docx",
						mediaType:
							"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
						url: "https://assets.example.com/brief.docx",
					},
				]),
				askUserPart(
					[
						{
							filename: "duplicate.jpg",
							mediaType: "image/jpeg",
							url: imageUrl,
						},
						{
							mediaType: "application/pdf",
							url: "https://assets.example.com/brief.pdf",
						},
						{
							filename: "notes.txt",
							mediaType: "text/plain",
							url: "https://assets.example.com/notes.txt",
						},
					],
					"ask-2",
				),
			],
			role: "assistant",
		};

		const result = annotateAskUserAnswerFiles([assistant]);
		const inserted = result[1];

		expect(inserted?.parts.slice(1)).toEqual([
			{
				filename: "product.jpg",
				mediaType: "image/jpeg",
				type: "file",
				url: imageUrl,
			},
			{
				mediaType: "application/pdf",
				type: "file",
				url: "https://assets.example.com/brief.pdf",
			},
			{
				filename: "notes.txt",
				mediaType: "text/plain",
				type: "file",
				url: "https://assets.example.com/notes.txt",
			},
		]);
	});

	it("passes through messages without qualifying files untouched", () => {
		const noFiles: WanditUIMessage = {
			id: "assistant-no-files",
			parts: [askUserPart(undefined)],
			role: "assistant",
		};
		const docxOnly: WanditUIMessage = {
			id: "assistant-docx",
			parts: [
				askUserPart([
					{
						mediaType:
							"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
						url: "https://assets.example.com/brief.docx",
					},
				]),
			],
			role: "assistant",
		};
		const user: WanditUIMessage = {
			id: "user-1",
			parts: [{ text: "Hello", type: "text" }],
			role: "user",
		};

		const result = annotateAskUserAnswerFiles([noFiles, docxOnly, user]);

		expect(result).toHaveLength(3);
		expect(result[0]).toBe(noFiles);
		expect(result[1]).toBe(docxOnly);
		expect(result[2]).toBe(user);
	});

	it("does not mutate the input array or assistant message", () => {
		const assistant: WanditUIMessage = {
			id: "assistant-immutable",
			parts: [
				askUserPart([
					{
						filename: "product.png",
						mediaType: "image/png",
						url: "https://assets.example.com/product.png",
					},
				]),
			],
			role: "assistant",
		};
		const snapshot = structuredClone(assistant);
		const input = [assistant];

		const result = annotateAskUserAnswerFiles(input);

		expect(input).toEqual([snapshot]);
		expect(input).toHaveLength(1);
		expect(input[0]).toBe(assistant);
		expect(assistant).toEqual(snapshot);
		expect(result).toHaveLength(2);
	});
});

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
