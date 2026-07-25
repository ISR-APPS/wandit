import type { WanditUIMessage } from "./chat-agent";

/**
 * A user file part reaches the model as opaque visual content — the model can
 * SEE the image but cannot read (or quote) its URL, so it has no way to pass
 * the attachment to generate_image.sourceImageUrls or animate_image. That made
 * the agent ask for a photo the user had already attached. Follow every user
 * file part with a text marker exposing the exact URL as readable text.
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

				return [
					part,
					{
						text: `[Attached ${kind}${name} (${part.mediaType}): ${part.url}]`,
						type: "text",
					},
				];
			},
		);

		return { ...message, parts };
	});
}
