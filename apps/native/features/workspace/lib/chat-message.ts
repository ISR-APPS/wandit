import type {
	AskUserInput,
	AskUserOutput,
	ChatMessage,
	MessageRole,
} from "@wandit/contracts";
import { askUserOutputSchema } from "@wandit/contracts";

export type ChatThreadMessage = {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	/** ask_user tool parts of this message, in part order (assistant only). */
	asks?: AskUserThreadPart[];
};

export function extractChatMessageText(parts: ChatMessage["parts"]) {
	let text = "";

	for (const part of parts) {
		if (
			part &&
			typeof part === "object" &&
			(part as { type?: unknown }).type === "text"
		) {
			const value = (part as { text?: unknown }).text;
			if (typeof value === "string") {
				text += value;
			}
		}
	}

	return text;
}

/* ---------- ask_user tool parts ----------
   Persisted parts are loose JSON (the contracts keep them untyped at the API
   boundary), but the AI SDK writes a stable shape for tool calls. This narrows
   just enough of it for the thread + request tray: the call identity, its
   lifecycle state, and the ask contract types from @wandit/contracts. */

export type AskUserPartState =
	| "input-streaming"
	| "input-available"
	| "output-available"
	| "output-error";

export type AskUserThreadPart = {
	toolCallId: string;
	state: AskUserPartState;
	input?: AskUserInput;
	output?: AskUserOutput;
};

const ASK_STATES: AskUserPartState[] = [
	"input-streaming",
	"input-available",
	"output-available",
	"output-error",
];

/** All ask_user parts of one message, malformed entries dropped. */
export function parseAskUserParts(
	parts: ChatMessage["parts"],
): AskUserThreadPart[] {
	const asks: AskUserThreadPart[] = [];

	for (const part of parts) {
		if (!part || typeof part !== "object") continue;
		const record = part as Record<string, unknown>;
		if (record.type !== "tool-ask_user") continue;
		if (typeof record.toolCallId !== "string" || !record.toolCallId) continue;
		const state = ASK_STATES.find((item) => item === record.state);
		if (!state) continue;

		const output = askUserOutputSchema.safeParse(record.output);
		asks.push({
			toolCallId: record.toolCallId,
			state,
			// Lenient by design: a streaming input is half-parsed JSON, and the
			// tray must still show the question growing. The strict schema would
			// reject it wholesale.
			input: parseAskInput(record.input),
			output: output.success ? output.data : undefined,
		});
	}

	return asks;
}

/** Field-by-field read of the ask input — keeps whatever is valid. */
function parseAskInput(raw: unknown): AskUserInput | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;

	const question = typeof record.question === "string" ? record.question : "";
	const helper = typeof record.helper === "string" ? record.helper : undefined;
	const kind =
		record.kind === "single-choice" ||
		record.kind === "multi-select" ||
		record.kind === "free-text"
			? record.kind
			: undefined;

	const options: AskUserInput["options"] = [];
	if (Array.isArray(record.options)) {
		for (const option of record.options) {
			if (!option || typeof option !== "object") continue;
			const { id, label } = option as Record<string, unknown>;
			if (typeof id === "string" && id && typeof label === "string" && label) {
				options.push({ id, label });
			}
		}
	}

	return { question, options, kind, helper };
}
