// DB row → contract DTO. `source` is derived here (never stored): the UI
// wants one closed label, the DB keeps the full attribution for later.
import type { Lead } from "@wandit/contracts";
import { deriveLeadSource } from "../../domain/derive-lead-source";
import type { LeadRow } from "../persistence/leads.repository";

export function toLeadDto(row: LeadRow): Lead {
	return {
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
