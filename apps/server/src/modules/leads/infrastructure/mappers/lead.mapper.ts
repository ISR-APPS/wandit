// DB row → contract DTO. `source` and `campaign` are derived here (never
// stored): the UI wants closed labels, the DB keeps the full attribution.
import type { Lead } from "@wandit/contracts";
import {
	deriveLeadCampaign,
	deriveLeadSource,
} from "../../domain/derive-lead-source";
import type { LeadRow } from "../persistence/leads.repository";

export function toLeadDto(row: LeadRow): Lead {
	return {
		campaign: deriveLeadCampaign(row.attribution),
		commune: row.commune,
		createdAt: row.createdAt.toISOString(),
		extras: (row.extras as Record<string, unknown> | null) ?? null,
		id: row.id,
		name: row.name,
		phone: row.phone,
		source: deriveLeadSource(row.attribution),
		status: row.status,
		wilaya: row.wilaya,
	};
}
