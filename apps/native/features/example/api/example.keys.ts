/**
 * example.keys.ts — this feature's react-query cache keys, in one place.
 *
 * A "query key" is the label react-query stores cached data under. Centralizing
 * them here means a mutation can invalidate exactly the right queries (see
 * example.mutations.ts) without hand-typing string arrays all over the feature —
 * which is how caches get subtly out of sync.
 *
 * The nested shape lets you invalidate broadly (all example queries) or narrowly
 * (just one record) from the same object.
 */
export const exampleKeys = {
	all: ["examples"] as const,
	lists: () => [...exampleKeys.all, "list"] as const,
	list: () => [...exampleKeys.lists()] as const,
	details: () => [...exampleKeys.all, "detail"] as const,
	detail: (id: string) => [...exampleKeys.details(), id] as const,
};
