/**
 * Lifecycle email events: capture through LifecycleEventsService, delivery through the dispatcher.
 * AppModule imports it once; feature modules inject the exported service.
 */
import { Global, Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { PaidOwnerRepository } from "../billing/infrastructure/persistence/paid-owner.repository";
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
		// The dispatcher reads the paid-owner rule for the free-only events and `payload.plan`.
		PaidOwnerRepository,
	],
})
export class LifecycleEventsModule {}
