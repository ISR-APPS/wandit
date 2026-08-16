import type {
	CreateMonthlyCostRequest,
	ListMonthlyCostsQuery,
	ListMonthlyCostsResponse,
	MonthlyCostEntry,
	UpdateMonthlyCostRequest,
} from "@wandit/contracts";
import {
	adminCostsRoutes,
	createMonthlyCostRequestSchema,
	listMonthlyCostsQuerySchema,
	listMonthlyCostsResponseSchema,
	monthKeySchema,
	monthlyCostResponseSchema,
	updateMonthlyCostRequestSchema,
} from "@wandit/contracts";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

export type MonthlyCostsQueryInput = Partial<ListMonthlyCostsQuery>;

export async function listMonthlyCosts(
	query: MonthlyCostsQueryInput = {},
): Promise<ListMonthlyCostsResponse> {
	const params = listMonthlyCostsQuerySchema.parse(query);
	const payload = await apiGet<unknown>(adminCostsRoutes.collection, params);

	return listMonthlyCostsResponseSchema.parse(payload);
}

export async function createMonthlyCost(
	input: CreateMonthlyCostRequest,
): Promise<MonthlyCostEntry> {
	const body = createMonthlyCostRequestSchema.parse(input);
	const payload = await apiPost<unknown>(adminCostsRoutes.collection, body);

	return monthlyCostResponseSchema.parse(payload).month;
}

export async function updateMonthlyCost(input: {
	month: string;
	data: UpdateMonthlyCostRequest;
}): Promise<MonthlyCostEntry> {
	const month = monthKeySchema.parse(input.month);
	const body = updateMonthlyCostRequestSchema.parse(input.data);
	const payload = await apiPatch<unknown>(adminCostsRoutes.month(month), body);

	return monthlyCostResponseSchema.parse(payload).month;
}

export async function deleteMonthlyCost(monthInput: string): Promise<void> {
	const month = monthKeySchema.parse(monthInput);
	await apiDelete<void>(adminCostsRoutes.month(month));
}
