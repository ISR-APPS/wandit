// Raw async functions for the leads entity — NO React in here. Currently
// mock implementations over lib/mock-leads.ts with realistic latency; they
// become thin fetch wrappers over the shared api-client once the NestJS
// backend lands, responses parsed by packages/contracts.

import { listMockLeads, updateMockLeadStatus } from "../lib/mock-leads";
import type { Lead, LeadStatus } from "./dto";

const latency = () =>
	new Promise<void>((resolve) =>
		setTimeout(resolve, 300 + Math.random() * 200),
	);

export async function listLeads(
	projectId: string,
	seedCount: number,
): Promise<Lead[]> {
	await latency();
	return listMockLeads(projectId, seedCount);
}

export async function updateLeadStatus(
	projectId: string,
	leadId: string,
	status: LeadStatus,
): Promise<Lead> {
	await latency();
	return updateMockLeadStatus(projectId, leadId, status);
}
