import {
	createStoryLinkInputSchema,
	listStoryLinksQuerySchema,
	storyLinkSchema,
	storyLinkSignupsQuerySchema,
	storyLinkSignupsResponseSchema,
	storyLinkStatsQuerySchema,
	storyLinkStatsResponseSchema,
	storyLinksResponseSchema,
	storyLinksRoutes,
	updateStoryLinkInputSchema,
} from "@wandit/contracts";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

import type {
	CreateStoryLinkInput,
	StoryLink,
	StoryLinkSignupsQuery,
	StoryLinkSignupsResponse,
	StoryLinkStatsQuery,
	StoryLinkStatsResponse,
	StoryLinksQuery,
	StoryLinksResponse,
	UpdateStoryLinkInput,
} from "./story-links.dto";

export async function getStoryLinks(
	query: StoryLinksQuery,
): Promise<StoryLinksResponse> {
	const parsedQuery = listStoryLinksQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		storyLinksRoutes.adminStoryLinks,
		parsedQuery,
	);

	return storyLinksResponseSchema.parse(payload);
}

export async function fetchStoryLinkStats(
	storyLinkId: string,
	query: StoryLinkStatsQuery,
): Promise<StoryLinkStatsResponse> {
	const parsedQuery = storyLinkStatsQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		storyLinksRoutes.adminStoryLinkStats(storyLinkId),
		parsedQuery,
	);

	return storyLinkStatsResponseSchema.parse(payload);
}

export async function fetchStoryLinkSignups(
	storyLinkId: string,
	query: StoryLinkSignupsQuery,
): Promise<StoryLinkSignupsResponse> {
	const parsedQuery = storyLinkSignupsQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		storyLinksRoutes.adminStoryLinkSignups(storyLinkId),
		parsedQuery,
	);

	return storyLinkSignupsResponseSchema.parse(payload);
}

export async function createStoryLink(
	input: CreateStoryLinkInput,
): Promise<StoryLink> {
	const body = createStoryLinkInputSchema.parse(input);
	const payload = await apiPost<unknown>(
		storyLinksRoutes.adminStoryLinks,
		body,
	);

	return storyLinkSchema.parse(payload);
}

export async function updateStoryLink(input: {
	storyLinkId: string;
	data: UpdateStoryLinkInput;
}): Promise<StoryLink> {
	const body = updateStoryLinkInputSchema.parse(input.data);
	const payload = await apiPatch<unknown>(
		storyLinksRoutes.adminStoryLink(input.storyLinkId),
		body,
	);

	return storyLinkSchema.parse(payload);
}
