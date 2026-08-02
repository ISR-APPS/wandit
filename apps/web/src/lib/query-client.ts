import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { Sentry } from "@wandit/observability/browser";

import { isApiClientError, isUnauthorizedApiError } from "@/lib/api-client";

// HTTP responses the API answered deliberately (4xx business outcomes) are
// not client bugs, and 5xx causes are already captured server-side with the
// full stack — reporting them again here would only duplicate incidents.
// What IS worth capturing from the browser: network failures, malformed
// responses, and non-API errors thrown in query/mutation code.
function isExpectedApiResponse(error: unknown): boolean {
	return isApiClientError(error) && error.statusCode >= 400;
}

// Shared TanStack Query client. Route loaders can preload through feature
// api/*.services.ts fetchers once the backend lands.
export const queryClient = new QueryClient({
	// Global error reporting: fires once per failed query/mutation (after
	// retries). Only the key's first element is recorded — full keys can
	// embed user-typed search input.
	queryCache: new QueryCache({
		onError: (error, query) => {
			if (isExpectedApiResponse(error)) {
				return;
			}
			Sentry.captureException(error, {
				tags: { source: "query" },
				contexts: {
					query: { queryKeyNamespace: String(query.queryKey[0] ?? "unknown") },
				},
			});
		},
	}),
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			if (isExpectedApiResponse(error)) {
				return;
			}
			Sentry.captureException(error, {
				tags: { source: "mutation" },
				contexts: {
					mutation: {
						mutationKeyNamespace: String(
							mutation.options.mutationKey?.[0] ?? "unknown",
						),
					},
				},
			});
		},
	}),
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			// A 401 never heals by retrying — the api client is already
			// redirecting into the auth flow.
			retry: (failureCount, error) => {
				if (isUnauthorizedApiError(error)) {
					return false;
				}

				return failureCount < 1;
			},
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: false,
		},
	},
});
