import type { AskUserInput, AskUserOutput } from "@wandit/contracts";
import { ATTACHMENT_MEDIA_TYPES, askUserOutputSchema } from "@wandit/contracts";

export type ChatMessageLike = {
	id: string;
	role: string;
	parts: readonly unknown[];
};

export type MessagePartRecord = Record<string, unknown> & { type: string };

export const TRANSPARENT_PART_TYPES = new Set([
	"step-start",
	"reasoning",
	"tool-read_skill",
	"tool-read_attachment",
	"tool-get_direction_candidates",
	"tool-get_page_outline",
	"tool-apply_element_ops",
	"tool-read_elements",
	"tool-read_theme",
	"tool-read_section",
	"tool-insert_section",
	"tool-replace_section",
	// Consumed as a side channel by use-ai-chat's billing latch — never inline.
	"data-billing-error",
]);

export const ASYNC_CARD_PART_TYPES = new Set([
	"tool-generate_page",
	"tool-generate_marketing_asset",
	"tool-generate_image",
	"tool-scrape_leads",
	"tool-animate_image",
	"tool-generate_video",
]);

export const VISIBLE_PART_TYPES = new Set([
	"text",
	"file",
	"tool-ask_user",
	...ASYNC_CARD_PART_TYPES,
	"dynamic-tool",
]);

const TOOL_PART_STATES = new Set([
	"input-streaming",
	"input-available",
	"approval-requested",
	"approval-responded",
	"output-available",
	"output-error",
	"output-denied",
]);

const TERMINAL_TOOL_STATES = new Set([
	"output-available",
	"output-error",
	"output-denied",
]);

const ASYNC_RENDER_STATES = new Set([
	"input-streaming",
	"input-available",
	"output-available",
	"output-error",
]);

export function asMessagePart(value: unknown): MessagePartRecord | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	return typeof record.type === "string" ? (record as MessagePartRecord) : null;
}

export function isTransparentMessagePart(value: unknown): boolean {
	const part = asMessagePart(value);
	return part ? TRANSPARENT_PART_TYPES.has(part.type) : false;
}

export function isAsyncCardPart(value: unknown): boolean {
	const part = asMessagePart(value);
	return part ? ASYNC_CARD_PART_TYPES.has(part.type) : false;
}

export function extractChatMessageText(parts: readonly unknown[]) {
	let text = "";
	for (const value of parts) {
		const part = asMessagePart(value);
		if (part?.type === "text" && typeof part.text === "string") {
			text += part.text;
		}
	}
	return text;
}

export type FileThreadPart = {
	mediaType: string;
	filename?: string;
	url: string;
};

export function parseFilePart(value: unknown): FileThreadPart | null {
	const part = asMessagePart(value);
	if (
		part?.type !== "file" ||
		typeof part.mediaType !== "string" ||
		typeof part.url !== "string"
	) {
		return null;
	}
	return {
		mediaType: part.mediaType,
		url: part.url,
		filename: typeof part.filename === "string" ? part.filename : undefined,
	};
}

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
	index: number;
};

const ASK_STATES = new Set<AskUserPartState>([
	"input-streaming",
	"input-available",
	"output-available",
	"output-error",
]);

export function parseAskUserParts(
	parts: readonly unknown[],
): AskUserThreadPart[] {
	const asks: AskUserThreadPart[] = [];

	for (const [index, value] of parts.entries()) {
		const part = asMessagePart(value);
		if (
			part?.type !== "tool-ask_user" ||
			typeof part.toolCallId !== "string" ||
			!part.toolCallId ||
			typeof part.state !== "string" ||
			!ASK_STATES.has(part.state as AskUserPartState)
		) {
			continue;
		}

		const output = askUserOutputSchema.safeParse(part.output);
		asks.push({
			toolCallId: part.toolCallId,
			state: part.state as AskUserPartState,
			input: parseAskInput(part.input),
			output: output.success ? output.data : undefined,
			index,
		});
	}

	return asks;
}

function parseAskInput(raw: unknown): AskUserInput | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const question = typeof record.question === "string" ? record.question : "";
	const helper = typeof record.helper === "string" ? record.helper : undefined;
	const kind =
		record.kind === "single-choice" ||
		record.kind === "multi-select" ||
		record.kind === "free-text" ||
		record.kind === "attachments"
			? record.kind
			: undefined;

	const options: AskUserInput["options"] = [];
	if (Array.isArray(record.options)) {
		for (const option of record.options) {
			if (!option || typeof option !== "object") continue;
			const { id, label, worldId } = option as Record<string, unknown>;
			if (typeof id === "string" && id && typeof label === "string" && label) {
				options.push({
					id,
					label,
					// Design-world taste cards resolve this against the latest
					// get_direction_candidates output — dropping it kills the cards.
					...(typeof worldId === "string" && worldId ? { worldId } : {}),
				});
			}
		}
	}

	// Attachments-ask fields — a streaming input is DeepPartial, so every
	// entry is re-checked instead of trusted.
	const accept: NonNullable<AskUserInput["accept"]> = [];
	if (Array.isArray(record.accept)) {
		for (const entry of record.accept) {
			if (entry === "image" || entry === "document") accept.push(entry);
		}
	}
	const mediaTypes: NonNullable<AskUserInput["mediaTypes"]> = [];
	if (Array.isArray(record.mediaTypes)) {
		for (const entry of record.mediaTypes) {
			if (
				typeof entry === "string" &&
				(ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(entry)
			) {
				mediaTypes.push(entry as (typeof mediaTypes)[number]);
			}
		}
	}
	const maxFiles =
		typeof record.maxFiles === "number" && Number.isFinite(record.maxFiles)
			? record.maxFiles
			: undefined;

	return {
		question,
		options,
		kind,
		helper,
		...(accept.length > 0 ? { accept } : {}),
		...(mediaTypes.length > 0 ? { mediaTypes } : {}),
		...(maxFiles !== undefined ? { maxFiles } : {}),
	};
}

export type MessagePartRenderEntry =
	| { kind: "part"; part: MessagePartRecord; index: number }
	| {
			kind: "mcp-run";
			parts: MessagePartRecord[];
			firstIndex: number;
			/** Which half of the run this entry renders: the receipt rows keep
			 * their own lifecycle spot while background-generation cards move to
			 * the bottom of the turn as a separate "deliverables" entry. */
			section: "receipt" | "deliverables";
	  }
	| {
			kind: "ask-run";
			parts: MessagePartRecord[];
			firstIndex: number;
	  }
	| {
			/** Consecutive image attachments fuse into one grid (web parity). */
			kind: "image-run";
			parts: MessagePartRecord[];
			firstIndex: number;
	  };

function isImageFilePart(part: MessagePartRecord | null): boolean {
	return (
		part?.type === "file" &&
		typeof part.mediaType === "string" &&
		part.mediaType.startsWith("image/")
	);
}

// Consecutive parts of these types fuse into one run entry — transparent
// parts (step-start, reasoning, context tools) in between don't break the
// run, so one round of questions or tool calls renders as one card.
const RUN_KINDS = {
	"dynamic-tool": "mcp-run",
	"tool-ask_user": "ask-run",
} as const;

export function coalesceMessageParts(
	parts: readonly unknown[],
): MessagePartRenderEntry[] {
	const entries: MessagePartRenderEntry[] = [];
	let index = 0;

	while (index < parts.length) {
		const part = asMessagePart(parts[index]);
		if (!part) {
			index += 1;
			continue;
		}

		if (isImageFilePart(part)) {
			const firstIndex = index;
			const runParts: MessagePartRecord[] = [part];
			let cursor = index + 1;
			while (cursor < parts.length) {
				const candidate = asMessagePart(parts[cursor]);
				if (!isImageFilePart(candidate)) break;
				runParts.push(candidate as MessagePartRecord);
				cursor += 1;
			}
			entries.push({ kind: "image-run", parts: runParts, firstIndex });
			index = cursor;
			continue;
		}

		const runKind = RUN_KINDS[part.type as keyof typeof RUN_KINDS];
		if (!runKind) {
			entries.push({ kind: "part", part, index });
			index += 1;
			continue;
		}

		const runParts = [part];
		const firstIndex = index;
		let cursor = index + 1;

		while (cursor < parts.length) {
			const candidate = asMessagePart(parts[cursor]);
			if (candidate?.type === part.type) {
				runParts.push(candidate);
				cursor += 1;
				continue;
			}
			if (!candidate || !isTransparentMessagePart(candidate)) break;

			let nextIndex = cursor + 1;
			while (isTransparentMessagePart(parts[nextIndex])) nextIndex += 1;
			const next = asMessagePart(parts[nextIndex]);
			if (next?.type !== part.type) break;
			runParts.push(next);
			cursor = nextIndex + 1;
		}

		if (runKind === "mcp-run") {
			entries.push({
				kind: runKind,
				parts: runParts,
				firstIndex,
				section: "receipt",
			});
		} else {
			entries.push({ kind: runKind, parts: runParts, firstIndex });
		}
		index = cursor;
	}

	return entries;
}

/** Whether the run queued background generations (the server intercept's
 * `wandit_background_generation` outputs) — those render as live cards at
 * the bottom of the turn, in a separate "deliverables" entry. */
export function mcpRunHasDeliverables(parts: readonly unknown[]): boolean {
	return parts.some((value) => {
		const part = asMessagePart(value);
		if (part?.type !== "dynamic-tool" || part.state !== "output-available") {
			return false;
		}
		const output = part.output;
		if (!output || typeof output !== "object" || Array.isArray(output)) {
			return false;
		}
		const record = output as Record<string, unknown>;
		return (
			record.kind === "wandit_background_generation" &&
			typeof record.attemptId === "string" &&
			Boolean(record.attemptId)
		);
	});
}

/** A part that takes over the turn's narrative after a tool run — prose with
 * content, a question round, another tool call, a file, an async card. Once
 * one of these renders after a run, the coalescer guarantees no further call
 * can join that run: it is concluded. */
export function partConcludesRun(value: unknown): boolean {
	const part = asMessagePart(value);
	if (!part) return false;
	if (part.type === "text") {
		return typeof part.text === "string" && part.text.length > 0;
	}
	return (
		part.type === "tool-ask_user" ||
		part.type === "dynamic-tool" ||
		part.type === "file" ||
		ASYNC_CARD_PART_TYPES.has(part.type)
	);
}

/** Every call in the run reached a terminal state (success, error, or
 * denied). Only such runs fold to the bottom of a finished message — a run
 * still mid-approval or mid-flight keeps its chronological spot, so the card
 * never jumps bottom→top when the stream resumes after an Approve click. */
export function isMcpRunSettled(parts: readonly unknown[]): boolean {
	let sawToolPart = false;
	for (const value of parts) {
		const part = asMessagePart(value);
		if (
			part?.type !== "dynamic-tool" ||
			typeof part.state !== "string" ||
			!TOOL_PART_STATES.has(part.state)
		) {
			continue;
		}
		sawToolPart = true;
		if (!TERMINAL_TOOL_STATES.has(part.state)) return false;
	}
	return sawToolPart;
}

/**
 * Stable partition: conversational entries first, async deliverable cards
 * after. An MCP run with background generations contributes to BOTH halves —
 * a second entry carries its live cards to the bottom of the turn. Receipt
 * placement follows the turn's lifecycle (web parity, the ChatGPT/Claude
 * pattern): while the turn STREAMS the tool receipts stay chronological,
 * narrating the work as it happens; once the turn is done
 * (`receiptsAtBottom`) fully-settled runs fold to the very bottom of the
 * message — after the prose and the deliverables — like a sources footer.
 */
export function orderMessagePartEntries(
	entries: MessagePartRenderEntry[],
	{ receiptsAtBottom = false }: { receiptsAtBottom?: boolean } = {},
): MessagePartRenderEntry[] {
	const withDeliverables = entries.flatMap<MessagePartRenderEntry>((entry) =>
		entry.kind === "mcp-run" && mcpRunHasDeliverables(entry.parts)
			? [entry, { ...entry, section: "deliverables" as const }]
			: [entry],
	);

	const conversational: MessagePartRenderEntry[] = [];
	const asyncCards: MessagePartRenderEntry[] = [];
	const foldedReceipts: MessagePartRenderEntry[] = [];

	for (const entry of withDeliverables) {
		if (entry.kind === "mcp-run" && entry.section === "deliverables") {
			asyncCards.push(entry);
		} else if (
			receiptsAtBottom &&
			entry.kind === "mcp-run" &&
			isMcpRunSettled(entry.parts)
		) {
			foldedReceipts.push(entry);
		} else if (entry.kind === "part" && isAsyncCardPart(entry.part)) {
			asyncCards.push(entry);
		} else {
			conversational.push(entry);
		}
	}
	return [...conversational, ...asyncCards, ...foldedReceipts];
}

export function entryRendersContent(entry: MessagePartRenderEntry): boolean {
	if (entry.kind === "mcp-run") {
		return entry.parts.some(
			(part) =>
				typeof part.toolName === "string" &&
				typeof part.toolCallId === "string" &&
				typeof part.state === "string" &&
				TOOL_PART_STATES.has(part.state),
		);
	}
	if (entry.kind === "ask-run") {
		return parseAskUserParts(entry.parts).length > 0;
	}
	if (entry.kind === "image-run") {
		return entry.parts.some((part) => parseFilePart(part) !== null);
	}
	const { part } = entry;
	if (part.type === "text") {
		return typeof part.text === "string" && part.text.length > 0;
	}
	if (part.type === "file") return parseFilePart(part) !== null;
	return (
		ASYNC_CARD_PART_TYPES.has(part.type) &&
		typeof part.state === "string" &&
		ASYNC_RENDER_STATES.has(part.state)
	);
}

export function assistantTurnHasThinkingDismissal(
	message: ChatMessageLike | undefined,
): boolean {
	if (message?.role !== "assistant") return false;
	return message.parts.some((value) => {
		const part = asMessagePart(value);
		if (!part) return false;
		if (part.type === "text") {
			return typeof part.text === "string" && part.text.length > 0;
		}
		if (part.type === "tool-ask_user") {
			return parseAskUserParts([part]).length > 0;
		}
		if (part.type === "dynamic-tool") {
			return (
				typeof part.toolName === "string" &&
				typeof part.toolCallId === "string" &&
				typeof part.state === "string" &&
				TOOL_PART_STATES.has(part.state)
			);
		}
		return (
			ASYNC_CARD_PART_TYPES.has(part.type) &&
			typeof part.state === "string" &&
			ASYNC_RENDER_STATES.has(part.state)
		);
	});
}
