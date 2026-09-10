/**
 * PDFs and office files reach the model through read_attachment because the gateway routes for GLM reject PDF URL parts.
 * Video and audio never travel raw.
 * Each request contains at most 8 raw images.
 * ai-chat.service.ts calls these functions on the model-bound message copy before each provider request. They import only the chat message type.
 */
import type { WanditUIMessage } from "./chat-agent";

// The gateway routes for GLM reject PDF URL parts, so read_attachment reads PDFs.
const MODEL_SAFE_MEDIA_TYPES = (mediaType: string): boolean =>
	mediaType.startsWith("image/") || mediaType === "text/plain";

// Friendli, the first gateway route for GLM, accepts at most 8 images per request.
// The newest images matter most. Older ones stay in the transcript as URL markers.
// LIMIT: 8 raw images per request. Upgrade: raise this cap after all gateway routes accept more images.
const MAX_CHAT_IMAGE_PARTS = 8;

const ASK_USER_ANSWER_FILES_MARKER =
	"[Files the user attached when answering the questions above — shown here so you can see them. Their URLs are in the ask_user results.]";
const READ_ATTACHMENT_GUIDANCE =
	"Use the read_attachment tool with this URL to read its contents.";

type AttachmentFile = {
	filename?: string;
	mediaType: string;
	url: string;
};

function buildAttachmentMarker(file: AttachmentFile): string {
	const kind = file.mediaType.startsWith("image/")
		? "image"
		: file.mediaType.startsWith("video/")
			? "video"
			: file.mediaType.startsWith("audio/")
				? "audio"
				: "file";
	const name = file.filename ? ` "${file.filename}"` : "";

	return `[Attached ${kind}${name} (${file.mediaType}): ${file.url}]`;
}

function modelPartsForFile(
	file: AttachmentFile,
): WanditUIMessage["parts"][number][] {
	const marker = buildAttachmentMarker(file);

	// Audio and video URLs can reach connector tools, but providers reject their raw parts.
	if (
		file.mediaType.startsWith("video/") ||
		file.mediaType.startsWith("audio/")
	) {
		return [{ text: marker, type: "text" }];
	}

	// Providers can ingest images and plain text without read_attachment.
	if (MODEL_SAFE_MEDIA_TYPES(file.mediaType)) {
		return [
			{
				...file,
				type: "file",
			},
			{ text: marker, type: "text" },
		];
	}

	return [
		{
			text: `${marker} ${READ_ATTACHMENT_GUIDANCE}`,
			type: "text",
		},
	];
}

/**
 * Adds a synthetic user message after each ask_user answer that includes files.
 * The model-bound copy includes only the first file for each URL.
 */
export function annotateAskUserAnswerFiles(
	messages: readonly WanditUIMessage[],
): WanditUIMessage[] {
	return messages.flatMap((message) => {
		if (message.role !== "assistant") {
			return [message];
		}

		const files = new Map<string, AttachmentFile>();

		for (const part of message.parts) {
			if (part.type !== "tool-ask_user" || part.state !== "output-available") {
				continue;
			}

			for (const file of part.output.files ?? []) {
				// Repeated ask_user outputs can contain the same upload URL.
				if (files.has(file.url)) {
					continue;
				}

				files.set(file.url, file);
			}
		}

		if (files.size === 0) {
			return [message];
		}

		const answerParts = [...files.values()].flatMap(modelPartsForFile);
		const answerFilesMessage: WanditUIMessage = {
			id: `${message.id}:ask-answer-files`,
			parts: [
				{ text: ASK_USER_ANSWER_FILES_MARKER, type: "text" },
				...answerParts,
			],
			role: "user",
		};

		return [message, answerFilesMessage];
	});
}

/**
 * Adds readable URL markers to file parts in the model-bound copy.
 * Provider-incompatible file parts become markers for read_attachment or connector tools.
 */
export function annotateUserFileParts(
	messages: readonly WanditUIMessage[],
): WanditUIMessage[] {
	return messages.map((message) => {
		if (
			message.role !== "user" ||
			!message.parts.some((part) => part.type === "file")
		) {
			return message;
		}

		const parts = message.parts.flatMap<WanditUIMessage["parts"][number]>(
			(part) => {
				if (part.type !== "file") {
					return [part];
				}

				return modelPartsForFile(part);
			},
		);

		return { ...message, parts };
	});
}

/**
 * Keeps the newest eight raw image parts across the transcript.
 * Returns the input array when no image part is removed.
 */
export function capModelImageParts(
	messages: WanditUIMessage[],
): WanditUIMessage[] {
	let keptImageCount = 0;
	let removedImage = false;
	const cappedMessages = messages
		.toReversed()
		.map((message) => {
			const parts = message.parts
				.toReversed()
				.filter((part) => {
					if (part.type !== "file" || !part.mediaType.startsWith("image/")) {
						return true;
					}

					keptImageCount += 1;
					// Older images keep their markers, so the model can still use their URLs.
					if (keptImageCount > MAX_CHAT_IMAGE_PARTS) {
						removedImage = true;
						return false;
					}

					return true;
				})
				.toReversed();

			return parts.length === message.parts.length
				? message
				: { ...message, parts };
		})
		.toReversed();

	return removedImage ? cappedMessages : messages;
}
