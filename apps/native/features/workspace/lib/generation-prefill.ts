export type GenerationPromptKind =
	| "page"
	| "marketing"
	| "image"
	| "leads"
	| "connector";

const ORIGINAL_PROMPT_KEYS = [
	"prompt",
	"brief",
	"instruction",
	"continuationBrief",
] as const;
const CONNECTOR_PROMPT_KEYS = [
	...ORIGINAL_PROMPT_KEYS,
	"description",
	"text",
] as const;

/** Reads only the owning tool call's user-facing input. Durable attempt.prompt
 * can be a provider/director rewrite and must never be copied into composer. */
export function originalGenerationPrompt(
	kind: GenerationPromptKind,
	input: unknown,
): string | undefined {
	switch (kind) {
		case "image":
			return readOriginalPromptField(input, ["prompt"]);
		case "marketing":
			return readOriginalPromptField(input, ["brief"]);
		case "connector":
			return readConnectorOriginalPrompt(input);
		case "page":
		case "leads":
			return undefined;
	}
}

function readOriginalPromptField(
	value: unknown,
	keys: readonly string[],
): string | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	for (const key of keys) {
		const candidate = record[key];
		if (typeof candidate === "string" && candidate.trim()) return candidate;
	}
	return undefined;
}

function readConnectorOriginalPrompt(
	value: unknown,
	depth = 0,
): string | undefined {
	if (depth > 3) return undefined;
	if (typeof value === "string") {
		try {
			return readConnectorOriginalPrompt(JSON.parse(value), depth + 1);
		} catch {
			return undefined;
		}
	}

	const direct = readOriginalPromptField(value, CONNECTOR_PROMPT_KEYS);
	if (direct) return direct;
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}

	const record = value as Record<string, unknown>;
	for (const key of ["params", "arguments", "input"] as const) {
		const nested = readConnectorOriginalPrompt(record[key], depth + 1);
		if (nested) return nested;
	}
	return undefined;
}
