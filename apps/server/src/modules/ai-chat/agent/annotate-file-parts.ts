import type { WanditUIMessage } from "./chat-agent";

// What a provider can actually take as a raw file part. Everything else
// (docx, xlsx, csv) reaches the model through read_attachment instead.
const MODEL_SAFE_MEDIA_TYPES = (mediaType: string): boolean =>
	mediaType.startsWith("image/") ||
	mediaType === "application/pdf" ||
	mediaType === "text/plain";

/**
 * A user file part reaches the model as opaque visual content — the model can
 * SEE the image but cannot read (or quote) its URL, so it has no way to pass
 * the attachment to generate_image.sourceImageUrls or animate_image. That made
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

				const kind = part.mediaType.startsWith("image/") ? "image" : "file";
				const name = part.filename ? ` "${part.filename}"` : "";
				const marker = `[Attached ${kind}${name} (${part.mediaType}): ${part.url}]`;

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
