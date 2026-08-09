import { useMemo, useState } from "react";

import { sortExamplesByNewest } from "@/features/example/lib/example.helpers";
import type { Example } from "@/features/example/lib/example.schemas";

/**
 * use-example-filters.ts — a feature-local UI hook (NOT a server hook).
 *
 * Server hooks (fetching/caching) live in api/ — useExamples, useCreateExample.
 * THIS kind of hook is different: it holds local view state (search text, active
 * tab, sort order) and derives what to show. It never touches the network.
 *
 * Put it in lib/ so several of the feature's components/screens can share the same
 * view logic without duplicating useState + useMemo.
 */
export function useExampleFilters(examples: Example[]) {
	const [search, setSearch] = useState("");

	const visibleExamples = useMemo(() => {
		const sorted = sortExamplesByNewest(examples);

		if (!search.trim()) {
			return sorted;
		}

		const needle = search.trim().toLowerCase();
		return sorted.filter((example) =>
			example.title.toLowerCase().includes(needle),
		);
	}, [examples, search]);

	return { search, setSearch, visibleExamples };
}
