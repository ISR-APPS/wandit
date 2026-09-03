import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { storyLinkSignupsQuerySchema } from "@wandit/contracts";

import type {
	StoryLinkSignupsQuery,
	StoryLinkStatsQuery,
	StoryLinksQuery,
} from "./story-links.dto";
import {
	fetchStoryLinkSignups,
	fetchStoryLinkStats,
	getStoryLinks,
} from "./story-links.services";

function storyLinkSignupsQueryDimensions(query: StoryLinkSignupsQuery) {
	const parsedQuery = storyLinkSignupsQuerySchema.parse(query);

	return [
		parsedQuery.range,
		parsedQuery.from ?? null,
		parsedQuery.to ?? null,
		parsedQuery.page,
		parsedQuery.pageSize,
	] as const;
}

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
	stats: (storyLinkId: string, query: StoryLinkStatsQuery) =>
		[
			...storyLinksKeys.all,
			"stats",
			storyLinkId,
			query.range,
			query.from ?? null,
			query.to ?? null,
		] as const,
	signups: (storyLinkId: string, query: StoryLinkSignupsQuery) =>
		[
			...storyLinksKeys.all,
			"signups",
			storyLinkId,
			...storyLinkSignupsQueryDimensions(query),
		] as const,
};

export function useStoryLinksQuery(query: StoryLinksQuery) {
	return useQuery({
		queryKey: storyLinksKeys.list(query),
		queryFn: () => getStoryLinks(query),
	});
}

export function useStoryLinkStatsQuery(
	storyLinkId: string | null,
	query: StoryLinkStatsQuery,
) {
	return useQuery({
		queryKey: storyLinksKeys.stats(storyLinkId ?? "none", query),
		queryFn: () => fetchStoryLinkStats(storyLinkId as string, query),
		enabled: storyLinkId !== null,
	});
}

export function useStoryLinkSignupsQuery(
	storyLinkId: string | null,
	query: StoryLinkSignupsQuery,
	{ enabled }: { enabled: boolean },
) {
	return useQuery({
		queryKey: storyLinksKeys.signups(storyLinkId ?? "none", query),
		queryFn: () => fetchStoryLinkSignups(storyLinkId as string, query),
		enabled: enabled && storyLinkId !== null,
		placeholderData: keepPreviousData,
	});
}
