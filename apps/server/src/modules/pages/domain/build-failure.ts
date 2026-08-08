/**
 * Classify WHY a page build failed while the original error object still
 * exists (the Trigger task's catch), so the chat card can honestly say who
 * broke: the model's provider (429/503/timeouts — not Wandit's fault) or our
 * own pipeline (validation, storage, everything else).
 *
 * Pure functions on purpose — no Nest, no I/O — shared by the Trigger worker
 * bundle and unit tests. The output is the bounded contract enum
 * (pageBuildFailureCodeSchema); raw error text stays in the attempt's
 * `error` column and the Trigger/Sentry logs.
 */
import type { PageBuildFailureCode } from "@wandit/contracts";

/**
 * A build-phase error the task tags itself (storage upload, credit reserve)
 * where the phase — not the error's own shape — decides the classification.
 * The original error rides along as `cause` so logs keep the full story.
 */
export class TaggedBuildError extends Error {
	constructor(
		message: string,
		readonly failureCode: PageBuildFailureCode,
		cause?: unknown,
	) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "TaggedBuildError";
	}
}

const MAX_WALK = 25;

/** Every reachable node: cause chains, RetryError.lastError/.errors, AggregateError. */
function collectErrorNodes(root: unknown): unknown[] {
	const nodes: unknown[] = [];
	const queue: unknown[] = [root];
	const seen = new Set<unknown>();

	while (queue.length > 0 && nodes.length < MAX_WALK) {
		const node = queue.shift();

		if (node === null || node === undefined || seen.has(node)) {
			continue;
		}

		seen.add(node);
		nodes.push(node);

		if (typeof node !== "object") {
			continue;
		}

		const record = node as Record<string, unknown>;
		queue.push(record.cause, record.lastError);

		if (Array.isArray(record.errors)) {
			queue.push(...record.errors);
		}
	}

	return nodes;
}

function statusCodeOf(node: unknown): number | undefined {
	if (typeof node !== "object" || node === null) {
		return undefined;
	}

	const record = node as Record<string, unknown>;

	for (const key of ["statusCode", "status"]) {
		const value = record[key];

		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
	}

	return undefined;
}

function textOf(node: unknown): string {
	if (typeof node === "string") {
		return node;
	}

	if (typeof node !== "object" || node === null) {
		return "";
	}

	const record = node as Record<string, unknown>;
	const parts = [record.name, record.code, record.message].filter(
		(part): part is string => typeof part === "string",
	);

	return parts.join(" ");
}

/** AI SDK errors all carry AI_-prefixed names; they mark the provider call. */
function isProviderCallNode(node: unknown): boolean {
	if (typeof node !== "object" || node === null) {
		return false;
	}

	const name = (node as Record<string, unknown>).name;

	return typeof name === "string" && name.startsWith("AI_");
}

const TIMEOUT_PATTERN =
	/timed?[ _-]?out|timeout|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|ETIMEDOUT|ESOCKETTIMEDOUT/i;
const OVERLOADED_PATTERN =
	/overloaded|capacity|at capacity|resource[_ ]exhausted|server[_ ]busy/i;
const CREDIT_CODE_PATTERN = /INSUFFICIENT_CREDITS/;
// The exact message shape InsufficientCreditsError produces — deliberately
// NOT a loose "Insufficient credits" match, because OpenRouter's own 402
// says "Insufficient credits. Add more using…" about OUR account with THEM,
// and that must classify as a provider failure, never the user's wallet.
const OUR_CREDITS_MESSAGE_PATTERN =
	/Insufficient credits: required \d+, available \d+/;
const MEMBER_LIMIT_PATTERN = /MEMBER_CREDIT_LIMIT_REACHED/;

/**
 * Walk the whole error tree and return the bounded failure code. Provider
 * evidence wins over local wrappers: a validation error whose cause chain
 * carries a provider 429 is a provider failure, because the provider is what
 * interrupted the build.
 */
export function classifyBuildFailure(error: unknown): PageBuildFailureCode {
	const nodes = collectErrorNodes(error);

	// Phase-tagged errors are authoritative for their phase — unless a
	// provider signal hides underneath (kept via cause, checked below).
	const tagged = nodes.find(
		(node): node is TaggedBuildError => node instanceof TaggedBuildError,
	);

	// OUR billing rejections first: they need a different card (wallet), and
	// they also carry HTTP-ish status codes that must not read as provider.
	// Provider-call nodes are skipped: a provider's own 402/credits message
	// is the provider's problem and falls through to the provider block.
	for (const node of nodes) {
		if (isProviderCallNode(node)) {
			continue;
		}

		const text = textOf(node);

		if (
			CREDIT_CODE_PATTERN.test(text) ||
			OUR_CREDITS_MESSAGE_PATTERN.test(text)
		) {
			return "insufficient_credits";
		}

		if (
			MEMBER_LIMIT_PATTERN.test(text) ||
			text.includes("member credit limit")
		) {
			return "member_limit";
		}
	}

	// Provider signals: status codes and provider-call error shapes anywhere
	// in the tree.
	let sawProviderCall = false;
	let providerStatus: number | undefined;

	for (const node of nodes) {
		if (isProviderCallNode(node)) {
			sawProviderCall = true;
		}

		const status = statusCodeOf(node);

		if (status !== undefined && providerStatus === undefined) {
			providerStatus = status;
		}
	}

	if (providerStatus === 429) {
		return "provider_rate_limited";
	}

	if (providerStatus === 503 || providerStatus === 529) {
		return "provider_overloaded";
	}

	const combinedText = nodes.map(textOf).join(" ");

	if (sawProviderCall || providerStatus !== undefined) {
		if (OVERLOADED_PATTERN.test(combinedText)) {
			return "provider_overloaded";
		}

		if (TIMEOUT_PATTERN.test(combinedText)) {
			return "provider_timeout";
		}

		if (providerStatus !== undefined && providerStatus >= 400) {
			return "provider_error";
		}

		if (sawProviderCall) {
			return "provider_error";
		}
	}

	if (tagged) {
		return tagged.failureCode;
	}

	// A model call that died on the socket without an AI_ wrapper (undici
	// fetch failures bubble raw): still a provider-side interruption.
	if (TIMEOUT_PATTERN.test(combinedText)) {
		return "provider_timeout";
	}

	const validation = nodes.some(
		(node) =>
			typeof node === "object" &&
			node !== null &&
			(node as Record<string, unknown>).name === "PageValidationError",
	);

	if (validation) {
		return "invalid_output";
	}

	return "internal_error";
}
