export type ProviderRejection = {
	kind: "validation" | "credits" | "plan" | "unknown";
	userMessage: string;
};

const ERROR_TYPE_PATTERN = /"error_type"\s*:\s*"((?:\\.|[^"\\])*)"/iu;
const VALIDATION_ERROR_PATTERN = /\bvalidation error \(4\d{2}\)/iu;

/** Turn expected provider refusals into safe, user-facing verdicts. */
export function classifyProviderRejection(text: string): ProviderRejection {
	const trimmed = text.trim();
	const errorType = VALIDATION_ERROR_PATTERN.test(trimmed)
		? extractErrorType(trimmed)
		: null;

	if (errorType) {
		return {
			kind: "validation",
			userMessage: validationMessage(errorType),
		};
	}

	if (/\bout of credits\b/iu.test(trimmed)) {
		return {
			kind: "credits",
			userMessage: "Your Higgsfield workspace is out of credits.",
		};
	}

	if (/\brequires plus plan\b/iu.test(trimmed)) {
		return {
			kind: "plan",
			userMessage: "This Higgsfield tool needs a higher Higgsfield plan.",
		};
	}

	return {
		kind: "unknown",
		userMessage: stripRequestIds(trimmed),
	};
}

function extractErrorType(text: string): string | null {
	const encoded = ERROR_TYPE_PATTERN.exec(text)?.[1];
	if (!encoded) return null;

	try {
		const parsed: unknown = JSON.parse(`"${encoded}"`);
		return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
	} catch {
		return encoded;
	}
}

function validationMessage(errorType: string): string {
	if (errorType.toLowerCase() === "clipify_duration_unavailable") {
		return "Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again.";
	}

	const humanized = errorType.replace(/_+/gu, " ").trim();
	return `Higgsfield rejected the request (${humanized}).`;
}

function stripRequestIds(text: string): string {
	return text
		.replace(/"request[_-]?id"\s*:\s*"(?:\\.|[^"\\])*"\s*,?/giu, "")
		.replace(
			/^[\t ]*(?:provider[\t ]+)?request[\t _-]*id[\t ]*[:=][\t ]*\S+[\t ]*$/gimu,
			"",
		)
		.replace(
			/[\t ]*[[(]?(?:provider[\t ]+)?request[\t _-]*id[\t ]*[:=][\t ]*[^\s)\]}]+[\])]?/giu,
			"",
		)
		.replace(/\n[\t ]*\n+/gu, "\n")
		.trim();
}
