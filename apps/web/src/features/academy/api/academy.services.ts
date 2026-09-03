import {
	type AcademyGuide,
	type AcademyGuideListItem,
	academyGuideSchema,
	academyRoutes,
	listAcademyGuidesResponseSchema,
} from "@wandit/contracts";

import { ApiService as apiClient } from "@/lib/api-service";

/** Load the published Academy library and validate it at the network edge. */
export async function listAcademyGuides(): Promise<AcademyGuideListItem[]> {
	const data = await apiClient.get<unknown>(academyRoutes.list);

	return listAcademyGuidesResponseSchema.parse(data);
}

/** Load one published Academy guide and validate its full reading payload. */
export async function getAcademyGuide(id: string): Promise<AcademyGuide> {
	const data = await apiClient.get<unknown>(academyRoutes.byId(id));

	return academyGuideSchema.parse(data);
}
