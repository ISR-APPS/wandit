import { useMutation, useQueryClient } from "@tanstack/react-query";

import { exampleKeys } from "@/features/example/api/example.keys";
import {
	createExample,
	deleteExample,
} from "@/features/example/api/example.requests";

/**
 * example.mutations.ts — WRITE hooks.
 *
 * Same idea as queries, but for actions that CHANGE data. After a successful
 * write we invalidate the list query so any screen showing that list re-fetches
 * and reflects the new state automatically — the UI never manually patches the
 * cache.
 */

// Create a new example, then refresh the list.
export function useCreateExample() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createExample,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
		},
	});
}

// Delete an example, then refresh the list.
export function useDeleteExample() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteExample,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
		},
	});
}
