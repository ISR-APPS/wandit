import {
	createStoryLinkInputSchema,
	listStoryLinksQuerySchema,
	storyLinkSchema,
	storyLinksResponseSchema,
	storyLinksRoutes,
	updateStoryLinkInputSchema,
} from "@wandit/contracts";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

import type {
	CreateStoryLinkInput,
	StoryLink,
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
