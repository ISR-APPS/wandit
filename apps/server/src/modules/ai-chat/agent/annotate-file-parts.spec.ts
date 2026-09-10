import type { AskUserOutput } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import {
	annotateAskUserAnswerFiles,
	annotateUserFileParts,
	capModelImageParts,
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

function pngUrl(name: string): string {
	return `https://assets.example.com/${name}.png`;
}

function pngMarker(name: string): string {
	return `[Attached image "${name}.png" (image/png): ${pngUrl(name)}]`;
}

function userMessageWithImages(
	id: string,
	names: readonly string[],
): WanditUIMessage {
	return {
		id,
		parts: names.flatMap<WanditUIMessage["parts"][number]>((name) => [
			{
				filename: `${name}.png`,
				mediaType: "image/png",
				type: "file",
				url: pngUrl(name),
			},
			{ text: pngMarker(name), type: "text" },
		]),
		role: "user",
	};
}

function modelImageUrls(messages: readonly WanditUIMessage[]): string[] {
	return messages.flatMap((message) =>
		message.parts.flatMap((part) =>
			part.type === "file" && part.mediaType.startsWith("image/")
				? [part.url]
				: [],
		),
	);
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
				{
					text: '[Attached image "product.png" (image/png): https://assets.example.com/product.png]',
					type: "text",
				},
			],
			role: "user",
		});
		expect(result[2]).toBe(followingMessage);
	});

	it("marks every answer file and deduplicates URLs", () => {
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
							filename: "brief.pdf",
							mediaType: "application/pdf",
							url: "https://assets.example.com/brief.pdf",
						},
						{
							filename: "notes.txt",
							mediaType: "text/plain",
							url: "https://assets.example.com/notes.txt",
						},
						{
							filename: "stock.xlsx",
							mediaType:
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
							url: "https://assets.example.com/stock.xlsx",
						},
						{
							filename: "leads.csv",
							mediaType: "text/csv",
							url: "https://assets.example.com/leads.csv",
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
				text: `[Attached image "product.jpg" (image/jpeg): ${imageUrl}]`,
				type: "text",
			},
			{
				text:
					'[Attached file "brief.docx" (application/vnd.openxmlformats-officedocument.wordprocessingml.document): https://assets.example.com/brief.docx] ' +
					"Use the read_attachment tool with this URL to read its contents.",
				type: "text",
			},
			{
				text:
					`[Attached file "brief.pdf" (application/pdf): https://assets.example.com/brief.pdf] ` +
					"Use the read_attachment tool with this URL to read its contents.",
				type: "text",
			},
			{
				filename: "notes.txt",
				mediaType: "text/plain",
				type: "file",
				url: "https://assets.example.com/notes.txt",
			},
			{
				text: '[Attached file "notes.txt" (text/plain): https://assets.example.com/notes.txt]',
				type: "text",
			},
			{
				text:
					'[Attached file "stock.xlsx" (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet): https://assets.example.com/stock.xlsx] ' +
					"Use the read_attachment tool with this URL to read its contents.",
				type: "text",
			},
			{
				text:
					'[Attached file "leads.csv" (text/csv): https://assets.example.com/leads.csv] ' +
					"Use the read_attachment tool with this URL to read its contents.",
				type: "text",
			},
		]);
	});

	it("passes through messages without files untouched", () => {
		const noFiles: WanditUIMessage = {
			id: "assistant-no-files",
			parts: [askUserPart(undefined)],
			role: "assistant",
		};
		const user: WanditUIMessage = {
			id: "user-1",
			parts: [{ text: "Hello", type: "text" }],
			role: "user",
		};

		const result = annotateAskUserAnswerFiles([noFiles, user]);

		expect(result).toHaveLength(2);
		expect(result[0]).toBe(noFiles);
		expect(result[1]).toBe(user);
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

	it("replaces a PDF with a file marker and read_attachment guidance", () => {
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

		expect(message?.parts).toHaveLength(1);
		const marker = message?.parts[0];
		expect(marker?.type === "text" && marker.text).toBe(
			"[Attached file (application/pdf): https://assets.example.com/uploads/user-1/menu.pdf] " +
				"Use the read_attachment tool with this URL to read its contents.",
		);
	});

	it.each([
		{
			filename: "reference.mp4",
			kind: "video",
			mediaType: "video/mp4",
		},
		{
			filename: "soundtrack.mp3",
			kind: "audio",
			mediaType: "audio/mpeg",
		},
	])("drops $kind file parts and emits marker-only $kind annotations", ({
		filename,
		kind,
		mediaType,
	}) => {
		const url = `https://assets.example.com/uploads/user-1/${filename}`;
		const [message] = annotateUserFileParts([
			{
				id: "m1",
				parts: [
					{
						filename,
						mediaType,
						type: "file",
						url,
					},
					{ text: "Forward this attachment", type: "text" },
				],
				role: "user",
			},
		]);

		expect(message?.parts).toEqual([
			{
				text: `[Attached ${kind} "${filename}" (${mediaType}): ${url}]`,
				type: "text",
			},
			{ text: "Forward this attachment", type: "text" },
		]);
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

describe("capModelImageParts", () => {
	it("keeps the newest eight images across user and ask_user messages", () => {
		const askUserImages = ["image-06", "image-07"].map((name) => ({
			filename: `${name}.png`,
			mediaType: "image/png",
			url: pngUrl(name),
		}));
		const assistant: WanditUIMessage = {
			id: "assistant-files",
			parts: [askUserPart(askUserImages)],
			role: "assistant",
		};
		const oldestMessage = userMessageWithImages("user-old", [
			"image-01",
			"image-02",
			"image-03",
		]);
		oldestMessage.parts.push({
			filename: "notes.txt",
			mediaType: "text/plain",
			type: "file",
			url: "https://assets.example.com/notes.txt",
		});
		const messages = annotateAskUserAnswerFiles([
			oldestMessage,
			userMessageWithImages("user-middle", ["image-04", "image-05"]),
			assistant,
			userMessageWithImages("user-new", ["image-08", "image-09", "image-10"]),
		]);

		const result = capModelImageParts(messages);

		expect(modelImageUrls(result)).toEqual(
			[
				"image-03",
				"image-04",
				"image-05",
				"image-06",
				"image-07",
				"image-08",
				"image-09",
				"image-10",
			].map(pngUrl),
		);
		expect(result[0]?.parts).toEqual([
			{ text: pngMarker("image-01"), type: "text" },
			{ text: pngMarker("image-02"), type: "text" },
			{
				filename: "image-03.png",
				mediaType: "image/png",
				type: "file",
				url: pngUrl("image-03"),
			},
			{ text: pngMarker("image-03"), type: "text" },
			{
				filename: "notes.txt",
				mediaType: "text/plain",
				type: "file",
				url: "https://assets.example.com/notes.txt",
			},
		]);
		expect(result[2]).toBe(assistant);
		expect(capModelImageParts(result)).toBe(result);
	});

	it("keeps the marker for an older ask_user image after removal", () => {
		const oldImage = "ask-image-old";
		const assistant: WanditUIMessage = {
			id: "assistant-old-image",
			parts: [
				askUserPart([
					{
						filename: `${oldImage}.png`,
						mediaType: "image/png",
						url: pngUrl(oldImage),
					},
				]),
			],
			role: "assistant",
		};
		const messages = annotateAskUserAnswerFiles([
			assistant,
			userMessageWithImages("user-new", [
				"image-01",
				"image-02",
				"image-03",
				"image-04",
				"image-05",
				"image-06",
				"image-07",
				"image-08",
			]),
		]);

		const result = capModelImageParts(messages);

		expect(result[1]?.parts).toEqual([
			{
				text: "[Files the user attached when answering the questions above — shown here so you can see them. Their URLs are in the ask_user results.]",
				type: "text",
			},
			{ text: pngMarker(oldImage), type: "text" },
		]);
	});

	it("returns the same array when eight images need no removal", () => {
		const messages = [
			userMessageWithImages("user-images", [
				"image-01",
				"image-02",
				"image-03",
				"image-04",
				"image-05",
				"image-06",
				"image-07",
				"image-08",
			]),
		];

		expect(capModelImageParts(messages)).toBe(messages);
	});
});
