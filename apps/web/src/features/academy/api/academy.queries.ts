import { useQuery } from "@tanstack/react-query";

import { getAcademyGuide, listAcademyGuides } from "./academy.services";

// Academy content is global, so these keys deliberately omit workspace scope.
export const academyKeys = {
	all: ["academy"] as const,
	guides: () => [...academyKeys.all, "guides"] as const,
	guide: (id: string) => [...academyKeys.all, "guide", id] as const,
};

export function useAcademyGuidesQuery() {
	return useQuery({
		queryKey: academyKeys.guides(),
		queryFn: listAcademyGuides,
	});
}

export function useAcademyGuideQuery(id: string) {
	return useQuery({
		queryKey: academyKeys.guide(id),
		queryFn: () => getAcademyGuide(id),
	});
}
