/**
 * In-memory `fetch` for the specs of `SupabaseManagementClient`,
 * `CloudService`, the agent backend tools, and `WorkersForPlatformsClient`.
 * `scriptedFetch` records each call and answers a queue of responses in
 * order; `jsonResponse` builds one JSON answer.
 */

/** One call the fake fetch recorded; specs assert on it. */
export type RecordedRequest = {
	url: string;
	method: string;
	headers: Record<string, string>;
	/** The request body text; null when the call sent none or sent a form. */
	body: string | null;
	/** The multipart body; specs read a part with `form.get(name)`. Null for other bodies. */
	form: FormData | null;
};

/** Builds a JSON `Response` for the scripted answer queue. `body` is the serialized JSON text. */
export function jsonResponse(
	status: number,
	body: string,
	headers?: Record<string, string>,
): Response {
	return new Response(body, {
		status,
		headers: { "content-type": "application/json", ...headers },
	});
}

/**
 * A fetch that records each call into `requests` and answers `answers` in
 * order. An `Error` entry rejects the promise, like a network failure; an
 * empty queue rejects too.
 */
export function scriptedFetch(
	answers: (Response | Error)[],
	requests: RecordedRequest[],
): typeof globalThis.fetch {
	return (input, init) => {
		requests.push({
			url: String(input),
			method: init?.method ?? "GET",
			headers: Object.fromEntries(new Headers(init?.headers)),
			body: typeof init?.body === "string" ? init.body : null,
			form: init?.body instanceof FormData ? init.body : null,
		});
		const answer = answers.shift();
		if (answer === undefined) {
			return Promise.reject(new Error("scripted answers exhausted"));
		}
		if (answer instanceof Error) {
			return Promise.reject(answer);
		}
		return Promise.resolve(answer);
	};
}
