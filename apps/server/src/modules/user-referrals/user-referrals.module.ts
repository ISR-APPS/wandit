/**
 * Nest module of the user referral program: invite codes, claims, and credit rewards.
 * AppModule imports it. It serves the routes under `/api/v1/user-referrals`.
 * The Trigger task `user-referral-sweep` builds the same service by hand, without this module.
 */
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditsModule } from "../credits/credits.module";
import { UserReferralsService } from "./application/services/user-referrals.service";
import { UserReferralsRepository } from "./infrastructure/persistence/user-referrals.repository";
import { UserReferralsController } from "./presentation/http/controllers/user-referrals.controller";

// SettingsModule is global, so ProductSettingsService needs no import here.
@Module({
	controllers: [UserReferralsController],
	imports: [CreditsModule, DatabaseModule],
	providers: [UserReferralsRepository, UserReferralsService],
})
export class UserReferralsModule {}
