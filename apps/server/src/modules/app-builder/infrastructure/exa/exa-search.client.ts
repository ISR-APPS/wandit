/**
 * Calls Exa `POST /search` (https://docs.exa.ai/reference/search) for the
 * `web_search` host tool. `builder-turn.deps.ts` binds it to `EXA_API_KEY`,
 * and the tool calls it once per search, with type "auto" or "deep". It calls `fetch` and parses the
 * answer with `exaSearchResponseSchema`. No SDK and no retry: the agent can
 * search again.
 */
import {
	type ExaSearchResponse,
	exaSearchResponseSchema,
} from "@wandit/contracts";

import { redactProviderText } from "../../../ai-errors/domain";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
// The turn stall watchdog (4 min) must never fire on one search.
// "auto" answers in a few seconds: 30 s, like the other vendor clients.
// "deep" takes 4 to 15 s plus about 2 s for the written answer: 60 s keeps more than a 3x margin.
const EXA_SEARCH_TIMEOUT_MS = { auto: 30_000, deep: 60_000 } as const;
// The instruction of the text answer of a deep search. The agent reads it as input tokens.
const DEEP_ANSWER_DESCRIPTION =
	"A concise answer to the query in at most 300 words. Put the source URL after each fact.";
// The Exa error JSON is short. 500 chars keep its message and drop a long HTML page.
const ERROR_MESSAGE_MAX_CHARS = 500;

/** One search as the `web_search` tool asks for it. */
export type ExaSearchRequest = {
	query: string;
	/** The Exa search type. "deep" also asks Exa for a text answer in `output.content`. */
	type: "auto" | "deep";
	/** 1 to 10. Exa "auto" and "deep" price 1 to 10 results the same. */
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
 * search also stops after the `EXA_SEARCH_TIMEOUT_MS` of its type.
 */
export async function searchExa(
	apiKey: string,
	request: ExaSearchRequest,
	abortSignal: AbortSignal | undefined,
): Promise<ExaSearchOutcome> {
	const timeout = AbortSignal.timeout(EXA_SEARCH_TIMEOUT_MS[request.type]);
	const response = await fetch(EXA_SEARCH_URL, {
		body: JSON.stringify({
			contents: { text: { maxCharacters: request.maxCharacters } },
			...(request.includeDomains !== undefined &&
			request.includeDomains.length > 0
				? { includeDomains: request.includeDomains }
				: {}),
			numResults: request.numResults,
			...(request.type === "deep"
				? {
						outputSchema: {
							description: DEEP_ANSWER_DESCRIPTION,
							type: "text",
						},
					}
				: {}),
			query: request.query,
			type: request.type,
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
