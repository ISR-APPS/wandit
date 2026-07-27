import type { ImagePart, ModelMessage, ToolResultPart } from "ai";

/**
 * Some providers (Moonshot/Kimi via the gateway) reject image parts inside
 * tool results: the base64 falls through as plain text and explodes the
 * context (a single generated image ≈ millions of text tokens). Kimi IS
 * vision-capable — but only reads images from USER messages, as base64.
 *
 * The fix is relocation, not removal: before each model call, strip file
 * parts out of tool results and re-deliver them as a user message right
 * after the tool block, so the model still SEES what its tools produced.
 * Wired as a `prepareStep` override only for models that need it.
 */

type ContentOutput = Extract<ToolResultPart["output"], { type: "content" }>;
type ContentEntry = ContentOutput["value"][number];
type FileEntry = Extract<ContentEntry, { type: "file" }>;

const RELOCATED_NOTE =
	"(image moved to the user message right after this tool block — " +
	"inspect it there)";

const STRIPPED_NOTE =
	"(image omitted — this model is text-only; place the asset using the URL " +
	"from the text line above)";

export function modelNeedsToolImageRelocation(model: string): boolean {
	// Qwen (alibaba) and Inkling (thinkingmachines) are vision-capable but
	// silently DROP images inside tool results — live probes answered the
	// wrong color for a solid-red image delivered that way, yet read the
	// same image fine from a user message.
	return (
		model.startsWith("moonshotai/") ||
		model.startsWith("alibaba/") ||
		model.startsWith("thinkingmachines/")
	);
}

/**
 * Text-only models (DeepSeek) reject image parts no matter where they sit,
 * so relocation cannot help — the image entries are dropped outright and the
 * tool result keeps only its text lines (which carry the hosted URL, all the
 * model needs to place the asset in HTML).
 */
export function modelNeedsToolImageStripping(model: string): boolean {
	return model.startsWith("deepseek/");
}

/**
 * Same idempotence contract as relocateToolResultImages: returns the SAME
 * array reference when no tool result carried an image.
 */
export function stripToolResultImages(
	messages: Array<ModelMessage>,
): Array<ModelMessage> {
	let changed = false;

	const out = messages.map((message) => {
		if (message.role !== "tool") {
			return message;
		}

		const extracted = extractImages(message, STRIPPED_NOTE);

		if (extracted.images.length > 0) {
			changed = true;
		}

		return extracted.message;
	});

	return changed ? out : messages;
}

/**
 * Idempotent: relocated tool results no longer carry file parts, so a
 * second pass finds nothing and returns the SAME array reference — callers
 * use that to skip the prepareStep messages override when nothing changed.
 */
export function relocateToolResultImages(
	messages: Array<ModelMessage>,
): Array<ModelMessage> {
	const out: Array<ModelMessage> = [];
	let pending: Array<{ image: ImagePart; label: string }> = [];
	let changed = false;

	const flush = () => {
		if (pending.length === 0) {
			return;
		}

		out.push({
			content: [
				{
					text:
						"Images produced by your tool calls above (this model reads " +
						"images from user messages only):",
					type: "text",
				},
				...pending.flatMap(({ image, label }) => [
					{ text: label, type: "text" as const },
					image,
				]),
			],
			role: "user",
		});
		pending = [];
	};

	for (const message of messages) {
		if (message.role !== "tool") {
			flush();
			out.push(message);
			continue;
		}

		const extracted = extractImages(message, RELOCATED_NOTE);
		out.push(extracted.message);

		if (extracted.images.length > 0) {
			changed = true;
			pending.push(...extracted.images);
		}
	}
	flush();

	return changed ? out : messages;
}

function extractImages(
	message: Extract<ModelMessage, { role: "tool" }>,
	note: string,
): {
	images: Array<{ image: ImagePart; label: string }>;
	message: ModelMessage;
} {
	const images: Array<{ image: ImagePart; label: string }> = [];

	const content = message.content.map((part) => {
		if (part.type !== "tool-result" || part.output.type !== "content") {
			return part;
		}

		const kept: Array<ContentEntry> = [];

		for (const entry of part.output.value) {
			if (!isRelocatableImage(entry)) {
				kept.push(entry);
				continue;
			}

			images.push({
				image: {
					image: entry.data.data,
					mediaType: entry.mediaType,
					type: "image",
				},
				label: `From ${part.toolName} (call ${part.toolCallId}):`,
			});
			kept.push({ text: note, type: "text" });
		}

		return images.length > 0
			? { ...part, output: { ...part.output, value: kept } }
			: part;
	});

	return {
		images,
		message: images.length > 0 ? { ...message, content } : message,
	};
}

function isRelocatableImage(
	entry: ContentEntry,
): entry is FileEntry & { data: { data: string; type: "data" } } {
	return (
		entry.type === "file" &&
		entry.mediaType.startsWith("image/") &&
		typeof entry.data === "object" &&
		entry.data.type === "data" &&
		typeof entry.data.data === "string"
	);
}
