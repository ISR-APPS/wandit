import type { ChatMessage } from "@/features/conversations/api/conversations.dto";

export function messageHasFailure(message: ChatMessage): boolean {
	if (message.failure) {
		return true;
	}

	return message.parts.some(partHasFailureSignal);
}

export function partHasFailureSignal(part: unknown): boolean {
	if (!isRecord(part)) {
		return false;
	}

	if (part.type === "data-ai-error") {
		return true;
	}

	if (
		part.state === "output-error" ||
		part.state === "output-denied" ||
		part.state === "failed" ||
		hasValue(part.aiError) ||
		hasValue(part.error) ||
		hasValue(part.errorText)
	) {
		return true;
	}

	const output = isRecord(part.output) ? part.output : null;
	return Boolean(
		output &&
			(output.status === "failed" ||
				output.isError === true ||
				hasValue(output.wanditError) ||
				hasValue(output.aiError) ||
				hasValue(output.error) ||
				hasValue(output.errorText)),
	);
}

function hasValue(value: unknown): boolean {
	return (
		value !== null && value !== undefined && value !== false && value !== ""
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
