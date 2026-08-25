import { type Auth, auth } from "@wandit/auth";
import type { createDb } from "@wandit/db";

import { LeadSheetAutoSyncService } from "../modules/leads/application/services/lead-sheet-auto-sync.service";
import { LeadSheetSyncService } from "../modules/leads/application/services/lead-sheet-sync.service";
import { GoogleSheetsClient } from "../modules/leads/infrastructure/google/google-sheets.client";
import { LeadSheetSyncsRepository } from "../modules/leads/infrastructure/persistence/lead-sheet-syncs.repository";
import { LeadsRepository } from "../modules/leads/infrastructure/persistence/leads.repository";

export function createLeadSheetAutoSyncRuntime(
	db: ReturnType<typeof createDb>,
	authInstance: Auth = auth,
) {
	const syncsRepository = new LeadSheetSyncsRepository(db);
	const syncService = new LeadSheetSyncService(
		authInstance,
		new GoogleSheetsClient(),
		syncsRepository,
		new LeadsRepository(db),
	);

	return {
		autoSync: new LeadSheetAutoSyncService(syncsRepository, syncService),
	};
}
