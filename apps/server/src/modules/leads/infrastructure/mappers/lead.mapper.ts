// DB row → contract DTO. `source` and `campaign` are derived here (never
// stored): the UI wants closed labels, the DB keeps the full attribution.
import type { Lead, WorkspaceLead } from "@wandit/contracts";
import {
	deriveLeadCampaign,
	deriveLeadSource,
} from "../../domain/derive-lead-source";
import type {
	LeadRow,
	WorkspaceLeadRow,
} from "../persistence/leads.repository";

export function toLeadDto(row: LeadRow): Lead {
	return {
		archivedAt: row.archivedAt?.toISOString() ?? null,
		campaign: deriveLeadCampaign(row.attribution),
		commune: row.commune,
		createdAt: row.createdAt.toISOString(),
		extras: (row.extras as Record<string, unknown> | null) ?? null,
		id: row.id,
		name: row.name,
		phone: row.phone,
		productSku: row.productSku,
		source: deriveLeadSource(row.attribution),
		status: row.status,
		wilaya: row.wilaya,
	};
}

export function toWorkspaceLeadDto(row: WorkspaceLeadRow): WorkspaceLead {
	return {
		...toLeadDto(row),
		projectId: row.projectId,
		projectName: row.projectName,
	};
}
