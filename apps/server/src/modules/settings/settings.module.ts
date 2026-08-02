import { Global, Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminSecurityModule } from "../admin/admin-security.module";
import { ProductSettingsService } from "./application/services/product-settings.service";
import { ProductSettingsRepository } from "./infrastructure/persistence/product-settings.repository";
import { AdminSettingsController } from "./presentation/http/controllers/admin-settings.controller";
import { PublicSettingsController } from "./presentation/http/controllers/public-settings.controller";
import { SubscriptionsEnabledGuard } from "./presentation/http/guards/subscriptions-enabled.guard";
import { TopupsEnabledGuard } from "./presentation/http/guards/topups-enabled.guard";

// Global: EarlyAccessGuard and the billing kill-switch guards resolve
// ProductSettingsService from ANY module hosting a guarded controller —
// same reason AuthModule is global.
@Global()
@Module({
	controllers: [AdminSettingsController, PublicSettingsController],
	exports: [
		ProductSettingsService,
		SubscriptionsEnabledGuard,
		TopupsEnabledGuard,
	],
	imports: [AdminSecurityModule, DatabaseModule],
	providers: [
		ProductSettingsRepository,
		ProductSettingsService,
		SubscriptionsEnabledGuard,
		TopupsEnabledGuard,
	],
})
export class SettingsModule {}
