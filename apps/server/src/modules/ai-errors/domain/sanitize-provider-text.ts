import type { AiErrorKind } from "@wandit/contracts";

const DEFAULT_MAX_LENGTH = 240;
const MIN_TEXT_LENGTH = 4;

const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/giu;
const HOST_PORT_PATTERN =
	/\b(?:localhost|(?:[a-z0-9-]+\.)+[a-z]{2,}|(?:\d{1,3}\.){3}\d{1,3}):\d{2,5}\b/giu;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const BEARER_PATTERN = /\bBearer\s+\S+/giu;
const TOKEN_ASSIGNMENT_PATTERN =
	/\b(?:access_token|refresh_token|api[_-]?key)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s&;,]+)/giu;
const JSON_CREDENTIAL_PATTERN =
	/"(?:access_token|refresh_token|authorization|api[_-]?key|token)"\s*:\s*"(?:\\.|[^"\\])*"/giu;
const PREFIXED_CREDENTIAL_PATTERN =
	/\b(?:ya29\.|EAA|(?:sk|pk|rk|ghp|xox[baprs])[-_])[A-Za-z0-9._~-]+/giu;
const STACK_LINE_PATTERN = /^\s*at\s+/u;
const SUPPORT_CODE_PATTERN = /\s*Support codes?:[\s\S]*$/iu;
const TRAILING_GATEWAY_GENERATION_ID_PATTERN = /\s*\[gen_[A-Za-z0-9]+\]\s*$/u;

export const HIGGSFIELD_NSFW_MESSAGE =
	"Input or output was rejected by content moderation.";
export const HIGGSFIELD_CREDITS_MESSAGE =
	"Your Higgsfield workspace is out of credits.";
export const HIGGSFIELD_PLAN_MESSAGE =
	"This Higgsfield tool needs a higher Higgsfield plan.";

export const MODERATION_CATEGORY_LABELS = {
	harassment: "harassment",
	"harassment threatening": "threatening harassment",
	hate: "hate",
	"hate threatening": "threatening hate",
	illicit: "illicit activity",
	"illicit violent": "violent illicit activity",
	"self harm": "self-harm",
	"self harm instructions": "self-harm",
	"self harm intent": "self-harm",
	sexual: "sexual content",
	"sexual content": "sexual content",
	"sexual minors": "sexual content involving minors",
	violence: "violence",
	"graphic violence": "graphic violence",
	"violence graphic": "graphic violence",
} as const;

export type SanitizeProviderTextOptions = {
	kind: AiErrorKind;
	provider: string | null;
	connectorSlug?: string;
	maxLength?: number;
};

export function sanitizeProviderText(
	text: string,
	options: SanitizeProviderTextOptions,
): string | null {
	if (!isForwardKind(options.kind)) return null;

	const selected = selectProviderText(text);
	if (selected === null) return null;

	const withoutIds = stripRequestIds(selected).replace(
		TRAILING_GATEWAY_GENERATION_ID_PATTERN,
		"",
	);
	const redacted = redactProviderText(withoutIds);
	const collapsed = collapseWhitespace(
		redacted.replace(SUPPORT_CODE_PATTERN, ""),
	);

	if (collapsed.length < MIN_TEXT_LENGTH) return null;

	const allowlisted = applyForwardingPolicy(collapsed, options);
	if (allowlisted === null) return null;

	const maxLength = normalizeMaxLength(options.maxLength);
	const capped = capText(allowlisted, maxLength);

	return capped.length >= MIN_TEXT_LENGTH ? capped : null;
}

export function stripRequestIds(text: string): string {
	return text
		.replace(
			/"(?:provider[_-]?)?request[_-]?id"\s*:\s*"(?:\\.|[^"\\])*"\s*,?/giu,
			"",
		)
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

export function looksLikeCredential(value: string): boolean {
	const candidate = value
		.trim()
		.replace(/^[\s("'[{]+/u, "")
		.replace(/[\s)"'\]},;]+$/u, "");
	if (candidate === "SensitiveContentDetected") return false;

	return (
		/^(?:Bearer\s+|access_token\s*=|refresh_token\s*=|api[_-]?key\s*=)/iu.test(
			candidate,
		) ||
		/^(?:ya29\.|EAA)[A-Za-z0-9._~-]+/u.test(candidate) ||
		/^(?:sk|pk|rk|ghp|xox[baprs])[-_]/iu.test(candidate) ||
		/^[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}$/u.test(
			candidate,
		) ||
		(candidate.length >= 24 && /^[A-Za-z0-9]+$/u.test(candidate))
	);
}

export function redactProviderText(text: string): string {
	const withoutLocations = text
		.replace(URL_PATTERN, "")
		.replace(HOST_PORT_PATTERN, "")
		.replace(EMAIL_PATTERN, "")
		.replace(BEARER_PATTERN, "")
		.replace(TOKEN_ASSIGNMENT_PATTERN, "")
		.replace(JSON_CREDENTIAL_PATTERN, "")
		.replace(PREFIXED_CREDENTIAL_PATTERN, "");

	return withoutLocations
		.split(/\r?\n/u)
		.filter(
			(line) =>
				!STACK_LINE_PATTERN.test(line) && !line.includes("node_modules/"),
		)
		.map((line) =>
			line
				.split(/(\s+)/u)
				.filter((token) => /^\s+$/u.test(token) || !looksLikeCredential(token))
				.join(""),
		)
		.join("\n");
}

export function sanitizeModerationCategories(values: unknown): string | null {
	if (!Array.isArray(values)) return null;

	const labels = new Set<string>();
	for (const value of values) {
		if (typeof value !== "string") continue;

		const key = normalizeModerationCategory(value);
		const label =
			MODERATION_CATEGORY_LABELS[
				key as keyof typeof MODERATION_CATEGORY_LABELS
			];
		if (label) labels.add(label);
	}

	return labels.size > 0 ? [...labels].join(", ") : null;
}

function selectProviderText(text: string): string | null {
	const trimmed = text.trim();
	if (trimmed.length === 0) return null;

	try {
		return selectJsonText(JSON.parse(trimmed));
	} catch {
		return (
			trimmed
				.split(/\r?\n/u)
				.map((line) => line.trim())
				.find((line) => line.length > 0) ?? null
		);
	}
}

function selectJsonText(value: unknown): string | null {
	if (!isRecord(value)) return null;

	const error = value.error;
	const candidates: unknown[] = [
		isRecord(error) ? error.message : null,
		value.message,
		value.task_status_msg,
		value.detail,
	];

	if (Array.isArray(value.content)) {
		const firstText = value.content.find(
			(item) => isRecord(item) && typeof item.text === "string",
		);
		candidates.push(isRecord(firstText) ? firstText.text : null);
	}

	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim().length > 0) {
			return candidate;
		}
	}

	return null;
}

function applyForwardingPolicy(
	text: string,
	options: SanitizeProviderTextOptions,
): string | null {
	const provider = normalizeProvider(options.provider);
	const connectorSlug = options.connectorSlug?.trim().toLowerCase();

	if (options.kind === "content_moderated") {
		if (provider === "higgsfield") return HIGGSFIELD_NSFW_MESSAGE;
		if (provider === "google") return null;

		if (provider === "openai" || provider === "openrouter") {
			return sanitizeModerationCategories(splitCategoryText(text));
		}

		return sanitizeModerationCategories(splitCategoryText(text));
	}

	if (options.kind === "connector_account") {
		if (connectorSlug !== "higgsfield" && provider !== "higgsfield") {
			return null;
		}

		return text === HIGGSFIELD_CREDITS_MESSAGE ||
			text === HIGGSFIELD_PLAN_MESSAGE
			? text
			: null;
	}

	if (connectorSlug !== "higgsfield" && provider !== "higgsfield") {
		return null;
	}

	return isHiggsfieldValidationMessage(text) ? text : null;
}

function isHiggsfieldValidationMessage(text: string): boolean {
	return (
		text ===
			"Higgsfield could not read this YouTube video. Check that the link is a public, finished video, then try again." ||
		/^Higgsfield rejected the request \([a-z0-9][a-z0-9 -]{0,100}\)\.$/iu.test(
			text,
		)
	);
}

function splitCategoryText(text: string): string[] {
	return text
		.split(/\s*(?:,|;|\||\band\b)\s*/iu)
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

function normalizeModerationCategory(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[_/-]+/gu, " ")
		.replace(/\s+/gu, " ");
}

function normalizeProvider(provider: string | null): string | null {
	if (provider === null) return null;

	return provider
		.trim()
		.toLowerCase()
		.replace(/^provider:/u, "");
}

function normalizeMaxLength(maxLength: number | undefined): number {
	if (maxLength === undefined || !Number.isFinite(maxLength)) {
		return DEFAULT_MAX_LENGTH;
	}

	return Math.max(1, Math.floor(maxLength));
}

function capText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	if (maxLength === 1) return "…";

	return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function collapseWhitespace(text: string): string {
	return text.replace(/\s+/gu, " ").trim();
}

function isForwardKind(kind: AiErrorKind): boolean {
	return (
		kind === "content_moderated" ||
		kind === "connector_rejected" ||
		kind === "connector_account"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
