import {
	type ChatStreamEvent,
	chatStreamEventSchema,
} from "@wandit/contracts";

export type SseEventFrame = {
	id?: string;
	event: string;
	data: string;
};

export type SseParser = {
	push: (chunk: string) => SseEventFrame[];
	flush: () => SseEventFrame[];
	getLastEventId: () => string | undefined;
};

const LAST_EVENT_ID_PATTERN = /^\d+-\d+$/;

/**
 * Incremental SSE parser.
 *
 * It accepts arbitrary text chunks, tolerates CRLF line endings, ignores
 * comment/heartbeat lines, joins multi-line data fields with "\n", and keeps
 * the latest id field for reconnects.
 */
export function createSseParser(): SseParser {
	let buffer = "";
	let lastEventId: string | undefined;
	let pendingCarriageReturn = false;

	const parseCompleteFrame = (rawFrame: string) => {
		const frameId = readFrameId(rawFrame);
		if (frameId !== undefined) {
			lastEventId = frameId;
		}

		return parseSseFrame(rawFrame);
	};

	return {
		push(chunk: string) {
			buffer += normalizeChunk(chunk);
			const completedBySeparator = /\n\n+$/.test(buffer);
			const parts = buffer.split(/\n\n+/);
			buffer = completedBySeparator ? "" : (parts.pop() ?? "");

			return parts
				.map(parseCompleteFrame)
				.filter((frame): frame is SseEventFrame => frame !== null);
		},
		flush() {
			if (pendingCarriageReturn) {
				buffer += "\n";
				pendingCarriageReturn = false;
			}
			const tail = buffer;
			buffer = "";
			if (!tail.trim()) return [];
			const frame = parseCompleteFrame(tail);
			return frame ? [frame] : [];
		},
		getLastEventId() {
			return lastEventId;
		},
	};

	function normalizeChunk(chunk: string) {
		let value = pendingCarriageReturn ? `\r${chunk}` : chunk;
		pendingCarriageReturn = value.endsWith("\r");
		if (pendingCarriageReturn) {
			value = value.slice(0, -1);
		}

		return normalizeLineEndings(value);
	}
}

export function parseSseFrame(rawFrame: string): SseEventFrame | null {
	const dataLines: string[] = [];
	let event = "message";
	let id: string | undefined;
	let sawEvent = false;
	let sawData = false;

	for (const line of normalizeLineEndings(rawFrame).split("\n")) {
		if (!line || line.startsWith(":")) {
			continue;
		}

		const separatorIndex = line.indexOf(":");
		const field =
			separatorIndex === -1 ? line : line.slice(0, separatorIndex);
		const value = normalizeFieldValue(
			separatorIndex === -1 ? "" : line.slice(separatorIndex + 1),
		);

		if (field === "event") {
			event = value || "message";
			sawEvent = true;
			continue;
		}

		if (field === "data") {
			dataLines.push(value);
			sawData = true;
			continue;
		}

		if (field === "id" && !value.includes("\0")) {
			id = value;
		}
	}

	if (!sawEvent && !sawData) {
		return null;
	}

	return {
		id,
		event,
		data: dataLines.join("\n"),
	};
}

export function isValidLastEventId(value: string | undefined): value is string {
	return Boolean(value && LAST_EVENT_ID_PATTERN.test(value));
}

export function parseChatStreamEventFrame(
	frame: SseEventFrame,
): ChatStreamEvent | null {
	try {
		const payload = frame.data ? (JSON.parse(frame.data) as unknown) : {};
		if (
			payload &&
			typeof payload === "object" &&
			"type" in payload &&
			(payload as { type?: unknown }).type !== frame.event
		) {
			return null;
		}

		const candidate =
			payload && typeof payload === "object"
				? { ...(payload as Record<string, unknown>), type: frame.event }
				: { type: frame.event };
		const result = chatStreamEventSchema.safeParse(candidate);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

function readFrameId(rawFrame: string) {
	for (const line of normalizeLineEndings(rawFrame).split("\n")) {
		if (!line || line.startsWith(":")) {
			continue;
		}

		const separatorIndex = line.indexOf(":");
		const field =
			separatorIndex === -1 ? line : line.slice(0, separatorIndex);
		if (field !== "id") {
			continue;
		}

		const value = normalizeFieldValue(
			separatorIndex === -1 ? "" : line.slice(separatorIndex + 1),
		);
		return value.includes("\0") ? undefined : value;
	}

	return undefined;
}

function normalizeLineEndings(value: string) {
	return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeFieldValue(value: string) {
	return value.startsWith(" ") ? value.slice(1) : value;
}
