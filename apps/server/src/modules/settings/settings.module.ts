import { Global, Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminSecurityModule } from "../admin/admin-security.module";
import { ProductSettingsService } from "./application/services/product-settings.service";
import { ProductSettingsRepository } from "./infrastructure/persistence/product-settings.repository";
import { AdminSettingsController } from "./presentation/http/controllers/admin-settings.controller";
import { PublicSettingsController } from "./presentation/http/controllers/public-settings.controller";
import { ManualPaymentsEnabledGuard } from "./presentation/http/guards/manual-payments-enabled.guard";
import { OrganizationsEnabledGuard } from "./presentation/http/guards/organizations-enabled.guard";
import { SubscriptionsEnabledGuard } from "./presentation/http/guards/subscriptions-enabled.guard";
import { TopupsEnabledGuard } from "./presentation/http/guards/topups-enabled.guard";

// Global: the billing kill-switch guards resolve
// ProductSettingsService from ANY module hosting a guarded controller —
// same reason AuthModule is global.
@Global()
@Module({
	controllers: [AdminSettingsController, PublicSettingsController],
	exports: [
		ManualPaymentsEnabledGuard,
		OrganizationsEnabledGuard,
		ProductSettingsService,
		SubscriptionsEnabledGuard,
		TopupsEnabledGuard,
	],
	imports: [AdminSecurityModule, DatabaseModule],
	providers: [
		ManualPaymentsEnabledGuard,
		OrganizationsEnabledGuard,
		ProductSettingsRepository,
		ProductSettingsService,
		SubscriptionsEnabledGuard,
		TopupsEnabledGuard,
	],
})
export class SettingsModule {}
