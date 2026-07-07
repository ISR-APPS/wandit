import { useQuery } from "@tanstack/react-query";

import { exampleKeys } from "@/features/example/api/example.keys";
import {
	getExample,
	getExamples,
} from "@/features/example/api/example.requests";

/**
 * example.queries.ts — READ hooks.
 *
 * A screen calls useExamples() and gets back { data, isLoading, error }. The hook
 * decides the cache KEY and which request function to call; the request function
 * decides HOW to talk to the server. Two clean jobs.
 *
 * Screens/components should only ever import these hooks — never the raw request
 * functions — so every read gets caching, dedup, and loading state for free.
 */

// List all examples.
export function useExamples() {
	return useQuery({
		queryKey: exampleKeys.list(),
		queryFn: getExamples,
	});
}

// Load a single example by id.
export function useExample(id: string) {
	return useQuery({
		queryKey: exampleKeys.detail(id),
		queryFn: () => getExample(id),
		// Don't fire the request until we actually have an id.
		enabled: !!id,
	});
}
