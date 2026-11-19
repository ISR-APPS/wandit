/**
 * Calls Exa `POST /search` (https://docs.exa.ai/reference/search) for the
 * `web_search` host tool. `builder-turn.deps.ts` binds it to `EXA_API_KEY`,
 * and the tool calls it once per search. It calls `fetch` and parses the
 * answer with `exaSearchResponseSchema`. No SDK and no retry: the agent can
 * search again.
 */
import {
	type ExaSearchResponse,
	exaSearchResponseSchema,
} from "@wandit/contracts";

import { redactProviderText } from "../../../ai-errors/domain";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
// 30 s, like the other vendor clients. Exa "auto" answers in a few seconds,
// and the turn stall watchdog (4 min) must never fire on one search.
const EXA_SEARCH_TIMEOUT_MS = 30_000;
// The Exa error JSON is short. 500 chars keep its message and drop a long HTML page.
const ERROR_MESSAGE_MAX_CHARS = 500;

/** One search as the `web_search` tool asks for it. */
export type ExaSearchRequest = {
	query: string;
	/** 1 to 10. Exa "auto" prices 1 to 10 results the same. */
	numResults: number;
	/** Sites to search only, for example `react.dev`. Absent or empty: the whole web. */
	includeDomains?: string[];
	/** Most chars of page text per result. Exa cuts the text, so the answer stays small. */
	maxCharacters: number;
};

/**
 * The answer of one search. `failed` is a non-2xx answer; its `message` is
 * redacted and cut. A network error, a timeout, or an abort throws.
 */
export type ExaSearchOutcome =
	| { status: "ok"; response: ExaSearchResponse }
	| { status: "failed"; httpStatus: number; message: string };

/**
 * Runs one Exa search. `abortSignal` is the signal of the tool call; the
 * search also stops after `EXA_SEARCH_TIMEOUT_MS`.
 */
export async function searchExa(
	apiKey: string,
	request: ExaSearchRequest,
	abortSignal: AbortSignal | undefined,
): Promise<ExaSearchOutcome> {
	const timeout = AbortSignal.timeout(EXA_SEARCH_TIMEOUT_MS);
	const response = await fetch(EXA_SEARCH_URL, {
		body: JSON.stringify({
			contents: { text: { maxCharacters: request.maxCharacters } },
			...(request.includeDomains !== undefined &&
			request.includeDomains.length > 0
				? { includeDomains: request.includeDomains }
				: {}),
			numResults: request.numResults,
			query: request.query,
			type: "auto",
		}),
		headers: { "content-type": "application/json", "x-api-key": apiKey },
		method: "POST",
		signal:
			abortSignal === undefined
				? timeout
				: AbortSignal.any([abortSignal, timeout]),
	});

	if (!response.ok) {
		// A provider body can echo a URL, a credential, or a full HTML page.
		const body = redactProviderText(await response.text()).slice(
			0,
			ERROR_MESSAGE_MAX_CHARS,
		);
		return {
			httpStatus: response.status,
			message: `Exa answered ${response.status}: ${body}`,
			status: "failed",
		};
	}

	return {
		response: exaSearchResponseSchema.parse(await response.json()),
		status: "ok",
	};
}
