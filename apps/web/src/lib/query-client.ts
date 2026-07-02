import { QueryClient } from "@tanstack/react-query";

import { isUnauthorizedApiError } from "@/lib/api-client";

// Shared TanStack Query client. Route loaders can preload through feature
// api/*.services.ts fetchers once the backend lands.
export const queryClient = new QueryClient({
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
