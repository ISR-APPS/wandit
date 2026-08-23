import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { LeadSheetSyncService } from "./application/services/lead-sheet-sync.service";
import { LeadsService } from "./application/services/leads.service";
import { LeadsCaptureService } from "./application/services/leads-capture.service";
import { LeadsCaptureThrottle } from "./application/services/leads-capture-throttle";
import { GoogleSheetsClient } from "./infrastructure/google/google-sheets.client";
import { LeadSheetSyncsRepository } from "./infrastructure/persistence/lead-sheet-syncs.repository";
import { LeadsRepository } from "./infrastructure/persistence/leads.repository";
import { LeadSheetSyncController } from "./presentation/http/controllers/lead-sheet-sync.controller";
import { LeadsController } from "./presentation/http/controllers/leads.controller";
import { LeadsCaptureController } from "./presentation/http/controllers/leads-capture.controller";

@Module({
	controllers: [
		LeadsCaptureController,
		LeadsController,
		LeadSheetSyncController,
	],
	exports: [LeadSheetSyncService, LeadsRepository, LeadsService],
	imports: [DatabaseModule, PushNotificationsModule],
	providers: [
		GoogleSheetsClient,
		LeadSheetSyncService,
		LeadSheetSyncsRepository,
		LeadsCaptureService,
		LeadsCaptureThrottle,
		LeadsRepository,
		LeadsService,
	],
})
export class LeadsModule {}
