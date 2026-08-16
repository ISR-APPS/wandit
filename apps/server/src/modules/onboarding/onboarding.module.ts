import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { OnboardingService } from "./application/services/onboarding.service";
import { OnboardingRepository } from "./infrastructure/persistence/onboarding.repository";
import { OnboardingController } from "./presentation/http/controllers/onboarding.controller";

@Module({
	controllers: [OnboardingController],
	imports: [DatabaseModule],
	providers: [OnboardingRepository, OnboardingService],
})
export class OnboardingModule {}
