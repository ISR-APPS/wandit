import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
	type AcademyGuidesQueryInput,
	getAcademyGuide,
	listAcademyGuides,
} from "./academy.services";

export const academyKeys = {
	all: ["admin-academy"] as const,
	lists: ["admin-academy", "guides"] as const,
	guides: (query?: AcademyGuidesQueryInput) =>
		[...academyKeys.lists, query ?? {}] as const,
	guide: (guideId: string) => [...academyKeys.all, "guide", guideId] as const,
};

export function useAcademyGuidesQuery(query: AcademyGuidesQueryInput = {}) {
	return useQuery({
		queryKey: academyKeys.guides(query),
		queryFn: () => listAcademyGuides(query),
		placeholderData: keepPreviousData,
	});
}

export function useAcademyGuideQuery(
	guideId: string | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: academyKeys.guide(guideId ?? "none"),
		queryFn: () => getAcademyGuide(guideId as string),
		enabled: enabled && Boolean(guideId),
	});
}
