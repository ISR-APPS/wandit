// The one React Query client of the app. The root layout provides it.
// The query and mutation hooks in `src/features/<feature>/api/` use it.
// It logs every failed request, so a screen only shows a translated error.
import {
	focusManager,
	MutationCache,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

/** The one client. It logs every failed query and mutation; reads stay fresh for 30 s. */
export const queryClient = new QueryClient({
	// The screen shows a general message; the real error goes to the log here.
	queryCache: new QueryCache({
		onError: (error, query) => {
			console.error("[query] failed", query.queryKey, error);
		},
	}),
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			console.error("[mutation] failed", mutation.options.mutationKey, error);
		},
	}),
	defaultOptions: {
		queries: {
			// 30 s: a quick return to the app does not refetch fresh data.
			staleTime: 30_000,
			// supabase-js already retries a failed read up to 3 times. One more try is enough.
			retry: 1,
		},
	},
});

// React Query reads the browser focus on the web. On a phone, the app state
// tells it when the app comes back to the front, so stale data refetches.
if (Platform.OS !== "web") {
	focusManager.setEventListener((setFocused) => {
		const subscription = AppState.addEventListener("change", (status) => {
			setFocused(status === "active");
		});
		return () => subscription.remove();
	});
}
