import type { Example } from "@/features/example/lib/example.schemas";

/**
 * example.helpers.ts — pure, UI-free functions for this feature.
 *
 * No React, no network — just functions that transform this feature's data. Pure
 * helpers like these are the easiest thing in the codebase to unit-test, so push
 * any non-trivial data logic down here out of components.
 */

// Newest first. Copies the array before sorting so we never mutate cached data.
export function sortExamplesByNewest(examples: Example[]): Example[] {
	return [...examples].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
