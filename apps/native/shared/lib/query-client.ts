/**
 * query-client.ts — the shared TanStack Query client for the mobile app.
 *
 * This single client holds every server-cache entry. It is created ONCE here and
 * provided at the app root (app/_layout.tsx) so every screen's query/mutation
 * hooks share the same cache. Ported from the web app's query-client.ts.
 */
import { QueryClient } from "@tanstack/react-query";

import { isUnauthorizedApiError } from "@/shared/lib/api-client";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Treat data as fresh for 30s before a background refetch is considered.
			staleTime: 30_000,
			// A 401 never heals by retrying — base-service is already redirecting to
			// sign-in — so give up immediately in that case.
			retry: (failureCount, error) => {
				if (isUnauthorizedApiError(error)) {
					return false;
				}

				return failureCount < 1;
			},
			// NOTE: web sets refetchOnWindowFocus:false. A phone has no window focus;
			// if you want refetch-on-foreground, wire react-query's focusManager to
			// React Native's AppState later.
		},
		mutations: {
			retry: false,
		},
	},
});
