import { Global, Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { EmailModule } from "../email/email.module";
import { SettingsModule } from "../settings/settings.module";
import { LifecycleEventsService } from "./application/services/lifecycle-events.service";
import { LifecycleEventsDispatcher } from "./application/services/lifecycle-events-dispatcher.service";
import { LifecycleEventsRepository } from "./infrastructure/persistence/lifecycle-events.repository";

// Global because lifecycle capture points span otherwise unrelated feature
// modules. Each hook injects the exported service; delivery stays private here.
@Global()
@Module({
	exports: [LifecycleEventsService],
	imports: [DatabaseModule, EmailModule, SettingsModule],
	providers: [
		LifecycleEventsDispatcher,
		LifecycleEventsRepository,
		LifecycleEventsService,
	],
})
export class LifecycleEventsModule {}
