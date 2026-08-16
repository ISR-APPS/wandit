import {
	type AdminListAcademyGuidesQuery,
	academyGuideSchema,
	academyRoutes,
	adminListAcademyGuidesQuerySchema,
	adminListAcademyGuidesResponseSchema,
	type CreateAcademyGuideInput,
	createAcademyGuideInputSchema,
	deleteAcademyGuideResponseSchema,
	type UpdateAcademyGuideInput,
	updateAcademyGuideInputSchema,
} from "@wandit/contracts";

import {
	type ApiQueryParams,
	apiDelete,
	apiGet,
	apiPatch,
	apiPost,
} from "@/lib/api-client";

export type AcademyGuidesQueryInput = Partial<AdminListAcademyGuidesQuery>;

export async function listAcademyGuides(query: AcademyGuidesQueryInput = {}) {
	const parsed = adminListAcademyGuidesQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		academyRoutes.adminList,
		toQueryParams(parsed),
	);
	return adminListAcademyGuidesResponseSchema.parse(payload);
}

export async function getAcademyGuide(guideId: string) {
	const payload = await apiGet<unknown>(academyRoutes.adminById(guideId));
	return academyGuideSchema.parse(payload);
}

export async function createAcademyGuide(input: CreateAcademyGuideInput) {
	const body = createAcademyGuideInputSchema.parse(input);
	const payload = await apiPost<unknown>(academyRoutes.adminList, body);
	return academyGuideSchema.parse(payload);
}

export async function updateAcademyGuide(input: {
	guideId: string;
	data: UpdateAcademyGuideInput;
}) {
	const body = updateAcademyGuideInputSchema.parse(input.data);
	const payload = await apiPatch<unknown>(
		academyRoutes.adminById(input.guideId),
		body,
	);
	return academyGuideSchema.parse(payload);
}

export async function deleteAcademyGuide(guideId: string) {
	const payload = await apiDelete<unknown>(academyRoutes.adminById(guideId));
	return deleteAcademyGuideResponseSchema.parse(payload);
}

function toQueryParams(value: object): ApiQueryParams {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as ApiQueryParams;
}
