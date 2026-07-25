import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { LeadsService } from "./application/services/leads.service";
import { LeadsCaptureService } from "./application/services/leads-capture.service";
import { LeadsCaptureThrottle } from "./application/services/leads-capture-throttle";
import { LeadsRepository } from "./infrastructure/persistence/leads.repository";
import { LeadsController } from "./presentation/http/controllers/leads.controller";
import { LeadsCaptureController } from "./presentation/http/controllers/leads-capture.controller";

@Module({
	controllers: [LeadsCaptureController, LeadsController],
	exports: [LeadsRepository],
	imports: [DatabaseModule],
	providers: [
		LeadsCaptureService,
		LeadsCaptureThrottle,
		LeadsRepository,
		LeadsService,
	],
})
export class LeadsModule {}
