import { QueryClient } from "@tanstack/react-query";

// Shared TanStack Query client. Route loaders can preload through feature
// api/*.services.ts fetchers once the backend lands.
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});
