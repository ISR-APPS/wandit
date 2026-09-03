import {
	type AffiliateAttributionsResponse,
	type AffiliateCommissionsResponse,
	type AffiliateCsvExportQuery,
	type AffiliateDetail,
	type AffiliatesResponse,
	affiliateAttributionsResponseSchema,
	affiliateCommissionsResponseSchema,
	affiliateCsvExportQuerySchema,
	affiliateDetailSchema,
	affiliateLinkListItemSchema,
	affiliateLinksResponseSchema,
	affiliatePayoutDetailSchema,
	affiliatePayoutsResponseSchema,
	affiliateProgramDetailSchema,
	affiliateProgramsResponseSchema,
	affiliatesResponseSchema,
	affiliatesRoutes,
	type BuildAffiliatePayoutInput,
	buildAffiliatePayoutInputSchema,
	type CreateAffiliateInput,
	type CreateAffiliateLinkInput,
	type CreateAffiliateProgramInput,
	createAffiliateInputSchema,
	createAffiliateLinkInputSchema,
	createAffiliateProgramInputSchema,
	deleteAffiliateResourceResponseSchema,
	type ListAffiliateAttributionsQuery,
	type ListAffiliateCommissionsQuery,
	type ListAffiliateLinksQuery,
	type ListAffiliatePayoutsQuery,
	type ListAffiliateProgramsQuery,
	type ListAffiliatesQuery,
	listAffiliateAttributionsQuerySchema,
	listAffiliateCommissionsQuerySchema,
	listAffiliateLinksQuerySchema,
	listAffiliatePayoutsQuerySchema,
	listAffiliateProgramsQuerySchema,
	listAffiliatesQuerySchema,
	type MarkAffiliatePayoutFailedInput,
	type MarkAffiliatePayoutPaidInput,
	markAffiliatePayoutFailedInputSchema,
	markAffiliatePayoutPaidInputSchema,
	type UpdateAffiliateInput,
	type UpdateAffiliateLinkInput,
	type UpdateAffiliateProgramInput,
	updateAffiliateInputSchema,
	updateAffiliateLinkInputSchema,
	updateAffiliateProgramInputSchema,
} from "@wandit/contracts";

import {
	type ApiQueryParams,
	apiDelete,
	apiGet,
	apiGetRaw,
	apiPatch,
	apiPost,
} from "@/lib/api-client";

export type AffiliateProgramsQueryInput = Partial<ListAffiliateProgramsQuery>;
export type AffiliatesQueryInput = Partial<ListAffiliatesQuery>;
export type AffiliateLinksQueryInput = Partial<ListAffiliateLinksQuery>;
export type AffiliateAttributionsQueryInput =
	Partial<ListAffiliateAttributionsQuery>;
export type AffiliateCommissionsQueryInput =
	Partial<ListAffiliateCommissionsQuery>;
export type AffiliatePayoutsQueryInput = Partial<ListAffiliatePayoutsQuery>;

export async function listAffiliatePrograms(
	query: AffiliateProgramsQueryInput = {},
) {
	const parsed = listAffiliateProgramsQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminPrograms,
		toQueryParams(parsed),
	);
	return affiliateProgramsResponseSchema.parse(payload);
}

export async function getAffiliateProgram(programId: string) {
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminProgram(programId),
	);
	return affiliateProgramDetailSchema.parse(payload);
}

export async function createAffiliateProgram(
	input: CreateAffiliateProgramInput,
) {
	const body = createAffiliateProgramInputSchema.parse(input);
	const payload = await apiPost<unknown>(affiliatesRoutes.adminPrograms, body);
	return affiliateProgramDetailSchema.parse(payload);
}

export async function updateAffiliateProgram(input: {
	programId: string;
	data: UpdateAffiliateProgramInput;
}) {
	const body = updateAffiliateProgramInputSchema.parse(input.data);
	const payload = await apiPatch<unknown>(
		affiliatesRoutes.adminProgram(input.programId),
		body,
	);
	return affiliateProgramDetailSchema.parse(payload);
}

export async function archiveAffiliateProgram(programId: string) {
	const payload = await apiDelete<unknown>(
		affiliatesRoutes.adminProgram(programId),
	);
	return deleteAffiliateResourceResponseSchema.parse(payload);
}

export async function listAffiliates(
	query: AffiliatesQueryInput = {},
): Promise<AffiliatesResponse> {
	const parsed = listAffiliatesQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminAffiliates,
		toQueryParams(parsed),
	);
	return affiliatesResponseSchema.parse(payload);
}

export async function getAffiliate(
	affiliateId: string,
): Promise<AffiliateDetail> {
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminAffiliate(affiliateId),
	);
	return affiliateDetailSchema.parse(payload);
}

export async function createAffiliate(input: CreateAffiliateInput) {
	const body = createAffiliateInputSchema.parse(input);
	const payload = await apiPost<unknown>(
		affiliatesRoutes.adminAffiliates,
		body,
	);
	return affiliateDetailSchema.parse(payload);
}

export async function updateAffiliate(input: {
	affiliateId: string;
	data: UpdateAffiliateInput;
}) {
	const body = updateAffiliateInputSchema.parse(input.data);
	const payload = await apiPatch<unknown>(
		affiliatesRoutes.adminAffiliate(input.affiliateId),
		body,
	);
	return affiliateDetailSchema.parse(payload);
}

export async function listAffiliateLinks(
	affiliateId: string,
	query: AffiliateLinksQueryInput = {},
) {
	const parsed = listAffiliateLinksQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminAffiliateLinks(affiliateId),
		toQueryParams(parsed),
	);
	return affiliateLinksResponseSchema.parse(payload);
}

export async function createAffiliateLink(input: {
	affiliateId: string;
	data: CreateAffiliateLinkInput;
}) {
	const body = createAffiliateLinkInputSchema.parse(input.data);
	const payload = await apiPost<unknown>(
		affiliatesRoutes.adminAffiliateLinks(input.affiliateId),
		body,
	);
	return affiliateLinkListItemSchema.parse(payload);
}

export async function updateAffiliateLink(input: {
	affiliateId: string;
	linkId: string;
	data: UpdateAffiliateLinkInput;
}) {
	const body = updateAffiliateLinkInputSchema.parse(input.data);
	const payload = await apiPatch<unknown>(
		affiliatesRoutes.adminAffiliateLink(input.affiliateId, input.linkId),
		body,
	);
	return affiliateLinkListItemSchema.parse(payload);
}

export async function deactivateAffiliateLink(input: {
	affiliateId: string;
	linkId: string;
}) {
	const payload = await apiDelete<unknown>(
		affiliatesRoutes.adminAffiliateLink(input.affiliateId, input.linkId),
	);
	return deleteAffiliateResourceResponseSchema.parse(payload);
}

export async function listAffiliateAttributions(
	affiliateId: string,
	query: AffiliateAttributionsQueryInput = {},
): Promise<AffiliateAttributionsResponse> {
	const parsed = listAffiliateAttributionsQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminAffiliateAttributions(affiliateId),
		toQueryParams(parsed),
	);
	return affiliateAttributionsResponseSchema.parse(payload);
}

export async function listAffiliateCommissions(
	query: AffiliateCommissionsQueryInput = {},
): Promise<AffiliateCommissionsResponse> {
	const parsed = listAffiliateCommissionsQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminCommissions,
		toQueryParams(parsed),
	);
	return affiliateCommissionsResponseSchema.parse(payload);
}

export async function listAffiliatePayouts(
	query: AffiliatePayoutsQueryInput = {},
) {
	const parsed = listAffiliatePayoutsQuerySchema.parse(query);
	const payload = await apiGet<unknown>(
		affiliatesRoutes.adminPayouts,
		toQueryParams(parsed),
	);
	return affiliatePayoutsResponseSchema.parse(payload);
}

export async function getAffiliatePayout(payoutId: string) {
	const payload = await apiGet<unknown>(affiliatesRoutes.adminPayout(payoutId));
	return affiliatePayoutDetailSchema.parse(payload);
}

export async function buildAffiliatePayout(input: BuildAffiliatePayoutInput) {
	const body = buildAffiliatePayoutInputSchema.parse(input);
	const payload = await apiPost<unknown>(affiliatesRoutes.adminPayouts, body);
	return affiliatePayoutDetailSchema.parse(payload);
}

export async function markAffiliatePayoutPaid(input: {
	payoutId: string;
	data: MarkAffiliatePayoutPaidInput;
}) {
	const body = markAffiliatePayoutPaidInputSchema.parse(input.data);
	const payload = await apiPost<unknown>(
		affiliatesRoutes.adminPayoutMarkPaid(input.payoutId),
		body,
	);
	return affiliatePayoutDetailSchema.parse(payload);
}

export async function markAffiliatePayoutFailed(input: {
	payoutId: string;
	data: MarkAffiliatePayoutFailedInput;
}) {
	const body = markAffiliatePayoutFailedInputSchema.parse(input.data);
	const payload = await apiPost<unknown>(
		affiliatesRoutes.adminPayoutMarkFailed(input.payoutId),
		body,
	);
	return affiliatePayoutDetailSchema.parse(payload);
}

export async function downloadAffiliateCsv(
	query: AffiliateCsvExportQuery,
): Promise<string> {
	const parsed = affiliateCsvExportQuerySchema.parse(query);
	const response = await apiGetRaw(
		affiliatesRoutes.adminExport,
		toQueryParams(parsed),
		"text/csv",
	);
	const blob = await response.blob();
	const fileName = csvFileName(response.headers.get("Content-Disposition"));
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.hidden = true;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
	return fileName;
}

function toQueryParams(value: object): ApiQueryParams {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as ApiQueryParams;
}

function csvFileName(contentDisposition: string | null): string {
	const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
	return (
		match?.[1] ?? `affiliates-${new Date().toISOString().slice(0, 10)}.csv`
	);
}
