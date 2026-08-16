import { useQuery } from "@tanstack/react-query";

import type { StoryLinksQuery } from "./story-links.dto";
import { getStoryLinks } from "./story-links.services";

export const storyLinksKeys = {
	all: ["admin-story-links"] as const,
	list: (query: StoryLinksQuery) =>
		[
			...storyLinksKeys.all,
			"list",
			query.range,
			query.from ?? null,
			query.to ?? null,
		] as const,
};

export function useStoryLinksQuery(query: StoryLinksQuery) {
	return useQuery({
		queryKey: storyLinksKeys.list(query),
		queryFn: () => getStoryLinks(query),
	});
}
