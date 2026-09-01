import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { Sentry } from "@wandit/observability/browser";

import { adminMyPermissionsQueryKey } from "@/features/auth/api/admin-permissions.queries";
import { invalidateSessionCache } from "@/features/auth/lib/session";
import { isApiClientError } from "@/lib/api-client";

// HTTP responses the API answered deliberately (4xx guard/business outcomes,
// including the admin guard's on-purpose 404) are not client bugs, and 5xx
// causes are already captured server-side. Capture only network failures,
// malformed responses, and non-API errors.
function isExpectedApiResponse(error: unknown): boolean {
	return isApiClientError(error) && error.status >= 400;
}

function invalidateSessionOnPermissionError(error: unknown): void {
	if (isApiClientError(error) && error.code === "ADMIN_PERMISSION_REQUIRED") {
		invalidateSessionCache();
		void queryClient.invalidateQueries({
			queryKey: adminMyPermissionsQueryKey,
		});
	}
}

export const queryClient = new QueryClient({
	// Global error reporting: fires once per failed query/mutation (after
	// retries). Only the key's first element is recorded — full keys can
	// embed user-typed search input.
	queryCache: new QueryCache({
		onError: (error, query) => {
			invalidateSessionOnPermissionError(error);
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
			invalidateSessionOnPermissionError(error);
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
			refetchOnWindowFocus: false,
			retry: 1,
		},
		mutations: {
			retry: false,
		},
	},
});
