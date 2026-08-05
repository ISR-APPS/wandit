import { Agent as UndiciAgent, fetch as undiciFetch } from "undici";

/**
 * High reasoning effort keeps the model silent for minutes between streamed
 * chunks while it composes a brief, and undici's default 5-minute
 * headers/body idle timeouts kill the socket mid-think ("TypeError:
 * terminated"). Trigger workers raise that ceiling process-wide
 * (trigger/undici-timeouts.ts); the API process must not — webhooks, auth
 * and storage keep the defaults — so only the chat model's gateway leg gets
 * the long-idle dispatcher.
 */
const chatGatewayDispatcher = new UndiciAgent({
	bodyTimeout: 3_600_000,
	headersTimeout: 3_600_000,
});

/**
 * MUST be undici's own fetch, never Node's built-in: the built-in fetch
 * dispatches with the BUNDLED undici's legacy handler interface, and handing
 * it a raw npm undici v8 Agent throws InvalidArgumentError("invalid
 * onRequestStart method") on every request — surfaced as "Cannot connect to
 * API", killing each chat turn at the first model call (WANDIT-SERVER-A).
 * setGlobalDispatcher survives that mix only because it registers a
 * Dispatcher1Wrapper under the legacy symbol; an explicit per-request
 * dispatcher gets no such bridge. Same-package fetch + Agent keeps the
 * dispatch interfaces matched.
 */
export const chatGatewayFetch = ((
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
) =>
	undiciFetch(input as Parameters<typeof undiciFetch>[0], {
		...init,
		dispatcher: chatGatewayDispatcher,
	} as Parameters<typeof undiciFetch>[1])) as unknown as typeof fetch;
