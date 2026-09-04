import type { WanditUIMessage } from "./chat-agent";

// What a provider can actually take as a raw file part. Everything else
// (docx, xlsx, csv) reaches the model through read_attachment instead.
const MODEL_SAFE_MEDIA_TYPES = (mediaType: string): boolean =>
	mediaType.startsWith("image/") ||
	mediaType === "application/pdf" ||
	mediaType === "text/plain";

const ASK_USER_ANSWER_FILES_MARKER =
	"[Files the user attached when answering the questions above — shown here so you can see them. Their URLs are in the ask_user results.]";

/**
 * ask_user outputs are tool-result JSON, so their file URLs are readable but
 * their contents are not visible to the model. Follow each qualifying
 * assistant turn with a synthetic user turn that re-emits provider-safe files.
 * Applied to the MODEL-BOUND copy only; the persisted transcript is untouched.
 */
export function annotateAskUserAnswerFiles(
	messages: readonly WanditUIMessage[],
): WanditUIMessage[] {
	return messages.flatMap((message) => {
		if (message.role !== "assistant") {
			return [message];
		}

		const files = new Map<
			string,
			{ filename?: string; mediaType: string; url: string }
		>();

		for (const part of message.parts) {
			if (part.type !== "tool-ask_user" || part.state !== "output-available") {
				continue;
			}

			for (const file of part.output.files ?? []) {
				if (!MODEL_SAFE_MEDIA_TYPES(file.mediaType) || files.has(file.url)) {
					continue;
				}

				files.set(file.url, file);
			}
		}

		if (files.size === 0) {
			return [message];
		}

		const fileParts = [...files.values()].map((file) => ({
			...(file.filename ? { filename: file.filename } : {}),
			mediaType: file.mediaType,
			type: "file" as const,
			url: file.url,
		}));
		const answerFilesMessage: WanditUIMessage = {
			id: `${message.id}:ask-answer-files`,
			parts: [
				{ text: ASK_USER_ANSWER_FILES_MARKER, type: "text" },
				...fileParts,
			],
			role: "user",
		};

		return [message, answerFilesMessage];
	});
}

/**
 * A user file part reaches the model as opaque visual content — the model can
 * SEE the image but cannot read (or quote) its URL, so it has no way to pass
 * the attachment to generate_image.sourceImageUrls or a connector. That made
 * the agent ask for a photo the user had already attached. Follow every user
 * file part with a text marker exposing the exact URL as readable text.
 * A file part the provider cannot ingest is REPLACED by its marker (the raw
 * part is dropped so the gateway never chokes on the media type).
 * Applied to the MODEL-BOUND copy only; the persisted transcript is untouched.
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

				const kind = part.mediaType.startsWith("image/")
					? "image"
					: part.mediaType.startsWith("video/")
						? "video"
						: part.mediaType.startsWith("audio/")
							? "audio"
							: "file";
				const name = part.filename ? ` "${part.filename}"` : "";
				// NO pixel size here on purpose: nothing on the persisted file
				// part carries the upload's intrinsic width/height, so any number
				// printed would be invented. The builder prompts tell the model to
				// size user photos with CSS rather than guess an attribute.
				const marker = `[Attached ${kind}${name} (${part.mediaType}): ${part.url}]`;

				// Audio and video URLs are forwarded to connector tools, but their raw
				// file parts must never be sent to the model provider.
				if (kind === "video" || kind === "audio") {
					return [{ text: marker, type: "text" }];
				}

				if (!MODEL_SAFE_MEDIA_TYPES(part.mediaType)) {
					return [
						{
							text: `${marker} Use the read_attachment tool with this URL to read its contents.`,
							type: "text",
						},
					];
				}

				return [part, { text: marker, type: "text" }];
			},
		);

		return { ...message, parts };
	});
}
